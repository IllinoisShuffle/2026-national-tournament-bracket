// app-scoreboard.jsx
// Live scoreboard: shows matches currently on the court, plus what's up next,
// pulled straight from the same Netlify Function / Google Sheet poll the
// bracket pages use. Falls back to a small deterministic demo set (clearly
// labeled) when the live-results backend isn't reachable.

const SCOREBOARD_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "paper"
}/*EDITMODE-END*/;

const MATCH_ID_RE = /^([MC])(\d+)-(\d+)$/i;

// Parses a match ID into round/region metadata. Mirrors the block layout
// documented in live-data.js: within a round, match numbers split into four
// equal blocks (Red, Blue, Green, Orange = window.QUARTERS order). Round
// size 4 merges two quarters at a time (left half / right half); round size
// 2 (final + 3rd place) spans the whole bracket, so it has no single region.
function describeMatch(m) {
  const parsed = MATCH_ID_RE.exec(m.id);
  if (!parsed) return null;
  const prefix = parsed[1].toUpperCase();
  const size = parseInt(parsed[2], 10);
  const num = parseInt(parsed[3], 10);

  const bracketLabel = prefix === 'M' ? 'Main Bracket' : 'Consolation';
  let roundLabel;
  if (size === 2) roundLabel = num === 1 ? 'Championship' : '3rd Place Game';
  else if (size === 4) roundLabel = 'Semifinal';
  else if (size === 8) roundLabel = 'Quarterfinal';
  else roundLabel = `Round of ${size}`;

  let quarters = null;
  if (size >= 8) {
    const perRegion = (size / 2) / 4;
    const qi = Math.floor((num - 1) / perRegion);
    quarters = [window.QUARTERS[qi]].filter(Boolean);
  } else if (size === 4) {
    quarters = num === 1 ? [window.QUARTERS[0], window.QUARTERS[1]] : [window.QUARTERS[2], window.QUARTERS[3]];
  }

  return { ...m, prefix, size, num, bracketLabel, roundLabel, quarters };
}

// Small fixed demo set so the page previews sensibly before the results
// backend is configured — same fallback philosophy as the bracket pages,
// but flagged explicitly here since scores are the whole point of this view.
function buildDemoData() {
  const rows = [
    { id: 'M32-05', time: '2:10 PM', court: 'Court 3', yellow: window.TEAM_POOL[4], yellowScore: '6', black: window.TEAM_POOL[5], blackScore: '4', live: true },
    { id: 'C32-12', time: '2:05 PM', court: 'Court 7', yellow: window.TEAM_POOL[20], yellowScore: '3', black: window.TEAM_POOL[21], blackScore: '3', live: true },
    { id: 'C16-02', time: '2:05 PM', court: 'Court 1', yellow: window.TEAM_POOL[8], yellowScore: '5', black: window.TEAM_POOL[9], blackScore: '2', live: true },
    { id: 'C16-01', time: '2:05 PM', court: 'Court 4', yellow: window.TEAM_POOL[1], yellowScore: '', black: window.TEAM_POOL[2], blackScore: '', live: true },
    { id: 'M16-04', time: '2:35 PM', court: 'Court 5', yellow: window.TEAM_POOL[12], yellowScore: '', black: window.TEAM_POOL[13], blackScore: '', live: false },
    { id: 'C16-06', time: '2:40 PM', court: 'Court 2', yellow: window.TEAM_POOL[28], yellowScore: '', black: window.TEAM_POOL[29], blackScore: '', live: false },
  ];
  const matches = {};
  rows.forEach((r) => { matches[r.id] = r; });
  return { matches, updatedAt: Date.now() };
}

function Scoreboard() {
  const [t, setTweak] = window.useTweaks(SCOREBOARD_TWEAK_DEFAULTS);

  const [liveData, setLiveData] = React.useState(null);
  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      const data = await window.LiveData.fetchLiveData();
      if (!cancelled) setLiveData(data);
    }
    load();
    const interval = setInterval(load, window.LiveData.LIVE_POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const isLive = !!liveData;
  const data = liveData || buildDemoData();

  const allMatches = React.useMemo(
    () => Object.values(data.matches).map(describeMatch).filter(Boolean),
    [data]
  );

  const courtNum = (m) => { const n = parseInt(m.court, 10); return Number.isFinite(n) ? n : 999; };

  const activeMatches = allMatches
    .filter((m) => m.live)
    .sort((a, b) => courtNum(a) - courtNum(b) || a.id.localeCompare(b.id));

  const upNext = allMatches
    .filter((m) => !m.live && !m.winner && m.yellow && m.black && m.yellow !== 'TBD' && m.black !== 'TBD' && (m.court || m.time))
    .sort((a, b) => (a.time || '').localeCompare(b.time || '') || courtNum(a) - courtNum(b));

  const dark = t.theme === 'ink';
  const themeStyle = dark
    ? { '--paper': '#0E0E10', '--ink': '#F4EEDF', '--ink-dim': 'rgba(244,238,223,0.55)', '--card': 'rgba(255,255,255,0.05)', '--card-border': 'rgba(255,255,255,0.1)' }
    : { '--paper': '#F4EEDF', '--ink': '#15151A', '--ink-dim': 'rgba(21,21,26,0.55)', '--card': 'rgba(21,21,26,0.035)', '--card-border': 'rgba(21,21,26,0.1)' };

  const updatedLabel = isLive && data.updatedAt
    ? new Date(data.updatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <div className="sb-stage" style={themeStyle}>
      <window.TweaksPanel>
        <window.TweakRadio label="Background" value={t.theme} options={['paper', 'ink']} onChange={(v) => setTweak('theme', v)} />
      </window.TweaksPanel>

      <div className="sb-wrap">
        <div className="sb-header">
          <div className="sb-title-block">
            <div className="sb-logos">
              <img className="sb-logo" src={window.__resources?.logoChicago || 'assets/logo-chicago.png'} alt="Chicago" />
              <img className="sb-logo" src={window.__resources?.logoIlsa || 'assets/logo-ilsa.png'} alt="ILSA" />
            </div>
            <p className="sb-kicker">2026 Chicago National · Royal Palms</p>
            <h1>Live Scoreboard</h1>
            <div className="sb-lines">
              {window.QUARTERS.map((q) => <span key={q.id} style={{ background: q.color }} />)}
            </div>
            <nav className="sb-nav">
              <a href="web-bracket.html">Full Bracket ↗</a>
              <a href="mobile-bracket.html">Mobile Bracket ↗</a>
            </nav>
          </div>
          <div className="sb-meta">
            <div>{activeMatches.length} match{activeMatches.length === 1 ? '' : 'es'} in progress</div>
            {updatedLabel && <div className="sb-updated">Updated {updatedLabel}</div>}
          </div>
        </div>

        {!isLive && (
          <div className="sb-demo-banner">Live results aren't connected yet — showing sample demo matches.</div>
        )}

        <div className="sb-section-title"><span className="sb-pulse" />On the Courts</div>
        {activeMatches.length === 0 ? (
          <div className="sb-empty">No matches in progress right now — check back shortly.</div>
        ) : (
          <div className="sb-grid">
            {activeMatches.map((m) => <MatchCard key={m.id} m={m} />)}
          </div>
        )}

        {upNext.length > 0 && (
          <>
            <div className="sb-section-title">Up Next</div>
            <div className="sb-upnext">
              {upNext.map((m) => (
                <div className="sb-upnext-row" key={m.id}>
                  <span className="sb-un-when">{m.time || 'TBD'}{m.court ? ` · ${m.court}` : ''}</span>
                  <span className="sb-un-round">{m.bracketLabel} · {m.roundLabel}</span>
                  <span className="sb-un-teams">{m.yellow} vs {m.black}</span>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="sb-footer">
          <img className="sb-logo-rp" src={window.__resources?.logoRoyalPalms || 'assets/logo-royal-palms.webp'} alt="Royal Palms" />
          <div>ROYAL PALMS SHUFFLEBOARD CLUB · 1750 N. MILWAUKEE AVE · CHICAGO IL</div>
        </div>
      </div>
    </div>
  );
}

function MatchCard({ m }) {
  const regionColor = m.quarters && m.quarters.length === 1 ? m.quarters[0].color : 'var(--ink-dim)';
  const bracketLabel = m.bracketLabel || '?';
  const regionText = !m.quarters
    ? m.bracketLabel
    : m.quarters.length === 1
      ? m.quarters[0].name
      : m.quarters.map((q) => q.name.split(' ')[0]).join(' + ');

  return (
    <div className="sb-card">
      <div className="sb-card-bar" style={{ background: regionColor }} />
      <div className="sb-card-top">
        <span className="sb-region">{bracketLabel}</span>
        <span className="sb-court">
          <span className="sb-pulse" />
          {m.court ? `${m.court}` : 'LIVE'}
        </span>
      </div>
      <div className="sb-round">{m.roundLabel}</div>
      <TeamRow puck="yellow" name={m.yellow} score={m.yellowScore} />
      <TeamRow puck="black" name={m.black} score={m.blackScore} />
      {(m.time || m.approxEnd) && (
        <div className="sb-card-foot">
          {m.time && <>Started {m.time}</>}
          {m.time && m.approxEnd && ' · '}
          {m.approxEnd && <>Est. finish {m.approxEnd}</>}
        </div>
      )}
    </div>
  );
}

function TeamRow({ puck, name, score }) {
  return (
    <div className="sb-team-row">
      <span className="sb-team-name">
        <span className={`sb-puck sb-puck-${puck}`} />
        <span className="name">{name || 'TBD'}</span>
      </span>
      {/* <span className="sb-score">{score !== '' && score != null ? score : '–'}</span>  */}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Scoreboard />);
