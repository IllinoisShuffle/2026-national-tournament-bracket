// Minimal HMAC-signed auth token for court-host login (score-auth.js issues,
// live-score.js verifies). Deliberately not a JWT library — one algorithm,
// one secret, no third-party token consumption, so a hand-rolled
// "payload.signature" pair over Node's built-in crypto is simpler and has
// one fewer dependency than pulling in `jsonwebtoken` for this.
//
// Format: base64url(JSON payload) + "." + base64url(HMAC-SHA256(secret, payload)).
// "." is a safe delimiter — it never appears in base64url's alphabet.
//
// Both signing and verification run server-side in Netlify Functions and
// only ever compare against the server's own Date.now() — no client-supplied
// timestamp is trusted, so there's no clock-skew leeway to reason about.
//
// If a secret rotation grace period is ever needed (accept tokens signed by
// an old *and* new secret briefly), that's the extension point — not built
// now since a single shared secret is enough for a "light auth" scope, and
// bumping SCORE_AUTH_SECRET to invalidate every outstanding token at once is
// an acceptable emergency-revocation story for this use case.

const crypto = require('crypto');

const DEFAULT_TTL_HOURS = 18;

function getSecret() {
  const secret = process.env.SCORE_AUTH_SECRET;
  if (!secret) throw new Error('Missing SCORE_AUTH_SECRET env var');
  return secret;
}

function sign(payloadB64) {
  return crypto.createHmac('sha256', getSecret()).update(payloadB64).digest('base64url');
}

function signToken({ name }) {
  const iat = Date.now();
  const ttlHours = Number(process.env.SCORE_AUTH_TTL_HOURS) || DEFAULT_TTL_HOURS;
  const exp = iat + ttlHours * 60 * 60 * 1000;
  const payload = { name, iat, exp };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = sign(payloadB64);
  return { token: `${payloadB64}.${sig}`, exp };
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot < 0) return null;
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  let expectedSig;
  try {
    expectedSig = sign(payloadB64);
  } catch (err) {
    return null; // secret not configured
  }

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch (err) {
    return null;
  }

  if (!payload || typeof payload.name !== 'string' || !payload.exp) return null;
  if (Date.now() >= payload.exp) return null;

  return { name: payload.name };
}

module.exports = { signToken, verifyToken };
