const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "paper",
  "showTeamNames": true,
  "showResults": true,
  "tagline": "ALL LINES LEAD TO THE LOOP"
}/*EDITMODE-END*/;

function Poster() {
  const [t, setTweak] = window.useTweaks(TWEAK_DEFAULTS);
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const dragRef = React.useRef(null);
  const posterRef = React.useRef(null);

  // Kiosk/TV mode (?kiosk): no pointer input to drive pan/zoom on a TV, so
  // instead we auto-cycle the camera through fixed regions of the poster.
  const isKiosk = React.useMemo(() => /[?&]kiosk\b/.test(location.search), []);
  const [kioskIndex, setKioskIndex] = React.useState(0);
  const [kioskCam, setKioskCam] = React.useState({ zoom: 1, x: 0, y: 0 });

  // Live results (from the Netlify Function / Google Sheet). Falls back to
  // the mock demo bracket below whenever this is null — no backend deployed,
  // offline, fetch error, etc.
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

  const clampZoom = (z) => Math.max(1, Math.min(6, z));
  const onWheel = (e) => {
    if (isKiosk) return;
    if (!e.ctrlKey && !e.metaKey) return; // let normal page scroll/trackpad pass through
    e.preventDefault();
    setZoom((z) => clampZoom(z - e.deltaY * 0.01));
  };
  const onPointerDown = (e) => {
    if (isKiosk || zoom <= 1) return;
    dragRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  };
  const onPointerMove = (e) => {
    if (isKiosk || !dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setPan({ x: dragRef.current.panX + dx, y: dragRef.current.panY + dy });
  };
  const endDrag = () => { dragRef.current = null; };
  const zoomBy = (delta) => setZoom((z) => clampZoom(z + delta));
  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const {
    POSTER_W, POSTER_H, HEADER_H, MAIN_Y0, MAIN_Y1, DIVIDER_Y0, DIVIDER_Y1,
    CONSOL_Y0, CONSOL_Y1, FOOTER_Y0, CHAMPION_X,
  } = window.LayoutConsts;
  const { bendPath } = window.LayoutHelpers;
  const { buildRegion, mergeConnector } = window;

  const dark = t.theme === 'ink';
  const themeStyle = dark
    ? { '--paper': '#0E0E10', '--ink': '#F4EEDF', '--ink-dim': 'rgba(244,238,223,0.55)' }
    : { '--paper': '#F4EEDF', '--ink': '#15151A', '--ink-dim': 'rgba(21,21,26,0.55)' };

  // Assign teams to quarters (16 each), in leaf order. In live mode these
  // come straight from the M64 match rows (Yellow/Black); in demo mode they
  // come from the mock TEAM_POOL.
  const mainResolved = {};
  window.QUARTERS.forEach((q, idx) => {
    mainResolved[q.id] = isLive
      ? window.LiveData.resolveRegion(liveData, 'M', [64, 32, 16, 8], idx)
      : { leafNames: window.TEAM_POOL.slice(idx * 16, idx * 16 + 16), roundWinners: null };
  });
  const quarterTeams = {};
  window.QUARTERS.forEach((q) => { quarterTeams[q.id] = mainResolved[q.id].leafNames; });

  // Consolation leaves: in live mode these come straight from the C32 match
  // rows (the sheet is the source of truth for who dropped into consolation).
  // In demo mode, simulate them as the round-1 losers of the mock main bracket.
  const consolResolved = {};
  window.QUARTERS.forEach((q, idx) => {
    consolResolved[q.id] = isLive
      ? window.LiveData.resolveRegion(liveData, 'C', [32, 16, 8], idx)
      : (() => {
          const lt = quarterTeams[q.id];
          const losers = [];
          for (let i = 0; i < lt.length; i += 2) {
            const w = window.pickWinner(lt[i], lt[i + 1]);
            losers.push(w === lt[i] ? lt[i + 1] : lt[i]);
          }
          return { leafNames: losers, roundWinners: null };
        })();
  });
  const quarterConsolTeams = {};
  window.QUARTERS.forEach((q) => { quarterConsolTeams[q.id] = consolResolved[q.id].leafNames; });

  const byPos = (side, pos) => window.QUARTERS.find(q => q.side === side && q.pos === pos);
  const qLT = byPos('L', 'top'), qLB = byPos('L', 'bottom'), qRT = byPos('R', 'top'), qRB = byPos('R', 'bottom');

  // ---------- MAIN BRACKET ----------
  const mainMidY = (MAIN_Y0 + MAIN_Y1) / 2;
  const MAIN_GAPS = [305, 295, 285, 255];
  const MAIN_HALF_GAP = 260;
  const regLT = buildRegion({ key: 'm-lt', quarter: qLT, teams: quarterTeams[qLT.id], x0: 100, gaps: MAIN_GAPS, dir: 1, y0: MAIN_Y0 + 68, y1: mainMidY - 10, style: 'train', showLabels: t.showTeamNames, showResults: t.showResults, slotNumbers: Array.from({length:16},(_,i)=>i+1), roundWinners: mainResolved[qLT.id].roundWinners });
  const regLB = buildRegion({ key: 'm-lb', quarter: qLB, teams: quarterTeams[qLB.id], x0: 100, gaps: MAIN_GAPS, dir: 1, y0: mainMidY + 58, y1: MAIN_Y1 - 20, style: 'train', showLabels: t.showTeamNames, showResults: t.showResults, slotNumbers: Array.from({length:16},(_,i)=>i+17), roundWinners: mainResolved[qLB.id].roundWinners });
  const regRT = buildRegion({ key: 'm-rt', quarter: qRT, teams: quarterTeams[qRT.id], x0: POSTER_W - 100, gaps: MAIN_GAPS, dir: -1, y0: MAIN_Y0 + 68, y1: mainMidY - 10, style: 'train', showLabels: t.showTeamNames, showResults: t.showResults, slotNumbers: Array.from({length:16},(_,i)=>i+33), roundWinners: mainResolved[qRT.id].roundWinners });
  const regRB = buildRegion({ key: 'm-rb', quarter: qRB, teams: quarterTeams[qRB.id], x0: POSTER_W - 100, gaps: MAIN_GAPS, dir: -1, y0: mainMidY + 58, y1: MAIN_Y1 - 20, style: 'train', showLabels: t.showTeamNames, showResults: t.showResults, slotNumbers: Array.from({length:16},(_,i)=>i+49), roundWinners: mainResolved[qRB.id].roundWinners });

  const mainGapSum = MAIN_GAPS.reduce((a, b) => a + b, 0);
  const leftHalfX = 100 + mainGapSum + MAIN_HALF_GAP;
  const rightHalfX = (POSTER_W - 100) - mainGapSum - MAIN_HALF_GAP;
  const leftHalfY = (regLT.champY + regLB.champY) / 2;
  const rightHalfY = (regRT.champY + regRB.champY) / 2;
  const champY = (leftHalfY + rightHalfY) / 2;

  const mainMerges = [
    mergeConnector('m1', regLT.champX, regLT.champY, leftHalfX, leftHalfY, 'var(--ink)', 'train'),
    mergeConnector('m2', regLB.champX, regLB.champY, leftHalfX, leftHalfY, 'var(--ink)', 'train'),
    mergeConnector('m3', regRT.champX, regRT.champY, rightHalfX, rightHalfY, 'var(--ink)', 'train'),
    mergeConnector('m4', regRB.champX, regRB.champY, rightHalfX, rightHalfY, 'var(--ink)', 'train'),
    mergeConnector('m5', leftHalfX, leftHalfY, CHAMPION_X, champY, 'var(--ink)', 'train'),
    mergeConnector('m6', rightHalfX, rightHalfY, CHAMPION_X, champY, 'var(--ink)', 'train'),
  ];
  // M4-01/M4-02 = the two semifinal games (Left half: Red+Blue champs, Right
  // half: Green+Orange champs). M2-01 = final, M2-02 = 3rd place game.
  const finalA = isLive ? (liveData.matches['M4-01'] || {}) : null;
  const finalB = isLive ? (liveData.matches['M4-02'] || {}) : null;
  const champMatch = isLive ? (liveData.matches['M2-01'] || {}) : null;
  const thirdMatch = isLive ? (liveData.matches['M2-02'] || {}) : null;

  const leftHalfWinner = isLive ? (finalA.winner || 'TBD') : window.pickWinner(regLT.champTeam, regLB.champTeam);
  const rightHalfWinner = isLive ? (finalB.winner || 'TBD') : window.pickWinner(regRT.champTeam, regRB.champTeam);
  const leftHalfLoser = isLive ? (finalA.loser || 'TBD') : (leftHalfWinner === regLT.champTeam ? regLB.champTeam : regLT.champTeam);
  const rightHalfLoser = isLive ? (finalB.loser || 'TBD') : (rightHalfWinner === regRT.champTeam ? regRB.champTeam : regRT.champTeam);
  const mainChampion = isLive ? (champMatch.winner || 'TBD') : window.pickWinner(leftHalfWinner, rightHalfWinner);
  const runnerUp = isLive ? (champMatch.loser || 'TBD') : (mainChampion === leftHalfWinner ? rightHalfWinner : leftHalfWinner);
  const thirdPlace = isLive ? (thirdMatch.winner || 'TBD') : window.pickWinner(leftHalfLoser, rightHalfLoser);
  const fourthPlace = isLive ? (thirdMatch.loser || 'TBD') : (thirdPlace === leftHalfLoser ? rightHalfLoser : leftHalfLoser);
  const thirdY = champY + 210;
  function dropPath(x1, y1, x2, y2, r = 16) {
    const dx = Math.sign(x2 - x1) || 1;
    return `M ${x1} ${y1} L ${x1} ${y2 - r} Q ${x1} ${y2} ${x1 + dx * r} ${y2} L ${x2} ${y2}`;
  }
  const thirdPlaceMerges = [
    <path key="tp1" d={dropPath(leftHalfX, leftHalfY, CHAMPION_X, thirdY)} stroke="var(--ink)" strokeWidth="4.5" strokeDasharray="9,7" strokeLinecap="round" fill="none" />,
    <path key="tp2" d={dropPath(rightHalfX, rightHalfY, CHAMPION_X, thirdY)} stroke="var(--ink)" strokeWidth="4.5" strokeDasharray="9,7" strokeLinecap="round" fill="none" />,
  ];
  const loopBounds = {
    x0: Math.min(regLT.champX, regLB.champX) - 45, x1: Math.max(regRT.champX, regRB.champX) + 45,
    y0: Math.min(regLT.champY, regRT.champY) - 55, y1: Math.max(regLB.champY, regRB.champY, thirdY) + 70,
  };

  // ---------- CONSOLATION BRACKET ----------
  const consolMidY = (CONSOL_Y0 + CONSOL_Y1) / 2;
  const CONSOL_GAPS = [420, 400, 300];
  const CONSOL_HALF_GAP = 230;
  const cLT = buildRegion({ key: 'c-lt', quarter: qLT, teams: quarterConsolTeams[qLT.id], x0: 100, gaps: CONSOL_GAPS, dir: 1, y0: CONSOL_Y0 + 58, y1: consolMidY - 10, style: 'bus', showLabels: t.showTeamNames, showResults: t.showResults, roundWinners: consolResolved[qLT.id].roundWinners });
  const cLB = buildRegion({ key: 'c-lb', quarter: qLB, teams: quarterConsolTeams[qLB.id], x0: 100, gaps: CONSOL_GAPS, dir: 1, y0: consolMidY + 68, y1: CONSOL_Y1 - 30, style: 'bus', showLabels: t.showTeamNames, showResults: t.showResults, roundWinners: consolResolved[qLB.id].roundWinners });
  const cRT = buildRegion({ key: 'c-rt', quarter: qRT, teams: quarterConsolTeams[qRT.id], x0: POSTER_W - 100, gaps: CONSOL_GAPS, dir: -1, y0: CONSOL_Y0 + 58, y1: consolMidY - 10, style: 'bus', showLabels: t.showTeamNames, showResults: t.showResults, roundWinners: consolResolved[qRT.id].roundWinners });
  const cRB = buildRegion({ key: 'c-rb', quarter: qRB, teams: quarterConsolTeams[qRB.id], x0: POSTER_W - 100, gaps: CONSOL_GAPS, dir: -1, y0: consolMidY + 68, y1: CONSOL_Y1 - 30, style: 'bus', showLabels: t.showTeamNames, showResults: t.showResults, roundWinners: consolResolved[qRB.id].roundWinners });

  const consolGapSum = CONSOL_GAPS.reduce((a, b) => a + b, 0);
  const cLeftHalfX = 100 + consolGapSum + CONSOL_HALF_GAP;
  const cRightHalfX = (POSTER_W - 100) - consolGapSum - CONSOL_HALF_GAP;
  const cLeftHalfY = (cLT.champY + cLB.champY) / 2;
  const cRightHalfY = (cRT.champY + cRB.champY) / 2;
  const cChampY = (cLeftHalfY + cRightHalfY) / 2;

  const consolMerges = [
    mergeConnector('c1', cLT.champX, cLT.champY, cLeftHalfX, cLeftHalfY, 'var(--ink)', 'bus'),
    mergeConnector('c2', cLB.champX, cLB.champY, cLeftHalfX, cLeftHalfY, 'var(--ink)', 'bus'),
    mergeConnector('c3', cRT.champX, cRT.champY, cRightHalfX, cRightHalfY, 'var(--ink)', 'bus'),
    mergeConnector('c4', cRB.champX, cRB.champY, cRightHalfX, cRightHalfY, 'var(--ink)', 'bus'),
    mergeConnector('c5', cLeftHalfX, cLeftHalfY, CHAMPION_X, cChampY, 'var(--ink)', 'bus'),
    mergeConnector('c6', cRightHalfX, cRightHalfY, CHAMPION_X, cChampY, 'var(--ink)', 'bus'),
  ];
  const cFinalA = isLive ? (liveData.matches['C4-01'] || {}) : null;
  const cFinalB = isLive ? (liveData.matches['C4-02'] || {}) : null;
  const cChampMatch = isLive ? (liveData.matches['C2-01'] || {}) : null;
  const cThirdMatch = isLive ? (liveData.matches['C2-02'] || {}) : null;

  const cLeftHalfWinner = isLive ? (cFinalA.winner || 'TBD') : window.pickWinner(cLT.champTeam, cLB.champTeam);
  const cRightHalfWinner = isLive ? (cFinalB.winner || 'TBD') : window.pickWinner(cRT.champTeam, cRB.champTeam);
  const cLeftHalfLoser = isLive ? (cFinalA.loser || 'TBD') : (cLeftHalfWinner === cLT.champTeam ? cLB.champTeam : cLT.champTeam);
  const cRightHalfLoser = isLive ? (cFinalB.loser || 'TBD') : (cRightHalfWinner === cRT.champTeam ? cRB.champTeam : cRT.champTeam);
  const consolChampion = isLive ? (cChampMatch.winner || 'TBD') : window.pickWinner(cLeftHalfWinner, cRightHalfWinner);
  const consolRunnerUp = isLive ? (cChampMatch.loser || 'TBD') : (consolChampion === cLeftHalfWinner ? cRightHalfWinner : cLeftHalfWinner);
  const consolThird = isLive ? (cThirdMatch.winner || 'TBD') : window.pickWinner(cLeftHalfLoser, cRightHalfLoser);
  const consolFourth = isLive ? (cThirdMatch.loser || 'TBD') : (consolThird === cLeftHalfLoser ? cRightHalfLoser : cLeftHalfLoser);
  const cThirdY = cChampY + 150;
  const consolThirdPlaceMerges = [
    <path key="ctp1" d={dropPath(cLeftHalfX, cLeftHalfY, CHAMPION_X, cThirdY, 12)} stroke="var(--ink)" strokeWidth="3" strokeDasharray="7,6" strokeLinecap="round" fill="none" />,
    <path key="ctp2" d={dropPath(cRightHalfX, cRightHalfY, CHAMPION_X, cThirdY, 12)} stroke="var(--ink)" strokeWidth="3" strokeDasharray="7,6" strokeLinecap="round" fill="none" />,
  ];

  // ---------- KIOSK / TV MODE ----------
  // Fixed regions (in poster coordinates) to auto-pan/zoom through when no
  // pointer is available to drive the view manually. Sized generously so
  // labels near the edges don't get clipped.
  const KIOSK_HOLD_MS = 9000;
  const busPairLabel = (a, b) => `${a.busNum} ${a.busName} & ${b.busNum} ${b.busName}`;
  // Skip a bracket's "finals" stop until it actually has a decided regional
  // champion — before that the crop is just empty TBD placeholders. Demo
  // mode (no live backend) has no TBD state, so it's always ready.
  const mainFinalsReady = !isLive || [regLT, regLB, regRT, regRB].some((r) => r.champTeam !== 'TBD');
  const consolFinalsReady = !isLive || [cLT, cLB, cRT, cRB].some((r) => r.champTeam !== 'TBD');
  const kioskViews = [
    { label: 'FULL BRACKET', x0: 0, y0: 0, x1: POSTER_W, y1: POSTER_H },
    { label: 'MAIN · RED & BLUE', x0: 20, y0: MAIN_Y0 - 50, x1: leftHalfX + 170, y1: MAIN_Y1 + 20 },
    { label: 'MAIN · GREEN & ORANGE', x0: rightHalfX - 170, y0: MAIN_Y0 - 50, x1: POSTER_W - 20, y1: MAIN_Y1 + 20 },
    ...(mainFinalsReady ? [{ label: 'MAIN BRACKET FINALS', x0: CHAMPION_X - 430, y0: Math.min(loopBounds.y0, champY - 100), x1: CHAMPION_X + 430, y1: loopBounds.y1 + 370 }] : []),
    { label: `CONSOLATION · ${busPairLabel(qLT, qLB)}`, x0: 20, y0: CONSOL_Y0 - 40, x1: cLeftHalfX + 150, y1: CONSOL_Y1 + 20 },
    { label: `CONSOLATION · ${busPairLabel(qRT, qRB)}`, x0: cRightHalfX - 150, y0: CONSOL_Y0 - 40, x1: POSTER_W - 20, y1: CONSOL_Y1 + 20 },
    ...(consolFinalsReady ? [{ label: 'CONSOLATION FINALS', x0: CHAMPION_X - 340, y0: cChampY - 100, x1: CHAMPION_X + 340, y1: cThirdY + 320 }] : []),
  ];

  React.useEffect(() => {
    if (!isKiosk) return;
    const id = setInterval(() => {
      setKioskIndex((i) => (i + 1) % kioskViews.length);
    }, KIOSK_HOLD_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isKiosk]);

  React.useEffect(() => {
    if (!isKiosk) return;
    function applyCamera() {
      const el = posterRef.current;
      if (!el || !el.offsetWidth) return;
      const view = kioskViews[kioskIndex % kioskViews.length];
      const w = view.x1 - view.x0, h = view.y1 - view.y0;
      const z = clampZoom(Math.max(POSTER_W / w, POSTER_H / h) * 0.96);
      const k = el.offsetWidth / POSTER_W;
      const cx = (view.x0 + view.x1) / 2, cy = (view.y0 + view.y1) / 2;
      setKioskCam({ zoom: z, x: -z * k * (cx - POSTER_W / 2), y: -z * k * (cy - POSTER_H / 2) });
    }
    applyCamera();
    window.addEventListener('resize', applyCamera);
    return () => window.removeEventListener('resize', applyCamera);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isKiosk, kioskIndex]);

  const posterTransform = isKiosk
    ? `translate(${kioskCam.x}px, ${kioskCam.y}px) scale(${kioskCam.zoom})`
    : `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;

  return (
    <div className="poster-stage" onWheel={onWheel} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerLeave={endDrag}>
      {!isKiosk && (
        <window.TweaksPanel>
          <window.TweakRadio label="Background" value={t.theme} options={['paper', 'ink']} onChange={(v) => setTweak('theme', v)} />
          <window.TweakToggle label="Team names" value={t.showTeamNames} onChange={(v) => setTweak('showTeamNames', v)} />
          <window.TweakToggle label="Sample results" value={t.showResults} onChange={(v) => setTweak('showResults', v)} />
          <window.TweakText label="Tagline" value={t.tagline} onChange={(v) => setTweak('tagline', v)} />
        </window.TweaksPanel>
      )}

      {!isKiosk && (
        <div className="zoom-toolbar">
          <button onClick={() => zoomBy(-0.4)}>−</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button onClick={() => zoomBy(0.4)}>+</button>
          <button onClick={resetView} className="zoom-reset">Reset</button>
        </div>
      )}

      {isKiosk && (
        <div className="kiosk-caption">
          <span className="kiosk-dot" />
          {kioskViews[kioskIndex % kioskViews.length].label}
        </div>
      )}

      <div ref={posterRef} className="poster" style={{ ...themeStyle, transform: posterTransform, transition: isKiosk ? 'transform 1.6s cubic-bezier(0.65,0,0.35,1)' : 'none', cursor: !isKiosk && zoom > 1 ? 'grab' : 'default' }} data-screen-label="Tournament Poster">
        <svg viewBox={`0 0 ${POSTER_W} ${POSTER_H}`} xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" className="poster-svg">
          <rect x="0" y="0" width={POSTER_W} height={POSTER_H} fill="var(--paper)" />
          <Header tagline={t.tagline} />
          <rect x="20" y="20" width={POSTER_W - 40} height={POSTER_H - 40} fill="none" stroke="var(--ink)" strokeWidth="3" rx="14" />

          {/* MAIN quarter labels */}
          <QuarterLabel quarter={qLT} x={100} y={MAIN_Y0 + 24} anchor="start" kind="train" />
          <QuarterLabel quarter={qLB} x={100} y={mainMidY + 14} anchor="start" kind="train" />
          <QuarterLabel quarter={qRT} x={POSTER_W - 100} y={MAIN_Y0 + 24} anchor="end" kind="train" />
          <QuarterLabel quarter={qRB} x={POSTER_W - 100} y={mainMidY + 14} anchor="end" kind="train" />

          {regLT.element}{regLB.element}{regRT.element}{regRB.element}
          {mainMerges}
          {thirdPlaceMerges}
          <LoopBoundary {...loopBounds} />
          <RegionCap x={regLT.champX} y={regLT.champY} color={qLT.color} />
          <RegionCap x={regLB.champX} y={regLB.champY} color={qLB.color} />
          <RegionCap x={regRT.champX} y={regRT.champY} color={qRT.color} />
          <RegionCap x={regRB.champX} y={regRB.champY} color={qRB.color} />
          <JunctionNode x={leftHalfX} y={leftHalfY} size={13} />
          <JunctionNode x={rightHalfX} y={rightHalfY} size={13} />
          <ChampionNode x={CHAMPION_X} y={champY} label1="1ST" label2="PLACE" sub="" size={46} />

          <JunctionNode x={CHAMPION_X} y={thirdY} size={20} />
          {t.showResults && t.showTeamNames && (
            <>
              <MatchupLabel x={CHAMPION_X} bottomY={champY - 46 - 10} teamA={leftHalfWinner} teamB={rightHalfWinner} title="CHAMPIONSHIP GAME" />
              <MatchupLabel x={CHAMPION_X} bottomY={thirdY - 20 - 10} teamA={leftHalfLoser} teamB={rightHalfLoser} title="3RD PLACE GAME" />
            </>
          )}

          <SectionLabel y={MAIN_Y0 - 30} text="MAIN BRACKET · SUBWAY" />

          {t.showResults && t.showTeamNames && (
            <FinalRanking y0={loopBounds.y1 + 15} first={mainChampion} second={runnerUp} third={thirdPlace} fourth={fourthPlace} />
          )}

          {/* Divider */}
          <Divider />

          {/* CONSOLATION quarter labels (bus) */}
          <QuarterLabel quarter={qLT} x={100} y={CONSOL_Y0 + 14} anchor="start" kind="bus" />
          <QuarterLabel quarter={qLB} x={100} y={consolMidY + 24} anchor="start" kind="bus" />
          <QuarterLabel quarter={qRT} x={POSTER_W - 100} y={CONSOL_Y0 + 14} anchor="end" kind="bus" />
          <QuarterLabel quarter={qRB} x={POSTER_W - 100} y={consolMidY + 24} anchor="end" kind="bus" />

          {cLT.element}{cLB.element}{cRT.element}{cRB.element}
          {consolMerges}
          {consolThirdPlaceMerges}
          <RegionCap x={cLT.champX} y={cLT.champY} color={qLT.color} />
          <RegionCap x={cLB.champX} y={cLB.champY} color={qLB.color} />
          <RegionCap x={cRT.champX} y={cRT.champY} color={qRT.color} />
          <RegionCap x={cRB.champX} y={cRB.champY} color={qRB.color} />
          <JunctionNode x={cLeftHalfX} y={cLeftHalfY} size={10} dashed />
          <JunctionNode x={cRightHalfX} y={cRightHalfY} size={10} dashed />
          <ChampionNode x={CHAMPION_X} y={cChampY} label1="1ST" label2="PLACE" sub="" size={32} dashed />

          <JunctionNode x={CHAMPION_X} y={cThirdY} size={14} dashed />
          {t.showResults && t.showTeamNames && (
            <>
              <MatchupLabel x={CHAMPION_X} bottomY={cChampY - 32 - 8} teamA={cLeftHalfWinner} teamB={cRightHalfWinner} title="CHAMPIONSHIP GAME" small />
              <MatchupLabel x={CHAMPION_X} bottomY={cThirdY - 14 - 8} teamA={cLeftHalfLoser} teamB={cRightHalfLoser} title="3RD PLACE GAME" small />
            </>
          )}

          <SectionLabel y={CONSOL_Y0 - 8} text="CONSOLATION BRACKET · BUS ROUTES" />

          {t.showResults && t.showTeamNames && (
            <FinalRanking y0={cThirdY + 55} first={consolChampion} second={consolRunnerUp} third={consolThird} fourth={consolFourth} small />
          )}

          <Footer />
        </svg>
      </div>
    </div>
  );
}

function Header({ tagline }) {
  const { POSTER_W } = window.LayoutConsts;
  return (
    <g>
      <foreignObject x={POSTER_W - 60 - 190} y="20" width="190" height="190">
        <img src={window.__resources?.logoIlsa || 'assets/logo-ilsa.png'} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </foreignObject>
      <foreignObject x="60" y="30" width="170" height="190">
        <img src={window.__resources?.logoChicago || 'assets/logo-chicago.png'} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </foreignObject>
      <text x={POSTER_W / 2} y="112" textAnchor="middle" fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="900" fontSize="52" fill="var(--ink)" letterSpacing="2">2026 CHICAGO NATIONAL</text>
      <text x={POSTER_W / 2} y="182" textAnchor="middle" fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="900" fontSize="70" fill="var(--ink)" letterSpacing="5">SHUFFLEBOARD TOURNAMENT</text>
      <text x={POSTER_W / 2} y="226" textAnchor="middle" fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="700" fontSize="19" fill="var(--ink-dim)" letterSpacing="5">{tagline} · ROYAL PALMS · CHICAGO IL · AUGUST 8–9 2026</text>
    </g>
  );
}

function QuarterLabel({ quarter, x, y, anchor, kind }) {
  const isTrain = kind === 'train';
  const w = isTrain ? 170 : 180, h = 34;
  const rectX = anchor === 'start' ? x - 4 : x - w + 4;
  return (
    <g>
      {isTrain ? (
        <>
          <rect x={rectX} y={y} width={w} height={h} rx="6" fill={quarter.color} />
          <text x={rectX + w / 2} y={y + 23} textAnchor="middle" fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="800" fontSize="16" letterSpacing="1.2" fill="#fff">{quarter.name}</text>
        </>
      ) : (
        <>
          <rect x={rectX} y={y} width={w} height={h} rx="6" fill="var(--paper)" stroke={quarter.color} strokeWidth="3" strokeDasharray="7,5" />
          <text x={rectX + w / 2} y={y + 23} textAnchor="middle" fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="800" fontSize="13" letterSpacing="0.6" fill="var(--ink)">{quarter.busNum} · {quarter.busName}</text>
        </>
      )}
    </g>
  );
}

function LoopBoundary({ x0, x1, y0, y1 }) {
  const cx = (x0 + x1) / 2;
  return (
    <g>
      <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} rx="56" fill="none" stroke="var(--ink)" strokeWidth="2" strokeDasharray="3,11" opacity="0.55" />
      <rect x={cx - 90} y={y0 - 16} width="180" height="32" rx="16" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.5" />
      <text x={cx} y={y0 + 6} textAnchor="middle" fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="900" fontSize="14" fill="var(--ink)" letterSpacing="2.5">THE LOOP</text>
    </g>
  );
}

function RegionCap({ x, y, color }) {
  return (
    <g>
      <circle cx={x} cy={y} r="19" fill="var(--paper)" />
      <circle cx={x} cy={y} r="15" fill={color} stroke={color} strokeWidth="3" />
    </g>
  );
}

function JunctionNode({ x, y, size = 13, dashed }) {
  return (
    <g>
      <circle cx={x} cy={y} r={size + 5} fill="var(--paper)" />
      <circle cx={x} cy={y} r={size} fill="var(--paper)" stroke="var(--ink)" strokeWidth={dashed ? 2.5 : 3.5} strokeDasharray={dashed ? '5,4' : undefined} />
    </g>
  );
}

function ChampionNode({ x, y, label1, label2, sub, size, dashed }) {
  return (
    <g>
      <circle cx={x} cy={y} r={size} fill="var(--ink)" stroke="var(--paper)" strokeWidth={dashed ? 3 : 5} strokeDasharray={dashed ? '6,5' : undefined} />
      <text x={x} y={y - size * 0.12} textAnchor="middle" fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="900" fontSize={size * 0.3} fill="var(--paper)" letterSpacing="1">{label1}</text>
      <text x={x} y={y + size * 0.34} textAnchor="middle" fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="900" fontSize={size * 0.3} fill="var(--paper)" letterSpacing="1">{label2}</text>
      <text x={x} y={y + size + 20} textAnchor="middle" fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="700" fontSize="11" fill="var(--ink-dim)" letterSpacing="2.5">{sub}</text>
    </g>
  );
}

function MatchupLabel({ x, bottomY, teamA, teamB, title, small }) {
  const lh = small ? 15 : 18;
  const fsTeam = small ? 12 : 15;
  const fsVs = small ? 8.5 : 10;
  const yB = bottomY;
  const yVs = yB - lh;
  const yA = yVs - lh;
  const yTitle = yA - (small ? 22 : 28);
  return (
    <g>
      {title && (
        <text x={x} y={yTitle} textAnchor="middle" fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="800" fontSize={small ? 10 : 12} letterSpacing="2" fill="var(--ink-dim)">{title}</text>
      )}
      <text x={x} y={yA} textAnchor="middle" fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="800" fontSize={fsTeam} letterSpacing="0.3" fill="var(--ink)">{teamA}</text>
      <text x={x} y={yVs} textAnchor="middle" fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="700" fontSize={fsVs} letterSpacing="1.5" fill="var(--ink-dim)">VS</text>
      <text x={x} y={yB} textAnchor="middle" fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="800" fontSize={fsTeam} letterSpacing="0.3" fill="var(--ink)">{teamB}</text>
    </g>
  );
}

function PathLabel({ x, y, text, anchor = 'middle', vertical, small }) {
  const fontSize = small ? 10.5 : 12.5;
  const padX = 8;
  const estW = text.length * fontSize * 0.56 + padX * 2;
  const rectX = anchor === 'middle' ? x - estW / 2 : anchor === 'end' ? x - estW : x;
  return (
    <g>
      <rect x={rectX} y={y - fontSize - 4} width={estW} height={fontSize + 8} rx={(fontSize + 8) / 2} fill="var(--paper)" opacity="0.92" />
      <text x={anchor === 'middle' ? x : anchor === 'end' ? x - padX : x + padX} y={y + 1} textAnchor={anchor === 'end' ? 'end' : anchor === 'start' ? 'start' : 'middle'}
        fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="800" fontSize={fontSize} letterSpacing="0.3" fill="var(--ink)">{text}</text>
    </g>
  );
}

function ResultLabel({ x, y, text, anchor, bold, small }) {
  const dy = anchor === 'middle' ? -4 : -10;
  return (
    <text x={x} y={y + dy} textAnchor={anchor} fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
      fontWeight={bold ? 900 : 800} fontSize={bold ? (small ? 13 : 16) : (small ? 10.5 : 12)}
      letterSpacing="0.3" fill="var(--ink)">{text}</text>
  );
}

function FinalRanking({ y0, first, second, third, fourth, small }) {
  const { POSTER_W } = window.LayoutConsts;
  const slots = [
    { rank: '1ST', label: 'CHAMPION', team: first },
    { rank: '2ND', label: 'RUNNER-UP', team: second },
    { rank: '3RD', label: 'THIRD PLACE', team: third },
    { rank: '4TH', label: 'FOURTH PLACE', team: fourth },
  ];
  const pitch = small ? 56 : 76;
  const r = small ? 11 : 14;
  const listTop = y0 + (small ? 32 : 44);
  const cx = POSTER_W / 2;
  return (
    <g>
      <text x={cx} y={y0 + (small ? 16 : 20)} textAnchor="middle" fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="800" fontSize={small ? 13 : 15} fill="var(--ink-dim)" letterSpacing="4">FINAL RANKING</text>
      {slots.map((s, i) => {
        const rowY = listTop + i * pitch;
        return (
          <g key={s.rank}>
            <circle cx={cx} cy={rowY} r={r} fill="var(--ink)" />
            <text x={cx} y={rowY + (small ? 3 : 5)} textAnchor="middle" fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="900" fontSize={small ? 9 : 11} fill="var(--paper)">{s.rank}</text>
            <text x={cx} y={rowY + r + (small ? 13 : 16)} textAnchor="middle" fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="700" fontSize={small ? 8 : 9} fill="var(--ink-dim)" letterSpacing="1.5">{s.label}</text>
            <text x={cx} y={rowY + r + (small ? 27 : 33)} textAnchor="middle" fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="800" fontSize={small ? 12 : 15} fill="var(--ink)">{s.team}</text>
          </g>
        );
      })}
    </g>
  );
}

function SectionLabel({ y, text }) {
  const { POSTER_W } = window.LayoutConsts;
  return <text x={POSTER_W / 2} y={y} textAnchor="middle" fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="800" fontSize="15" fill="var(--ink-dim)" letterSpacing="4">{text}</text>;
}

function Divider() {
  const { POSTER_W, DIVIDER_Y0, DIVIDER_Y1 } = window.LayoutConsts;
  const midY = (DIVIDER_Y0 + DIVIDER_Y1) / 2;
  return (
    <g>
      <line x1="80" y1={midY} x2={POSTER_W - 80} y2={midY} stroke="var(--ink)" strokeWidth="1.5" strokeDasharray="2,10" opacity="0.5" />
      <rect x={POSTER_W / 2 - 190} y={midY - 18} width="380" height="36" rx="18" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.5" />
      <text x={POSTER_W / 2} y={midY + 5} textAnchor="middle" fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="800" fontSize="13" fill="var(--ink)" letterSpacing="1.5">⇆ TRANSFER AVAILABLE — R1 LOSERS</text>
    </g>
  );
}

function Footer() {
  const { POSTER_W, POSTER_H, FOOTER_Y0 } = window.LayoutConsts;
  return (
    <g>
      <line x1="80" y1={FOOTER_Y0 + 30} x2={POSTER_W - 80} y2={FOOTER_Y0 + 30} stroke="var(--ink)" strokeWidth="1.5" opacity="0.5" />
      <rect x="80" y={FOOTER_Y0 + 44} width="130" height="70" rx="8" fill="var(--ink)" />
      <foreignObject x="90" y={FOOTER_Y0 + 54} width="110" height="50">
        <img src={window.__resources?.logoRoyalPalms || 'assets/logo-royal-palms.webp'} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </foreignObject>
      <text x="230" y={FOOTER_Y0 + 62} fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="900" fontSize="14" fill="var(--ink)" letterSpacing="2.5">ROYAL PALMS SHUFFLEBOARD CLUB · 1750 N. MILWAUKEE AVE · CHICAGO IL</text>
      <text x="230" y={FOOTER_Y0 + 84} fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="600" fontSize="11" fill="var(--ink-dim)" letterSpacing="2">64 TEAMS · 4 REGIONS · WIN R1 → MAIN BRACKET · LOSE R1 → CONSOLATION</text>
      <text x={POSTER_W - 80} y={FOOTER_Y0 + 62} textAnchor="end" fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="900" fontSize="14" fill="var(--ink)" letterSpacing="2">LAST TRAIN TO THE LOOP</text>
      <text x={POSTER_W - 80} y={FOOTER_Y0 + 84} textAnchor="end" fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="600" fontSize="11" fill="var(--ink-dim)" letterSpacing="2">CHAMPIONSHIP DEPARTS SUNDAY 7PM · ROYAL PALMS</text>
    </g>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Poster />);
