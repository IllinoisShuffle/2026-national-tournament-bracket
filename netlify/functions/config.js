// Reads the "Config" tab of the tournament Google Sheet and returns a
// key/value map of feature toggles the front-end can poll — e.g. whether to
// show the Speed Shuffle signup card on the view picker.
//
// Expected columns (A:B): Key | Value
//   SpeedShuffleSignupEnabled | TRUE
//
// The TD/ATD flips these by hand in the sheet, same as the Matches and
// Hosts tabs — no redeploy needed to turn a toggle on or off.
//
// Required environment variables (set in Netlify site settings, not in the repo):
//   GOOGLE_SERVICE_ACCOUNT_EMAIL   service account's client_email
//   GOOGLE_PRIVATE_KEY             service account's private_key (with \n escapes intact)
//   SHEETS_SPREADSHEET_ID          the spreadsheet ID from its URL
// Optional:
//   SHEETS_CONFIG_RANGE            defaults to "Config!A:B"

const { fetchValues } = require('./_shared/sheetsClient');

const SUCCESS_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  'Netlify-CDN-Cache-Control': 'public, max-age=300, durable',
};

// Unlike Matches (updated continuously all weekend), Config toggles like
// SpeedShuffleSignupEnabled are flipped once at a known point in the
// tournament, so a multi-minute lag before it takes effect is fine — no
// need for the ~10s freshness results.js targets for live scores.
let cached = null;
let cachedAt = 0;
const CACHE_MS = 300000;

function truthy(value) {
  return /^(true|yes|y|1|on)$/i.test(String(value || '').trim());
}

exports.handler = async function () {
  try {
    if (!cached || Date.now() - cachedAt >= CACHE_MS) {
      const range = process.env.SHEETS_CONFIG_RANGE || 'Config!A:B';
      const rows = await fetchValues(range);

      const config = {};
      for (const row of rows) {
        const key = (row[0] || '').trim();
        if (!key || key.toLowerCase() === 'key') continue; // blank/header row
        config[key] = truthy(row[1]);
      }

      cached = config;
      cachedAt = Date.now();
    }

    return {
      statusCode: 200,
      headers: SUCCESS_HEADERS,
      body: JSON.stringify(cached),
    };
  } catch (err) {
    // Sheet unreachable, tab missing, etc. — fail closed so toggles read as
    // off rather than breaking the picker page.
    return {
      statusCode: 200,
      headers: SUCCESS_HEADERS,
      body: JSON.stringify({}),
    };
  }
};
