(() => {
  const socket = io();
  let me = null;
  let config = { jobs: {}, shop: {}, rooms: [], guards: [] };
  let world = { players: [], roomCounts: {}, leaderboard: [], onlineCount: 0 };
  let sideMode = null;

  const $ = (s) => document.querySelector(s);
  const canvas = $('#yard');
  const ctx = canvas.getContext('2d');

  // Camera / map
  const MAP = { w: 1200, h: 800 };
  const camera = { x: 0, y: 0, scale: 1 };
  let dragging = false;
  let dragLast = null;

  // Room layout on yard (world coords)
  const ROOM_RECTS = {
    phong_a: { x: 40, y: 60, w: 280, h: 220, label: 'Phòng A', color: '#3a2e24' },
    phong_b: { x: 360, y: 60, w: 280, h: 220, label: 'Phòng B', color: '#3a2e24' },
    nha_bep: { x: 680, y: 60, w: 280, h: 220, label: 'Nhà bếp', color: '#3d3220' },
    san_tap: { x: 200, y: 320, w: 600, h: 260, label: 'Sân tập', color: '#2c3424' },
    xuong: { x: 40, y: 620, w: 400, h: 140, label: 'Xưởng', color: '#2f2a28' },
    tuong_rao: { x: 480, y: 620, w: 480, h: 140, label: 'Tường rào', color: '#3a2824' },
  };

  // Guard NPCs (visual + flavor; client-side patrol)
  const guards = [
    { id: 'g1', name: 'Quản trại A', x: 420, y: 420, facing: 1, phase: 0, path: [[350, 400], [700, 400], [700, 500], [350, 500]] },
    { id: 'g2', name: 'Quản trại B', x: 700, y: 680, facing: -1, phase: 1.7, path: [[520, 680], [900, 680], [900, 720], [520, 720]] },
  ];

  const playerPos = new Map(); // id -> {x,y,facing,tx,ty}

  function showToast(msg, isErr) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.toggle('err', !!isErr);
    t.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => t.classList.remove('show'), 3500);
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // --- Join ---
  const nickInput = $('#nick');
  nickInput.addEventListener('input', () => {
    $('#nick-dem').textContent = `${nickInput.value.length}/16`;
  });
  $('#btn-join').onclick = () => {
    $('#join-error').textContent = '';
    socket.emit('join', nickInput.value);
  };
  nickInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#btn-join').click();
  });

  $('#btn-replay').onclick = () => location.reload();

  // Panels
  document.querySelectorAll('[data-open]').forEach((btn) => {
    btn.onclick = () => openSide(btn.dataset.open);
  });
  $('#btn-panel-stats').onclick = () => openSide('stats');
  $('#btn-panel-chat').onclick = () => openSide('chat');
  $('#side-x').onclick = () => closeSide();
  $('#btn-escape').onclick = () => socket.emit('escape');

  function openSide(mode) {
    sideMode = mode;
    const bang = $('#sidebang');
    bang.hidden = false;
    const titles = {
      jobs: ['Làm việc', 'Kiếm tiền, tốn năng lượng, có thời gian chờ.'],
      shop: ['Cửa hàng', 'Nâng cấp giường, công cụ, dụng cụ vượt ngục.'],
      board: ['Bảng xếp hạng', 'Ai kiếm nhiều / vượt thành công.'],
      chat: ['Chat toàn trại', 'Nói chuyện với tù nhân khác.'],
      stats: ['Trạng thái', 'Chỉ số của bạn.'],
      help: ['Gợi ý', 'Cách chơi nhanh.'],
    };
    const [tt, ph] = titles[mode] || ['—', ''];
    $('#side-title').textContent = tt;
    $('#side-phu').textContent = ph;
    renderSide();
  }
  function closeSide() {
    sideMode = null;
    $('#sidebang').hidden = true;
  }

  function renderSide() {
    if (!sideMode) return;
    const body = $('#side-body');
    if (sideMode === 'jobs') body.innerHTML = renderJobsHtml();
    else if (sideMode === 'shop') body.innerHTML = renderShopHtml();
    else if (sideMode === 'board') body.innerHTML = renderBoardHtml();
    else if (sideMode === 'chat') body.innerHTML = renderChatHtml();
    else if (sideMode === 'stats') body.innerHTML = renderStatsHtml();
    else if (sideMode === 'help') {
      body.innerHTML = `<ul class="help-list">
        <li>Click / chạm ô phòng trên bản đồ để di chuyển (−3⚡).</li>
        <li>Làm việc → kiếm tiền → mua nâng cấp.</li>
        <li>Mua <b>dụng cụ vượt ngục</b>, đến <b>Tường rào</b>, bấm Vượt ngục.</li>
        <li>Quản trại (áo xanh olive, mũ đỏ vàng) là NPC tuần tra — chỉ trang trí.</li>
        <li>Tù nhân mặc áo sọc trắng–đen.</li>
      </ul>`;
    }
    bindSideEvents();
  }

  function renderJobsHtml() {
    const now = Date.now();
    return Object.values(config.jobs || {})
      .map((j) => {
        const cd = me && me.cooldowns && me.cooldowns[j.id] ? me.cooldowns[j.id] : 0;
        const left = Math.max(0, Math.ceil((cd - now) / 1000));
        return `<div class="job">
          <div class="info">
            <div class="title">${j.emoji} ${j.name}</div>
            <div class="desc">${j.description}</div>
            <div class="meta">+~${j.basePay}₫ · −${j.energyCost}⚡ · CD ${j.cooldownMs / 1000}s</div>
          </div>
          <span class="cd">${left > 0 ? left + 's' : ''}</span>
          <button class="btn" data-job="${j.id}" ${left > 0 ? 'disabled' : ''}>Làm</button>
        </div>`;
      })
      .join('');
  }

  function renderShopHtml() {
    return Object.values(config.shop || {})
      .map((it) => {
        const lvl = me && me.upgrades ? me.upgrades[it.id] || 0 : 0;
        const isFood = it.id === 'do_an';
        const price = isFood ? it.price : it.price * (lvl + 1);
        const maxed = !isFood && lvl >= it.maxLevel;
        const lvlTxt = isFood ? '' : ` · Lv ${lvl}/${it.maxLevel}`;
        return `<div class="shop-item">
          <div class="info">
            <div class="title">${it.emoji} ${it.name}${lvlTxt}</div>
            <div class="desc">${it.description}</div>
          </div>
          <button class="btn" data-buy="${it.id}" ${maxed ? 'disabled' : ''}>${maxed ? 'MAX' : price + '₫'}</button>
        </div>`;
      })
      .join('');
  }

  function renderBoardHtml() {
    const rows = world.leaderboard || [];
    if (!rows.length) return '<p class="bang-phu">Chưa có ai…</p>';
    return rows
      .map(
        (r, i) => `<div class="board-row">
        <span class="rank">#${i + 1}</span>
        <span style="flex:1;font-family:var(--serif);font-weight:600">${escapeHtml(r.nickname)}</span>
        <span style="color:var(--text-dim);font-size:13px">💰${r.money} · ${r.totalEarned}</span>
        ${r.escaped ? '<span class="free">TỰ DO</span>' : ''}
      </div>`
      )
      .join('');
  }

  function renderChatHtml() {
    return `<div class="chat-log" id="chat-log"></div>
      <form class="chat-form" id="chat-form">
        <input id="chat-input" maxlength="200" placeholder="Nói gì đó…" autocomplete="off" />
        <button class="btn pri" type="submit">Gửi</button>
      </form>`;
  }

  function renderStatsHtml() {
    if (!me) return '';
    const hp = Math.round((me.health / me.maxHealth) * 100);
    const en = Math.round((me.energy / me.maxEnergy) * 100);
    return `<div class="stat-grid">
      <div class="stat-row"><span>💰 Tiền</span><strong>${me.money}</strong></div>
      <div class="bar-wrap"><div class="bar-label"><span>❤️ Sức khỏe</span><span>${me.health}/${me.maxHealth}</span></div><div class="bar"><i style="width:${hp}%"></i></div></div>
      <div class="bar-wrap"><div class="bar-label"><span>⚡ Năng lượng</span><span>${me.energy}/${me.maxEnergy}</span></div><div class="bar energy"><i style="width:${en}%"></i></div></div>
      <div class="stat-row"><span>⭐ Uy tín</span><strong>${me.reputation}</strong></div>
      <div class="stat-row"><span>🔑 Dụng cụ vượt</span><strong>${me.upgrades.dung_cu_vuot || 0}</strong></div>
      <div class="stat-row"><span>❌ Lần vượt hỏng</span><strong>${me.escapeFails || 0}</strong></div>
      <div class="stat-row"><span>🛏️ Giường</span><strong>Lv ${me.upgrades.giuong || 0}</strong></div>
      <div class="stat-row"><span>🔧 Công cụ</span><strong>Lv ${me.upgrades.cong_cu || 0}</strong></div>
    </div>`;
  }

  function bindSideEvents() {
    $('#side-body').querySelectorAll('[data-job]').forEach((b) => {
      b.onclick = () => socket.emit('work', b.dataset.job);
    });
    $('#side-body').querySelectorAll('[data-buy]').forEach((b) => {
      b.onclick = () => socket.emit('buy', b.dataset.buy);
    });
    const form = $('#chat-form');
    if (form) {
      // restore chat history into log
      const log = $('#chat-log');
      (bindSideEvents._hist || []).forEach((e) => appendChatTo(log, e));
      form.onsubmit = (ev) => {
        ev.preventDefault();
        const input = $('#chat-input');
        const v = input.value.trim();
        if (!v) return;
        socket.emit('chat', v);
        input.value = '';
      };
    }
  }

  function appendChatTo(log, entry) {
    if (!log) return;
    const div = document.createElement('div');
    div.className = 'chat-line' + (entry.type === 'system' ? ' system' : '');
    if (entry.type === 'system') div.textContent = entry.text;
    else div.innerHTML = `<span class="n">${escapeHtml(entry.nick)}</span>: ${escapeHtml(entry.text)}`;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  // --- Socket ---
  socket.on('config', (c) => {
    config = c;
    if (sideMode) renderSide();
  });

  socket.on('joined', ({ nickname }) => {
    $('#join-screen').hidden = true;
    $('#topbar').hidden = false;
    $('#hud-left').hidden = false;
    $('#botbar').hidden = false;
    $('#hint-move').hidden = false;
    $('#my-nick').textContent = nickname;
    setTimeout(() => { $('#hint-move').hidden = true; }, 8000);
    fitCamera();
  });

  socket.on('errorMsg', (msg) => {
    if (!$('#join-screen').hidden) $('#join-error').textContent = msg;
    else showToast(msg, true);
  });

  socket.on('me', (p) => {
    me = p;
    ensurePos(p);
    updateHud();
    if (sideMode) renderSide();
    const room = (config.rooms || []).find((r) => r.id === p.room);
    $('#room-label').textContent = room ? room.name : p.room;
  });

  socket.on('world', (w) => {
    world = w;
    $('#online-count').textContent = `${w.onlineCount} online`;
    (w.players || []).forEach(ensurePos);
    // prune
    const ids = new Set((w.players || []).map((p) => p.id));
    for (const id of playerPos.keys()) if (!ids.has(id)) playerPos.delete(id);
    if (sideMode === 'board') renderSide();
  });

  socket.on('workResult', ({ pay, jobName }) => showToast(`+${pay}₫ từ ${jobName}`));
  socket.on('buyResult', ({ message }) => showToast(message));
  socket.on('escapeResult', (r) => {
    showToast(r.message, !r.success);
    if (r.success) {
      $('#escape-title').textContent = '🎉 Tự do!';
      $('#escape-detail').textContent = r.message;
      $('#escape-overlay').hidden = false;
    }
  });

  socket.on('chatHistory', (list) => {
    bindSideEvents._hist = list || [];
  });
  socket.on('chat', (entry) => {
    bindSideEvents._hist = (bindSideEvents._hist || []).concat([entry]).slice(-80);
    if (sideMode === 'chat') appendChatTo($('#chat-log'), entry);
  });

  function updateHud() {
    if (!me) return;
    $('#stat-money-line').textContent = `💰 ${me.money}₫`;
    $('#stat-bars-line').textContent = `❤️ ${Math.round(me.health)} · ⚡ ${Math.round(me.energy)} · ⭐ ${me.reputation}`;
  }

  function slotInRoom(roomId, key) {
    const r = ROOM_RECTS[roomId] || ROOM_RECTS.phong_a;
    let h = 0;
    const s = String(key || 'x');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    const cols = 4;
    const col = h % cols;
    const row = Math.floor(h / cols) % 3;
    const pad = 50;
    return {
      x: r.x + pad + col * ((r.w - pad * 2) / (cols - 1 || 1)),
      y: r.y + pad + 20 + row * ((r.h - pad * 2) / 3),
    };
  }

  function ensurePos(p) {
    if (!p || p.escaped) return;
    let pos = playerPos.get(p.id);
    const target = slotInRoom(p.room, p.nickname || p.id);
    if (!pos) {
      pos = { x: target.x, y: target.y, tx: target.x, ty: target.y, facing: 1 };
      playerPos.set(p.id, pos);
    } else {
      pos.tx = target.x;
      pos.ty = target.y;
      if (pos.tx !== pos.x) pos.facing = pos.tx > pos.x ? 1 : -1;
    }
  }

  // --- Canvas resize / camera ---
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fitCamera();
  }
  function fitCamera() {
    const sw = window.innerWidth;
    const sh = window.innerHeight;
    const scale = Math.min(sw / MAP.w, sh / MAP.h) * 1.05;
    camera.scale = Math.max(0.55, Math.min(1.35, scale));
    camera.x = (MAP.w - sw / camera.scale) / 2;
    camera.y = (MAP.h - sh / camera.scale) / 2;
  }
  window.addEventListener('resize', resize);
  resize();

  function worldFromScreen(sx, sy) {
    return {
      x: sx / camera.scale + camera.x,
      y: sy / camera.scale + camera.y,
    };
  }

  function hitRoom(wx, wy) {
    for (const [id, r] of Object.entries(ROOM_RECTS)) {
      if (wx >= r.x && wx <= r.x + r.w && wy >= r.y && wy <= r.y + r.h) return id;
    }
    return null;
  }

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    dragging = false;
    dragLast = { x: e.clientX, y: e.clientY, t: Date.now(), sx: e.clientX, sy: e.clientY };
    canvas.classList.add('dragging');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragLast) return;
    const dx = e.clientX - dragLast.x;
    const dy = e.clientY - dragLast.y;
    if (Math.hypot(e.clientX - dragLast.sx, e.clientY - dragLast.sy) > 8) dragging = true;
    if (dragging) {
      camera.x -= dx / camera.scale;
      camera.y -= dy / camera.scale;
      dragLast.x = e.clientX;
      dragLast.y = e.clientY;
    }
  });
  function endPointer(e) {
    canvas.classList.remove('dragging');
    if (dragLast && !dragging && me) {
      const w = worldFromScreen(e.clientX, e.clientY);
      const room = hitRoom(w.x, w.y);
      if (room && room !== me.room) socket.emit('move', room);
    }
    dragLast = null;
    dragging = false;
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const old = camera.scale;
    camera.scale = Math.max(0.45, Math.min(1.8, camera.scale * (e.deltaY > 0 ? 0.92 : 1.08)));
    // zoom toward cursor
    const w = worldFromScreen(e.clientX, e.clientY);
    camera.x = w.x - e.clientX / camera.scale;
    camera.y = w.y - e.clientY / camera.scale;
    void old;
  }, { passive: false });

  // --- Draw ---
  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, window.innerHeight);
    g.addColorStop(0, '#1a1510');
    g.addColorStop(1, '#0a0806');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

    ctx.save();
    ctx.scale(camera.scale, camera.scale);
    ctx.translate(-camera.x, -camera.y);

    // ground
    ctx.fillStyle = '#1e1a14';
    ctx.fillRect(0, 0, MAP.w, MAP.h);

    // fence border
    ctx.strokeStyle = 'rgba(212,168,87,0.25)';
    ctx.lineWidth = 6;
    ctx.strokeRect(12, 12, MAP.w - 24, MAP.h - 24);

    // rooms
    for (const [id, r] of Object.entries(ROOM_RECTS)) {
      const here = me && me.room === id;
      roundFill(r.x, r.y, r.w, r.h, 16, r.color);
      ctx.strokeStyle = here ? '#d4a857' : 'rgba(212,168,87,0.28)';
      ctx.lineWidth = here ? 3 : 1.5;
      roundStroke(r.x, r.y, r.w, r.h, 16);
      // label
      ctx.fillStyle = here ? '#f0d28e' : '#cbb89a';
      ctx.font = `600 ${here ? 18 : 15}px "Noto Serif", serif`;
      ctx.textAlign = 'left';
      ctx.fillText(r.label, r.x + 14, r.y + 28);
      const count = (world.roomCounts && world.roomCounts[id]) || 0;
      ctx.font = '12px Inter, sans-serif';
      ctx.fillStyle = '#a89580';
      ctx.fillText(`${count} người`, r.x + 14, r.y + 46);

      // room props
      drawRoomDecor(id, r);
    }

    // path lines between rooms (subtle)
    ctx.strokeStyle = 'rgba(212,168,87,0.12)';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(180, 280); ctx.lineTo(180, 320);
    ctx.moveTo(500, 280); ctx.lineTo(500, 320);
    ctx.moveTo(820, 280); ctx.lineTo(500, 360);
    ctx.moveTo(500, 580); ctx.lineTo(240, 620);
    ctx.moveTo(500, 580); ctx.lineTo(720, 620);
    ctx.stroke();

    ctx.restore();
  }

  function drawRoomDecor(id, r) {
    ctx.save();
    if (id === 'nha_bep') {
      ctx.fillStyle = '#5a4030';
      ctx.fillRect(r.x + r.w - 70, r.y + 70, 40, 50);
      ctx.fillStyle = '#888';
      ctx.fillRect(r.x + r.w - 62, r.y + 55, 24, 16);
    } else if (id === 'tuong_rao') {
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = '#4a3a35';
        ctx.fillRect(r.x + 30 + i * 55, r.y + 55, 12, 70);
        ctx.fillStyle = '#6a5048';
        ctx.fillRect(r.x + 20 + i * 55, r.y + 50, 32, 8);
      }
      ctx.fillStyle = 'rgba(200,60,60,0.35)';
      ctx.font = '13px Inter';
      ctx.fillText('⚠ Khu vực hạn chế', r.x + 14, r.y + r.h - 16);
    } else if (id === 'san_tap') {
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.strokeRect(r.x + 80, r.y + 70, r.w - 160, r.h - 120);
    } else if (id.startsWith('phong')) {
      // bunks
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = '#2a221c';
        ctx.fillRect(r.x + 30 + i * 80, r.y + 130, 60, 28);
        ctx.fillStyle = '#4a3a30';
        ctx.fillRect(r.x + 34 + i * 80, r.y + 124, 52, 8);
      }
    } else if (id === 'xuong') {
      ctx.fillStyle = '#555';
      ctx.fillRect(r.x + 40, r.y + 70, 50, 40);
      ctx.fillRect(r.x + 120, r.y + 70, 50, 40);
    }
    ctx.restore();
  }

  function roundFill(x, y, w, h, rad, color) {
    ctx.fillStyle = color;
    pathRound(x, y, w, h, rad);
    ctx.fill();
  }
  function roundStroke(x, y, w, h, rad) {
    pathRound(x, y, w, h, rad);
    ctx.stroke();
  }
  function pathRound(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function updateEntities(dt) {
    // players lerp
    for (const pos of playerPos.values()) {
      pos.x += (pos.tx - pos.x) * Math.min(1, dt * 4);
      pos.y += (pos.ty - pos.y) * Math.min(1, dt * 4);
    }
    // guards patrol
    const t = performance.now() / 1000;
    for (const g of guards) {
      const path = g.path;
      const speed = 0.15;
      const total = path.length;
      const u = (t * speed + g.phase) % total;
      const i = Math.floor(u);
      const f = u - i;
      const a = path[i];
      const b = path[(i + 1) % total];
      const nx = a[0] + (b[0] - a[0]) * f;
      const ny = a[1] + (b[1] - a[1]) * f;
      if (nx !== g.x) g.facing = nx > g.x ? 1 : -1;
      g.x = nx;
      g.y = ny;
    }
  }

  function drawEntities() {
    ctx.save();
    ctx.scale(camera.scale, camera.scale);
    ctx.translate(-camera.x, -camera.y);

    const drawList = [];
    for (const g of guards) drawList.push({ type: 'guard', y: g.y, g });
    for (const p of world.players || []) {
      const pos = playerPos.get(p.id);
      if (!pos) continue;
      drawList.push({ type: 'player', y: pos.y, p, pos });
    }
    drawList.sort((a, b) => a.y - b.y);

    for (const item of drawList) {
      if (item.type === 'guard') {
        OtuSprites.drawGuard(ctx, item.g.x, item.g.y, 3.2, { facing: item.g.facing });
        OtuSprites.drawNameTag(ctx, item.g.x, item.g.y - 42, item.g.name, false);
      } else {
        const isMe = me && item.p.nickname === me.nickname;
        OtuSprites.drawPrisoner(ctx, item.pos.x, item.pos.y, isMe ? 3.4 : 3.1, {
          facing: item.pos.facing,
          number: isMe ? '01' : undefined,
        });
        OtuSprites.drawNameTag(ctx, item.pos.x, item.pos.y - 44, item.p.nickname, isMe);
      }
    }
    ctx.restore();
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    updateEntities(dt);
    drawBackground();
    drawEntities();
    // cooldown refresh in open jobs panel
    if (sideMode === 'jobs' && me && frame._cdAcc !== (frame._cdAcc = Math.floor(now / 500))) {
      renderSide();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // keyboard nudge camera
  window.addEventListener('keydown', (e) => {
    const step = 40 / camera.scale;
    if (e.key === 'ArrowLeft') camera.x -= step;
    if (e.key === 'ArrowRight') camera.x += step;
    if (e.key === 'ArrowUp') camera.y -= step;
    if (e.key === 'ArrowDown') camera.y += step;
  });
})();
