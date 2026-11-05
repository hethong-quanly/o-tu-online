const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const v6 = require('./lib/v7');

const PORT = process.env.PORT || 3847;
const DATA_FILE = path.join(__dirname, 'data', 'players.json');
const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const useSupabase = !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
const supabase = useSupabase
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;
const MAX_PLAYERS = Math.max(1, parseInt(process.env.MAX_PLAYERS || '10000', 10) || 10000);
const NPC_COUNT = Math.max(0, parseInt(process.env.NPC_COUNT || '16', 10) || 16);
const VERSION = '3d-v7';

/** Guard NPCs — patrol, vision, bribe window (in-game money only) */
const GUARD_DEFS = [
  { id: 'g1', name: 'Cán bộ Hùng', x: -17, z: -1, route: [[-17,-1],[-10,6],[-17,10],[-17,-1]] },
  { id: 'g2', name: 'Cán bộ Hữu', x: 10, z: 4, route: [[10,4],[14,10],[8,12],[10,4]] },
  { id: 'g3', name: 'Cán bộ Lan', x: 12, z: 33, route: [[12,33],[-6,33],[0,30],[12,33]] },
];
const guards = GUARD_DEFS.map((g) => ({
  id: g.id, name: g.name, x: g.x, z: g.z, rotY: Math.PI,
  route: g.route, routeIdx: 1, lookingAwayUntil: 0, chasingId: null, alertUntil: 0,
}));
function bribePrice(p) {
  const base = Math.max(45, Math.floor(35 + (p.sentenceLeftDays || 0) / 10 + (p.escapeFails || 0) * 25 + (p.daysServed || 0) / 25));
  const disc = rankFromXp(p.rankXp || 0).bribeDiscount || 0;
  return Math.max(25, Math.floor(base * (1 - disc)));
}
function activeBribe(p) {
  return !!(p.bribeGuardId && p.bribeUntil && Date.now() < p.bribeUntil);
}
function publicGuards() {
  const now = Date.now();
  return guards.map((g) => ({
    id: g.id, name: g.name, x: g.x, z: g.z, rotY: g.rotY,
    lookingAway: now < g.lookingAwayUntil,
    alert: now < g.alertUntil,
    chasingId: g.chasingId,
  }));
}

/** Funny prisoner ranks (no real-gang refs) — XP + soft perks */
const RANKS = [
  { id: 'tu_moi', name: 'Tù mới', emoji: '🐣', xp: 0, payBonus: 0, shopDiscount: 0, bribeDiscount: 0 },
  { id: 'ma_cu', name: 'Ma cũ', emoji: '😼', xp: 40, payBonus: 0.05, shopDiscount: 0.05, bribeDiscount: 0.05 },
  { id: 'dai_ca', name: 'Đại ca', emoji: '😎', xp: 120, payBonus: 0.1, shopDiscount: 0.08, bribeDiscount: 0.1 },
  { id: 'trum_buong', name: 'Trùm buồng', emoji: '🦁', xp: 280, payBonus: 0.15, shopDiscount: 0.12, bribeDiscount: 0.15 },
  { id: 'trum_khu', name: 'Trùm khu vực', emoji: '👑', xp: 550, payBonus: 0.22, shopDiscount: 0.16, bribeDiscount: 0.2 },
  { id: 'trum_trai', name: 'Trùm trại', emoji: '🏆', xp: 950, payBonus: 0.3, shopDiscount: 0.2, bribeDiscount: 0.25 },
];

function rankFromXp(xp) {
  let cur = RANKS[0];
  for (const r of RANKS) {
    if ((xp || 0) >= r.xp) cur = r;
  }
  return cur;
}

function nextRank(xp) {
  const cur = rankFromXp(xp);
  const idx = RANKS.findIndex((r) => r.id === cur.id);
  return idx >= 0 && idx < RANKS.length - 1 ? RANKS[idx + 1] : null;
}

function rankPublic(p) {
  const xp = p.rankXp || 0;
  const r = rankFromXp(xp);
  const n = nextRank(xp);
  return {
    id: r.id,
    name: r.name,
    emoji: r.emoji,
    xp,
    nextXp: n ? n.xp : null,
    nextName: n ? n.name : null,
    payBonus: r.payBonus,
    shopDiscount: r.shopDiscount,
    bribeDiscount: r.bribeDiscount,
  };
}

function grantRankXp(p, amount, socket) {
  if (!p || !amount) return null;
  const before = rankFromXp(p.rankXp || 0);
  p.rankXp = Math.max(0, (p.rankXp || 0) + amount);
  const after = rankFromXp(p.rankXp);
  if (after.id !== before.id) {
    p.rankId = after.id;
    if (socket) {
      socket.emit('rankUp', {
        rank: rankPublic(p),
        message: `${after.emoji} Thăng hạng: ${after.name}! (+lương +giảm giá shop/hối lộ)`,
      });
    }
    pushChat({
      type: 'system',
      text: `${after.emoji} ${p.nickname} lên hạng ${after.name}!`,
      ts: Date.now(),
    });
    return after;
  }
  p.rankId = after.id;
  return null;
}

function isTestNickKey(key) {
  const k = String(key || '').toLowerCase().trim();
  if (!k) return false;
  if (k === 'anh 3 trà cú' || k === 'công chúa') return false;
  return /^(phuctest|alpha$|beta$|debug|sọc|soc3d|áoxanh|phúcshot|tùnhân|chibi|desk|mob|diag|audio|bribe|test|smoke|bot)/i.test(k);
}

async function purgeTestAccounts() {
  const removed = [];
  for (const key of Object.keys(playersByNick)) {
    if (isTestNickKey(key)) {
      delete playersByNick[key];
      removed.push(key);
    }
  }
  for (let i = letters.length - 1; i >= 0; i--) {
    const nick = String(letters[i].nick || '').toLowerCase();
    if (isTestNickKey(nick)) letters.splice(i, 1);
  }
  if (!removed.length) return 0;
  console.log(`[persist] purged ${removed.length} test accounts from memory`);
  if (useSupabase) {
    try {
      await supabase.from('leaderboard_stats').delete().in('nick_key', removed);
      await supabase.from('players').delete().in('nick_key', removed);
      // Delete letters authored by purged test nicks only (keep real humans)
      const { data: letterRows } = await supabase.from('letters').select('id, nick');
      const badIds = (letterRows || [])
        .filter((L) => isTestNickKey(String(L.nick || '').toLowerCase()))
        .map((L) => L.id);
      if (badIds.length) await supabase.from('letters').delete().in('id', badIds);
    } catch (e) {
      console.error('[persist] purge supabase', e.message);
    }
  }
  return removed.length;
}



const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.get('/sw.js', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Service-Worker-Allowed', '/');
  res.type('application/javascript');
  res.sendFile(path.join(__dirname, 'public', 'sw.js'));
});
app.get('/manifest.json', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.type('application/manifest+json');
  res.sendFile(path.join(__dirname, 'public', 'manifest.json'));
});
app.get('/privacy', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'privacy.html'));
});
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders(res, filePath) {
    if (filePath.endsWith('sw.js')) {
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Service-Worker-Allowed', '/');
    }
  },
}));

const JOBS = {
  giat_do: { id: 'giat_do', name: 'Giặt đồ', emoji: '👕', basePay: 15, energyCost: 8, cooldownMs: 8000, description: 'Giặt quần áo cho trại', room: null },
  nau_an: { id: 'nau_an', name: 'Nấu ăn', emoji: '🍲', basePay: 25, energyCost: 12, cooldownMs: 12000, description: 'Giúp bếp nấu suất ăn', room: 'nha_bep' },
  lao_dong: { id: 'lao_dong', name: 'Lao động nặng', emoji: '⛏️', basePay: 45, energyCost: 20, cooldownMs: 18000, description: 'Đập đá / dọn sân', room: 'xuong' },
  thu_hoach: v6.LABOR_JOBS.thu_hoach,
  may_do: v6.LABOR_JOBS.may_do,
  moc: v6.LABOR_JOBS.moc,
};

const SHOP = {
  giuong: { id: 'giuong', name: 'Giường tốt hơn', emoji: '🛏️', price: 80, maxLevel: 5, description: '+10 máu tối đa / cấp, hồi năng lượng nhanh hơn' },
  do_an: { id: 'do_an', name: 'Suất ăn đặc biệt', emoji: '🍖', price: 40, maxLevel: 10, description: '+15 máu & +20 năng lượng ngay (tiêu thụ)' },
  cong_cu: { id: 'cong_cu', name: 'Công cụ lao động', emoji: '🔧', price: 100, maxLevel: 5, description: '+15% tiền công / cấp' },
  dung_cu_vuot: { id: 'dung_cu_vuot', name: 'Dụng cụ vượt ngục', emoji: '🗝️', price: 200, maxLevel: 3, description: '+12% tỉ lệ vượt ngục / cấp' },
};

let ROOMS = [];
let ROOM_BY_ID = {};
let ROOM_GRAPH = {};
let CELL_COUNT = v6.MIN_CELLS;

function applyRoomLayout(cellCount) {
  CELL_COUNT = Math.max(v6.MIN_CELLS, Math.min(v6.MAX_CELLS, cellCount | 0));
  const built = v6.rebuildRooms(CELL_COUNT);
  ROOMS = built.rooms;
  ROOM_BY_ID = built.byId;
  ROOM_GRAPH = built.graph;
}
applyRoomLayout(v6.MIN_CELLS);

function rescaleCells() {
  const pop = online.size + Object.keys(playersByNick).length;
  const need = v6.neededCellCount(Math.max(online.size, Math.ceil(pop / 4)));
  if (need !== CELL_COUNT) {
    applyRoomLayout(need);
    // keep players in valid rooms
    for (const p of online.values()) {
      if (p.role === 'guard') continue;
      if (!ROOM_BY_ID[p.room]) {
        const cell = ROOM_BY_ID[p.cellId] || v6.pickCell(online, ROOMS);
        p.cellId = cell.id;
        p.room = cell.id;
        p.x = cell.x + (Math.random() - 0.5) * 2;
        p.z = cell.z + (Math.random() - 0.5) * 2;
      }
    }
  }
}

const APPEARANCE = {
  skins: ['#e0b090', '#c68642', '#8d5524', '#f1c27d', '#ffdbac'],
  hairs: ['#2a2218', '#1a1a1a', '#5a3a1a', '#c4a35a', '#4a2020', '#708090'],
  stripes: [
    { id: 'orange', light: '#ff7a1a', dark: '#e86810', name: 'Áo cam' },
    { id: 'bw', light: '#f5f5f5', dark: '#151515', name: 'Sọc trắng–đen' },
    { id: 'blue', light: '#e8f0ff', dark: '#1a3050', name: 'Sọc xanh' },
    { id: 'police', light: '#2a4a7a', dark: '#0d1b2a', name: 'Đồng phục quản giáo' },
  ],
};

const CRIMES = [
  { id: 'karaoke', label: 'Hát karaoke quá giờ quy định' },
  { id: 'com', label: 'Ăn cơm nhà hàng rồi “quên” ví' },
  { id: 'keo', label: 'Đánh bạc bằng kẹo cao su' },
  { id: 'wifi', label: 'Dùng Wi‑Fi hàng xóm không xin phép' },
  { id: 'meo', label: 'Bắt cóc… mèo hàng xóm nửa tiếng' },
  { id: 'ship', label: 'Bùng 3 đơn trà sữa liên tiếp' },
  { id: 'park', label: 'Đậu xe chiếm 2 chỗ “vì đẹp"' },
  { id: 'custom', label: 'Tội danh tự khai (hài hước)' },
];

const SENTENCE_OPTIONS = [
  { id: '1m', label: '1 tháng', days: 30 },
  { id: '3m', label: '3 tháng', days: 90 },
  { id: '6m', label: '6 tháng', days: 180 },
  { id: '1y', label: '1 năm', days: 365 },
  { id: '2y', label: '2 năm', days: 730 },
  { id: '5y', label: '5 năm (nặng!)', days: 1825 },
];

const SCHEDULE = [
  { id: 'an', name: 'Giờ ăn', emoji: '🍲', roomHint: 'nha_bep', seconds: 55, graceSec: 12, announce: '📢 Quản giáo: Giờ ăn! Vào Nhà ăn / Căn tin / Bếp. Vắng mặt sẽ bị trừ điểm.' },
  { id: 'lao_dong', name: 'Giờ lao động', emoji: '⛏️', roomHint: 'xuong', seconds: 55, graceSec: 12, announce: '📢 Quản giáo: Giờ lao động! Ra Sân lao động / Xưởng ngay.' },
  { id: 'tat_den', name: 'Giờ ngủ / Tắt đèn', emoji: '🌙', roomHint: 'cell', seconds: 55, graceSec: 15, announce: '📢 Quản giáo: Tắt đèn! Về đúng phòng giam của mình nghỉ.' },
];
const scheduleWarned = new Map(); // key -> Set(sid)
const schedulePenalized = new Map();

const ACHIEVEMENTS = [
  { id: 'work_5', name: 'Công nhân cần cù', desc: 'Hoàn thành 5 ca làm việc', stat: 'workCount', target: 5, points: 15 },
  { id: 'work_20', name: 'Lao động tiên tiến', desc: 'Hoàn thành 20 ca làm việc', stat: 'workCount', target: 20, points: 35 },
  { id: 'sched_3', name: 'Đúng giờ', desc: 'Có mặt đúng lịch 3 lần', stat: 'scheduleAttend', target: 3, points: 20 },
  { id: 'sched_10', name: 'Gương mẫu lịch sinh hoạt', desc: 'Có mặt đúng lịch 10 lần', stat: 'scheduleAttend', target: 10, points: 40 },
  { id: 'win_3', name: 'Cao thủ sân trại', desc: 'Thắng 3 trận Caro/KBB', stat: 'gameWins', target: 3, points: 20 },
  { id: 'win_10', name: 'Vô địch khu giam', desc: 'Thắng 10 trận mini-game', stat: 'gameWins', target: 10, points: 45 },
  { id: 'letter_3', name: 'Nhớ nhà', desc: 'Gửi 3 lá thư', stat: 'lettersSent', target: 3, points: 15 },
  { id: 'letter_10', name: 'Nhà văn tường Bảng Thư', desc: 'Gửi 10 lá thư', stat: 'lettersSent', target: 10, points: 30 },
  { id: 'mark_7', name: 'Gạch ngày bền bỉ', desc: 'Gạch 7 ngày trên tường', stat: 'daysMarked', target: 7, points: 15 },
  { id: 'good_behavior', name: 'Cải tạo tốt', desc: 'Không vượt ngục thất bại', stat: 'cleanRecord', target: 1, points: 25 },
];

const DAY_TICK_MS = 18000; // 1 in-game day ~18s real
const REVIEW_EVERY_DAYS = 8; // periodic giảm án review

function uid() {
  return crypto.randomBytes(6).toString('hex');
}

function prisonerNumber() {
  return 'OT-' + String(1000 + Math.floor(Math.random() * 9000));
}

function normalizeAppearance(a) {
  a = a || {};
  const skin = APPEARANCE.skins.includes(a.skin) ? a.skin : APPEARANCE.skins[0];
  const hair = APPEARANCE.hairs.includes(a.hair) ? a.hair : APPEARANCE.hairs[0];
  const stripe = APPEARANCE.stripes.find((s) => s.id === a.stripe) || APPEARANCE.stripes[0];
  return { skin, hair, stripe: stripe.id };
}

function ratingFromPoints(pts) {
  if (pts >= 100) return { id: 'tot', label: 'Tốt' };
  if (pts >= 55) return { id: 'kha', label: 'Khá' };
  if (pts >= 25) return { id: 'tb', label: 'Trung bình' };
  return { id: 'kem', label: 'Kém' };
}

function reductionForRating(id) {
  if (id === 'tot') return 5;
  if (id === 'kha') return 3;
  if (id === 'tb') return 1;
  return 0;
}

function computeAchievementProgress(p) {
  const stats = {
    workCount: p.workCount || 0,
    scheduleAttend: p.scheduleAttend || 0,
    gameWins: p.gameWins || 0,
    lettersSent: p.lettersSent || 0,
    daysMarked: p.daysMarked || 0,
    cleanRecord: (p.escapeFails || 0) === 0 ? 1 : 0,
  };
  return ACHIEVEMENTS.map((a) => {
    const cur = Math.min(stats[a.stat] || 0, a.target);
    const done = !!(p.achievementsUnlocked || {})[a.id] || cur >= a.target;
    return { ...a, current: Math.min(stats[a.stat] || 0, a.target), done };
  });
}

function unlockAchievements(p, socket) {
  if (!p.achievementsUnlocked) p.achievementsUnlocked = {};
  const stats = {
    workCount: p.workCount || 0,
    scheduleAttend: p.scheduleAttend || 0,
    gameWins: p.gameWins || 0,
    lettersSent: p.lettersSent || 0,
    daysMarked: p.daysMarked || 0,
    cleanRecord: (p.escapeFails || 0) === 0 ? 1 : 0,
  };
  const newly = [];
  for (const a of ACHIEVEMENTS) {
    if (p.achievementsUnlocked[a.id]) continue;
    if ((stats[a.stat] || 0) >= a.target) {
      p.achievementsUnlocked[a.id] = Date.now();
      p.rehabPoints = (p.rehabPoints || 0) + a.points;
      grantRankXp(p, Math.max(10, a.points * 2), socket);
      newly.push(a);
    }
  }
  if (newly.length && socket) {
    for (const a of newly) {
      socket.emit('achievement', { id: a.id, name: a.name, points: a.points, message: `🏅 Thành tích: ${a.name} (+${a.points} điểm cải tạo)` });
    }
  }
  return newly;
}

function defaultPlayer(payload, socketId) {
  const crimeId = payload.crimeId || 'karaoke';
  const crime = CRIMES.find((c) => c.id === crimeId) || CRIMES[0];
  const crimeLabel = crime.id === 'custom'
    ? String(payload.crimeCustom || 'Tội danh bí ẩn').trim().slice(0, 48) || 'Tội danh bí ẩn'
    : crime.label;
  const sent = SENTENCE_OPTIONS.find((s) => s.id === payload.sentenceId) || SENTENCE_OPTIONS[1];
  rescaleCells();
  const cell = v6.pickCell(online, ROOMS);
  return {
    id: socketId,
    nickname: payload.nickname,
    fullName: String(payload.fullName || payload.nickname).trim().slice(0, 40),
    prisonerNo: prisonerNumber(),
    crimeId: crime.id,
    crimeLabel,
    sentenceId: sent.id,
    sentenceTotalDays: sent.days,
    sentenceLeftDays: sent.days,
    daysServed: 0,
    rehabPoints: 0,
    rehabRating: 'kem',
    rankXp: 0,
    rankId: 'tu_moi',
    achievementsUnlocked: {},
    workCount: 0,
    scheduleAttend: 0,
    lettersSent: 0,
    released: false,
    releasedAt: null,
    earlyRelease: false,
    money: 80,
    health: 100,
    maxHealth: 100,
    energy: 100,
    maxEnergy: 100,
    reputation: 0,
    role: 'prisoner',
    cellId: cell.id,
    cellNo: cell.cellNo,
    room: 'khu_tam_giam',
    zone: 'quarantine',
    intakeChatMs: 0,
    intakeDone: false,
    happinessUnlocked: false,
    x: -42 + (Math.random() - 0.5) * 6,
    z: -8 + (Math.random() - 0.5) * 6,
    rotY: 0,
    upgrades: { giuong: 0, cong_cu: 0, dung_cu_vuot: 0 },
    cooldowns: {},
    escaped: false,
    escapeFails: 0,
    totalEarned: 0,
    daysMarked: 0,
    winsCaro: 0,
    winsRps: 0,
    winsQuiz: 0,
    winsBall: 0,
    winsOanQuan: 0,
    winsTienLen: 0,
    gameWins: 0,
    appearance: normalizeAppearance(payload.appearance),
    emote: null,
    emoteUntil: 0,
    sleeping: false,
    joinedAt: Date.now(),
    lastActive: Date.now(),
    lastDayTick: Date.now(),
    daysSinceReview: 0,
    daily: null,
    rankQuestClaimed: {},
    guardXp: 0,
    guardRankId: 'ha_si',
    guardIntegrity: 0,
    guardPatrols: 0,
    guardCatches: 0,
    guardRolls: 0,
    guardRefuseBribes: 0,
    guardQuestClaimed: {},
    pendingBribes: [],
    zone: 'quarantine',
    intakeChatMs: 0,
    intakeDone: false,
    happinessUnlocked: false,
    lastTalkAt: 0,
  };
}

function nearestRoom(x, z) {
  let best = ROOMS[0];
  let bestD = Infinity;
  for (const r of ROOMS) {
    const d = (r.x - x) ** 2 + (r.z - z) ** 2;
    if (d < bestD) { bestD = d; best = r; }
  }
  return best.id;
}

let playersByNick = {};
let online = new Map();
const chatHistory = [];
const MAX_CHAT = 80;
const letters = [];
const MAX_LETTERS = 40;
const invites = new Map();
const matches = new Map();

let scheduleIndex = 0;
let scheduleEndsAt = Date.now() + SCHEDULE[0].seconds * 1000;
const scheduleAttended = new Map(); // phaseKey -> Set(socketId)

function ensureDataDir() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function stripTransient(p) {
  const { id, cooldowns, emote, emoteUntil, sleeping, bribeGuardId, bribeUntil, ...rest } = p;
  return { ...rest, cooldowns: {}, sleeping: false, emote: null, bribeGuardId: null, bribeUntil: 0 };
}

function loadDataFromJson() {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) return;
  const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  playersByNick = raw.players || raw || {};
  if (Array.isArray(raw.letters)) {
    letters.length = 0;
    letters.push(...raw.letters.slice(-MAX_LETTERS));
  }
}

function leaderboardStatsRow(p) {
  const rank = rankFromXp(p.rankXp || 0);
  return {
    nick_key: String(p.nickname || '').toLowerCase(),
    nickname: p.nickname,
    full_name: p.fullName || p.nickname,
    money: Math.floor(p.money || 0),
    rehab_points: p.rehabPoints || 0,
    game_wins: p.gameWins || 0,
    wins_caro: p.winsCaro || 0,
    wins_rps: p.winsRps || 0,
    days_served: p.daysServed || 0,
    released: !!p.released,
    rank_xp: p.rankXp || 0,
    rank_id: rank.id,
    rank_name: rank.name,
    updated_at: new Date().toISOString(),
  };
}

async function loadDataFromSupabase() {
  const { data: rows, error } = await supabase.from('players').select('nick_key, data');
  if (error) throw error;
  playersByNick = {};
  for (const row of rows || []) {
    if (row && row.nick_key && row.data && typeof row.data === 'object') {
      playersByNick[row.nick_key] = row.data;
    }
  }
  const { data: letterRows, error: le } = await supabase
    .from('letters')
    .select('id, nick, text, ts')
    .order('ts', { ascending: false })
    .limit(MAX_LETTERS);
  if (le) throw le;
  letters.length = 0;
  if (Array.isArray(letterRows) && letterRows.length) {
    const ordered = letterRows.slice().reverse();
    letters.push(...ordered.map((l) => ({ id: l.id, nick: l.nick, text: l.text, ts: Number(l.ts) })));
  }
  console.log(`[persist] Supabase: ${Object.keys(playersByNick).length} players, ${letters.length} letters`);
}

async function saveDataToSupabase() {
  for (const p of online.values()) playersByNick[p.nickname.toLowerCase()] = stripTransient(p);
  // Never re-upsert smoke-test accounts
  for (const key of Object.keys(playersByNick)) {
    if (isTestNickKey(key)) delete playersByNick[key];
  }
  const playerRows = Object.entries(playersByNick).map(([nick_key, data]) => ({
    nick_key,
    data,
    updated_at: new Date().toISOString(),
  }));
  if (playerRows.length) {
    const { error } = await supabase.from('players').upsert(playerRows, { onConflict: 'nick_key' });
    if (error) throw error;
    const stats = playerRows
      .map((r) => leaderboardStatsRow(r.data))
      .filter((r) => r.nick_key);
    if (stats.length) {
      const { error: se } = await supabase.from('leaderboard_stats').upsert(stats, { onConflict: 'nick_key' });
      if (se) console.error('[persist] leaderboard_stats', se.message);
    }
  }
  const letterSlice = letters.slice(-MAX_LETTERS);
  if (letterSlice.length) {
    const { error: le } = await supabase.from('letters').upsert(
      letterSlice.map((l) => ({ id: l.id, nick: l.nick, text: l.text, ts: l.ts })),
      { onConflict: 'id' }
    );
    if (le) throw le;
  }
}

function saveDataToJson() {
  ensureDataDir();
  for (const p of online.values()) playersByNick[p.nickname.toLowerCase()] = stripTransient(p);
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify({ players: playersByNick, letters: letters.slice(-MAX_LETTERS) }, null, 2)
  );
}

let saving = false;
let saveQueued = false;

async function saveData() {
  if (saving) {
    saveQueued = true;
    return;
  }
  saving = true;
  try {
    if (useSupabase) await saveDataToSupabase();
    else saveDataToJson();
  } catch (e) {
    console.error('Save error', e.message);
    try {
      saveDataToJson();
    } catch (e2) {
      console.error('JSON fallback save failed', e2.message);
    }
  } finally {
    saving = false;
    if (saveQueued) {
      saveQueued = false;
      void saveData();
    }
  }
}

async function loadData() {
  try {
    if (useSupabase) {
      await loadDataFromSupabase();
      if (!Object.keys(playersByNick).length && fs.existsSync(DATA_FILE)) {
        const before = letters.length;
        loadDataFromJson();
        if (Object.keys(playersByNick).length || letters.length > before) {
          console.log('[persist] migrating local JSON → Supabase');
          await saveDataToSupabase();
        }
      }
    } else {
      loadDataFromJson();
      console.log('[persist] JSON fallback (set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)');
    }
  } catch (e) {
    console.error('Load error', e.message);
    playersByNick = {};
    try {
      loadDataFromJson();
      console.log('[persist] recovered from local JSON after load error');
    } catch (_) {}
  }
  const purged = await purgeTestAccounts();
  if (purged) {
    try { await saveData(); } catch (e) { console.error('[persist] post-purge save', e.message); }
  }
}

function currentSchedule() {
  const phase = SCHEDULE[scheduleIndex];
  return { id: phase.id, name: phase.name, emoji: phase.emoji, roomHint: phase.roomHint, endsAt: scheduleEndsAt, announce: phase.announce };
}

function publicPlayer(p) {
  const rating = ratingFromPoints(p.rehabPoints || 0);
  return {
    id: p.id,
    nickname: p.nickname,
    fullName: p.fullName || p.nickname,
    prisonerNo: p.prisonerNo,
    crimeLabel: p.crimeLabel,
    sentenceId: p.sentenceId,
    sentenceTotalDays: p.sentenceTotalDays,
    sentenceLeftDays: Math.max(0, Math.ceil(p.sentenceLeftDays || 0)),
    daysServed: p.daysServed || 0,
    rehabPoints: p.rehabPoints || 0,
    rehabRating: rating.id,
    rehabRatingLabel: rating.label,
    rank: rankPublic(p),
    rankXp: p.rankXp || 0,
    role: p.role || 'prisoner',
    cellId: p.cellId || null,
    cellNo: p.cellNo || null,
    quests: v6.questProgress(p),
    guardRank: (p.role === 'guard') ? (() => {
      const g = v6.guardRankFromXp(p.guardXp || 0);
      const n = v6.nextGuardRank(p.guardXp || 0);
      return { id: g.id, name: g.name, emoji: g.emoji, xp: p.guardXp || 0, nextXp: n ? n.xp : null, nextName: n ? n.name : null, integrity: p.guardIntegrity || 0 };
    })() : null,
    achievements: computeAchievementProgress(p),
    money: Math.floor(p.money),
    health: Math.round(p.health),
    maxHealth: p.maxHealth,
    energy: Math.round(p.energy),
    maxEnergy: p.maxEnergy,
    reputation: p.reputation,
    room: p.room,
    x: p.x, z: p.z, rotY: p.rotY || 0,
    upgrades: p.upgrades,
    escaped: p.escaped,
    released: !!p.released,
    earlyRelease: !!p.earlyRelease,
    escapeFails: p.escapeFails,
    bribePrice: bribePrice(p),
    bribeActive: activeBribe(p),
    bribeUntil: p.bribeUntil || 0,
    bribeGuardId: p.bribeGuardId || null,
    totalEarned: Math.floor(p.totalEarned),
    cooldowns: p.cooldowns,
    daysMarked: p.daysMarked || 0,
    winsCaro: p.winsCaro || 0,
    winsRps: p.winsRps || 0,
    winsQuiz: p.winsQuiz || 0,
    winsBall: p.winsBall || 0,
    winsOanQuan: p.winsOanQuan || 0,
    winsTienLen: p.winsTienLen || 0,
    gameWins: p.gameWins || 0,
    workCount: p.workCount || 0,
    lettersSent: p.lettersSent || 0,
    scheduleAttend: p.scheduleAttend || 0,
    guardPatrols: p.guardPatrols || 0,
    guardCatches: p.guardCatches || 0,
    guardRolls: p.guardRolls || 0,
    guardRefuseBribes: p.guardRefuseBribes || 0,
    guardIntegrity: p.guardIntegrity || 0,
    pendingBribes: p.role === 'guard' ? (p.pendingBribes || []).slice(-5) : [],
    appearance: p.appearance || normalizeAppearance(null),
    emote: p.emote && Date.now() < p.emoteUntil ? p.emote : null,
    sleeping: !!p.sleeping,
    zone: p.zone || (p.intakeDone ? 'general' : 'quarantine'),
    intakeDone: !!p.intakeDone,
    intakeChatMs: p.intakeChatMs || 0,
    intakeNeedMs: v6.INTAKE_NEED_MS,
    questsPct: v6.questsCompletePct(p),
    happinessUnlocked: v6.happinessUnlocked(p),
  };
}

function leaderboard() {
  const all = { ...playersByNick };
  for (const p of online.values()) all[p.nickname.toLowerCase()] = stripTransient(p);
  const list = Object.values(all).map((p) => {
    const rank = rankFromXp(p.rankXp || 0);
    return {
      nickname: p.nickname,
      fullName: p.fullName || p.nickname,
      prisonerNo: p.prisonerNo,
      money: Math.floor(p.money || 0),
      rehabPoints: p.rehabPoints || 0,
      rehabRatingLabel: ratingFromPoints(p.rehabPoints || 0).label,
      gameWins: p.gameWins || 0,
      daysServed: p.daysServed || 0,
      sentenceTotalDays: p.sentenceTotalDays || 0,
      released: !!p.released,
      earlyRelease: !!p.earlyRelease,
      escaped: !!p.escaped,
      releasedAt: p.releasedAt || null,
      rankXp: p.rankXp || 0,
      rankId: rank.id,
      rankName: rank.name,
      rankEmoji: rank.emoji,
    };
  });
  const early = list.filter((p) => p.released).sort((a, b) => {
    const sa = (a.daysServed || 0) / Math.max(1, a.sentenceTotalDays || 1);
    const sb = (b.daysServed || 0) / Math.max(1, b.sentenceTotalDays || 1);
    return sa - sb || (a.releasedAt || 0) - (b.releasedAt || 0);
  }).slice(0, 10);
  const wins = list.slice().sort((a, b) => b.gameWins - a.gameWins || b.rehabPoints - a.rehabPoints).slice(0, 15);
  const rehab = list.slice().sort((a, b) => b.rehabPoints - a.rehabPoints).slice(0, 15);
  const ranks = list.slice().sort((a, b) => b.rankXp - a.rankXp || b.rehabPoints - a.rehabPoints).slice(0, 15);
  return { wins, rehab, earlyRelease: early, ranks };
}

function roomCounts() {
  const counts = {};
  for (const r of ROOMS) counts[r.id] = 0;
  for (const p of online.values()) {
    if (!p.escaped && !p.released && counts[p.room] !== undefined) counts[p.room]++;
  }
  return counts;
}

function totalDaysMarked() {
  let n = 0;
  for (const p of Object.values(playersByNick)) n += p.daysMarked || 0;
  for (const p of online.values()) {
    // prefer live
  }
  n = 0;
  const seen = new Set();
  for (const p of online.values()) { n += p.daysMarked || 0; seen.add(p.nickname.toLowerCase()); }
  for (const [k, p] of Object.entries(playersByNick)) {
    if (!seen.has(k)) n += p.daysMarked || 0;
  }
  return n;
}

function broadcastState() {
  const list = [...online.values()].filter((p) => {
    if (p.role === 'guard') return true;
    if (p.escaped || p.released) return false;
    return true;
  }).map(publicPlayer);
  io.emit('world', {
    players: list,
    rooms: ROOMS,
    roomCounts: roomCounts(),
    leaderboard: leaderboard(),
    onlineCount: online.size,
    registeredCount: Object.keys(playersByNick).length,
    maxPlayers: MAX_PLAYERS,
    guards: publicGuards(),
    npcCount: NPC_COUNT,
    totalDaysMarked: totalDaysMarked(),
    schedule: currentSchedule(),
    letters: letters.slice(-20).reverse(),
    cellCount: CELL_COUNT,
    cellCapacity: v6.CELL_CAPACITY,
  });
}

function emitSelf(socket, p) {
  socket.emit('me', publicPlayer(p));
}

function pushChat(entry) {
  chatHistory.push(entry);
  if (chatHistory.length > MAX_CHAT) chatHistory.shift();
  io.emit('chat', entry);
}

function failEscapeCatch(p, socket, reason) {
  p.escapeFails = (p.escapeFails || 0) + 1;
  p.health = 40;
  p.energy = 40;
  p.money = 20;
  p.reputation = 0;
  p.rehabPoints = 0;
  p.rankXp = 0;
  p.rankId = 'tu_moi';
  p.sentenceLeftDays = p.sentenceTotalDays || 90;
  p.daysServed = 0;
  p.achievementsUnlocked = {};
  p.rankQuestClaimed = {};
  p.daily = null;
  p.bribeGuardId = null; p.bribeUntil = 0;
  p.role = 'prisoner';
  const cell = ROOM_BY_ID[p.cellId] || v6.pickCell(online, ROOMS);
  p.cellId = cell.id; p.cellNo = cell.cellNo;
  p.room = cell.id;
  p.x = cell.x; p.z = cell.z;
  p.sleeping = false; p.emote = null;
  const msg = `🚨 ${reason || 'Bị bắt!'} Toàn bộ điểm bị xóa — án tính lại từ đầu (${p.sentenceLeftDays} ngày)!`;
  if (socket) {
    emitSelf(socket, p);
    socket.emit('escapeResult', { success: false, caught: true, reset: true, message: msg });
  }
  pushChat({ type: 'system', text: `${p.nickname} vượt ngục thất bại — mất hết điểm, ở tù lại từ đầu.`, ts: Date.now() });
  broadcastState();
  io.emit('guards', publicGuards());
  saveData();
}

function promoteToGuard(p, socket) {
  p.role = 'guard';
  p.escaped = false;
  p.released = true;
  p.earlyRelease = true;
  p.releasedAt = Date.now();
  p.bribeGuardId = null; p.bribeUntil = 0;
  p.guardXp = p.guardXp || 0;
  p.guardRankId = v6.guardRankFromXp(p.guardXp).id;
  p.appearance = { ...(p.appearance || {}), stripe: 'police', skin: p.appearance?.skin || '#e0b090', hair: p.appearance?.hair || '#1a1a1a' };
  p.room = 'san_tap';
  p.x = 0; p.z = 2;
  p.sleeping = false;
  if (socket) {
    emitSelf(socket, p);
    socket.emit('escapeResult', {
      success: true, becameGuard: true,
      message: '🎉 Vượt ngục thành công! Bạn được nhận vào lực lượng Quản giáo. Đồng phục mới, nhiệm vụ mới!',
      guardRank: v6.guardRankFromXp(p.guardXp),
    });
    socket.emit('roleChanged', { role: 'guard', message: 'Bạn đã trở thành Quản giáo.' });
  }
  pushChat({ type: 'system', text: `👮 ${p.nickname} vượt ngục thành công và trở thành Quản giáo!`, ts: Date.now() });
  broadcastState();
  saveData();
}

function grantGuardXp(p, amount, socket) {
  if (!p || p.role !== 'guard' || !amount) return null;
  const before = v6.guardRankFromXp(p.guardXp || 0);
  p.guardXp = Math.max(0, (p.guardXp || 0) + amount);
  const after = v6.guardRankFromXp(p.guardXp);
  p.guardRankId = after.id;
  if (after.id !== before.id && socket) {
    socket.emit('guardRankUp', {
      rank: after,
      message: `${after.emoji} Thăng cấp Quản giáo: ${after.name}!`,
    });
    pushChat({ type: 'system', text: `${after.emoji} Quản giáo ${p.nickname} lên ${after.name}!`, ts: Date.now() });
  }
  return after;
}

function tickGuards() {
  const now = Date.now();
  for (const g of guards) {
    if (now < g.lookingAwayUntil) {
      g.chasingId = null;
      continue;
    }
    // patrol along route
    const target = g.route[g.routeIdx % g.route.length];
    const dx = target[0] - g.x, dz = target[1] - g.z;
    const dist = Math.hypot(dx, dz) || 1;
    const spd = g.chasingId ? 0.55 : 0.22;
    if (dist < 0.6) g.routeIdx = (g.routeIdx + 1) % g.route.length;
    else {
      g.x += (dx / dist) * spd;
      g.z += (dz / dist) * spd;
      g.rotY = Math.atan2(dx, dz);
    }
  }
  // detect lingering at outer fence without bribe (escape attempt)
  for (const [sid, p] of online) {
    if (p.escaped || p.released || p.sleeping) continue;
    if (activeBribe(p)) { p.fenceSuspicion = 0; continue; }
    const nearFence = p.room === 'tuong_rao' && (p.z >= 33.2 || Math.abs(p.x) >= 13.2);
    if (!nearFence) { p.fenceSuspicion = Math.max(0, (p.fenceSuspicion || 0) - 1); continue; }
    let spotted = null;
    for (const g of guards) {
      if (now < g.lookingAwayUntil) continue;
      const ddx = p.x - g.x, ddz = p.z - g.z;
      const d = Math.hypot(ddx, ddz);
      if (d > 12) continue;
      const ang = Math.atan2(ddx, ddz);
      let diff = Math.abs(ang - g.rotY);
      while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);
      if (diff < 1.2 || d < 3.5) { spotted = g; break; }
    }
    if (!spotted) { p.fenceSuspicion = Math.max(0, (p.fenceSuspicion || 0) - 1); continue; }
    p.fenceSuspicion = (p.fenceSuspicion || 0) + 1;
    spotted.chasingId = sid;
    spotted.alertUntil = now + 3500;
    if (p.fenceSuspicion === 1) {
      const sock = io.sockets.sockets.get(sid);
      if (sock) sock.emit('errorMsg', `⚠️ ${spotted.name} đang nhìn về phía bạn gần tường rào!`);
      continue;
    }
    if (p.fenceSuspicion < 3) continue;
    p.fenceSuspicion = 0;
    const sock = io.sockets.sockets.get(sid);
    failEscapeCatch(p, sock, `${spotted.name} đuổi kịp và bắt bạn tại tường rào!`);
  }
  io.emit('guards', publicGuards());
}

function setEmote(p, emote, ms) {
  p.emote = emote;
  p.emoteUntil = Date.now() + ms;
  p.sleeping = emote === 'sleep';
}

function tryRelease(p, socket, reason) {
  if (p.released || p.escaped) return false;
  if ((p.sentenceLeftDays || 0) > 0) return false;
  p.released = true;
  p.earlyRelease = (p.daysServed || 0) < (p.sentenceTotalDays || 0);
  p.releasedAt = Date.now();
  p.sentenceLeftDays = 0;
  playersByNick[p.nickname.toLowerCase()] = stripTransient(p);
  saveData();
  const msg = p.earlyRelease
    ? `🕊️ ${p.nickname} được RA TÙ SỚM nhờ cải tạo tốt! (${p.daysServed}/${p.sentenceTotalDays} ngày)`
    : `🕊️ ${p.nickname} đã MÃN HẠN — lễ trao giấy ra trại!`;
  pushChat({ type: 'system', text: msg, ts: Date.now() });
  if (socket) {
    socket.emit('released', {
      early: p.earlyRelease,
      daysServed: p.daysServed,
      sentenceTotalDays: p.sentenceTotalDays,
      message: reason || (p.earlyRelease ? 'Chúc mừng! Bạn được giảm án và mãn hạn sớm.' : 'Án đã hết. Bạn được trả tự do.'),
    });
  }
  emitSelf(socket, p);
  broadcastState();
  setTimeout(() => {
    online.delete(socket.id);
    broadcastState();
  }, 2500);
  return true;
}

function tickSentenceDay(p, socket) {
  if (p.escaped || p.released) return;
  p.daysServed = (p.daysServed || 0) + 1;
  p.sentenceLeftDays = Math.max(0, (p.sentenceLeftDays || 0) - 1);
  p.daysSinceReview = (p.daysSinceReview || 0) + 1;

  // schedule presence bonus already tracked separately
  if (p.daysSinceReview >= REVIEW_EVERY_DAYS) {
    p.daysSinceReview = 0;
    const rating = ratingFromPoints(p.rehabPoints || 0);
    p.rehabRating = rating.id;
    const cut = reductionForRating(rating.id);
    if (cut > 0 && p.sentenceLeftDays > 0) {
      p.sentenceLeftDays = Math.max(0, p.sentenceLeftDays - cut);
      if (socket) {
        socket.emit('sentenceReview', {
          rating: rating.label,
          cut,
          left: Math.ceil(p.sentenceLeftDays),
          message: `📜 Hội đồng cải tạo: xếp loại ${rating.label} → giảm ${cut} ngày án. Còn ${Math.ceil(p.sentenceLeftDays)} ngày.`,
        });
      }
      pushChat({ type: 'system', text: `📜 ${p.nickname} được giảm ${cut} ngày (xếp loại ${rating.label}).`, ts: Date.now() });
    } else if (socket) {
      socket.emit('sentenceReview', {
        rating: rating.label,
        cut: 0,
        left: Math.ceil(p.sentenceLeftDays),
        message: `📜 Hội đồng cải tạo: xếp loại ${rating.label}. Chưa đủ điều kiện giảm án.`,
      });
    }
  }
  unlockAchievements(p, socket);
  if (p.sentenceLeftDays <= 0) tryRelease(p, socket);
}

setInterval(() => {
  for (const p of online.values()) {
    if (p.escaped || p.released) continue;
    const bedBonus = (p.upgrades.giuong || 0) * 0.5;
    const sleepBonus = p.sleeping ? 3 : 0;
    p.energy = Math.min(p.maxEnergy, p.energy + 2 + bedBonus + sleepBonus);
    p.health = Math.min(p.maxHealth, p.health + 0.5 + (p.upgrades.giuong || 0) * 0.2 + (p.sleeping ? 1 : 0));
    if (p.emote && Date.now() > p.emoteUntil) p.emote = null;
    p.lastActive = Date.now();
  }
  broadcastState();
}, 5000);

setInterval(() => {
  for (const [sid, p] of online) {
    if (p.escaped || p.released) continue;
    if (Date.now() - (p.lastDayTick || 0) < DAY_TICK_MS) continue;
    p.lastDayTick = Date.now();
    const sock = [...io.sockets.sockets.values()].find((s) => s.id === sid);
    tickSentenceDay(p, sock);
    if (sock) emitSelf(sock, p);
  }
  broadcastState();
}, 4000);

setInterval(() => {
  if (Date.now() < scheduleEndsAt) return;
  scheduleIndex = (scheduleIndex + 1) % SCHEDULE.length;
  const phase = SCHEDULE[scheduleIndex];
  scheduleEndsAt = Date.now() + phase.seconds * 1000;
  scheduleAttended.set(`${scheduleIndex}-${scheduleEndsAt}`, new Set());
  scheduleWarned.set(`${scheduleIndex}-${scheduleEndsAt}`, new Set());
  schedulePenalized.set(`${scheduleIndex}-${scheduleEndsAt}`, new Set());
  pushChat({ type: 'system', text: phase.announce, ts: Date.now() });
  if (phase.id !== 'tat_den') {
    for (const p of online.values()) if (p.sleeping) p.sleeping = false;
  }
  broadcastState();
  io.emit('schedule', currentSchedule());
}, 2000);

// Mandatory schedule: credit attendance, warn after grace, then penalize absentees
setInterval(() => {
  const phase = SCHEDULE[scheduleIndex];
  const key = `${scheduleIndex}-${scheduleEndsAt}`;
  if (!scheduleAttended.has(key)) scheduleAttended.set(key, new Set());
  if (!scheduleWarned.has(key)) scheduleWarned.set(key, new Set());
  if (!schedulePenalized.has(key)) schedulePenalized.set(key, new Set());
  const set = scheduleAttended.get(key);
  const warned = scheduleWarned.get(key);
  const penalized = schedulePenalized.get(key);
  const elapsed = Math.max(0, (phase.seconds * 1000) - Math.max(0, scheduleEndsAt - Date.now()));
  const graceMs = (phase.graceSec || 12) * 1000;
  for (const [sid, p] of online) {
    if (p.escaped || p.released) continue;
    if (p.role === 'guard') continue;
    const ok = v6.inRequiredPlace(phase, p);
    const sock = io.sockets.sockets.get(sid);
    if (ok && !set.has(sid)) {
      set.add(sid);
      p.scheduleAttend = (p.scheduleAttend || 0) + 1;
      p.rehabPoints = (p.rehabPoints || 0) + 2;
      const d = v6.ensureDaily(p);
      d.daySched = (d.daySched || 0) + 1;
      grantRankXp(p, 6, sock);
      unlockAchievements(p, sock);
      if (sock) {
        sock.emit('actionResult', { kind: 'schedule', message: `✅ Có mặt đúng lịch (${phase.name}) +2 điểm cải tạo` });
        emitSelf(sock, p);
      }
    }
    if (!ok && elapsed >= graceMs && !warned.has(sid)) {
      warned.add(sid);
      const where = phase.id === 'tat_den' ? `phòng ${p.cellNo || p.cellId}` : (ROOM_BY_ID[phase.roomHint]?.name || phase.roomHint);
      if (sock) sock.emit('errorMsg', `⚠️ Quản giáo nhắc: mau tới ${where}! Sắp trừ điểm.`);
      pushChat({ type: 'system', text: `⚠️ Quản giáo gọi tên ${p.nickname} — vắng ${phase.name}.`, ts: Date.now() });
    }
    if (!ok && elapsed >= graceMs + 8000 && !penalized.has(sid) && !set.has(sid)) {
      penalized.add(sid);
      p.rehabPoints = Math.max(0, (p.rehabPoints || 0) - 8);
      p.rankXp = Math.max(0, (p.rankXp || 0) - 5);
      p.rankId = rankFromXp(p.rankXp).id;
      if (sock) {
        sock.emit('actionResult', {
          kind: 'schedule_penalty',
          message: `❌ Vắng ${phase.name}: −8 điểm cải tạo, −5 XP hạng. Quản giáo ghi sổ!`,
        });
        emitSelf(sock, p);
      }
      pushChat({ type: 'system', text: `📝 ${p.nickname} bị trừ điểm vì vắng ${phase.name}.`, ts: Date.now() });
    }
  }
}, 3000);

function emptyCaro() {
  return Array.from({ length: 15 }, () => Array(15).fill(0));
}

function checkCaroWin(board, x, y, stone) {
  const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (const [dx, dy] of dirs) {
    let count = 1;
    for (let s = 1; s < 5; s++) {
      const nx = x + dx * s, ny = y + dy * s;
      if (nx < 0 || ny < 0 || nx > 14 || ny > 14 || board[ny][nx] !== stone) break;
      count++;
    }
    for (let s = 1; s < 5; s++) {
      const nx = x - dx * s, ny = y - dy * s;
      if (nx < 0 || ny < 0 || nx > 14 || ny > 14 || board[ny][nx] !== stone) break;
      count++;
    }
    if (count >= 5) return true;
  }
  return false;
}

function caroNpcMove(board) {
  const empties = [];
  for (let y = 0; y < 15; y++) for (let x = 0; x < 15; x++) if (!board[y][x]) empties.push([x, y]);
  if (!empties.length) return null;
  for (const [x, y] of empties) {
    board[y][x] = 2; const w = checkCaroWin(board, x, y, 2); board[y][x] = 0; if (w) return [x, y];
  }
  for (const [x, y] of empties) {
    board[y][x] = 1; const w = checkCaroWin(board, x, y, 1); board[y][x] = 0; if (w) return [x, y];
  }
  empties.sort((a, b) => (Math.abs(a[0] - 7) + Math.abs(a[1] - 7)) - (Math.abs(b[0] - 7) + Math.abs(b[1] - 7)));
  return empties[Math.floor(Math.random() * Math.min(8, empties.length))];
}

function awardWin(p, kind, socket) {
  if (kind === 'caro') p.winsCaro = (p.winsCaro || 0) + 1;
  if (kind === 'rps') p.winsRps = (p.winsRps || 0) + 1;
  if (kind === 'quiz') p.winsQuiz = (p.winsQuiz || 0) + 1;
  if (kind === 'ball') p.winsBall = (p.winsBall || 0) + 1;
  if (kind === 'oanquan') p.winsOanQuan = (p.winsOanQuan || 0) + 1;
  if (kind === 'tienlen') p.winsTienLen = (p.winsTienLen || 0) + 1;
  p.gameWins = (p.gameWins || 0) + 1;
  p.reputation += 3;
  p.money += 10;
  p.totalEarned += 10;
  p.rehabPoints = (p.rehabPoints || 0) + 3;
  const d = v6.ensureDaily(p);
  d.dayWins = (d.dayWins || 0) + 1;
  grantRankXp(p, 15, socket);
  unlockAchievements(p, socket);
}

function publicMatch(m) {
  const quizQ = (m.game === 'quiz' && m.quiz) ? (() => {
    const q = v6.QUIZ_BANK[m.quiz.idx % v6.QUIZ_BANK.length];
    return { q: q.q, a: q.a, asked: m.quiz.asked };
  })() : null;
  return {
    id: m.id, game: m.game, vsNpc: m.vsNpc, status: m.status,
    players: m.players.map((pid) => {
      const pl = online.get(pid);
      return { id: pid, nick: pl ? pl.nickname : '?' };
    }),
    youAre: null, board: m.board || null, turn: m.turn, turnEndsAt: m.turnEndsAt,
    scores: m.scores || null, lastRound: m.lastRound || null, winnerId: m.winnerId || null, message: m.message || '',
    quiz: quizQ, ballShots: m.ballShots || 0, hand: m.hand || null, hands: m.hands || null,
  };
}

function emitMatch(m) {
  for (const pid of m.players) {
    const sock = [...io.sockets.sockets.values()].find((s) => s.id === pid);
    if (!sock) continue;
    const view = publicMatch(m);
    view.youAre = m.players[0] === pid ? 1 : 2;
    if (m.game === 'rps' && m.choices) {
      view.myChoice = m.choices[pid] || null;
      view.waitingOpp = !!(m.choices[pid] && Object.keys(m.choices).length < (m.vsNpc ? 1 : 2));
    }
    sock.emit('match', view);
  }
}

io.on('connection', (socket) => {
  socket.emit('config', {
    jobs: JOBS, shop: SHOP, rooms: ROOMS, appearance: APPEARANCE, roomGraph: ROOM_GRAPH,
    crimes: CRIMES, sentences: SENTENCE_OPTIONS, achievements: ACHIEVEMENTS, ranks: RANKS,
    guardRanks: v6.GUARD_RANKS, dailyQuests: v6.DAILY_QUESTS, rankQuests: v6.RANK_QUESTS, guardQuests: v6.GUARD_QUESTS,
    cellCapacity: v6.CELL_CAPACITY, cellCount: CELL_COUNT, zones: v6.ZONES,
    intakeNeedMs: v6.INTAKE_NEED_MS,
    schedule: currentSchedule(), dayTickMs: DAY_TICK_MS, reviewEveryDays: REVIEW_EVERY_DAYS,
    maxPlayers: MAX_PLAYERS, npcCount: NPC_COUNT, version: VERSION,
  });
  socket.emit('chatHistory', chatHistory);
  socket.emit('schedule', currentSchedule());
  socket.emit('letters', letters.slice(-20).reverse());

  socket.on('join', (payload) => {
    payload = payload || {};
    let nickname = String(payload.nickname || '').trim().slice(0, 16).replace(/[<>]/g, '');
    if (!nickname || nickname.length < 2) {
      socket.emit('errorMsg', 'Biệt danh phải từ 2–16 ký tự.');
      return;
    }
    const alreadyOnline = [...online.values()].some(
      (p) => p.nickname.toLowerCase() === nickname.toLowerCase() && p.id !== socket.id
    );
    const registered = Object.keys(playersByNick).length;
    const isReturning = !!playersByNick[nickname.toLowerCase()];
    if (online.size >= MAX_PLAYERS && !alreadyOnline) {
      socket.emit('errorMsg', `Trại đã đầy (${MAX_PLAYERS.toLocaleString('vi-VN')} chỗ online). Thử lại sau nhé!`);
      return;
    }
    if (!isReturning && registered >= MAX_PLAYERS) {
      socket.emit('errorMsg', `Đã đủ ${MAX_PLAYERS.toLocaleString('vi-VN')} tù nhân đăng ký. Trại tạm ngưng nhận án mới — quay lại sau bạn nhé!`);
      return;
    }
    const fullName = String(payload.fullName || nickname).trim().slice(0, 40).replace(/[<>]/g, '');
    if (!fullName || fullName.length < 2) {
      socket.emit('errorMsg', 'Họ tên phải từ 2 ký tự.');
      return;
    }
    const taken = [...online.values()].some(
      (p) => p.nickname.toLowerCase() === nickname.toLowerCase() && p.id !== socket.id
    );
    if (taken) {
      socket.emit('errorMsg', 'Biệt danh đang online. Chọn tên khác.');
      return;
    }

    const key = nickname.toLowerCase();
    let p;
    const incoming = { ...payload, nickname, fullName };
    if (playersByNick[key] && !playersByNick[key].escaped && !playersByNick[key].released) {
      const saved = playersByNick[key];
      p = {
        ...defaultPlayer(incoming, socket.id),
        ...saved,
        id: socket.id,
        nickname,
        fullName: payload.fullName ? fullName : (saved.fullName || fullName),
        cooldowns: {},
        escaped: false,
        released: false,
        emote: null,
        sleeping: false,
      };
      if (payload.appearance) p.appearance = normalizeAppearance(payload.appearance);
      else p.appearance = normalizeAppearance(p.appearance);
      if (!p.prisonerNo) p.prisonerNo = prisonerNumber();
      if (!p.crimeLabel) p.crimeLabel = incoming.crimeId === 'custom' ? (payload.crimeCustom || saved.crimeLabel) : (CRIMES.find((c) => c.id === (payload.crimeId || saved.crimeId)) || CRIMES[0]).label;
      if (p.sentenceLeftDays == null) p.sentenceLeftDays = p.sentenceTotalDays || 90;
      p.maxHealth = 100 + (p.upgrades.giuong || 0) * 10;
      p.health = Math.min(p.health, p.maxHealth);
      if (p.x == null) { p.x = ROOM_BY_ID[p.room]?.x || 0; p.z = ROOM_BY_ID[p.room]?.z || 0; }
    } else if (playersByNick[key] && (playersByNick[key].escaped || playersByNick[key].released)) {
      p = defaultPlayer(incoming, socket.id);
      p.reputation = Math.max(0, (playersByNick[key].reputation || 0) - 5);
      p.gameWins = playersByNick[key].gameWins || 0;
      p.winsCaro = playersByNick[key].winsCaro || 0;
      p.winsRps = playersByNick[key].winsRps || 0;
      p.rankXp = playersByNick[key].rankXp || 0;
      p.rankId = rankFromXp(p.rankXp).id;
    } else {
      p = defaultPlayer(incoming, socket.id);
    }
    p.rankXp = p.rankXp || 0;
    p.rankId = rankFromXp(p.rankXp).id;
    p.role = p.role || 'prisoner';
    // Restore guard career if previously promoted
    if (playersByNick[key] && playersByNick[key].role === 'guard') {
      p.role = 'guard';
      p.guardXp = playersByNick[key].guardXp || 0;
      p.guardRankId = v6.guardRankFromXp(p.guardXp).id;
      p.appearance = { ...(p.appearance || {}), stripe: 'police' };
      p.released = true;
    }
    rescaleCells();
    if (p.role !== 'guard') {
      if (!p.cellId || !ROOM_BY_ID[p.cellId]) {
        const cell = v6.pickCell(online, ROOMS);
        p.cellId = cell.id;
        p.cellNo = cell.cellNo;
      } else {
        p.cellNo = (ROOM_BY_ID[p.cellId] && ROOM_BY_ID[p.cellId].cellNo) || p.cellNo;
      }
      if (!ROOM_BY_ID[p.room]) {
        p.room = p.cellId;
        p.x = ROOM_BY_ID[p.cellId].x;
        p.z = ROOM_BY_ID[p.cellId].z;
      }
    } else {
      p.room = p.room && ROOM_BY_ID[p.room] ? p.room : 'san_tap';
    }
    v6.ensureDaily(p);
    if (!p.rankQuestClaimed) p.rankQuestClaimed = {};
    if (!p.guardQuestClaimed) p.guardQuestClaimed = {};
    if (p.role === 'guard') {
      p.intakeDone = true; p.zone = 'general';
    } else {
      if (p.intakeDone == null && ((p.daysServed || 0) > 0 || (p.workCount || 0) > 0 || (p.rankXp || 0) > 0 || (p.rehabPoints || 0) > 5)) {
        p.intakeDone = true;
        p.zone = 'general';
      }
      v6.ensureIntake(p);
      if (!p.intakeDone) {
        p.room = 'khu_tam_giam';
        p.zone = 'quarantine';
        const qr = ROOM_BY_ID.khu_tam_giam;
        if (qr) { p.x = qr.x + (Math.random() - 0.5) * 4; p.z = qr.z + (Math.random() - 0.5) * 4; }
      } else if (p.zone === 'quarantine') {
        p.zone = 'general';
      }
      p.happinessUnlocked = v6.happinessUnlocked(p);
    }

    // unlock good_behavior baseline check later; grant clean if no fails
    unlockAchievements(p, socket);

    online.set(socket.id, p);
    playersByNick[key] = stripTransient(p);
    saveData();
    emitSelf(socket, p);
    socket.emit('joined', { nickname: p.nickname, appearance: p.appearance, prisonerNo: p.prisonerNo });
    pushChat({ type: 'system', text: `${p.nickname} (${p.prisonerNo}) đã vào trại — án ${p.sentenceLeftDays} ngày.`, ts: Date.now() });
    broadcastState();
  });

  function doRoomMove(roomId) {
    const p = online.get(socket.id);
    if (!p) return;
    if (p.role !== 'guard' && (p.escaped || p.released)) return;
    if (!ROOM_BY_ID[roomId]) return;
    if (p.sleeping) p.sleeping = false;
    if (p.role !== 'guard' && !p.intakeDone && roomId !== 'khu_tam_giam') {
      socket.emit('errorMsg', '🚧 Bạn đang ở Khu tạm giam. Nói chuyện đủ 5 phút với cán bộ/người chơi để được chuyển khu.');
      return;
    }
    if (roomId === 'phong_hanh_phuc' && p.role !== 'guard' && !v6.happinessUnlocked(p)) {
      socket.emit('errorMsg', '🏠 Phòng hạnh phúc chỉ mở khi hoàn thành 100% nhiệm vụ.');
      return;
    }
    if (p.energy < 2) { socket.emit('errorMsg', 'Không đủ năng lượng để di chuyển!'); return; }
    p.energy -= 2;
    p.room = roomId;
    const r = ROOM_BY_ID[roomId];
    p.x = r.x + (Math.random() - 0.5) * 2;
    p.z = r.z + (Math.random() - 0.5) * 2;
    if (roomId === 'phong_hanh_phuc' && v6.happinessUnlocked(p)) {
      p.health = Math.min(p.maxHealth, p.health + 20);
      p.energy = Math.min(p.maxEnergy, p.energy + 25);
      p.rehabPoints = (p.rehabPoints || 0) + 5;
      socket.emit('actionResult', { kind: 'happiness', message: '🏠 Gia đình gặp mặt ấm áp! +HP +năng lượng +điểm cải tạo.' });
    }
    emitSelf(socket, p);
    broadcastState();
  }
  socket.on('moveTo', doRoomMove);
  socket.on('move', doRoomMove);

  socket.on('pos', (payload) => {
    const p = online.get(socket.id);
    if (!p) return;
    if (p.role !== 'guard' && (p.escaped || p.released)) return;
    if (!payload || typeof payload.x !== 'number' || typeof payload.z !== 'number') return;
    let x = payload.x, z = payload.z;
    const clamped = v6.clampPosForZone(p, x, z);
    x = clamped.x; z = clamped.z;
    // soft speed clamp vs last
    const dx = x - (p.x || 0);
    const dz = z - (p.z || 0);
    if (dx * dx + dz * dz > 55) return; // ignore teleport jumps
    p.x = x;
    p.z = z;
    if (typeof payload.rotY === 'number') p.rotY = payload.rotY;
    if (p.sleeping) p.sleeping = false;
    if (!p.intakeDone && p.role !== 'guard') {
      p.room = 'khu_tam_giam';
    } else {
      const nr = nearestRoom(x, z);
      if (nr === 'phong_hanh_phuc' && !v6.happinessUnlocked(p) && p.role !== 'guard') {
        /* stay previous */
      } else if (nr !== p.room) p.room = nr;
    }
    // lightweight broadcast throttle via next regen — also emit sparse
  });

  socket.on('action', (kind) => {
    const p = online.get(socket.id);
    if (!p || p.escaped || p.released) return;
    const now = Date.now();
    if (kind === 'sit') {
      if (p.room !== 'nha_bep' && p.room !== 'san_tap') { socket.emit('errorMsg', 'Phải ở Căn tin / Nhà ăn mới ngồi được.'); return; }
      setEmote(p, 'sit', 12000);
      socket.emit('actionResult', { kind, message: 'Bạn ngồi ghế gần nhất trong Nhà ăn.' });
    } else if (kind === 'pushup') {
      if (p.energy < 5) { socket.emit('errorMsg', 'Không đủ năng lượng để hít đất.'); return; }
      p.energy -= 5;
      setEmote(p, 'pushup', 8000);
      socket.emit('actionResult', { kind, message: 'Hít đất! (chỉ tập luyện)' });
    } else if (kind === 'wave') {
      setEmote(p, 'wave', 5000);
      pushChat({ type: 'system', text: `${p.nickname} vẫy tay chào mọi người.`, ts: now });
      socket.emit('actionResult', { kind, message: 'Bạn vẫy tay chào.' });
    } else if (kind === 'mark_day') {
      if (!String(p.room).startsWith('phong')) { socket.emit('errorMsg', 'Chỉ đánh dấu ngày khi ở phòng giam.'); return; }
      if ((p.cooldowns.mark_day || 0) > now) { socket.emit('errorMsg', 'Hôm nay bạn đã gạch rồi…'); return; }
      p.daysMarked = (p.daysMarked || 0) + 1;
      p.cooldowns.mark_day = now + 60000;
      p.rehabPoints = (p.rehabPoints || 0) + 1;
      setEmote(p, 'mark', 4000);
      unlockAchievements(p, socket);
      socket.emit('actionResult', { kind, message: `Gạch thêm 1 ngày. Tổng: ${p.daysMarked}.` });
    } else if (kind === 'sleep') {
      if (!p.intakeDone) { socket.emit('errorMsg', 'Hoàn thành tiếp nhận trước khi về phòng giam.'); return; }
      const cell = ROOM_BY_ID[p.cellId] || ROOM_BY_ID[p.room] || v6.pickCell(online, ROOMS);
      p.cellId = cell.id; p.cellNo = cell.cellNo;
      p.room = cell.id;
      p.x = cell.x; p.z = cell.z;
      setEmote(p, 'sleep', 60000);
      socket.emit('actionResult', { kind, message: `Về phòng giam số ${cell.cellNo} nghỉ… Zzz` });
    } else if (kind === 'wake') {
      p.sleeping = false; p.emote = null;
      socket.emit('actionResult', { kind, message: 'Bạn thức dậy.' });
    } else return;
    emitSelf(socket, p);
    broadcastState();
  });

  socket.on('writeLetter', (text) => {
    const p = online.get(socket.id);
    if (!p || p.escaped || p.released) return;
    const msg = String(text || '').trim().slice(0, 160).replace(/[<>]/g, '');
    if (msg.length < 2) { socket.emit('errorMsg', 'Thư quá ngắn.'); return; }
    letters.push({ id: uid(), nick: p.nickname, text: msg, ts: Date.now() });
    if (letters.length > MAX_LETTERS) letters.shift();
    p.lettersSent = (p.lettersSent || 0) + 1;
    { const dL = v6.ensureDaily(p); dL.dayLetters = (dL.dayLetters || 0) + 1; }
    p.rehabPoints = (p.rehabPoints || 0) + 2;
    grantRankXp(p, 5, socket);
    setEmote(p, 'write', 5000);
    unlockAchievements(p, socket);
    pushChat({ type: 'system', text: `✉️ ${p.nickname} gửi thư — ghim Bảng Thư.`, ts: Date.now() });
    io.emit('letters', letters.slice(-20).reverse());
    socket.emit('actionResult', { kind: 'letter', message: 'Thư đã ghim lên Bảng Thư.' });
    emitSelf(socket, p);
    broadcastState();
    saveData();
  });

  socket.on('work', (jobId) => {
    const p = online.get(socket.id);
    if (!p || p.escaped || p.released) return;
    if (!p.intakeDone && p.role !== 'guard') {
      socket.emit('errorMsg', 'Hoàn thành nhiệm vụ tiếp nhận ở Khu tạm giam trước đã.');
      return;
    }
    const job = JOBS[jobId];
    if (!job) return;
    if (job.room && p.room !== job.room && !(jobId === 'lao_dong' && ['xuong','vuon_rau','xuong_may','xuong_moc'].includes(p.room))) {
      socket.emit('errorMsg', `Phải ở ${ROOM_BY_ID[job.room]?.name || job.room} để làm ${job.name}.`);
      return;
    }
    const now = Date.now();
    if (p.cooldowns[jobId] && p.cooldowns[jobId] > now) { socket.emit('errorMsg', `Chưa hết chờ ${job.name}.`); return; }
    if (p.energy < job.energyCost) { socket.emit('errorMsg', 'Không đủ năng lượng!'); return; }
    p.sleeping = false;
    setEmote(p, job.anim || 'work', 5000);
    const toolBonus = 1 + (p.upgrades.cong_cu || 0) * 0.15;
    const rankBonus = 1 + (rankFromXp(p.rankXp || 0).payBonus || 0);
    const pay = Math.floor(job.basePay * toolBonus * rankBonus * (0.9 + Math.random() * 0.2));
    p.energy -= job.energyCost;
    p.money += pay;
    p.totalEarned += pay;
    p.reputation += 1;
    p.workCount = (p.workCount || 0) + 1;
    p.rehabPoints = (p.rehabPoints || 0) + 2;
    { const dW = v6.ensureDaily(p); dW.dayWork = (dW.dayWork || 0) + 1; }
    grantRankXp(p, 8, socket);
    p.health = Math.max(10, p.health - Math.floor(job.energyCost / 4));
    p.cooldowns[jobId] = now + job.cooldownMs;
    unlockAchievements(p, socket);
    emitSelf(socket, p);
    socket.emit('workResult', { jobId, pay, jobName: job.name });
    broadcastState();
  });

  socket.on('buy', (itemId) => {
    const p = online.get(socket.id);
    if (!p || p.escaped || p.released) return;
    const item = SHOP[itemId];
    if (!item) return;
    const shopDisc = rankFromXp(p.rankXp || 0).shopDiscount || 0;
    if (itemId === 'do_an') {
      const foodPrice = Math.max(1, Math.floor(item.price * (1 - shopDisc)));
      if (p.money < foodPrice) { socket.emit('errorMsg', 'Không đủ tiền!'); return; }
      p.money -= foodPrice;
      p.health = Math.min(p.maxHealth, p.health + 15);
      p.energy = Math.min(p.maxEnergy, p.energy + 20);
      emitSelf(socket, p);
      socket.emit('buyResult', { itemId, message: 'Đã ăn suất đặc biệt.' });
      broadcastState();
      return;
    }
    const level = p.upgrades[itemId] || 0;
    if (level >= item.maxLevel) { socket.emit('errorMsg', 'Đã tối đa!'); return; }
    const price = Math.max(1, Math.floor(item.price * (level + 1) * (1 - shopDisc)));
    if (p.money < price) { socket.emit('errorMsg', 'Không đủ tiền!'); return; }
    p.money -= price;
    p.upgrades[itemId] = level + 1;
    if (itemId === 'giuong') {
      p.maxHealth = 100 + p.upgrades.giuong * 10;
      p.health = Math.min(p.maxHealth, p.health + 10);
    }
    emitSelf(socket, p);
    socket.emit('buyResult', { itemId, message: `Đã mua ${item.name} (cấp ${p.upgrades[itemId]}).` });
    broadcastState();
  });

  socket.on('bribeGuard', (guardId) => {
    const p = online.get(socket.id);
    if (!p || p.escaped || p.released) return;
    const now = Date.now();
    if ((p.cooldowns.bribe || 0) > now) {
      socket.emit('errorMsg', 'Cán bộ còn nghi ngờ — đợi chút rồi hối lộ tiếp.');
      return;
    }
    const g = guards.find((x) => x.id === guardId) || guards.find((x) => {
      const d = Math.hypot(x.x - p.x, x.z - p.z);
      return d < 14;
    }) || guards[2];
    if (!g) { socket.emit('errorMsg', 'Không thấy cán bộ gần đây.'); return; }
    const price = bribePrice(p);
    if (p.money < price) {
      socket.emit('errorMsg', `Cần ${price}₫ để hối lộ ${g.name}. Bạn chỉ có ${p.money}₫.`);
      return;
    }
    p.money -= price;
    p.bribeGuardId = g.id;
    p.bribeUntil = now + 28000;
    g.lookingAwayUntil = now + 28000;
    g.chasingId = null;
    g.alertUntil = 0;
    p.cooldowns.bribe = now + 20000;
    p.reputation = Math.max(0, (p.reputation || 0) - 2);
    emitSelf(socket, p);
    socket.emit('bribeResult', {
      ok: true, guardId: g.id, guardName: g.name, price, until: p.bribeUntil,
      message: `💸 Đã hối lộ ${g.name} (${price}₫). Họ “quay đi” ~28 giây — mau vượt!`,
    });
    pushChat({ type: 'system', text: `👀 ${p.nickname} thì thầm với ${g.name}…`, ts: now });
    broadcastState();
    io.emit('guards', publicGuards());
    saveData();
  });

  socket.on('escape', () => {
    const p = online.get(socket.id);
    if (!p || p.escaped || p.released) return;
    if (p.room !== 'tuong_rao') { socket.emit('errorMsg', 'Phải đến Sân chơi / Tường rào mới vượt ngục!'); return; }
    if (p.energy < 30) { socket.emit('errorMsg', 'Cần ≥30 năng lượng.'); return; }
    if (p.health < 20) { socket.emit('errorMsg', 'Sức khỏe quá yếu.'); return; }
    const bribed = activeBribe(p);
    if (!bribed) {
      socket.emit('errorMsg', 'Cán bộ đang canh tường rào! Hối lộ trước (Thêm → Hối lộ) — không hối lộ thì gần như không thể vượt.');
      return;
    }
    const toolLvl = p.upgrades.dung_cu_vuot || 0;
    let chance = 22 + toolLvl * 14 + Math.min(18, Math.floor(p.reputation / 20)) + Math.floor(p.health / 18) - p.escapeFails * 2;
    chance = Math.max(18, Math.min(82, chance));
    p.energy -= 30;
    const roll = Math.random() * 100;
    if (roll < chance) {
      p.reputation += 50;
      p.money += 100;
      p.bribeGuardId = null; p.bribeUntil = 0;
      delete p.achievementsUnlocked.good_behavior;
      promoteToGuard(p, socket);
      playersByNick[p.nickname.toLowerCase()] = stripTransient(p);
      saveData();
    } else {
      failEscapeCatch(p, socket, bribed ? 'Cán bộ đổi ý kịp lúc — điểm bị xóa, án tính lại!' : 'Bị bắt khi leo tường — mất hết điểm, ở tù lại từ đầu!');
    }
  });

  socket.on('chat', (text) => {
    const p = online.get(socket.id);
    if (!p) return;
    const msg = String(text || '').trim().slice(0, 200).replace(/[<>]/g, '');
    if (!msg) return;
    pushChat({ type: 'user', nick: p.nickname, text: msg, ts: Date.now() });
    if (!p.intakeDone && p.role !== 'guard') {
      const done = v6.creditIntake(p, v6.CHAT_CREDIT_MS, socket, pushChat);
      emitSelf(socket, p);
      if (done) {
        const cell = ROOM_BY_ID[p.cellId];
        if (cell) { p.x = cell.x; p.z = cell.z; p.room = cell.id; }
        saveData();
        broadcastState();
      }
    }
  });

  socket.on('talk', () => {
    const p = online.get(socket.id);
    if (!p || p.escaped || (p.released && p.role !== 'guard')) return;
    const now = Date.now();
    if ((p.lastTalkAt || 0) + 1000 > now) return; // ~1s / tick → 5 phút wall-clock nếu chỉ bấm Nói chuyện
    p.lastTalkAt = now;
    if (!p.intakeDone && p.role !== 'guard') {
      // Must be in quarantine near cán bộ (room khu_tam_giam)
      if (p.room !== 'khu_tam_giam') {
        socket.emit('errorMsg', 'Hãy ở Khu tạm giam và nói chuyện với cán bộ tiếp nhận.');
        return;
      }
      setEmote(p, 'wave', 2000);
      const done = v6.creditIntake(p, v6.TALK_TICK_MS, socket, pushChat); // +1s mỗi lần nói
      const left = Math.max(0, v6.INTAKE_NEED_MS - (p.intakeChatMs || 0));
      socket.emit('actionResult', {
        kind: 'talk',
        message: done
          ? 'Hoàn thành tiếp nhận!'
          : `Nói chuyện với cán bộ… còn ~${Math.ceil(left / 1000)}s (${Math.floor(((p.intakeChatMs || 0) / v6.INTAKE_NEED_MS) * 100)}%)`,
      });
      if (done) {
        const cell = ROOM_BY_ID[p.cellId];
        if (cell) { p.x = cell.x; p.z = cell.z; p.room = cell.id; }
        saveData();
      }
      emitSelf(socket, p);
      broadcastState();
    } else {
      setEmote(p, 'wave', 2000);
      socket.emit('actionResult', { kind: 'talk', message: 'Bạn trò chuyện với mọi người xung quanh.' });
      emitSelf(socket, p);
      broadcastState();
    }
  });

  socket.on('startGame', (payload) => {
    const p = online.get(socket.id);
    if (!p) return;
    if (p.role !== 'guard' && (p.escaped || p.released)) return;
    const game = payload && payload.game;
    const vs = payload && payload.vs;
    if (!['caro', 'rps', 'quiz', 'ball', 'oanquan', 'tienlen'].includes(game)) return;
    if (vs === 'npc') {
      const msgs = {
        caro: 'Cờ Caro vs Quản giáo. Bạn đi trước (X).',
        rps: 'Kéo Búa Bao BO3 vs Quản giáo.',
        quiz: 'Đố vui vs Quản giáo — trả lời đúng để thắng.',
        ball: 'Ném bóng rổ vs Quản giáo — ghi nhiều điểm hơn.',
        oanquan: 'Ô ăn quan lite vs Quản giáo.',
        tienlen: 'Tiến lên lite — đánh bài cao hơn NPC.',
      };
      const m = {
        id: uid(), game, vsNpc: true, status: 'playing', players: [socket.id],
        board: game === 'caro' ? emptyCaro() : (game === 'oanquan' ? { pits: [5,5,5,5,5,0,5,5,5,5,5,0], turn: 1 } : null),
        turn: 1, turnEndsAt: Date.now() + 45000,
        scores: (game === 'rps' || game === 'ball') ? { 1: 0, 2: 0 } : (game === 'quiz' ? { 1: 0, 2: 0, q: 0 } : null),
        choices: game === 'rps' ? {} : null,
        quiz: game === 'quiz' ? { idx: Math.floor(Math.random() * v6.QUIZ_BANK.length), asked: 0 } : null,
        ballShots: game === 'ball' ? 0 : null,
        hand: game === 'tienlen' ? Math.floor(Math.random() * 13) + 2 : null,
        npcHand: game === 'tienlen' ? Math.floor(Math.random() * 13) + 2 : null,
        round: 1, winnerId: null,
        message: msgs[game] || 'Mini-game bắt đầu.',
      };
      matches.set(m.id, m);
      emitMatch(m);
      return;
    }
    if (vs === 'invite') {
      const target = online.get(payload.targetId);
      if (!target || payload.targetId === socket.id) { socket.emit('errorMsg', 'Không tìm thấy người chơi.'); return; }
      const inv = { id: uid(), from: socket.id, to: payload.targetId, game, ts: Date.now() };
      invites.set(inv.id, inv);
      const tSock = [...io.sockets.sockets.values()].find((s) => s.id === payload.targetId);
      if (tSock) tSock.emit('gameInvite', { id: inv.id, game, fromId: socket.id, fromNick: p.nickname });
      socket.emit('actionResult', { kind: 'invite', message: `Đã mời ${target.nickname}.` });
    }
  });

  socket.on('respondInvite', (payload) => {
    const inv = invites.get(payload && payload.id);
    if (!inv || inv.to !== socket.id) return;
    invites.delete(inv.id);
    if (!payload.accept) {
      const fromSock = [...io.sockets.sockets.values()].find((s) => s.id === inv.from);
      if (fromSock) fromSock.emit('actionResult', { kind: 'invite', message: 'Lời mời bị từ chối.' });
      return;
    }
    if (!online.has(inv.from) || !online.has(inv.to)) return;
    const g = inv.game;
    const m = {
      id: uid(), game: g, vsNpc: false, status: 'playing', players: [inv.from, inv.to],
      board: g === 'caro' ? emptyCaro() : (g === 'oanquan' ? { pits: [5,5,5,5,5,0,5,5,5,5,5,0], turn: 1 } : null),
      turn: 1, turnEndsAt: Date.now() + 45000,
      scores: (g === 'rps' || g === 'ball' || g === 'quiz') ? { 1: 0, 2: 0 } : null,
      choices: g === 'rps' ? {} : null,
      quiz: g === 'quiz' ? { idx: Math.floor(Math.random() * v6.QUIZ_BANK.length), asked: 0 } : null,
      ballShots: g === 'ball' ? 0 : null,
      hand: g === 'tienlen' ? Math.floor(Math.random() * 13) + 2 : null,
      npcHand: null,
      hands: g === 'tienlen' ? { [inv.from]: Math.floor(Math.random()*13)+2, [inv.to]: Math.floor(Math.random()*13)+2 } : null,
      round: 1, winnerId: null, message: 'Trận đấu bắt đầu!',
    };
    matches.set(m.id, m);
    emitMatch(m);
  });

  socket.on('caroMove', (payload) => {
    const p = online.get(socket.id);
    if (!p) return;
    const m = matches.get(payload && payload.matchId);
    if (!m || m.game !== 'caro' || m.status !== 'playing') return;
    if (!m.players.includes(socket.id)) return;
    const seat = m.players[0] === socket.id ? 1 : 2;
    if (m.turn !== seat) { socket.emit('errorMsg', 'Chưa tới lượt.'); return; }
    const x = payload.x | 0, y = payload.y | 0;
    if (x < 0 || y < 0 || x > 14 || y > 14 || m.board[y][x]) return;
    m.board[y][x] = seat;
    if (checkCaroWin(m.board, x, y, seat)) {
      m.status = 'ended'; m.winnerId = socket.id; m.message = `${p.nickname} thắng Caro!`;
      awardWin(p, 'caro', socket); emitSelf(socket, p); emitMatch(m); broadcastState();
      pushChat({ type: 'system', text: `🏆 ${p.nickname} thắng Cờ Caro.`, ts: Date.now() });
      return;
    }
    if (m.board.every((row) => row.every((c) => c))) { m.status = 'ended'; m.message = 'Hòa!'; emitMatch(m); return; }
    if (m.vsNpc) {
      m.turn = 2; emitMatch(m);
      const mv = caroNpcMove(m.board);
      if (mv) {
        m.board[mv[1]][mv[0]] = 2;
        if (checkCaroWin(m.board, mv[0], mv[1], 2)) {
          m.status = 'ended'; m.winnerId = 'npc'; m.message = 'Quản giáo thắng.'; emitMatch(m); return;
        }
      }
      m.turn = 1; m.turnEndsAt = Date.now() + 30000; emitMatch(m);
    } else {
      m.turn = seat === 1 ? 2 : 1; m.turnEndsAt = Date.now() + 30000; emitMatch(m);
    }
  });

  socket.on('rpsChoice', (payload) => {
    const p = online.get(socket.id);
    if (!p) return;
    const m = matches.get(payload && payload.matchId);
    if (!m || m.game !== 'rps' || m.status !== 'playing') return;
    if (!m.players.includes(socket.id)) return;
    const choice = payload.choice;
    if (!['rock', 'paper', 'scissors'].includes(choice)) return;
    if (m.choices[socket.id]) return;
    m.choices[socket.id] = choice;
    if (m.vsNpc) {
      resolveRpsRound(m, socket.id, choice, 'npc', ['rock', 'paper', 'scissors'][Math.floor(Math.random() * 3)]);
      return;
    }
    if (Object.keys(m.choices).length < 2) { emitMatch(m); return; }
    const [a, b] = m.players;
    resolveRpsRound(m, a, m.choices[a], b, m.choices[b]);
  });

  function resolveRpsRound(m, idA, cA, idB, cB) {
    const beats = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
    let winner = null;
    if (cA !== cB) winner = beats[cA] === cB ? idA : idB;
    if (winner === idA) m.scores[1]++;
    else if (winner === idB) m.scores[2]++;
    const label = { rock: 'Búa', paper: 'Bao', scissors: 'Kéo' };
    m.lastRound = { a: { id: idA, choice: cA, label: label[cA] }, b: { id: idB, choice: cB, label: label[cB] }, winner };
    m.choices = {}; m.round++;
    if (m.scores[1] >= 2 || m.scores[2] >= 2) {
      m.status = 'ended';
      if (m.scores[1] >= 2) {
        m.winnerId = m.players[0];
        const wp = online.get(m.players[0]);
        if (wp) {
          const sock = [...io.sockets.sockets.values()].find((s) => s.id === m.players[0]);
          awardWin(wp, 'rps', sock); if (sock) emitSelf(sock, wp);
        }
        m.message = `${wp ? wp.nickname : 'P1'} thắng BO3!`;
      } else if (m.vsNpc) {
        m.winnerId = 'npc'; m.message = 'Quản giáo thắng BO3.';
      } else {
        m.winnerId = m.players[1];
        const wp = online.get(m.players[1]);
        if (wp) {
          const sock = [...io.sockets.sockets.values()].find((s) => s.id === m.players[1]);
          awardWin(wp, 'rps', sock); if (sock) emitSelf(sock, wp);
        }
        m.message = `${wp ? wp.nickname : 'P2'} thắng BO3!`;
      }
      if (m.winnerId && m.winnerId !== 'npc') {
        const wp = online.get(m.winnerId);
        if (wp) pushChat({ type: 'system', text: `🏆 ${wp.nickname} thắng Kéo Búa Bao.`, ts: Date.now() });
      }
      broadcastState();
    } else {
      m.message = winner ? `Ván thắng.` : `Hòa.`;
    }
    emitMatch(m);
  }

  socket.on('closeMatch', (payload) => {
    const m = matches.get(payload && payload.matchId);
    if (!m || !m.players.includes(socket.id)) return;
    matches.delete(m.id);
    for (const pid of m.players) {
      const sock = [...io.sockets.sockets.values()].find((s) => s.id === pid);
      if (sock) sock.emit('match', null);
    }
  });


  // --- v6 quests ---
  socket.on('claimQuest', (payload) => {
    const p = online.get(socket.id);
    if (!p) return;
    const kind = payload && payload.kind;
    const id = payload && payload.id;
    if (!kind || !id) return;
    if (kind === 'daily') {
      const d = v6.ensureDaily(p);
      const q = v6.DAILY_QUESTS.find((x) => x.id === id);
      if (!q) return;
      if ((d[q.stat] || 0) < q.target) { socket.emit('errorMsg', 'Chưa hoàn thành nhiệm vụ.'); return; }
      if (d.claimed && d.claimed[id]) { socket.emit('errorMsg', 'Đã nhận thưởng.'); return; }
      d.claimed = d.claimed || {};
      d.claimed[id] = true;
      p.money += q.money; p.totalEarned += q.money;
      if (p.role === 'guard') grantGuardXp(p, q.xp, socket); else grantRankXp(p, q.xp, socket);
      socket.emit('actionResult', { kind: 'quest', message: `✅ ${q.name}: +${q.xp} XP, +${q.money}$` });
    } else if (kind === 'rank') {
      if (p.role === 'guard') { socket.emit('errorMsg', 'Nhiệm vụ hạng tù chỉ cho tù nhân.'); return; }
      const q = v6.RANK_QUESTS.find((x) => x.id === id);
      if (!q) return;
      if ((p.rankXp || 0) < q.needXp) { socket.emit('errorMsg', 'Chưa đủ XP hạng.'); return; }
      if (p.rankQuestClaimed && p.rankQuestClaimed[id]) { socket.emit('errorMsg', 'Đã nhận.'); return; }
      p.rankQuestClaimed = p.rankQuestClaimed || {};
      p.rankQuestClaimed[id] = true;
      p.money += q.money; p.totalEarned += q.money;
      grantRankXp(p, q.xp, socket);
      p.rehabPoints = (p.rehabPoints || 0) + 5;
      socket.emit('actionResult', { kind: 'quest', message: `🎖️ ${q.name}: +${q.xp} XP, +${q.money}$` });
    } else if (kind === 'guard') {
      if (p.role !== 'guard') { socket.emit('errorMsg', 'Chỉ Quản giáo.'); return; }
      const q = v6.GUARD_QUESTS.find((x) => x.id === id);
      if (!q) return;
      if ((p[q.stat] || 0) < q.target) { socket.emit('errorMsg', 'Chưa hoàn thành.'); return; }
      if (p.guardQuestClaimed && p.guardQuestClaimed[id]) { socket.emit('errorMsg', 'Đã nhận.'); return; }
      p.guardQuestClaimed = p.guardQuestClaimed || {};
      p.guardQuestClaimed[id] = true;
      p.money += q.money; p.totalEarned += q.money;
      grantGuardXp(p, q.xp, socket);
      socket.emit('actionResult', { kind: 'quest', message: `👮 ${q.name}: +${q.xp} XP QG, +${q.money}$` });
    }
    p.happinessUnlocked = v6.happinessUnlocked(p);
    if (p.happinessUnlocked) {
      socket.emit('actionResult', { kind: 'happinessUnlock', message: '🏠 Phòng hạnh phúc đã mở! Tìm trên bản đồ (M).' });
    }
    emitSelf(socket, p); broadcastState(); saveData();
  });

  // --- v6 mini-games ---
  socket.on('quizAnswer', (payload) => {
    const p = online.get(socket.id);
    if (!p) return;
    const m = matches.get(payload && payload.matchId);
    if (!m || m.game !== 'quiz' || m.status !== 'playing') return;
    if (!m.players.includes(socket.id)) return;
    const q = v6.QUIZ_BANK[m.quiz.idx % v6.QUIZ_BANK.length];
    const ans = payload.answer | 0;
    const seat = m.players[0] === socket.id ? 1 : 2;
    if (ans === q.correct) m.scores[seat] = (m.scores[seat] || 0) + 1;
    m.quiz.asked = (m.quiz.asked || 0) + 1;
    if (m.vsNpc) {
      // NPC answers correctly ~55%
      if (Math.random() < 0.55) m.scores[2] = (m.scores[2] || 0) + 1;
    }
    if (m.quiz.asked >= 3) {
      m.status = 'ended';
      if (m.scores[1] > (m.scores[2] || 0)) {
        m.winnerId = m.players[0];
        const wp = online.get(m.players[0]);
        const sock = [...io.sockets.sockets.values()].find((s) => s.id === m.players[0]);
        if (wp) { awardWin(wp, 'quiz', sock); if (sock) emitSelf(sock, wp); m.message = `${wp.nickname} thắng Đố vui!`; }
      } else if (!m.vsNpc && m.scores[2] > m.scores[1]) {
        m.winnerId = m.players[1];
        const wp = online.get(m.players[1]);
        const sock = [...io.sockets.sockets.values()].find((s) => s.id === m.players[1]);
        if (wp) { awardWin(wp, 'quiz', sock); if (sock) emitSelf(sock, wp); m.message = `${wp.nickname} thắng Đố vui!`; }
      } else if (m.vsNpc && (m.scores[2] || 0) >= m.scores[1]) {
        m.winnerId = 'npc'; m.message = 'Quản giáo thắng Đố vui.';
      } else {
        m.message = 'Hòa Đố vui.';
      }
      if (m.winnerId && m.winnerId !== 'npc') {
        const wp = online.get(m.winnerId);
        if (wp) pushChat({ type: 'system', text: `🧠 ${wp.nickname} thắng Đố vui.`, ts: Date.now() });
      }
      broadcastState();
    } else {
      m.quiz.idx = (m.quiz.idx + 1 + Math.floor(Math.random() * (v6.QUIZ_BANK.length - 1))) % v6.QUIZ_BANK.length;
      m.message = `Câu ${m.quiz.asked + 1}/3`;
    }
    emitMatch(m);
  });

  socket.on('ballShoot', (payload) => {
    const p = online.get(socket.id);
    if (!p) return;
    const m = matches.get(payload && payload.matchId);
    if (!m || m.game !== 'ball' || m.status !== 'playing') return;
    if (!m.players.includes(socket.id)) return;
    const power = Math.max(0, Math.min(100, Number(payload.power) || 50));
    const hit = Math.abs(power - 72) < 18 + Math.random() * 10;
    const seat = m.players[0] === socket.id ? 1 : 2;
    if (hit) m.scores[seat] = (m.scores[seat] || 0) + 1;
    m.ballShots = (m.ballShots || 0) + 1;
    m.lastRound = { shooter: socket.id, hit, power };
    if (m.vsNpc && m.ballShots % 2 === 1) {
      if (Math.random() < 0.48) m.scores[2] = (m.scores[2] || 0) + 1;
      m.ballShots++;
    }
    const shotsNeeded = m.vsNpc ? 6 : 6;
    if (m.ballShots >= shotsNeeded) {
      m.status = 'ended';
      if (m.scores[1] > (m.scores[2] || 0)) {
        m.winnerId = m.players[0];
        const wp = online.get(m.players[0]);
        const sock = [...io.sockets.sockets.values()].find((s) => s.id === m.players[0]);
        if (wp) { awardWin(wp, 'ball', sock); if (sock) emitSelf(sock, wp); m.message = `${wp.nickname} thắng Ném bóng!`; }
      } else if (!m.vsNpc && (m.scores[2] || 0) > m.scores[1]) {
        m.winnerId = m.players[1];
        const wp = online.get(m.players[1]);
        const sock = [...io.sockets.sockets.values()].find((s) => s.id === m.players[1]);
        if (wp) { awardWin(wp, 'ball', sock); if (sock) emitSelf(sock, wp); m.message = `${wp.nickname} thắng Ném bóng!`; }
      } else if (m.vsNpc && (m.scores[2] || 0) >= m.scores[1]) {
        m.winnerId = 'npc'; m.message = 'Quản giáo thắng Ném bóng.';
      } else m.message = 'Hòa bóng rổ.';
      if (m.winnerId && m.winnerId !== 'npc') {
        const wp = online.get(m.winnerId);
        if (wp) pushChat({ type: 'system', text: `🏀 ${wp.nickname} thắng Ném bóng rổ.`, ts: Date.now() });
      }
      broadcastState();
    } else {
      m.message = hit ? '🏀 Vào rổ!' : '❌ Trượt!';
    }
    emitMatch(m);
  });

  socket.on('oanquanMove', (payload) => {
    const p = online.get(socket.id);
    if (!p) return;
    const m = matches.get(payload && payload.matchId);
    if (!m || m.game !== 'oanquan' || m.status !== 'playing') return;
    if (!m.players.includes(socket.id)) return;
    const seat = m.players[0] === socket.id ? 1 : 2;
    if (m.board.turn !== seat && !(m.vsNpc && seat === 1)) {
      // vs npc always seat 1
    }
    if (m.vsNpc && seat !== 1) return;
    if (!m.vsNpc && m.board.turn !== seat) { socket.emit('errorMsg', 'Chưa tới lượt.'); return; }
    const pit = payload.pit | 0;
    const pits = m.board.pits;
    const mySide = seat === 1 ? [0,1,2,3,4] : [6,7,8,9,10];
    if (!mySide.includes(pit) || !pits[pit]) return;
    let stones = pits[pit]; pits[pit] = 0;
    let i = pit;
    while (stones > 0) {
      i = (i + 1) % 12;
      if (i === 5 || i === 11) continue; // skip quan for lite
      pits[i]++; stones--;
    }
    // capture lite: if land on empty own side, steal
    if (mySide.includes(i) && pits[i] === 1) {
      const opp = (i + 6) % 12;
      if (opp !== 5 && opp !== 11) {
        pits[seat === 1 ? 5 : 11] += pits[opp] + 1;
        pits[opp] = 0; pits[i] = 0;
      }
    }
    // NPC simple move
    if (m.vsNpc) {
      const npcSide = [6,7,8,9,10];
      const choices = npcSide.filter((x) => pits[x] > 0);
      if (choices.length) {
        const np = choices[Math.floor(Math.random() * choices.length)];
        let ns = pits[np]; pits[np] = 0; let j = np;
        while (ns > 0) { j = (j + 1) % 12; if (j === 5 || j === 11) continue; pits[j]++; ns--; }
      }
      m.board.turn = 1;
    } else {
      m.board.turn = seat === 1 ? 2 : 1;
    }
    const myScore = pits[5] + mySide.reduce((s, x) => s + pits[x], 0);
    const oppScore = pits[11] + [6,7,8,9,10].reduce((s, x) => s + pits[x], 0);
    const left1 = mySide.reduce((s, x) => s + pits[x], 0);
    const left2 = [6,7,8,9,10].reduce((s, x) => s + pits[x], 0);
    if (left1 === 0 || left2 === 0 || (pits[5] + pits[11]) >= 40) {
      m.status = 'ended';
      const s1 = pits[5]; const s2 = pits[11];
      if (s1 > s2) {
        m.winnerId = m.players[0];
        const wp = online.get(m.players[0]);
        const sock = [...io.sockets.sockets.values()].find((s) => s.id === m.players[0]);
        if (wp) { awardWin(wp, 'oanquan', sock); if (sock) emitSelf(sock, wp); m.message = `${wp.nickname} thắng Ô ăn quan!`; }
      } else if (!m.vsNpc && s2 > s1) {
        m.winnerId = m.players[1];
        const wp = online.get(m.players[1]);
        const sock = [...io.sockets.sockets.values()].find((s) => s.id === m.players[1]);
        if (wp) { awardWin(wp, 'oanquan', sock); if (sock) emitSelf(sock, wp); m.message = `${wp.nickname} thắng Ô ăn quan!`; }
      } else if (m.vsNpc && s2 >= s1) {
        m.winnerId = 'npc'; m.message = 'Quản giáo thắng Ô ăn quan.';
      } else m.message = 'Hòa Ô ăn quan.';
      if (m.winnerId && m.winnerId !== 'npc') {
        const wp = online.get(m.winnerId);
        if (wp) pushChat({ type: 'system', text: `🟡 ${wp.nickname} thắng Ô ăn quan.`, ts: Date.now() });
      }
      broadcastState();
    } else {
      m.message = `Ô quan: bạn ${pits[5]} — đối ${pits[11]}`;
    }
    emitMatch(m);
  });

  socket.on('tienlenPlay', (payload) => {
    const p = online.get(socket.id);
    if (!p) return;
    const m = matches.get(payload && payload.matchId);
    if (!m || m.game !== 'tienlen' || m.status !== 'playing') return;
    if (!m.players.includes(socket.id)) return;
    const play = Math.max(2, Math.min(14, Number(payload.card) || m.hand || 7));
    let npc = m.npcHand || (Math.floor(Math.random() * 13) + 2);
    if (!m.vsNpc && m.hands) {
      const oppId = m.players.find((id) => id !== socket.id);
      npc = m.hands[oppId] || npc;
      m.hands[socket.id] = play;
    }
    m.lastRound = { you: play, opp: npc };
    m.status = 'ended';
    if (play > npc) {
      m.winnerId = socket.id;
      awardWin(p, 'tienlen', socket); emitSelf(socket, p);
      m.message = `${p.nickname} thắng Tiến lên lite (${play} > ${npc})!`;
      pushChat({ type: 'system', text: `🃏 ${p.nickname} thắng Tiến lên lite.`, ts: Date.now() });
    } else if (play < npc) {
      m.winnerId = m.vsNpc ? 'npc' : (m.players.find((id) => id !== socket.id) || 'npc');
      if (!m.vsNpc && m.winnerId !== 'npc') {
        const wp = online.get(m.winnerId);
        const sock = [...io.sockets.sockets.values()].find((s) => s.id === m.winnerId);
        if (wp) { awardWin(wp, 'tienlen', sock); if (sock) emitSelf(sock, wp); m.message = `${wp.nickname} thắng Tiến lên lite!`; }
      } else m.message = `Thua Tiến lên (${play} < ${npc}).`;
    } else {
      m.message = 'Hòa bài.';
    }
    broadcastState();
    emitMatch(m);
  });

  // --- v6 guard actions ---
  socket.on('guardPatrol', () => {
    const p = online.get(socket.id);
    if (!p || p.role !== 'guard') { socket.emit('errorMsg', 'Chỉ Quản giáo tuần tra.'); return; }
    if (p.energy < 8) { socket.emit('errorMsg', 'Hết năng lượng tuần tra.'); return; }
    p.energy -= 8;
    p.guardPatrols = (p.guardPatrols || 0) + 1;
    grantGuardXp(p, 6, socket);
    p.money += 8; p.totalEarned += 8;
    // move along a few rooms
    const route = ['san_tap', 'xuong', 'tuong_rao', 'nha_bep', 'bang_thu'];
    p.room = route[p.guardPatrols % route.length];
    const r = ROOM_BY_ID[p.room];
    if (r) { p.x = r.x; p.z = r.z; }
    setEmote(p, 'patrol', 4000);
    socket.emit('actionResult', { kind: 'patrol', message: `🪖 Tuần tra ${p.room}. +6 XP QG` });
    pushChat({ type: 'system', text: `🪖 Quản giáo ${p.nickname} tuần tra khu ${ROOM_BY_ID[p.room]?.name || p.room}.`, ts: Date.now() });
    emitSelf(socket, p); broadcastState(); saveData();
  });

  socket.on('guardRollCall', () => {
    const p = online.get(socket.id);
    if (!p || p.role !== 'guard') { socket.emit('errorMsg', 'Chỉ Quản giáo điểm danh.'); return; }
    p.guardRolls = (p.guardRolls || 0) + 1;
    grantGuardXp(p, 10, socket);
    p.money += 12; p.totalEarned += 12;
    const phase = SCHEDULE[scheduleIndex];
    let missing = 0;
    for (const pl of online.values()) {
      if (pl.role === 'guard' || pl.escaped || pl.released) continue;
      if (!v6.inRequiredPlace(phase, pl)) missing++;
    }
    const msg = `📋 Điểm danh: ${online.size} online, ${missing} vắng vị trí lịch (${phase.name}).`;
    socket.emit('actionResult', { kind: 'roll', message: msg });
    pushChat({ type: 'system', text: `📋 Quản giáo ${p.nickname} điểm danh — ${missing} người chưa đúng chỗ.`, ts: Date.now() });
    emitSelf(socket, p); broadcastState(); saveData();
  });

  socket.on('guardCatch', (payload) => {
    const p = online.get(socket.id);
    if (!p || p.role !== 'guard') { socket.emit('errorMsg', 'Chỉ Quản giáo bắt vượt ngục.'); return; }
    const targetId = payload && payload.targetId;
    let target = targetId ? online.get(targetId) : null;
    if (!target) {
      // find prisoner at tuong_rao
      target = [...online.values()].find((pl) => pl.role !== 'guard' && !pl.released && pl.room === 'tuong_rao');
    }
    if (!target) { socket.emit('errorMsg', 'Không có tù nhân khả nghi tại tường rào.'); return; }
    if (target.room !== 'tuong_rao' && target.room !== p.room) {
      socket.emit('errorMsg', 'Đối tượng không ở gần.'); return;
    }
    const bonus = v6.guardRankFromXp(p.guardXp || 0).catchBonus || 0;
    const chance = 0.55 + bonus;
    if (Math.random() < chance) {
      p.guardCatches = (p.guardCatches || 0) + 1;
      grantGuardXp(p, 35, socket);
      p.money += 50; p.totalEarned += 50;
      const tSock = [...io.sockets.sockets.values()].find((s) => s.id === target.id);
      failEscapeCatch(target, tSock, `Quản giáo ${p.nickname} bắt quả tang khi vượt ngục!`);
      socket.emit('actionResult', { kind: 'catch', message: `🚨 Bắt được ${target.nickname}! +35 XP QG, +50$` });
      pushChat({ type: 'system', text: `🚨 Quản giáo ${p.nickname} bắt ${target.nickname} vượt ngục!`, ts: Date.now() });
    } else {
      grantGuardXp(p, 5, socket);
      socket.emit('actionResult', { kind: 'catch', message: `${target.nickname} chạy thoát tạm thời.` });
    }
    emitSelf(socket, p); broadcastState(); saveData();
  });

  socket.on('guardBribeOffer', (payload) => {
    // prisoner offers bribe to player-guard
    const p = online.get(socket.id);
    if (!p || p.role === 'guard') return;
    if (p.escaped || p.released) return;
    const guardId = payload && payload.guardId;
    const g = online.get(guardId);
    if (!g || g.role !== 'guard') { socket.emit('errorMsg', 'Không tìm thấy Quản giáo người chơi.'); return; }
    const price = Math.max(30, bribePrice(p));
    if (p.money < price) { socket.emit('errorMsg', `Cần ${price}$ để hối lộ.`); return; }
    g.pendingBribes = g.pendingBribes || [];
    g.pendingBribes.push({ fromId: socket.id, fromNick: p.nickname, amount: price, ts: Date.now() });
    if (g.pendingBribes.length > 10) g.pendingBribes.shift();
    const gSock = [...io.sockets.sockets.values()].find((s) => s.id === g.id);
    if (gSock) {
      gSock.emit('bribeOffer', { fromId: socket.id, fromNick: p.nickname, amount: price });
      emitSelf(gSock, g);
    }
    socket.emit('actionResult', { kind: 'bribe', message: `Đã gửi hối lộ ${price}$ tới Quản giáo ${g.nickname}.` });
  });

  socket.on('guardRespondBribe', (payload) => {
    const p = online.get(socket.id);
    if (!p || p.role !== 'guard') return;
    const fromId = payload && payload.fromId;
    const accept = !!(payload && payload.accept);
    const offer = (p.pendingBribes || []).find((b) => b.fromId === fromId);
    if (!offer) { socket.emit('errorMsg', 'Không còn đề nghị hối lộ.'); return; }
    p.pendingBribes = (p.pendingBribes || []).filter((b) => b.fromId !== fromId);
    const prisoner = online.get(fromId);
    const pSock = [...io.sockets.sockets.values()].find((s) => s.id === fromId);
    if (accept) {
      if (!prisoner || prisoner.money < offer.amount) {
        socket.emit('errorMsg', 'Tù nhân không đủ tiền.'); return;
      }
      prisoner.money -= offer.amount;
      p.money += offer.amount; p.totalEarned += offer.amount;
      prisoner.bribeGuardId = 'player_' + p.id;
      prisoner.bribeUntil = Date.now() + 90000;
      grantGuardXp(p, 3, socket);
      if (pSock) {
        emitSelf(pSock, prisoner);
        pSock.emit('actionResult', { kind: 'bribe', message: `Quản giáo ${p.nickname} nhận hối lộ — canh lỏng 90s.` });
      }
      socket.emit('actionResult', { kind: 'bribe', message: `Nhận ${offer.amount}$ từ ${offer.fromNick}.` });
      pushChat({ type: 'system', text: `💰 Quản giáo ${p.nickname}… “linh động” với ${offer.fromNick}.`, ts: Date.now() });
    } else {
      p.guardRefuseBribes = (p.guardRefuseBribes || 0) + 1;
      p.guardIntegrity = (p.guardIntegrity || 0) + 10;
      grantGuardXp(p, 12, socket);
      p.rehabPoints = (p.rehabPoints || 0); // N/A
      if (pSock) pSock.emit('actionResult', { kind: 'bribe', message: `Quản giáo ${p.nickname} từ chối hối lộ!` });
      socket.emit('actionResult', { kind: 'bribe', message: `Từ chối hối lộ — +10 liêm chính, +12 XP QG` });
      pushChat({ type: 'system', text: `✨ Quản giáo ${p.nickname} từ chối hối lộ của ${offer.fromNick} — điểm liêm chính +10.`, ts: Date.now() });
    }
    emitSelf(socket, p); broadcastState(); saveData();
  });

  socket.on('disconnect', () => {
    const p = online.get(socket.id);
    if (p) {
      playersByNick[p.nickname.toLowerCase()] = stripTransient(p);
      online.delete(socket.id);
      pushChat({ type: 'system', text: `${p.nickname} đã rời trại.`, ts: Date.now() });
      saveData();
      broadcastState();
    }
    for (const [id, m] of matches) {
      if (m.players.includes(socket.id)) {
        m.status = 'ended'; m.message = 'Đối thủ đã thoát.';
        emitMatch(m); matches.delete(id);
      }
    }
  });
});

const ROOM_NEIGHBORS = {
  phong_a: ['phong_a', 'phong_b', 'san_tap', 'bang_thu', 'xuong'],
  phong_b: ['phong_b', 'phong_a', 'san_tap', 'bang_thu', 'nha_bep'],
  san_tap: ['san_tap', 'phong_a', 'phong_b', 'nha_bep', 'xuong', 'tuong_rao', 'bang_thu'],
  nha_bep: ['nha_bep', 'san_tap', 'phong_b'],
  xuong: ['xuong', 'san_tap', 'phong_a', 'tuong_rao'],
  tuong_rao: ['tuong_rao', 'san_tap', 'xuong'],
  bang_thu: ['bang_thu', 'san_tap', 'phong_a', 'phong_b'],
};

function posePayload(p) {
  const rank = rankFromXp(p.rankXp || 0);
  return {
    id: p.id, nickname: p.nickname, prisonerNo: p.prisonerNo,
    x: p.x, z: p.z, rotY: p.rotY || 0, room: p.room,
    appearance: p.appearance, emote: p.emote && Date.now() < p.emoteUntil ? p.emote : null,
    sleeping: !!p.sleeping,
    rankEmoji: rank.emoji, rankName: rank.name, rankId: rank.id,
  };
}

// Area/interest pose broadcast ~10Hz (same + neighbor rooms only)
setInterval(() => {
  const active = [...online.entries()].filter(([, p]) => !p.escaped && !p.released);
  if (!active.length) return;
  if (active.length <= 40) {
    io.emit('poses', active.map(([, p]) => posePayload(p)));
    return;
  }
  const byRoom = {};
  for (const [sid, p] of active) {
    (byRoom[p.room] || (byRoom[p.room] = [])).push([sid, p]);
  }
  for (const [sid, p] of active) {
    const rooms = ROOM_NEIGHBORS[p.room] || [p.room];
    const list = [];
    for (const r of rooms) {
      for (const [, op] of (byRoom[r] || [])) list.push(posePayload(op));
    }
    io.to(sid).emit('poses', list);
  }
}, 100);

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    online: online.size,
    registered: Object.keys(playersByNick).length,
    maxPlayers: MAX_PLAYERS,
    npcCount: NPC_COUNT,
    name: 'Ở tù online',
    version: VERSION,
    persist: useSupabase ? 'supabase' : 'json',
  });
});

setInterval(tickGuards, 900);

(async () => {
  await loadData();
  setInterval(() => { void saveData(); }, 15000);
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Ở tù online listening on http://0.0.0.0:${PORT} (${VERSION}) max=${MAX_PLAYERS} persist=${useSupabase ? 'supabase' : 'json'}`);
  });
})().catch((e) => {
  console.error('Boot failed', e);
  process.exit(1);
});

