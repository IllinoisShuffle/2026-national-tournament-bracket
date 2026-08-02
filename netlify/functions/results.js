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

const { JWT } = require('google-auth-library');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
const MATCH_ID_RE = /^[MC](64|32|16|8|4|2)-\d+$/i;

// Reused across warm invocations of the same function container to avoid
// re-authenticating (and hitting the Sheets API) on every single poll.
let cachedClient = null;
let cachedResult = null;
let cachedAt = 0;
const CACHE_MS = 10000;

function getClient() {
  if (cachedClient) return cachedClient;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!email || !key) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY env vars');
  }
  cachedClient = new JWT({ email, key, scopes: SCOPES });
  return cachedClient;
}

async function fetchValues(range) {
  const spreadsheetId = process.env.SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error('Missing SHEETS_SPREADSHEET_ID env var');
  const client = getClient();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const res = await client.request({ url });
  return (res.data && res.data.values) || [];
}

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

exports.handler = async function () {
  if (cachedResult && Date.now() - cachedAt < CACHE_MS) {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(cachedResult) };
  }

  try {
    const range = process.env.SHEETS_MATCHES_RANGE || 'Matches!A:L';
    const rows = await fetchValues(range);

    const matches = {};
    for (const row of rows) {
      const id = (row[0] || '').trim();
      if (!MATCH_ID_RE.test(id)) continue; // header row, spacer row, or unrelated row
      const m = rowToMatch(row);
      matches[m.id.toUpperCase()] = m;
    }

    const result = { matches, updatedAt: Date.now() };
    cachedResult = result;
    cachedAt = Date.now();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
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
