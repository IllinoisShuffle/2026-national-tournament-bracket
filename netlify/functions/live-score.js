// Accepts in-progress court scores from a court host's scorekeeping page
// (score.html) and writes them to Netlify Blobs, keyed by match ID. This is
// a supplementary, display-only feed — it never touches the Matches Google
// Sheet or its credentials. The TD/ATD still manually transcribes the final
// score/winner into the Matches tab; once that happens, results.js stops
// surfacing the live entry for that match ID (see attachLiveScores there).
//
// Intentionally unauthenticated: this endpoint can never author the
// tournament's official bracket, only a transient in-progress display, so
// the blast radius of a stray/abusive POST is limited to a wrong-looking
// live score that the TD's manual transcription supersedes regardless.
//
// Expected JSON body:
//   { matchId, court, yellowScore, blackScore, status }
//   status is "in_progress" (default) or "complete".

const { getStore } = require('@netlify/blobs');
const { MATCH_ID_RE } = require('./_shared/matchId');

const LIVE_SCORES_STORE = 'live-scores';
const MAX_SCORE = 99;
const MAX_COURT_LEN = 20;
const VALID_STATUSES = new Set(['in_progress', 'complete']);

function badRequest(message) {
  return {
    statusCode: 400,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify({ error: message }),
  };
}

function parseScore(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > MAX_SCORE) return null;
  return n;
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (err) {
    return badRequest('Invalid JSON body');
  }

  const matchId = String(body.matchId || '').trim().toUpperCase();
  if (!MATCH_ID_RE.test(matchId)) return badRequest('Invalid matchId');

  const yellowScore = parseScore(body.yellowScore);
  if (yellowScore === null) return badRequest('Invalid yellowScore');

  const blackScore = parseScore(body.blackScore);
  if (blackScore === null) return badRequest('Invalid blackScore');

  const status = body.status === undefined ? 'in_progress' : String(body.status).trim();
  if (!VALID_STATUSES.has(status)) return badRequest('Invalid status');

  const court = String(body.court || '').trim().slice(0, MAX_COURT_LEN);

  try {
    const store = getStore(LIVE_SCORES_STORE);
    const updatedAt = Date.now();
    await store.setJSON(matchId, { matchId, court, yellowScore, blackScore, status, updatedAt });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ ok: true, matchId, updatedAt }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ error: err.message || String(err) }),
    };
  }
};
