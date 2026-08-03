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
    const r = window.buildRegionV({ quarter: q, teams: quarterTeams[q.id], y0: LEAF_Y0, gaps: GAPS4, x0: 30, x1: W - 30, style: 'train', showLabels: t.showTeamNames, slotNumbers: Array.from({length:16},(_,i)=>qi*16+i+1), roundWinners: mainResolved[q.id].roundWinners, roundLive: mainResolved[q.id].roundLive });
    return { q, r };
  });
  const consolRegions = window.QUARTERS.map((q) => {
    const r = window.buildRegionV({ quarter: q, teams: quarterConsolTeams[q.id], y0: LEAF_Y0, gaps: GAPS3, x0: 30, x1: W - 30, style: 'bus', showLabels: t.showTeamNames, roundWinners: consolResolved[q.id].roundWinners, roundLive: consolResolved[q.id].roundLive });
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
              <div className="m-region-label" style={{ background: q.color }}>
                <svg viewBox="33.7 666.1 57 67.2" width="18" height="21.2" className="m-region-icon" fill="#fff">
                  <path fillRule="evenodd" clipRule="evenodd" d="M43.754,711.312l0.14,0.409l0.233,0.349l0.292,0.339l0.338,0.291l0.361,0.292l0.409,0.232l0.454,0.234l0.922,0.303l0.909,0.21l0.897,0.059l0.198-0.035l0.175-0.023l0.338-0.058v-6.601h1.819h2.473h9.119H63.1h9.178h2.624h1.399v6.658l0.338,0.082l0.374,0.034h0.104h0.315l0.467-0.058l0.908-0.175l0.922-0.351l0.466-0.198l0.396-0.269l0.373-0.279l0.339-0.292l0.292-0.339l0.231-0.349l0.141-0.408l0.081-0.396l2.007-18.716l-1.772-16.49l-0.151-0.757l-0.198-0.688l-0.257-0.642l-0.339-0.596l-0.431-0.559l-0.548-0.491l-0.63-0.432l-0.746-0.372l-0.969-0.433l-0.897-0.314l-0.104-0.035l-1.004-0.303l-1.003-0.292l-0.104-0.023l-1.936-0.384l-0.688-0.094l-1.341-0.198l-2.029-0.198l-2.041-0.116l-3.767-0.141l-0.268-0.011l-4.069,0.151l-2.041,0.116l-2.007,0.198l-1.002,0.152l-1.026,0.14l-1.003,0.175l-0.443,0.093l-0.56,0.14l-0.967,0.292l-0.806,0.245l-0.198,0.058l-1.004,0.35l-0.979,0.433l-0.746,0.372l-0.629,0.432l-0.537,0.491l-0.432,0.559l-0.35,0.596l-0.28,0.642l-0.176,0.688l-0.139,0.757l-1.772,16.454l1.994,18.693L43.754,711.312z M74.282,700.549l-0.126,0.373l-0.188,0.326l-0.245,0.291l-0.292,0.245l-0.349,0.187l-0.374,0.117l-0.432,0.046l-0.396-0.046l-0.386-0.117l-0.337-0.187l-0.327-0.245l-0.245-0.291l-0.186-0.326l-0.094-0.373l-0.058-0.408l0.058-0.408l0.094-0.362l0.186-0.361l0.245-0.292l0.327-0.245l0.337-0.185l0.386-0.105l0.396-0.059l0.432,0.059l0.374,0.105l0.349,0.185l0.292,0.245l0.245,0.292l0.188,0.361l0.126,0.362l0.035,0.408L74.282,700.549z M79.088,700.549l-0.116,0.373l-0.187,0.326l-0.245,0.291l-0.315,0.245l-0.314,0.187l-0.407,0.117l-0.386,0.046h-0.023l-0.396-0.046l-0.372-0.117l-0.352-0.187l-0.29-0.245l-0.27-0.291l-0.197-0.326l-0.094-0.373l-0.035-0.408l0.035-0.408l0.094-0.362l0.197-0.361l0.27-0.292l0.29-0.245l0.352-0.185l0.372-0.105l0.396-0.059h0.023l0.386,0.059l0.407,0.105l0.314,0.185l0.315,0.245l0.245,0.292l0.187,0.361l0.116,0.362l0.046,0.408L79.088,700.549z M69.012,676.363l0.035-0.245l0.095-0.268l0.139-0.246l0.198-0.245l0.175-0.187l0.223-0.162l0.232-0.106l0.21-0.034h1.959h2.624h2.216h0.537l0.384,0.058l0.233,0.083l0.245,0.128l0.269,0.221l0.21,0.279l0.162,0.339l0.082,0.433l1.505,15.159l0.046,0.513l-0.081,0.385l-0.163,0.269l-0.21,0.187l-0.245,0.105l-0.258,0.058l-0.43,0.023h-2.286h-2.216h-2.624H70.4l-0.315-0.105l-0.291-0.186l-0.222-0.187l-0.175-0.211l-0.256-0.466l-0.13-0.385V676.363z M58.797,673.437H63.1h4.315v29.351H63.1h-4.303V673.437z M50.868,700.525l-0.095,0.373l-0.197,0.35l-0.232,0.291l-0.305,0.245l-0.349,0.187l-0.362,0.117l-0.407,0.046h-0.013l-0.407-0.046l-0.386-0.117l-0.35-0.187l-0.292-0.245l-0.231-0.291l-0.188-0.35l-0.116-0.373l-0.047-0.408l0.047-0.396l0.116-0.386l0.188-0.349l0.231-0.293l0.292-0.256l0.35-0.175l0.386-0.14l0.407-0.023h0.013l0.407,0.023l0.362,0.14l0.349,0.175l0.305,0.256l0.232,0.293l0.197,0.349l0.095,0.386l0.058,0.396L50.868,700.525z M55.637,700.525l-0.105,0.373l-0.198,0.35l-0.232,0.291l-0.291,0.245l-0.327,0.187l-0.374,0.117l-0.396,0.046l-0.408-0.046l-0.373-0.117l-0.351-0.187l-0.291-0.245l-0.244-0.291l-0.175-0.35l-0.117-0.373l-0.023-0.408l0.023-0.396l0.117-0.386l0.175-0.349l0.244-0.293l0.291-0.256l0.351-0.175l0.373-0.14l0.408-0.023l0.396,0.023l0.374,0.14l0.327,0.175l0.291,0.256l0.232,0.293l0.198,0.349l0.105,0.386l0.047,0.396L55.637,700.525z M45.41,691.173l1.644-14.705l0.105-0.536l0.175-0.409l0.222-0.302l0.245-0.176l0.21-0.141l0.152-0.058l0.139-0.023h0.606h2.332h2.473h1.901l0.232,0.023l0.245,0.081l0.245,0.13l0.245,0.163l0.198,0.197l0.163,0.234l0.116,0.244l0.046,0.303v15.568l-0.104,0.291l-0.104,0.245l-0.164,0.187l-0.15,0.187l-0.222,0.141l-0.245,0.104l-0.561,0.187h-1.842H51.24h-2.332h-1.666l-0.352-0.023l-0.35-0.082l-0.349-0.15l-0.305-0.198l-0.232-0.269l-0.164-0.35l-0.104-0.409L45.41,691.173z"/>
                  <rect x="54.669" y="712.268" width="16.734" height="2.449"/>
                  <path fillRule="evenodd" clipRule="evenodd" d="M81.269,726.623l-2.368-2.694h5.038l-2.565-2.787h-4.921l-1.364-1.632h-2.577l0.979,1.632H62.983H52.512l0.991-1.644l-2.508,0.012l-1.41,1.632h-5.41l-2.637,2.834h5.587l-2.31,2.647h-5.458l-3.626,3.999l5.621-0.01l-1.471,1.69h5.854l1.027-1.69l16.221-0.024l16.198-0.023l1.119,1.866h6.063l-1.644-1.878h5.177l-3.731-3.93H81.269z M62.983,726.623H49.177l1.61-2.658l12.196-0.013l12.197-0.011l1.622,2.682H62.983z"/>
                  <rect x="51.124" y="708.104" width="2.297" height="10.764"/>
                  <rect x="72.465" y="708.104" width="2.296" height="10.764"/>
                </svg>
                {q.name}
              </div>
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
              <LiveBadgeM match={champMatch} />
            </div>
            <div className="m-matchup">
              <div className="m-matchup-title">3RD PLACE GAME</div>
              <div className="m-matchup-team">{mainLoserA}</div>
              <div className="m-vs">VS</div>
              <div className="m-matchup-team">{mainLoserB}</div>
              <LiveBadgeM match={thirdMatch} />
            </div>
            <FinalRankingM first={mainChampion} second={mainRunnerUp} third={mainThird} fourth={mainFourth} />
          </div>
        </section>

        <div className="m-divider">⇆ TRANSFER AVAILABLE — R1 LOSERS</div>

        <section className="m-section">
          <div className="m-section-title">CONSOLATION BRACKET · BUS ROUTES</div>
          {consolRegions.map(({ q, r }) => (
            <div className="m-region-card" id={`consol-${q.id}`} key={q.id}>
              <div className="m-region-label m-region-label-bus">
                <svg viewBox="35.8 521.3 50.8 61.1" width="16" height="19.3" className="m-region-icon" fill="var(--paper)">
                  <path d="M62.371,525.76c0.072,0,0.148,0.003,0.222,0.003s0.149-0.003,0.222-0.003H62.371z"/>
                  <path d="M83.133,533.99c-0.614-3.071-2.579-4.3-5.528-5.528c-2.906-1.211-9.87-2.658-15.012-2.699c-5.142,0.041-12.105,1.488-15.012,2.699c-2.948,1.229-4.914,2.457-5.529,5.528l-2.211,17.026v23.46h3.808v3.68c0,4.486,6.565,4.486,6.565,0v-3.68h12.119h0.038h12.601v3.68c0,4.486,6.565,4.486,6.565,0v-3.68h3.808v-23.46L83.133,533.99z M53.231,530.059h9.14h9.583c1.843,0,1.843,2.765,0,2.765H62.35h-9.118C51.39,532.823,51.39,530.059,53.231,530.059z M46.935,567.122c-1.739,0-3.149-1.41-3.149-3.148c0-1.739,1.41-3.149,3.149-3.149c1.738,0,3.148,1.41,3.148,3.149C50.083,565.712,48.673,567.122,46.935,567.122z M62.371,552.811H45.669c-1.636,0-1.978-1.175-1.818-2.358l1.723-12.349c0.235-1.501,0.744-2.49,2.69-2.49H62.35h14.572c1.946,0,2.455,0.989,2.691,2.49l1.722,12.349c0.16,1.184-0.183,2.358-1.818,2.358H62.371z M78.252,567.122c-1.739,0-3.149-1.41-3.149-3.148c0-1.739,1.41-3.149,3.149-3.149c1.738,0,3.148,1.41,3.148,3.149C81.4,565.712,79.99,567.122,78.252,567.122z"/>
                </svg>
                {q.busNum} · {q.busName}
              </div>
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
              <LiveBadgeM match={cChampMatch} />
            </div>
            <div className="m-matchup">
              <div className="m-matchup-title">3RD PLACE GAME</div>
              <div className="m-matchup-team">{cLoserA}</div>
              <div className="m-vs">VS</div>
              <div className="m-matchup-team">{cLoserB}</div>
              <LiveBadgeM match={cThirdMatch} />
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

// Small in-progress score indicator shown next to a matchup once a court
// host has started entering live scores for it (see live-score.js) but the
// TD/ATD hasn't transcribed a final winner into the Matches tab yet.
function LiveBadgeM({ match }) {
  if (!match || match.winner || !match.liveScore) return null;
  return <div className="m-live-badge">{match.liveScore.yellowScore}–{match.liveScore.blackScore} ● LIVE</div>;
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
