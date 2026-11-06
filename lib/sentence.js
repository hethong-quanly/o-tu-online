'use strict';

const trial = require('./trial');
const YEAR_ONLINE_MS = trial.YEAR_ONLINE_MS; // 120h
const MS_PER_HOUR = 60 * 60 * 1000;

/** Migrate legacy day-based sentence → online-hours years */
function ensureSentenceFields(p) {
  if (!p || typeof p !== 'object') return p;
  if (!Array.isArray(p.violations)) p.violations = [];
  if (p.onlineMsServed == null) p.onlineMsServed = 0;
  if (p.visitorMode == null) p.visitorMode = false;
  if (p.trialDone == null) p.trialDone = !!p.intakeDone; // legacy already past intake
  if (p.intakeCuts == null) p.intakeCuts = { exercise: false, talk: false, gift: false };
  if (p.intakeStartedAt == null && !p.intakeDone) p.intakeStartedAt = Date.now();
  if (p.intakeDurationMs == null) p.intakeDurationMs = 120 * 1000;

  if (p.sentenceOnlineMsLeft == null) {
    const days = Math.max(0, Number(p.sentenceLeftDays) || 0);
    // ~30 in-game days ≈ 1 year online sentence
    let years = days > 0 ? Math.max(0.25, Math.min(10, days / 30)) : 0;
    if (p.intakeDone && days <= 0 && !p.released) years = 0;
    p.sentenceYears = Math.ceil(years);
    p.sentenceOnlineMsTotal = Math.floor(years * YEAR_ONLINE_MS);
    p.sentenceOnlineMsLeft = Math.floor(years * YEAR_ONLINE_MS);
  }
  if (p.sentenceYears == null) {
    p.sentenceYears = Math.ceil((p.sentenceOnlineMsLeft || 0) / YEAR_ONLINE_MS);
  }
  return p;
}

function setSentenceYears(p, years) {
  const y = Math.max(0, Math.min(10, Number(years) || 0));
  p.sentenceYears = y;
  p.sentenceOnlineMsTotal = Math.floor(y * YEAR_ONLINE_MS);
  p.sentenceOnlineMsLeft = Math.floor(y * YEAR_ONLINE_MS);
  // keep legacy fields roughly in sync for old UI bits
  p.sentenceTotalDays = Math.round(y * 30);
  p.sentenceLeftDays = Math.round(y * 30);
}

function addSentenceYears(p, yearsAdd) {
  ensureSentenceFields(p);
  const addMs = Math.floor((Number(yearsAdd) || 0) * YEAR_ONLINE_MS);
  p.sentenceOnlineMsLeft = Math.max(0, (p.sentenceOnlineMsLeft || 0) + addMs);
  p.sentenceOnlineMsTotal = Math.max(p.sentenceOnlineMsTotal || 0, p.sentenceOnlineMsLeft);
  p.sentenceYears = Math.max(p.sentenceYears || 0, Math.ceil((p.sentenceOnlineMsLeft || 0) / YEAR_ONLINE_MS));
  p.sentenceLeftDays = Math.max(0, Math.ceil((p.sentenceOnlineMsLeft || 0) / YEAR_ONLINE_MS * 30));
}

function cutOnlineMs(p, ms) {
  ensureSentenceFields(p);
  p.sentenceOnlineMsLeft = Math.max(0, (p.sentenceOnlineMsLeft || 0) - Math.max(0, ms));
  p.sentenceLeftDays = Math.max(0, Math.ceil((p.sentenceOnlineMsLeft || 0) / YEAR_ONLINE_MS * 30));
}

function tickOnline(p, dtMs) {
  if (!p || p.escaped || p.released || p.role === 'guard' || p.visitorMode) return false;
  if (!p.intakeDone || !p.trialDone) return false;
  ensureSentenceFields(p);
  if ((p.sentenceOnlineMsLeft || 0) <= 0) return true;
  p.onlineMsServed = (p.onlineMsServed || 0) + dtMs;
  p.sentenceOnlineMsLeft = Math.max(0, (p.sentenceOnlineMsLeft || 0) - dtMs);
  p.sentenceLeftDays = Math.max(0, Math.ceil((p.sentenceOnlineMsLeft || 0) / YEAR_ONLINE_MS * 30));
  return (p.sentenceOnlineMsLeft || 0) <= 0;
}

function formatRemaining(p) {
  ensureSentenceFields(p);
  const left = Math.max(0, p.sentenceOnlineMsLeft || 0);
  const years = Math.floor(left / YEAR_ONLINE_MS);
  const hours = Math.ceil((left % YEAR_ONLINE_MS) / MS_PER_HOUR);
  return { years, hours, leftMs: left, label: `${years} năm ${hours} giờ online` };
}

function intakeRemainingMs(p, now = Date.now()) {
  if (!p || p.intakeDone) return 0;
  const start = p.intakeStartedAt || now;
  const dur = p.intakeDurationMs != null ? p.intakeDurationMs : 120000;
  return Math.max(0, dur - (now - start));
}

function applyIntakeCut(p, kind, cutMs = 30000) {
  if (!p || p.intakeDone) return { ok: false, error: 'Đã hết tạm giam.' };
  if (!p.intakeCuts) p.intakeCuts = { exercise: false, talk: false, gift: false };
  if (!['exercise', 'talk', 'gift'].includes(kind)) return { ok: false, error: 'Loại không hợp lệ.' };
  if (p.intakeCuts[kind]) return { ok: false, error: 'Bạn đã dùng giảm thời gian này rồi.' };
  p.intakeCuts[kind] = true;
  p.intakeDurationMs = Math.max(0, (p.intakeDurationMs != null ? p.intakeDurationMs : 120000) - cutMs);
  return { ok: true, leftMs: intakeRemainingMs(p), cuts: { ...p.intakeCuts } };
}

module.exports = {
  YEAR_ONLINE_MS,
  MS_PER_HOUR,
  ensureSentenceFields,
  setSentenceYears,
  addSentenceYears,
  cutOnlineMs,
  tickOnline,
  formatRemaining,
  intakeRemainingMs,
  applyIntakeCut,
};
