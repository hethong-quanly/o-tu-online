'use strict';

const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);

const SCRYPT_N_PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEYLEN = 64;
const SESSION_DAYS = 30;
const MAX_SESSIONS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 8;
const LOGIN_LOCK_MS = 60 * 1000;
const FORGOT_MAX_ATTEMPTS = 5;
const FORGOT_LOCK_MS = 90 * 1000;

const SECURITY_QUESTIONS = [
  { id: 'pet', text: 'Tên thú cưng đầu tiên của bạn là gì?' },
  { id: 'school', text: 'Trường tiểu học của bạn tên gì?' },
  { id: 'food', text: 'Món ăn yêu thích của bạn là gì?' },
  { id: 'city', text: 'Bạn sinh ra ở thành phố nào?' },
  { id: 'childhood', text: 'Biệt danh thời thơ ấu của bạn là gì?' },
];

const NICK_BLOCK = [
  'admin', 'quanly', 'mod', 'moderator', 'hethong', 'system', 'null', 'undefined',
  'dmcs', 'ditme', 'địt', 'dit ', 'lon ', 'lồn', 'buoi', 'cặc', 'cac ', 'fuck',
  'shit', 'nigga', 'Hitler', 'sex', 'porn', 'xxx',
];

/** nickOrIp -> { fails: number[], lockedUntil: number } */
const rateBuckets = new Map();

function pruneFails(arr, now, windowMs = LOGIN_WINDOW_MS) {
  return (arr || []).filter((t) => now - t < windowMs);
}

function rateKey(kind, nick, ip) {
  return `${kind}|${String(nick || '').toLowerCase()}|${ip || 'unknown'}`;
}

function checkRate(kind, nick, ip, maxAttempts = LOGIN_MAX_ATTEMPTS, lockMs = LOGIN_LOCK_MS) {
  const now = Date.now();
  const key = rateKey(kind, nick, ip);
  let b = rateBuckets.get(key);
  if (!b) b = { fails: [], lockedUntil: 0 };
  b.fails = pruneFails(b.fails, now);
  if (b.lockedUntil > now) {
    return { ok: false, retryAfterMs: b.lockedUntil - now };
  }
  if (b.fails.length >= maxAttempts) {
    b.lockedUntil = now + lockMs;
    rateBuckets.set(key, b);
    return { ok: false, retryAfterMs: lockMs };
  }
  rateBuckets.set(key, b);
  return { ok: true };
}

function recordFail(kind, nick, ip, maxAttempts = LOGIN_MAX_ATTEMPTS, lockMs = LOGIN_LOCK_MS) {
  const now = Date.now();
  const key = rateKey(kind, nick, ip);
  let b = rateBuckets.get(key) || { fails: [], lockedUntil: 0 };
  b.fails = pruneFails(b.fails, now);
  b.fails.push(now);
  if (b.fails.length >= maxAttempts) b.lockedUntil = now + lockMs;
  rateBuckets.set(key, b);
}

function clearFails(kind, nick, ip) {
  rateBuckets.delete(rateKey(kind, nick, ip));
}

function checkLoginRate(nick, ip) {
  return checkRate('login', nick, ip, LOGIN_MAX_ATTEMPTS, LOGIN_LOCK_MS);
}
function recordLoginFail(nick, ip) {
  recordFail('login', nick, ip, LOGIN_MAX_ATTEMPTS, LOGIN_LOCK_MS);
}
function clearLoginFails(nick, ip) {
  clearFails('login', nick, ip);
}
function checkForgotRate(nick, ip) {
  return checkRate('forgot', nick, ip, FORGOT_MAX_ATTEMPTS, FORGOT_LOCK_MS);
}
function recordForgotFail(nick, ip) {
  recordFail('forgot', nick, ip, FORGOT_MAX_ATTEMPTS, FORGOT_LOCK_MS);
}
function clearForgotFails(nick, ip) {
  clearFails('forgot', nick, ip);
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(password, salt, KEYLEN, SCRYPT_N_PARAMS);
  return `scrypt$${salt.toString('base64')}$${Buffer.from(derived).toString('base64')}`;
}

async function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string' || !stored.startsWith('scrypt$')) return false;
  const parts = stored.split('$');
  if (parts.length !== 3) return false;
  const salt = Buffer.from(parts[1], 'base64');
  const expected = Buffer.from(parts[2], 'base64');
  const derived = await scrypt(password, salt, expected.length, SCRYPT_N_PARAMS);
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(derived), expected);
}

/** Lowercase, strip accents/diacritics, collapse whitespace */
function normalizeAnswer(ans) {
  return String(ans || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function hashSecurityAnswer(answer) {
  const norm = normalizeAnswer(answer);
  if (norm.length < 2) throw new Error('answer_too_short');
  return hashPassword(norm);
}

async function verifySecurityAnswer(answer, stored) {
  return verifyPassword(normalizeAnswer(answer), stored);
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function issueSession(player) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const exp = Date.now() + SESSION_DAYS * 86400000;
  if (!Array.isArray(player.authSessions)) player.authSessions = [];
  player.authSessions = player.authSessions.filter((s) => s && s.exp > Date.now());
  player.authSessions.push({ tokenHash, exp });
  while (player.authSessions.length > MAX_SESSIONS) player.authSessions.shift();
  return { token, exp };
}

function verifySession(player, token) {
  if (!player || !token || !Array.isArray(player.authSessions)) return false;
  const th = hashToken(String(token));
  const now = Date.now();
  player.authSessions = player.authSessions.filter((s) => s && s.exp > now);
  return player.authSessions.some((s) => s.tokenHash === th);
}

function revokeSession(player, token) {
  if (!player || !Array.isArray(player.authSessions) || !token) return;
  const th = hashToken(String(token));
  player.authSessions = player.authSessions.filter((s) => s && s.tokenHash !== th);
}

function revokeAllSessions(player) {
  if (!player) return;
  player.authSessions = [];
}

function validatePasswordStrength(pw) {
  const s = String(pw || '');
  if (s.length < 6) return 'Mật khẩu phải từ 6 ký tự.';
  if (s.length > 72) return 'Mật khẩu tối đa 72 ký tự.';
  return null;
}

function validateUsername(name) {
  const s = String(name || '').trim().replace(/[<>]/g, '');
  if (s.length < 2 || s.length > 16) return 'Tên đăng nhập phải từ 2–16 ký tự.';
  if (!/^[\p{L}\p{N}_.\- ]+$/u.test(s)) return 'Tên đăng nhập chỉ gồm chữ, số, dấu cách, _ . -';
  const low = normalizeAnswer(s).replace(/\s+/g, '');
  for (const bad of NICK_BLOCK) {
    if (low.includes(normalizeAnswer(bad).replace(/\s+/g, ''))) {
      return 'Tên đăng nhập không được chấp nhận.';
    }
  }
  return null;
}

function validateNickname(name) {
  const s = String(name || '').trim().replace(/[<>]/g, '');
  if (s.length < 2 || s.length > 16) return 'Biệt danh phải từ 2–16 ký tự.';
  if (!/^[\p{L}\p{N}_.\- ]+$/u.test(s)) return 'Biệt danh chỉ gồm chữ, số, dấu cách, _ . -';
  const low = normalizeAnswer(s).replace(/\s+/g, '');
  for (const bad of NICK_BLOCK) {
    if (low.includes(normalizeAnswer(bad).replace(/\s+/g, ''))) {
      return 'Biệt danh không được chấp nhận.';
    }
  }
  return null;
}

function questionById(id) {
  return SECURITY_QUESTIONS.find((q) => q.id === id) || null;
}

function redactAuth(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const o = { ...obj };
  delete o.password;
  delete o.passwordHash;
  delete o.sessionToken;
  delete o.authSessions;
  delete o.newPassword;
  delete o.securityAnswer;
  delete o.securityAnswerHash;
  delete o.answer;
  return o;
}

module.exports = {
  hashPassword,
  verifyPassword,
  hashSecurityAnswer,
  verifySecurityAnswer,
  normalizeAnswer,
  issueSession,
  verifySession,
  revokeSession,
  revokeAllSessions,
  checkLoginRate,
  recordLoginFail,
  clearLoginFails,
  checkForgotRate,
  recordForgotFail,
  clearForgotFails,
  validatePasswordStrength,
  validateUsername,
  validateNickname,
  questionById,
  SECURITY_QUESTIONS,
  redactAuth,
  SESSION_DAYS,
};
