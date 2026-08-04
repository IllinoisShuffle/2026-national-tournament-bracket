// Reads the "Matches" tab of the tournament results Google Sheet and returns
// normalized JSON the bracket pages can poll.
//
// Expected columns (A:L), in this order, matching the "Matches" tab:
//   ID | Time | Court | Yellow | Score | Black | Score | Courts Used | Winner | Loser | LIVE | Approx End
//
// ID format: "M64-01".."M64-32", "M32-01".."M32-16", ... "M4-01".."M4-02",
// "M2-01" (final), "M2-02" (3rd place) for the main bracket, and the same
// pattern with a "C" prefix (C32, C16, C8, C4, C2) for the consolation
// bracket. Header rows and blank spacer rows are skipped automatically —
// any row whose ID cell doesn't match the pattern is ignored.
//
// Required environment variables (set in Netlify site settings, not in the repo):
//   GOOGLE_SERVICE_ACCOUNT_EMAIL   service account's client_email
//   GOOGLE_PRIVATE_KEY             service account's private_key (with \n escapes intact)
//   SHEETS_SPREADSHEET_ID          the spreadsheet ID from its URL
// Optional:
//   SHEETS_MATCHES_RANGE           defaults to "Matches!A:L"

const { getStore, connectLambda } = require('@netlify/blobs');
const { MATCH_ID_RE } = require('./_shared/matchId');
const { fetchValues } = require('./_shared/sheetsClient');

const LIVE_SCORES_STORE = 'live-scores';

// Cache-Control (no-store) keeps browsers from serving a poll out of their own
// local cache; Netlify-CDN-Cache-Control lets Netlify's edge collapse many
// concurrent spectators' polls into a single function invocation for a few
// seconds, which is what actually saves compute credits under load.
const SUCCESS_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  'Netlify-CDN-Cache-Control': 'public, max-age=5, durable',
};

// Reused across warm invocations of the same function container to avoid
// re-hitting the Sheets API on every single poll. This caches only the
// Sheets-derived skeleton (no live scores) — attachLiveScores runs fresh on
// every request regardless of this cache's age, since a Blobs list+get is
// cheap and fast, unlike a Sheets API call. Caching the merged result here
// too (as an earlier version did) meant an in-progress score/frame update
// could sit invisible for up to CACHE_MS on top of the client's own poll
// interval — a host correcting a score would see it un-correct itself, and
// nobody would see the frame counter advance, for up to ~20s.
let cachedSheetMatches = null;
let cachedAt = 0;
const CACHE_MS = 10000;

// Positional column parsing — see header comment for the exact expected order.
function rowToMatch(row) {
  const [id, time, court, yellow, yellowScore, black, blackScore, courtsUsed, winner, loser, live, approxEnd] = row;
  return {
    id: (id || '').trim(),
    time: time || '',
    court: court || '',
    yellow: (yellow || '').trim(),
    yellowScore: yellowScore || '',
    black: (black || '').trim(),
    blackScore: blackScore || '',
    courtsUsed: courtsUsed || '',
    winner: (winner || '').trim(),
    loser: (loser || '').trim(),
    live: /.*(y|yes|true|1|live|LIVE)$/i.test(String(live || '').trim()),
    approxEnd: approxEnd || '',
  };
}

// Merges in-progress court scores (from the "live-score" write function)
// onto matches that don't have an authoritative winner yet. The Matches
// sheet always wins once the TD/ATD fills in a winner — a live entry never
// overrides or contests a finalized result, it just stops being surfaced.
// Failures here (Blobs outage, etc.) degrade to Sheets-only data rather than
// breaking the whole response.
async function attachLiveScores(matches) {
  try {
    const store = getStore(LIVE_SCORES_STORE);
    const { blobs } = await store.list();
    await Promise.all(
      blobs.map(async ({ key }) => {
        const match = matches[key];
        if (!match || match.winner) return;
        const entry = await store.get(key, { type: 'json' });
        if (entry) match.liveScore = entry;
      })
    );
  } catch (err) {
    // Blobs unavailable — leave matches as Sheets-only.
  }
}

exports.handler = async function (event) {
  // See live-score.js for why this is needed — classic Lambda-compatible
  // functions must manually wire up the Blobs connection details carried on
  // event.blobs before any getStore() call will work.
  connectLambda(event);

  try {
    let matches;
    if (cachedSheetMatches && Date.now() - cachedAt < CACHE_MS) {
      // Clone so this request's attachLiveScores() mutations (and the next
      // Sheets refresh) never leak into the cached skeleton other requests
      // are about to reuse.
      matches = JSON.parse(JSON.stringify(cachedSheetMatches));
    } else {
      const range = process.env.SHEETS_MATCHES_RANGE || 'Matches!A:L';
      const rows = await fetchValues(range);

      matches = {};
      for (const row of rows) {
        const id = (row[0] || '').trim();
        if (!MATCH_ID_RE.test(id)) continue; // header row, spacer row, or unrelated row
        const m = rowToMatch(row);
        matches[m.id.toUpperCase()] = m;
      }

      cachedSheetMatches = matches;
      cachedAt = Date.now();
      matches = JSON.parse(JSON.stringify(matches));
    }

    await attachLiveScores(matches);

    const result = { matches, updatedAt: Date.now() };

    return {
      statusCode: 200,
      headers: SUCCESS_HEADERS,
      body: JSON.stringify(result),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ error: err.message || String(err) }),
    };
  }
};
