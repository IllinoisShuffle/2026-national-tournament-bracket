const MOBILE_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "paper",
  "showTeamNames": true,
  "tagline": "ALL LINES LEAD TO THE LOOP"
}/*EDITMODE-END*/;

function MobilePoster() {
  const [t, setTweak] = window.useTweaks(MOBILE_TWEAK_DEFAULTS);
  const dark = t.theme === 'ink';
  const themeStyle = dark
    ? { '--paper': '#0E0E10', '--ink': '#F4EEDF', '--ink-dim': 'rgba(244,238,223,0.55)' }
    : { '--paper': '#F4EEDF', '--ink': '#15151A', '--ink-dim': 'rgba(21,21,26,0.55)' };

  const quarterTeams = {};
  window.QUARTERS.forEach((q, idx) => { quarterTeams[q.id] = window.TEAM_POOL.slice(idx * 16, idx * 16 + 16); });
  const quarterConsolTeams = {};
  window.QUARTERS.forEach((q) => {
    const lt = quarterTeams[q.id];
    const losers = [];
    for (let i = 0; i < lt.length; i += 2) {
      const w = window.pickWinnerM(lt[i], lt[i + 1]);
      losers.push(w === lt[i] ? lt[i + 1] : lt[i]);
    }
    quarterConsolTeams[q.id] = losers;
  });

  const W = 760; // internal SVG coordinate width per region card
  const GAPS4 = [70, 62, 54, 46];
  const GAPS3 = [70, 62, 54];

  const regions = window.QUARTERS.map((q, qi) => {
    const r = window.buildRegionV({ quarter: q, teams: quarterTeams[q.id], y0: 120, gaps: GAPS4, x0: 30, x1: W - 30, style: 'train', showLabels: t.showTeamNames, slotNumbers: Array.from({length:16},(_,i)=>qi*16+i+1) });
    return { q, r };
  });
  const consolRegions = window.QUARTERS.map((q) => {
    const r = window.buildRegionV({ quarter: q, teams: quarterConsolTeams[q.id], y0: 120, gaps: GAPS3, x0: 30, x1: W - 30, style: 'bus', showLabels: t.showTeamNames });
    return { q, r };
  });

  const mainChampsPairA = window.pickWinnerM(regions[0].r.champTeam, regions[1].r.champTeam);
  const mainChampsPairB = window.pickWinnerM(regions[2].r.champTeam, regions[3].r.champTeam);
  const mainChampion = window.pickWinnerM(mainChampsPairA, mainChampsPairB);
  const mainRunnerUp = mainChampion === mainChampsPairA ? mainChampsPairB : mainChampsPairA;
  const mainLoserA = mainChampsPairA === regions[0].r.champTeam ? regions[1].r.champTeam : regions[0].r.champTeam;
  const mainLoserB = mainChampsPairB === regions[2].r.champTeam ? regions[3].r.champTeam : regions[2].r.champTeam;
  const mainThird = window.pickWinnerM(mainLoserA, mainLoserB);
  const mainFourth = mainThird === mainLoserA ? mainLoserB : mainLoserA;

  const cChampsPairA = window.pickWinnerM(consolRegions[0].r.champTeam, consolRegions[1].r.champTeam);
  const cChampsPairB = window.pickWinnerM(consolRegions[2].r.champTeam, consolRegions[3].r.champTeam);
  const cChampion = window.pickWinnerM(cChampsPairA, cChampsPairB);
  const cRunnerUp = cChampion === cChampsPairA ? cChampsPairB : cChampsPairA;
  const cLoserA = cChampsPairA === consolRegions[0].r.champTeam ? consolRegions[1].r.champTeam : consolRegions[0].r.champTeam;
  const cLoserB = cChampsPairB === consolRegions[2].r.champTeam ? consolRegions[3].r.champTeam : consolRegions[2].r.champTeam;
  const cThird = window.pickWinnerM(cLoserA, cLoserB);
  const cFourth = cThird === cLoserA ? cLoserB : cLoserA;

  const regionH = 120 + GAPS4.reduce((a, b) => a + b, 0) + 20;
  const consolRegionH = 120 + GAPS3.reduce((a, b) => a + b, 0) + 20;

  return (
    <div className="m-stage">
      <window.TweaksPanel>
        <window.TweakRadio label="Background" value={t.theme} options={['paper', 'ink']} onChange={(v) => setTweak('theme', v)} />
        <window.TweakToggle label="Team names" value={t.showTeamNames} onChange={(v) => setTweak('showTeamNames', v)} />
        <window.TweakText label="Tagline" value={t.tagline} onChange={(v) => setTweak('tagline', v)} />
      </window.TweaksPanel>

      <div className="m-poster" style={themeStyle} data-screen-label="Mobile Bracket">
        <header className="m-header">
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
            <div className="m-region-card" key={q.id}>
              <div className="m-region-label" style={{ background: q.color }}>{q.name}</div>
              <svg viewBox={`0 0 ${W} ${regionH}`} className="m-region-svg">
                <rect x="0" y="0" width={W} height={regionH} fill="var(--paper)" />
                {r.element}
              </svg>
            </div>
          ))}

          <div className="m-loop-card">
            <div className="m-loop-title">THE LOOP</div>
            <div className="m-matchup">
              <div className="m-matchup-title">CHAMPIONSHIP GAME</div>
              <div className="m-matchup-team">{mainChampsPairA.split(' / ')[0]}</div>
              <div className="m-vs">VS</div>
              <div className="m-matchup-team">{mainChampsPairB.split(' / ')[0]}</div>
            </div>
            <div className="m-matchup">
              <div className="m-matchup-title">3RD PLACE GAME</div>
              <div className="m-matchup-team">{mainLoserA.split(' / ')[0]}</div>
              <div className="m-vs">VS</div>
              <div className="m-matchup-team">{mainLoserB.split(' / ')[0]}</div>
            </div>
            <FinalRankingM first={mainChampion} second={mainRunnerUp} third={mainThird} fourth={mainFourth} />
          </div>
        </section>

        <div className="m-divider">⇆ TRANSFER AVAILABLE — R1 LOSERS</div>

        <section className="m-section">
          <div className="m-section-title">CONSOLATION BRACKET · BUS ROUTES</div>
          {consolRegions.map(({ q, r }) => (
            <div className="m-region-card" key={q.id}>
              <div className="m-region-label m-region-label-bus">{q.busNum} · {q.busName}</div>
              <svg viewBox={`0 0 ${W} ${consolRegionH}`} className="m-region-svg">
                <rect x="0" y="0" width={W} height={consolRegionH} fill="var(--paper)" />
                {r.element}
              </svg>
            </div>
          ))}

          <div className="m-loop-card m-loop-card-bus">
            <div className="m-loop-title">1ST PLACE</div>
            <div className="m-matchup">
              <div className="m-matchup-title">CHAMPIONSHIP GAME</div>
              <div className="m-matchup-team">{cChampsPairA.split(' / ')[0]}</div>
              <div className="m-vs">VS</div>
              <div className="m-matchup-team">{cChampsPairB.split(' / ')[0]}</div>
            </div>
            <div className="m-matchup">
              <div className="m-matchup-title">3RD PLACE GAME</div>
              <div className="m-matchup-team">{cLoserA.split(' / ')[0]}</div>
              <div className="m-vs">VS</div>
              <div className="m-matchup-team">{cLoserB.split(' / ')[0]}</div>
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
