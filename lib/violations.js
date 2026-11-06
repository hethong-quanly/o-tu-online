'use strict';

const COOLDOWN_MS = {
  provoke: 45 * 1000,
  fight: 90 * 1000,
  bet: 60 * 1000,
};

const SEVERITY = {
  provoke: { label: 'Kiếm chuyện', yearsAdd: 0.15, detectChance: 0.35, emoji: '😤' },
  fight: { label: 'Đánh lộn', yearsAdd: 0.4, detectChance: 0.55, emoji: '🥊' },
  bet: { label: 'Cá độ', yearsAdd: 0.25, detectChance: 0.4, emoji: '🎲' },
};

const BET_MIN = 10;
const BET_MAX = 500;
const BET_EXPIRE_MS = 45 * 1000;

function dist2(a, b) {
  const dx = (a.x || 0) - (b.x || 0);
  const dz = (a.z || 0) - (b.z || 0);
  return dx * dx + dz * dz;
}

function nearby(a, b, maxDist = 10) {
  return dist2(a, b) <= maxDist * maxDist;
}

function cameraHotspot(p) {
  // yard / labor / canteen more watched
  const room = String(p.room || '');
  if (room.includes('san') || room.includes('xuong') || room === 'nha_bep' || room === 'vuon_rau') return 0.12;
  if (String(p.zone) === 'quarantine') return 0.08;
  return 0.05;
}

function guardProximityBonus(p, guards) {
  let bonus = 0;
  for (const g of guards || []) {
    const dx = (p.x || 0) - (g.x || 0);
    const dz = (p.z || 0) - (g.z || 0);
    const d2 = dx * dx + dz * dz;
    if (d2 < 36) bonus += 0.25;
    else if (d2 < 100) bonus += 0.12;
  }
  return Math.min(0.45, bonus);
}

function detectionRoll(kind, p, guards) {
  const sev = SEVERITY[kind];
  if (!sev) return { caught: false, chance: 0 };
  let chance = sev.detectChance + cameraHotspot(p) + guardProximityBonus(p, guards);
  if (p.role === 'guard') chance = 0;
  chance = Math.max(0.05, Math.min(0.92, chance));
  const caught = Math.random() < chance;
  return { caught, chance };
}

function validateBetAmount(n) {
  const v = Math.floor(Number(n) || 0);
  if (v < BET_MIN) return { ok: false, error: `Cược tối thiểu ${BET_MIN} xu.` };
  if (v > BET_MAX) return { ok: false, error: `Cược tối đa ${BET_MAX} xu.` };
  return { ok: true, amount: v };
}

module.exports = {
  COOLDOWN_MS,
  SEVERITY,
  BET_MIN,
  BET_MAX,
  BET_EXPIRE_MS,
  nearby,
  detectionRoll,
  validateBetAmount,
};
