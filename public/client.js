/* global io, OtuSprites, World3D */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];

  let config = { jobs: {}, shop: {}, rooms: [], appearance: null, crimes: [], sentences: [], achievements: [], npcCount: 16, maxPlayers: 10000 };
  let me = null;
  let world = { players: [], roomCounts: {}, leaderboard: { wins: [], rehab: [], earlyRelease: [] }, onlineCount: 0, npcCount: 16, letters: [], schedule: null, totalDaysMarked: 0 };
  let sideMode = null;
  let appearance = { skin: '#e8b896', hair: '#2a2218', country: 'vn', gender: 'nam', bodyStyle: 'male', hairStyle: 'default', rainbowBadge: false, stripe: 'bw' };
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

  function countryLabel(id) {
    const c = ((config.appearance && config.appearance.countries) || [
      { id: 'vn', name: 'Việt Nam' }, { id: 'us', name: 'Mỹ' }, { id: 'cn', name: 'Trung Quốc' }, { id: 'other', name: 'Khác' },
    ]).find((x) => x.id === id);
    return c ? c.name : id;
  }
  function genderLabel(id) {
    const g = ((config.appearance && config.appearance.genders) || [
      { id: 'nam', name: 'Nam' }, { id: 'nu', name: 'Nữ' }, { id: 'lgbt', name: 'LGBT' },
    ]).find((x) => x.id === id);
    return g ? g.name : id;
  }
  function syncUniformFromCountry() {
    const map = { vn: 'bw', us: 'orange', cn: 'blue', other: 'brown' };
    appearance.stripe = map[appearance.country] || 'bw';
    const hints = {
      vn: 'Đồng phục: quần áo sọc đen–trắng dọc (VN) · không nón',
      us: 'Đồng phục: nguyên bộ cam (Mỹ) · không nón',
      cn: 'Đồng phục: sọc xanh–trắng (TQ) · không nón',
      other: 'Đồng phục: nguyên bộ nâu · không nón',
    };
    const el = $('#uniform-hint');
    if (el) el.textContent = hints[appearance.country] || hints.vn;
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
    const pvc = $('#pv-country'); if (pvc) pvc.textContent = countryLabel(appearance.country);
    const pvg = $('#pv-gender'); if (pvg) pvg.textContent = genderLabel(appearance.gender);
  }

  function buildSwatches() {
    const skins = (config.appearance && config.appearance.skins) || ['#e8b896', '#c68642', '#8d5524', '#f1c27d', '#ffdbac'];
    const hairs = (config.appearance && config.appearance.hairs) || ['#2a2218', '#1a1a1a', '#5a3a1a', '#c4a35a', '#4a2020', '#708090'];
    const countries = (config.appearance && config.appearance.countries) || [
      { id: 'vn', name: 'Việt Nam' }, { id: 'us', name: 'Mỹ' }, { id: 'cn', name: 'Trung Quốc' }, { id: 'other', name: 'Khác' },
    ];
    const genders = (config.appearance && config.appearance.genders) || [
      { id: 'nam', name: 'Nam' }, { id: 'nu', name: 'Nữ' }, { id: 'lgbt', name: 'LGBT' },
    ];
    const hairStyles = (config.appearance && config.appearance.hairStyles) || [
      { id: 'default', name: 'Mặc định' }, { id: 'short', name: 'Ngắn' }, { id: 'long', name: 'Dài' }, { id: 'bun', name: 'Buộc' }, { id: 'worker', name: 'Công nhân' },
    ];
    syncUniformFromCountry();
    const skinEl = $('#skin-swatches'), hairEl = $('#hair-swatches');
    const countryEl = $('#country-swatches'), genderEl = $('#gender-swatches');
    const bodyEl = $('#body-swatches'), styleEl = $('#hairstyle-swatches');
    const bodyRow = $('#body-row');
    if (skinEl) {
      skinEl.innerHTML = skins.map((c) => `<button type="button" class="${appearance.skin === c ? 'on' : ''}" data-skin="${c}" style="background:${c}"></button>`).join('');
      skinEl.querySelectorAll('[data-skin]').forEach((b) => b.onclick = () => { appearance.skin = b.dataset.skin; buildSwatches(); drawPreview(); updatePreviewCard(); });
    }
    if (hairEl) {
      hairEl.innerHTML = hairs.map((c) => `<button type="button" class="${appearance.hair === c ? 'on' : ''}" data-hair="${c}" style="background:${c}"></button>`).join('');
      hairEl.querySelectorAll('[data-hair]').forEach((b) => b.onclick = () => { appearance.hair = b.dataset.hair; buildSwatches(); drawPreview(); updatePreviewCard(); });
    }
    if (countryEl) {
      countryEl.innerHTML = countries.map((c) => `<button type="button" class="${appearance.country === c.id ? 'on' : ''}" data-country="${c.id}">${c.name}</button>`).join('');
      countryEl.querySelectorAll('[data-country]').forEach((b) => b.onclick = () => { appearance.country = b.dataset.country; syncUniformFromCountry(); buildSwatches(); drawPreview(); updatePreviewCard(); });
    }
    if (genderEl) {
      genderEl.innerHTML = genders.map((g) => `<button type="button" class="${appearance.gender === g.id ? 'on' : ''}" data-gender="${g.id}">${g.name}</button>`).join('');
      genderEl.querySelectorAll('[data-gender]').forEach((b) => b.onclick = () => {
        appearance.gender = b.dataset.gender;
        if (appearance.gender === 'nam') appearance.bodyStyle = 'male';
        else if (appearance.gender === 'nu') appearance.bodyStyle = 'female';
        appearance.rainbowBadge = appearance.gender === 'lgbt';
        buildSwatches(); drawPreview(); updatePreviewCard();
      });
    }
    if (bodyRow) bodyRow.hidden = appearance.gender !== 'lgbt';
    if (bodyEl) {
      bodyEl.innerHTML = [
        { id: 'male', name: 'Nam' }, { id: 'female', name: 'Nữ' },
      ].map((b) => `<button type="button" class="${appearance.bodyStyle === b.id ? 'on' : ''}" data-body="${b.id}">${b.name}</button>`).join('');
      bodyEl.querySelectorAll('[data-body]').forEach((b) => b.onclick = () => { appearance.bodyStyle = b.dataset.body; buildSwatches(); drawPreview(); updatePreviewCard(); });
    }
    if (styleEl) {
      styleEl.innerHTML = hairStyles.map((h) => `<button type="button" class="${appearance.hairStyle === h.id ? 'on' : ''}" data-hs="${h.id}">${h.name}</button>`).join('');
      styleEl.querySelectorAll('[data-hs]').forEach((b) => b.onclick = () => { appearance.hairStyle = b.dataset.hs; buildSwatches(); drawPreview(); updatePreviewCard(); });
    }
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
    world3d.onToggleMap = () => toggleMap();
    let _mapTick = 0;
    world3d.onMapTick = (snap) => {
      _mapTick++;
      if (_mapTick % 4 === 0) {
        const mm = $('#minimap');
        if (mm && !mm.hidden) drawMap(mm, snap, false);
        if (mapOpen) drawMap($('#map-full'), snap, true);
      }
    };
    world3d.start();
    const mm = $('#minimap');
    if (mm) mm.hidden = false;
    setupJoystick();
    maybeUiShot();
    if (pendingMe) {
      world3d.setMe(pendingMe.id, pendingMe.appearance, pendingMe.x, pendingMe.z);
      pendingMe = null;
    } else if (me) {
      world3d.setMe(me.id, me.appearance, me.x, me.z);
    }
    return world3d;
  }


  function maybeUiShot() {
    const shot = new URLSearchParams(location.search).get('uiShot');
    if (!shot) return;
    document.body.classList.add('mobile-chrome');
    const join = $('#join-screen'); if (join) join.hidden = true;
    // Fake me for compact HUD
    me = Object.assign({
      id: 'shot', nickname: 'Chibi', fullName: 'UI Shot',
      sentenceLeftDays: 28, sentenceTotalDays: 30, rehabRatingLabel: 'Kém', rehabPoints: 0,
      daysMarked: 2, room: 'A1', role: 'prisoner', prisonerNo: 'OT-010',
      rank: { emoji: '🐣', name: 'Tù mới', xp: 10 }, rankXp: 10,
      appearance: { country: 'vn', gender: 'nam', skin: '#e8b896', hair: '#1a1a1a' },
    }, me || {});
    world.onlineCount = world.onlineCount || 3;
    world.schedule = world.schedule || { name: 'Giờ tự do' };
    showGameUI(true);
    updateHud();
    ['#intake-banner', '#audio-unlock', '#welcome-banner', '#schedule-banner'].forEach((s) => {
      const el = $(s); if (el) el.hidden = true;
    });
    const yard = $('#yard');
    if (yard) {
      yard.style.background = 'linear-gradient(180deg,#7eb6e8 0%,#b8d4f0 40%,#6a8a5a 40%,#5a7a4a 100%)';
    }
    if (shot === 'expanded') {
      ['stats', 'tools', 'menu', 'dock', 'chat', 'minimap'].forEach((k) => {
        const el = $(UI_PANELS[k]);
        if (el) { el.hidden = false; el.classList.add('ui-open'); }
        const fab = $(`.ui-fab[data-ui="${k}"]`);
        if (fab) fab.classList.add('on');
      });
      const mob = $('#mob-actions'); if (mob) { mob.hidden = false; mob.classList.add('ui-open'); }
      const chat = $('#chat-panel'); if (chat) chat.classList.remove('collapsed');
    } else {
      collapseAllUI();
    }
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

  function isMobileUI() {
    return matchMedia('(max-width: 700px)').matches
      || matchMedia('(pointer: coarse)').matches
      || 'ontouchstart' in window
      || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  }

  const UI_PANELS = {
    stats: '#info-card',
    tools: '#top-tools',
    menu: '#right-menu',
    dock: '#dock',
    chat: '#chat-panel',
    minimap: '#minimap',
  };

  function collapseAllUI(except) {
    Object.keys(UI_PANELS).forEach((k) => {
      if (except && k === except) return;
      const el = $(UI_PANELS[k]);
      if (el) el.classList.remove('ui-open');
    });
    const mob = $('#mob-actions');
    if (mob && !(except === 'dock')) mob.classList.remove('ui-open');
    $$('.ui-fab').forEach((b) => {
      if (except && b.dataset.ui === except) return;
      b.classList.remove('on');
    });
  }

  function toggleUIPanel(key) {
    const sel = UI_PANELS[key];
    if (!sel) return;
    const el = $(sel);
    if (!el) return;
    const open = !el.classList.contains('ui-open');
    collapseAllUI(open ? key : null);
    el.classList.toggle('ui-open', open);
    el.hidden = false;
    if (key === 'chat') {
      el.classList.toggle('collapsed', !open);
      if (open) el.classList.remove('collapsed');
    }
    if (key === 'dock') {
      const mob = $('#mob-actions');
      if (mob) { mob.hidden = false; mob.classList.toggle('ui-open', open); }
    }
    const fab = $(`.ui-fab[data-ui="${key}"]`);
    if (fab) fab.classList.toggle('on', open);
  }

  function setupMobileChrome() {
    const mobile = isMobileUI();
    document.body.classList.toggle('mobile-chrome', mobile);
    const fabs = $('#ui-fabs');
    const chud = $('#compact-hud');
    if (!mobile) {
      if (fabs) fabs.hidden = true;
      if (chud) chud.hidden = true;
      Object.values(UI_PANELS).forEach((s) => { const el = $(s); if (el) el.classList.add('ui-open'); });
      return;
    }
    if (fabs) fabs.hidden = false;
    if (chud) chud.hidden = false;
    // Default collapsed
    collapseAllUI();
    $$('.ui-fab').forEach((b) => {
      b.onclick = (e) => {
        e.stopPropagation();
        unlockAudio();
        toggleUIPanel(b.dataset.ui);
      };
    });
    // Tap outside expanded panels → collapse
    if (!setupMobileChrome._bound) {
      setupMobileChrome._bound = true;
      document.addEventListener('pointerdown', (e) => {
        if (!document.body.classList.contains('mobile-chrome')) return;
        const t = e.target;
        if (!t) return;
        if (t.closest && (
          t.closest('#info-card') || t.closest('#top-tools') || t.closest('#right-menu')
          || t.closest('#dock') || t.closest('#chat-panel') || t.closest('#minimap')
          || t.closest('#ui-fabs') || t.closest('#joystick') || t.closest('#mob-actions')
          || t.closest('#sidebang') || t.closest('.overlay-panel') || t.closest('#compact-hud')
        )) return;
        collapseAllUI();
      }, true);
    }
  }

  function showGameUI(show) {
    ['#info-card', '#top-tools', '#dock', '#right-menu', '#chat-panel'].forEach((s) => { $(s).hidden = !show; });
    const mobile = isMobileUI();
    if (show) {
      $('#joystick').hidden = !mobile;
      $('#mob-actions').hidden = !mobile;
      setupMobileChrome();
      if (mobile) {
        $('#chat-panel').classList.add('collapsed');
        $('#chat-fab').hidden = true;
        const mm = $('#minimap');
        if (mm) { mm.hidden = false; mm.classList.remove('ui-open'); }
      } else {
        Object.values(UI_PANELS).forEach((s) => { const el = $(s); if (el) el.classList.add('ui-open'); });
      }
    } else {
      $('#joystick').hidden = true;
      $('#mob-actions').hidden = true;
      $('#chat-fab').hidden = true;
      const fabs = $('#ui-fabs'); if (fabs) fabs.hidden = true;
      const chud = $('#compact-hud'); if (chud) chud.hidden = true;
      document.body.classList.remove('mobile-chrome');
    }
  }

  function updateHud() {
    if (!me) return;
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const schName = world.schedule ? world.schedule.name : 'Giờ tự do';
    $('#info-time').textContent = `${hh}:${mm} · ${schName}`;
    const chudT = $('#chud-time'); if (chudT) chudT.textContent = `${hh}:${mm}`;
    const chudS = $('#chud-sent'); if (chudS) chudS.textContent = `⚖️ ${me.sentenceLeftDays != null ? me.sentenceLeftDays : '—'}n`;
    const chudO = $('#chud-online'); if (chudO) chudO.textContent = `👤 ${world.onlineCount || 0}`;
    const npc = world.npcCount != null ? world.npcCount : (config.npcCount || 16);
    $('#info-online').textContent = `👤 ${world.onlineCount || 0} thật · 🤖 ${npc} NPC`;
    $('#info-days').textContent = `✏️ Đã gạch: ${(world.totalDaysMarked || me.daysMarked || 0).toLocaleString('vi-VN')} ngày`;
    $('#info-room').textContent = `🚪 Phòng của bạn: ${roomCode(me.room)}`;
    $('#info-sentence').textContent = `⚖️ Còn ${me.sentenceLeftDays} ngày · 🏅 ${me.rehabRatingLabel || 'Kém'} (${me.rehabPoints || 0}đ)`;
    const rk = me.rank || {};
    const rankEl = $('#info-rank');
    const isGuard = me.role === 'guard';
    if (rankEl) {
      if (isGuard) {
        const g = me.guardRank || {};
        const next = g.nextXp != null ? ` · tới ${g.nextName || '?'} ${g.nextXp}XP` : ' · MAX';
        rankEl.textContent = `${g.emoji || '👮'} QG: ${g.name || 'Hạ sĩ'} · ${g.xp || 0} XP${next}`;
      } else {
        const next = rk.nextXp != null ? ` · tới ${rk.nextName || '?'} ${rk.nextXp}XP` : ' · MAX';
        rankEl.textContent = `${rk.emoji || '🐣'} Hạng: ${rk.name || 'Tù mới'} · ${rk.xp || me.rankXp || 0} XP${next}`;
      }
    }
    const cellEl = $('#info-cell');
    if (cellEl) {
      if (isGuard) cellEl.textContent = '👮 Vai trò: Quản giáo (tuần tra / bắt vượt ngục)';
      else cellEl.textContent = `🚪 Phòng giam số ${me.cellNo || '—'} (${me.cellId || me.room || '—'})`;
    }
    const gEl = $('#info-guard');
    if (gEl) {
      gEl.hidden = !isGuard;
      if (isGuard) {
        const g = me.guardRank || {};
        gEl.textContent = `✨ Liêm chính: ${g.integrity || me.guardIntegrity || 0} · Bắt: ${me.guardCatches || 0}`;
      }
    }
    if (world.schedule) {
      const left = Math.max(0, Math.ceil((world.schedule.endsAt - Date.now()) / 1000));
      $('#schedule-banner').hidden = false;
      let hint = '';
      if (!isGuard) {
        if (world.schedule.id === 'an') hint = ' → vào Nhà ăn / Căn tin';
        else if (world.schedule.id === 'lao_dong') hint = ' → ra Khu lao động';
        else if (world.schedule.id === 'tat_den') hint = ` → về phòng ${me.cellNo || ''}`;
      }
      $('#schedule-text').textContent = `${world.schedule.emoji || ''} ${world.schedule.name} · còn ${left}s${hint}`;
    }
    updateIntakeUi();
    applyZoneBounds();
    renderChatLog();
  }

  function updateIntakeUi() {
    const ban = $('#intake-banner');
    const line = $('#info-intake');
    if (!me || me.role === 'guard' || me.intakeDone) {
      if (ban) ban.hidden = true;
      if (line) line.hidden = true;
      return;
    }
    const need = me.intakeNeedMs || (config.intakeNeedMs) || 300000;
    const cur = me.intakeChatMs || 0;
    const pct = Math.min(100, Math.floor((cur / need) * 100));
    const left = Math.ceil((need - cur) / 1000);
    if (ban) {
      ban.hidden = false;
      $('#intake-text').textContent = `🚧 Khu tạm giam · tiếp nhận ${pct}% · còn ~${left}s nói chuyện`;
    }
    if (line) {
      line.hidden = false;
      line.textContent = `🚧 Tiếp nhận: ${pct}% (${Math.floor(cur/1000)}/${Math.floor(need/1000)}s)`;
    }
  }

  function applyZoneBounds() {
    if (!world3d || world3d.fallback) return;
    if (me && !me.intakeDone && me.role !== 'guard') {
      world3d.setZoneBounds({ minX: -52, maxX: -32, minZ: -18, maxZ: 2 });
    } else {
      world3d.setZoneBounds(null);
    }
  }

  function worldToMap(x, z, w, h) {
    // compound roughly x -55..50, z -55..48
    const nx = (x + 55) / 105;
    const nz = (z + 55) / 103;
    return { x: nx * w, y: (1 - nz) * h };
  }

  function drawMap(canvas, snap, interactive) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#15202e';
    ctx.fillRect(0, 0, w, h);
    const zones = (snap && snap.zones) || (config.zones) || (world3d && world3d.mapZones) || [];
    zones.forEach((z) => {
      const a = worldToMap(z.x - z.w / 2, z.z - z.d / 2, w, h);
      const b = worldToMap(z.x + z.w / 2, z.z + z.d / 2, w, h);
      const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
      const ww = Math.abs(b.x - a.x), hh = Math.abs(b.y - a.y);
      ctx.fillStyle = (z.color || '#486') + '99';
      ctx.fillRect(x, y, ww, hh);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.strokeRect(x, y, ww, hh);
      ctx.fillStyle = '#fff';
      ctx.font = interactive ? '12px Nunito,sans-serif' : '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(z.name || z.id, x + ww / 2, y + hh / 2 + 4);
    });
    if (snap && snap.players) {
      snap.players.forEach((pl) => {
        const p = worldToMap(pl.x, pl.z, w, h);
        ctx.beginPath();
        ctx.fillStyle = pl.me ? '#ffdd44' : '#7ec8ff';
        ctx.arc(p.x, p.y, pl.me ? 5 : 3, 0, Math.PI * 2);
        ctx.fill();
      });
    } else if (snap && snap.me) {
      const p = worldToMap(snap.me.x, snap.me.z, w, h);
      ctx.beginPath();
      ctx.fillStyle = '#ffdd44';
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  let mapOpen = false;
  function toggleMap(force) {
    const ov = $('#map-overlay');
    if (!ov) return;
    mapOpen = force != null ? !!force : ov.hidden;
    ov.hidden = !mapOpen;
    if (mapOpen) {
      const snap = world3d ? world3d.getMapSnapshot() : { zones: config.zones || [], me: me ? { x: me.x, z: me.z } : { x: 0, z: 0 }, players: [] };
      drawMap($('#map-full'), snap, true);
    }
  }

  function talkNow() {
    socket.emit('talk');
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
      games: ['Trò chơi', 'Caro · Đố vui · Bóng · Ô ăn quan · Tiến lên'],
      quests: ['Nhiệm vụ lên cấp', 'Daily + hạng + quản giáo'],
      guard: ['Nghiệp vụ Quản giáo', 'Tuần tra · Điểm danh · Bắt vượt'],
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
    else if (mode === 'quests') body.innerHTML = renderQuests();
    else if (mode === 'guard') body.innerHTML = renderGuardPanel();
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
      <p class="ghi">Hối lộ trước. Thành công → trở thành Quản giáo. Thất bại → mất hết điểm &amp; án tính lại từ đầu.</p>
      <div style="margin-top:10px" id="player-guards-bribe"></div>`;
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
    const pg = $('#player-guards-bribe');
    if (pg && me && me.role !== 'guard') {
      const guards = (world.players || []).filter((p) => p.role === 'guard');
      if (guards.length) {
        pg.innerHTML = '<b>Hối lộ Quản giáo người chơi:</b>' + guards.map((g) =>
          `<button class="btn sm" style="margin:4px" data-bribe-player="${g.id}">💸 ${escapeHtml(g.nickname)}</button>`).join('');
        pg.querySelectorAll('[data-bribe-player]').forEach((b) => {
          b.onclick = () => socket.emit('guardBribeOffer', { guardId: b.dataset.bribePlayer });
        });
      }
    }
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
    if (!confirm('Vượt ngục? Thành công → Quản giáo. Thất bại → mất hết điểm, án tính lại từ đầu.')) return;
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
    body.querySelectorAll('[data-claim]').forEach((b) => b.onclick = () => socket.emit('claimQuest', { kind: b.dataset.claim, id: b.dataset.qid }));
    body.querySelectorAll('[data-gact]').forEach((b) => b.onclick = () => {
      const act = b.dataset.gact;
      if (act === 'patrol') socket.emit('guardPatrol');
      else if (act === 'roll') socket.emit('guardRollCall');
      else if (act === 'catch') socket.emit('guardCatch', {});
    });
    body.querySelectorAll('[data-bribe-resp]').forEach((b) => b.onclick = () => socket.emit('guardRespondBribe', { fromId: b.dataset.from, accept: b.dataset.bribeResp === '1' }));
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
    const npcBtns = [
      ['caro', '⬛ Cờ Caro'],
      ['rps', '✊ Kéo Búa Bao'],
      ['quiz', '🧠 Đố vui'],
      ['ball', '🏀 Ném bóng rổ'],
      ['oanquan', '🟡 Ô ăn quan'],
      ['tienlen', '🃏 Tiến lên lite'],
    ].map(([id, label]) => `<button class="btn pri" data-start="${id}" data-vs="npc">${label} vs NPC</button>`).join('');
    const inv = others.length ? others.map((p) => `
        <div class="meta">${escapeHtml(p.nickname)}${p.role === 'guard' ? ' 👮' : ''} · phòng ${p.cellNo || '—'}</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">
          <button class="btn sm" data-invite="caro" data-id="${p.id}">Caro</button>
          <button class="btn sm" data-invite="rps" data-id="${p.id}">KBB</button>
          <button class="btn sm" data-invite="quiz" data-id="${p.id}">Đố vui</button>
          <button class="btn sm" data-invite="ball" data-id="${p.id}">Bóng</button>
          <button class="btn sm" data-invite="oanquan" data-id="${p.id}">Ô ăn quan</button>
          <button class="btn sm" data-invite="tienlen" data-id="${p.id}">Tiến lên</button>
        </div>`).join('') : '<span class="meta">Chưa có ai khác online.</span>';
    return `<div style="display:flex;flex-direction:column;gap:8px">${npcBtns}<div class="meta">Mời người chơi:</div>${inv}</div>`;
  }
  function questBlock(title, list, kind) {
    if (!list || !list.length) return '';
    return `<h3 style="margin:10px 0 6px;font-size:14px;color:var(--accent)">${title}</h3>` + list.map((q) => {
      const cur = q.current || 0;
      const tgt = q.target || q.needXp || 1;
      const pct = Math.min(100, Math.round((cur / tgt) * 100));
      const can = q.done && !q.claimed;
      return `<div style="margin:8px 0;padding:8px;border:1px solid var(--line);border-radius:10px">
        <div style="display:flex;justify-content:space-between;font-size:13px"><span>${q.claimed ? '✅' : (q.done ? '🎁' : '⬜')} <b>${escapeHtml(q.name)}</b></span><span>${cur}/${tgt}</span></div>
        <div class="meta">${escapeHtml(q.desc || '')} · +${q.xp || 0}XP +${q.money || 0}₫</div>
        <div class="progress"><i style="width:${pct}%"></i></div>
        ${can ? `<button class="btn pri sm" style="margin-top:6px" data-claim="${kind}" data-qid="${q.id}">Nhận thưởng</button>` : ''}
      </div>`;
    }).join('');
  }
  function renderQuests() {
    const q = (me && me.quests) || { daily: [], rank: [], guard: [] };
    let html = questBlock('📅 Nhiệm vụ ngày', q.daily, 'daily');
    if (me && me.role === 'guard') html += questBlock('👮 Nhiệm vụ Quản giáo', q.guard, 'guard');
    else html += questBlock('🎖️ Nhiệm vụ lên cấp', q.rank, 'rank');
    return html || '<div class="meta">Chưa có nhiệm vụ.</div>';
  }
  function renderGuardPanel() {
    if (!me || me.role !== 'guard') {
      return `<div class="meta">Bạn đang là tù nhân. Vượt ngục thành công để trở thành Quản giáo.</div>
        <p class="ghi">Cấp bậc: Hạ sĩ → Trung sĩ → Thiếu úy → Trung úy → Đại úy → Giám thị.</p>`;
    }
    const g = me.guardRank || {};
    const pending = (me.pendingBribes || []);
    return `<div class="pcard">
      <div class="pcard-row"><span>Cấp</span><b>${g.emoji || '👮'} ${g.name || 'Hạ sĩ'}</b></div>
      <div class="pcard-row"><span>XP QG</span><b>${g.xp || 0}${g.nextXp != null ? ' / ' + g.nextXp : ''}</b></div>
      <div class="pcard-row"><span>Liêm chính</span><b>${g.integrity || 0}</b></div>
      <div class="pcard-row"><span>Tuần tra / Bắt / Điểm danh</span><b>${me.guardPatrols || 0} / ${me.guardCatches || 0} / ${me.guardRolls || 0}</b></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">
      <button class="btn pri" data-gact="patrol">🪖 Tuần tra (+XP)</button>
      <button class="btn pri" data-gact="roll">📋 Điểm danh</button>
      <button class="btn" data-gact="catch">🚨 Bắt vượt ngục (tại tường rào)</button>
    </div>
    <h3 style="margin:12px 0 6px;font-size:14px;color:var(--accent)">💰 Hối lộ đang chờ</h3>
    ${pending.length ? pending.map((b) => `<div class="list"><li><span>${escapeHtml(b.fromNick)} · ${b.amount}₫</span>
      <span><button class="btn sm" data-bribe-resp="1" data-from="${b.fromId}">Nhận</button>
      <button class="btn sm" data-bribe-resp="0" data-from="${b.fromId}">Từ chối (+liêm chính)</button></span></li></div>`).join('') : '<div class="meta">Không có.</div>'}
    ${questBlock('Nhiệm vụ QG', (me.quests && me.quests.guard) || [], 'guard')}`;
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
      <div class="pcard-row"><span>Quốc gia</span><b>${escapeHtml(countryLabel((me.appearance && me.appearance.country) || 'vn'))}</b></div>
      <div class="pcard-row"><span>Giới tính</span><b>${escapeHtml(genderLabel((me.appearance && me.appearance.gender) || 'nam'))}</b></div>
      <div class="pcard-row"><span>Tội danh</span><b>${escapeHtml(me.crimeLabel || '—')}</b></div>
      <div class="pcard-row"><span>Án còn lại</span><b>${me.sentenceLeftDays} ngày</b></div>
      <div class="pcard-row"><span>Xếp loại</span><b>${escapeHtml(me.rehabRatingLabel || 'Kém')}</b></div>
      <div class="pcard-row"><span>Điểm cải tạo</span><b>${me.rehabPoints || 0}</b></div>
      <div class="pcard-row"><span>Tiền / thắng</span><b>${me.money}₫ · 🏆${me.gameWins || 0}</b></div>
      <div class="pcard-row"><span>Vai trò</span><b>${me.role === 'guard' ? '👮 Quản giáo' : '🧑‍🦱 Tù nhân'}</b></div>
      <div class="pcard-row"><span>Phòng giam</span><b>Số ${me.cellNo || '—'} (${me.cellId || '—'})</b></div>
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
    if (document.body.classList.contains('mobile-chrome')) toggleUIPanel('chat');
    else {
      const panel = $('#chat-panel');
      panel.hidden = false;
      panel.classList.toggle('collapsed');
      $('#chat-fab').hidden = true;
    }
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
    if (document.body.classList.contains('mobile-chrome')) collapseAllUI();
    else $('#chat-panel').classList.toggle('collapsed');
  };
  $('#chat-fab').onclick = () => {
    if (document.body.classList.contains('mobile-chrome')) toggleUIPanel('chat');
    else {
      $('#chat-panel').hidden = false;
      $('#chat-panel').classList.remove('collapsed');
      $('#chat-fab').hidden = true;
    }
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
  const creditsBtn = $('#btn-credits');
  const creditsOk = $('#btn-credits-ok');
  if (creditsBtn) creditsBtn.onclick = () => { const el = $('#credits-overlay'); if (el) el.hidden = false; };
  if (creditsOk) creditsOk.onclick = () => { const el = $('#credits-overlay'); if (el) el.hidden = true; };

  const btnMap = $('#btn-map');
  if (btnMap) btnMap.onclick = () => toggleMap();
  const btnMapClose = $('#btn-map-close');
  if (btnMapClose) btnMapClose.onclick = () => toggleMap(false);
  const btnTalk = $('#btn-talk');
  if (btnTalk) btnTalk.onclick = () => talkNow();
  const dockTalk = $('#dock-talk');
  if (dockTalk) dockTalk.onclick = () => talkNow();
  const dockMap = $('#dock-map');
  if (dockMap) dockMap.onclick = () => toggleMap();
  const mapFull = $('#map-full');
  if (mapFull) {
    mapFull.onclick = (ev) => {
      if (!me || (!me.intakeDone && me.role !== 'guard')) {
        toast('Hoàn thành tiếp nhận ở Khu tạm giam trước.');
        return;
      }
      const rect = mapFull.getBoundingClientRect();
      const mx = (ev.clientX - rect.left) / rect.width * mapFull.width;
      const my = (ev.clientY - rect.top) / rect.height * mapFull.height;
      // inverse worldToMap
      const x = mx / mapFull.width * 105 - 55;
      const z = (1 - my / mapFull.height) * 103 - 55;
      // pick nearest room
      let best = null, bestD = Infinity;
      (config.rooms || []).forEach((r) => {
        const d = (r.x - x) ** 2 + (r.z - z) ** 2;
        if (d < bestD) { bestD = d; best = r; }
      });
      if (best) {
        if (best.id === 'phong_hanh_phuc' && !me.happinessUnlocked) {
          toast('Phòng hạnh phúc khóa — hoàn thành 100% nhiệm vụ.');
          return;
        }
        socket.emit('moveTo', best.id);
        toast('Đang tới ' + best.name);
        toggleMap(false);
      }
    };
  }
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
    const closeBtn = '<button class="btn" id="btn-close-match" type="button">Đóng</button>';
    if (m.game === 'caro') {
      const cells = m.board.map((row, y) => row.map((c, x) => {
        const mark = c === 1 ? 'X' : c === 2 ? 'O' : '';
        const dis = m.status !== 'playing' || m.turn !== m.youAre || c ? 'disabled' : '';
        return `<button class="caro-cell" data-x="${x}" data-y="${y}" ${dis}>${mark}</button>`;
      }).join('')).join('');
      card.innerHTML = `<h2>Cờ Caro</h2><p>${escapeHtml(m.message || '')}</p>
        <div class="caro-board">${cells}</div>${closeBtn}`;
      card.querySelectorAll('.caro-cell').forEach((b) => {
        b.onclick = () => socket.emit('caroMove', { matchId: m.id, x: +b.dataset.x, y: +b.dataset.y });
      });
    } else if (m.game === 'rps') {
      card.innerHTML = `<h2>Kéo Búa Bao (BO3)</h2>
        <p>${escapeHtml(m.message || '')}</p>
        <p>Tỉ số: ${m.scores ? `${m.scores[1]} – ${m.scores[2]}` : ''}</p>
        <div class="rps-row">
          <button class="btn" data-rps="rock" ${m.status !== 'playing' ? 'disabled' : ''}>✊</button>
          <button class="btn" data-rps="paper" ${m.status !== 'playing' ? 'disabled' : ''}>✋</button>
          <button class="btn" data-rps="scissors" ${m.status !== 'playing' ? 'disabled' : ''}>✌️</button>
        </div>${closeBtn}`;
      card.querySelectorAll('[data-rps]').forEach((b) => {
        b.onclick = () => socket.emit('rpsChoice', { matchId: m.id, choice: b.dataset.rps });
      });
    } else if (m.game === 'quiz') {
      const q = m.quiz || { q: '…', a: [] };
      card.innerHTML = `<h2>🧠 Đố vui</h2><p>${escapeHtml(m.message || '')}</p>
        <p><b>${escapeHtml(q.q || '')}</b></p>
        <p>Điểm: ${m.scores ? `${m.scores[1]} – ${m.scores[2] || 0}` : ''}</p>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${(q.a || []).map((a, i) => `<button class="btn" data-quiz="${i}" ${m.status !== 'playing' ? 'disabled' : ''}>${escapeHtml(a)}</button>`).join('')}
        </div>${closeBtn}`;
      card.querySelectorAll('[data-quiz]').forEach((b) => {
        b.onclick = () => socket.emit('quizAnswer', { matchId: m.id, answer: +b.dataset.quiz });
      });
    } else if (m.game === 'ball') {
      card.innerHTML = `<h2>🏀 Ném bóng rổ</h2><p>${escapeHtml(m.message || '')}</p>
        <p>Tỉ số: ${m.scores ? `${m.scores[1]} – ${m.scores[2] || 0}` : ''} · Lượt: ${m.ballShots || 0}/6</p>
        <label>Lực ném (nhắm ~72): <input id="ball-power" type="range" min="0" max="100" value="70" /></label>
        <button class="btn pri" id="btn-ball" ${m.status !== 'playing' ? 'disabled' : ''}>Ném!</button>
        ${closeBtn}`;
      const bb = $('#btn-ball');
      if (bb) bb.onclick = () => socket.emit('ballShoot', { matchId: m.id, power: +$('#ball-power').value });
    } else if (m.game === 'oanquan') {
      const pits = (m.board && m.board.pits) || [];
      card.innerHTML = `<h2>🟡 Ô ăn quan lite</h2><p>${escapeHtml(m.message || '')}</p>
        <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:4px;margin:8px 0">
          ${[6,7,8,9,10,11].map((i) => `<button class="btn sm" data-pit="${i}" ${i===11||m.status!=='playing'?'disabled':''}>${pits[i]||0}</button>`).join('')}
          ${[5,4,3,2,1,0].map((i) => `<button class="btn sm" data-pit="${i}" ${i===5||m.status!=='playing'?'disabled':''}>${pits[i]||0}</button>`).join('')}
        </div>
        <p class="meta">Chọn ô phía bạn (hàng dưới, trừ quan).</p>${closeBtn}`;
      card.querySelectorAll('[data-pit]').forEach((b) => {
        b.onclick = () => socket.emit('oanquanMove', { matchId: m.id, pit: +b.dataset.pit });
      });
    } else if (m.game === 'tienlen') {
      card.innerHTML = `<h2>🃏 Tiến lên lite</h2><p>${escapeHtml(m.message || '')}</p>
        <p>Bài của bạn (ẩn lực): chọn số lá 2–14 (A=14)</p>
        <input id="tl-card" type="number" min="2" max="14" value="${m.hand || 7}" style="width:80px" />
        <button class="btn pri" id="btn-tl" ${m.status !== 'playing' ? 'disabled' : ''}>Đánh bài</button>
        ${m.lastRound ? `<p>Bạn ${m.lastRound.you} vs Đối ${m.lastRound.opp}</p>` : ''}
        ${closeBtn}`;
      const bt = $('#btn-tl');
      if (bt) bt.onclick = () => socket.emit('tienlenPlay', { matchId: m.id, card: +$('#tl-card').value });
    } else {
      card.innerHTML = `<h2>Mini-game</h2><p>${escapeHtml(m.message || '')}</p>${closeBtn}`;
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
      applyZoneBounds();
      if (!world3d.myId || world3d.myId !== p.id) {
        world3d.setMe(p.id, p.appearance, p.x, p.z);
      }
      // snap local if server teleported (intake done)
      if (typeof p.x === 'number' && Math.hypot((world3d.localPos.x||0)-p.x, (world3d.localPos.z||0)-p.z) > 8) {
        world3d.localPos.x = p.x; world3d.localPos.z = p.z;
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
    if (sideMode === 'stats' || sideMode === 'profile' || sideMode === 'achievements' || sideMode === 'more' || sideMode === 'quests' || sideMode === 'guard') openSide(sideMode);
  });

  socket.on('world', (w) => {
    world = { ...world, ...w };
    updateHud();
    if (world3d && !world3d.fallback) {
      world3d.syncPlayers(w.players || []);
      if (w.guards) world3d.syncGuards(w.guards);
    }
    if (sideMode === 'board' || sideMode === 'games' || sideMode === 'rooms' || sideMode === 'quests' || sideMode === 'guard') openSide(sideMode);
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
  socket.on('intakeDone', (r) => {
    toast((r && r.message) || 'Chuyển sang Khu phân trại!');
    if (me) { me.intakeDone = true; me.zone = 'general'; }
    applyZoneBounds();
    updateIntakeUi();
  });
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
    const gLabels = { caro: 'Cờ Caro', rps: 'Kéo Búa Bao', quiz: 'Đố vui', ball: 'Ném bóng', oanquan: 'Ô ăn quan', tienlen: 'Tiến lên' };
    el.innerHTML = `<b>${escapeHtml(inv.fromNick)}</b> mời bạn chơi ${gLabels[inv.game] || inv.game}.
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
    if (r.success && r.becameGuard) {
      $('#escape-title').textContent = '👮 Trở thành Quản giáo!';
      $('#escape-detail').textContent = r.message || '';
      $('#btn-replay').textContent = 'Tiếp tục tuần tra';
      $('#btn-replay').onclick = () => { $('#escape-overlay').hidden = true; openSide('guard'); };
    } else if (r.success) {
      $('#escape-title').textContent = 'Vượt ngục thành công!';
      $('#escape-detail').textContent = r.message || '';
    } else {
      $('#escape-title').textContent = r.reset ? '🚨 Bắt giữ — án tính lại từ đầu' : 'Vượt ngục thất bại';
      $('#escape-detail').textContent = r.message || '';
      setTimeout(() => { $('#escape-overlay').hidden = true; }, 3200);
    }
  });
  socket.on('roleChanged', (r) => {
    toast(r.message || 'Đổi vai trò');
    if (r.role === 'guard') openSide('guard');
  });
  socket.on('guardRankUp', (payload) => {
    toast((payload && payload.message) || 'Thăng cấp Quản giáo!');
  });
  socket.on('bribeOffer', (o) => {
    toast(`💰 ${o.fromNick} hối lộ ${o.amount}₫ — mở panel Quản giáo để xử lý`);
    if (sideMode === 'guard') openSide('guard');
  });
  socket.on('released', (r) => {
    $('#escape-overlay').hidden = false;
    $('#escape-title').textContent = r.early ? '🕊️ Ra tù sớm!' : '🕊️ Mãn hạn';
    $('#escape-detail').textContent = `${r.message}\nĐã ở ${r.daysServed}/${r.sentenceTotalDays} ngày in-game.`;
  });


  // Screenshot / QA: ?uiShot=collapsed|expanded forces mobile chrome without joining
  if (new URLSearchParams(location.search).get('uiShot')) {
    setTimeout(() => { try { maybeUiShot(); } catch (e) { console.warn(e); } }, 200);
  }

  setInterval(updateHud, 1000);
})();
