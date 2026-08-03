// Accepts in-progress court scores from a court host's scorekeeping page
// (score.html) and writes them to Netlify Blobs, keyed by match ID. This is
// a supplementary, display-only feed — it never touches the Matches Google
// Sheet or its credentials. The TD/ATD still manually transcribes the final
// score/winner into the Matches tab; once that happens, results.js stops
// surfacing the live entry for that match ID (see attachLiveScores there).
//
// Requires a court-host auth token (see score-auth.js / _shared/authToken.js)
// on every write — this endpoint verifies the token's signature only, it
// never reads Sheets credentials itself, so it structurally still can't
// author the tournament's official bracket even though it's now gated.
//
// Expected JSON body:
//   { matchId, court, yellowScore, blackScore, status, force }
//   status is "in_progress" (default) or "complete".
//   scorer is no longer taken from the request body — it's always the
//   verified name embedded in the Authorization token, so it can't be
//   spoofed and is trustworthy for "who is keeping score."
//
// Concurrency: if another verified host recently posted an in-progress
// update to the same match, a write is rejected with 409 unless `force:
// true` is set (an explicit "take over" confirmation from score.jsx). The
// conflict check + write use Netlify Blobs' conditional-write primitives
// (getWithMetadata + setJSON's onlyIfMatch/onlyIfNew) rather than a
// read-then-blind-write, so a race between two near-simultaneous writes is
// also caught (the second write's onlyIfMatch fails and comes back as a
// conflict) instead of silently overwriting.
//
// The read deliberately uses default ("eventual") consistency, not
// "strong" — strong consistency requires Blobs' uncachedEdgeURL to be wired
// up, which isn't available in every environment (confirmed: it 500s
// against the local `netlify dev` Blobs emulator) and isn't actually needed
// for correctness here. The real guarantee comes from the conditional
// write, not the read: if the read is stale (missed a very recent write),
// the following setJSON's onlyIfMatch/onlyIfNew is checked against the
// store's true current state at write time and fails with `modified:
// false` regardless, which we already treat as a 409
// (`conflict_lost_race`). A stale read can only downgrade which 409
// variant the client sees — it can never let two conflicting writes both
// succeed.

const { getStore, connectLambda } = require('@netlify/blobs');
const { MATCH_ID_RE } = require('./_shared/matchId');
const { verifyToken } = require('./_shared/authToken');
const { getBearerToken } = require('./_shared/bearerToken');

const LIVE_SCORES_STORE = 'live-scores';
// A "10 off" penalty can push a side negative before it's scored anything,
// and a long 16-frame game can run well past 100 — these are generous
// sanity bounds, not real gameplay limits.
const MIN_SCORE = -999;
const MAX_SCORE = 999;
const MAX_COURT_LEN = 20;
const VALID_STATUSES = new Set(['in_progress', 'complete']);

// How recent an existing entry's update has to be before a *different*
// verified scorer's write is treated as a live conflict rather than someone
// picking up an abandoned match. Must match ACTIVE_THRESHOLD_MS in
// score.jsx — that copy drives the informational "Being scored by X" UI at
// browse time, this one enforces the same window at write time. Kept as two
// separate literals (score.jsx is browser code loaded via in-page Babel and
// can't require() this server module) — keep them in sync if changed.
const ACTIVE_THRESHOLD_MS = 5 * 60 * 1000;

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  };
}

function badRequest(message) {
  return jsonResponse(400, { error: message });
}

function parseScore(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < MIN_SCORE || n > MAX_SCORE) return null;
  return n;
}

exports.handler = async function (event) {
  // Classic Lambda-compatible functions (this handler shape) don't get
  // Netlify Blobs auto-configured the way newer-format functions do — the
  // connection details arrive on event.blobs instead, and this call wires
  // them up so the plain getStore(name) below can find them.
  connectLambda(event);

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const token = getBearerToken(event);
  const auth = token && verifyToken(token);
  if (!auth) return jsonResponse(401, { error: 'Missing or invalid auth token' });

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
  const force = body.force === true;
  const scorer = auth.name;

  try {
    const store = getStore(LIVE_SCORES_STORE);
    const existing = await store.getWithMetadata(matchId, { type: 'json' });

    if (
      !force &&
      existing &&
      existing.data &&
      existing.data.status === 'in_progress' &&
      existing.data.scorer &&
      existing.data.scorer !== scorer &&
      Date.now() - existing.data.updatedAt < ACTIVE_THRESHOLD_MS
    ) {
      return jsonResponse(409, {
        error: 'in_progress_conflict',
        scorer: existing.data.scorer,
        updatedAt: existing.data.updatedAt,
        yellowScore: existing.data.yellowScore,
        blackScore: existing.data.blackScore,
      });
    }

    const updatedAt = Date.now();
    const entry = { matchId, court, yellowScore, blackScore, status, scorer, updatedAt };
    const writeOptions = existing ? { onlyIfMatch: existing.etag } : { onlyIfNew: true };
    const result = await store.setJSON(matchId, entry, writeOptions);

    if (!result.modified) {
      // Another write landed between our read and our write — a genuine
      // race rather than a "someone else is on it" takeover case. Ask the
      // client to reload the current value and retry.
      return jsonResponse(409, { error: 'conflict_lost_race' });
    }

    return jsonResponse(200, { ok: true, matchId, updatedAt });
  } catch (err) {
    return jsonResponse(500, { error: err.message || String(err) });
  }
};
