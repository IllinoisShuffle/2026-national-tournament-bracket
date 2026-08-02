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
const SCORE_POLL_MS = 10000; // shorter than the bracket pages' 45s — a host
// needs to notice a new match land on their court promptly.
const COURT_FILTER_KEY = 'scoreCourtFilter';

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
    return <ScoreKeeper match={selected} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="s-wrap">
      <header className="s-header">
        <h1>Pick your match</h1>
      </header>

      <CourtToggle courts={availableCourts} value={courtFilter} onChange={updateCourtFilter} />

      {!liveData && <p className="s-empty">Loading matches…</p>}
      {liveData && visibleMatches.length === 0 && (
        <p className="s-empty">No unfinished matches{courtFilter ? ` at Court ${courtFilter}` : ''} right now.</p>
      )}
      <div className="s-list">
        {visibleMatches.map((m) => (
          <button key={m.id} className="s-match-card" onClick={() => setSelectedId(m.id)}>
            <div className="s-match-id">
              {m.id}
              {m.court ? ` · Court ${normalizeCourt(m.court) || m.court}` : ''}
              {m.time ? ` · ${m.time}` : ''}
            </div>
            <div className="s-match-teams">{m.yellow || 'TBD'}</div>
            <div className="s-match-vs">vs</div>
            <div className="s-match-teams">{m.black || 'TBD'}</div>
          </button>
        ))}
      </div>
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

function ScoreKeeper({ match, onBack }) {
  const initial = match.liveScore || { yellowScore: 0, blackScore: 0, status: 'in_progress' };
  const [yellowScore, setYellowScore] = React.useState(initial.yellowScore);
  const [blackScore, setBlackScore] = React.useState(initial.blackScore);
  const [status, setStatus] = React.useState(initial.status);
  const [saveState, setSaveState] = React.useState('idle'); // idle | saving | saved | error

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
        }),
      });
      setSaveState(res.ok ? 'saved' : 'error');
    } catch (e) {
      setSaveState('error');
    }
  }

  function adjust(side, delta) {
    if (status === 'complete') return;
    if (side === 'yellow') {
      const next = Math.max(0, yellowScore + delta);
      setYellowScore(next);
      post(next, blackScore, status);
    } else {
      const next = Math.max(0, blackScore + delta);
      setBlackScore(next);
      post(yellowScore, next, status);
    }
  }

  function markComplete() {
    setStatus('complete');
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
      <div className="s-steppers">
        <button className="s-stepper" onClick={() => onAdjust(-1)} aria-label={`Decrease ${label} score`}>&minus;</button>
        <button className="s-stepper s-stepper-plus" onClick={() => onAdjust(1)} aria-label={`Increase ${label} score`}>+</button>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<ScoreApp />);
