// Court host scorekeeping page. One single URL for everyone (score.html) —
// no per-court links to distribute. A host logs in with their name + PIN
// (checked against the tournament's "Hosts" sheet by score-auth.js), then can
// scan the full match list for theirs, or set an on-page "my court" toggle
// (remembered in localStorage on that device) to narrow the list down. Court
// is always a convenience filter against the existing results feed, never an
// access restriction — any verified host can score any match.
//
// This page never writes to the Matches Google Sheet. It POSTs to
// netlify/functions/live-score.js, which stores in-progress scores in
// Netlify Blobs, keyed by match ID. The ATD still manually transcribes the
// final score/winner into the Matches tab from the signed Match Report
// Sheet — this page's "Match complete" button just freezes the display and
// reminds the host to bring that sheet in.

const AUTH_ENDPOINT = '/.netlify/functions/score-auth';
const SCORE_ENDPOINT = '/.netlify/functions/live-score';
// Polled at the results endpoint's edge cache max-age floor (see results.js)
// so a host notices a new match land on their court as fast as possible.
const SCORE_POLL_MS = 5000;
const COURT_FILTER_KEY = 'scoreCourtFilter';
const AUTH_KEY = 'scoreAuth';

// How recent a liveScore update has to be before we treat it as "someone's
// actively on this right now" for the sake of a heads-up — not a lock, just
// a threshold past which we assume the previous scorekeeper has moved on
// (or it's stale test data) and stop nagging about it. Must match
// ACTIVE_THRESHOLD_MS in netlify/functions/live-score.js — that copy
// enforces the same window server-side when deciding whether a write is a
// real conflict; this one only drives the informational banner/tag here.
// Kept as two separate literals (this file is browser code loaded via
// in-page Babel and can't require() the server module) — keep in sync.
const ACTIVE_THRESHOLD_MS = 5 * 60 * 1000;

// Shuffleboard doesn't score in single points — the triangle's zones are
// worth 10, 8, 7, with "10 off" (a disc hanging past the line) costing the
// shooting team 10. Order here maps onto a 2-column CSS grid as row 1
// [8, 7], row 2 [10, -10], row 3 [+1, -1]. The +1/-1 pair isn't a real
// shuffleboard value — it's a convenience nudge for keeping the running
// total in sync with the physical chalkboard, including totals that
// "shouldn't" be reachable from 7/8/10 zone values alone. The chalkboard,
// not this app, is the source of truth.
const MAX_UNDO = 5;
// Matches play 16 regulation frames; a tie after 16 goes to extra frames in
// pairs until someone's ahead. There's no fixed ceiling on those, so the
// frame counter just keeps climbing past 16 rather than wrapping/resetting.
const REGULATION_FRAMES = 16;
// Teams play frames 1-8 on the color the sheet lists them under, then swap
// to the other physical disc color for frame 9 onward — including overtime,
// which stays on the post-swap color rather than flipping back. match.yellow
// / match.black (and their scores) always identify the same two teams
// throughout; only which disc color is shown for them changes. Mirrors
// COLOR_FLIP_FRAME in app-scoreboard.jsx.
const COLOR_FLIP_FRAME = 8;
const SCORE_INCREMENTS = [
  { delta: 8, label: '+8' },
  { delta: 7, label: '+7' },
  { delta: 10, label: '+10' },
  { delta: -10, label: '−10' },
  { delta: 1, label: '+1' },
  { delta: -1, label: '−1' },
];

// The venue has 10 courts. The court toggle always shows all of them,
// regardless of which courts currently have an unfinished match — a host
// whose login pre-fills a court with no active match right now (or whose
// court briefly has nothing on it) still sees their filter as a selected
// pill instead of a silently-applied filter with no visible indication.
const TOTAL_COURTS = 10;
const ALL_COURTS = Array.from({ length: TOTAL_COURTS }, (_, i) => String(i + 1));

// The sheet's Court column format isn't guaranteed to be a bare number (it
// might read "3" or "Court 3"), so compare/display on the digits only rather
// than requiring an exact string match.
function normalizeCourt(v) {
  const m = String(v || '').match(/\d+/);
  return m ? m[0].replace(/^0+(?=\d)/, '') : '';
}

// courtFilter holds either a specific court number, one of the two
// building-half shortcuts below, one of the court-pair shortcuts, 'my'
// (games the logged-in host is the scorer of record on), or '' for all.
// The venue's 10 courts split into two halves of 5 for court managers, each
// overseeing one court themselves (5 or 6) plus two court hosts. Each of
// those hosts scores a pair of adjacent courts at once (1&2, 3&4, 7&8,
// 9&10), hence COURT_PAIRS below.
const COURTS_1_5 = 'courts-1-5';
const COURTS_6_10 = 'courts-6-10';
const MY_GAMES = 'my';
const COURT_PAIRS = [
  { key: 'courts-1-2', courts: ['1', '2'], label: 'Courts 1–2' },
  { key: 'courts-3-4', courts: ['3', '4'], label: 'Courts 3–4' },
  { key: 'courts-5-6', courts: ['5', '6'], label: 'Courts 5–6' },
  { key: 'courts-7-8', courts: ['7', '8'], label: 'Courts 7–8' },
  { key: 'courts-9-10', courts: ['9', '10'], label: 'Courts 9–10' },
];

// Every chip a Hosts-sheet "Default Filter" value can resolve to besides a
// single court — the two halves plus the five pairs above. Kept as one list
// so login prefill (below) can match against halves and pairs the same way.
const COURT_FILTER_PRESETS = [
  { key: COURTS_1_5, courts: ['1', '2', '3', '4', '5'] },
  { key: COURTS_6_10, courts: ['6', '7', '8', '9', '10'] },
  ...COURT_PAIRS,
];

// Parses a Hosts-sheet "Default Filter" cell into the court numbers it
// names, for matching against COURT_FILTER_PRESETS (or a single court) at
// login. Two forms: an inclusive range ("1-5" → courts 1 through 5) or a
// comma/space-separated list ("1, 2" → just those two) — a bare number is
// just the one-element case of the list form. Anything else (blank,
// unparseable) yields no courts, so login falls through to no default filter
// rather than guessing.
function parseDefaultFilterCourts(v) {
  const raw = String(v || '').trim();
  if (!raw) return [];
  const range = raw.match(/^(\d+)\s*-\s*(\d+)$/);
  if (range) {
    const start = Number(range[1]);
    const end = Number(range[2]);
    if (!start || !end || start > end) return [];
    const courts = [];
    for (let n = start; n <= end; n++) courts.push(String(n));
    return courts;
  }
  return (raw.match(/\d+/g) || []).map((n) => n.replace(/^0+(?=\d)/, ''));
}

function courtFilterLabel(courtFilter) {
  if (courtFilter === MY_GAMES) return ' you’re scoring';
  if (courtFilter === COURTS_1_5) return ' on Courts 1–5';
  if (courtFilter === COURTS_6_10) return ' on Courts 6–10';
  const pair = COURT_PAIRS.find((p) => p.key === courtFilter);
  if (pair) return ` on ${pair.label}`;
  if (courtFilter) return ` at Court ${courtFilter}`;
  return '';
}

function readStoredCourtFilter() {
  try {
    return localStorage.getItem(COURT_FILTER_KEY) || '';
  } catch (e) {
    return '';
  }
}

function readStoredAuth() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const auth = JSON.parse(raw);
    if (!auth || !auth.token || !auth.name || !auth.exp) return null;
    if (Date.now() >= auth.exp) return null; // expired — treat as logged out
    return auth;
  } catch (e) {
    return null;
  }
}

function storeAuth(auth) {
  try {
    localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
  } catch (e) {
    // Storage unavailable (private browsing, etc.) — login still works for
    // the current session, it just won't stick on reload.
  }
}

function clearAuth() {
  try {
    localStorage.removeItem(AUTH_KEY);
  } catch (e) {
    // Storage unavailable — nothing to clear.
  }
}

function isRecentlyActive(liveScore) {
  return !!liveScore && liveScore.status !== 'complete' && Date.now() - liveScore.updatedAt < ACTIVE_THRESHOLD_MS;
}

function formatAgo(ts) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s`;
  return `${Math.round(s / 60)}m`;
}

// "Playing" makes clear frame N is the one currently underway (score shown
// reflects frames completed before it) rather than a frame that just
// finished — court hosts and viewers were reading "Frame 8 of 16" both ways.
// `status` overrides the frame-number label for the two interstitial states
// that aren't really "playing" a numbered frame at all.
function frameLabel(frame, status) {
  if (status === 'not_started') return 'Not Started';
  if (status === 'warming_up') return 'Warming Up';
  if (status === 'switching_colors') return 'Switching Colors';
  return frame <= REGULATION_FRAMES ? `Playing Frame ${frame} of ${REGULATION_FRAMES}` : `Playing Frame ${frame} · Overtime`;
}

// Regulation ends at frame REGULATION_FRAMES (16); overtime after that plays
// in pairs, so only the second frame of each pair (18, 20, 22, ...) is a
// checkpoint where an untied score ends the match — the first frame of a
// pair (17, 19, 21, ...) always advances regardless of score, since a tie
// can't be broken mid-pair. REGULATION_FRAMES itself is even, so "checkpoint"
// is just "even and at least REGULATION_FRAMES."
function isDecisionFrame(frame) {
  return frame >= REGULATION_FRAMES && frame % 2 === 0;
}

function ScoreApp() {
  const [auth, setAuth] = React.useState(readStoredAuth);

  const [liveData, setLiveData] = React.useState(null);
  // Locally-confirmed writes (see handleSaved) not yet reflected in polled
  // data, keyed by matchId. A ref, not state — read/written from the poll
  // closure below without needing its own render. See mergePolledData for
  // why a poll can't just be trusted the instant it lands.
  const localOverridesRef = React.useRef({});

  // results.js serves results with a 5s CDN cache (Netlify-CDN-Cache-Control:
  // max-age=5) on top of Blobs' eventually-consistent read, so a poll that
  // fires just after a save succeeds can resolve with a snapshot from
  // *before* that save landed. Blindly replacing liveData with that snapshot
  // would erase the optimistic update handleSaved just applied — the host's
  // own just-submitted score would flash and then vanish, which is exactly
  // what led hosts to re-enter scores they'd already saved. Instead, overlay
  // any local override whose updatedAt is still ahead of what the poll
  // reports; drop it once the poll catches up (or a newer write, e.g. from
  // another host taking over, overtakes it).
  function mergePolledData(data) {
    const overrides = localOverridesRef.current;
    const pendingIds = Object.keys(overrides);
    if (pendingIds.length === 0) return data;

    let matches = data.matches;
    for (const matchId of pendingIds) {
      const override = overrides[matchId];
      const polledMatch = matches[matchId];
      const polledScore = polledMatch && polledMatch.liveScore;
      if (polledScore && polledScore.updatedAt >= override.updatedAt) {
        delete overrides[matchId];
        continue;
      }
      if (!polledMatch) continue;
      if (matches === data.matches) matches = { ...data.matches };
      matches[matchId] = { ...polledMatch, liveScore: override };
    }
    return matches === data.matches ? data : { ...data, matches };
  }

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      const data = await window.LiveData.fetchLiveData();
      if (!cancelled && data) setLiveData(mergePolledData(data));
    }
    load();
    const interval = setInterval(load, SCORE_POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // Tracked in history state (not just React state) so the device/browser
  // back button backs out of a match to the list instead of leaving the
  // page entirely — this is a single-page app with one URL, so without a
  // pushed history entry per match there's nothing for "back" to land on.
  const [selectedId, setSelectedIdState] = React.useState(() => (window.history.state || {}).selectedId || null);

  function selectMatch(id) {
    window.history.pushState({ selectedId: id }, '');
    setSelectedIdState(id);
  }

  function backToMatches() {
    if (window.history.state && window.history.state.selectedId) {
      window.history.back();
    } else {
      setSelectedIdState(null);
    }
  }

  React.useEffect(() => {
    function onPopState(e) {
      setSelectedIdState((e.state || {}).selectedId || null);
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const [courtFilter, setCourtFilter] = React.useState(readStoredCourtFilter);

  function updateCourtFilter(next) {
    setCourtFilter(next);
    try {
      if (next) localStorage.setItem(COURT_FILTER_KEY, next);
      else localStorage.removeItem(COURT_FILTER_KEY);
    } catch (e) {
      // Storage unavailable (private browsing, etc.) — the toggle still
      // works for the current session, it just won't stick on reload.
    }
  }

  // Every login re-applies the Hosts sheet's current Default Filter,
  // overriding whatever chip was left selected by whoever used this device
  // before — a TD reassigning someone's courts mid-tournament just edits the
  // sheet, and it takes effect the next time that host logs in. A chip a
  // host taps mid-session still survives a plain page reload (courtFilter's
  // initial state comes from localStorage and this only runs on a fresh
  // login, not on every mount), it just doesn't survive a log out/back in.
  function handleLogin(nextAuth) {
    storeAuth(nextAuth);
    setAuth(nextAuth);
    const courts = parseDefaultFilterCourts(nextAuth.defaultFilter);
    if (courts.length === 1) {
      updateCourtFilter(courts[0]);
      return;
    }
    if (courts.length > 1) {
      const sorted = [...courts].sort((a, b) => Number(a) - Number(b)).join(',');
      const preset = COURT_FILTER_PRESETS.find((p) => p.courts.join(',') === sorted);
      // A set of courts that doesn't exactly match a known chip falls back
      // to unfiltered ('All') rather than guessing.
      updateCourtFilter(preset ? preset.key : '');
      return;
    }
    updateCourtFilter('');
  }

  function handleLogout() {
    clearAuth();
    setAuth(null);
    setSelectedIdState(null);
    // Clears any pushed match selection out of the current history entry so
    // a different host logging in on the same device can't hit "back" and
    // land in the previous host's game.
    window.history.replaceState(null, '');
  }

  function handleAuthExpired() {
    clearAuth();
    setAuth(null);
    setSelectedIdState(null);
    window.history.replaceState(null, '');
  }

  // Merges a just-confirmed write straight into the polled cache so the
  // match list (and this match, if reopened) reflects it immediately —
  // otherwise a host bouncing right back after Submit Frame would see
  // whatever the last poll captured, up to SCORE_POLL_MS stale, and could
  // easily mistake that lag for the write having been lost. Also records it
  // as a local override (see mergePolledData) so the *next* poll or two,
  // which may still be racing a CDN-cached snapshot from before this write,
  // can't undo it.
  function handleSaved(matchId, entry) {
    localOverridesRef.current[matchId] = entry;
    setLiveData((prev) => {
      if (!prev) return prev;
      const existing = prev.matches[matchId];
      if (!existing) return prev;
      return { ...prev, matches: { ...prev.matches, [matchId]: { ...existing, liveScore: entry } } };
    });
  }

  if (!auth) {
    return <Login onSuccess={handleLogin} />;
  }

  const matches = (liveData && liveData.matches) || {};
  // Early bracket rounds create match slots before either feeder match has a
  // winner, so both teams read "TBD" for a while. Those slots have nothing a
  // host could act on yet, so hide them until at least one side is set
  // rather than cluttering the list with placeholder cards.
  const unfinished = Object.values(matches).filter((m) => !m.winner && (m.yellow || m.black));

  const visibleMatches = unfinished
    .filter((m) => {
      if (courtFilter === MY_GAMES) return !!(m.liveScore && m.liveScore.scorer === auth.name);
      if (courtFilter === COURTS_1_5 || courtFilter === COURTS_6_10) {
        const c = Number(normalizeCourt(m.court));
        if (!c) return false;
        return courtFilter === COURTS_1_5 ? c <= 5 : c >= 6;
      }
      const pair = COURT_PAIRS.find((p) => p.key === courtFilter);
      if (pair) return pair.courts.includes(normalizeCourt(m.court));
      if (courtFilter) return normalizeCourt(m.court) === courtFilter;
      return true;
    })
    .sort((a, b) => {
      const compA = a.liveScore && a.liveScore.status === 'complete' ? 1 : 0;
      const compB = b.liveScore && b.liveScore.status === 'complete' ? 1 : 0;
      if (compA !== compB) return compA - compB;
      const ca = Number(normalizeCourt(a.court)) || 999;
      const cb = Number(normalizeCourt(b.court)) || 999;
      return ca - cb || a.id.localeCompare(b.id);
    });

  const selected = selectedId ? matches[selectedId] : null;

  if (selected) {
    return (
      <ScoreKeeper
        match={selected}
        auth={auth}
        onBack={backToMatches}
        onAuthExpired={handleAuthExpired}
        onSaved={handleSaved}
      />
    );
  }

  return (
    <div className="s-wrap">
      <header className="s-header">
        <h1>Pick your match</h1>
      </header>

      <AuthBar name={auth.name} onLogout={handleLogout} />
      <CourtToggle courts={ALL_COURTS} value={courtFilter} onChange={updateCourtFilter} />

      {!liveData && <p className="s-empty">Loading matches…</p>}
      {liveData && visibleMatches.length === 0 && (
        <p className="s-empty">No unfinished matches{courtFilterLabel(courtFilter)} right now.</p>
      )}
      <div className="s-list">
        {visibleMatches.map((m) => {
          const isComplete = m.liveScore && m.liveScore.status === 'complete';
          const beingScored = !isComplete && isRecentlyActive(m.liveScore) && m.liveScore.scorer && m.liveScore.scorer !== auth.name;
          return (
            <button key={m.id} className={`s-match-card${isComplete ? ' s-match-card-complete' : ''}`} onClick={() => selectMatch(m.id)}>
              <div className="s-match-id">
                {m.id}
                {m.court ? ` · Court ${normalizeCourt(m.court) || m.court}` : ''}
                {m.time ? ` · ${m.time}` : ''}
                {!isComplete && m.liveScore && m.liveScore.frame ? ` · ${frameLabel(m.liveScore.frame, m.liveScore.status)}` : ''}
              </div>
              {isComplete && <div className="s-match-complete-tag">Complete &middot; awaiting TD</div>}
              <div className="s-match-teams">{m.yellow || 'TBD'}</div>
              {m.liveScore ? (
                <div className="s-match-score">{m.liveScore.yellowScore} &ndash; {m.liveScore.blackScore}</div>
              ) : (
                <div className="s-match-vs">vs</div>
              )}
              <div className="s-match-teams">{m.black || 'TBD'}</div>
              {beingScored && (
                <div className="s-being-scored">Being scored by {m.liveScore.scorer} · {formatAgo(m.liveScore.updatedAt)} ago</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Login({ onSuccess }) {
  const [name, setName] = React.useState('');
  const [pin, setPin] = React.useState('');
  const [error, setError] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim() || !pin.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(AUTH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), pin: pin.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Invalid name or PIN');
        setSubmitting(false);
        return;
      }
      onSuccess(data);
    } catch (e2) {
      setError('Couldn’t reach the server — check connection and try again');
      setSubmitting(false);
    }
  }

  return (
    <div className="s-wrap">
      <div className="s-login-wrap">
        <h1 className="s-login-title">Court Scorekeeping</h1>
        <p className="s-login-sub">Log in with the name and PIN your TD gave you.</p>
        <form onSubmit={submit}>
          <div className="s-login-field">
            <label htmlFor="s-login-name">Name</label>
            <input
              id="s-login-name"
              className="s-login-input"
              type="text"
              autoFocus
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="s-login-field">
            <label htmlFor="s-login-pin">PIN</label>
            <input
              id="s-login-pin"
              className="s-login-input"
              type="text"
              inputMode="numeric"
              maxLength={40}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
          </div>
          <button className="s-login-submit" type="submit" disabled={submitting}>
            {submitting ? 'Logging in…' : 'Log in'}
          </button>
          {error && <p className="s-login-error">{error}</p>}
        </form>
        <a className="s-guide-link s-guide-link-block" href="/court-host-guide">Scoring guide &rarr;</a>
      </div>
    </div>
  );
}

function AuthBar({ name, onLogout }) {
  return (
    <div className="s-auth-bar">
      <span>Scoring as <strong>{name}</strong></span>
      <a className="s-guide-link" href="/court-host-guide">Guide</a>
      <button className="s-auth-logout" onClick={onLogout}>Log out</button>
    </div>
  );
}

function CourtToggle({ courts, value, onChange }) {
  return (
    <div className="s-court-toggle" role="group" aria-label="Filter by court">
      <button className={`s-court-chip${value === '' ? ' s-court-chip-active' : ''}`} onClick={() => onChange('')}>
        All
      </button>
      <button className={`s-court-chip${value === MY_GAMES ? ' s-court-chip-active' : ''}`} onClick={() => onChange(MY_GAMES)}>
        My Games
      </button>
      <button className={`s-court-chip${value === COURTS_1_5 ? ' s-court-chip-active' : ''}`} onClick={() => onChange(COURTS_1_5)}>
        Courts 1&ndash;5
      </button>
      <button className={`s-court-chip${value === COURTS_6_10 ? ' s-court-chip-active' : ''}`} onClick={() => onChange(COURTS_6_10)}>
        Courts 6&ndash;10
      </button>
      {COURT_PAIRS.map((p) => (
        <button key={p.key} className={`s-court-chip${value === p.key ? ' s-court-chip-active' : ''}`} onClick={() => onChange(p.key)}>
          {p.label}
        </button>
      ))}
      {courts.map((c) => (
        <button key={c} className={`s-court-chip${value === c ? ' s-court-chip-active' : ''}`} onClick={() => onChange(c)}>
          Court {c}
        </button>
      ))}
    </div>
  );
}

function ScoreKeeper({ match, auth, onBack, onAuthExpired, onSaved }) {
  // 'not_started' is local-only — it means nothing has ever been posted for
  // this match, so there's no liveScore entry yet. It's never sent to the
  // server; tapping "Start Match" is the only way out of it, into a real
  // posted value ('warming_up'). Scoring is gated behind that tap — no
  // shortcut straight into Frame 1 — so a match is never accidentally
  // missing from the Live Scoreboard.
  const initial = match.liveScore || { yellowScore: 0, blackScore: 0, status: 'not_started', frame: 1 };
  const [yellowScore, setYellowScore] = React.useState(initial.yellowScore);
  const [blackScore, setBlackScore] = React.useState(initial.blackScore);
  const [status, setStatus] = React.useState(initial.status);
  const [frame, setFrame] = React.useState(initial.frame || 1);
  // The scoring grid + frame actions only show once a frame is actually
  // underway — 'not_started'/'warming_up'/'switching_colors' each show an
  // interstitial instead (see render below), and 'complete' shows the done
  // screen.
  const scoringActive = status === 'in_progress';
  const [saveState, setSaveState] = React.useState('idle'); // idle | saving | saved | error | conflict
  const [conflict, setConflict] = React.useState(null);
  // Staged, not-yet-saved taps for the frame in progress. A shuffleboard
  // frame can score up to 4 discs per side (8 total) — more than one disc
  // landing for a side, or for both sides, in the same frame is normal —
  // so this is a list of {side, delta} taps rather than a single pick.
  // Applied to the running total only once the host taps "Next Frame".
  // Lives in local state only: if the host navigates away or reloads
  // before committing, it's lost and the match reloads from the last
  // *committed* server state. That's the tradeoff of staging rather than
  // saving on every tap, and is intentional.
  const [pendingTaps, setPendingTaps] = React.useState([]); // [{side, delta}]
  // Snapshots of {prevYellow, prevBlack, prevFrame, nextYellow, nextBlack,
  // nextFrame, stagedYellow, stagedBlack} for the last few committed
  // frames, most-recent last — lets "Undo" restore the exact prior stored
  // score and frame together, since a commit now changes both at once.
  const [undoStack, setUndoStack] = React.useState([]);

  // match.liveScore refreshes on every poll (see ScoreApp), so this stays
  // live — if someone else posts an update while this device has the match
  // open, the banner below appears without needing a reload. This is purely
  // informational (browse-time) — the actual write-time conflict check
  // happens server-side in live-score.js and surfaces as `conflict` state.
  const otherActive = isRecentlyActive(match.liveScore) && match.liveScore.scorer && match.liveScore.scorer !== auth.name;

  const locked = saveState === 'saving' || saveState === 'conflict';
  const colorsFlipped = frame > COLOR_FLIP_FRAME;
  const yellowTaps = pendingTaps.filter((t) => t.side === 'yellow');
  const blackTaps = pendingTaps.filter((t) => t.side === 'black');
  const stagedYellow = yellowTaps.reduce((sum, t) => sum + t.delta, 0);
  const stagedBlack = blackTaps.reduce((sum, t) => sum + t.delta, 0);
  // Preview of what committing right now would do — drives the Submit
  // Frame button's label/behavior so it reads "Complete Match" instead of
  // "Start Frame N+1" exactly when committing would actually end the match.
  const willComplete = isDecisionFrame(frame) && (yellowScore + stagedYellow) !== (blackScore + stagedBlack);

  async function post(nextYellow, nextBlack, nextStatus, { force, frame: nextFrame = frame } = {}) {
    setSaveState('saving');
    try {
      const res = await fetch(SCORE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({
          matchId: match.id,
          court: match.court || '',
          yellowScore: nextYellow,
          blackScore: nextBlack,
          status: nextStatus,
          frame: nextFrame,
          force: !!force,
        }),
      });

      if (res.status === 401) {
        onAuthExpired();
        return;
      }

      if (res.status === 409) {
        const data = await res.json().catch(() => ({}));
        setConflict({
          scorer: data.scorer || null,
          serverYellow: typeof data.yellowScore === 'number' ? data.yellowScore : null,
          serverBlack: typeof data.blackScore === 'number' ? data.blackScore : null,
          serverFrame: typeof data.frame === 'number' ? data.frame : null,
          pendingYellow: nextYellow,
          pendingBlack: nextBlack,
          pendingStatus: nextStatus,
          pendingFrame: nextFrame,
        });
        setSaveState('conflict');
        return;
      }

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        onSaved(match.id, {
          matchId: match.id,
          court: match.court || '',
          yellowScore: nextYellow,
          blackScore: nextBlack,
          status: nextStatus,
          scorer: auth.name,
          frame: nextFrame,
          updatedAt: data.updatedAt || Date.now(),
        });
      }
      setSaveState(res.ok ? 'saved' : 'error');
    } catch (e) {
      setSaveState('error');
    }
  }

  // Stages a tap for the frame in progress — no save until "Next Frame"
  // commits it. Taps stack freely, on either or both sides, with no cap —
  // a host catching up after missing a frame or two needs to lump several
  // frames' worth of points into one submit without fighting a per-frame
  // disc limit.
  function stageTap(side, delta) {
    if (locked || status === 'complete') return;
    setPendingTaps([...pendingTaps, { side, delta }]);
  }

  // Commits whatever's staged (or nothing, for a scoreless "wash" frame)
  // into the running total. On a decision frame (16, 18, 20, ...) an untied
  // result ends the match right here instead of advancing — mirrors
  // markComplete's "clear the undo stack, this is terminal" behavior since
  // Reopen, not Undo, is the correction path once complete either way.
  function commitFrame() {
    if (locked || status === 'complete') return;
    // No floor at 0 — a "10 off" penalty can legitimately push a side
    // negative before it's put any points on the board.
    const nextYellow = yellowScore + stagedYellow;
    const nextBlack = blackScore + stagedBlack;
    setYellowScore(nextYellow);
    setBlackScore(nextBlack);
    setPendingTaps([]);

    if (isDecisionFrame(frame) && nextYellow !== nextBlack) {
      setStatus('complete');
      setUndoStack([]);
      post(nextYellow, nextBlack, 'complete', { frame });
      return;
    }

    const nextFrame = frame + 1;
    setUndoStack([...undoStack, {
      prevYellow: yellowScore, prevBlack: blackScore, prevFrame: frame,
      nextYellow, nextBlack, nextFrame,
      stagedYellow, stagedBlack,
    }].slice(-MAX_UNDO));
    setFrame(nextFrame);

    // Frame 8 is the last frame before the color swap — route through the
    // "Switching Colors" interstitial (practice shots) instead of straight
    // into Frame 9, mirroring the "Warming Up" gap before Frame 1.
    if (frame === COLOR_FLIP_FRAME) {
      setStatus('switching_colors');
      post(nextYellow, nextBlack, 'switching_colors', { frame: nextFrame });
      return;
    }

    post(nextYellow, nextBlack, status, { frame: nextFrame });
  }

  // Undo always reverts the most recent action. If there's a staged
  // (not-yet-committed) tap for the frame in progress, pop just that one —
  // purely local, nothing was ever sent. Otherwise revert the last
  // *committed* frame's score and frame number together in one save.
  function undoLast() {
    if (locked || status === 'complete') return;
    if (pendingTaps.length > 0) {
      setPendingTaps(pendingTaps.slice(0, -1));
      return;
    }
    if (undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    setYellowScore(last.prevYellow);
    setBlackScore(last.prevBlack);
    setFrame(last.prevFrame);
    setUndoStack(undoStack.slice(0, -1));
    // Undoing a commit always lands back on "actively playing the previous
    // frame" — the only way onto the undo stack is a commitFrame, and that
    // only ever advances out of 'in_progress' (into 'switching_colors' or
    // 'complete'), never out of 'not_started' or 'warming_up' directly.
    setStatus('in_progress');
    post(last.prevYellow, last.prevBlack, 'in_progress', { frame: last.prevFrame });
  }

  function markComplete() {
    if (locked) return;
    const nextYellow = yellowScore + stagedYellow;
    const nextBlack = blackScore + stagedBlack;
    setYellowScore(nextYellow);
    setBlackScore(nextBlack);
    setPendingTaps([]);
    setStatus('complete');
    setUndoStack([]);
    post(nextYellow, nextBlack, 'complete', { frame });
  }

  function reopen() {
    if (locked) return;
    setStatus('in_progress');
    post(yellowScore, blackScore, 'in_progress');
  }

  // Puts the match on the Live Scoreboard as "Warming Up" ahead of Frame 1.
  // This is the only way out of 'not_started' — the scoring grid doesn't
  // show until it's tapped, so a match can't quietly go unscored on the
  // board. A host catching up after play's already begun just taps this,
  // then "Start Frame 1" (see beginFrame), before scoring as normal — two
  // taps, not a blocker.
  function startMatch() {
    if (locked) return;
    setStatus('warming_up');
    post(0, 0, 'warming_up', { frame: 1 });
  }

  // Advances out of an interstitial ('warming_up' -> Frame 1, or
  // 'switching_colors' -> Frame 9) into active scoring. `frame` is already
  // set to the right value by the time either interstitial is showing.
  function beginFrame() {
    if (locked) return;
    setStatus('in_progress');
    post(yellowScore, blackScore, 'in_progress', { frame });
  }

  function takeOver() {
    if (!conflict) return;
    const { pendingYellow, pendingBlack, pendingStatus, pendingFrame } = conflict;
    setConflict(null);
    post(pendingYellow, pendingBlack, pendingStatus, { force: true, frame: pendingFrame });
  }

  function cancelConflict() {
    if (conflict) {
      if (conflict.serverYellow !== null) setYellowScore(conflict.serverYellow);
      if (conflict.serverBlack !== null) setBlackScore(conflict.serverBlack);
      if (conflict.serverFrame !== null) setFrame(conflict.serverFrame);
    }
    setConflict(null);
    setSaveState('idle');
  }

  // Clears every staged (not-yet-committed) tap for the frame in progress
  // in one shot — a faster mis-tap fix than repeatedly tapping Undo.
  function resetFrame() {
    if (locked || status === 'complete' || pendingTaps.length === 0) return;
    setPendingTaps([]);
  }

  // Wipes the whole match back to 0-0, Frame 1 — for when the scoring
  // itself went wrong (wrong match, wrong teams to a side, etc.), not just
  // the frame in progress. Unlike Undo/Reset Frame this can erase already-
  // committed frames, so it's confirmed the same way admin.jsx's "delete
  // every live-score entry" is (window.confirm, no custom modal).
  function resetMatch() {
    if (locked) return;
    const ok = window.confirm(`Reset ${match.yellow || 'Yellow'} vs ${match.black || 'Black'} back to 0–0, Frame 1? This can't be undone.`);
    if (!ok) return;
    setPendingTaps([]);
    setUndoStack([]);
    setYellowScore(0);
    setBlackScore(0);
    setFrame(1);
    setStatus('in_progress');
    post(0, 0, 'in_progress', { frame: 1 });
  }

  return (
    <div className="s-wrap">
      <button className="s-back" onClick={onBack} disabled={locked}>
        &larr; {saveState === 'saving' ? 'Saving…' : 'Back to matches'}
      </button>
      <header className="s-header">
        <div className="s-court-label">
          {match.court ? `Court ${normalizeCourt(match.court) || match.court} · ` : ''}
          {match.id}
        </div>
      </header>

      <div className="s-frame-bar">
        <div className="s-frame-label">{frameLabel(frame, status)}</div>
      </div>

      {otherActive && saveState !== 'conflict' && (
        <div className="s-other-scorer-banner">
          Heads up — {match.liveScore.scorer} updated this match {formatAgo(match.liveScore.updatedAt)} ago. Make sure you're not both scoring it.
        </div>
      )}

      {saveState === 'conflict' && conflict && (
        <div className="s-conflict-banner">
          <p className="s-conflict-text">
            {conflict.scorer
              ? `${conflict.scorer} is currently scoring this match. Take over?`
              : 'Someone else just updated this match. Take over with your latest score?'}
          </p>
          <div className="s-conflict-actions">
            <button className="s-conflict-btn s-conflict-btn-primary" onClick={takeOver}>Take over</button>
            <button className="s-conflict-btn" onClick={cancelConflict}>Cancel</button>
          </div>
        </div>
      )}

      {status === 'complete' ? (
        <div className="s-done">
          <p className="s-done-title">Marked complete</p>
          <p className="s-done-score">{match.yellow || 'Yellow'} {yellowScore} &ndash; {blackScore} {match.black || 'Black'}</p>
          <p className="s-done-note">Fill out the Match Report Sheet, get it signed by the winning team, and bring it to the ATD in the DJ Booth.</p>
          <button className="s-reopen" onClick={reopen} disabled={locked}>Reopen (mis-tap)</button>
        </div>
      ) : status === 'not_started' ? (
        <div className="s-done">
          <p className="s-done-title">Not Started</p>
          <p className="s-done-note">Tap Start Match to add {match.yellow || 'Yellow'} vs {match.black || 'Black'} to the Live Scoreboard before Frame 1 begins.</p>
          <button className="s-submit-frame" onClick={startMatch} disabled={locked}>Start Match</button>
        </div>
      ) : status === 'warming_up' || status === 'switching_colors' ? (
        <div className="s-done">
          <p className="s-done-title">{status === 'warming_up' ? 'Warming Up' : 'Switching Colors'}</p>
          <p className="s-done-note">
            {status === 'warming_up'
              ? `${match.yellow || 'Yellow'} vs ${match.black || 'Black'} is now on the Live Scoreboard. Tap Start Frame 1 once play begins.`
              : 'Practice shots while teams swap disc colors. Tap Start Frame 9 once play resumes.'}
          </p>
          <button className="s-submit-frame" onClick={beginFrame} disabled={locked}>Start Frame {frame}</button>
        </div>
      ) : (
        <div className="s-score">
          <ScoreSide disc={colorsFlipped ? 'black' : 'yellow'} label={match.yellow || 'Yellow'} score={yellowScore} stagedTotal={stagedYellow} taps={yellowTaps} onTap={(d) => stageTap('yellow', d)} disabled={locked} />
          <div className="s-dash">&ndash;</div>
          <ScoreSide disc={colorsFlipped ? 'yellow' : 'black'} label={match.black || 'Black'} score={blackScore} stagedTotal={stagedBlack} taps={blackTaps} onTap={(d) => stageTap('black', d)} disabled={locked} />
        </div>
      )}

      {status !== 'complete' && (pendingTaps.length > 0 || undoStack.length > 0) && (() => {
        if (pendingTaps.length > 0) {
          const last = pendingTaps[pendingTaps.length - 1];
          const sideLabel = last.side === 'yellow' ? (match.yellow || 'Yellow') : (match.black || 'Black');
          const deltaLabel = last.delta > 0 ? `+${last.delta}` : last.delta;
          return (
            <div className="s-undo-bar">
              <button className="s-undo" onClick={undoLast}>Undo last pick: {deltaLabel} to {sideLabel}</button>
            </div>
          );
        }
        const last = undoStack[undoStack.length - 1];
        if (last.stagedYellow === 0 && last.stagedBlack === 0) {
          return (
            <div className="s-undo-bar">
              <button className="s-undo" onClick={undoLast}>Undo Frame {last.prevFrame} (no score)</button>
            </div>
          );
        }
        const parts = [];
        if (last.stagedYellow !== 0) parts.push(`${last.stagedYellow > 0 ? '+' : ''}${last.stagedYellow} to ${match.yellow || 'Yellow'}`);
        if (last.stagedBlack !== 0) parts.push(`${last.stagedBlack > 0 ? '+' : ''}${last.stagedBlack} to ${match.black || 'Black'}`);
        return (
          <div className="s-undo-bar">
            <button className="s-undo" onClick={undoLast}>Undo Frame {last.prevFrame}: {parts.join(', ')}</button>
          </div>
        );
      })()}

      {scoringActive && (
        <div className="s-actions">
          {(() => {
            const parts = [];
            if (stagedYellow !== 0) parts.push(`${stagedYellow > 0 ? '+' : ''}${stagedYellow} for ${match.yellow || 'Yellow'}`);
            if (stagedBlack !== 0) parts.push(`${stagedBlack > 0 ? '+' : ''}${stagedBlack} for ${match.black || 'Black'}`);
            const enteringColorSwitch = frame === COLOR_FLIP_FRAME;
            const endingWill = willComplete
              ? 'complete the match'
              : enteringColorSwitch
              ? 'move to Switching Colors before Frame 9'
              : `start Frame ${frame + 1}`;
            const endingStill = willComplete
              ? 'completes the match'
              : enteringColorSwitch
              ? 'moves to Switching Colors before Frame 9'
              : `starts Frame ${frame + 1}`;
            return (
              <div className="s-frame-hint">
                {parts.length > 0
                  ? `Submit records ${parts.join(' and ')}, and will ${endingWill}.`
                  : `No score this frame? Submit still ${endingStill}.`}
              </div>
            );
          })()}
          <button className="s-submit-frame" onClick={commitFrame} disabled={locked}>
            {willComplete
              ? 'Submit Frame & Complete Match'
              : frame === COLOR_FLIP_FRAME
              ? `Submit Frame ${frame} & Switch Colors`
              : `Submit Frame ${frame} & Start Frame ${frame + 1}`}
          </button>
          <div className="s-actions-row">
            <button className="s-reset-frame" onClick={resetFrame} disabled={locked || pendingTaps.length === 0}>Reset Frame</button>
            <button className="s-reset-match" onClick={resetMatch} disabled={locked}>Reset Match</button>
          </div>
        </div>
      )}

      {scoringActive && (
        <button className="s-complete" onClick={markComplete} disabled={locked}>Complete Match</button>
      )}

      <div className={`s-status s-status-${saveState}`}>
        {saveState === 'saving' && 'Saving…'}
        {saveState === 'saved' && 'Saved'}
        {saveState === 'error' && 'Couldn’t save — check connection and try again'}
      </div>
    </div>
  );
}

function ScoreSide({ label, score, stagedTotal, taps, onTap, disabled, disc }) {
  return (
    <div className="s-side">
      <span className={`s-disc s-disc-${disc}`} aria-hidden="true" />
      <div className="s-side-label">{label}</div>
      <div className="s-score-value">{score}</div>
      {/* Always mounted, just hidden when empty — reserves its height so
          the stepper grid below never shifts under a host's finger. */}
      <div className={`s-pending${taps.length > 0 ? '' : ' s-pending-hidden'}`}>
        {stagedTotal > 0 ? `+${stagedTotal}` : stagedTotal} pending
      </div>
      <div className="s-stepper-grid">
        {SCORE_INCREMENTS.map((inc) => {
          const count = taps.filter((t) => t.delta === inc.delta).length;
          return (
            <button
              key={inc.delta}
              className={[
                's-stepper',
                inc.delta < 0 ? 's-stepper-minus' : '',
                count > 0 ? 's-stepper-selected' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => onTap(inc.delta)}
              disabled={disabled}
              aria-pressed={count > 0}
              aria-label={
                inc.delta === -10
                  ? `Add 10 off for ${label} (this frame)`
                  : inc.delta < 0
                  ? `Add ${inc.delta} for ${label} (this frame)`
                  : `Add +${inc.delta} for ${label} (this frame)`
              }
            >
              {inc.label}
              {count > 1 && <span className="s-stepper-count"> ×{count}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<ScoreApp />);
