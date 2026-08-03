// Shared read-only Google Sheets client, used by both results.js (Matches
// tab) and score-auth.js (Hosts tab). A single service account/JWT client is
// reused across warm invocations of whichever function container imports
// this module, to avoid re-authenticating on every request.
//
// Required environment variables (set in Netlify site settings, not in the repo):
//   GOOGLE_SERVICE_ACCOUNT_EMAIL   service account's client_email
//   GOOGLE_PRIVATE_KEY             service account's private_key (with \n escapes intact)
//   SHEETS_SPREADSHEET_ID          the spreadsheet ID from its URL

const { JWT } = require('google-auth-library');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

let cachedClient = null;

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

module.exports = { getClient, fetchValues };
