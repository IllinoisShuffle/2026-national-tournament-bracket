const MOBILE_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "paper",
  "showTeamNames": true,
  "tagline": "ALL LINES LEAD TO THE LOOP"
}/*EDITMODE-END*/;

function MobilePoster() {
  const [t, setTweak] = window.useTweaks(MOBILE_TWEAK_DEFAULTS);

  // Live results (from the Netlify Function / Google Sheet). Falls back to
  // the mock demo bracket below once the first fetch has confirmed there's
  // genuinely no backend — no backend deployed, offline, fetch error, etc.
  const [liveData, setLiveData] = React.useState(null);
  const [liveChecked, setLiveChecked] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      const data = await window.LiveData.fetchLiveData();
      if (!cancelled) { setLiveData(data); setLiveChecked(true); }
    }
    load();
    const interval = setInterval(load, window.LiveData.LIVE_POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);
  const isLive = !!liveData;
  const liveMatches = liveData ? liveData.matches : {};
  // Before the first fetch resolves, render the bracket as "live with no
  // results yet" (all TBD) instead of the mock demo teams, so a connected
  // backend's real data pops into an empty bracket rather than visibly
  // overwriting fake sample names. Only show the demo/mock bracket once
  // we've confirmed there's genuinely no backend to talk to.
  const useLiveShape = isLive || !liveChecked;

  // The quick-nav row holds more shortcut pills than fit on a phone screen at
  // once, so it scrolls horizontally — show a fade on the right edge as a
  // hint, and hide it once scrolled all the way to the last pill.
  const navRef = React.useRef(null);
  const [navHasMore, setNavHasMore] = React.useState(true);
  React.useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const check = () => setNavHasMore(el.scrollWidth - el.clientWidth - el.scrollLeft > 4);
    check();
    el.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => { el.removeEventListener('scroll', check); window.removeEventListener('resize', check); };
  }, []);

  const dark = t.theme === 'ink';
  const themeStyle = dark
    ? { '--paper': '#0E0E10', '--ink': '#F4EEDF', '--ink-dim': 'rgba(244,238,223,0.55)' }
    : { '--paper': '#F4EEDF', '--ink': '#15151A', '--ink-dim': 'rgba(21,21,26,0.55)' };

  const mainResolved = {};
  window.QUARTERS.forEach((q, idx) => {
    mainResolved[q.id] = useLiveShape
      ? window.LiveData.resolveRegion({ matches: liveMatches }, 'M', [64, 32, 16, 8], idx)
      : { leafNames: window.TEAM_POOL.slice(idx * 16, idx * 16 + 16), roundWinners: null };
  });
  const quarterTeams = {};
  window.QUARTERS.forEach((q) => { quarterTeams[q.id] = mainResolved[q.id].leafNames; });

  const consolResolved = {};
  window.QUARTERS.forEach((q, idx) => {
    consolResolved[q.id] = useLiveShape
      ? window.LiveData.resolveRegion({ matches: liveMatches }, 'C', [32, 16, 8], idx)
      : (() => {
          const lt = quarterTeams[q.id];
          const losers = [];
          for (let i = 0; i < lt.length; i += 2) {
            const w = window.pickWinnerM(lt[i], lt[i + 1]);
            losers.push(w === lt[i] ? lt[i + 1] : lt[i]);
          }
          return { leafNames: losers, roundWinners: null };
        })();
  });
  const quarterConsolTeams = {};
  window.QUARTERS.forEach((q) => { quarterConsolTeams[q.id] = consolResolved[q.id].leafNames; });

  const W = 760; // internal SVG coordinate width per region card
  const LEAF_Y0 = 150; // headroom above the leaf row for rotated team-name labels
  const GAPS4 = [70, 62, 54, 46];
  const GAPS3 = [70, 62, 54];

  const regions = window.QUARTERS.map((q, qi) => {
    const r = window.buildRegionV({ quarter: q, teams: quarterTeams[q.id], y0: LEAF_Y0, gaps: GAPS4, x0: 30, x1: W - 30, style: 'train', showLabels: t.showTeamNames, slotNumbers: Array.from({length:16},(_,i)=>qi*16+i+1), roundWinners: mainResolved[q.id].roundWinners });
    return { q, r };
  });
  const consolRegions = window.QUARTERS.map((q) => {
    const r = window.buildRegionV({ quarter: q, teams: quarterConsolTeams[q.id], y0: LEAF_Y0, gaps: GAPS3, x0: 30, x1: W - 30, style: 'bus', showLabels: t.showTeamNames, roundWinners: consolResolved[q.id].roundWinners });
    return { q, r };
  });

  const finalA = useLiveShape ? (liveMatches['M4-01'] || {}) : null;
  const finalB = useLiveShape ? (liveMatches['M4-02'] || {}) : null;
  const champMatch = useLiveShape ? (liveMatches['M2-01'] || {}) : null;
  const thirdMatch = useLiveShape ? (liveMatches['M2-02'] || {}) : null;

  const mainChampsPairA = useLiveShape ? (finalA.winner || 'TBD') : window.pickWinnerM(regions[0].r.champTeam, regions[1].r.champTeam);
  const mainChampsPairB = useLiveShape ? (finalB.winner || 'TBD') : window.pickWinnerM(regions[2].r.champTeam, regions[3].r.champTeam);
  const mainLoserA = useLiveShape ? (finalA.loser || 'TBD') : (mainChampsPairA === regions[0].r.champTeam ? regions[1].r.champTeam : regions[0].r.champTeam);
  const mainLoserB = useLiveShape ? (finalB.loser || 'TBD') : (mainChampsPairB === regions[2].r.champTeam ? regions[3].r.champTeam : regions[2].r.champTeam);
  const mainChampion = useLiveShape ? (champMatch.winner || 'TBD') : window.pickWinnerM(mainChampsPairA, mainChampsPairB);
  const mainRunnerUp = useLiveShape ? (champMatch.loser || 'TBD') : (mainChampion === mainChampsPairA ? mainChampsPairB : mainChampsPairA);
  const mainThird = useLiveShape ? (thirdMatch.winner || 'TBD') : window.pickWinnerM(mainLoserA, mainLoserB);
  const mainFourth = useLiveShape ? (thirdMatch.loser || 'TBD') : (mainThird === mainLoserA ? mainLoserB : mainLoserA);

  const cFinalA = useLiveShape ? (liveMatches['C4-01'] || {}) : null;
  const cFinalB = useLiveShape ? (liveMatches['C4-02'] || {}) : null;
  const cChampMatch = useLiveShape ? (liveMatches['C2-01'] || {}) : null;
  const cThirdMatch = useLiveShape ? (liveMatches['C2-02'] || {}) : null;

  const cChampsPairA = useLiveShape ? (cFinalA.winner || 'TBD') : window.pickWinnerM(consolRegions[0].r.champTeam, consolRegions[1].r.champTeam);
  const cChampsPairB = useLiveShape ? (cFinalB.winner || 'TBD') : window.pickWinnerM(consolRegions[2].r.champTeam, consolRegions[3].r.champTeam);
  const cLoserA = useLiveShape ? (cFinalA.loser || 'TBD') : (cChampsPairA === consolRegions[0].r.champTeam ? consolRegions[1].r.champTeam : consolRegions[0].r.champTeam);
  const cLoserB = useLiveShape ? (cFinalB.loser || 'TBD') : (cChampsPairB === consolRegions[2].r.champTeam ? consolRegions[3].r.champTeam : consolRegions[2].r.champTeam);
  const cChampion = useLiveShape ? (cChampMatch.winner || 'TBD') : window.pickWinnerM(cChampsPairA, cChampsPairB);
  const cRunnerUp = useLiveShape ? (cChampMatch.loser || 'TBD') : (cChampion === cChampsPairA ? cChampsPairB : cChampsPairA);
  const cThird = useLiveShape ? (cThirdMatch.winner || 'TBD') : window.pickWinnerM(cLoserA, cLoserB);
  const cFourth = useLiveShape ? (cThirdMatch.loser || 'TBD') : (cThird === cLoserA ? cLoserB : cLoserA);

  const regionH = LEAF_Y0 + GAPS4.reduce((a, b) => a + b, 0) + 20;
  const consolRegionH = LEAF_Y0 + GAPS3.reduce((a, b) => a + b, 0) + 20;

  return (
    <div className="m-stage">
      <window.TweaksPanel>
        <window.TweakRadio label="Background" value={t.theme} options={['paper', 'ink']} onChange={(v) => setTweak('theme', v)} />
        <window.TweakToggle label="Team names" value={t.showTeamNames} onChange={(v) => setTweak('showTeamNames', v)} />
        <window.TweakText label="Tagline" value={t.tagline} onChange={(v) => setTweak('tagline', v)} />
      </window.TweaksPanel>

      <div className="m-poster" style={themeStyle} data-screen-label="Mobile Bracket">
        <div className="m-quicknav-wrap">
          <nav className="m-quicknav" aria-label="Jump to region" ref={navRef}>
            <a href="#m-top">TOP</a>
            {window.QUARTERS.map((q) => (
              <a key={`nav-main-${q.id}`} href={`#main-${q.id}`} style={{ borderColor: q.color }}>{q.name.split(' ')[0]}</a>
            ))}
            <a href="#main-results">RESULTS</a>
            {window.QUARTERS.map((q) => (
              <a key={`nav-consol-${q.id}`} href={`#consol-${q.id}`} style={{ borderColor: q.color }}>BUS {q.busNum}</a>
            ))}
            <a href="#consol-results">CONSOL</a>
          </nav>
          {navHasMore && <div className="m-quicknav-fade" aria-hidden="true" />}
        </div>
        <a className="m-back-to-top" href="#m-top" aria-label="Back to top">↑</a>
        <header className="m-header" id="m-top">
          <div className="m-logos">
            <img className="m-logo" src={window.__resources?.logoChicago || 'assets/logo-chicago.png'} />
            <img className="m-logo" src={window.__resources?.logoIlsa || 'assets/logo-ilsa.png'} />
          </div>
          <div className="m-lines-strip">
            {window.QUARTERS.map((q) => <span key={q.id} style={{ background: q.color }} />)}
          </div>
          <h1>2026 CHICAGO NATIONAL</h1>
          <h2>SHUFFLEBOARD TOURNAMENT</h2>
          <p className="m-tagline">{t.tagline}</p>
          <p className="m-venue">ROYAL PALMS · CHICAGO IL · AUGUST 8–9 2026</p>
        </header>

        <section className="m-section">
          <div className="m-section-title">MAIN BRACKET · SUBWAY</div>
          {regions.map(({ q, r }) => (
            <div className="m-region-card" id={`main-${q.id}`} key={q.id}>
              <div className="m-region-label" style={{ background: q.color }}>{q.name}</div>
              <svg viewBox={`0 0 ${W} ${regionH}`} className="m-region-svg">
                <rect x="0" y="0" width={W} height={regionH} fill="var(--paper)" />
                {r.element}
              </svg>
            </div>
          ))}

          <div className="m-loop-card" id="main-results">
            <div className="m-loop-title">THE LOOP</div>
            <div className="m-matchup">
              <div className="m-matchup-title">CHAMPIONSHIP GAME</div>
              <div className="m-matchup-team">{mainChampsPairA}</div>
              <div className="m-vs">VS</div>
              <div className="m-matchup-team">{mainChampsPairB}</div>
            </div>
            <div className="m-matchup">
              <div className="m-matchup-title">3RD PLACE GAME</div>
              <div className="m-matchup-team">{mainLoserA}</div>
              <div className="m-vs">VS</div>
              <div className="m-matchup-team">{mainLoserB}</div>
            </div>
            <FinalRankingM first={mainChampion} second={mainRunnerUp} third={mainThird} fourth={mainFourth} />
          </div>
        </section>

        <div className="m-divider">⇆ TRANSFER AVAILABLE — R1 LOSERS</div>

        <section className="m-section">
          <div className="m-section-title">CONSOLATION BRACKET · BUS ROUTES</div>
          {consolRegions.map(({ q, r }) => (
            <div className="m-region-card" id={`consol-${q.id}`} key={q.id}>
              <div className="m-region-label m-region-label-bus">{q.busNum} · {q.busName}</div>
              <svg viewBox={`0 0 ${W} ${consolRegionH}`} className="m-region-svg">
                <rect x="0" y="0" width={W} height={consolRegionH} fill="var(--paper)" />
                {r.element}
              </svg>
            </div>
          ))}

          <div className="m-loop-card m-loop-card-bus" id="consol-results">
            <div className="m-loop-title">CONSOLATION FINALS</div>
            <div className="m-matchup">
              <div className="m-matchup-title">CHAMPIONSHIP GAME</div>
              <div className="m-matchup-team">{cChampsPairA}</div>
              <div className="m-vs">VS</div>
              <div className="m-matchup-team">{cChampsPairB}</div>
            </div>
            <div className="m-matchup">
              <div className="m-matchup-title">3RD PLACE GAME</div>
              <div className="m-matchup-team">{cLoserA}</div>
              <div className="m-vs">VS</div>
              <div className="m-matchup-team">{cLoserB}</div>
            </div>
            <FinalRankingM first={cChampion} second={cRunnerUp} third={cThird} fourth={cFourth} />
          </div>
        </section>

        <footer className="m-footer">
          <img className="m-logo-rp" src={window.__resources?.logoRoyalPalms || 'assets/logo-royal-palms.webp'} />
          <p>ROYAL PALMS SHUFFLEBOARD CLUB<br/>1750 N. MILWAUKEE AVE · CHICAGO IL</p>
          <p className="m-footer-sub">64 TEAMS · 4 REGIONS · WIN R1 → MAIN BRACKET · LOSE R1 → CONSOLATION</p>
        </footer>
      </div>
    </div>
  );
}

function FinalRankingM({ first, second, third, fourth }) {
  const rows = [
    ['1ST', 'CHAMPION', first], ['2ND', 'RUNNER-UP', second],
    ['3RD', 'THIRD PLACE', third], ['4TH', 'FOURTH PLACE', fourth],
  ];
  return (
    <div className="m-ranking">
      <div className="m-ranking-title">FINAL RANKING</div>
      {rows.map(([rank, label, team]) => (
        <div className="m-ranking-row" key={rank}>
          <span className="m-rank-badge">{rank}</span>
          <span className="m-rank-text"><b>{team}</b><br/>{label}</span>
        </div>
      ))}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<MobilePoster />);
