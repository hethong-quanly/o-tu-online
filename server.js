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
  { id: 'phong_a', name: 'Phòng A', emoji: '🚪' },
  { id: 'phong_b', name: 'Phòng B', emoji: '🚪' },
  { id: 'nha_bep', name: 'Nhà ăn', emoji: '🍽️' },
  { id: 'san_tap', name: 'Sân tập', emoji: '🏃' },
  { id: 'xuong', name: 'Xưởng', emoji: '🏭' },
  { id: 'tuong_rao', name: 'Tường rào', emoji: '🧱' },
];

const ROOM_GRAPH = {
  phong_a: ['phong_b', 'san_tap', 'xuong'],
  phong_b: ['phong_a', 'nha_bep', 'san_tap'],
  nha_bep: ['phong_b', 'san_tap'],
  san_tap: ['phong_a', 'phong_b', 'nha_bep', 'xuong', 'tuong_rao'],
  xuong: ['phong_a', 'san_tap', 'tuong_rao'],
  tuong_rao: ['san_tap', 'xuong'],
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

const SCHEDULE = [
  { id: 'an', name: 'Giờ ăn', emoji: '🍲', roomHint: 'nha_bep', seconds: 45, announce: '📢 Loa trại: Giờ ăn! Tập trung Nhà ăn.' },
  { id: 'tap', name: 'Giờ tập', emoji: '🏋️', roomHint: 'san_tap', seconds: 45, announce: '📢 Loa trại: Giờ tập thể dục trên Sân tập!' },
  { id: 'tat_den', name: 'Tắt đèn', emoji: '🌙', roomHint: 'phong_a', seconds: 45, announce: '📢 Loa trại: Giờ tắt đèn. Về phòng nghỉ.' },
];

function defaultPlayer(nickname, socketId, appearance) {
  return {
    id: socketId,
    nickname,
    money: 50,
    health: 100,
    maxHealth: 100,
    energy: 100,
    maxEnergy: 100,
    reputation: 0,
    room: 'phong_a',
    upgrades: { giuong: 0, cong_cu: 0, dung_cu_vuot: 0 },
    cooldowns: {},
    escaped: false,
    escapeFails: 0,
    totalEarned: 0,
    daysMarked: 0,
    winsCaro: 0,
    winsRps: 0,
    gameWins: 0,
    appearance: normalizeAppearance(appearance),
    emote: null,
    emoteUntil: 0,
    sleeping: false,
    joinedAt: Date.now(),
    lastActive: Date.now(),
  };
}

function normalizeAppearance(a) {
  a = a || {};
  const skin = APPEARANCE.skins.includes(a.skin) ? a.skin : APPEARANCE.skins[0];
  const hair = APPEARANCE.hairs.includes(a.hair) ? a.hair : APPEARANCE.hairs[0];
  const stripe = APPEARANCE.stripes.find((s) => s.id === a.stripe) || APPEARANCE.stripes[0];
  return { skin, hair, stripe: stripe.id };
}

let playersByNick = {};
let online = new Map();
const chatHistory = [];
const MAX_CHAT = 80;
const letters = []; // {id, nick, text, ts}
const MAX_LETTERS = 40;
const invites = new Map(); // inviteId -> {from, to, game, ts}
const matches = new Map(); // matchId -> state

let scheduleIndex = 0;
let scheduleEndsAt = Date.now() + SCHEDULE[0].seconds * 1000;

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
      if (Array.isArray(raw.letters)) {
        letters.push(...raw.letters.slice(-MAX_LETTERS));
      }
    }
  } catch (e) {
    console.error('Load error', e.message);
    playersByNick = {};
  }
}

function saveData() {
  try {
    ensureDataDir();
    for (const p of online.values()) {
      playersByNick[p.nickname.toLowerCase()] = stripTransient(p);
    }
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ players: playersByNick, letters: letters.slice(-MAX_LETTERS) }, null, 2)
    );
  } catch (e) {
    console.error('Save error', e.message);
  }
}

function stripTransient(p) {
  const { id, cooldowns, emote, emoteUntil, sleeping, ...rest } = p;
  return { ...rest, cooldowns: {}, sleeping: false, emote: null };
}

loadData();
setInterval(saveData, 15000);

setInterval(() => {
  for (const p of online.values()) {
    if (p.escaped) continue;
    const bedBonus = (p.upgrades.giuong || 0) * 0.5;
    const sleepBonus = p.sleeping ? 3 : 0;
    p.energy = Math.min(p.maxEnergy, p.energy + 2 + bedBonus + sleepBonus);
    p.health = Math.min(p.maxHealth, p.health + 0.5 + (p.upgrades.giuong || 0) * 0.2 + (p.sleeping ? 1 : 0));
    if (p.emote && Date.now() > p.emoteUntil) p.emote = null;
    p.lastActive = Date.now();
  }
  broadcastState();
}, 5000);

// Schedule loop
setInterval(() => {
  if (Date.now() < scheduleEndsAt) return;
  scheduleIndex = (scheduleIndex + 1) % SCHEDULE.length;
  const phase = SCHEDULE[scheduleIndex];
  scheduleEndsAt = Date.now() + phase.seconds * 1000;
  pushChat({ type: 'system', text: phase.announce, ts: Date.now() });
  // nudge sleeping off when meal/exercise
  if (phase.id !== 'tat_den') {
    for (const p of online.values()) {
      if (p.sleeping) p.sleeping = false;
    }
  }
  broadcastState();
  io.emit('schedule', currentSchedule());
}, 2000);

function currentSchedule() {
  const phase = SCHEDULE[scheduleIndex];
  return {
    id: phase.id,
    name: phase.name,
    emoji: phase.emoji,
    roomHint: phase.roomHint,
    endsAt: scheduleEndsAt,
    announce: phase.announce,
  };
}

function publicPlayer(p) {
  return {
    id: p.id,
    nickname: p.nickname,
    money: Math.floor(p.money),
    health: Math.round(p.health),
    maxHealth: p.maxHealth,
    energy: Math.round(p.energy),
    maxEnergy: p.maxEnergy,
    reputation: p.reputation,
    room: p.room,
    upgrades: p.upgrades,
    escaped: p.escaped,
    escapeFails: p.escapeFails,
    totalEarned: Math.floor(p.totalEarned),
    cooldowns: p.cooldowns,
    daysMarked: p.daysMarked || 0,
    winsCaro: p.winsCaro || 0,
    winsRps: p.winsRps || 0,
    gameWins: p.gameWins || 0,
    appearance: p.appearance || normalizeAppearance(null),
    emote: p.emote && Date.now() < p.emoteUntil ? p.emote : null,
    sleeping: !!p.sleeping,
  };
}

function leaderboard() {
  const all = { ...playersByNick };
  for (const p of online.values()) all[p.nickname.toLowerCase()] = stripTransient(p);
  return Object.values(all)
    .map((p) => ({
      nickname: p.nickname,
      money: Math.floor(p.money),
      reputation: p.reputation,
      totalEarned: Math.floor(p.totalEarned || 0),
      gameWins: p.gameWins || 0,
      winsCaro: p.winsCaro || 0,
      winsRps: p.winsRps || 0,
      daysMarked: p.daysMarked || 0,
      escaped: !!p.escaped,
      escapeFails: p.escapeFails || 0,
    }))
    .sort((a, b) => {
      if (b.gameWins !== a.gameWins) return b.gameWins - a.gameWins;
      if (a.escaped !== b.escaped) return a.escaped ? -1 : 1;
      return b.totalEarned - a.totalEarned || b.money - a.money;
    })
    .slice(0, 20);
}

function roomCounts() {
  const counts = {};
  for (const r of ROOMS) counts[r.id] = 0;
  for (const p of online.values()) {
    if (!p.escaped && counts[p.room] !== undefined) counts[p.room]++;
  }
  return counts;
}

function broadcastState() {
  const list = [...online.values()].filter((p) => !p.escaped).map(publicPlayer);
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

function uid() {
  return crypto.randomBytes(6).toString('hex');
}

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
  // prefer block/win near last, else random empty
  const empties = [];
  for (let y = 0; y < 15; y++) for (let x = 0; x < 15; x++) if (!board[y][x]) empties.push([x, y]);
  if (!empties.length) return null;
  // try win
  for (const [x, y] of empties) {
    board[y][x] = 2;
    const w = checkCaroWin(board, x, y, 2);
    board[y][x] = 0;
    if (w) return [x, y];
  }
  // try block
  for (const [x, y] of empties) {
    board[y][x] = 1;
    const w = checkCaroWin(board, x, y, 1);
    board[y][x] = 0;
    if (w) return [x, y];
  }
  // center bias
  empties.sort((a, b) => {
    const da = Math.abs(a[0] - 7) + Math.abs(a[1] - 7);
    const db = Math.abs(b[0] - 7) + Math.abs(b[1] - 7);
    return da - db;
  });
  return empties[Math.floor(Math.random() * Math.min(8, empties.length))];
}

function awardWin(p, kind) {
  if (kind === 'caro') p.winsCaro = (p.winsCaro || 0) + 1;
  if (kind === 'rps') p.winsRps = (p.winsRps || 0) + 1;
  p.gameWins = (p.gameWins || 0) + 1;
  p.reputation += 3;
  p.money += 10;
  p.totalEarned += 10;
}

function publicMatch(m) {
  return {
    id: m.id,
    game: m.game,
    vsNpc: m.vsNpc,
    status: m.status,
    players: m.players.map((pid) => {
      const pl = online.get(pid);
      return { id: pid, nick: pl ? pl.nickname : '?' };
    }),
    youAre: null,
    board: m.board || null,
    turn: m.turn,
    turnEndsAt: m.turnEndsAt,
    scores: m.scores || null,
    lastRound: m.lastRound || null,
    winnerId: m.winnerId || null,
    message: m.message || '',
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
    jobs: JOBS,
    shop: SHOP,
    rooms: ROOMS,
    appearance: APPEARANCE,
    roomGraph: ROOM_GRAPH,
    schedule: currentSchedule(),
  });
  socket.emit('chatHistory', chatHistory);
  socket.emit('schedule', currentSchedule());
  socket.emit('letters', letters.slice(-20).reverse());

  socket.on('join', (payload) => {
    let nickname, appearance;
    if (typeof payload === 'string') {
      nickname = payload;
      appearance = null;
    } else {
      nickname = payload && payload.nickname;
      appearance = payload && payload.appearance;
    }
    nickname = String(nickname || '')
      .trim()
      .slice(0, 16)
      .replace(/[<>]/g, '');
    if (!nickname || nickname.length < 2) {
      socket.emit('errorMsg', 'Biệt danh phải từ 2–16 ký tự.');
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
    if (playersByNick[key] && !playersByNick[key].escaped) {
      p = {
        ...defaultPlayer(nickname, socket.id, appearance || playersByNick[key].appearance),
        ...playersByNick[key],
        id: socket.id,
        nickname,
        cooldowns: {},
        escaped: false,
        emote: null,
        sleeping: false,
      };
      if (appearance) p.appearance = normalizeAppearance(appearance);
      else p.appearance = normalizeAppearance(p.appearance);
      p.maxHealth = 100 + (p.upgrades.giuong || 0) * 10;
      p.health = Math.min(p.health, p.maxHealth);
    } else if (playersByNick[key] && playersByNick[key].escaped) {
      p = defaultPlayer(nickname, socket.id, appearance);
      p.reputation = Math.max(0, (playersByNick[key].reputation || 0) - 5);
      p.gameWins = playersByNick[key].gameWins || 0;
      p.winsCaro = playersByNick[key].winsCaro || 0;
      p.winsRps = playersByNick[key].winsRps || 0;
    } else {
      p = defaultPlayer(nickname, socket.id, appearance);
    }

    online.set(socket.id, p);
    playersByNick[key] = stripTransient(p);
    saveData();
    emitSelf(socket, p);
    socket.emit('joined', { nickname: p.nickname, appearance: p.appearance });
    pushChat({ type: 'system', text: `${p.nickname} đã vào trại.`, ts: Date.now() });
    broadcastState();
  });

  socket.on('move', (roomId) => {
    const p = online.get(socket.id);
    if (!p || p.escaped) return;
    if (!ROOMS.find((r) => r.id === roomId)) return;
    if (p.sleeping) p.sleeping = false;
    if (p.energy < 3) {
      socket.emit('errorMsg', 'Không đủ năng lượng để di chuyển!');
      return;
    }
    p.energy -= 3;
    p.room = roomId;
    emitSelf(socket, p);
    broadcastState();
  });

  socket.on('action', (kind) => {
    const p = online.get(socket.id);
    if (!p || p.escaped) return;
    const now = Date.now();
    if (kind === 'sit') {
      if (p.room !== 'nha_bep') {
        socket.emit('errorMsg', 'Phải ở Nhà ăn mới ngồi được.');
        return;
      }
      setEmote(p, 'sit', 12000);
      socket.emit('actionResult', { kind, message: 'Bạn ngồi ghế gần nhất trong Nhà ăn.' });
    } else if (kind === 'pushup') {
      if (p.energy < 5) {
        socket.emit('errorMsg', 'Không đủ năng lượng để hít đất.');
        return;
      }
      p.energy -= 5;
      setEmote(p, 'pushup', 8000);
      socket.emit('actionResult', { kind, message: 'Hít đất! (không tăng sức mạnh — chỉ tập luyện)' });
    } else if (kind === 'wave') {
      setEmote(p, 'wave', 5000);
      pushChat({ type: 'system', text: `${p.nickname} vẫy tay chào mọi người.`, ts: now });
      socket.emit('actionResult', { kind, message: 'Bạn vẫy tay chào.' });
    } else if (kind === 'mark_day') {
      if (!p.room.startsWith('phong')) {
        socket.emit('errorMsg', 'Chỉ đánh dấu ngày khi ở phòng giam.');
        return;
      }
      const cd = p.cooldowns.mark_day || 0;
      if (cd > now) {
        socket.emit('errorMsg', 'Hôm nay bạn đã gạch rồi. Đợi một chút…');
        return;
      }
      p.daysMarked = (p.daysMarked || 0) + 1;
      p.cooldowns.mark_day = now + 60000;
      setEmote(p, 'mark', 4000);
      socket.emit('actionResult', { kind, message: `Gạch thêm 1 ngày lên tường. Tổng: ${p.daysMarked} ngày.` });
    } else if (kind === 'sleep') {
      p.room = p.room.startsWith('phong') ? p.room : 'phong_a';
      setEmote(p, 'sleep', 60000);
      socket.emit('actionResult', { kind, message: 'Về phòng nghỉ… Zzz' });
    } else if (kind === 'wake') {
      p.sleeping = false;
      p.emote = null;
      socket.emit('actionResult', { kind, message: 'Bạn thức dậy.' });
    } else {
      return;
    }
    emitSelf(socket, p);
    broadcastState();
  });

  socket.on('writeLetter', (text) => {
    const p = online.get(socket.id);
    if (!p || p.escaped) return;
    const msg = String(text || '').trim().slice(0, 160).replace(/[<>]/g, '');
    if (msg.length < 2) {
      socket.emit('errorMsg', 'Thư quá ngắn.');
      return;
    }
    const entry = { id: uid(), nick: p.nickname, text: msg, ts: Date.now() };
    letters.push(entry);
    if (letters.length > MAX_LETTERS) letters.shift();
    setEmote(p, 'write', 5000);
    pushChat({ type: 'system', text: `✉️ ${p.nickname} gửi thư về nhà — đã ghim lên Bảng Thư.`, ts: Date.now() });
    io.emit('letters', letters.slice(-20).reverse());
    socket.emit('actionResult', { kind: 'letter', message: 'Thư đã được ghim lên Bảng Thư cạnh bàn trực quản trại.' });
    emitSelf(socket, p);
    broadcastState();
    saveData();
  });

  socket.on('work', (jobId) => {
    const p = online.get(socket.id);
    if (!p || p.escaped) return;
    const job = JOBS[jobId];
    if (!job) return;
    const now = Date.now();
    if (p.cooldowns[jobId] && p.cooldowns[jobId] > now) {
      socket.emit('errorMsg', `Chưa hết thời gian chờ ${job.name}.`);
      return;
    }
    if (p.energy < job.energyCost) {
      socket.emit('errorMsg', 'Không đủ năng lượng! Nghỉ hoặc mua đồ ăn.');
      return;
    }
    p.sleeping = false;
    const toolBonus = 1 + (p.upgrades.cong_cu || 0) * 0.15;
    const pay = Math.floor(job.basePay * toolBonus * (0.9 + Math.random() * 0.2));
    p.energy -= job.energyCost;
    p.money += pay;
    p.totalEarned += pay;
    p.reputation += 1;
    p.health = Math.max(10, p.health - Math.floor(job.energyCost / 4));
    p.cooldowns[jobId] = now + job.cooldownMs;
    emitSelf(socket, p);
    socket.emit('workResult', { jobId, pay, jobName: job.name });
    broadcastState();
  });

  socket.on('buy', (itemId) => {
    const p = online.get(socket.id);
    if (!p || p.escaped) return;
    const item = SHOP[itemId];
    if (!item) return;
    if (itemId === 'do_an') {
      if (p.money < item.price) {
        socket.emit('errorMsg', 'Không đủ tiền!');
        return;
      }
      p.money -= item.price;
      p.health = Math.min(p.maxHealth, p.health + 15);
      p.energy = Math.min(p.maxEnergy, p.energy + 20);
      emitSelf(socket, p);
      socket.emit('buyResult', { itemId, message: 'Bạn đã ăn suất đặc biệt. +15 máu, +20 năng lượng.' });
      broadcastState();
      return;
    }
    const level = p.upgrades[itemId] || 0;
    if (level >= item.maxLevel) {
      socket.emit('errorMsg', 'Đã nâng cấp tối đa!');
      return;
    }
    const price = item.price * (level + 1);
    if (p.money < price) {
      socket.emit('errorMsg', 'Không đủ tiền!');
      return;
    }
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
    if (!p || p.escaped) return;
    if (p.room !== 'tuong_rao') {
      socket.emit('errorMsg', 'Phải đến Tường rào mới vượt ngục được!');
      return;
    }
    if (p.energy < 30) {
      socket.emit('errorMsg', 'Cần ít nhất 30 năng lượng để vượt ngục.');
      return;
    }
    if (p.health < 20) {
      socket.emit('errorMsg', 'Sức khỏe quá yếu để vượt ngục.');
      return;
    }
    const toolLvl = p.upgrades.dung_cu_vuot || 0;
    let chance = 8 + toolLvl * 12 + Math.min(15, Math.floor(p.reputation / 20)) + Math.floor(p.health / 20) - p.escapeFails * 3;
    chance = Math.max(5, Math.min(75, chance));
    p.energy -= 30;
    const roll = Math.random() * 100;
    if (roll < chance) {
      p.escaped = true;
      p.reputation += 50;
      p.money += 100;
      playersByNick[p.nickname.toLowerCase()] = stripTransient(p);
      saveData();
      socket.emit('escapeResult', {
        success: true,
        chance,
        roll: Math.floor(roll),
        message: `🎉 Vượt ngục thành công! (${Math.floor(roll)} < ${chance}%)`,
      });
      pushChat({ type: 'system', text: `🚨 ${p.nickname} đã VƯỢT NGỤC thành công!`, ts: Date.now() });
      emitSelf(socket, p);
      broadcastState();
      setTimeout(() => {
        online.delete(socket.id);
        broadcastState();
      }, 2000);
    } else {
      p.escapeFails += 1;
      p.health = Math.max(5, p.health - 25);
      p.money = Math.max(0, p.money - 30);
      p.reputation = Math.max(0, p.reputation - 10);
      p.room = 'phong_a';
      emitSelf(socket, p);
      socket.emit('escapeResult', {
        success: false,
        chance,
        roll: Math.floor(roll),
        message: `💥 Thất bại! (${Math.floor(roll)} ≥ ${chance}%) Bị bắt lại.`,
      });
      pushChat({ type: 'system', text: `${p.nickname} vượt ngục thất bại và bị đưa về Phòng A.`, ts: Date.now() });
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

  // --- Mini-games ---
  socket.on('startGame', (payload) => {
    const p = online.get(socket.id);
    if (!p || p.escaped) return;
    const game = payload && payload.game;
    const vs = payload && payload.vs;
    if (game !== 'caro' && game !== 'rps') return;

    if (vs === 'npc') {
      const m = {
        id: uid(),
        game,
        vsNpc: true,
        status: 'playing',
        players: [socket.id],
        board: game === 'caro' ? emptyCaro() : null,
        turn: 1,
        turnEndsAt: Date.now() + 30000,
        scores: game === 'rps' ? { 1: 0, 2: 0 } : null,
        choices: game === 'rps' ? {} : null,
        round: 1,
        winnerId: null,
        message: game === 'caro' ? 'Cờ Caro vs Quản giáo (NPC). Bạn đi trước (X).' : 'Kéo Búa Bao BO3 vs Quản giáo.',
      };
      matches.set(m.id, m);
      emitMatch(m);
      return;
    }

    if (vs === 'invite') {
      const targetId = payload.targetId;
      const target = online.get(targetId);
      if (!target || targetId === socket.id) {
        socket.emit('errorMsg', 'Không tìm thấy người chơi để mời.');
        return;
      }
      const inv = { id: uid(), from: socket.id, to: targetId, game, ts: Date.now() };
      invites.set(inv.id, inv);
      const tSock = [...io.sockets.sockets.values()].find((s) => s.id === targetId);
      if (tSock) {
        tSock.emit('gameInvite', {
          id: inv.id,
          game,
          fromId: socket.id,
          fromNick: p.nickname,
        });
      }
      socket.emit('actionResult', { kind: 'invite', message: `Đã gửi lời mời ${game === 'caro' ? 'Cờ Caro' : 'Kéo Búa Bao'} tới ${target.nickname}.` });
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
      id: uid(),
      game: inv.game,
      vsNpc: false,
      status: 'playing',
      players: [inv.from, inv.to],
      board: inv.game === 'caro' ? emptyCaro() : null,
      turn: 1,
      turnEndsAt: Date.now() + 30000,
      scores: inv.game === 'rps' ? { 1: 0, 2: 0 } : null,
      choices: inv.game === 'rps' ? {} : null,
      round: 1,
      winnerId: null,
      message: 'Trận đấu bắt đầu!',
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
    if (m.turn !== seat) {
      socket.emit('errorMsg', 'Chưa tới lượt bạn.');
      return;
    }
    const x = payload.x | 0;
    const y = payload.y | 0;
    if (x < 0 || y < 0 || x > 14 || y > 14 || m.board[y][x]) return;
    m.board[y][x] = seat;
    if (checkCaroWin(m.board, x, y, seat)) {
      m.status = 'ended';
      m.winnerId = socket.id;
      m.message = `${p.nickname} thắng Cờ Caro! +10₫ +3⭐`;
      awardWin(p, 'caro');
      emitSelf(socket, p);
      emitMatch(m);
      broadcastState();
      pushChat({ type: 'system', text: `🏆 ${p.nickname} thắng Cờ Caro.`, ts: Date.now() });
      return;
    }
    // draw?
    if (m.board.every((row) => row.every((c) => c))) {
      m.status = 'ended';
      m.message = 'Hòa!';
      emitMatch(m);
      return;
    }
    if (m.vsNpc) {
      m.turn = 2;
      emitMatch(m);
      const mv = caroNpcMove(m.board);
      if (mv) {
        m.board[mv[1]][mv[0]] = 2;
        if (checkCaroWin(m.board, mv[0], mv[1], 2)) {
          m.status = 'ended';
          m.winnerId = 'npc';
          m.message = 'Quản giáo (NPC) thắng. Thử lại nhé!';
          emitMatch(m);
          return;
        }
      }
      m.turn = 1;
      m.turnEndsAt = Date.now() + 30000;
      emitMatch(m);
    } else {
      m.turn = seat === 1 ? 2 : 1;
      m.turnEndsAt = Date.now() + 30000;
      emitMatch(m);
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
      const npc = ['rock', 'paper', 'scissors'][Math.floor(Math.random() * 3)];
      resolveRpsRound(m, socket.id, choice, 'npc', npc);
      return;
    }
    if (Object.keys(m.choices).length < 2) {
      emitMatch(m);
      return;
    }
    const [a, b] = m.players;
    resolveRpsRound(m, a, m.choices[a], b, m.choices[b]);
  });

  function resolveRpsRound(m, idA, cA, idB, cB) {
    const beats = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
    let winner = null;
    if (cA === cB) winner = null;
    else if (beats[cA] === cB) winner = idA;
    else winner = idB;

    const seatA = 1;
    const seatB = 2;
    if (winner === idA) m.scores[seatA]++;
    else if (winner === idB) m.scores[seatB]++;

    const label = { rock: 'Búa', paper: 'Bao', scissors: 'Kéo' };
    m.lastRound = {
      a: { id: idA, choice: cA, label: label[cA] },
      b: { id: idB, choice: cB, label: label[cB] },
      winner,
    };
    m.choices = {};
    m.round++;

    if (m.scores[1] >= 2 || m.scores[2] >= 2) {
      m.status = 'ended';
      if (m.scores[1] >= 2) {
        m.winnerId = m.players[0];
        const wp = online.get(m.players[0]);
        if (wp) {
          awardWin(wp, 'rps');
          const sock = [...io.sockets.sockets.values()].find((s) => s.id === m.players[0]);
          if (sock) emitSelf(sock, wp);
        }
        m.message = `${wp ? wp.nickname : 'P1'} thắng BO3! +10₫`;
      } else if (m.vsNpc) {
        m.winnerId = 'npc';
        m.message = 'Quản giáo thắng BO3.';
      } else {
        m.winnerId = m.players[1];
        const wp = online.get(m.players[1]);
        if (wp) {
          awardWin(wp, 'rps');
          const sock = [...io.sockets.sockets.values()].find((s) => s.id === m.players[1]);
          if (sock) emitSelf(sock, wp);
        }
        m.message = `${wp ? wp.nickname : 'P2'} thắng BO3! +10₫`;
      }
      if (m.winnerId && m.winnerId !== 'npc') {
        const wp = online.get(m.winnerId);
        if (wp) pushChat({ type: 'system', text: `🏆 ${wp.nickname} thắng Kéo Búa Bao.`, ts: Date.now() });
      }
      broadcastState();
    } else {
      m.message = winner
        ? `Ván ${m.round - 1}: ${winner === 'npc' ? 'NPC' : (online.get(winner) || {}).nickname || '?'} thắng ván.`
        : `Ván ${m.round - 1}: Hòa.`;
    }
    emitMatch(m);
  }

  socket.on('closeMatch', (payload) => {
    const m = matches.get(payload && payload.matchId);
    if (!m) return;
    if (!m.players.includes(socket.id)) return;
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
        m.status = 'ended';
        m.message = 'Đối thủ đã thoát.';
        emitMatch(m);
        matches.delete(id);
      }
    }
  });
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, online: online.size, name: 'Ở tù online' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Ở tù online listening on http://0.0.0.0:${PORT}`);
});
