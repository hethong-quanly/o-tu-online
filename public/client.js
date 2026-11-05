(() => {
  const socket = io();
  let me = null;
  let config = { jobs: {}, shop: {}, rooms: [] };
  let world = { players: [], roomCounts: {}, leaderboard: [] };
  let cdTimer = null;

  const $ = (sel) => document.querySelector(sel);
  const joinScreen = $('#join-screen');
  const gameScreen = $('#game-screen');
  const nickInput = $('#nick');
  const joinErr = $('#join-error');
  const toast = $('#toast');

  function showToast(msg, isErr) {
    toast.textContent = msg;
    toast.style.color = isErr ? 'var(--bad)' : 'var(--good)';
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { toast.textContent = ''; }, 4000);
  }

  $('#btn-join').onclick = () => {
    joinErr.textContent = '';
    socket.emit('join', nickInput.value);
  };
  nickInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#btn-join').click();
  });

  document.querySelectorAll('.tab').forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      ['jobs', 'shop', 'escape', 'board'].forEach((t) => {
        $(`#tab-${t}`).classList.toggle('hidden', t !== btn.dataset.tab);
      });
    };
  });

  socket.on('config', (c) => {
    config = c;
    renderJobs();
    renderShop();
    renderRooms();
  });

  socket.on('joined', ({ nickname }) => {
    joinScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    $('#my-nick').textContent = nickname;
  });

  socket.on('errorMsg', (msg) => {
    if (!me) joinErr.textContent = msg;
    else showToast(msg, true);
  });

  socket.on('me', (p) => {
    me = p;
    updateStats();
    renderJobs();
    renderShop();
    renderRooms();
    highlightPlayers();
  });

  socket.on('world', (w) => {
    world = w;
    $('#online-count').textContent = `${w.onlineCount} online`;
    renderRooms();
    highlightPlayers();
    renderLeaderboard();
  });

  socket.on('workResult', ({ pay, jobName }) => {
    showToast(`+${pay}₫ từ ${jobName}`);
  });

  socket.on('buyResult', ({ message }) => showToast(message));

  socket.on('escapeResult', (r) => {
    $('#escape-msg').textContent = r.message;
    $('#escape-msg').style.color = r.success ? 'var(--good)' : 'var(--bad)';
    if (r.success) {
      $('#escape-title').textContent = '🎉 Tự do!';
      $('#escape-detail').textContent = r.message;
      $('#escape-overlay').classList.remove('hidden');
    }
  });

  $('#btn-replay').onclick = () => location.reload();

  socket.on('chatHistory', (list) => {
    const log = $('#chat-log');
    log.innerHTML = '';
    list.forEach(appendChat);
  });
  socket.on('chat', appendChat);

  function appendChat(entry) {
    const log = $('#chat-log');
    const div = document.createElement('div');
    div.className = 'chat-line' + (entry.type === 'system' ? ' system' : '');
    if (entry.type === 'system') {
      div.textContent = entry.text;
    } else {
      div.innerHTML = `<span class="n">${escapeHtml(entry.nick)}</span>: ${escapeHtml(entry.text)}`;
    }
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  $('#chat-form').onsubmit = (e) => {
    e.preventDefault();
    const input = $('#chat-input');
    const v = input.value.trim();
    if (!v) return;
    socket.emit('chat', v);
    input.value = '';
  };

  $('#btn-escape').onclick = () => socket.emit('escape');

  function updateStats() {
    if (!me) return;
    $('#stat-money').textContent = me.money;
    $('#stat-health-txt').textContent = `${me.health}/${me.maxHealth}`;
    $('#stat-energy-txt').textContent = `${me.energy}/${me.maxEnergy}`;
    $('#bar-health').style.width = `${(me.health / me.maxHealth) * 100}%`;
    $('#bar-energy').style.width = `${(me.energy / me.maxEnergy) * 100}%`;
    $('#stat-rep').textContent = me.reputation;
    $('#stat-tool').textContent = me.upgrades.dung_cu_vuot || 0;
    $('#stat-fails').textContent = me.escapeFails || 0;
  }

  function renderRooms() {
    const el = $('#rooms');
    if (!config.rooms.length) return;
    el.innerHTML = config.rooms
      .map((r) => {
        const count = (world.roomCounts && world.roomCounts[r.id]) || 0;
        const here = me && me.room === r.id ? ' here' : '';
        return `<div class="room${here}" data-room="${r.id}">
          <div class="emoji">${r.emoji}</div>
          <div class="name">${r.name}</div>
          <div class="count">${count} người</div>
        </div>`;
      })
      .join('');
    el.querySelectorAll('.room').forEach((node) => {
      node.onclick = () => socket.emit('move', node.dataset.room);
    });
  }

  function highlightPlayers() {
    const list = $('#players-list');
    if (!me) return;
    const here = (world.players || []).filter((p) => p.room === me.room);
    list.innerHTML = here
      .map(
        (p) =>
          `<li class="${p.nickname === me.nickname ? 'me' : ''}">${escapeHtml(p.nickname)} · 💰${p.money} · ⭐${p.reputation}</li>`
      )
      .join('') || '<li style="color:var(--muted)">Chỉ có bạn…</li>';
  }

  function renderJobs() {
    const el = $('#tab-jobs');
    const jobs = Object.values(config.jobs || {});
    if (!jobs.length) return;
    const now = Date.now();
    el.innerHTML = jobs
      .map((j) => {
        const cd = me && me.cooldowns && me.cooldowns[j.id] ? me.cooldowns[j.id] : 0;
        const left = Math.max(0, Math.ceil((cd - now) / 1000));
        const disabled = left > 0 ? 'disabled' : '';
        return `<div class="job">
          <div class="info">
            <div class="title">${j.emoji} ${j.name}</div>
            <div class="desc">${j.description}</div>
            <div class="meta">+~${j.basePay}₫ · −${j.energyCost}⚡ · CD ${j.cooldownMs / 1000}s</div>
          </div>
          <span class="cd">${left > 0 ? left + 's' : ''}</span>
          <button class="btn" data-job="${j.id}" ${disabled}>Làm</button>
        </div>`;
      })
      .join('');
    el.querySelectorAll('[data-job]').forEach((btn) => {
      btn.onclick = () => socket.emit('work', btn.dataset.job);
    });
  }

  function renderShop() {
    const el = $('#tab-shop');
    const items = Object.values(config.shop || {});
    if (!items.length) return;
    el.innerHTML = items
      .map((it) => {
        const lvl = me && me.upgrades ? me.upgrades[it.id] || 0 : 0;
        const isFood = it.id === 'do_an';
        const price = isFood ? it.price : it.price * (lvl + 1);
        const lvlTxt = isFood ? '' : ` · Lv ${lvl}/${it.maxLevel}`;
        const maxed = !isFood && lvl >= it.maxLevel;
        return `<div class="shop-item">
          <div class="info">
            <div class="title">${it.emoji} ${it.name}${lvlTxt}</div>
            <div class="desc">${it.description}</div>
          </div>
          <button class="btn" data-buy="${it.id}" ${maxed ? 'disabled' : ''}>
            ${maxed ? 'MAX' : price + '₫'}
          </button>
        </div>`;
      })
      .join('');
    el.querySelectorAll('[data-buy]').forEach((btn) => {
      btn.onclick = () => socket.emit('buy', btn.dataset.buy);
    });
  }

  function renderLeaderboard() {
    const el = $('#leaderboard');
    const rows = world.leaderboard || [];
    el.innerHTML = rows
      .map(
        (r) =>
          `<li><span>${escapeHtml(r.nickname)}</span>
          <span style="margin-left:auto">💰${r.money} · kiếm ${r.totalEarned}</span>
          ${r.escaped ? '<span class="free">TỰ DO</span>' : ''}</li>`
      )
      .join('') || '<li>Chưa có ai…</li>';
  }

  // Cooldown ticker
  cdTimer = setInterval(() => {
    if (me) renderJobs();
  }, 500);
})();
