# 2026 Chicago National Tournament Bracket

Live bracket site for the 2026 Chicago National shuffleboard tournament at
Royal Palms. Static, build-free React (loaded via CDN + in-browser Babel) —
no bundler, no `npm run build`.

## Views

| Page | URL | Purpose |
|---|---|---|
| Auto-redirect | `index.html` | Sends phones to the mobile layout and everything else to the desktop poster. Add `?choose` to see the manual picker instead. |
| Web Bracket | `web-bracket.html` | Full 64-team zoomable/pannable poster. |
| TV / Kiosk Mode | `web-bracket.html?kiosk` | Same poster, auto-cycling with no pointer needed — see below. |
| Mobile Bracket | `mobile-bracket.html` | Vertical, single-column layout for checking results on a phone. |
| Print Poster | `print-poster.html` | Blank bracket sized for a large-format print — fill in by hand. Not wired to live data. |

Both `web-bracket.html` and `mobile-bracket.html` link back to the picker via
an "All views" link in the corner.

`web-bracket.html` also redirects narrow viewports (≤700px) straight to the
mobile layout, the same way `index.html` does — so a direct link, bookmark,
or QR code that happens to land there from a phone still gets the readable
layout instead of a shrunk-down poster. Add `?full` to force the desktop
poster on a small screen anyway.

### TV / kiosk mode

Add `?kiosk` to `web-bracket.html` (e.g.
`web-bracket.html?kiosk`) for unattended displays — a lobby TV, a monitor at
the venue, etc. — where there's no mouse or touchscreen to pan/zoom:

- Hides the tweaks panel, zoom toolbar, and "All views" link.
- Auto-cycles the camera every 9 seconds through the full bracket, each
  main-bracket half, the main bracket finals, each consolation half, and
  the consolation finals — zooming in on each so text stays legible at TV
  viewing distance — with a caption at the bottom naming the current
  section (consolation stops use the actual bus route names, e.g.
  "50 DAMEN & 49 WESTERN").
- The two "finals" stops (main and consolation) only appear once that
  bracket actually has a decided regional champion — in live mode, with
  matches still in round 1, those stops are skipped rather than looping on
  an empty crop full of TBD placeholders. They start appearing automatically
  as results come in. (Demo mode with no backend configured always shows
  them, since the mock bracket has no TBD state.)
- Combine with `?full` if the display itself reports a narrow viewport
  width (e.g. a portrait-mounted screen) to skip the mobile redirect.

## Live results

`web-bracket.html` and `mobile-bracket.html` poll a Netlify Function
(`netlify/functions/results.js`) every 45 seconds, which reads the "Matches"
tab of the tournament Google Sheet and returns each match's teams and
winner as JSON.

- If the function is unreachable (not deployed yet, offline, etc.), the
  pages fall back to the original demo behavior — mock teams with a
  deterministic simulated winner — so the site still works without any
  backend configured.
- Once live, matches without a result yet render as `TBD` rather than a
  guessed winner.
- v1 shows winners only — no live score, court, or in-progress badge.

### Cost and Sheets API quota

There's no scheduled/cron trigger — the function only runs in response to
page polls, and each open tab polls every 45 seconds.

- **Sheets reads**: the function caches its Sheets API response in memory
  for 10 seconds per warm container (`CACHE_MS` in `results.js`), so
  concurrent requests within that window share one Sheets call instead of
  hitting the API each time. This stays far under Google's default quota
  (60 read requests/min per user) even with many simultaneous viewers.
- **Netlify invocations**: one tab polling every 45s is ~1,920 calls/day.
  Netlify's free tier includes 125k invocations/month, so normal tournament
  viewership (dozens of concurrent viewers over a weekend) stays well within
  the free tier.

### Match ID scheme

The Google Sheet's `ID` column drives everything. Format: `<prefix><round
size>-<number>`.

- Main bracket prefix `M`, consolation prefix `C`.
- Round size = teams entering that round: `64 → 32 → 16 → 8 → 4 → 2`.
  `M2-01` is the final, `M2-02` is the 3rd-place game (same for `C2-*`).
- Within a round, matches split into four equal blocks in fixed order:
  **Red, Blue, Green, Orange** — e.g. `M64-01..08` = Red, `09..16` = Blue,
  `17..24` = Green, `25..32` = Orange.
- The sheet already resolves team names for every round (via a formula
  against the "Lines" tab for round 1, then prior-round winners after that),
  so the app just reads each match ID directly — it doesn't derive matchups.

## Local development

No build step — it's plain HTML/JS/JSX loaded via CDN with in-browser
Babel, so any static file server works.

### Option A: static server (fastest, no live data)

```bash
python3 -m http.server 8000
open http://localhost:8000/index.html
```

`index.html` auto-redirects to the mobile or web layout based on window
width — add `?choose` to the URL to see the manual picker instead. Since
there's no backend here, the pages fall back to the built-in demo bracket
(mock teams, simulated winners) automatically. That's expected — no errors,
no live data.

### Option B: Netlify CLI (matches production, includes live data)

Use this if you need to test the Google Sheets integration itself.

```bash
npm install -g netlify-cli
netlify login
netlify link          # connect this folder to the Netlify site
netlify env:pull      # pulls GOOGLE_*/SHEETS_* env vars into .env
netlify dev
```

`netlify dev` serves the static files *and* runs the results function
locally at `/.netlify/functions/results`, so the bracket pages show real
data exactly like the deployed site. `.env` is git-ignored — never commit
it.

## Deployment (Netlify)

1. Import this repo into Netlify. `netlify.toml` configures the publish
   directory and the `netlify/functions` folder automatically.
2. In Site settings → Environment variables, set:
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL` — a Google service account's
     `client_email`, shared as Viewer on the results spreadsheet.
   - `GOOGLE_PRIVATE_KEY` — that service account's `private_key`.
   - `SHEETS_SPREADSHEET_ID` — the ID from the sheet's URL.
   - `SHEETS_MATCHES_RANGE` (optional) — defaults to `Matches!A:L`.
3. Deploy. Verify live data by visiting
   `/.netlify/functions/results` directly — it should return
   `{"matches": {...}, "updatedAt": ...}`.

## File overview

- `data.js` — quarters (Red/Blue/Green/Orange), mock team pool, round names.
- `layout.js` — poster geometry constants and helpers (web view only).
- `live-data.js` — fetches/polls the results function, maps match IDs onto
  bracket regions.
- `bracket.jsx` / `bracket-mobile.jsx` / `bracket-print.jsx` — region-building
  logic for each layout.
- `app.jsx` / `app-mobile.jsx` / `app-print.jsx` — top-level page components.
- `tweaks-panel.jsx` — shared floating settings-panel UI framework.
- `netlify/functions/results.js` — reads the Matches sheet, returns
  normalized JSON.
- `assets/` — tournament and venue logos.
