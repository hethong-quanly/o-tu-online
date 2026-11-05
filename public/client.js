/* global io, OtuSprites, World3D, THREE */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];

  let config = { jobs: {}, shop: {}, rooms: [], appearance: null, crimes: [], sentences: [], achievements: [] };
  let me = null;
  let world = { players: [], roomCounts: {}, leaderboard: { wins: [], rehab: [], earlyRelease: [] }, onlineCount: 0, letters: [], schedule: null };
  let sideMode = null;
  let appearance = { skin: '#e0b090', hair: '#2a2218', stripe: 'bw' };
  let chatLines = [];
  let world3d = null;
  let matchState = null;

  const LS_KEY = 'otu_guest_v2';
  const socket = io({ transports: ['websocket', 'polling'] });

  function loadGuest() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch { return null; }
  }
  function saveGuest(data) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {}
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 3200);
  }

  function roomName(id) {
    const r = (config.rooms || []).find((x) => x.id === id);
    return r ? `${r.emoji || ''} ${r.name}` : id;
  }

  // --- Join / login ---
  function fillSelects() {
    const crimeEl = $('#crime');
    crimeEl.innerHTML = (config.crimes || []).map((c) => `<option value="${c.id}">${escapeHtml(c.label)}</option>`).join('');
    const sentEl = $('#sentence');
    sentEl.innerHTML = (config.sentences || []).map((s) => `<option value="${s.id}">${escapeHtml(s.label)} (${s.days} ngày in-game)</option>`).join('');
    crimeEl.onchange = () => {
      $('#crimeCustom').hidden = crimeEl.value !== 'custom';
      updatePreviewCard();
    };
    sentEl.onchange = updatePreviewCard;
    $('#fullName').oninput = updatePreviewCard;
    $('#nick').oninput = () => {
      $('#nick-dem').textContent = `${$('#nick').value.length}/16`;
      updatePreviewCard();
    };
  }

  function updatePreviewCard() {
    const saved = loadGuest();
    $('#pv-no').textContent = (saved && saved.prisonerNo) || 'OT-????';
    $('#pv-name').textContent = $('#fullName').value.trim() || '—';
    const crimeId = $('#crime').value;
    const crime = (config.crimes || []).find((c) => c.id === crimeId);
    $('#pv-crime').textContent = crimeId === 'custom'
      ? ($('#crimeCustom').value.trim() || 'Tự khai…')
      : (crime ? crime.label : '—');
    const sent = (config.sentences || []).find((s) => s.id === $('#sentence').value);
    $('#pv-sent').textContent = sent ? sent.label : '—';
    $('#pv-rate').textContent = 'Kém (mới vào)';
  }

  function buildSwatches() {
    const skins = (config.appearance && config.appearance.skins) || ['#e0b090', '#c68642', '#8d5524', '#f1c27d', '#ffdbac'];
    const hairs = (config.appearance && config.appearance.hairs) || ['#2a2218', '#1a1a1a', '#5a3a1a', '#c4a35a', '#4a2020', '#708090'];
    const stripes = (config.appearance && config.appearance.stripes) || [
      { id: 'bw', name: 'Sọc trắng–đen' }, { id: 'blue', name: 'Sọc xanh' }, { id: 'orange', name: 'Sọc cam' },
    ];
    const skinEl = $('#skin-swatches'), hairEl = $('#hair-swatches'), stripeEl = $('#stripe-swatches');
    skinEl.innerHTML = skins.map((c) => `<button type="button" class="sw ${appearance.skin === c ? 'on' : ''}" data-skin="${c}" style="background:${c}"></button>`).join('');
    hairEl.innerHTML = hairs.map((c) => `<button type="button" class="sw ${appearance.hair === c ? 'on' : ''}" data-hair="${c}" style="background:${c}"></button>`).join('');
    stripeEl.innerHTML = stripes.map((s) => `<button type="button" class="sw ${appearance.stripe === s.id ? 'on' : ''}" data-stripe="${s.id}">${s.name}</button>`).join('');
    skinEl.querySelectorAll('[data-skin]').forEach((b) => b.onclick = () => { appearance.skin = b.dataset.skin; buildSwatches(); drawPreview(); });
    hairEl.querySelectorAll('[data-hair]').forEach((b) => b.onclick = () => { appearance.hair = b.dataset.hair; buildSwatches(); drawPreview(); });
    stripeEl.querySelectorAll('[data-stripe]').forEach((b) => b.onclick = () => { appearance.stripe = b.dataset.stripe; buildSwatches(); drawPreview(); });
  }

  function drawPreview() {
    const c = $('#preview-char');
    if (!c || !window.OtuSprites) return;
    const pctx = c.getContext('2d');
    pctx.clearRect(0, 0, c.width, c.height);
    OtuSprites.drawPrisoner(pctx, 48, 70, 4.2, { ...appearance, facing: 1, number: '01' });
  }

  const saved = loadGuest();
  if (saved) {
    if (saved.nickname) $('#nick').value = saved.nickname;
    if (saved.fullName) $('#fullName').value = saved.fullName;
    if (saved.appearance) appearance = { ...appearance, ...saved.appearance };
    $('#nick-dem').textContent = `${$('#nick').value.length}/16`;
  }

  $('#btn-join').onclick = () => {
    $('#join-error').textContent = '';
    const nickname = $('#nick').value.trim();
    const fullName = $('#fullName').value.trim();
    const crimeId = $('#crime').value;
    const crimeCustom = $('#crimeCustom').value.trim();
    const sentenceId = $('#sentence').value;
    saveGuest({
      nickname, fullName, crimeId, crimeCustom, sentenceId, appearance,
      guestId: (saved && saved.guestId) || Math.random().toString(36).slice(2),
      prisonerNo: saved && saved.prisonerNo,
    });
    socket.emit('join', { nickname, fullName, crimeId, crimeCustom, sentenceId, appearance });
  };
  $('#nick').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btn-join').click(); });

  // --- 3D world ---
  function initWorld() {
    if (world3d) return world3d;
    world3d = new World3D($('#yard'));
    if (world3d.fallback) {
      toast('Thiết bị không hỗ trợ WebGL — thử trình duyệt khác.');
      return world3d;
    }
    world3d.onPos = (x, z, rotY) => socket.emit('pos', { x, z, rotY });
    world3d.start();
    setupJoystick();
    return world3d;
  }

  function setupJoystick() {
    const root = $('#joystick');
    const knob = $('#joy-knob');
    const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    root.hidden = !isTouch;
    if (!isTouch) return;
    let dragging = false;
    const max = 34;
    function setFromEvent(e) {
      const t = e.touches ? e.touches[0] : e;
      const rect = root.getBoundingClientRect();
      let dx = t.clientX - (rect.left + rect.width / 2);
      let dy = t.clientY - (rect.top + rect.height / 2);
      const len = Math.hypot(dx, dy) || 1;
      if (len > max) { dx = dx / len * max; dy = dy / len * max; }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      world3d.setJoystick(dx / max, dy / max, true);
    }
    function end() {
      dragging = false;
      knob.style.transform = 'translate(-50%,-50%)';
      world3d.setJoystick(0, 0, false);
    }
    root.addEventListener('touchstart', (e) => { dragging = true; setFromEvent(e); e.preventDefault(); }, { passive: false });
    root.addEventListener('touchmove', (e) => { if (dragging) { setFromEvent(e); e.preventDefault(); } }, { passive: false });
    root.addEventListener('touchend', end);
    root.addEventListener('touchcancel', end);
  }

  // --- HUD / panels ---
  function showGameUI(show) {
    ['#topbar', '#hud-left', '#actbar', '#botbar', '#hint-move'].forEach((s) => { $(s).hidden = !show; });
    if (show) $('#joystick').hidden = !(matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window);
    else $('#joystick').hidden = true;
  }

  function updateHud() {
    if (!me) return;
    $('#my-nick').textContent = me.nickname;
    $('#online-count').textContent = `${world.onlineCount || 0} online`;
    $('#stat-money-line').textContent = `💰 ${me.money}₫ · 🏆 ${me.gameWins || 0}`;
    $('#stat-bars-line').textContent = `❤️ ${me.health}/${me.maxHealth} · ⚡ ${me.energy}/${me.maxEnergy} · ⭐ ${me.reputation}`;
    $('#stat-sentence-line').textContent = `⚖️ Còn ${me.sentenceLeftDays} ngày · 🏅 ${me.rehabRatingLabel || 'Kém'} (${me.rehabPoints || 0}đ)`;
    $('#room-label').textContent = roomName(me.room);
    if (world.schedule) {
      const left = Math.max(0, Math.ceil((world.schedule.endsAt - Date.now()) / 1000));
      $('#schedule-banner').hidden = false;
      $('#schedule-text').textContent = `${world.schedule.emoji || ''} ${world.schedule.name} · còn ${left}s`;
    }
  }

  function openSide(mode) {
    sideMode = mode;
    const bang = $('#sidebang');
    bang.hidden = false;
    const titles = {
      jobs: ['Làm việc', 'Kiếm tiền & điểm cải tạo'],
      shop: ['Cửa hàng trại', 'Nâng cấp sinh hoạt'],
      games: ['Trò chơi', 'Caro & Kéo Búa Bao'],
      board: ['Bảng xếp hạng', 'Thắng / Cải tạo / Ra tù sớm'],
      achievements: ['Thành tích', 'Tiến độ & điểm cải tạo'],
      letter: ['Viết thư về nhà', 'Ghim lên Bảng Thư'],
      letters: ['Bảng Thư', 'Thư tù nhân'],
      chat: ['Chat trại', 'Nói chuyện với bạn tù'],
      stats: ['Trạng thái', 'Chỉ số & án'],
      profile: ['Hồ sơ tù nhân', 'Thẻ định danh'],
      more: ['Thêm', 'Cửa hàng · BXH · Hồ sơ · Hướng dẫn'],
      help: ['Hướng dẫn', 'Sinh hoạt & giảm án'],
    };
    const t = titles[mode] || ['—', ''];
    $('#side-title').textContent = t[0];
    $('#side-phu').textContent = t[1];
    const body = $('#side-body');
    if (mode === 'jobs') body.innerHTML = renderJobs();
    else if (mode === 'shop') body.innerHTML = renderShop();
    else if (mode === 'games') body.innerHTML = renderGames();
    else if (mode === 'board') body.innerHTML = renderBoard();
    else if (mode === 'achievements') body.innerHTML = renderAchievements();
    else if (mode === 'letter') body.innerHTML = renderLetterForm();
    else if (mode === 'letters') body.innerHTML = renderLettersHtml();
    else if (mode === 'chat') body.innerHTML = renderChat();
    else if (mode === 'stats') body.innerHTML = renderStats();
    else if (mode === 'profile') body.innerHTML = renderProfile();
    else if (mode === 'more') body.innerHTML = `
      <button class="btn" data-goto="shop">🛒 Cửa hàng</button>
      <button class="btn" data-goto="board">🏆 BXH</button>
      <button class="btn" data-goto="profile">🪪 Hồ sơ</button>
      <button class="btn" data-goto="letters">📋 Bảng Thư</button>
      <button class="btn" data-goto="achievements">🏅 Thành tích</button>
      <button class="btn" data-goto="help">❓ Hướng dẫn</button>
      <button class="btn" data-goto="rooms">🗺️ Đi khu vực</button>`;
    else if (mode === 'rooms') body.innerHTML = renderRooms();
    else if (mode === 'help') body.innerHTML = `
      <ul style="text-align:left;font-size:13px;line-height:1.5;padding-left:18px;margin:0">
        <li>Khai báo họ tên, tội danh, án → nhận thẻ tù nhân.</li>
        <li>Di chuyển: WASD / joystick / chạm sàn 3D.</li>
        <li>Làm việc, đúng lịch PA, thắng game, gửi thư → điểm cải tạo.</li>
        <li>Xếp loại Kém/TB/Khá/Tốt → hội đồng giảm án định kỳ.</li>
        <li>Vượt ngục thất bại: +15 ngày án. Mãn hạn = lễ ra tù.</li>
      </ul>`;
    bindSide(body);
  }

  function bindSide(body) {
    body.querySelectorAll('[data-goto]').forEach((b) => b.onclick = () => openSide(b.dataset.goto));
    body.querySelectorAll('[data-job]').forEach((b) => b.onclick = () => socket.emit('work', b.dataset.job));
    body.querySelectorAll('[data-buy]').forEach((b) => b.onclick = () => socket.emit('buy', b.dataset.buy));
    body.querySelectorAll('[data-start]').forEach((b) => b.onclick = () => socket.emit('startGame', { game: b.dataset.start, vs: b.dataset.vs }));
    body.querySelectorAll('[data-invite]').forEach((b) => b.onclick = () => socket.emit('startGame', { game: b.dataset.invite, vs: 'invite', targetId: b.dataset.id }));
    body.querySelectorAll('[data-room]').forEach((b) => b.onclick = () => { socket.emit('moveTo', b.dataset.room); toast('Đang tới ' + roomName(b.dataset.room)); });
    const lf = $('#letter-form');
    if (lf) lf.onsubmit = (e) => {
      e.preventDefault();
      const t = $('#letter-text').value.trim();
      if (t) { socket.emit('writeLetter', t); $('#letter-text').value = ''; openSide('letters'); }
    };
    const cf = $('#chat-form');
    if (cf) cf.onsubmit = (e) => {
      e.preventDefault();
      const t = $('#chat-input').value.trim();
      if (t) { socket.emit('chat', t); $('#chat-input').value = ''; }
    };
  }

  function renderJobs() {
    return Object.values(config.jobs || {}).map((j) => `
      <div class="job-row">
        <div style="flex:1"><b>${j.emoji} ${escapeHtml(j.name)}</b><div class="bang-phu">${escapeHtml(j.description)} · −${j.energyCost}⚡</div></div>
        <button class="btn pri" data-job="${j.id}">+₫</button>
      </div>`).join('');
  }
  function renderShop() {
    return Object.values(config.shop || {}).map((it) => {
      const lvl = (me && me.upgrades && me.upgrades[it.id]) || 0;
      const price = it.id === 'do_an' ? it.price : it.price * (lvl + 1);
      return `<div class="shop-row"><div style="flex:1"><b>${it.emoji} ${escapeHtml(it.name)}</b><div class="bang-phu">${escapeHtml(it.description)}${it.id !== 'do_an' ? ` · Lv ${lvl}/${it.maxLevel}` : ''}</div></div>
        <button class="btn" data-buy="${it.id}">${price}₫</button></div>`;
    }).join('');
  }
  function renderGames() {
    const others = (world.players || []).filter((p) => me && p.id !== me.id);
    return `<div style="display:flex;flex-direction:column;gap:8px">
      <button class="btn pri" data-start="caro" data-vs="npc">⬛ Cờ Caro vs Quản giáo</button>
      <button class="btn pri" data-start="rps" data-vs="npc">✊ Kéo Búa Bao vs Quản giáo</button>
      <div class="bang-phu">Mời người chơi:</div>
      ${others.length ? others.map((p) => `
        <button class="btn" data-invite="caro" data-id="${p.id}">Caro → ${escapeHtml(p.nickname)}</button>
        <button class="btn" data-invite="rps" data-id="${p.id}">KBB → ${escapeHtml(p.nickname)}</button>`).join('') : '<span class="bang-phu">Chưa có ai khác online.</span>'}
    </div>`;
  }
  function renderBoard() {
    const lb = world.leaderboard || {};
    const block = (title, rows, fmt) => `<h3 style="margin:10px 0 6px;font-size:14px;color:var(--gold)">${title}</h3>` +
      (rows && rows.length ? rows.map((r, i) => `<div class="board-row"><span class="rank">#${i + 1}</span><span style="flex:1">${escapeHtml(r.nickname)}</span><span style="color:var(--text-dim);font-size:12px">${fmt(r)}</span></div>`).join('') : '<div class="bang-phu">Trống</div>');
    return block('🏆 Thắng game', lb.wins, (r) => `🏆${r.gameWins}`) +
      block('🏅 Điểm cải tạo', lb.rehab, (r) => `${r.rehabPoints}đ · ${r.rehabRatingLabel || ''}`) +
      block('🕊️ Ra tù sớm nhất', lb.earlyRelease, (r) => `${r.daysServed}/${r.sentenceTotalDays} ngày`);
  }
  function renderAchievements() {
    const list = (me && me.achievements) || [];
    if (!list.length) return '<div class="bang-phu">Chưa có dữ liệu.</div>';
    return list.map((a) => {
      const pct = Math.min(100, Math.round((a.current / a.target) * 100));
      return `<div class="ach-row ${a.done ? 'done' : ''}">
        <div class="ach-top"><span>${a.done ? '✅' : '⬜'} <b>${escapeHtml(a.name)}</b></span><span>+${a.points}đ · ${a.current}/${a.target}</span></div>
        <div class="bang-phu">${escapeHtml(a.desc)}</div>
        <div class="ach-bar"><i style="width:${pct}%"></i></div>
      </div>`;
    }).join('');
  }
  function renderLetterForm() {
    return `<form class="letter-form" id="letter-form"><textarea id="letter-text" maxlength="160" placeholder="Gửi lời về nhà…"></textarea>
      <button class="btn pri" type="submit">Gửi thư</button>
      <button class="btn" type="button" data-goto="letters">Xem Bảng Thư</button></form>`;
  }
  function renderLettersHtml() {
    const list = world.letters || [];
    if (!list.length) return '<div class="bang-phu">Chưa có thư.</div>';
    return list.map((L) => `<div class="letter-item"><div class="who">${escapeHtml(L.nick)}</div><div>${escapeHtml(L.text)}</div></div>`).join('');
  }
  function renderChat() {
    const lines = chatLines.slice(-40).map((c) => c.type === 'system'
      ? `<div class="chat-line sys">${escapeHtml(c.text)}</div>`
      : `<div class="chat-line"><b>${escapeHtml(c.nick)}:</b> ${escapeHtml(c.text)}</div>`).join('');
    return `<div class="chat-log">${lines}</div><form class="chat-form" id="chat-form"><input id="chat-input" maxlength="200" placeholder="Nhắn…" /><button class="btn pri" type="submit">Gửi</button></form>`;
  }
  function renderStats() {
    if (!me) return '';
    return `<div class="pcard">
      <div class="pcard-row"><span>Máu</span><b>${me.health}/${me.maxHealth}</b></div>
      <div class="pcard-row"><span>Năng lượng</span><b>${me.energy}/${me.maxEnergy}</b></div>
      <div class="pcard-row"><span>Tiền</span><b>${me.money}₫</b></div>
      <div class="pcard-row"><span>Uy tín</span><b>${me.reputation}</b></div>
      <div class="pcard-row"><span>Án còn</span><b>${me.sentenceLeftDays} / ${me.sentenceTotalDays} ngày</b></div>
      <div class="pcard-row"><span>Đã ở</span><b>${me.daysServed || 0} ngày</b></div>
      <div class="pcard-row"><span>Cải tạo</span><b>${me.rehabRatingLabel} (${me.rehabPoints}đ)</b></div>
      <div class="pcard-row"><span>Ca làm</span><b>${me.workCount || 0}</b></div>
      <div class="pcard-row"><span>Thắng game</span><b>${me.gameWins || 0}</b></div>
    </div>`;
  }
  function renderProfile() {
    if (!me) return '';
    return `<div class="pcard">
      <div class="pcard-h">THẺ TÙ NHÂN</div>
      <div class="pcard-row"><span>Số hiệu</span><b>${escapeHtml(me.prisonerNo || '—')}</b></div>
      <div class="pcard-row"><span>Họ tên</span><b>${escapeHtml(me.fullName || me.nickname)}</b></div>
      <div class="pcard-row"><span>Biệt danh</span><b>${escapeHtml(me.nickname)}</b></div>
      <div class="pcard-row"><span>Tội danh</span><b>${escapeHtml(me.crimeLabel || '—')}</b></div>
      <div class="pcard-row"><span>Án còn lại</span><b>${me.sentenceLeftDays} ngày</b></div>
      <div class="pcard-row"><span>Xếp loại cải tạo</span><b>${escapeHtml(me.rehabRatingLabel || 'Kém')}</b></div>
      <div class="pcard-row"><span>Điểm cải tạo</span><b>${me.rehabPoints || 0}</b></div>
    </div>`;
  }
  function renderRooms() {
    return (config.rooms || []).map((r) => `
      <button class="btn" data-room="${r.id}" style="width:100%;margin:4px 0;text-align:left">${r.emoji} ${escapeHtml(r.name)}
        <span style="float:right;color:var(--text-dim)">${(world.roomCounts && world.roomCounts[r.id]) || 0}</span></button>`).join('');
  }

  $$('#actbar [data-act]').forEach((b) => {
    b.onclick = () => {
      const act = b.dataset.act;
      if (act === 'letter') openSide('letter');
      else socket.emit('action', act);
    };
  });
  $$('#botbar [data-open]').forEach((b) => b.onclick = () => openSide(b.dataset.open));
  $('#btn-escape').onclick = () => {
    if (!me) return;
    if (me.room !== 'tuong_rao') {
      toast('Đến Tường rào rồi hãy vượt ngục.');
      socket.emit('moveTo', 'tuong_rao');
      return;
    }
    if (!confirm('Vượt ngục? Thất bại sẽ +15 ngày án.')) return;
    socket.emit('escape');
  };
  $('#side-x').onclick = () => { $('#sidebang').hidden = true; sideMode = null; };
  $('#btn-panel-chat').onclick = () => openSide('chat');
  $('#btn-panel-stats').onclick = () => openSide('stats');
  $('#btn-panel-profile').onclick = () => openSide('profile');
  $('#btn-replay').onclick = () => location.reload();

  // --- Match UI ---
  function showMatch(m) {
    matchState = m;
    const overlay = $('#match-overlay');
    if (!m) { overlay.hidden = true; return; }
    overlay.hidden = false;
    const card = $('#match-card');
    if (m.game === 'caro') {
      const cells = m.board.map((row, y) => row.map((c, x) => {
        const mark = c === 1 ? 'X' : c === 2 ? 'O' : '';
        const dis = m.status !== 'playing' || m.turn !== m.youAre || c ? 'disabled' : '';
        return `<button class="caro-cell" data-x="${x}" data-y="${y}" ${dis}>${mark}</button>`;
      }).join('')).join('');
      card.innerHTML = `<h2>Cờ Caro</h2><p>${escapeHtml(m.message || '')}</p>
        <div class="caro-board">${cells}</div>
        <button class="btn" id="btn-close-match" type="button">Đóng</button>`;
      card.querySelectorAll('.caro-cell').forEach((b) => {
        b.onclick = () => socket.emit('caroMove', { matchId: m.id, x: +b.dataset.x, y: +b.dataset.y });
      });
    } else {
      card.innerHTML = `<h2>Kéo Búa Bao (BO3)</h2>
        <p>${escapeHtml(m.message || '')}</p>
        <p>Tỉ số: ${m.scores ? `${m.scores[1]} – ${m.scores[2]}` : ''}</p>
        <div class="rps-row">
          <button class="btn" data-rps="rock" ${m.status !== 'playing' ? 'disabled' : ''}>✊ Búa</button>
          <button class="btn" data-rps="paper" ${m.status !== 'playing' ? 'disabled' : ''}>✋ Bao</button>
          <button class="btn" data-rps="scissors" ${m.status !== 'playing' ? 'disabled' : ''}>✌️ Kéo</button>
        </div>
        <button class="btn" id="btn-close-match" type="button">Đóng</button>`;
      card.querySelectorAll('[data-rps]').forEach((b) => {
        b.onclick = () => socket.emit('rpsChoice', { matchId: m.id, choice: b.dataset.rps });
      });
    }
    const cl = $('#btn-close-match');
    if (cl) cl.onclick = () => socket.emit('closeMatch', { matchId: m.id });
  }

  // --- Socket ---
  socket.on('config', (c) => {
    config = { ...config, ...c };
    fillSelects();
    buildSwatches();
    drawPreview();
    updatePreviewCard();
    if (saved) {
      if (saved.crimeId) $('#crime').value = saved.crimeId;
      if (saved.sentenceId) $('#sentence').value = saved.sentenceId;
      if (saved.crimeId === 'custom') {
        $('#crimeCustom').hidden = false;
        if (saved.crimeCustom) $('#crimeCustom').value = saved.crimeCustom;
      }
      updatePreviewCard();
    }
  });

  socket.on('joined', (info) => {
    $('#join-screen').hidden = true;
    showGameUI(true);
    const g = loadGuest() || {};
    g.prisonerNo = info.prisonerNo || g.prisonerNo;
    saveGuest(g);
    initWorld();
    toast(`Chào mừng ${info.nickname} · ${info.prisonerNo || ''}`);
  });

  socket.on('me', (p) => {
    me = p;
    updateHud();
    if (world3d && !world3d.fallback) {
      if (!world3d.myId) {
        world3d.setMe(p.id, p.appearance, p.x, p.z);
      } else if (world3d.myId !== p.id) {
        world3d.setMe(p.id, p.appearance, p.x, p.z);
      }
    }
    if (sideMode === 'stats' || sideMode === 'profile' || sideMode === 'achievements') openSide(sideMode);
  });

  socket.on('world', (w) => {
    world = { ...world, ...w };
    updateHud();
    if (world3d && !world3d.fallback) world3d.syncPlayers(w.players || []);
    if (sideMode === 'board' || sideMode === 'games' || sideMode === 'rooms') openSide(sideMode);
  });

  socket.on('poses', (list) => {
    if (world3d && !world3d.fallback) world3d.applyPoses(list || []);
  });

  socket.on('chatHistory', (list) => { chatLines = list || []; });
  socket.on('chat', (entry) => {
    chatLines.push(entry);
    if (chatLines.length > 100) chatLines.shift();
    if (sideMode === 'chat') openSide('chat');
  });
  socket.on('schedule', (sch) => { world.schedule = sch; updateHud(); });
  socket.on('letters', (list) => { world.letters = list; if (sideMode === 'letters') openSide('letters'); });
  socket.on('errorMsg', (msg) => {
    if (!$('#join-screen').hidden) $('#join-error').textContent = msg;
    else toast(msg);
  });
  socket.on('actionResult', (r) => toast(r.message || ''));
  socket.on('workResult', (r) => toast(`${r.jobName}: +${r.pay}₫`));
  socket.on('buyResult', (r) => toast(r.message || ''));
  socket.on('achievement', (a) => toast(a.message || `🏅 ${a.name}`));
  socket.on('sentenceReview', (r) => toast(r.message || ''));
  socket.on('match', showMatch);
  socket.on('gameInvite', (inv) => {
    const el = $('#invite-toast');
    el.hidden = false;
    el.innerHTML = `<b>${escapeHtml(inv.fromNick)}</b> mời bạn chơi ${inv.game === 'caro' ? 'Cờ Caro' : 'Kéo Búa Bao'}.
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn pri" id="inv-ok">Chấp nhận</button>
        <button class="btn" id="inv-no">Từ chối</button>
      </div>`;
    $('#inv-ok').onclick = () => { socket.emit('respondInvite', { id: inv.id, accept: true }); el.hidden = true; };
    $('#inv-no').onclick = () => { socket.emit('respondInvite', { id: inv.id, accept: false }); el.hidden = true; };
  });
  socket.on('escapeResult', (r) => {
    $('#escape-overlay').hidden = false;
    $('#escape-title').textContent = r.success ? 'Vượt ngục thành công!' : 'Vượt ngục thất bại';
    $('#escape-detail').textContent = r.message || '';
    if (!r.success) setTimeout(() => { $('#escape-overlay').hidden = true; }, 2800);
  });
  socket.on('released', (r) => {
    $('#escape-overlay').hidden = false;
    $('#escape-title').textContent = r.early ? '🕊️ Ra tù sớm!' : '🕊️ Mãn hạn';
    $('#escape-detail').textContent = `${r.message}\nĐã ở ${r.daysServed}/${r.sentenceTotalDays} ngày in-game.`;
  });

  // schedule banner tick
  setInterval(updateHud, 1000);
})();
