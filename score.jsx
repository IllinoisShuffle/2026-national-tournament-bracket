// Court host scorekeeping page. One static, bookmarkable URL per court for
// the whole tournament (score.html?court=3) — no login. The court number is
// only a convenience filter against the existing results feed (which court
// each match is assigned to already lives on the Matches sheet), not an
// identity or auth mechanism.
//
// This page never writes to the Matches Google Sheet. It POSTs to
// netlify/functions/live-score.js, which stores in-progress scores in
// Netlify Blobs, keyed by match ID. The TD/ATD still manually transcribes
// the final score/winner into the Matches tab — this page's "Match
// complete" button just freezes the display and asks the host to tell them.

const SCORE_ENDPOINT = '/.netlify/functions/live-score';
const SCORE_POLL_MS = 10000; // shorter than the bracket pages' 45s — a host
// needs to notice a new match land on their court promptly.

// The sheet's Court column format isn't guaranteed to be a bare number (it
// might read "3" or "Court 3"), so compare on the digits only rather than
// requiring an exact string match.
function normalizeCourt(v) {
  const m = String(v || '').match(/\d+/);
  return m ? m[0].replace(/^0+(?=\d)/, '') : String(v || '').trim().toLowerCase();
}

function ScoreApp() {
  const court = React.useMemo(() => {
    const params = new URLSearchParams(location.search);
    return (params.get('court') || '').trim();
  }, []);

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

  const matches = (liveData && liveData.matches) || {};
  const courtMatches = Object.values(matches)
    .filter((m) => !m.winner && normalizeCourt(m.court) === normalizeCourt(court))
    .sort((a, b) => a.id.localeCompare(b.id));

  const selected = selectedId ? matches[selectedId] : null;

  if (!court) {
    return (
      <div className="s-wrap">
        <p className="s-empty">No court specified. Use a URL like <code>score.html?court=3</code>.</p>
      </div>
    );
  }

  if (selected) {
    return (
      <ScoreKeeper
        match={selected}
        court={court}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <div className="s-wrap">
      <header className="s-header">
        <div className="s-court-label">COURT {court}</div>
        <h1>Pick your match</h1>
      </header>
      {!liveData && <p className="s-empty">Loading matches…</p>}
      {liveData && courtMatches.length === 0 && (
        <p className="s-empty">No unfinished matches assigned to this court right now.</p>
      )}
      <div className="s-list">
        {courtMatches.map((m) => (
          <button key={m.id} className="s-match-card" onClick={() => setSelectedId(m.id)}>
            <div className="s-match-id">{m.id}{m.time ? ` · ${m.time}` : ''}</div>
            <div className="s-match-teams">{m.yellow || 'TBD'}</div>
            <div className="s-match-vs">vs</div>
            <div className="s-match-teams">{m.black || 'TBD'}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ScoreKeeper({ match, court, onBack }) {
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
          court,
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
        <div className="s-court-label">COURT {court} · {match.id}</div>
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
