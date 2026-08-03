// Shared PIN check for admin.html/live-score-admin.js — the TD/ATD tool for
// viewing and purging the live-scores store. Deliberately a single static
// secret known only to the TD/ATD, not a per-person login like
// score-auth.js/authToken.js: there's no need to know "who" purged an
// entry, only that whoever did was authorized.

const crypto = require('crypto');

function verifyAdminPin(event) {
  const configured = process.env.ADMIN_PIN;
  if (!configured) return false; // fail closed if unset

  const header = (event.headers && (event.headers['x-admin-pin'] || event.headers['X-Admin-Pin'])) || '';
  const provided = String(header).trim();
  if (!provided) return false;

  const providedBuf = Buffer.from(provided);
  const configuredBuf = Buffer.from(configured);
  // Length must match before timingSafeEqual (it throws on mismatched
  // lengths rather than returning false), and comparing length first is
  // itself not a meaningful timing leak — PIN length isn't the secret.
  if (providedBuf.length !== configuredBuf.length) return false;
  return crypto.timingSafeEqual(providedBuf, configuredBuf);
}

module.exports = { verifyAdminPin };
