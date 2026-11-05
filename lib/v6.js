'use strict';

const CELL_CAPACITY = 10;
const MIN_CELLS = 8;
const MAX_CELLS = 200;

const GUARD_RANKS = [
  { id: 'ha_si', name: 'Hạ sĩ', emoji: '🪖', xp: 0, catchBonus: 0 },
  { id: 'trung_si', name: 'Trung sĩ', emoji: '🎖️', xp: 50, catchBonus: 0.05 },
  { id: 'thieu_uy', name: 'Thiếu úy', emoji: '⭐', xp: 140, catchBonus: 0.1 },
  { id: 'trung_uy', name: 'Trung úy', emoji: '⭐⭐', xp: 300, catchBonus: 0.15 },
  { id: 'dai_uy', name: 'Đại úy', emoji: '🏅', xp: 550, catchBonus: 0.2 },
  { id: 'giam_thi', name: 'Giám thị', emoji: '👮', xp: 900, catchBonus: 0.3 },
];

const DAILY_QUESTS = [
  { id: 'd_work', name: 'Ca lao động', desc: 'Làm việc 2 lần hôm nay', stat: 'dayWork', target: 2, xp: 12, money: 20 },
  { id: 'd_sched', name: 'Đúng lịch', desc: 'Có mặt đúng lịch 2 lần', stat: 'daySched', target: 2, xp: 15, money: 15 },
  { id: 'd_game', name: 'Giải trí lành mạnh', desc: 'Thắng 1 mini-game', stat: 'dayWins', target: 1, xp: 10, money: 25 },
  { id: 'd_letter', name: 'Viết thư', desc: 'Gửi 1 lá thư', stat: 'dayLetters', target: 1, xp: 8, money: 10 },
  { id: 'd_perform', name: 'Biểu diễn sân trại', desc: 'Biểu diễn 1 lần (hát/múa/võ…)', stat: 'dayPerform', target: 1, xp: 12, money: 20 },
];

const RANK_QUESTS = [
  { id: 'r_ma_cu', forRank: 'tu_moi', name: 'Làm quen trại', desc: 'Kiếm 40 XP hạng (Tù mới → Ma cũ)', needXp: 40, xp: 5, money: 30 },
  { id: 'r_dai_ca', forRank: 'ma_cu', name: 'Gây tiếng', desc: 'Đạt hạng Đại ca (120 XP)', needXp: 120, xp: 10, money: 50 },
  { id: 'r_trum_buong', forRank: 'dai_ca', name: 'Chủ buồng', desc: 'Đạt Trùm buồng (280 XP)', needXp: 280, xp: 15, money: 80 },
  { id: 'r_trum_khu', forRank: 'trum_buong', name: 'Uy tín khu', desc: 'Đạt Trùm khu vực (550 XP)', needXp: 550, xp: 20, money: 120 },
  { id: 'r_trum_trai', forRank: 'trum_khu', name: 'Ông lớn trại', desc: 'Đạt Trùm trại (950 XP)', needXp: 950, xp: 30, money: 200 },
];

const GUARD_QUESTS = [
  { id: 'gq_patrol', name: 'Tuần tra', desc: 'Tuần tra 3 vòng', stat: 'guardPatrols', target: 3, xp: 15, money: 25 },
  { id: 'gq_catch', name: 'Bắt vượt ngục', desc: 'Bắt 1 tù vượt ngục', stat: 'guardCatches', target: 1, xp: 40, money: 80 },
  { id: 'gq_roll', name: 'Điểm danh', desc: 'Điểm danh 2 lần', stat: 'guardRolls', target: 2, xp: 20, money: 30 },
  { id: 'gq_integrity', name: 'Liêm chính', desc: 'Từ chối hối lộ 1 lần', stat: 'guardRefuseBribes', target: 1, xp: 25, money: 40 },
];

const QUIZ_BANK = [
  { q: 'Ở tù online, vượt ngục nên…?', a: ['Hối lộ rồi leo tường', 'Bay bằng trực thăng', 'Đào hầm bằng thìa'], correct: 0 },
  { q: 'Giờ tắt đèn phải ở đâu?', a: ['Phòng giam của mình', 'Nhà ăn', 'Tường rào'], correct: 0 },
  { q: 'Giờ lao động tập trung ở?', a: ['Sân lao động / Xưởng', 'Bảng thư', 'Phòng ngủ'], correct: 0 },
  { q: 'Ăn cơm trại ở đâu?', a: ['Nhà ăn / Bếp', 'Tường rào', 'Xưởng'], correct: 0 },
  { q: 'Hạng tù cao nhất là?', a: ['Trùm trại', 'Tù mới', 'Ma cũ'], correct: 0 },
  { q: 'Cán bộ từ chối hối lộ được gì?', a: ['Điểm liêm chính', 'Án tăng', 'Mất việc'], correct: 0 },
];

function dayKey(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}

function guardRankFromXp(xp) {
  let cur = GUARD_RANKS[0];
  for (const r of GUARD_RANKS) if ((xp || 0) >= r.xp) cur = r;
  return cur;
}

function nextGuardRank(xp) {
  const cur = guardRankFromXp(xp);
  const i = GUARD_RANKS.findIndex((r) => r.id === cur.id);
  return i >= 0 && i < GUARD_RANKS.length - 1 ? GUARD_RANKS[i + 1] : null;
}

function ensureDaily(p) {
  const k = dayKey();
  if (!p.daily || p.daily.key !== k) {
    p.daily = { key: k, dayWork: 0, daySched: 0, dayWins: 0, dayLetters: 0, dayPerform: 0, claimed: {} };
  }
  return p.daily;
}

function questProgress(p) {
  const d = ensureDaily(p);
  const daily = DAILY_QUESTS.map((q) => ({
    ...q,
    current: d[q.stat] || 0,
    done: (d[q.stat] || 0) >= q.target,
    claimed: !!(d.claimed && d.claimed[q.id]),
  }));
  const rankQ = RANK_QUESTS.filter((q) => {
    // show quest for current rank stepping stone
    return true;
  }).map((q) => {
    const xp = p.rankXp || 0;
    return {
      ...q,
      current: Math.min(xp, q.needXp),
      done: xp >= q.needXp,
      claimed: !!(p.rankQuestClaimed && p.rankQuestClaimed[q.id]),
    };
  });
  const gq = GUARD_QUESTS.map((q) => ({
    ...q,
    current: p[q.stat] || 0,
    done: (p[q.stat] || 0) >= q.target,
    claimed: !!(p.guardQuestClaimed && p.guardQuestClaimed[q.id]),
  }));
  return { daily, rank: rankQ, guard: gq };
}

function cellId(n) {
  return `phong_${n}`;
}

function buildCellRooms(count) {
  const n = Math.max(MIN_CELLS, Math.min(MAX_CELLS, count | 0));
  const cells = [];
  const cols = 8;
  for (let i = 1; i <= n; i++) {
    const col = (i - 1) % cols;
    const row = Math.floor((i - 1) / cols);
    cells.push({
      id: cellId(i),
      name: `Phòng giam ${i}`,
      emoji: '🚪',
      x: -14 + col * 4,
      z: -12 - row * 5,
      cellNo: i,
      capacity: CELL_CAPACITY,
      isCell: true,
    });
  }
  return cells;
}

function commonRooms() {
  return [
    { id: 'san_tap', name: 'Sảnh / Căn tin', emoji: '🍽️', x: 0, z: 0, isCell: false },
    { id: 'nha_bep', name: 'Nhà ăn / Bếp', emoji: '🍳', x: 18, z: 8, isCell: false },
    { id: 'xuong', name: 'Sân lao động / Xưởng', emoji: '🏭', x: -18, z: 8, isCell: false },
    { id: 'tuong_rao', name: 'Sân chơi / Tường rào', emoji: '🏀', x: 0, z: 28, isCell: false },
    { id: 'bang_thu', name: 'Bảng Vinh danh', emoji: '📋', x: -18, z: -2, isCell: false },
    { id: 'san_choi', name: 'Sân bóng / Đố vui', emoji: '🎯', x: 18, z: -2, isCell: false },
  ];
}

function rebuildRooms(cellCount) {
  const cells = buildCellRooms(cellCount);
  const rooms = [...cells, ...commonRooms()];
  const byId = Object.fromEntries(rooms.map((r) => [r.id, r]));
  const graph = {};
  for (const c of cells) {
    graph[c.id] = ['san_tap', 'bang_thu'];
    if (c.cellNo % 2 === 0) graph[c.id].push('nha_bep');
    else graph[c.id].push('xuong');
  }
  graph.san_tap = [...cells.slice(0, Math.min(12, cells.length)).map((c) => c.id), 'nha_bep', 'xuong', 'tuong_rao', 'bang_thu', 'san_choi'];
  graph.nha_bep = ['san_tap', 'bang_thu'];
  graph.xuong = ['san_tap', 'tuong_rao'];
  graph.tuong_rao = ['san_tap', 'xuong', 'san_choi'];
  graph.bang_thu = ['san_tap', 'nha_bep'];
  graph.san_choi = ['san_tap', 'tuong_rao'];
  // link a few neighbor cells
  for (let i = 0; i < cells.length - 1; i++) {
    graph[cells[i].id].push(cells[i + 1].id);
    graph[cells[i + 1].id].push(cells[i].id);
  }
  return { rooms, byId, graph, cells };
}

function neededCellCount(population) {
  return Math.max(MIN_CELLS, Math.min(MAX_CELLS, Math.ceil(Math.max(1, population) / CELL_CAPACITY) + 2));
}

function pickCell(onlineMap, rooms) {
  const cells = rooms.filter((r) => r.isCell);
  const counts = {};
  for (const c of cells) counts[c.id] = 0;
  for (const p of onlineMap.values()) {
    if (p.role === 'guard' || p.escaped || p.released) continue;
    if (counts[p.cellId] != null) counts[p.cellId]++;
    else if (counts[p.room] != null) counts[p.room]++;
  }
  let best = cells[0];
  let bestN = Infinity;
  for (const c of cells) {
    const n = counts[c.id] || 0;
    if (n < c.capacity && n < bestN) {
      best = c;
      bestN = n;
    }
  }
  return best;
}

function scheduleRequiredRoom(phase, p) {
  if (!phase) return null;
  if (phase.id === 'an') return 'nha_bep';
  if (phase.id === 'lao_dong') return 'xuong';
  if (phase.id === 'tat_den') return p.cellId || p.room;
  return phase.roomHint || null;
}

function inRequiredPlace(phase, p) {
  const req = scheduleRequiredRoom(phase, p);
  if (!req) return true;
  if (phase.id === 'tat_den') {
    const cell = p.cellId || (String(p.room || '').startsWith('phong_') ? p.room : null);
    return !!cell && p.room === cell;
  }
  return p.room === req;
}

module.exports = {
  CELL_CAPACITY,
  MIN_CELLS,
  MAX_CELLS,
  GUARD_RANKS,
  DAILY_QUESTS,
  RANK_QUESTS,
  GUARD_QUESTS,
  QUIZ_BANK,
  dayKey,
  guardRankFromXp,
  nextGuardRank,
  ensureDaily,
  questProgress,
  buildCellRooms,
  commonRooms,
  rebuildRooms,
  neededCellCount,
  pickCell,
  scheduleRequiredRoom,
  inRequiredPlace,
};
