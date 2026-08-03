// Admin endpoint for inspecting and purging the "live-scores" Netlify Blobs
// store from admin.html — the in-app replacement for manually running
// `netlify blobs:list` / `netlify blobs:delete` to clean up test entries.
//
// This reads/writes the same store as live-score.js and results.js, but
// unlike results.js it lists every entry in the store directly rather than
// merging onto Matches-sheet rows — so an entry for an already-decided match
// (which results.js stops surfacing once the sheet has a winner) still shows
// up here and can be purged.
//
// Requires the admin PIN (see _shared/adminAuth.js) on every request — this
// tool can purge every in-progress score at once, so unlike live-score.js
// (which can only ever affect one match's display), it's worth gating with
// a shared secret known only to the TD/ATD rather than relying on the URL
// staying unshared.

const { getStore, connectLambda } = require('@netlify/blobs');
const { MATCH_ID_RE } = require('./_shared/matchId');
const { verifyAdminPin } = require('./_shared/adminAuth');

const LIVE_SCORES_STORE = 'live-scores';

const JSON_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

function badRequest(message) {
  return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: message }) };
}

function serverError(err) {
  return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: err.message || String(err) }) };
}

async function listEntries(store) {
  const { blobs } = await store.list();
  const entries = await Promise.all(
    blobs.map(({ key }) => store.get(key, { type: 'json' }))
  );
  return entries
    .filter(Boolean)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

exports.handler = async function (event) {
  // See live-score.js for why this is needed for classic Lambda-compatible
  // function handlers.
  connectLambda(event);

  if (!verifyAdminPin(event)) {
    return { statusCode: 401, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Invalid or missing admin PIN' }) };
  }

  const store = getStore(LIVE_SCORES_STORE);

  if (event.httpMethod === 'GET') {
    try {
      const entries = await listEntries(store);
      return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ entries }) };
    } catch (err) {
      return serverError(err);
    }
  }

  if (event.httpMethod === 'DELETE') {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (err) {
      return badRequest('Invalid JSON body');
    }

    try {
      if (body.all === true) {
        const { blobs } = await store.list();
        await Promise.all(blobs.map(({ key }) => store.delete(key)));
        return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: true, deleted: blobs.length }) };
      }

      const matchId = String(body.matchId || '').trim().toUpperCase();
      if (!MATCH_ID_RE.test(matchId)) return badRequest('Invalid matchId');

      await store.delete(matchId);
      return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: true, matchId }) };
    } catch (err) {
      return serverError(err);
    }
  }

  return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
};
