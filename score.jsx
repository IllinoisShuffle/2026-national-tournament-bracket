// Court host scorekeeping page. One single URL for everyone (score.html) —
// no per-court links to distribute, no login. A host can just scan the full
// match list for theirs, or set an on-page "my court" toggle (remembered in
// localStorage on that device) to narrow the list down. Court is always a
// convenience filter against the existing results feed, never an identity
// or auth mechanism.
//
// This page never writes to the Matches Google Sheet. It POSTs to
// netlify/functions/live-score.js, which stores in-progress scores in
// Netlify Blobs, keyed by match ID. The TD/ATD still manually transcribes
// the final score/winner into the Matches tab — this page's "Match
// complete" button just freezes the display and asks the host to tell them.

const SCORE_ENDPOINT = '/.netlify/functions/live-score';
const SCORE_POLL_MS = 10000; // shorter than the bracket pages' 15s — a host
// needs to notice a new match land on their court promptly.
const COURT_FILTER_KEY = 'scoreCourtFilter';
const SCORER_NAME_KEY = 'scoreKeeperName';

// How recent a liveScore update has to be before we treat it as "someone's
// actively on this right now" for the sake of a heads-up — not a lock, just
// a threshold past which we assume the previous scorekeeper has moved on
// (or it's stale test data) and stop nagging about it.
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

function readStoredScorerName() {
  try {
    return localStorage.getItem(SCORER_NAME_KEY) || '';
  } catch (e) {
    return '';
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
  const [scorerName, setScorerName] = React.useState(readStoredScorerName);

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

  function updateScorerName(next) {
    setScorerName(next);
    try {
      if (next) localStorage.setItem(SCORER_NAME_KEY, next);
      else localStorage.removeItem(SCORER_NAME_KEY);
    } catch (e) {
      // Storage unavailable — name still works for the current session.
    }
  }

  const matches = (liveData && liveData.matches) || {};
  const unfinished = Object.values(matches).filter((m) => !m.winner);

  const availableCourts = Array.from(new Set(unfinished.map((m) => normalizeCourt(m.court)).filter(Boolean)))
    .sort((a, b) => Number(a) - Number(b));

  const visibleMatches = (courtFilter ? unfinished.filter((m) => normalizeCourt(m.court) === courtFilter) : unfinished)
    .sort((a, b) => {
      const ca = Number(normalizeCourt(a.court)) || 999;
      const cb = Number(normalizeCourt(b.court)) || 999;
      return ca - cb || a.id.localeCompare(b.id);
    });

  const selected = selectedId ? matches[selectedId] : null;

  if (selected) {
    return <ScoreKeeper match={selected} scorerName={scorerName} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="s-wrap">
      <header className="s-header">
        <h1>Pick your match</h1>
      </header>

      <ScorerNameBar name={scorerName} onChange={updateScorerName} />
      <CourtToggle courts={availableCourts} value={courtFilter} onChange={updateCourtFilter} />

      {!liveData && <p className="s-empty">Loading matches…</p>}
      {liveData && visibleMatches.length === 0 && (
        <p className="s-empty">No unfinished matches{courtFilter ? ` at Court ${courtFilter}` : ''} right now.</p>
      )}
      <div className="s-list">
        {visibleMatches.map((m) => {
          const beingScored = isRecentlyActive(m.liveScore) && m.liveScore.scorer && m.liveScore.scorer !== scorerName;
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

function ScorerNameBar({ name, onChange }) {
  const [editing, setEditing] = React.useState(!name);
  const [draft, setDraft] = React.useState(name);

  function save() {
    const trimmed = draft.trim();
    onChange(trimmed);
    setDraft(trimmed);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="s-name-bar">
        <input
          className="s-name-input"
          type="text"
          placeholder="Your name (so others know it's you)"
          value={draft}
          autoFocus
          maxLength={40}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
        />
        <button className="s-name-save" onClick={save}>Save</button>
      </div>
    );
  }

  return (
    <div className="s-name-bar s-name-bar-set">
      <span>Scoring as <strong>{name}</strong></span>
      <button className="s-name-edit" onClick={() => { setDraft(name); setEditing(true); }}>Change</button>
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

function ScoreKeeper({ match, scorerName, onBack }) {
  const initial = match.liveScore || { yellowScore: 0, blackScore: 0, status: 'in_progress' };
  const [yellowScore, setYellowScore] = React.useState(initial.yellowScore);
  const [blackScore, setBlackScore] = React.useState(initial.blackScore);
  const [status, setStatus] = React.useState(initial.status);
  const [saveState, setSaveState] = React.useState('idle'); // idle | saving | saved | error
  // Snapshots of {side, delta, prevYellow, prevBlack, nextYellow, nextBlack}
  // for the last few taps, most-recent last — lets "Undo" restore the exact
  // prior stored value even across a Math.max(0, ...) floor, without having
  // to reverse-engineer it from the delta.
  const [undoStack, setUndoStack] = React.useState([]);

  // match.liveScore refreshes on every poll (see ScoreApp), so this stays
  // live — if someone else posts an update while this device has the match
  // open, the banner below appears without needing a reload.
  const otherActive = isRecentlyActive(match.liveScore) && match.liveScore.scorer && match.liveScore.scorer !== scorerName;

  async function post(nextYellow, nextBlack, nextStatus) {
    setSaveState('saving');
    try {
      const res = await fetch(SCORE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: match.id,
          court: match.court || '',
          yellowScore: nextYellow,
          blackScore: nextBlack,
          status: nextStatus,
          scorer: scorerName,
        }),
      });
      setSaveState(res.ok ? 'saved' : 'error');
    } catch (e) {
      setSaveState('error');
    }
  }

  function adjust(side, delta) {
    if (status === 'complete') return;
    const prevYellow = yellowScore;
    const prevBlack = blackScore;
    let nextYellow = yellowScore;
    let nextBlack = blackScore;
    if (side === 'yellow') {
      nextYellow = Math.max(0, yellowScore + delta);
      setYellowScore(nextYellow);
    } else {
      nextBlack = Math.max(0, blackScore + delta);
      setBlackScore(nextBlack);
    }
    setUndoStack([...undoStack, { side, delta, prevYellow, prevBlack, nextYellow, nextBlack }].slice(-MAX_UNDO));
    post(nextYellow, nextBlack, status);
  }

  function undoLast() {
    if (undoStack.length === 0 || status === 'complete') return;
    const last = undoStack[undoStack.length - 1];
    setYellowScore(last.prevYellow);
    setBlackScore(last.prevBlack);
    setUndoStack(undoStack.slice(0, -1));
    post(last.prevYellow, last.prevBlack, status);
  }

  function markComplete() {
    setStatus('complete');
    setUndoStack([]);
    post(yellowScore, blackScore, 'complete');
  }

  function reopen() {
    setStatus('in_progress');
    post(yellowScore, blackScore, 'in_progress');
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

      {otherActive && (
        <div className="s-other-scorer-banner">
          Heads up — {match.liveScore.scorer} updated this match {formatAgo(match.liveScore.updatedAt)} ago. Make sure you're not both scoring it.
        </div>
      )}

      {status === 'complete' ? (
        <div className="s-done">
          <p className="s-done-title">Marked complete</p>
          <p className="s-done-score">{match.yellow || 'Yellow'} {yellowScore} &ndash; {blackScore} {match.black || 'Black'}</p>
          <p className="s-done-note">Tell the TD/ATD so they can enter the final score into the Matches sheet.</p>
          <button className="s-reopen" onClick={reopen}>Reopen (mis-tap)</button>
        </div>
      ) : (
        <div className="s-score">
          <ScoreSide label={match.yellow || 'Yellow'} score={yellowScore} onAdjust={(d) => adjust('yellow', d)} />
          <div className="s-dash">&ndash;</div>
          <ScoreSide label={match.black || 'Black'} score={blackScore} onAdjust={(d) => adjust('black', d)} />
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
        <button className="s-complete" onClick={markComplete}>Match complete</button>
      )}

      <div className={`s-status s-status-${saveState}`}>
        {saveState === 'saving' && 'Saving…'}
        {saveState === 'saved' && 'Saved'}
        {saveState === 'error' && 'Couldn’t save — check connection and try again'}
      </div>
    </div>
  );
}

function ScoreSide({ label, score, onAdjust }) {
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
