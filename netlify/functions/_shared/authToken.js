// Court-host login token (see score-auth.js / live-score.js). Thin wrapper
// around the shared HMAC token primitive (_shared/hmacToken.js) — signs and
// verifies a { name } claim using SCORE_AUTH_SECRET. See adminAuth.js for
// the parallel admin-login token, which uses the same primitive with a
// different secret (ADMIN_PIN) and claim shape.

const hmacToken = require('./hmacToken');

const DEFAULT_TTL_HOURS = 18;

function getSecret() {
  const secret = process.env.SCORE_AUTH_SECRET;
  if (!secret) throw new Error('Missing SCORE_AUTH_SECRET env var');
  return secret;
}

function signToken({ name }) {
  const ttlHours = Number(process.env.SCORE_AUTH_TTL_HOURS) || DEFAULT_TTL_HOURS;
  return hmacToken.signToken(getSecret(), { name }, ttlHours * 60 * 60 * 1000);
}

function verifyToken(token) {
  let secret;
  try {
    secret = getSecret();
  } catch (err) {
    return null; // secret not configured
  }

  const payload = hmacToken.verifyToken(secret, token);
  if (!payload || typeof payload.name !== 'string') return null;
  return { name: payload.name };
}

module.exports = { signToken, verifyToken };
