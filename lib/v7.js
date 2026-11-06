'use strict';

const v6 = require('./v6');

const CELL_CAPACITY = 10;
const MIN_CELLS = 16;
const MAX_CELLS = 240;
const INTAKE_NEED_MS = 120 * 1000; // 120s tạm giam (v13)
const CHAT_CREDIT_MS = 0; // v13: chat không cộng dồn; dùng cắt thời gian talk/exercise/gift
const TALK_TICK_MS = 1000;

const ZONES = [
  { id: 'quarantine', name: 'Khu tạm giam', emoji: '🚧', x: -42, z: -8, w: 22, d: 20, color: '#c45a2a' },
  { id: 'general', name: 'Khu phân trại', emoji: '🏢', x: 0, z: -18, w: 48, d: 28, color: '#4a6a9a' },
  { id: 'kitchen', name: 'Khu nhà bếp', emoji: '🍳', x: 28, z: 10, w: 16, d: 14, color: '#b07040' },
  { id: 'canteen', name: 'Khu căn tin', emoji: '🍽️', x: 0, z: 2, w: 28, d: 16, color: '#6a8aaa' },
  { id: 'labor', name: 'Khu lao động', emoji: '🏭', x: -30, z: 14, w: 24, d: 22, color: '#6a7a50' },
  { id: 'yard', name: 'Sân chơi / Tường rào', emoji: '🏀', x: 0, z: 32, w: 30, d: 20, color: '#c45a2a' },
  { id: 'happiness', name: 'Phòng hạnh phúc', emoji: '🏠', x: 36, z: -8, w: 12, d: 12, color: '#d4a0c0' },
];

const LABOR_JOBS = {
  thu_hoach: {
    id: 'thu_hoach', name: 'Thu hoạch rau củ', emoji: '🥬', basePay: 28, energyCost: 10,
    cooldownMs: 10000, room: 'vuon_rau', anim: 'work',
    description: 'Hái rau củ tại vườn lao động',
  },
  may_do: {
    id: 'may_do', name: 'May quần áo', emoji: '🧵', basePay: 32, energyCost: 12,
    cooldownMs: 12000, room: 'xuong_may', anim: 'sew',
    description: 'May vá đồng phục tại xưởng may',
  },
  moc: {
    id: 'moc', name: 'Đóng tủ / bàn / ghế', emoji: '🪚', basePay: 40, energyCost: 16,
    cooldownMs: 15000, room: 'xuong_moc', anim: 'hammer',
    description: 'Mộc: đóng tủ, bàn, ghế',
  },
};

function cellId(n) {
  return `phong_${n}`;
}

function buildCellRooms(count) {
  const n = Math.max(MIN_CELLS, Math.min(MAX_CELLS, count | 0));
  const cells = [];
  const cols = 10;
  for (let i = 1; i <= n; i++) {
    const col = (i - 1) % cols;
    const row = Math.floor((i - 1) / cols);
    const block = Math.floor(row / 3); // every 3 rows a visual block offset
    cells.push({
      id: cellId(i),
      name: `Phòng giam ${i}`,
      emoji: '🚪',
      x: -22 + col * 4.4 + (block % 2) * 0.5,
      z: -28 - (row % 3) * 4.2 - Math.floor(row / 3) * 14,
      cellNo: i,
      capacity: CELL_CAPACITY,
      isCell: true,
      zone: 'general',
    });
  }
  return cells;
}

function commonRooms() {
  return [
    { id: 'khu_tam_giam', name: 'Khu tạm giam', emoji: '🚧', x: -42, z: -8, isCell: false, zone: 'quarantine' },
    { id: 'san_tap', name: 'Sảnh phân trại', emoji: '🏛️', x: 0, z: -6, isCell: false, zone: 'general' },
    { id: 'nha_bep', name: 'Khu nhà bếp', emoji: '🍳', x: 28, z: 10, isCell: false, zone: 'kitchen' },
    { id: 'can_tin', name: 'Khu căn tin', emoji: '🍽️', x: 6, z: 4, isCell: false, zone: 'canteen' },
    { id: 'xuong', name: 'Sân lao động', emoji: '🏭', x: -28, z: 12, isCell: false, zone: 'labor' },
    { id: 'vuon_rau', name: 'Vườn rau củ', emoji: '🥬', x: -34, z: 20, isCell: false, zone: 'labor' },
    { id: 'xuong_may', name: 'Xưởng may', emoji: '🧵', x: -22, z: 18, isCell: false, zone: 'labor' },
    { id: 'xuong_moc', name: 'Xưởng mộc', emoji: '🪚', x: -30, z: 8, isCell: false, zone: 'labor' },
    { id: 'tuong_rao', name: 'Sân chơi / Tường rào', emoji: '🏀', x: 0, z: 32, isCell: false, zone: 'yard' },
    { id: 'bang_thu', name: 'Bảng Vinh danh', emoji: '📋', x: -16, z: -4, isCell: false, zone: 'general' },
    { id: 'san_choi', name: 'Sân bóng / Đố vui', emoji: '🎯', x: 14, z: -2, isCell: false, zone: 'general' },
    { id: 'phong_hanh_phuc', name: 'Phòng hạnh phúc', emoji: '🏠', x: 36, z: -8, isCell: false, zone: 'happiness' },
  ];
}

function rebuildRooms(cellCount) {
  const cells = buildCellRooms(cellCount);
  const rooms = [...cells, ...commonRooms()];
  const byId = Object.fromEntries(rooms.map((r) => [r.id, r]));
  const graph = {};
  const cellIds = cells.map((c) => c.id);
  for (const c of cells) {
    graph[c.id] = ['san_tap', 'bang_thu', 'can_tin'];
    if (c.cellNo % 2 === 0) graph[c.id].push('nha_bep');
    else graph[c.id].push('xuong');
  }
  graph.khu_tam_giam = []; // locked until intake done
  graph.san_tap = [
    ...cellIds.slice(0, Math.min(20, cellIds.length)),
    'nha_bep', 'can_tin', 'xuong', 'tuong_rao', 'bang_thu', 'san_choi', 'vuon_rau', 'xuong_may', 'xuong_moc',
  ];
  graph.nha_bep = ['san_tap', 'can_tin', 'bang_thu'];
  graph.can_tin = ['san_tap', 'nha_bep', 'san_choi'];
  graph.xuong = ['san_tap', 'vuon_rau', 'xuong_may', 'xuong_moc', 'tuong_rao'];
  graph.vuon_rau = ['xuong', 'xuong_may'];
  graph.xuong_may = ['xuong', 'vuon_rau', 'xuong_moc'];
  graph.xuong_moc = ['xuong', 'xuong_may'];
  graph.tuong_rao = ['san_tap', 'xuong', 'san_choi'];
  graph.bang_thu = ['san_tap', 'nha_bep', 'phong_hanh_phuc'];
  graph.san_choi = ['san_tap', 'tuong_rao', 'can_tin'];
  graph.phong_hanh_phuc = ['bang_thu', 'san_tap'];
  for (let i = 0; i < cells.length - 1; i++) {
    graph[cells[i].id].push(cells[i + 1].id);
    graph[cells[i + 1].id].push(cells[i].id);
  }
  return { rooms, byId, graph, cells, zones: ZONES };
}

function neededCellCount(population) {
  return Math.max(MIN_CELLS, Math.min(MAX_CELLS, Math.ceil(Math.max(1, population) / CELL_CAPACITY) + 4));
}

function pickCell(onlineMap, rooms) {
  return v6.pickCell(onlineMap, rooms);
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
  if (p.zone === 'quarantine') return true; // exempt during intake
  if (phase.id === 'tat_den') {
    const cell = p.cellId || (String(p.room || '').startsWith('phong_') ? p.room : null);
    return !!cell && p.room === cell;
  }
  if (phase.id === 'lao_dong') {
    return ['xuong', 'vuon_rau', 'xuong_may', 'xuong_moc'].includes(p.room);
  }
  if (phase.id === 'an') {
    return p.room === 'nha_bep' || p.room === 'can_tin';
  }
  return p.room === req;
}

function questsCompletePct(p) {
  const q = v6.questProgress(p);
  const all = [...(q.daily || []), ...(q.rank || [])];
  if (!all.length) return 0;
  const claimed = all.filter((x) => x.claimed).length;
  return Math.round((100 * claimed) / all.length);
}

function happinessUnlocked(p) {
  return questsCompletePct(p) >= 100 || !!p.happinessUnlocked;
}

function clampPosForZone(p, x, z) {
  if (p.role === 'guard' || p.zone !== 'quarantine') {
    return {
      x: Math.max(-55, Math.min(50, x)),
      z: Math.max(-55, Math.min(48, z)),
    };
  }
  // quarantine bounds around khu_tam_giam
  return {
    x: Math.max(-52, Math.min(-32, x)),
    z: Math.max(-18, Math.min(2, z)),
  };
}

function ensureIntake(p) {
  if (p.role === 'guard') {
    p.zone = 'general';
    p.intakeDone = true;
    return p;
  }
  if (p.intakeDone) {
    p.zone = p.zone === 'quarantine' ? 'general' : (p.zone || 'general');
    return p;
  }
  if (p.intakeChatMs == null) p.intakeChatMs = 0;
  p.zone = 'quarantine';
  return p;
}

function creditIntake(p, ms, socket, ioPush) {
  if (!p || p.intakeDone || p.role === 'guard') return false;
  p.intakeChatMs = Math.min(INTAKE_NEED_MS, (p.intakeChatMs || 0) + ms);
  if (p.intakeChatMs >= INTAKE_NEED_MS) {
    p.intakeDone = true;
    p.zone = 'general';
    p.happinessUnlocked = happinessUnlocked(p);
    // transfer to assigned cell in phân trại
    if (p.cellId) {
      p.room = p.cellId;
    } else {
      p.room = 'san_tap';
    }
    if (socket) {
      socket.emit('intakeDone', {
        message: '✅ Hoàn thành tiếp nhận! Bạn được chuyển sang Khu phân trại — được đi lại tự do.',
        intakeChatMs: p.intakeChatMs,
      });
      socket.emit('errorMsg', '📢 Quản giáo: Phạm nhân ' + p.nickname + ' đã hoàn tất khu tạm giam.');
    }
    if (typeof ioPush === 'function') {
      ioPush({ type: 'system', text: `📢 ${p.nickname} hoàn thành nhiệm vụ tiếp nhận → Khu phân trại.`, ts: Date.now() });
    }
    return true;
  }
  return false;
}

module.exports = {
  ...v6,
  CELL_CAPACITY,
  MIN_CELLS,
  MAX_CELLS,
  INTAKE_NEED_MS,
  CHAT_CREDIT_MS,
  TALK_TICK_MS,
  ZONES,
  LABOR_JOBS,
  buildCellRooms,
  commonRooms,
  rebuildRooms,
  neededCellCount,
  pickCell,
  scheduleRequiredRoom,
  inRequiredPlace,
  questsCompletePct,
  happinessUnlocked,
  clampPosForZone,
  ensureIntake,
  creditIntake,
};
