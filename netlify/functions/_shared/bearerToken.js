// Extracts a token from an `Authorization: Bearer <token>` header on a
// Netlify Function event. Shared by live-score.js (court-host token) and
// live-score-admin.js (admin token) — both send/verify a bearer token, just
// against different secrets/claim shapes.

function getBearerToken(event) {
  const header = (event.headers && (event.headers.authorization || event.headers.Authorization)) || '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

module.exports = { getBearerToken };
