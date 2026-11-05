const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3847;
const DATA_FILE = path.join(__dirname, 'data', 'players.json');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, 'public')));

// --- Game config ---
const JOBS = {
  giat_do: {
    id: 'giat_do',
    name: 'Giặt đồ',
    emoji: '👕',
    basePay: 15,
    energyCost: 8,
    cooldownMs: 8000,
    description: 'Giặt quần áo cho trại',
  },
  nau_an: {
    id: 'nau_an',
    name: 'Nấu ăn',
    emoji: '🍲',
    basePay: 25,
    energyCost: 12,
    cooldownMs: 12000,
    description: 'Giúp bếp nấu suất ăn',
  },
  lao_dong: {
    id: 'lao_dong',
    name: 'Lao động nặng',
    emoji: '⛏️',
    basePay: 45,
    energyCost: 20,
    cooldownMs: 18000,
    description: 'Đập đá / dọn sân',
  },
};

const SHOP = {
  giuong: {
    id: 'giuong',
    name: 'Giường tốt hơn',
    emoji: '🛏️',
    price: 80,
    maxLevel: 5,
    description: '+10 máu tối đa / cấp, hồi năng lượng nhanh hơn',
  },
  do_an: {
    id: 'do_an',
    name: 'Suất ăn đặc biệt',
    emoji: '🍖',
    price: 40,
    maxLevel: 10,
    description: '+15 máu & +20 năng lượng ngay (tiêu thụ)',
  },
  cong_cu: {
    id: 'cong_cu',
    name: 'Công cụ lao động',
    emoji: '🔧',
    price: 100,
    maxLevel: 5,
    description: '+15% tiền công / cấp',
  },
  dung_cu_vuot: {
    id: 'dung_cu_vuot',
    name: 'Dụng cụ vượt ngục',
    emoji: '🗝️',
    price: 200,
    maxLevel: 3,
    description: '+12% tỉ lệ vượt ngục / cấp',
  },
};

const ROOMS = [
  { id: 'phong_a', name: 'Phòng A', emoji: '🚪' },
  { id: 'phong_b', name: 'Phòng B', emoji: '🚪' },
  { id: 'nha_bep', name: 'Nhà bếp', emoji: '🍳' },
  { id: 'san_tap', name: 'Sân tập', emoji: '🏃' },
  { id: 'xuong', name: 'Xưởng', emoji: '🏭' },
  { id: 'tuong_rao', name: 'Tường rào', emoji: '🧱' },
];

function defaultPlayer(nickname, socketId) {
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
    joinedAt: Date.now(),
    lastActive: Date.now(),
  };
}

// Persistence
let playersByNick = {}; // nick -> saved stats (survives reconnect)
let online = new Map(); // socketId -> player state
const chatHistory = [];
const MAX_CHAT = 80;

function ensureDataDir() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadData() {
  try {
    ensureDataDir();
    if (fs.existsSync(DATA_FILE)) {
      playersByNick = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Load error', e.message);
    playersByNick = {};
  }
}

function saveData() {
  try {
    ensureDataDir();
    // Merge online into playersByNick
    for (const p of online.values()) {
      playersByNick[p.nickname.toLowerCase()] = stripTransient(p);
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(playersByNick, null, 2));
  } catch (e) {
    console.error('Save error', e.message);
  }
}

function stripTransient(p) {
  const { id, cooldowns, ...rest } = p;
  return { ...rest, cooldowns: {} };
}

loadData();
setInterval(saveData, 15000);

// Regen loop
setInterval(() => {
  for (const p of online.values()) {
    if (p.escaped) continue;
    const bedBonus = (p.upgrades.giuong || 0) * 0.5;
    const energyRegen = 2 + bedBonus;
    const healthRegen = 0.5 + (p.upgrades.giuong || 0) * 0.2;
    p.energy = Math.min(p.maxEnergy, p.energy + energyRegen);
    p.health = Math.min(p.maxHealth, p.health + healthRegen);
    p.lastActive = Date.now();
  }
  broadcastState();
}, 5000);

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
  };
}

function leaderboard() {
  const all = { ...playersByNick };
  for (const p of online.values()) {
    all[p.nickname.toLowerCase()] = stripTransient(p);
  }
  return Object.values(all)
    .map((p) => ({
      nickname: p.nickname,
      money: Math.floor(p.money),
      reputation: p.reputation,
      totalEarned: Math.floor(p.totalEarned || 0),
      escaped: !!p.escaped,
      escapeFails: p.escapeFails || 0,
    }))
    .sort((a, b) => {
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

io.on('connection', (socket) => {
  socket.emit('config', { jobs: JOBS, shop: SHOP, rooms: ROOMS });
  socket.emit('chatHistory', chatHistory);

  socket.on('join', (rawNick) => {
    let nickname = String(rawNick || '')
      .trim()
      .slice(0, 16)
      .replace(/[<>]/g, '');
    if (!nickname || nickname.length < 2) {
      socket.emit('errorMsg', 'Biệt danh phải từ 2–16 ký tự.');
      return;
    }
    // Unique online nick
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
        ...defaultPlayer(nickname, socket.id),
        ...playersByNick[key],
        id: socket.id,
        nickname,
        cooldowns: {},
        escaped: false,
      };
      // restore max health from bed
      p.maxHealth = 100 + (p.upgrades.giuong || 0) * 10;
      p.health = Math.min(p.health, p.maxHealth);
    } else if (playersByNick[key] && playersByNick[key].escaped) {
      // New life after escape — keep nick but reset
      p = defaultPlayer(nickname, socket.id);
      p.reputation = Math.max(0, (playersByNick[key].reputation || 0) - 5);
    } else {
      p = defaultPlayer(nickname, socket.id);
    }

    online.set(socket.id, p);
    playersByNick[key] = stripTransient(p);
    saveData();

    emitSelf(socket, p);
    socket.emit('joined', { nickname: p.nickname });
    pushChat({
      type: 'system',
      text: `${p.nickname} đã vào trại.`,
      ts: Date.now(),
    });
    broadcastState();
  });

  socket.on('move', (roomId) => {
    const p = online.get(socket.id);
    if (!p || p.escaped) return;
    if (!ROOMS.find((r) => r.id === roomId)) return;
    if (p.energy < 3) {
      socket.emit('errorMsg', 'Không đủ năng lượng để di chuyển!');
      return;
    }
    p.energy -= 3;
    p.room = roomId;
    emitSelf(socket, p);
    broadcastState();
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
    socket.emit('buyResult', {
      itemId,
      message: `Đã mua ${item.name} (cấp ${p.upgrades[itemId]}).`,
    });
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
    const base = 8;
    const toolBonus = toolLvl * 12;
    const repBonus = Math.min(15, Math.floor(p.reputation / 20));
    const healthBonus = Math.floor(p.health / 20);
    const failPenalty = p.escapeFails * 3;
    let chance = base + toolBonus + repBonus + healthBonus - failPenalty;
    chance = Math.max(5, Math.min(75, chance));

    p.energy -= 30;
    const roll = Math.random() * 100;
    const success = roll < chance;

    if (success) {
      p.escaped = true;
      p.reputation += 50;
      p.money += 100;
      playersByNick[p.nickname.toLowerCase()] = stripTransient(p);
      saveData();
      socket.emit('escapeResult', {
        success: true,
        chance,
        roll: Math.floor(roll),
        message: `🎉 Vượt ngục thành công! (${Math.floor(roll)} < ${chance}%) Chúc mừng, bạn đã tự do!`,
      });
      pushChat({
        type: 'system',
        text: `🚨 ${p.nickname} đã VƯỢT NGỤC thành công!`,
        ts: Date.now(),
      });
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
        message: `💥 Thất bại! (${Math.floor(roll)} ≥ ${chance}%) Bị bắt lại, -25 máu, -30 tiền, -10 uy tín.`,
      });
      pushChat({
        type: 'system',
        text: `${p.nickname} vượt ngục thất bại và bị đưa về Phòng A.`,
        ts: Date.now(),
      });
      broadcastState();
    }
  });

  socket.on('chat', (text) => {
    const p = online.get(socket.id);
    if (!p) return;
    const msg = String(text || '')
      .trim()
      .slice(0, 200)
      .replace(/[<>]/g, '');
    if (!msg) return;
    pushChat({
      type: 'user',
      nick: p.nickname,
      text: msg,
      ts: Date.now(),
    });
  });

  socket.on('disconnect', () => {
    const p = online.get(socket.id);
    if (p) {
      playersByNick[p.nickname.toLowerCase()] = stripTransient(p);
      online.delete(socket.id);
      pushChat({
        type: 'system',
        text: `${p.nickname} đã rời trại.`,
        ts: Date.now(),
      });
      saveData();
      broadcastState();
    }
  });
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, online: online.size, name: 'Ở tù online' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Ở tù online listening on http://0.0.0.0:${PORT}`);
});
