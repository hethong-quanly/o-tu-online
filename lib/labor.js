'use strict';

const CHAINS = {
  farm: {
    id: 'farm',
    name: 'Nông trại',
    emoji: '🌱',
    room: 'vuon_rau',
    steps: [
      { id: 'gieo', name: 'Gieo hạt', emoji: '🌰', taps: 4, growMs: 0 },
      { id: 'tuoi', name: 'Tưới nước / bón phân', emoji: '💧', taps: 4, growMs: 8 * 1000 },
      { id: 'thu', name: 'Thu hoạch rau, củ, trái cây', emoji: '🧺', taps: 5, growMs: 0 },
    ],
    pay: 35,
    stock: { farm: 3 },
    rehab: 3,
  },
  sewing: {
    id: 'sewing',
    name: 'May mặc',
    emoji: '🧵',
    room: 'xuong_may',
    steps: [
      { id: 'do_vai', name: 'Đo vải', emoji: '📏', taps: 3 },
      { id: 'cat_vai', name: 'Cắt vải', emoji: '✂️', taps: 4 },
      { id: 'may', name: 'May', emoji: '🪡', taps: 5 },
      { id: 'thanh_pham', name: 'Thành phẩm', emoji: '👕', taps: 2 },
    ],
    pay: 40,
    stock: { sewing: 2 },
    rehab: 3,
  },
  carpentry: {
    id: 'carpentry',
    name: 'Mộc',
    emoji: '🪚',
    room: 'xuong_moc',
    steps: [
      { id: 'do_ni', name: 'Đo ni', emoji: '📐', taps: 3 },
      { id: 'cua', name: 'Cưa / đóng', emoji: '🪵', taps: 5 },
      { id: 'thanh_pham', name: 'Thành phẩm bàn/tủ/ghế', emoji: '🪑', taps: 2 },
    ],
    pay: 45,
    stock: { wood: 2 },
    rehab: 4,
  },
  heavy: {
    id: 'heavy',
    name: 'Lao động nặng',
    emoji: '🏋️',
    room: 'xuong',
    steps: [
      { id: 'cua_cay', name: 'Cưa cây', emoji: '🪓', taps: 5 },
      { id: 'vac_cay', name: 'Vác cây', emoji: '🪵', taps: 4 },
      { id: 'vac_hang', name: 'Vác hàng nặng tới kho', emoji: '📦', taps: 4 },
    ],
    pay: 38,
    stock: { wood: 1 },
    rehab: 3,
  },
};

function ensureLabor(p) {
  if (!p.labor) p.labor = { chainId: null, step: 0, growReadyAt: 0, lastChainAt: 0 };
  return p.labor;
}

function startChain(p, chainId) {
  const chain = CHAINS[chainId];
  if (!chain) return { ok: false, error: 'Loại lao động không hợp lệ.' };
  if (p.jobRole === 'canteen' || p.jobRole === 'cook') {
    return { ok: false, error: 'Bạn đang bán căn tin / nấu bếp — không bắt buộc lao động chuỗi này.' };
  }
  const L = ensureLabor(p);
  L.chainId = chainId;
  L.step = 0;
  L.growReadyAt = 0;
  return { ok: true, chain: publicChain(chain), step: chain.steps[0] };
}

function publicChain(chain) {
  return {
    id: chain.id, name: chain.name, emoji: chain.emoji, room: chain.room,
    steps: chain.steps.map((s) => ({ id: s.id, name: s.name, emoji: s.emoji, taps: s.taps, growMs: s.growMs || 0 })),
    pay: chain.pay,
  };
}

function advanceStep(p, payload) {
  const L = ensureLabor(p);
  const chain = CHAINS[L.chainId];
  if (!chain) return { ok: false, error: 'Chưa bắt đầu chuỗi lao động.' };
  const step = chain.steps[L.step];
  if (!step) return { ok: false, error: 'Chuỗi đã xong.' };
  if (step.growMs && L.growReadyAt && Date.now() < L.growReadyAt) {
    return { ok: false, error: `Đang chờ lớn ~${Math.ceil((L.growReadyAt - Date.now()) / 1000)}s.` };
  }
  const taps = payload && payload.taps;
  const good = Array.isArray(taps) ? taps.filter((t) => t && t.ok).length : 0;
  const need = step.taps;
  if (good < Math.ceil(need * 0.5)) {
    return { ok: false, error: 'Chưa đạt — làm lại bước này nha.' };
  }
  // complete step
  L.step += 1;
  const next = chain.steps[L.step];
  if (next && next.growMs) {
    L.growReadyAt = Date.now() + next.growMs;
  } else {
    L.growReadyAt = 0;
  }
  if (L.step >= chain.steps.length) {
    const result = {
      ok: true, done: true, chainId: chain.id, pay: chain.pay, rehab: chain.rehab, stock: chain.stock,
      message: `Hoàn thành ${chain.name}! +${chain.pay} xu, +điểm cải tạo.`,
    };
    L.chainId = null;
    L.step = 0;
    L.lastChainAt = Date.now();
    return result;
  }
  return {
    ok: true, done: false, chainId: chain.id, stepIndex: L.step, step: next,
    growReadyAt: L.growReadyAt,
    message: `Xong «${step.name}» → tiếp «${next.name}».`,
  };
}

function listChains() {
  return Object.values(CHAINS).map(publicChain);
}

module.exports = {
  CHAINS,
  ensureLabor,
  startChain,
  advanceStep,
  publicChain,
  listChains,
};
