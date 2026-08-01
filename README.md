# 2026 Chicago National Tournament Bracket

Live bracket site for the 2026 Chicago National shuffleboard tournament at
Royal Palms. Static, build-free React (loaded via CDN + in-browser Babel) —
no bundler, no `npm run build`.

## Views

| Page | URL | Purpose |
|---|---|---|
| Auto-redirect | `index.html` | Sends phones to the mobile layout and everything else to the desktop poster. Add `?choose` to see the manual picker instead. |
| Web Bracket | `web-bracket.html` | Full 64-team zoomable/pannable poster. |
| Mobile Bracket | `mobile-bracket.html` | Vertical, single-column layout for checking results on a phone. |
| Print Poster | `print-poster.html` | Blank bracket sized for a large-format print — fill in by hand. Not wired to live data. |

Both `web-bracket.html` and `mobile-bracket.html` link back to the picker via
an "All views" link in the corner.

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

No build step. Serve the directory statically and open a page:

```bash
python3 -m http.server 8000
open http://localhost:8000/index.html
```

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
