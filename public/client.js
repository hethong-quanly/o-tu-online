/* global io, OtuSprites, World3D */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];

  let config = { jobs: {}, shop: {}, rooms: [], appearance: null, crimes: [], sentences: [], achievements: [], npcCount: 16, maxPlayers: 10000 };
  let me = null;
  let world = { players: [], roomCounts: {}, leaderboard: { wins: [], rehab: [], earlyRelease: [] }, onlineCount: 0, npcCount: 16, letters: [], schedule: null, totalDaysMarked: 0 };
  let sideMode = null;
  let appearance = { skin: '#e8b896', hair: '#2a2218', stripe: 'orange' };
  let chatLines = [];
  let chatTab = 'all';
  let world3d = null;
  const otuAudio = (typeof OtuAudio !== 'undefined') ? new OtuAudio() : null;
  let pendingMe = null;
  let matchState = null;
  let nightMode = false;

  const LS_KEY = 'otu_guest_v3';
  const socket = io({ transports: ['websocket', 'polling'] });

  function loadGuest() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || localStorage.getItem('otu_guest_v2') || 'null'); } catch { return null; }
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
  function roomCode(id) {
    if (id === 'phong_a') return 'A-' + ((me && me.prisonerNo) ? String(me.prisonerNo).slice(-2) : '12');
    if (id === 'phong_b') return 'B-01';
    return (config.rooms || []).find((x) => x.id === id)?.name || id;
  }

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
    const skins = (config.appearance && config.appearance.skins) || ['#e8b896', '#c68642', '#8d5524', '#f1c27d', '#ffdbac'];
    const hairs = (config.appearance && config.appearance.hairs) || ['#2a2218', '#1a1a1a', '#5a3a1a', '#c4a35a', '#4a2020', '#708090'];
    const stripes = (config.appearance && config.appearance.stripes) || [
      { id: 'orange', name: 'Áo cam' },
      { id: 'bw', name: 'Sọc trắng–đen' },
      { id: 'blue', name: 'Sọc xanh' },
    ];
    const skinEl = $('#skin-swatches'), hairEl = $('#hair-swatches'), stripeEl = $('#stripe-swatches');
    skinEl.innerHTML = skins.map((c) => `<button type="button" class="${appearance.skin === c ? 'on' : ''}" data-skin="${c}" style="background:${c}"></button>`).join('');
    hairEl.innerHTML = hairs.map((c) => `<button type="button" class="${appearance.hair === c ? 'on' : ''}" data-hair="${c}" style="background:${c}"></button>`).join('');
    stripeEl.innerHTML = stripes.map((s) => `<button type="button" class="${appearance.stripe === s.id ? 'on' : ''}" data-stripe="${s.id}">${s.name}</button>`).join('');
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

  function syncAudioUnlockBanner() {
    const btn = $('#audio-unlock');
    if (!btn || !otuAudio) return;
    const running = otuAudio.state() === 'running';
    btn.hidden = running;
    if (running) btn.setAttribute('aria-hidden', 'true');
  }

  function unlockAudio(ev) {
    if (!otuAudio) return;
    const p = otuAudio.resume();
    if (p && typeof p.then === 'function') {
      p.then((ok) => {
        syncAudioUnlockBanner();
        if (ok && otuAudio.musicOn) {
          /* music loop starts itself once ctx running */
        }
      }).catch(() => syncAudioUnlockBanner());
    } else {
      syncAudioUnlockBanner();
    }
  }
  ['pointerdown', 'touchstart', 'keydown'].forEach((ev) => {
    window.addEventListener(ev, unlockAudio, { once: false, passive: true });
  });
  const audioUnlockBtn = $('#audio-unlock');
  if (audioUnlockBtn) {
    audioUnlockBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      unlockAudio(e);
      if (otuAudio) {
        otuAudio.setMusic(true);
        otuAudio.setSfx(true);
        refreshAudioBtns();
        otuAudio.click();
      }
      syncAudioUnlockBanner();
    });
  }
  // Show banner until unlocked (first entry / iOS)
  setTimeout(syncAudioUnlockBanner, 400);
  setInterval(syncAudioUnlockBanner, 1500);


  function initWorld() {
    if (world3d) return world3d;
    world3d = window.__world3d = new World3D($('#yard'));
    if (world3d.fallback) {
      toast('Thiết bị không hỗ trợ WebGL — thử trình duyệt khác.');
      return world3d;
    }
    world3d.onPos = (x, z, rotY) => socket.emit('pos', { x, z, rotY });
    world3d.onStep = () => { if (otuAudio) otuAudio.footstep(); };
    world3d.start();
    setupJoystick();
    if (pendingMe) {
      world3d.setMe(pendingMe.id, pendingMe.appearance, pendingMe.x, pendingMe.z);
      pendingMe = null;
    } else if (me) {
      world3d.setMe(me.id, me.appearance, me.x, me.z);
    }
    return world3d;
  }

  function setupJoystick() {
    const root = $('#joystick');
    const knob = $('#joy-knob');
    const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || window.innerWidth < 700;
    root.hidden = !isTouch;
    $('#mob-actions').hidden = !isTouch;
    if (!isTouch) return;
    let dragging = false;
    const max = 38;
    function setFromEvent(e) {
      const t = e.touches ? e.touches[0] : e;
      const rect = root.getBoundingClientRect();
      let dx = t.clientX - (rect.left + rect.width / 2);
      let dy = t.clientY - (rect.top + rect.height / 2);
      const len = Math.hypot(dx, dy) || 1;
      if (len > max) { dx = dx / len * max; dy = dy / len * max; }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      if (world3d) world3d.setJoystick(dx / max, dy / max, true);
    }
    function end() {
      dragging = false;
      knob.style.transform = 'translate(-50%,-50%)';
      if (world3d) world3d.setJoystick(0, 0, false);
    }
    root.addEventListener('touchstart', (e) => { dragging = true; setFromEvent(e); e.preventDefault(); }, { passive: false });
    root.addEventListener('touchmove', (e) => { if (dragging) { setFromEvent(e); e.preventDefault(); } }, { passive: false });
    root.addEventListener('touchend', end);
    root.addEventListener('touchcancel', end);
  }

  function showGameUI(show) {
    ['#info-card', '#top-tools', '#dock', '#right-menu', '#chat-panel'].forEach((s) => { $(s).hidden = !show; });
    const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || window.innerWidth < 700;
    if (show) {
      $('#joystick').hidden = !isTouch;
      $('#mob-actions').hidden = !isTouch;
      if (isTouch) {
        $('#chat-panel').classList.add('collapsed');
      }
    } else {
      $('#joystick').hidden = true;
      $('#mob-actions').hidden = true;
      $('#chat-fab').hidden = true;
    }
  }

  function updateHud() {
    if (!me) return;
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const schName = world.schedule ? world.schedule.name : 'Giờ tự do';
    $('#info-time').textContent = `${hh}:${mm} · ${schName}`;
    const npc = world.npcCount != null ? world.npcCount : (config.npcCount || 16);
    $('#info-online').textContent = `👤 ${world.onlineCount || 0} thật · 🤖 ${npc} NPC`;
    $('#info-days').textContent = `✏️ Đã gạch: ${(world.totalDaysMarked || me.daysMarked || 0).toLocaleString('vi-VN')} ngày`;
    $('#info-room').textContent = `🚪 Phòng của bạn: ${roomCode(me.room)}`;
    $('#info-sentence').textContent = `⚖️ Còn ${me.sentenceLeftDays} ngày · 🏅 ${me.rehabRatingLabel || 'Kém'} (${me.rehabPoints || 0}đ)`;
    const rk = me.rank || {};
    const rankEl = $('#info-rank');
    if (rankEl) {
      const next = rk.nextXp != null ? ` · tới ${rk.nextName || '?'} ${rk.nextXp}XP` : ' · MAX';
      rankEl.textContent = `${rk.emoji || '🐣'} Hạng: ${rk.name || 'Tù mới'} · ${rk.xp || me.rankXp || 0} XP${next}`;
    }
    if (world.schedule) {
      const left = Math.max(0, Math.ceil((world.schedule.endsAt - Date.now()) / 1000));
      $('#schedule-banner').hidden = false;
      $('#schedule-text').textContent = `${world.schedule.emoji || ''} ${world.schedule.name} · còn ${left}s`;
    }
    renderChatLog();
  }

  function renderChatLog() {
    const log = $('#chat-log');
    if (!log) return;
    let lines = chatLines.slice(-50);
    if (chatTab === 'pm') lines = lines.filter((c) => c.type === 'pm');
    else if (chatTab === 'match') lines = lines.filter((c) => c.type === 'match' || (c.text && /Caro|Kéo|KBB|trận/i.test(c.text)));
    log.innerHTML = lines.map((c) => c.type === 'system'
      ? `<div class="sys">${escapeHtml(c.text)}</div>`
      : `<div class="msg"><b>${escapeHtml(c.nick || '?')}:</b> ${escapeHtml(c.text)}</div>`).join('');
    log.scrollTop = log.scrollHeight;
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
      achievements: ['Vinh danh · Thành tích', 'Tiến độ & điểm cải tạo'],
      letter: ['Viết thư về nhà', 'Ghim lên Bảng Thư'],
      letters: ['Bảng Thư', 'Thư tù nhân'],
      stats: ['Trạng thái', 'Chỉ số & án'],
      profile: ['Khoe · Hồ sơ', 'Thẻ định danh'],
      more: ['Thêm', 'Cửa hàng · Vượt ngục · Phòng'],
      rooms: ['Khu vực', 'Di chuyển nhanh'],
      help: ['Hướng dẫn', ''],
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
    else if (mode === 'stats') body.innerHTML = renderStats();
    else if (mode === 'profile') body.innerHTML = renderProfile();
    else if (mode === 'rooms') body.innerHTML = renderRooms();
    else if (mode === 'more') body.innerHTML = `
      <div class="grid2">
        <button class="card-btn" data-goto="shop"><b>🛒 Cửa hàng</b></button>
        <button class="card-btn" data-goto="letters"><b>📋 Bảng Thư</b></button>
        <button class="card-btn" data-goto="stats"><b>❤️ Chỉ số</b></button>
        <button class="card-btn" data-goto="rooms"><b>🗺️ Khu vực</b></button>
      </div>
      <div style="margin-top:12px;padding:10px;border-radius:12px;background:rgba(0,0,0,.25)">
        <b>👀 Hối lộ cán bộ</b>
        <p class="ghi" style="margin:6px 0">Giá: ${me ? (me.bribePrice || 50) : 50}₫ (tiền trong game). ${me && me.bribeActive ? '✅ Đang có cửa sổ hối lộ' : '⚠️ Chưa hối lộ — vượt gần như không thể'}</p>
        <button class="btn pri" id="btn-bribe" type="button">💸 Hối lộ cán bộ gần nhất</button>
      </div>
      <button class="btn big" id="btn-escape" type="button" style="margin-top:10px">🏃 Vượt ngục</button>
      <p class="ghi">Cần hối lộ trước. Không hối lộ → gần như chắc bị bắt. Thất bại = +15 ngày án.</p>`;
    else body.innerHTML = '';
    bindSide(body);
    const esc = $('#btn-escape');
    if (esc) esc.onclick = tryEscape;
    const bribe = $('#btn-bribe');
    if (bribe) bribe.onclick = () => {
      unlockAudio();
      if (otuAudio) otuAudio.coin();
      socket.emit('bribeGuard', null);
    };
  }

  function tryEscape() {
    if (!me) return;
    if (me.room !== 'tuong_rao') {
      toast('Đến Sân chơi / Tường rào rồi hãy vượt ngục.');
      socket.emit('moveTo', 'tuong_rao');
      return;
    }
    if (!me.bribeActive) {
      toast('Chưa hối lộ cán bộ — vượt gần như không thể. Bấm Hối lộ trước!');
      return;
    }
    if (!confirm('Vượt ngục lúc cán bộ đang “quay đi”? Thất bại = +15 ngày án.')) return;
    unlockAudio();
    socket.emit('escape');
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
  }

  function renderJobs() {
    return Object.values(config.jobs || {}).map((j) => `
      <div class="list"><li>
        <div><b>${j.emoji} ${escapeHtml(j.name)}</b><div class="meta">${escapeHtml(j.description)} · −${j.energyCost}⚡</div></div>
        <button class="btn pri sm" data-job="${j.id}">+₫</button>
      </li></div>`).join('');
  }
  function renderShop() {
    return Object.values(config.shop || {}).map((it) => {
      const lvl = (me && me.upgrades && me.upgrades[it.id]) || 0;
      const price = it.id === 'do_an' ? it.price : it.price * (lvl + 1);
      return `<div class="list"><li><div><b>${it.emoji} ${escapeHtml(it.name)}</b><div class="meta">${escapeHtml(it.description)}${it.id !== 'do_an' ? ` · Lv ${lvl}/${it.maxLevel}` : ''}</div></div>
        <button class="btn sm" data-buy="${it.id}">${price}₫</button></li></div>`;
    }).join('');
  }
  function renderGames() {
    const others = (world.players || []).filter((p) => me && p.id !== me.id);
    return `<div style="display:flex;flex-direction:column;gap:8px">
      <button class="btn pri" data-start="caro" data-vs="npc">⬛ Cờ Caro vs Quản giáo</button>
      <button class="btn pri" data-start="rps" data-vs="npc">✊ Kéo Búa Bao vs Quản giáo</button>
      <div class="meta">Mời người chơi (tên xanh):</div>
      ${others.length ? others.map((p) => `
        <button class="btn" data-invite="caro" data-id="${p.id}">Caro → ${escapeHtml(p.nickname)}</button>
        <button class="btn" data-invite="rps" data-id="${p.id}">KBB → ${escapeHtml(p.nickname)}</button>`).join('') : '<span class="meta">Chưa có ai khác online.</span>'}
    </div>`;
  }
  function renderBoard() {
    const lb = world.leaderboard || {};
    const block = (title, rows, fmt) => `<h3 style="margin:10px 0 6px;font-size:14px;color:var(--accent)">${title}</h3>` +
      (rows && rows.length ? rows.map((r, i) => `<div class="list"><li><span>#${i + 1} ${escapeHtml(r.nickname)}</span><span class="meta">${fmt(r)}</span></li></div>`).join('') : '<div class="meta">Trống</div>');
    return block('🎖️ Hạng tù nhân', lb.ranks, (r) => `${r.rankEmoji || ''} ${r.rankName || ''} · ${r.rankXp || 0}XP`) +
      block('🏆 Thắng game', lb.wins, (r) => `🏆${r.gameWins}`) +
      block('🏅 Điểm cải tạo', lb.rehab, (r) => `${r.rehabPoints}đ · ${r.rehabRatingLabel || ''}`) +
      block('🕊️ Ra tù sớm nhất', lb.earlyRelease, (r) => `${r.daysServed}/${r.sentenceTotalDays} ngày`);
  }
  function renderAchievements() {
    const list = (me && me.achievements) || [];
    if (!list.length) return '<div class="meta">Chưa có dữ liệu.</div>';
    return list.map((a) => {
      const pct = Math.min(100, Math.round((a.current / a.target) * 100));
      return `<div style="margin:8px 0;padding:8px;border:1px solid var(--line);border-radius:10px">
        <div style="display:flex;justify-content:space-between;font-size:13px"><span>${a.done ? '✅' : '⬜'} <b>${escapeHtml(a.name)}</b></span><span>+${a.points}đ · ${a.current}/${a.target}</span></div>
        <div class="meta">${escapeHtml(a.desc)}</div>
        <div class="progress"><i style="width:${pct}%"></i></div>
      </div>`;
    }).join('');
  }
  function renderLetterForm() {
    return `<form id="letter-form"><textarea id="letter-text" maxlength="160" placeholder="Gửi lời về nhà…" rows="4" style="width:100%"></textarea>
      <button class="btn pri big" type="submit">Gửi thư</button>
      <button class="btn" type="button" data-goto="letters" style="width:100%;margin-top:8px">Xem Bảng Thư</button></form>`;
  }
  function renderLettersHtml() {
    const list = world.letters || [];
    if (!list.length) return '<div class="meta">Chưa có thư.</div>';
    return list.map((L) => `<div style="padding:8px 0;border-bottom:1px solid var(--line)"><b style="color:var(--green)">${escapeHtml(L.nick)}</b><div>${escapeHtml(L.text)}</div></div>`).join('');
  }
  function renderStats() {
    if (!me) return '';
    return `<div class="pcard">
      <div class="pcard-row"><span>Máu</span><b>${me.health}/${me.maxHealth}</b></div>
      <div class="pcard-row"><span>Năng lượng</span><b>${me.energy}/${me.maxEnergy}</b></div>
      <div class="pcard-row"><span>Tiền</span><b>${me.money}₫</b></div>
      <div class="pcard-row"><span>Án còn</span><b>${me.sentenceLeftDays} / ${me.sentenceTotalDays} ngày</b></div>
      <div class="pcard-row"><span>Cải tạo</span><b>${me.rehabRatingLabel} (${me.rehabPoints}đ)</b></div>
      <div class="pcard-row"><span>Thắng game</span><b>${me.gameWins || 0}</b></div>
      <div class="pcard-row"><span>Hạng</span><b>${(me.rank && me.rank.emoji) || '🐣'} ${(me.rank && me.rank.name) || 'Tù mới'} · ${me.rankXp || 0}XP</b></div>
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
      <div class="pcard-row"><span>Xếp loại</span><b>${escapeHtml(me.rehabRatingLabel || 'Kém')}</b></div>
      <div class="pcard-row"><span>Điểm cải tạo</span><b>${me.rehabPoints || 0}</b></div>
      <div class="pcard-row"><span>Tiền / thắng</span><b>${me.money}₫ · 🏆${me.gameWins || 0}</b></div>
      <div class="pcard-row"><span>Hạng tù nhân</span><b>${(me.rank && me.rank.emoji) || '🐣'} ${(me.rank && me.rank.name) || 'Tù mới'}</b></div>
      <div class="pcard-row"><span>XP hạng</span><b>${me.rankXp || 0}${(me.rank && me.rank.nextXp != null) ? ' / ' + me.rank.nextXp : ''}</b></div>
      <div class="pcard-row"><span>Ưu đãi hạng</span><b>+${Math.round(((me.rank && me.rank.payBonus) || 0) * 100)}% lương · −${Math.round(((me.rank && me.rank.shopDiscount) || 0) * 100)}% shop</b></div>
    </div>`;
  }
  function renderRooms() {
    return (config.rooms || []).map((r) => `
      <button class="btn" data-room="${r.id}" style="width:100%;margin:4px 0;text-align:left">${r.emoji} ${escapeHtml(r.name)}
        <span style="float:right;color:var(--dim)">${(world.roomCounts && world.roomCounts[r.id]) || 0}</span></button>`).join('');
  }

  // Dock actions
  $$('#dock [data-act]').forEach((b) => {
    b.onclick = () => {
      unlockAudio();
      const act = b.dataset.act;
      if (act === 'letter') openSide('letter');
      else socket.emit('action', act);
    };
  });
  $('#dock-chat').onclick = () => {
    const panel = $('#chat-panel');
    panel.hidden = false;
    panel.classList.toggle('collapsed');
    $('#chat-fab').hidden = true;
  };
  $$('#right-menu [data-open]').forEach((b) => b.onclick = () => openSide(b.dataset.open));
  $('#side-x').onclick = () => { $('#sidebang').hidden = true; sideMode = null; };
  $('#btn-replay').onclick = () => location.reload();

  // Chat tabs / toggle
  $$('.ctab').forEach((t) => t.onclick = () => {
    $$('.ctab').forEach((x) => x.classList.remove('on'));
    t.classList.add('on');
    chatTab = t.dataset.tab;
    renderChatLog();
  });
  $('#chat-toggle').onclick = () => {
    $('#chat-panel').classList.toggle('collapsed');
  };
  $('#chat-fab').onclick = () => {
    $('#chat-panel').hidden = false;
    $('#chat-panel').classList.remove('collapsed');
    $('#chat-fab').hidden = true;
  };
  $('#chat-form').onsubmit = (e) => {
    e.preventDefault();
    const t = $('#chat-input').value.trim();
    if (t) {
      socket.emit('chat', t);
      if (world3d && me) world3d.showBubble(me.id, t, 4500);
      $('#chat-input').value = '';
    }
  };

  // Mobile quick actions
  $('#mob-wave').onclick = () => socket.emit('action', 'wave');
  $('#mob-sit').onclick = () => socket.emit('action', 'sit');

  // Top tools
  $('#btn-help').onclick = () => { $('#help-modal').hidden = false; };
  $('#btn-help-ok').onclick = () => { $('#help-modal').hidden = true; };
  $('#btn-fs').onclick = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  };
  $('#btn-shadows').onclick = () => {
    if (!world3d || world3d.fallback) return;
    world3d.setShadows(!world3d.shadowsOn);
    toast(world3d.shadowsOn ? 'Đổ bóng: BẬT' : 'Đổ bóng: TẮT (nhẹ máy)');
  };
  $('#btn-night').onclick = () => {
    nightMode = !nightMode;
    if (world3d && !world3d.fallback) {
      world3d.renderer.setClearColor(nightMode ? 0x1a2030 : 0xb8d4f0, 1);
      if (world3d.scene.fog) world3d.scene.fog.color.set(nightMode ? 0x1a2030 : 0xb8d4f0);
      world3d.sun.intensity = nightMode ? 0.25 : 0.85;
    }
    toast(nightMode ? 'Chế độ đêm' : 'Chế độ ngày');
  };
  function refreshAudioBtns() {
    const m = $('#btn-music');
    const s = $('#btn-sfx');
    if (m) m.textContent = (otuAudio && otuAudio.musicOn) ? '🎵' : '🔇';
    if (s) s.textContent = (otuAudio && otuAudio.sfxOn) ? '🔊' : '🔈';
    if (m) m.title = (otuAudio && otuAudio.musicOn) ? 'Tắt nhạc' : 'Bật nhạc';
    if (s) s.title = (otuAudio && otuAudio.sfxOn) ? 'Tắt SFX' : 'Bật SFX';
  }
  refreshAudioBtns();
  $('#btn-music').onclick = () => {
    unlockAudio();
    if (!otuAudio) { toast('Trình duyệt không hỗ trợ WebAudio'); return; }
    const on = otuAudio.toggleMusic();
    refreshAudioBtns();
    toast(on ? 'Nhạc nền: BẬT' : 'Nhạc nền: TẮT');
  };
  const sfxBtn = $('#btn-sfx');
  if (sfxBtn) sfxBtn.onclick = () => {
    unlockAudio();
    if (!otuAudio) return;
    const on = otuAudio.toggleSfx();
    refreshAudioBtns();
    toast(on ? 'Âm thanh: BẬT' : 'Âm thanh: TẮT');
  };

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
          <button class="btn" data-rps="rock" ${m.status !== 'playing' ? 'disabled' : ''}>✊</button>
          <button class="btn" data-rps="paper" ${m.status !== 'playing' ? 'disabled' : ''}>✋</button>
          <button class="btn" data-rps="scissors" ${m.status !== 'playing' ? 'disabled' : ''}>✌️</button>
        </div>
        <button class="btn" id="btn-close-match" type="button">Đóng</button>`;
      card.querySelectorAll('[data-rps]').forEach((b) => {
        b.onclick = () => socket.emit('rpsChoice', { matchId: m.id, choice: b.dataset.rps });
      });
    }
    const cl = $('#btn-close-match');
    if (cl) cl.onclick = () => socket.emit('closeMatch', { matchId: m.id });
  }

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
    const wb = $('#welcome-banner');
    wb.hidden = false;
    wb.textContent = `Chào ${info.nickname}! Số hiệu ${info.prisonerNo || ''} — cải tạo tốt sẽ được giảm án!`;
    setTimeout(() => { wb.hidden = true; }, 5000);
    toast(`Chào mừng ${info.nickname}`);
    syncAudioUnlockBanner();
    if (!localStorage.getItem('otu_help_seen')) {
      $('#help-modal').hidden = false;
      localStorage.setItem('otu_help_seen', '1');
    }
  });

  socket.on('me', (p) => {
    me = p;
    updateHud();
    if (!world3d) {
      pendingMe = p;
    } else if (!world3d.fallback) {
      if (!world3d.myId || world3d.myId !== p.id) {
        world3d.setMe(p.id, p.appearance, p.x, p.z);
      }
      const mesh = world3d.players.get(p.id);
      if (mesh) {
        mesh.userData.nickname = p.nickname;
        mesh.userData.prisonerNo = p.prisonerNo;
        mesh.userData.emote = p.emote;
        mesh.userData.rankEmoji = (p.rank && p.rank.emoji) || '🐣';
        mesh.userData.rankName = (p.rank && p.rank.name) || 'Tù mới';
      }
      // cooking ambience in kitchen
      if (p.room === 'nha_bep' && otuAudio) otuAudio.cook();
    }
    if (sideMode === 'stats' || sideMode === 'profile' || sideMode === 'achievements' || sideMode === 'more') openSide(sideMode);
  });

  socket.on('world', (w) => {
    world = { ...world, ...w };
    updateHud();
    if (world3d && !world3d.fallback) {
      world3d.syncPlayers(w.players || []);
      if (w.guards) world3d.syncGuards(w.guards);
    }
    if (sideMode === 'board' || sideMode === 'games' || sideMode === 'rooms') openSide(sideMode);
  });

  socket.on('poses', (list) => {
    if (world3d && !world3d.fallback) world3d.applyPoses(list || []);
  });
  socket.on('guards', (list) => {
    if (world3d && !world3d.fallback) world3d.syncGuards(list || []);
  });

  socket.on('chatHistory', (list) => { chatLines = list || []; renderChatLog(); });
  socket.on('chat', (entry) => {
    chatLines.push(entry);
    if (chatLines.length > 100) chatLines.shift();
    renderChatLog();
    if (entry && entry.nick && entry.type !== 'system' && world3d) {
      const pl = (world.players || []).find((p) => p.nickname === entry.nick);
      if (pl) world3d.showBubble(pl.id, entry.text, 4000);
    }
  });
  socket.on('schedule', (sch) => { world.schedule = sch; updateHud(); });
  socket.on('letters', (list) => { world.letters = list; if (sideMode === 'letters') openSide('letters'); });
  socket.on('errorMsg', (msg) => {
    if (!$('#join-screen').hidden) $('#join-error').textContent = msg;
    else toast(msg);
  });
  socket.on('rankUp', (payload) => {
    const msg = (payload && payload.message) || 'Thăng hạng!';
    toast(msg);
    let toastEl = document.createElement('div');
    toastEl.className = 'rank-toast';
    toastEl.textContent = msg;
    document.body.appendChild(toastEl);
    setTimeout(() => toastEl.remove(), 4200);
    unlockAudio();
    if (otuAudio) otuAudio.rankUp();
    if (payload && payload.rank && me) {
      me.rank = payload.rank;
      me.rankXp = payload.rank.xp;
      updateHud();
    }
  });
  socket.on('actionResult', (r) => {
    toast(r.message || '');
    if (r && r.kind === 'pushup' && otuAudio) { unlockAudio(); otuAudio.pushup(); }
  });
  socket.on('bribeResult', (r) => {
    toast(r.message || '');
    if (otuAudio) { unlockAudio(); otuAudio.coin(); }
    if (me) { me.bribeActive = !!r.ok; me.bribeUntil = r.until; }
    if (sideMode === 'more') openSide('more');
  });
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
    if (otuAudio) { unlockAudio(); otuAudio.alert(); }
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

  setInterval(updateHud, 1000);
})();
