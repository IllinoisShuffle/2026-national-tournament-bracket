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
// Netlify Blobs, keyed by match ID. The TD/ATD still manually transcribes
// the final score/winner into the Matches tab — this page's "Match
// complete" button just freezes the display and asks the host to tell them.

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
// worth 10, 8, 7, with "10 off" (a puck hanging past the line) costing the
// shooting team 10. Order here is [8, 7, 10, -10] because it maps directly
// onto a 2-column CSS grid as top row [8, 7], bottom row [10, -10].
const MAX_UNDO = 5;
const SCORE_INCREMENTS = [
  { delta: 8, label: '+8' },
  { delta: 7, label: '+7' },
  { delta: 10, label: '+10' },
  { delta: -10, label: '−10' },
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

  if (!auth) {
    return <Login onSuccess={handleLogin} />;
  }

  const matches = (liveData && liveData.matches) || {};
  const unfinished = Object.values(matches).filter((m) => !m.winner);

  const visibleMatches = (courtFilter ? unfinished.filter((m) => normalizeCourt(m.court) === courtFilter) : unfinished)
    .sort((a, b) => {
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
        <p className="s-empty">No unfinished matches{courtFilter ? ` at Court ${courtFilter}` : ''} right now.</p>
      )}
      <div className="s-list">
        {visibleMatches.map((m) => {
          const beingScored = isRecentlyActive(m.liveScore) && m.liveScore.scorer && m.liveScore.scorer !== auth.name;
          return (
            <button key={m.id} className="s-match-card" onClick={() => setSelectedId(m.id)}>
              <div className="s-match-id">
                {m.id}
                {m.court ? ` · Court ${normalizeCourt(m.court) || m.court}` : ''}
                {m.time ? ` · ${m.time}` : ''}
              </div>
              <div className="s-match-teams">{m.yellow || 'TBD'}</div>
              <div className="s-match-vs">vs</div>
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
      </div>
    </div>
  );
}

function AuthBar({ name, onLogout }) {
  return (
    <div className="s-auth-bar">
      <span>Scoring as <strong>{name}</strong></span>
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
      {courts.map((c) => (
        <button key={c} className={`s-court-chip${value === c ? ' s-court-chip-active' : ''}`} onClick={() => onChange(c)}>
          Court {c}
        </button>
      ))}
    </div>
  );
}

function ScoreKeeper({ match, auth, onBack, onAuthExpired }) {
  const initial = match.liveScore || { yellowScore: 0, blackScore: 0, status: 'in_progress' };
  const [yellowScore, setYellowScore] = React.useState(initial.yellowScore);
  const [blackScore, setBlackScore] = React.useState(initial.blackScore);
  const [status, setStatus] = React.useState(initial.status);
  const [saveState, setSaveState] = React.useState('idle'); // idle | saving | saved | error | conflict
  const [conflict, setConflict] = React.useState(null);
  // Snapshots of {side, delta, prevYellow, prevBlack, nextYellow, nextBlack}
  // for the last few taps, most-recent last — lets "Undo" restore the exact
  // prior stored value without having to reverse-engineer it from the delta.
  const [undoStack, setUndoStack] = React.useState([]);

  // match.liveScore refreshes on every poll (see ScoreApp), so this stays
  // live — if someone else posts an update while this device has the match
  // open, the banner below appears without needing a reload. This is purely
  // informational (browse-time) — the actual write-time conflict check
  // happens server-side in live-score.js and surfaces as `conflict` state.
  const otherActive = isRecentlyActive(match.liveScore) && match.liveScore.scorer && match.liveScore.scorer !== auth.name;

  const locked = saveState === 'saving' || saveState === 'conflict';

  async function post(nextYellow, nextBlack, nextStatus, { force } = {}) {
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
          pendingYellow: nextYellow,
          pendingBlack: nextBlack,
          pendingStatus: nextStatus,
        });
        setSaveState('conflict');
        return;
      }

      setSaveState(res.ok ? 'saved' : 'error');
    } catch (e) {
      setSaveState('error');
    }
  }

  function adjust(side, delta) {
    if (locked || status === 'complete') return;
    const prevYellow = yellowScore;
    const prevBlack = blackScore;
    let nextYellow = yellowScore;
    let nextBlack = blackScore;
    // No floor at 0 — a "10 off" penalty can legitimately push a side
    // negative before it's put any points on the board.
    if (side === 'yellow') {
      nextYellow = yellowScore + delta;
      setYellowScore(nextYellow);
    } else {
      nextBlack = blackScore + delta;
      setBlackScore(nextBlack);
    }
    setUndoStack([...undoStack, { side, delta, prevYellow, prevBlack, nextYellow, nextBlack }].slice(-MAX_UNDO));
    post(nextYellow, nextBlack, status);
  }

  function undoLast() {
    if (locked || undoStack.length === 0 || status === 'complete') return;
    const last = undoStack[undoStack.length - 1];
    setYellowScore(last.prevYellow);
    setBlackScore(last.prevBlack);
    setUndoStack(undoStack.slice(0, -1));
    post(last.prevYellow, last.prevBlack, status);
  }

  function markComplete() {
    if (locked) return;
    setStatus('complete');
    setUndoStack([]);
    post(yellowScore, blackScore, 'complete');
  }

  function reopen() {
    if (locked) return;
    setStatus('in_progress');
    post(yellowScore, blackScore, 'in_progress');
  }

  function takeOver() {
    if (!conflict) return;
    const { pendingYellow, pendingBlack, pendingStatus } = conflict;
    setConflict(null);
    post(pendingYellow, pendingBlack, pendingStatus, { force: true });
  }

  function cancelConflict() {
    if (conflict) {
      if (conflict.serverYellow !== null) setYellowScore(conflict.serverYellow);
      if (conflict.serverBlack !== null) setBlackScore(conflict.serverBlack);
    }
    setConflict(null);
    setSaveState('idle');
  }

  return (
    <div className="s-wrap">
      <button className="s-back" onClick={onBack}>&larr; Back to matches</button>
      <header className="s-header">
        <div className="s-court-label">
          {match.court ? `Court ${normalizeCourt(match.court) || match.court} · ` : ''}
          {match.id}
        </div>
      </header>

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
          <p className="s-done-note">Tell the TD/ATD so they can enter the final score into the Matches sheet.</p>
          <button className="s-reopen" onClick={reopen} disabled={locked}>Reopen (mis-tap)</button>
        </div>
      ) : (
        <div className="s-score">
          <ScoreSide label={match.yellow || 'Yellow'} score={yellowScore} onAdjust={(d) => adjust('yellow', d)} disabled={locked} />
          <div className="s-dash">&ndash;</div>
          <ScoreSide label={match.black || 'Black'} score={blackScore} onAdjust={(d) => adjust('black', d)} disabled={locked} />
        </div>
      )}

      {status !== 'complete' && undoStack.length > 0 && (() => {
        const last = undoStack[undoStack.length - 1];
        const sideLabel = last.side === 'yellow' ? (match.yellow || 'Yellow') : (match.black || 'Black');
        const deltaLabel = last.delta > 0 ? `+${last.delta}` : last.delta;
        return (
          <div className="s-undo-bar">
            <button className="s-undo" onClick={undoLast}>Undo {deltaLabel} to {sideLabel}</button>
          </div>
        );
      })()}

      {status !== 'complete' && (
        <button className="s-complete" onClick={markComplete} disabled={locked}>Match complete</button>
      )}

      <div className={`s-status s-status-${saveState}`}>
        {saveState === 'saving' && 'Saving…'}
        {saveState === 'saved' && 'Saved'}
        {saveState === 'error' && 'Couldn’t save — check connection and try again'}
      </div>
    </div>
  );
}

function ScoreSide({ label, score, onAdjust, disabled }) {
  return (
    <div className="s-side">
      <div className="s-side-label">{label}</div>
      <div className="s-score-value">{score}</div>
      <div className="s-stepper-grid">
        {SCORE_INCREMENTS.map((inc) => (
          <button
            key={inc.delta}
            className={inc.delta < 0 ? 's-stepper s-stepper-minus' : 's-stepper'}
            onClick={() => onAdjust(inc.delta)}
            disabled={disabled}
            aria-label={inc.delta < 0 ? `Subtract 10 from ${label} (10 off)` : `Add ${inc.delta} to ${label}`}
          >
            {inc.label}
          </button>
        ))}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<ScoreApp />);
