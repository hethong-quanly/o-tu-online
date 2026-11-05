'use strict';

/** Performance kinds — ca hát / múa / hít đất / kể chuyện / võ thuật */
const PERFORM_KINDS = {
  sing: {
    id: 'sing', name: 'Ca hát', emoji: '🎤', energy: 8, cooldownMs: 45000,
    emote: 'sing', basePts: 4, hits: 6, bpm: 100, durationMs: 7000,
  },
  dance: {
    id: 'dance', name: 'Múa', emoji: '💃', energy: 10, cooldownMs: 45000,
    emote: 'dance', basePts: 5, hits: 8, bpm: 120, durationMs: 8000,
  },
  pushup_show: {
    id: 'pushup_show', name: 'Hít đất biểu diễn', emoji: '🏋️', energy: 12, cooldownMs: 50000,
    emote: 'pushup', basePts: 5, hits: 8, bpm: 90, durationMs: 8000,
  },
  story: {
    id: 'story', name: 'Kể chuyện', emoji: '📖', energy: 6, cooldownMs: 40000,
    emote: 'story', basePts: 3, hits: 5, bpm: 80, durationMs: 6500,
  },
  martial: {
    id: 'martial', name: 'Võ thuật', emoji: '🥋', energy: 12, cooldownMs: 55000,
    emote: 'martial', basePts: 6, hits: 8, bpm: 110, durationMs: 8000,
  },
};

const STAGE_SPOTS = [
  { id: 'yard_stage', name: 'Sân khấu sân chơi', x: 0, z: 28, r: 7 },
  { id: 'canteen_stage', name: 'Sân khấu căn tin', x: 4, z: 0, r: 6 },
];

const GLOBAL_CD_MS = 12000;
const MAX_PERFORMS_HOUR = 20;
const CHEER_RADIUS = 14;
const MAX_CHEERS = 5;
const CHEER_BONUS = 1;

function dist2(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

function nearestStage(x, z) {
  let best = null;
  let bestD = Infinity;
  for (const s of STAGE_SPOTS) {
    const d = Math.sqrt(dist2(x, z, s.x, s.z));
    if (d <= s.r && d < bestD) {
      best = s;
      bestD = d;
    }
  }
  return best;
}

/**
 * Server-side quality from client hit reports.
 * hits: [{ offsetMs, tapped }] — offset from expected beat (−window..+window)
 * Returns 0..100
 */
function scoreQuality(kind, hits) {
  const def = PERFORM_KINDS[kind];
  if (!def) return 0;
  const list = Array.isArray(hits) ? hits.slice(0, def.hits + 2) : [];
  if (!list.length) return 5;
  const windowMs = 220;
  let good = 0;
  let perfect = 0;
  for (const h of list) {
    if (!h || typeof h.offsetMs !== 'number') continue;
    const abs = Math.abs(h.offsetMs);
    if (abs <= 70) { perfect += 1; good += 1; }
    else if (abs <= windowMs) good += 1;
  }
  const target = def.hits;
  const ratio = Math.min(1, good / target);
  const perfectBonus = Math.min(0.25, perfect / target * 0.25);
  return Math.round(Math.min(100, (ratio * 75 + perfectBonus * 100) * (0.85 + Math.min(list.length, target) / target * 0.15)));
}

function pointsFor(kind, quality, onStage, cheerCount) {
  const def = PERFORM_KINDS[kind];
  if (!def) return 0;
  const q = Math.max(0, Math.min(100, quality | 0));
  let pts = def.basePts + Math.floor(q / 25); // +0..3
  if (onStage) pts += 2;
  pts += Math.min(MAX_CHEERS, Math.max(0, cheerCount | 0)) * CHEER_BONUS;
  return pts;
}

function pruneHourWindow(arr, now) {
  const cut = now - 3600000;
  return (arr || []).filter((t) => t > cut);
}

module.exports = {
  PERFORM_KINDS,
  STAGE_SPOTS,
  GLOBAL_CD_MS,
  MAX_PERFORMS_HOUR,
  CHEER_RADIUS,
  MAX_CHEERS,
  CHEER_BONUS,
  dist2,
  nearestStage,
  scoreQuality,
  pointsFor,
  pruneHourWindow,
};
