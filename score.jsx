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
const SCORE_POLL_MS = 10000; // shorter than the bracket pages' 15s — a host
// needs to notice a new match land on their court promptly.
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

// courtFilter holds either a specific court number, one of these two
// building-half shortcuts, 'my' (games the logged-in host is the scorer of
// record on), or '' for all. The venue's 10 courts split into two halves of
// 5 — court hosts/managers only need to watch their own half.
const COURTS_1_5 = 'courts-1-5';
const COURTS_6_10 = 'courts-6-10';
const MY_GAMES = 'my';

function courtFilterLabel(courtFilter) {
  if (courtFilter === MY_GAMES) return ' you’re scoring';
  if (courtFilter === COURTS_1_5) return ' on Courts 1–5';
  if (courtFilter === COURTS_6_10) return ' on Courts 6–10';
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
  return !!liveScore && liveScore.status === 'in_progress' && Date.now() - liveScore.updatedAt < ACTIVE_THRESHOLD_MS;
}

function formatAgo(ts) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s`;
  return `${Math.round(s / 60)}m`;
}

// "Playing" makes clear frame N is the one currently underway (score shown
// reflects frames completed before it) rather than a frame that just
// finished — court hosts and viewers were reading "Frame 8 of 16" both ways.
function frameLabel(frame) {
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
  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      const data = await window.LiveData.fetchLiveData();
      if (!cancelled && data) setLiveData(data);
    }
    load();
    const interval = setInterval(load, SCORE_POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const [selectedId, setSelectedId] = React.useState(null);
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

  function handleLogin(nextAuth) {
    storeAuth(nextAuth);
    setAuth(nextAuth);
    const court = normalizeCourt(nextAuth.court);
    if (court && !courtFilter) updateCourtFilter(court);
  }

  function handleLogout() {
    clearAuth();
    setAuth(null);
    setSelectedId(null);
  }

  function handleAuthExpired() {
    clearAuth();
    setAuth(null);
    setSelectedId(null);
  }

  // Merges a just-confirmed write straight into the polled cache so the
  // match list (and this match, if reopened) reflects it immediately —
  // otherwise a host bouncing right back after Submit Frame would see
  // whatever the last poll captured, up to SCORE_POLL_MS stale, and could
  // easily mistake that lag for the write having been lost.
  function handleSaved(matchId, entry) {
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
        onBack={() => setSelectedId(null)}
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
            <button key={m.id} className={`s-match-card${isComplete ? ' s-match-card-complete' : ''}`} onClick={() => setSelectedId(m.id)}>
              <div className="s-match-id">
                {m.id}
                {m.court ? ` · Court ${normalizeCourt(m.court) || m.court}` : ''}
                {m.time ? ` · ${m.time}` : ''}
                {!isComplete && m.liveScore && m.liveScore.frame ? ` · ${frameLabel(m.liveScore.frame)}` : ''}
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
      {courts.map((c) => (
        <button key={c} className={`s-court-chip${value === c ? ' s-court-chip-active' : ''}`} onClick={() => onChange(c)}>
          Court {c}
        </button>
      ))}
    </div>
  );
}

function ScoreKeeper({ match, auth, onBack, onAuthExpired, onSaved }) {
  const initial = match.liveScore || { yellowScore: 0, blackScore: 0, status: 'in_progress' };
  const [yellowScore, setYellowScore] = React.useState(initial.yellowScore);
  const [blackScore, setBlackScore] = React.useState(initial.blackScore);
  const [status, setStatus] = React.useState(initial.status);
  const [frame, setFrame] = React.useState(initial.frame || 1);
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
    post(last.prevYellow, last.prevBlack, status, { frame: last.prevFrame });
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
        <div className="s-frame-label">{frameLabel(frame)}</div>
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

      {status !== 'complete' && (
        <div className="s-actions">
          {(() => {
            const parts = [];
            if (stagedYellow !== 0) parts.push(`${stagedYellow > 0 ? '+' : ''}${stagedYellow} for ${match.yellow || 'Yellow'}`);
            if (stagedBlack !== 0) parts.push(`${stagedBlack > 0 ? '+' : ''}${stagedBlack} for ${match.black || 'Black'}`);
            const ending = willComplete ? 'complete the match' : `start Frame ${frame + 1}`;
            return (
              <div className="s-frame-hint">
                {parts.length > 0
                  ? `Submit records ${parts.join(' and ')}, and will ${ending}.`
                  : `No score this frame? Submit still ${willComplete ? 'completes the match' : `starts Frame ${frame + 1}`}.`}
              </div>
            );
          })()}
          <button className="s-submit-frame" onClick={commitFrame} disabled={locked}>
            {willComplete ? 'Submit Frame & Complete Match' : `Submit Frame ${frame} & Start Frame ${frame + 1}`}
          </button>
          <div className="s-actions-row">
            <button className="s-reset-frame" onClick={resetFrame} disabled={locked || pendingTaps.length === 0}>Reset Frame</button>
            <button className="s-reset-match" onClick={resetMatch} disabled={locked}>Reset Match</button>
          </div>
        </div>
      )}

      {status !== 'complete' && (
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
