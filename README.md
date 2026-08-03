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
| Live Scoreboard | `scoreboard.html` | Matches currently on the court — scores, court number, and what's up next. |
| Court Scorekeeping | `score.html` | Court host tool for entering an in-progress match's score. One link for everyone, with an on-page court filter — see "In-progress court scores" below. |
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
- Auto-cycles the camera every 9 seconds through up to 9 stops, zooming in
  on each so text stays legible at TV viewing distance, with a caption at
  the bottom naming the current one:
  1. Full bracket
  2. Main · Red & Blue
  3. Main · Green & Orange
  4. Main · The Loop (semifinals, final, 3rd place game)
  5. Main · Final Rankings
  6. Consolation · &lt;bus route pair&gt; (e.g. "50 DAMEN & 49 WESTERN")
  7. Consolation · &lt;bus route pair&gt;
  8. Consolation · Final Four
  9. Consolation · Final Rankings
- Stops 4/5 and 8/9 are gated on tournament progress, so kiosk mode never
  dwells on an empty crop full of TBD placeholders: the "Loop"/"Final Four"
  stop appears once at least one region has crowned a champion, and the
  "Final Rankings" stop only once all four placements (1st–4th) are decided.
  They fade in automatically as live results come in — no restart needed.
  (Demo mode with no backend configured always shows all 9, since the mock
  bracket has no TBD state.)
- Combine with `?full` if the display itself reports a narrow viewport
  width (e.g. a portrait-mounted screen) to skip the mobile redirect.

## Live results

`web-bracket.html`, `mobile-bracket.html`, and `scoreboard.html` poll a
Netlify Function (`netlify/functions/results.js`) every 15 seconds, which
reads the "Matches" tab of the tournament Google Sheet and returns each
match's teams, scores, court, and winner as JSON.

- If the function is unreachable (not deployed yet, offline, etc.), the
  bracket pages fall back to the original demo behavior — mock teams with a
  deterministic simulated winner — so the site still works without any
  backend configured. `scoreboard.html` falls back to a small labeled set of
  demo matches instead, since it has no bracket to derive results from.
- Once live, matches without a result yet render as `TBD` rather than a
  guessed winner.
- Winners always come from the Matches sheet. In-progress scores are a
  separate, supplementary feed — see "In-progress court scores" below — so
  the bracket views (`web-bracket.html`, `mobile-bracket.html`) can now show
  a small live-score badge next to an undecided match, and `scoreboard.html`
  lists actively-scored matches under "On the Courts" with their running
  score, and everything else with a court/time assigned under "Up Next".

### Cost and Sheets API quota

There's no scheduled/cron trigger — the function only runs in response to
page polls, and each open tab polls every 15 seconds.

- **Sheets reads**: the function caches its Sheets API response in memory
  for 10 seconds per warm container (`CACHE_MS` in `results.js`), so
  concurrent requests within that window share one Sheets call instead of
  hitting the API each time. This stays far under Google's default quota
  (60 read requests/min per user) even with many simultaneous viewers.
- **Netlify credits**: Netlify's current free tier is a shared 300-credit/
  month budget (not the old per-resource invocation limits), and production
  deploys (15 credits each) count against the same pool as live traffic, so
  don't assume headroom without checking Site settings → Usage & billing.
  `results.js` sets `Netlify-CDN-Cache-Control: public, max-age=5, durable`
  on successful responses so Netlify's edge can serve one cached response to
  many concurrently-polling tabs instead of invoking the function per poll;
  `Cache-Control: no-store` still forces each browser to make a real
  network request rather than reusing its own local cache.

### In-progress court scores

The Matches sheet is edited by the TD/ATD only, and — by design — a row's
score/winner only gets filled in once a match is fully over. That means the
sheet alone can never represent "in progress": there's no way to show a live
score without either waiting until a match ends, or having court hosts edit
the shared Matches tab themselves (which the TD and ATD have decided against,
for both data-integrity and concurrent-editing reasons).

Instead, in-progress scores are tracked in **Netlify Blobs** — a separate,
low-stakes store, keyed by match ID (e.g. `M32-07`), written by court hosts
via `score.html` and the `live-score` function:

- **`score.html`** — a single URL for every court host, nothing to
  distribute per-court. A host logs in once with their name and a PIN (see
  "Court host login" below), then sees the same match feed as everything
  else (`/.netlify/functions/results`), lists every unfinished match, and
  taps into one to start scoring. An "All / Court 1 / Court 2 / …" toggle on
  the page narrows the list — it's a convenience filter against the sheet's
  `Court` column, remembered per-device via `localStorage`, not an access
  restriction (a logged-in host can score any match, any court).
- **`netlify/functions/live-score.js`** — the write endpoint `score.html`
  POSTs to. Requires a valid auth token (see below), validates the match ID,
  score values, and frame number, then stores
  `{ matchId, court, yellowScore, blackScore, status, scorer, frame, updatedAt }`
  in the `live-scores` Blobs store, one entry per match ID. `scorer` always
  comes from the verified token, never from the request body. It never
  touches the Google Sheets credentials — this endpoint can only ever affect
  the supplementary live feed, never the Matches tab itself. `frame` is
  host-advanced (an "End Frame" +/- control on `score.html`), not derived
  from the score — there's no reliable way to infer a frame boundary from
  point taps alone. Matches play 16 regulation frames; a tie after 16 goes
  to extra frames in pairs with no fixed cap, so the scoreboard shows
  "Frame N of 16" or "Frame N · Overtime" past that. Teams play frames 1-8 on
  the color the sheet lists them under, then swap physical puck color for
  frame 9 onward (staying swapped through overtime); the scoreboard's
  `MatchCard` flips which puck color renders next to each team once the
  frame passes 8 — the sheet's yellow/black columns still identify the same
  two teams the whole match, only the drawn dot color changes.
- **`results.js`** merges this in: a match's `liveScore` field is attached
  only when that match's Matches-tab row has no `winner` yet. The instant
  the TD/ATD transcribes a final result into the sheet, `liveScore` stops
  being surfaced for that match — **the Matches tab always wins**. There's
  no expiry job for old Blobs entries; once a match is finalized its live
  entry is simply inert (small volume, no cost to leaving it).

### Court host login

Only known court hosts can record scores, and every score update is tied to
a real, server-verified name (not free-text):

- **`netlify/functions/score-auth.js`** — `score.html`'s login screen POSTs
  `{ name, pin }` here. It's checked against a **"Hosts" tab** on the same
  tournament Google Sheet (columns `Name | Court | PIN`), which the TD
  manages by hand the same way they already manage the Matches tab — adding,
  removing, or re-PINing a host needs no redeploy. `Court` is informational
  only (it prefills the host's court filter after login), not an access
  restriction. On a match, the function signs a token embedding the host's
  name and an expiry (`SCORE_AUTH_TTL_HOURS`, default 18h — long enough to
  cover a full tournament day) and returns it to `score.html`, which stores
  it in `localStorage` and attaches it as `Authorization: Bearer <token>` on
  every write to `live-score.js`.
- The token is a minimal HMAC-signed value (Node's built-in `crypto`, no JWT
  library) signed with `SCORE_AUTH_SECRET`. `live-score.js` verifies the
  signature and expiry on every write and derives `scorer` from it — a host
  can no longer type an arbitrary display name, so "who is keeping score for
  this game" is now trustworthy.
- **Revocation**: removing a row (or changing its PIN) from the Hosts tab
  blocks new logins immediately, but any token already issued to that host
  stays valid until it expires. For an emergency (e.g. a lost/compromised
  device), change `SCORE_AUTH_SECRET` and redeploy — that invalidates every
  outstanding token at once, and every host simply logs in again.
- **PINs are not rate-limited.** `score-auth.js` has no brute-force
  protection, so pick PINs that aren't trivially guessable (not "1234", not
  the court number) — acceptable given the low blast radius (a guessed PIN
  can only misattribute or post a wrong-looking in-progress score, never
  touch the official bracket), but worth being deliberate about at check-in.

### Concurrency

**Hard-blocked, not just advisory.** Two hosts opening the same match and
both trying to record scores is a real scenario at a live event, so a write
from a different verified host than whoever most recently updated an
in-progress match (within the last 5 minutes) is rejected with `409` instead
of silently overwriting. `score.html` shows a "`<name>` is currently scoring
this — take over?" prompt; confirming retries the same write with an
explicit override flag. The check uses Netlify Blobs' conditional-write
primitives (`getWithMetadata`/`setJSON`'s `onlyIfMatch`) rather than a
read-then-blind-write, so a genuine race between two near-simultaneous
writes is also caught rather than silently letting the second one win.

`score.html` is deliberately **not** linked from the public `index.html?choose`
picker — share the single link directly (text message, printed QR code)
rather than publishing it.

**`admin.html`** is a companion page (also unlinked, direct-URL-only) for
inspecting and purging the `live-scores` store itself — the in-app
replacement for running `netlify blobs:list`/`netlify blobs:delete` by hand
to clean up test entries. It reads/writes via a new
`netlify/functions/live-score-admin.js` endpoint: `GET` lists every entry in
the store directly (so even an entry for an already-decided match, which
`results.js` stops surfacing, still shows up here), and `DELETE` removes
either a single entry (`{ matchId }`) or every entry at once
(`{ all: true }`, used by the page's confirm-guarded "Clear all" button).
Gated by a single **admin PIN** (`ADMIN_PIN` env var) — a static secret known
only to the TD/ATD, not a per-person login like court hosts get, since
there's no need to know *who* purged an entry, only that it was authorized.
Like the court-host login, the raw PIN is only ever sent once: `admin.html`'s
PIN prompt POSTs it to `netlify/functions/admin-auth.js`, which checks it
with a constant-time comparison and — on a match — signs a short-lived token
(same HMAC mechanism as the court-host token, `_shared/hmacToken.js`, keyed
by `ADMIN_PIN` itself rather than a separate secret). Every subsequent
request to `live-score-admin.js` sends that token as `Authorization: Bearer
<token>`, never the PIN again, so a leaked request exposes a time-boxed
credential (`ADMIN_TOKEN_TTL_HOURS`, default 12h) rather than the permanent
shared secret. The token is kept in `sessionStorage` (not `localStorage`) so
it doesn't survive closing the tab either — this tool can wipe every live
score at once, so it's worth not leaving that access sitting around on a
shared device. A missing/invalid/expired token gets a `401` and bounces the
page back to the PIN prompt. Like the court-host PIN, there's no rate
limiting on login guesses — pick something non-trivial.

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
   - `SHEETS_HOSTS_RANGE` (optional) — defaults to `Hosts!A:C`. Add a
     "Hosts" tab to the same spreadsheet with columns `Name | Court | PIN`
     (see "Court host login" above).
   - `SCORE_AUTH_SECRET` — any long random string, used to sign court-host
     login tokens. Required for `score.html` logins to work at all; treat it
     like a password (don't commit it).
   - `SCORE_AUTH_TTL_HOURS` (optional) — defaults to `18`. How long a
     court-host login stays valid before they need to log in again.
   - `ADMIN_PIN` — any PIN/passphrase known only to the TD/ATD, required for
     `admin.html` to work at all. Unlike the court-host PINs, this isn't
     stored in the spreadsheet — set it directly as a Netlify env var. It
     also doubles as the signing secret for admin login tokens, so treat it
     like a password (don't commit it).
   - `ADMIN_TOKEN_TTL_HOURS` (optional) — defaults to `12`. How long an
     admin login stays valid before the TD/ATD needs to re-enter the PIN.
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
- `app.jsx` / `app-mobile.jsx` / `app-print.jsx` / `app-scoreboard.jsx` —
  top-level page components.
- `score.jsx` — court host scorekeeping UI (paired with `score.html`),
  including the login screen and takeover-conflict prompt.
- `admin.jsx` — live-score store viewer/purge UI (paired with `admin.html`),
  gated by the shared admin PIN.
- `tweaks-panel.jsx` — shared floating settings-panel UI framework.
- `netlify/functions/results.js` — reads the Matches sheet, merges in
  live scores from Blobs, returns normalized JSON.
- `netlify/functions/live-score.js` — write endpoint for in-progress court
  scores (Netlify Blobs), used by `score.html`. Requires a court-host auth
  token and hard-blocks conflicting writes (see "Concurrency" above).
- `netlify/functions/live-score-admin.js` — list/delete endpoint for the
  `live-scores` Blobs store, used by `admin.html`. Requires an admin token.
- `netlify/functions/score-auth.js` — verifies a court host's name/PIN
  against the Hosts sheet tab and issues their login token.
- `netlify/functions/admin-auth.js` — verifies the shared admin PIN and
  issues the TD/ATD's admin login token.
- `netlify/functions/_shared/matchId.js` — shared match ID format/regex used
  across functions.
- `netlify/functions/_shared/sheetsClient.js` — shared read-only Google
  Sheets client (JWT auth + value fetch), used by `results.js` and
  `score-auth.js`.
- `netlify/functions/_shared/hmacToken.js` — generic HMAC-signed token
  primitive (sign/verify against a caller-supplied secret and claims), used
  by both `authToken.js` and `adminAuth.js`.
- `netlify/functions/_shared/authToken.js` — court-host login token, keyed
  by `SCORE_AUTH_SECRET`.
- `netlify/functions/_shared/adminAuth.js` — admin PIN check + admin login
  token, keyed by `ADMIN_PIN` itself.
- `netlify/functions/_shared/bearerToken.js` — extracts an `Authorization:
  Bearer <token>` value, shared by `live-score.js` and
  `live-score-admin.js`.
- `assets/` — tournament and venue logos.
