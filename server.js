const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3847;
const DATA_FILE = path.join(__dirname, 'data', 'players.json');

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
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders(res, filePath) {
    if (filePath.endsWith('sw.js')) {
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Service-Worker-Allowed', '/');
    }
  },
}));

const JOBS = {
  giat_do: { id: 'giat_do', name: 'Giặt đồ', emoji: '👕', basePay: 15, energyCost: 8, cooldownMs: 8000, description: 'Giặt quần áo cho trại' },
  nau_an: { id: 'nau_an', name: 'Nấu ăn', emoji: '🍲', basePay: 25, energyCost: 12, cooldownMs: 12000, description: 'Giúp bếp nấu suất ăn' },
  lao_dong: { id: 'lao_dong', name: 'Lao động nặng', emoji: '⛏️', basePay: 45, energyCost: 20, cooldownMs: 18000, description: 'Đập đá / dọn sân' },
};

const SHOP = {
  giuong: { id: 'giuong', name: 'Giường tốt hơn', emoji: '🛏️', price: 80, maxLevel: 5, description: '+10 máu tối đa / cấp, hồi năng lượng nhanh hơn' },
  do_an: { id: 'do_an', name: 'Suất ăn đặc biệt', emoji: '🍖', price: 40, maxLevel: 10, description: '+15 máu & +20 năng lượng ngay (tiêu thụ)' },
  cong_cu: { id: 'cong_cu', name: 'Công cụ lao động', emoji: '🔧', price: 100, maxLevel: 5, description: '+15% tiền công / cấp' },
  dung_cu_vuot: { id: 'dung_cu_vuot', name: 'Dụng cụ vượt ngục', emoji: '🗝️', price: 200, maxLevel: 3, description: '+12% tỉ lệ vượt ngục / cấp' },
};

const ROOMS = [
  { id: 'phong_a', name: 'Phòng giam A', emoji: '🚪', x: -16, z: -14 },
  { id: 'phong_b', name: 'Phòng giam B', emoji: '🚪', x: 16, z: -14 },
  { id: 'san_tap', name: 'Sân trại', emoji: '🏃', x: 0, z: 0 },
  { id: 'nha_bep', name: 'Nhà ăn / Bếp', emoji: '🍽️', x: 16, z: 14 },
  { id: 'xuong', name: 'Xưởng', emoji: '🏭', x: -16, z: 14 },
  { id: 'tuong_rao', name: 'Tường rào', emoji: '🧱', x: 0, z: 28 },
  { id: 'bang_thu', name: 'Bảng Thư', emoji: '📋', x: 8, z: -4 },
];

const ROOM_BY_ID = Object.fromEntries(ROOMS.map((r) => [r.id, r]));

const ROOM_GRAPH = {
  phong_a: ['san_tap', 'phong_b', 'xuong', 'bang_thu'],
  phong_b: ['san_tap', 'phong_a', 'nha_bep', 'bang_thu'],
  san_tap: ['phong_a', 'phong_b', 'nha_bep', 'xuong', 'tuong_rao', 'bang_thu'],
  nha_bep: ['san_tap', 'phong_b'],
  xuong: ['san_tap', 'phong_a', 'tuong_rao'],
  tuong_rao: ['san_tap', 'xuong'],
  bang_thu: ['san_tap', 'phong_a', 'phong_b'],
};

const APPEARANCE = {
  skins: ['#e0b090', '#c68642', '#8d5524', '#f1c27d', '#ffdbac'],
  hairs: ['#2a2218', '#1a1a1a', '#5a3a1a', '#c4a35a', '#4a2020', '#708090'],
  stripes: [
    { id: 'bw', light: '#f5f5f5', dark: '#151515', name: 'Sọc trắng–đen' },
    { id: 'blue', light: '#e8f0ff', dark: '#1a3050', name: 'Sọc xanh' },
    { id: 'orange', light: '#fff0e0', dark: '#6a3010', name: 'Sọc cam' },
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
  { id: 'an', name: 'Giờ ăn', emoji: '🍲', roomHint: 'nha_bep', seconds: 50, announce: '📢 Loa trại: Giờ ăn! Tập trung Nhà ăn / Bếp.' },
  { id: 'tap', name: 'Giờ tập', emoji: '🏋️', roomHint: 'san_tap', seconds: 50, announce: '📢 Loa trại: Giờ tập thể dục trên Sân trại!' },
  { id: 'tat_den', name: 'Tắt đèn', emoji: '🌙', roomHint: 'phong_a', seconds: 50, announce: '📢 Loa trại: Giờ tắt đèn. Về phòng nghỉ.' },
];

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
  const room = ROOM_BY_ID.phong_a;
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
    achievementsUnlocked: {},
    workCount: 0,
    scheduleAttend: 0,
    lettersSent: 0,
    released: false,
    releasedAt: null,
    earlyRelease: false,
    money: 50,
    health: 100,
    maxHealth: 100,
    energy: 100,
    maxEnergy: 100,
    reputation: 0,
    room: 'phong_a',
    x: room.x + (Math.random() - 0.5) * 3,
    z: room.z + (Math.random() - 0.5) * 3,
    rotY: 0,
    upgrades: { giuong: 0, cong_cu: 0, dung_cu_vuot: 0 },
    cooldowns: {},
    escaped: false,
    escapeFails: 0,
    totalEarned: 0,
    daysMarked: 0,
    winsCaro: 0,
    winsRps: 0,
    gameWins: 0,
    appearance: normalizeAppearance(payload.appearance),
    emote: null,
    emoteUntil: 0,
    sleeping: false,
    joinedAt: Date.now(),
    lastActive: Date.now(),
    lastDayTick: Date.now(),
    daysSinceReview: 0,
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

function loadData() {
  try {
    ensureDataDir();
    if (fs.existsSync(DATA_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      playersByNick = raw.players || raw;
      if (Array.isArray(raw.letters)) letters.push(...raw.letters.slice(-MAX_LETTERS));
    }
  } catch (e) {
    console.error('Load error', e.message);
    playersByNick = {};
  }
}

function stripTransient(p) {
  const { id, cooldowns, emote, emoteUntil, sleeping, ...rest } = p;
  return { ...rest, cooldowns: {}, sleeping: false, emote: null };
}

function saveData() {
  try {
    ensureDataDir();
    for (const p of online.values()) playersByNick[p.nickname.toLowerCase()] = stripTransient(p);
    fs.writeFileSync(DATA_FILE, JSON.stringify({ players: playersByNick, letters: letters.slice(-MAX_LETTERS) }, null, 2));
  } catch (e) {
    console.error('Save error', e.message);
  }
}

loadData();
setInterval(saveData, 15000);

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
    totalEarned: Math.floor(p.totalEarned),
    cooldowns: p.cooldowns,
    daysMarked: p.daysMarked || 0,
    winsCaro: p.winsCaro || 0,
    winsRps: p.winsRps || 0,
    gameWins: p.gameWins || 0,
    workCount: p.workCount || 0,
    lettersSent: p.lettersSent || 0,
    scheduleAttend: p.scheduleAttend || 0,
    appearance: p.appearance || normalizeAppearance(null),
    emote: p.emote && Date.now() < p.emoteUntil ? p.emote : null,
    sleeping: !!p.sleeping,
  };
}

function leaderboard() {
  const all = { ...playersByNick };
  for (const p of online.values()) all[p.nickname.toLowerCase()] = stripTransient(p);
  const list = Object.values(all).map((p) => ({
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
  }));
  const early = list.filter((p) => p.released).sort((a, b) => {
    const sa = (a.daysServed || 0) / Math.max(1, a.sentenceTotalDays || 1);
    const sb = (b.daysServed || 0) / Math.max(1, b.sentenceTotalDays || 1);
    return sa - sb || (a.releasedAt || 0) - (b.releasedAt || 0);
  }).slice(0, 10);
  const wins = list.slice().sort((a, b) => b.gameWins - a.gameWins || b.rehabPoints - a.rehabPoints).slice(0, 15);
  const rehab = list.slice().sort((a, b) => b.rehabPoints - a.rehabPoints).slice(0, 15);
  return { wins, rehab, earlyRelease: early };
}

function roomCounts() {
  const counts = {};
  for (const r of ROOMS) counts[r.id] = 0;
  for (const p of online.values()) {
    if (!p.escaped && !p.released && counts[p.room] !== undefined) counts[p.room]++;
  }
  return counts;
}

function broadcastState() {
  const list = [...online.values()].filter((p) => !p.escaped && !p.released).map(publicPlayer);
  io.emit('world', {
    players: list,
    rooms: ROOMS,
    roomCounts: roomCounts(),
    leaderboard: leaderboard(),
    onlineCount: online.size,
    schedule: currentSchedule(),
    letters: letters.slice(-20).reverse(),
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
  pushChat({ type: 'system', text: phase.announce, ts: Date.now() });
  if (phase.id !== 'tat_den') {
    for (const p of online.values()) if (p.sleeping) p.sleeping = false;
  }
  broadcastState();
  io.emit('schedule', currentSchedule());
}, 2000);

// credit schedule attendance mid-phase
setInterval(() => {
  const phase = SCHEDULE[scheduleIndex];
  const key = `${scheduleIndex}-${scheduleEndsAt}`;
  if (!scheduleAttended.has(key)) scheduleAttended.set(key, new Set());
  const set = scheduleAttended.get(key);
  for (const [sid, p] of online) {
    if (p.escaped || p.released) continue;
    let ok = false;
    if (phase.id === 'an' && p.room === 'nha_bep') ok = true;
    if (phase.id === 'tap' && p.room === 'san_tap') ok = true;
    if (phase.id === 'tat_den' && String(p.room).startsWith('phong')) ok = true;
    if (ok && !set.has(sid)) {
      set.add(sid);
      p.scheduleAttend = (p.scheduleAttend || 0) + 1;
      p.rehabPoints = (p.rehabPoints || 0) + 2;
      const sock = [...io.sockets.sockets.values()].find((s) => s.id === sid);
      unlockAchievements(p, sock);
      if (sock) {
        sock.emit('actionResult', { kind: 'schedule', message: `✅ Có mặt đúng lịch (${phase.name}) +2 điểm cải tạo` });
        emitSelf(sock, p);
      }
    }
  }
}, 5000);

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
  p.gameWins = (p.gameWins || 0) + 1;
  p.reputation += 3;
  p.money += 10;
  p.totalEarned += 10;
  p.rehabPoints = (p.rehabPoints || 0) + 3;
  unlockAchievements(p, socket);
}

function publicMatch(m) {
  return {
    id: m.id, game: m.game, vsNpc: m.vsNpc, status: m.status,
    players: m.players.map((pid) => {
      const pl = online.get(pid);
      return { id: pid, nick: pl ? pl.nickname : '?' };
    }),
    youAre: null, board: m.board || null, turn: m.turn, turnEndsAt: m.turnEndsAt,
    scores: m.scores || null, lastRound: m.lastRound || null, winnerId: m.winnerId || null, message: m.message || '',
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
    crimes: CRIMES, sentences: SENTENCE_OPTIONS, achievements: ACHIEVEMENTS,
    schedule: currentSchedule(), dayTickMs: DAY_TICK_MS, reviewEveryDays: REVIEW_EVERY_DAYS,
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
    } else {
      p = defaultPlayer(incoming, socket.id);
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
    if (!p || p.escaped || p.released) return;
    if (!ROOM_BY_ID[roomId]) return;
    if (p.sleeping) p.sleeping = false;
    if (p.energy < 2) { socket.emit('errorMsg', 'Không đủ năng lượng để di chuyển!'); return; }
    p.energy -= 2;
    p.room = roomId;
    const r = ROOM_BY_ID[roomId];
    p.x = r.x + (Math.random() - 0.5) * 2;
    p.z = r.z + (Math.random() - 0.5) * 2;
    emitSelf(socket, p);
    broadcastState();
  }
  socket.on('moveTo', doRoomMove);
  socket.on('move', doRoomMove);

  socket.on('pos', (payload) => {
    const p = online.get(socket.id);
    if (!p || p.escaped || p.released) return;
    if (!payload || typeof payload.x !== 'number' || typeof payload.z !== 'number') return;
    const x = Math.max(-40, Math.min(40, payload.x));
    const z = Math.max(-40, Math.min(45, payload.z));
    // soft speed clamp vs last
    const dx = x - (p.x || 0);
    const dz = z - (p.z || 0);
    if (dx * dx + dz * dz > 40) return; // ignore teleport jumps
    p.x = x;
    p.z = z;
    if (typeof payload.rotY === 'number') p.rotY = payload.rotY;
    if (p.sleeping) p.sleeping = false;
    const nr = nearestRoom(x, z);
    if (nr !== p.room) p.room = nr;
    // lightweight broadcast throttle via next regen — also emit sparse
  });

  socket.on('action', (kind) => {
    const p = online.get(socket.id);
    if (!p || p.escaped || p.released) return;
    const now = Date.now();
    if (kind === 'sit') {
      if (p.room !== 'nha_bep') { socket.emit('errorMsg', 'Phải ở Nhà ăn mới ngồi được.'); return; }
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
      p.room = String(p.room).startsWith('phong') ? p.room : 'phong_a';
      const r = ROOM_BY_ID[p.room];
      p.x = r.x; p.z = r.z;
      setEmote(p, 'sleep', 60000);
      socket.emit('actionResult', { kind, message: 'Về phòng nghỉ… Zzz' });
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
    p.rehabPoints = (p.rehabPoints || 0) + 2;
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
    const job = JOBS[jobId];
    if (!job) return;
    const now = Date.now();
    if (p.cooldowns[jobId] && p.cooldowns[jobId] > now) { socket.emit('errorMsg', `Chưa hết chờ ${job.name}.`); return; }
    if (p.energy < job.energyCost) { socket.emit('errorMsg', 'Không đủ năng lượng!'); return; }
    p.sleeping = false;
    const toolBonus = 1 + (p.upgrades.cong_cu || 0) * 0.15;
    const pay = Math.floor(job.basePay * toolBonus * (0.9 + Math.random() * 0.2));
    p.energy -= job.energyCost;
    p.money += pay;
    p.totalEarned += pay;
    p.reputation += 1;
    p.workCount = (p.workCount || 0) + 1;
    p.rehabPoints = (p.rehabPoints || 0) + 2;
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
    if (itemId === 'do_an') {
      if (p.money < item.price) { socket.emit('errorMsg', 'Không đủ tiền!'); return; }
      p.money -= item.price;
      p.health = Math.min(p.maxHealth, p.health + 15);
      p.energy = Math.min(p.maxEnergy, p.energy + 20);
      emitSelf(socket, p);
      socket.emit('buyResult', { itemId, message: 'Đã ăn suất đặc biệt.' });
      broadcastState();
      return;
    }
    const level = p.upgrades[itemId] || 0;
    if (level >= item.maxLevel) { socket.emit('errorMsg', 'Đã tối đa!'); return; }
    const price = item.price * (level + 1);
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

  socket.on('escape', () => {
    const p = online.get(socket.id);
    if (!p || p.escaped || p.released) return;
    if (p.room !== 'tuong_rao') { socket.emit('errorMsg', 'Phải đến Tường rào mới vượt ngục!'); return; }
    if (p.energy < 30) { socket.emit('errorMsg', 'Cần ≥30 năng lượng.'); return; }
    if (p.health < 20) { socket.emit('errorMsg', 'Sức khỏe quá yếu.'); return; }
    const toolLvl = p.upgrades.dung_cu_vuot || 0;
    let chance = 8 + toolLvl * 12 + Math.min(15, Math.floor(p.reputation / 20)) + Math.floor(p.health / 20) - p.escapeFails * 3;
    chance = Math.max(5, Math.min(75, chance));
    p.energy -= 30;
    const roll = Math.random() * 100;
    if (roll < chance) {
      p.escaped = true;
      p.reputation += 50;
      p.money += 100;
      // escaping is NOT mãn hạn — different path
      delete p.achievementsUnlocked.good_behavior;
      playersByNick[p.nickname.toLowerCase()] = stripTransient(p);
      saveData();
      socket.emit('escapeResult', { success: true, chance, roll: Math.floor(roll), message: `🎉 Vượt ngục thành công!` });
      pushChat({ type: 'system', text: `🚨 ${p.nickname} VƯỢT NGỤC thành công!`, ts: Date.now() });
      emitSelf(socket, p);
      broadcastState();
      setTimeout(() => { online.delete(socket.id); broadcastState(); }, 2000);
    } else {
      p.escapeFails += 1;
      p.health = Math.max(5, p.health - 25);
      p.money = Math.max(0, p.money - 30);
      p.reputation = Math.max(0, p.reputation - 10);
      p.sentenceLeftDays = (p.sentenceLeftDays || 0) + 15;
      p.rehabPoints = Math.max(0, (p.rehabPoints || 0) - 10);
      delete p.achievementsUnlocked.good_behavior;
      p.room = 'phong_a';
      p.x = ROOM_BY_ID.phong_a.x; p.z = ROOM_BY_ID.phong_a.z;
      emitSelf(socket, p);
      socket.emit('escapeResult', { success: false, chance, roll: Math.floor(roll), message: `💥 Thất bại! +15 ngày án.` });
      pushChat({ type: 'system', text: `${p.nickname} vượt ngục thất bại (+15 ngày án).`, ts: Date.now() });
      broadcastState();
    }
  });

  socket.on('chat', (text) => {
    const p = online.get(socket.id);
    if (!p) return;
    const msg = String(text || '').trim().slice(0, 200).replace(/[<>]/g, '');
    if (!msg) return;
    pushChat({ type: 'user', nick: p.nickname, text: msg, ts: Date.now() });
  });

  socket.on('startGame', (payload) => {
    const p = online.get(socket.id);
    if (!p || p.escaped || p.released) return;
    const game = payload && payload.game;
    const vs = payload && payload.vs;
    if (game !== 'caro' && game !== 'rps') return;
    if (vs === 'npc') {
      const m = {
        id: uid(), game, vsNpc: true, status: 'playing', players: [socket.id],
        board: game === 'caro' ? emptyCaro() : null, turn: 1, turnEndsAt: Date.now() + 30000,
        scores: game === 'rps' ? { 1: 0, 2: 0 } : null, choices: game === 'rps' ? {} : null,
        round: 1, winnerId: null,
        message: game === 'caro' ? 'Cờ Caro vs Quản giáo. Bạn đi trước (X).' : 'Kéo Búa Bao BO3 vs Quản giáo.',
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
    const m = {
      id: uid(), game: inv.game, vsNpc: false, status: 'playing', players: [inv.from, inv.to],
      board: inv.game === 'caro' ? emptyCaro() : null, turn: 1, turnEndsAt: Date.now() + 30000,
      scores: inv.game === 'rps' ? { 1: 0, 2: 0 } : null, choices: inv.game === 'rps' ? {} : null,
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

// broadcast positions ~10Hz for smoothness
setInterval(() => {
  const list = [...online.values()].filter((p) => !p.escaped && !p.released).map((p) => ({
    id: p.id, nickname: p.nickname, prisonerNo: p.prisonerNo,
    x: p.x, z: p.z, rotY: p.rotY || 0, room: p.room,
    appearance: p.appearance, emote: p.emote && Date.now() < p.emoteUntil ? p.emote : null,
    sleeping: !!p.sleeping,
  }));
  if (list.length) io.emit('poses', list);
}, 100);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, online: online.size, name: 'Ở tù online', version: '3d-1' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Ở tù online 3D listening on http://0.0.0.0:${PORT}`);
});
