'use strict';

const SELLER_SLOT_FEE = 500; // lo lót lớn
const SELLER_SLOT_MS = 45 * 60 * 1000; // 45 phút / slot
const MAX_SELLER_SLOTS = 3;
const SELLER_KEEP_RATIO = 0.1; // 10% người bán, 90% kho bạc trại

const MENU = [
  { id: 'com_suat', name: 'Cơm suất', emoji: '🍚', price: 25, stockFrom: 'kitchen' },
  { id: 'hu_tieu', name: 'Hủ tiếu', emoji: '🍜', price: 30, stockFrom: 'kitchen' },
  { id: 'banh_mi', name: 'Bánh mì', emoji: '🥖', price: 18, stockFrom: 'kitchen' },
  { id: 'tra_da', name: 'Trà đá', emoji: '🧊', price: 8, stockFrom: 'kitchen' },
  { id: 'trai_cay', name: 'Trái cây', emoji: '🍎', price: 15, stockFrom: 'farm' },
  { id: 'rau_luoc', name: 'Rau luộc', emoji: '🥬', price: 12, stockFrom: 'farm' },
];

function ensureTreasury(state) {
  if (!state.canteen) {
    state.canteen = {
      treasury: 0,
      ledger: [],
      sellers: {}, // usernameKey -> { until, sales, kept, remitted }
      stock: { kitchen: 20, farm: 20, sewing: 0, wood: 0 },
    };
  }
  if (!state.canteen.stock) state.canteen.stock = { kitchen: 20, farm: 20, sewing: 0, wood: 0 };
  if (!state.canteen.sellers) state.canteen.sellers = {};
  if (!Array.isArray(state.canteen.ledger)) state.canteen.ledger = [];
  return state.canteen;
}

function activeSellers(canteen, now = Date.now()) {
  const out = [];
  for (const [k, s] of Object.entries(canteen.sellers || {})) {
    if (s && s.until > now) out.push({ key: k, ...s });
    else if (s && s.until <= now) delete canteen.sellers[k];
  }
  return out;
}

function canBuySlot(canteen, key, now = Date.now()) {
  const active = activeSellers(canteen, now);
  if (canteen.sellers[key] && canteen.sellers[key].until > now) {
    return { ok: false, error: 'Bạn đang giữ suất bán căn tin rồi.' };
  }
  if (active.length >= MAX_SELLER_SLOTS) {
    return { ok: false, error: `Hết suất bán (tối đa ${MAX_SELLER_SLOTS}).` };
  }
  return { ok: true };
}

function buySlot(canteen, key, nick, now = Date.now()) {
  const chk = canBuySlot(canteen, key, now);
  if (!chk.ok) return chk;
  canteen.sellers[key] = {
    nick,
    until: now + SELLER_SLOT_MS,
    sales: 0,
    kept: 0,
    remitted: 0,
    startedAt: now,
  };
  // fee goes entirely to treasury (lo lót)
  canteen.treasury = (canteen.treasury || 0) + SELLER_SLOT_FEE;
  pushLedger(canteen, {
    type: 'lo_lot',
    nick,
    amount: SELLER_SLOT_FEE,
    note: `Lo lót suất bán căn tin`,
  });
  return { ok: true, until: canteen.sellers[key].until, fee: SELLER_SLOT_FEE };
}

function pushLedger(canteen, entry) {
  canteen.ledger.push({ ...entry, at: Date.now() });
  if (canteen.ledger.length > 80) canteen.ledger = canteen.ledger.slice(-80);
}

function sellItem(canteen, sellerKey, itemId, buyerNick) {
  const now = Date.now();
  const seller = canteen.sellers[sellerKey];
  if (!seller || seller.until <= now) return { ok: false, error: 'Suất bán đã hết hạn.' };
  const item = MENU.find((m) => m.id === itemId);
  if (!item) return { ok: false, error: 'Món không có trong thực đơn.' };
  const stockKey = item.stockFrom;
  if ((canteen.stock[stockKey] || 0) <= 0) return { ok: false, error: 'Hết hàng — chờ bếp/vườn bổ sung.' };
  canteen.stock[stockKey] -= 1;
  const price = item.price;
  const keep = Math.floor(price * SELLER_KEEP_RATIO);
  const remit = price - keep;
  seller.sales += 1;
  seller.kept += keep;
  seller.remitted += remit;
  canteen.treasury = (canteen.treasury || 0) + remit;
  pushLedger(canteen, {
    type: 'sale',
    nick: seller.nick,
    buyer: buyerNick,
    item: item.name,
    price,
    keep,
    remit,
  });
  return { ok: true, item, keep, remit, price, treasury: canteen.treasury };
}

function addStock(canteen, kind, amount) {
  ensureTreasury({ canteen });
  canteen.stock[kind] = (canteen.stock[kind] || 0) + Math.max(0, amount | 0);
}

function publicView(canteen, now = Date.now()) {
  ensureTreasury({ canteen });
  return {
    fee: SELLER_SLOT_FEE,
    slotMs: SELLER_SLOT_MS,
    maxSlots: MAX_SELLER_SLOTS,
    keepRatio: SELLER_KEEP_RATIO,
    treasury: canteen.treasury || 0,
    stock: { ...canteen.stock },
    menu: MENU.slice(),
    sellers: activeSellers(canteen, now).map((s) => ({
      nick: s.nick, until: s.until, sales: s.sales, kept: s.kept, remitted: s.remitted,
    })),
    ledger: (canteen.ledger || []).slice(-15).reverse(),
  };
}

module.exports = {
  SELLER_SLOT_FEE,
  SELLER_SLOT_MS,
  MAX_SELLER_SLOTS,
  SELLER_KEEP_RATIO,
  MENU,
  ensureTreasury,
  activeSellers,
  canBuySlot,
  buySlot,
  sellItem,
  addStock,
  publicView,
  pushLedger,
};
