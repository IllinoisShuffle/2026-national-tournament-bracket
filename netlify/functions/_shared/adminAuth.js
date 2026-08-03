// Admin login for admin.html/live-score-admin.js — the TD/ATD tool for
// viewing and purging the live-scores store. A single shared PIN
// (ADMIN_PIN) rather than a per-person login like score-auth.js/
// authToken.js, since there's no need to know "who" purged an entry, only
// that whoever did was authorized.
//
// The raw PIN is only ever sent once, to admin-auth.js, which checks it
// with a constant-time comparison and — on a match — signs a short-lived
// token (same HMAC primitive as authToken.js, see _shared/hmacToken.js),
// using ADMIN_PIN itself as the signing secret rather than a separate env
// var (whoever knows the PIN already has full access, so deriving the
// signing key from it doesn't weaken anything). Every subsequent request to
// live-score-admin.js sends that token, never the PIN again, so a leaked
// request exposes a time-boxed credential instead of the permanent shared
// secret.

const crypto = require('crypto');
const hmacToken = require('./hmacToken');

const DEFAULT_TTL_HOURS = 12;
const TOKEN_SCOPE = 'admin';

function getPin() {
  const pin = process.env.ADMIN_PIN;
  if (!pin) throw new Error('Missing ADMIN_PIN env var');
  return pin;
}

function verifyPin(provided) {
  let configured;
  try {
    configured = getPin();
  } catch (err) {
    return false; // fail closed if unset
  }

  const providedBuf = Buffer.from(String(provided || ''));
  const configuredBuf = Buffer.from(configured);
  if (providedBuf.length === 0 || providedBuf.length !== configuredBuf.length) return false;
  return crypto.timingSafeEqual(providedBuf, configuredBuf);
}

function signAdminToken() {
  const ttlHours = Number(process.env.ADMIN_TOKEN_TTL_HOURS) || DEFAULT_TTL_HOURS;
  return hmacToken.signToken(getPin(), { scope: TOKEN_SCOPE }, ttlHours * 60 * 60 * 1000);
}

function verifyAdminToken(token) {
  let pin;
  try {
    pin = getPin();
  } catch (err) {
    return false; // secret not configured
  }

  const payload = hmacToken.verifyToken(pin, token);
  return !!payload && payload.scope === TOKEN_SCOPE;
}

module.exports = { verifyPin, signAdminToken, verifyAdminToken };
