(() => {
  const socket = io();
  let me = null;
  let config = { jobs: {}, shop: {}, rooms: [], appearance: null, roomGraph: {} };
  let world = { players: [], roomCounts: {}, leaderboard: [], onlineCount: 0, letters: [], schedule: null };
  let sideMode = null;
  let currentMatch = null;
  let appearance = { skin: '#e0b090', hair: '#2a2218', stripe: 'bw' };

  const $ = (s) => document.querySelector(s);
  const canvas = $('#yard');
  const ctx = canvas.getContext('2d');
  const MAP = { w: 1200, h: 800 };
  const camera = { x: 0, y: 0, scale: 1 };
  let dragging = false;
  let dragLast = null;

  const ROOM_RECTS = {
    phong_a: { x: 40, y: 60, w: 280, h: 220, label: 'Phòng A', color: '#3a2e24' },
    phong_b: { x: 360, y: 60, w: 280, h: 220, label: 'Phòng B', color: '#3a2e24' },
    nha_bep: { x: 680, y: 60, w: 280, h: 220, label: 'Nhà ăn', color: '#3d3220' },
    san_tap: { x: 200, y: 320, w: 600, h: 260, label: 'Sân tập', color: '#2c3424' },
    xuong: { x: 40, y: 620, w: 400, h: 140, label: 'Xưởng', color: '#2f2a28' },
    tuong_rao: { x: 480, y: 620, w: 480, h: 140, label: 'Tường rào', color: '#3a2824' },
  };

  const guards = [
    { id: 'g1', name: 'Quản trại A', x: 420, y: 420, facing: 1, phase: 0, path: [[350, 400], [700, 400], [700, 500], [350, 500]] },
    { id: 'g2', name: 'Quản trại B', x: 700, y: 680, facing: -1, phase: 1.7, path: [[520, 680], [900, 680], [900, 720], [520, 720]] },
  ];
  const playerPos = new Map();

  const LS_KEY = 'otu_guest_v1';
  function loadGuest() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch { return null; }
  }
  function saveGuest(data) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {}
  }

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

  // --- Character create ---
  const saved = loadGuest();
  if (saved) {
    if (saved.nickname) $('#nick').value = saved.nickname;
    if (saved.appearance) appearance = { ...appearance, ...saved.appearance };
  }
  $('#nick-dem').textContent = `${$('#nick').value.length}/16`;

  function buildSwatches() {
    const skins = (config.appearance && config.appearance.skins) || ['#e0b090', '#c68642', '#8d5524', '#f1c27d', '#ffdbac'];
    const hairs = (config.appearance && config.appearance.hairs) || ['#2a2218', '#1a1a1a', '#5a3a1a', '#c4a35a', '#4a2020', '#708090'];
    const stripes = (config.appearance && config.appearance.stripes) || [
      { id: 'bw', name: 'Sọc trắng–đen' },
      { id: 'blue', name: 'Sọc xanh' },
      { id: 'orange', name: 'Sọc cam' },
    ];
    const skinEl = $('#skin-swatches');
    const hairEl = $('#hair-swatches');
    const stripeEl = $('#stripe-swatches');
    skinEl.innerHTML = skins.map((c) => `<button type="button" class="sw ${appearance.skin === c ? 'on' : ''}" data-skin="${c}" style="background:${c}"></button>`).join('');
    hairEl.innerHTML = hairs.map((c) => `<button type="button" class="sw ${appearance.hair === c ? 'on' : ''}" data-hair="${c}" style="background:${c}"></button>`).join('');
    stripeEl.innerHTML = stripes.map((s) => `<button type="button" class="sw ${appearance.stripe === s.id ? 'on' : ''}" data-stripe="${s.id}">${s.name}</button>`).join('');
    skinEl.querySelectorAll('[data-skin]').forEach((b) => b.onclick = () => { appearance.skin = b.dataset.skin; buildSwatches(); drawPreview(); });
    hairEl.querySelectorAll('[data-hair]').forEach((b) => b.onclick = () => { appearance.hair = b.dataset.hair; buildSwatches(); drawPreview(); });
    stripeEl.querySelectorAll('[data-stripe]').forEach((b) => b.onclick = () => { appearance.stripe = b.dataset.stripe; buildSwatches(); drawPreview(); });
  }

  function drawPreview() {
    const c = $('#preview-char');
    if (!c) return;
    const pctx = c.getContext('2d');
    pctx.clearRect(0, 0, c.width, c.height);
    pctx.fillStyle = '#1a1410';
    pctx.fillRect(0, 0, c.width, c.height);
    OtuSprites.drawPrisoner(pctx, 48, 70, 4.2, { ...appearance, facing: 1, number: '01' });
  }

  $('#nick').addEventListener('input', () => {
    $('#nick-dem').textContent = `${$('#nick').value.length}/16`;
  });
  $('#btn-join').onclick = () => {
    $('#join-error').textContent = '';
    const nickname = $('#nick').value;
    saveGuest({ nickname, appearance, guestId: (saved && saved.guestId) || Math.random().toString(36).slice(2) });
    socket.emit('join', { nickname, appearance });
  };
  $('#nick').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btn-join').click(); });
  $('#btn-replay').onclick = () => location.reload();

  // Panels
  document.querySelectorAll('[data-open]').forEach((btn) => {
    btn.onclick = () => openSide(btn.dataset.open);
  });
  $('#btn-panel-stats').onclick = () => openSide('stats');
  $('#btn-panel-chat').onclick = () => openSide('chat');
  $('#side-x').onclick = () => closeSide();
  $('#btn-escape').onclick = () => socket.emit('escape');

  document.querySelectorAll('[data-act]').forEach((btn) => {
    btn.onclick = () => {
      const act = btn.dataset.act;
      if (act === 'letter') openSide('letter');
      else socket.emit('action', act);
    };
  });

  function openSide(mode) {
    sideMode = mode;
    const bang = $('#sidebang');
    bang.hidden = false;
    const titles = {
      jobs: ['Làm việc', 'Kiếm tiền, tốn năng lượng, có thời gian chờ.'],
      shop: ['Cửa hàng', 'Nâng cấp giường, công cụ, dụng cụ vượt ngục.'],
      board: ['Bảng xếp hạng', 'Ưu tiên chiến thắng Caro / Kéo Búa Bao hợp lệ.'],
      chat: ['Chat toàn trại', 'Nói chuyện với tù nhân khác.'],
      stats: ['Trạng thái', 'Chỉ số của bạn.'],
      help: ['Gợi ý', 'Cách chơi nhanh.'],
      games: ['Trò chơi', 'Cờ Caro 15×15 · Kéo Búa Bao BO3.'],
      letter: ['Viết thư về nhà', 'Thư được ghim lên Bảng Thư cạnh bàn trực.'],
      letters: ['Bảng Thư', 'Thư tù nhân gửi về nhà.'],
      more: ['Thêm', 'Cửa hàng, thư, gợi ý…'],
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
    else if (sideMode === 'games') body.innerHTML = renderGamesHtml();
    else if (sideMode === 'letter') body.innerHTML = renderLetterForm();
    else if (sideMode === 'letters') body.innerHTML = renderLettersHtml();
    else if (sideMode === 'more') {
      body.innerHTML = `<div class="game-pick">
        <button class="btn" data-goto="shop">🛒 Cửa hàng</button>
        <button class="btn" data-goto="letters">📋 Bảng Thư</button>
        <button class="btn" data-goto="help">ℹ️ Gợi ý</button>
        <button class="btn" data-goto="stats">❤️ Trạng thái</button>
      </div>`;
    } else if (sideMode === 'help') {
      body.innerHTML = `<ul class="help-list">
        <li>Tạo nhân vật (da/tóc/sọc) rồi <b>Vào trại</b> — nhớ trên trình duyệt.</li>
        <li>Click phòng để đi (−3⚡). WASD / mũi tên pan camera; lăn chuột zoom.</li>
        <li>Thanh sinh hoạt: Ngồi (Nhà ăn), Hít đất, Vẫy tay, Gạch ngày, Viết thư, Về phòng.</li>
        <li>Loa trại thông báo giờ ăn / tập / tắt đèn.</li>
        <li><b>Trò chơi</b>: Caro 15×15 (5 quân, 30s/lượt) hoặc Kéo Búa Bao BO3 — đấu NPC hoặc mời người.</li>
        <li>BXH ưu tiên số trận thắng hợp lệ. Vượt ngục vẫn có (tuỳ chọn).</li>
      </ul>`;
    }
    bindSideEvents();
  }

  function renderJobsHtml() {
    const now = Date.now();
    return Object.values(config.jobs || {}).map((j) => {
      const cd = me && me.cooldowns && me.cooldowns[j.id] ? me.cooldowns[j.id] : 0;
      const left = Math.max(0, Math.ceil((cd - now) / 1000));
      return `<div class="job"><div class="info"><div class="title">${j.emoji} ${j.name}</div><div class="desc">${j.description}</div><div class="meta">+~${j.basePay}₫ · −${j.energyCost}⚡ · CD ${j.cooldownMs / 1000}s</div></div><span class="cd">${left > 0 ? left + 's' : ''}</span><button class="btn" data-job="${j.id}" ${left > 0 ? 'disabled' : ''}>Làm</button></div>`;
    }).join('');
  }
  function renderShopHtml() {
    return Object.values(config.shop || {}).map((it) => {
      const lvl = me && me.upgrades ? me.upgrades[it.id] || 0 : 0;
      const isFood = it.id === 'do_an';
      const price = isFood ? it.price : it.price * (lvl + 1);
      const maxed = !isFood && lvl >= it.maxLevel;
      return `<div class="shop-item"><div class="info"><div class="title">${it.emoji} ${it.name}${isFood ? '' : ` · Lv ${lvl}/${it.maxLevel}`}</div><div class="desc">${it.description}</div></div><button class="btn" data-buy="${it.id}" ${maxed ? 'disabled' : ''}>${maxed ? 'MAX' : price + '₫'}</button></div>`;
    }).join('');
  }
  function renderBoardHtml() {
    const rows = world.leaderboard || [];
    if (!rows.length) return '<p class="bang-phu">Chưa có ai…</p>';
    return rows.map((r, i) => `<div class="board-row"><span class="rank">#${i + 1}</span><span style="flex:1;font-family:var(--serif);font-weight:600">${escapeHtml(r.nickname)}</span><span style="color:var(--text-dim);font-size:12px">🏆${r.gameWins || 0} · 💰${r.money}</span>${r.escaped ? '<span class="free">TỰ DO</span>' : ''}</div>`).join('');
  }
  function renderChatHtml() {
    return `<div class="chat-log" id="chat-log"></div><form class="chat-form" id="chat-form"><input id="chat-input" maxlength="200" placeholder="Nói gì đó…" autocomplete="off" /><button class="btn pri" type="submit">Gửi</button></form>`;
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
      <div class="stat-row"><span>📅 Ngày trên tường</span><strong>${me.daysMarked || 0}</strong></div>
      <div class="stat-row"><span>🏆 Thắng Caro</span><strong>${me.winsCaro || 0}</strong></div>
      <div class="stat-row"><span>✊ Thắng KBB</span><strong>${me.winsRps || 0}</strong></div>
      <div class="stat-row"><span>🔑 Dụng cụ vượt</span><strong>${me.upgrades.dung_cu_vuot || 0}</strong></div>
    </div>`;
  }
  function renderGamesHtml() {
    const others = (world.players || []).filter((p) => me && p.nickname !== me.nickname);
    return `<div class="game-pick">
      <button class="btn pri" data-start="caro" data-vs="npc">⬛ Cờ Caro vs Quản giáo (NPC)</button>
      <button class="btn pri" data-start="rps" data-vs="npc">✊ Kéo Búa Bao vs Quản giáo</button>
      <p class="bang-phu" style="margin:8px 0 0">Hoặc mời người đang online:</p>
      <div class="player-pick">${others.length ? others.map((p) => `
        <button class="btn" data-invite="caro" data-id="${p.id}">Caro → ${escapeHtml(p.nickname)}</button>
        <button class="btn" data-invite="rps" data-id="${p.id}">KBB → ${escapeHtml(p.nickname)}</button>`).join('') : '<span class="bang-phu">Chưa có ai khác online.</span>'}</div>
    </div>`;
  }
  function renderLetterForm() {
    return `<form class="letter-form" id="letter-form"><textarea id="letter-text" maxlength="160" placeholder="Gửi lời về nhà…"></textarea><button class="btn pri" type="submit">Gửi thư</button><button class="btn" type="button" data-goto="letters">Xem Bảng Thư</button></form>`;
  }
  function renderLettersHtml() {
    const list = world.letters || [];
    if (!list.length) return '<p class="bang-phu">Bảng Thư trống.</p>';
    return list.map((L) => `<div class="letter-item"><div class="who">${escapeHtml(L.nick)}</div><div>${escapeHtml(L.text)}</div></div>`).join('');
  }

  function bindSideEvents() {
    $('#side-body').querySelectorAll('[data-job]').forEach((b) => { b.onclick = () => socket.emit('work', b.dataset.job); });
    $('#side-body').querySelectorAll('[data-buy]').forEach((b) => { b.onclick = () => socket.emit('buy', b.dataset.buy); });
    $('#side-body').querySelectorAll('[data-goto]').forEach((b) => { b.onclick = () => openSide(b.dataset.goto); });
    $('#side-body').querySelectorAll('[data-start]').forEach((b) => {
      b.onclick = () => { socket.emit('startGame', { game: b.dataset.start, vs: b.dataset.vs }); closeSide(); };
    });
    $('#side-body').querySelectorAll('[data-invite]').forEach((b) => {
      b.onclick = () => { socket.emit('startGame', { game: b.dataset.invite, vs: 'invite', targetId: b.dataset.id }); };
    });
    const lf = $('#letter-form');
    if (lf) {
      lf.onsubmit = (ev) => {
        ev.preventDefault();
        const t = $('#letter-text').value.trim();
        if (!t) return;
        socket.emit('writeLetter', t);
        $('#letter-text').value = '';
        openSide('letters');
      };
    }
    const form = $('#chat-form');
    if (form) {
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

  function updateScheduleBanner(sch) {
    const el = $('#schedule-banner');
    if (!sch) { el.hidden = true; return; }
    el.hidden = false;
    const left = Math.max(0, Math.ceil((sch.endsAt - Date.now()) / 1000));
    $('#schedule-text').textContent = `${sch.emoji || ''} ${sch.name} · còn ${left}s`;
  }

  // --- Match UI ---
  function renderMatch() {
    const overlay = $('#match-overlay');
    const card = $('#match-card');
    if (!currentMatch) {
      overlay.hidden = true;
      card.innerHTML = '';
      return;
    }
    overlay.hidden = false;
    const m = currentMatch;
    if (m.game === 'caro') {
      const yourTurn = m.status === 'playing' && m.turn === m.youAre;
      const cells = m.board.map((row, y) => row.map((v, x) => {
        const mark = v === 1 ? 'X' : v === 2 ? 'O' : '';
        const dis = m.status !== 'playing' || !yourTurn || v ? 'disabled' : '';
        return `<button class="caro-cell" data-x="${x}" data-y="${y}" ${dis}>${mark}</button>`;
      }).join('')).join('');
      card.innerHTML = `<h2>Cờ Caro 15×15</h2><p class="bang-phu">${escapeHtml(m.message || '')}</p>
        <p class="bang-phu">${m.status === 'playing' ? (yourTurn ? 'Lượt bạn · 30s' : 'Đợi đối thủ…') : 'Kết thúc'}</p>
        <div class="caro-board">${cells}</div>
        <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end">
          ${m.status === 'ended' ? `<button class="btn pri" id="btn-rematch">Chơi lại (NPC)</button>` : ''}
          <button class="btn" id="btn-close-match">Đóng</button>
        </div>`;
      card.querySelectorAll('.caro-cell').forEach((b) => {
        b.onclick = () => socket.emit('caroMove', { matchId: m.id, x: +b.dataset.x, y: +b.dataset.y });
      });
    } else {
      card.innerHTML = `<h2>Kéo Búa Bao · BO3</h2>
        <p class="bang-phu">${escapeHtml(m.message || '')}</p>
        <p>Tỉ số: bạn ${m.youAre === 1 ? m.scores[1] : m.scores[2]} — đối thủ ${m.youAre === 1 ? m.scores[2] : m.scores[1]}</p>
        ${m.lastRound ? `<p class="bang-phu">Ván trước: ${m.lastRound.a.label} vs ${m.lastRound.b.label}</p>` : ''}
        <div class="rps-row">
          <button class="btn" data-rps="rock" ${m.status !== 'playing' ? 'disabled' : ''}>✊<span>Búa</span></button>
          <button class="btn" data-rps="paper" ${m.status !== 'playing' ? 'disabled' : ''}>✋<span>Bao</span></button>
          <button class="btn" data-rps="scissors" ${m.status !== 'playing' ? 'disabled' : ''}>✌️<span>Kéo</span></button>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          ${m.status === 'ended' ? `<button class="btn pri" id="btn-rematch">Chơi lại (NPC)</button>` : ''}
          <button class="btn" id="btn-close-match">Đóng</button>
        </div>`;
      card.querySelectorAll('[data-rps]').forEach((b) => {
        b.onclick = () => socket.emit('rpsChoice', { matchId: m.id, choice: b.dataset.rps });
      });
    }
    const close = $('#btn-close-match');
    if (close) close.onclick = () => { socket.emit('closeMatch', { matchId: m.id }); currentMatch = null; renderMatch(); };
    const rem = $('#btn-rematch');
    if (rem) rem.onclick = () => { socket.emit('closeMatch', { matchId: m.id }); socket.emit('startGame', { game: m.game, vs: 'npc' }); };
  }

  // --- Socket ---
  socket.on('config', (c) => {
    config = c;
    buildSwatches();
    drawPreview();
    if (c.schedule) updateScheduleBanner(c.schedule);
    if (sideMode) renderSide();
  });
  socket.on('joined', ({ nickname }) => {
    $('#join-screen').hidden = true;
    $('#topbar').hidden = false;
    $('#hud-left').hidden = false;
    $('#botbar').hidden = false;
    $('#actbar').hidden = false;
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
    const ids = new Set((w.players || []).map((p) => p.id));
    for (const id of playerPos.keys()) if (!ids.has(id)) playerPos.delete(id);
    if (w.schedule) updateScheduleBanner(w.schedule);
    if (sideMode === 'board' || sideMode === 'letters' || sideMode === 'games') renderSide();
  });
  socket.on('schedule', (sch) => updateScheduleBanner(sch));
  socket.on('letters', (list) => { world.letters = list; if (sideMode === 'letters') renderSide(); });
  socket.on('workResult', ({ pay, jobName }) => showToast(`+${pay}₫ từ ${jobName}`));
  socket.on('buyResult', ({ message }) => showToast(message));
  socket.on('actionResult', ({ message }) => showToast(message));
  socket.on('escapeResult', (r) => {
    showToast(r.message, !r.success);
    if (r.success) {
      $('#escape-title').textContent = '🎉 Tự do!';
      $('#escape-detail').textContent = r.message;
      $('#escape-overlay').hidden = false;
    }
  });
  socket.on('chatHistory', (list) => { bindSideEvents._hist = list || []; });
  socket.on('chat', (entry) => {
    bindSideEvents._hist = (bindSideEvents._hist || []).concat([entry]).slice(-80);
    if (sideMode === 'chat') appendChatTo($('#chat-log'), entry);
  });
  socket.on('match', (m) => { currentMatch = m; renderMatch(); });
  socket.on('gameInvite', (inv) => {
    const box = $('#invite-toast');
    box.hidden = false;
    box.innerHTML = `<div><b>${escapeHtml(inv.fromNick)}</b> mời bạn chơi ${inv.game === 'caro' ? 'Cờ Caro' : 'Kéo Búa Bao'}.</div>
      <div class="row"><button class="btn pri" id="inv-yes">Chấp nhận</button><button class="btn" id="inv-no">Từ chối</button></div>`;
    $('#inv-yes').onclick = () => { socket.emit('respondInvite', { id: inv.id, accept: true }); box.hidden = true; };
    $('#inv-no').onclick = () => { socket.emit('respondInvite', { id: inv.id, accept: false }); box.hidden = true; };
  });

  function updateHud() {
    if (!me) return;
    $('#stat-money-line').textContent = `💰 ${me.money}₫`;
    $('#stat-bars-line').textContent = `❤️ ${Math.round(me.health)} · ⚡ ${Math.round(me.energy)} · ⭐ ${me.reputation} · 🏆${me.gameWins || 0}`;
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
    const sw = window.innerWidth, sh = window.innerHeight;
    const scale = Math.min(sw / MAP.w, sh / MAP.h) * 1.05;
    camera.scale = Math.max(0.55, Math.min(1.35, scale));
    camera.x = (MAP.w - sw / camera.scale) / 2;
    camera.y = (MAP.h - sh / camera.scale) / 2;
  }
  window.addEventListener('resize', resize);
  resize();

  function worldFromScreen(sx, sy) {
    return { x: sx / camera.scale + camera.x, y: sy / camera.scale + camera.y };
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
      else {
        // tap nearby player to wave/greet
        for (const p of world.players || []) {
          if (!me || p.nickname === me.nickname) continue;
          const pos = playerPos.get(p.id);
          if (pos && Math.hypot(pos.x - w.x, pos.y - w.y) < 28) {
            socket.emit('action', 'wave');
            break;
          }
        }
      }
    }
    dragLast = null;
    dragging = false;
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    camera.scale = Math.max(0.45, Math.min(1.8, camera.scale * (e.deltaY > 0 ? 0.92 : 1.08)));
    const w = worldFromScreen(e.clientX, e.clientY);
    camera.x = w.x - e.clientX / camera.scale;
    camera.y = w.y - e.clientY / camera.scale;
  }, { passive: false });

  // WASD move to adjacent rooms; arrows pan
  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const step = 40 / camera.scale;
    if (['ArrowLeft', 'a', 'A'].includes(e.key) && (e.key.startsWith('Arrow') || !me)) camera.x -= step;
    if (['ArrowRight', 'd', 'D'].includes(e.key) && e.key.startsWith('Arrow')) camera.x += step;
    if (['ArrowUp', 'w', 'W'].includes(e.key) && e.key.startsWith('Arrow')) camera.y -= step;
    if (['ArrowDown', 's', 'S'].includes(e.key) && e.key.startsWith('Arrow')) camera.y += step;
    if (!me) return;
    const graph = config.roomGraph || {};
    const neigh = graph[me.room] || [];
    const mapDir = {
      w: ['san_tap', 'phong_a', 'phong_b', 'nha_bep'],
      W: ['san_tap', 'phong_a', 'phong_b', 'nha_bep'],
      s: ['tuong_rao', 'xuong', 'san_tap'],
      S: ['tuong_rao', 'xuong', 'san_tap'],
      a: ['phong_a', 'xuong'],
      A: ['phong_a', 'xuong'],
      d: ['nha_bep', 'phong_b', 'tuong_rao'],
      D: ['nha_bep', 'phong_b', 'tuong_rao'],
    };
    if (mapDir[e.key]) {
      const prefer = mapDir[e.key].find((r) => neigh.includes(r));
      if (prefer) socket.emit('move', prefer);
    }
  });

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, window.innerHeight);
    g.addColorStop(0, '#1a1510');
    g.addColorStop(1, '#0a0806');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.save();
    ctx.scale(camera.scale, camera.scale);
    ctx.translate(-camera.x, -camera.y);
    ctx.fillStyle = '#1e1a14';
    ctx.fillRect(0, 0, MAP.w, MAP.h);
    ctx.strokeStyle = 'rgba(212,168,87,0.25)';
    ctx.lineWidth = 6;
    ctx.strokeRect(12, 12, MAP.w - 24, MAP.h - 24);
    for (const [id, r] of Object.entries(ROOM_RECTS)) {
      const here = me && me.room === id;
      roundFill(r.x, r.y, r.w, r.h, 16, r.color);
      ctx.strokeStyle = here ? '#d4a857' : 'rgba(212,168,87,0.28)';
      ctx.lineWidth = here ? 3 : 1.5;
      roundStroke(r.x, r.y, r.w, r.h, 16);
      ctx.fillStyle = here ? '#f0d28e' : '#cbb89a';
      ctx.font = `600 ${here ? 18 : 15}px "Noto Serif", serif`;
      ctx.textAlign = 'left';
      ctx.fillText(r.label, r.x + 14, r.y + 28);
      const count = (world.roomCounts && world.roomCounts[id]) || 0;
      ctx.font = '12px Inter, sans-serif';
      ctx.fillStyle = '#a89580';
      ctx.fillText(`${count} người`, r.x + 14, r.y + 46);
      drawRoomDecor(id, r);
    }
    // letter board near warden desk (edge of san_tap / fence)
    ctx.fillStyle = '#2a2218';
    ctx.fillRect(820, 480, 70, 50);
    ctx.strokeStyle = '#d4a857';
    ctx.strokeRect(820, 480, 70, 50);
    ctx.fillStyle = '#f0d28e';
    ctx.font = '11px Inter';
    ctx.fillText('Bảng Thư', 828, 500);
    ctx.restore();
  }

  function drawRoomDecor(id, r) {
    ctx.save();
    if (id === 'nha_bep') {
      // tables / chairs
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = '#5a4030';
        ctx.fillRect(r.x + 40 + i * 70, r.y + 100, 50, 28);
        ctx.fillStyle = '#3a2a20';
        ctx.fillRect(r.x + 48 + i * 70, r.y + 130, 12, 14);
        ctx.fillRect(r.x + 70 + i * 70, r.y + 130, 12, 14);
      }
    } else if (id === 'tuong_rao') {
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = '#4a3a35';
        ctx.fillRect(r.x + 30 + i * 55, r.y + 55, 12, 70);
        ctx.fillStyle = '#6a5048';
        ctx.fillRect(r.x + 20 + i * 55, r.y + 50, 32, 8);
      }
    } else if (id === 'san_tap') {
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.strokeRect(r.x + 80, r.y + 70, r.w - 160, r.h - 120);
    } else if (id.startsWith('phong')) {
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = '#2a221c';
        ctx.fillRect(r.x + 30 + i * 80, r.y + 130, 60, 28);
        ctx.fillStyle = '#4a3a30';
        ctx.fillRect(r.x + 34 + i * 80, r.y + 124, 52, 8);
      }
      // day marks on wall
      ctx.strokeStyle = 'rgba(240,210,140,0.35)';
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        ctx.moveTo(r.x + 200 + i * 8, r.y + 70);
        ctx.lineTo(r.x + 204 + i * 8, r.y + 90);
      }
      ctx.stroke();
    } else if (id === 'xuong') {
      ctx.fillStyle = '#555';
      ctx.fillRect(r.x + 40, r.y + 70, 50, 40);
      ctx.fillRect(r.x + 120, r.y + 70, 50, 40);
    }
    ctx.restore();
  }

  function roundFill(x, y, w, h, rad, color) {
    ctx.fillStyle = color; pathRound(x, y, w, h, rad); ctx.fill();
  }
  function roundStroke(x, y, w, h, rad) { pathRound(x, y, w, h, rad); ctx.stroke(); }
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
    for (const pos of playerPos.values()) {
      pos.x += (pos.tx - pos.x) * Math.min(1, dt * 4);
      pos.y += (pos.ty - pos.y) * Math.min(1, dt * 4);
    }
    const t = performance.now() / 1000;
    for (const g of guards) {
      const path = g.path;
      const u = (t * 0.15 + g.phase) % path.length;
      const i = Math.floor(u);
      const f = u - i;
      const a = path[i], b = path[(i + 1) % path.length];
      const nx = a[0] + (b[0] - a[0]) * f;
      const ny = a[1] + (b[1] - a[1]) * f;
      if (nx !== g.x) g.facing = nx > g.x ? 1 : -1;
      g.x = nx; g.y = ny;
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
        const ap = item.p.appearance || appearance;
        OtuSprites.drawPrisoner(ctx, item.pos.x, item.pos.y, isMe ? 3.4 : 3.1, {
          facing: item.pos.facing,
          skin: ap.skin,
          hair: ap.hair,
          stripe: ap.stripe,
          emote: item.p.emote,
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
    if (world.schedule && frame._schAcc !== (frame._schAcc = Math.floor(now / 1000))) {
      updateScheduleBanner(world.schedule);
    }
    if (sideMode === 'jobs' && me && frame._cdAcc !== (frame._cdAcc = Math.floor(now / 500))) renderSide();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // boot swatches even before config
  buildSwatches();
  drawPreview();
})();
