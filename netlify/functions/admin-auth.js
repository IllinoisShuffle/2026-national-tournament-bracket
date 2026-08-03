// Verifies the shared TD/ATD admin PIN and, on a match, issues a signed,
// short-lived token (see _shared/adminAuth.js) that admin.jsx stores and
// attaches to every request to live-score-admin.js. This is the only place
// the raw ADMIN_PIN is ever sent over the wire — every read/write after
// login uses the token instead, so a leaked request exposes a time-boxed
// credential rather than the permanent shared secret.
//
// Expected JSON body: { pin }

const { verifyPin, signAdminToken } = require('./_shared/adminAuth');

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  };
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (err) {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  const pin = String(body.pin || '').trim();
  if (!pin) return jsonResponse(400, { error: 'PIN is required' });

  if (!verifyPin(pin)) {
    return jsonResponse(401, { error: 'Invalid PIN' });
  }

  const { token, exp } = signAdminToken();
  return jsonResponse(200, { token, exp });
};
