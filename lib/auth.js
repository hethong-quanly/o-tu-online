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

/** nickOrIp -> { fails: number[], lockedUntil: number } */
const rateBuckets = new Map();

function pruneFails(arr, now) {
  return (arr || []).filter((t) => now - t < LOGIN_WINDOW_MS);
}

function rateKey(nick, ip) {
  return `${String(nick || '').toLowerCase()}|${ip || 'unknown'}`;
}

function checkLoginRate(nick, ip) {
  const now = Date.now();
  const key = rateKey(nick, ip);
  let b = rateBuckets.get(key);
  if (!b) b = { fails: [], lockedUntil: 0 };
  b.fails = pruneFails(b.fails, now);
  if (b.lockedUntil > now) {
    return { ok: false, retryAfterMs: b.lockedUntil - now };
  }
  if (b.fails.length >= LOGIN_MAX_ATTEMPTS) {
    b.lockedUntil = now + LOGIN_LOCK_MS;
    rateBuckets.set(key, b);
    return { ok: false, retryAfterMs: LOGIN_LOCK_MS };
  }
  rateBuckets.set(key, b);
  return { ok: true };
}

function recordLoginFail(nick, ip) {
  const now = Date.now();
  const key = rateKey(nick, ip);
  let b = rateBuckets.get(key) || { fails: [], lockedUntil: 0 };
  b.fails = pruneFails(b.fails, now);
  b.fails.push(now);
  if (b.fails.length >= LOGIN_MAX_ATTEMPTS) b.lockedUntil = now + LOGIN_LOCK_MS;
  rateBuckets.set(key, b);
}

function clearLoginFails(nick, ip) {
  rateBuckets.delete(rateKey(nick, ip));
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
  return crypto.timingSafeEqual(Buffer.from(derived), expected);
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

function validatePasswordStrength(pw) {
  const s = String(pw || '');
  if (s.length < 6) return 'Mật khẩu phải từ 6 ký tự.';
  if (s.length > 72) return 'Mật khẩu tối đa 72 ký tự.';
  return null;
}

/** Never log passwords — strip before any debug dump */
function redactAuth(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const o = { ...obj };
  delete o.password;
  delete o.passwordHash;
  delete o.sessionToken;
  delete o.authSessions;
  delete o.newPassword;
  return o;
}

module.exports = {
  hashPassword,
  verifyPassword,
  issueSession,
  verifySession,
  revokeSession,
  checkLoginRate,
  recordLoginFail,
  clearLoginFails,
  validatePasswordStrength,
  redactAuth,
  SESSION_DAYS,
};
