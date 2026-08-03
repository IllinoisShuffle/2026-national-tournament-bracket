// Generic minimal HMAC-signed token primitive shared by authToken.js
// (court-host login, keyed by SCORE_AUTH_SECRET) and adminAuth.js (TD/ATD
// admin login, keyed by ADMIN_PIN itself). Deliberately not a JWT library —
// one algorithm, caller-supplied secret and claims, so a hand-rolled
// "payload.signature" pair over Node's built-in crypto covers both use
// cases without pulling in a dependency.
//
// Format: base64url(JSON payload) + "." + base64url(HMAC-SHA256(secret, payload)).
// "." is a safe delimiter — it never appears in base64url's alphabet.
//
// Both signing and verification run server-side in Netlify Functions and
// only ever compare against the server's own Date.now() — no client-supplied
// timestamp is trusted, so there's no clock-skew leeway to reason about.

const crypto = require('crypto');

function sign(secret, payloadB64) {
  return crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
}

function signToken(secret, claims, ttlMs) {
  const iat = Date.now();
  const exp = iat + ttlMs;
  const payload = { ...claims, iat, exp };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = sign(secret, payloadB64);
  return { token: `${payloadB64}.${sig}`, exp };
}

function verifyToken(secret, token) {
  if (!token || typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot < 0) return null;
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  let expectedSig;
  try {
    expectedSig = sign(secret, payloadB64);
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

  if (!payload || !payload.exp) return null;
  if (Date.now() >= payload.exp) return null;

  return payload;
}

module.exports = { signToken, verifyToken };
