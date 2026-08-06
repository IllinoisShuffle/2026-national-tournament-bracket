// Verifies a court host's name + PIN against the "Hosts" tab of the
// tournament Google Sheet and, on a match, issues a signed auth token (see
// _shared/authToken.js) that score.jsx stores and attaches to every write it
// sends to live-score.js. This is the only place a name+PIN pair is ever
// checked — live-score.js only ever verifies the token's signature, it never
// touches Sheets credentials itself.
//
// Expected "Hosts" tab columns, in this order: Name | Court | PIN. Court is
// informational only (used to prefill score.jsx's court filter after login),
// never an access restriction — any verified host can score any match. Most
// court hosts score a pair of adjacent courts at once, so Court can list two
// numbers (e.g. "1, 2" or "1-2") — score.jsx matches that against its
// predefined court-pair filter chips. Court managers, who oversee one court
// themselves plus two hosts, can just list their own single court (e.g. "5").
//
// Required environment variables: same Sheets credentials as results.js
// (GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, SHEETS_SPREADSHEET_ID),
// plus SCORE_AUTH_SECRET (see _shared/authToken.js).
// Optional: SHEETS_HOSTS_RANGE, defaults to "Hosts!A:C".
//
// Expected JSON body: { name, pin }

const { fetchValues } = require('./_shared/sheetsClient');
const { signToken } = require('./_shared/authToken');

const MAX_FIELD_LEN = 40;

// Reused across warm invocations to avoid re-reading the Hosts tab on every
// login attempt. Short TTL (relative to results.js's 10s) since logins are
// infrequent compared to score polls, but still responsive enough that a TD
// adding a host mid-event doesn't need to wait long or trigger a redeploy.
let cachedHosts = null;
let cachedAt = 0;
const CACHE_MS = 30000;

function badRequest(message) {
  return {
    statusCode: 400,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify({ error: message }),
  };
}

function rowToHost(row) {
  const [name, court, pin] = row;
  return {
    name: (name || '').trim(),
    court: (court || '').trim(),
    pin: (pin || '').trim(),
  };
}

async function getHosts() {
  if (cachedHosts && Date.now() - cachedAt < CACHE_MS) return cachedHosts;

  const range = process.env.SHEETS_HOSTS_RANGE || 'Hosts!A:C';
  const rows = await fetchValues(range);

  const hosts = [];
  for (const row of rows) {
    const host = rowToHost(row);
    if (!host.name || !host.pin) continue; // header row or blank/spacer row
    hosts.push(host);
  }

  cachedHosts = hosts;
  cachedAt = Date.now();
  return hosts;
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

  const name = String(body.name || '').trim().slice(0, MAX_FIELD_LEN);
  const pin = String(body.pin || '').trim().slice(0, MAX_FIELD_LEN);
  if (!name || !pin) return badRequest('Name and PIN are required');

  try {
    const hosts = await getHosts();
    const host = hosts.find((h) => h.name.toLowerCase() === name.toLowerCase() && h.pin === pin);

    if (!host) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        body: JSON.stringify({ error: 'Invalid name or PIN' }),
      };
    }

    const { token, exp } = signToken({ name: host.name });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ token, name: host.name, court: host.court, exp }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ error: err.message || String(err) }),
    };
  }
};
