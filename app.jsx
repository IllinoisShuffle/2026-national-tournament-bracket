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
  // results yet" (blank slots, TBD in the Final Four/Rankings) instead of
  // the mock demo teams, so a connected
  // backend's real data pops into an empty bracket rather than visibly
  // overwriting fake sample names. Only show the demo/mock bracket once
  // we've confirmed there's genuinely no backend to talk to.
  const useLiveShape = isLive || !liveChecked;

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
  const { bendPath, formatCourt } = window.LayoutHelpers;
  const { buildRegion } = window;

  const dark = t.theme === 'ink';
  const themeStyle = dark
    ? { '--paper': '#0E0E10', '--ink': '#F4EEDF', '--ink-dim': 'rgba(244,238,223,0.55)' }
    : { '--paper': '#F4EEDF', '--ink': '#15151A', '--ink-dim': 'rgba(21,21,26,0.55)' };

  // Assign teams to quarters (16 each), in leaf order. In live mode these
  // come straight from the M64 match rows (Yellow/Black); in demo mode they
  // come from the mock TEAM_POOL.
  const mainResolved = {};
  window.QUARTERS.forEach((q, idx) => {
    mainResolved[q.id] = useLiveShape
      ? window.LiveData.resolveRegion({ matches: liveMatches }, 'M', [64, 32, 16, 8], idx)
      : { leafNames: window.TEAM_POOL.slice(idx * 16, idx * 16 + 16), roundWinners: null };
  });
  const quarterTeams = {};
  window.QUARTERS.forEach((q) => { quarterTeams[q.id] = mainResolved[q.id].leafNames; });

  // Consolation leaves: in live mode these come straight from the C32 match
  // rows (the sheet is the source of truth for who dropped into consolation).
  // In demo mode, simulate them as the round-1 losers of the mock main bracket.
  const consolResolved = {};
  window.QUARTERS.forEach((q, idx) => {
    consolResolved[q.id] = useLiveShape
      ? window.LiveData.resolveRegion({ matches: liveMatches }, 'C', [32, 16, 8], idx)
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

  // A team's own score in one match record (by name, not by side, since the
  // sheet's yellow/black order isn't tied to our left/right layout). Returns
  // null until that match has a recorded winner — never a live/in-progress
  // guess.
  const scoreFor = (match, teamName) => {
    if (!match || !match.winner || !teamName || teamName === 'TBD') return null;
    if (match.yellow === teamName) return match.yellowScore || null;
    if (match.black === teamName) return match.blackScore || null;
    return null;
  };
  // A region's own champion name, straight from its resolved round data —
  // available before that region's geometry is built, so it can be used to
  // look up the champion's score in its next (semifinal) match up front.
  const champNameOf = (resolved) => {
    const rw = resolved.roundWinners;
    if (!rw || !rw.length) return null;
    const last = rw[rw.length - 1];
    return (last && last[0]) || null;
  };

  // M4-01/M4-02 = the two semifinal games (Left half: Blue+Red champs, Right
  // half: Pink+Green champs). M2-01 = final, M2-02 = 3rd place game. Resolved
  // up front (independent of region geometry) so each region can be told its
  // own champion's semifinal score/court when it's built below.
  const finalA = useLiveShape ? (liveMatches['M4-01'] || {}) : null;
  const finalB = useLiveShape ? (liveMatches['M4-02'] || {}) : null;
  const champMatch = useLiveShape ? (liveMatches['M2-01'] || {}) : null;
  const thirdMatch = useLiveShape ? (liveMatches['M2-02'] || {}) : null;
  const finalACourt = formatCourt(finalA?.court);
  const finalBCourt = formatCourt(finalB?.court);
  const champMatchCourt = formatCourt(champMatch?.court);
  const thirdMatchCourt = formatCourt(thirdMatch?.court);

  // ---------- MAIN BRACKET ----------
  const mainMidY = (MAIN_Y0 + MAIN_Y1) / 2;
  const MAIN_GAPS = [305, 295, 285, 255];
  const MAIN_HALF_GAP = 260;
  const regLT = buildRegion({ key: 'm-lt', quarter: qLT, teams: quarterTeams[qLT.id], x0: 100, gaps: MAIN_GAPS, dir: 1, y0: MAIN_Y0 + 68, y1: mainMidY - 10, style: 'train', showLabels: t.showTeamNames, showResults: t.showResults, slotNumbers: Array.from({length:16},(_,i)=>i+1), roundWinners: mainResolved[qLT.id].roundWinners, roundMatches: mainResolved[qLT.id].roundMatches, extraScore: scoreFor(finalA, champNameOf(mainResolved[qLT.id])) });
  const regLB = buildRegion({ key: 'm-lb', quarter: qLB, teams: quarterTeams[qLB.id], x0: 100, gaps: MAIN_GAPS, dir: 1, y0: mainMidY + 58, y1: MAIN_Y1 - 20, style: 'train', showLabels: t.showTeamNames, showResults: t.showResults, slotNumbers: Array.from({length:16},(_,i)=>i+17), roundWinners: mainResolved[qLB.id].roundWinners, roundMatches: mainResolved[qLB.id].roundMatches, extraScore: scoreFor(finalA, champNameOf(mainResolved[qLB.id])) });
  const regRT = buildRegion({ key: 'm-rt', quarter: qRT, teams: quarterTeams[qRT.id], x0: POSTER_W - 100, gaps: MAIN_GAPS, dir: -1, y0: MAIN_Y0 + 68, y1: mainMidY - 10, style: 'train', showLabels: t.showTeamNames, showResults: t.showResults, slotNumbers: Array.from({length:16},(_,i)=>i+33), roundWinners: mainResolved[qRT.id].roundWinners, roundMatches: mainResolved[qRT.id].roundMatches, extraScore: scoreFor(finalB, champNameOf(mainResolved[qRT.id])) });
  const regRB = buildRegion({ key: 'm-rb', quarter: qRB, teams: quarterTeams[qRB.id], x0: POSTER_W - 100, gaps: MAIN_GAPS, dir: -1, y0: mainMidY + 58, y1: MAIN_Y1 - 20, style: 'train', showLabels: t.showTeamNames, showResults: t.showResults, slotNumbers: Array.from({length:16},(_,i)=>i+49), roundWinners: mainResolved[qRB.id].roundWinners, roundMatches: mainResolved[qRB.id].roundMatches, extraScore: scoreFor(finalB, champNameOf(mainResolved[qRB.id])) });

  const mainGapSum = MAIN_GAPS.reduce((a, b) => a + b, 0);
  const leftHalfX = 100 + mainGapSum + MAIN_HALF_GAP;
  const rightHalfX = (POSTER_W - 100) - mainGapSum - MAIN_HALF_GAP;
  const leftHalfY = (regLT.champY + regLB.champY) / 2;
  const rightHalfY = (regRT.champY + regRB.champY) / 2;
  const champY = (leftHalfY + rightHalfY) / 2;

  const mainMerges = [
    <path key="m1" d={bendPath(regLT.champX, regLT.champY, leftHalfX, leftHalfY, 20)} stroke={qLT.color} strokeWidth="9" strokeLinecap="round" fill="none" />,
    <path key="m2" d={bendPath(regLB.champX, regLB.champY, leftHalfX, leftHalfY, 20)} stroke={qLB.color} strokeWidth="9" strokeLinecap="round" fill="none" />,
    <path key="m3" d={bendPath(regRT.champX, regRT.champY, rightHalfX, rightHalfY, 20)} stroke={qRT.color} strokeWidth="9" strokeLinecap="round" fill="none" />,
    <path key="m4" d={bendPath(regRB.champX, regRB.champY, rightHalfX, rightHalfY, 20)} stroke={qRB.color} strokeWidth="9" strokeLinecap="round" fill="none" />,
    ...window.twinBend('m5', leftHalfX, leftHalfY, CHAMPION_X, champY, qLT.color, qLB.color, 4.5),
    ...window.twinBend('m6', rightHalfX, rightHalfY, CHAMPION_X, champY, qRT.color, qRB.color, 4.5),
  ];

  const leftHalfWinner = useLiveShape ? (finalA.winner || 'TBD') : window.pickWinner(regLT.champTeam, regLB.champTeam);
  const rightHalfWinner = useLiveShape ? (finalB.winner || 'TBD') : window.pickWinner(regRT.champTeam, regRB.champTeam);
  const leftHalfLoser = useLiveShape ? (finalA.loser || 'TBD') : (leftHalfWinner === regLT.champTeam ? regLB.champTeam : regLT.champTeam);
  const rightHalfLoser = useLiveShape ? (finalB.loser || 'TBD') : (rightHalfWinner === regRT.champTeam ? regRB.champTeam : regRT.champTeam);
  const mainChampion = useLiveShape ? (champMatch.winner || 'TBD') : window.pickWinner(leftHalfWinner, rightHalfWinner);
  const runnerUp = useLiveShape ? (champMatch.loser || 'TBD') : (mainChampion === leftHalfWinner ? rightHalfWinner : leftHalfWinner);
  const thirdPlace = useLiveShape ? (thirdMatch.winner || 'TBD') : window.pickWinner(leftHalfLoser, rightHalfLoser);
  const fourthPlace = useLiveShape ? (thirdMatch.loser || 'TBD') : (thirdPlace === leftHalfLoser ? rightHalfLoser : leftHalfLoser);
  const thirdY = champY + 210;
  const thirdPlaceMerges = [
    ...window.twinDrop('tp1', leftHalfX + 15, leftHalfY, CHAMPION_X, thirdY, qLT.color, qLB.color, 4.5, '9,7'),
    ...window.twinDrop('tp2', rightHalfX - 15, rightHalfY, CHAMPION_X, thirdY, qRT.color, qRB.color, 4.5, '9,7'),
  ];
  const loopBounds = {
    x0: Math.min(regLT.champX, regLB.champX) - 45, x1: Math.max(regRT.champX, regRB.champX) + 45,
    y0: Math.min(regLT.champY, regRT.champY) - 55, y1: Math.max(regLB.champY, regRB.champY, thirdY) + 70,
  };

  // C4-01/C4-02 = the two consolation semifinal games. C2-01 = consolation
  // final, C2-02 = consolation 3rd place game. Resolved up front for the same
  // reason as finalA/finalB above.
  const cFinalA = useLiveShape ? (liveMatches['C4-01'] || {}) : null;
  const cFinalB = useLiveShape ? (liveMatches['C4-02'] || {}) : null;
  const cChampMatch = useLiveShape ? (liveMatches['C2-01'] || {}) : null;
  const cThirdMatch = useLiveShape ? (liveMatches['C2-02'] || {}) : null;
  const cFinalACourt = formatCourt(cFinalA?.court);
  const cFinalBCourt = formatCourt(cFinalB?.court);
  const cChampMatchCourt = formatCourt(cChampMatch?.court);
  const cThirdMatchCourt = formatCourt(cThirdMatch?.court);

  // ---------- CONSOLATION BRACKET ----------
  const consolMidY = (CONSOL_Y0 + CONSOL_Y1) / 2;
  const CONSOL_GAPS = [420, 400, 300];
  const CONSOL_HALF_GAP = 230;
  const cLT = buildRegion({ key: 'c-lt', quarter: qLT, teams: quarterConsolTeams[qLT.id], x0: 100, gaps: CONSOL_GAPS, dir: 1, y0: CONSOL_Y0 + 58, y1: consolMidY - 10, style: 'bus', showLabels: t.showTeamNames, showResults: t.showResults, roundWinners: consolResolved[qLT.id].roundWinners, roundMatches: consolResolved[qLT.id].roundMatches, extraScore: scoreFor(cFinalA, champNameOf(consolResolved[qLT.id])) });
  const cLB = buildRegion({ key: 'c-lb', quarter: qLB, teams: quarterConsolTeams[qLB.id], x0: 100, gaps: CONSOL_GAPS, dir: 1, y0: consolMidY + 68, y1: CONSOL_Y1 - 30, style: 'bus', showLabels: t.showTeamNames, showResults: t.showResults, roundWinners: consolResolved[qLB.id].roundWinners, roundMatches: consolResolved[qLB.id].roundMatches, extraScore: scoreFor(cFinalA, champNameOf(consolResolved[qLB.id])) });
  const cRT = buildRegion({ key: 'c-rt', quarter: qRT, teams: quarterConsolTeams[qRT.id], x0: POSTER_W - 100, gaps: CONSOL_GAPS, dir: -1, y0: CONSOL_Y0 + 58, y1: consolMidY - 10, style: 'bus', showLabels: t.showTeamNames, showResults: t.showResults, roundWinners: consolResolved[qRT.id].roundWinners, roundMatches: consolResolved[qRT.id].roundMatches, extraScore: scoreFor(cFinalB, champNameOf(consolResolved[qRT.id])) });
  const cRB = buildRegion({ key: 'c-rb', quarter: qRB, teams: quarterConsolTeams[qRB.id], x0: POSTER_W - 100, gaps: CONSOL_GAPS, dir: -1, y0: consolMidY + 68, y1: CONSOL_Y1 - 30, style: 'bus', showLabels: t.showTeamNames, showResults: t.showResults, roundWinners: consolResolved[qRB.id].roundWinners, roundMatches: consolResolved[qRB.id].roundMatches, extraScore: scoreFor(cFinalB, champNameOf(consolResolved[qRB.id])) });

  const consolGapSum = CONSOL_GAPS.reduce((a, b) => a + b, 0);
  const cLeftHalfX = 100 + consolGapSum + CONSOL_HALF_GAP;
  const cRightHalfX = (POSTER_W - 100) - consolGapSum - CONSOL_HALF_GAP;
  const cLeftHalfY = (cLT.champY + cLB.champY) / 2;
  const cRightHalfY = (cRT.champY + cRB.champY) / 2;
  const cChampY = (cLeftHalfY + cRightHalfY) / 2;

  const consolMerges = [
    <path key="c1" d={bendPath(cLT.champX, cLT.champY, cLeftHalfX, cLeftHalfY, 20)} stroke={qLT.color} strokeWidth="4.5" strokeDasharray="7,6" strokeLinecap="round" fill="none" />,
    <path key="c2" d={bendPath(cLB.champX, cLB.champY, cLeftHalfX, cLeftHalfY, 20)} stroke={qLB.color} strokeWidth="4.5" strokeDasharray="7,6" strokeLinecap="round" fill="none" />,
    <path key="c3" d={bendPath(cRT.champX, cRT.champY, cRightHalfX, cRightHalfY, 20)} stroke={qRT.color} strokeWidth="4.5" strokeDasharray="7,6" strokeLinecap="round" fill="none" />,
    <path key="c4" d={bendPath(cRB.champX, cRB.champY, cRightHalfX, cRightHalfY, 20)} stroke={qRB.color} strokeWidth="4.5" strokeDasharray="7,6" strokeLinecap="round" fill="none" />,
    ...window.twinBend('c5', cLeftHalfX, cLeftHalfY, CHAMPION_X, cChampY, qLT.color, qLB.color, 2.25, '7,6'),
    ...window.twinBend('c6', cRightHalfX, cRightHalfY, CHAMPION_X, cChampY, qRT.color, qRB.color, 2.25, '7,6'),
  ];

  const cLeftHalfWinner = useLiveShape ? (cFinalA.winner || 'TBD') : window.pickWinner(cLT.champTeam, cLB.champTeam);
  const cRightHalfWinner = useLiveShape ? (cFinalB.winner || 'TBD') : window.pickWinner(cRT.champTeam, cRB.champTeam);
  const cLeftHalfLoser = useLiveShape ? (cFinalA.loser || 'TBD') : (cLeftHalfWinner === cLT.champTeam ? cLB.champTeam : cLT.champTeam);
  const cRightHalfLoser = useLiveShape ? (cFinalB.loser || 'TBD') : (cRightHalfWinner === cRT.champTeam ? cRB.champTeam : cRT.champTeam);
  const consolChampion = useLiveShape ? (cChampMatch.winner || 'TBD') : window.pickWinner(cLeftHalfWinner, cRightHalfWinner);
  const consolRunnerUp = useLiveShape ? (cChampMatch.loser || 'TBD') : (consolChampion === cLeftHalfWinner ? cRightHalfWinner : cLeftHalfWinner);
  const consolThird = useLiveShape ? (cThirdMatch.winner || 'TBD') : window.pickWinner(cLeftHalfLoser, cRightHalfLoser);
  const consolFourth = useLiveShape ? (cThirdMatch.loser || 'TBD') : (consolThird === cLeftHalfLoser ? cRightHalfLoser : cLeftHalfLoser);
  const cThirdY = cChampY + 150;
  const consolThirdPlaceMerges = [
    ...window.twinDrop('ctp1', cLeftHalfX + 10, cLeftHalfY, CHAMPION_X, cThirdY, qLT.color, qLB.color, 2, '7,6', 12),
    ...window.twinDrop('ctp2', cRightHalfX - 10, cRightHalfY, CHAMPION_X, cThirdY, qRT.color, qRB.color, 2, '7,6', 12),
  ];

  // ---------- KIOSK / TV MODE ----------
  // Fixed regions (in poster coordinates) to auto-pan/zoom through when no
  // pointer is available to drive the view manually. Sized generously so
  // labels near the edges don't get clipped.
  const KIOSK_HOLD_MS = 9000;
  const busLabel = (a) => `${a.busNum} ${a.busName}`;

  // Same boundary math as the (drawn) main-bracket `loopBounds`, but for the
  // consolation bracket, which has no visible loop rect of its own.
  const consolLoopBounds = {
    x0: Math.min(cLT.champX, cLB.champX) - 45, x1: Math.max(cRT.champX, cRB.champX) + 45,
    y0: Math.min(cLT.champY, cRT.champY) - 55, y1: Math.max(cLB.champY, cRB.champY, cThirdY) + 70,
  };

  // Gate each "results" stop on how far the tournament has actually
  // progressed, so kiosk mode never dwells on an empty crop full of blank
  // placeholders. Demo mode (no live backend) has no blank-placeholder state, so
  // everything is always ready there.
  const mainLoopReady = !useLiveShape || [regLT, regLB, regRT, regRB].some((r) => r.champTeam !== '');
  const mainRankingsReady = !useLiveShape || [mainChampion, runnerUp, thirdPlace, fourthPlace].every((t) => t !== 'TBD');
  const consolFinalFourReady = !useLiveShape || [cLT, cLB, cRT, cRB].some((r) => r.champTeam !== '');
  const consolRankingsReady = !useLiveShape || [consolChampion, consolRunnerUp, consolThird, consolFourth].every((t) => t !== 'TBD');

  const kioskViews = [
    { label: 'FULL BRACKET', x0: 0, y0: 0, x1: POSTER_W, y1: POSTER_H },
    // One stop per quadrant (rather than a left-half/right-half pair) so a
    // projector crop reads clearly — cropping to each region's own champX
    // (where its train lines converge) instead of the full half-bracket
    // width roughly doubles the effective zoom vs. the old paired view.
    { label: `MAIN · ${qLT.name}`, x0: 20, y0: MAIN_Y0 - 50, x1: regLT.champX + 170, y1: mainMidY + 30 },
    { label: `MAIN · ${qLB.name}`, x0: 20, y0: mainMidY - 30, x1: regLB.champX + 170, y1: MAIN_Y1 + 20 },
    { label: `MAIN · ${qRT.name}`, x0: regRT.champX - 170, y0: MAIN_Y0 - 50, x1: POSTER_W - 20, y1: mainMidY + 30 },
    { label: `MAIN · ${qRB.name}`, x0: regRB.champX - 170, y0: mainMidY - 30, x1: POSTER_W - 20, y1: MAIN_Y1 + 20 },
    // Semifinals + final + 3rd place game, matching the drawn "loop" rect
    // plus room above for the championship matchup label, which sits above it.
    ...(mainLoopReady ? [{ label: 'MAIN · THE LOOP', x0: loopBounds.x0, y0: Math.min(loopBounds.y0, champY - 150), x1: loopBounds.x1, y1: loopBounds.y1 }] : []),
    // The FinalRanking block sits just below the loop, centered on CHAMPION_X.
    ...(mainRankingsReady ? [{ label: 'MAIN · FINAL RANKINGS', x0: CHAMPION_X - 380, y0: loopBounds.y1 - 20, x1: CHAMPION_X + 380, y1: loopBounds.y1 + 380 }] : []),
    { label: `CONSOLATION · ${busLabel(qLT)}`, x0: 20, y0: CONSOL_Y0 - 40, x1: cLT.champX + 150, y1: consolMidY + 30 },
    { label: `CONSOLATION · ${busLabel(qLB)}`, x0: 20, y0: consolMidY - 30, x1: cLB.champX + 150, y1: CONSOL_Y1 + 20 },
    { label: `CONSOLATION · ${busLabel(qRT)}`, x0: cRT.champX - 150, y0: CONSOL_Y0 - 40, x1: POSTER_W - 20, y1: consolMidY + 30 },
    { label: `CONSOLATION · ${busLabel(qRB)}`, x0: cRB.champX - 150, y0: consolMidY - 30, x1: POSTER_W - 20, y1: CONSOL_Y1 + 20 },
    ...(consolFinalFourReady ? [{ label: 'CONSOLATION · FINAL FOUR', x0: consolLoopBounds.x0, y0: Math.min(consolLoopBounds.y0, cChampY - 120), x1: consolLoopBounds.x1, y1: consolLoopBounds.y1 }] : []),
    ...(consolRankingsReady ? [{ label: 'CONSOLATION · FINAL RANKINGS', x0: CHAMPION_X - 320, y0: cThirdY + 20, x1: CHAMPION_X + 320, y1: cThirdY + 340 }] : []),
  ];

  // Views are gated behind *Ready flags that flip true as live results land,
  // which shifts where each view sits in the array. The rotation interval
  // below is only created once (it must not reset the visitor's dwell timer
  // on every render), so it reads this ref for the current length/order
  // instead of closing over the kioskViews snapshot from whenever it mounted
  // — otherwise the index can keep incrementing against a stale, shorter
  // length and never reach views (like consolation) that later slid past it.
  const kioskViewsRef = React.useRef(kioskViews);
  kioskViewsRef.current = kioskViews;

  React.useEffect(() => {
    if (!isKiosk) return;

    function tick() {
      setKioskIndex((i) => {
        const next = (i + 1) % kioskViewsRef.current.length;
        // Let an embedding page (e.g. the combined kiosk+scoreboard view) know
        // a full rotation just finished, since how many views that takes
        // varies as consolation sections come online — a fixed-duration timer
        // on the outside can't track that on its own.
        if (next === 0 && window.parent !== window) {
          window.parent.postMessage({ source: 'ilsa-kiosk', type: 'lap-complete' }, '*');
        }
        return next;
      });
    }

    let id = setInterval(tick, KIOSK_HOLD_MS);

    // A same-origin embedding page can call this directly to jump back to
    // the first view and restart the dwell timer from scratch — used when
    // it reveals this iframe after keeping it hidden (and running) behind
    // something else, so viewers see a fresh lap start rather than wherever
    // the rotation silently drifted to while off-screen.
    window.__ilsaKioskReset = function () {
      setKioskIndex(0);
      clearInterval(id);
      id = setInterval(tick, KIOSK_HOLD_MS);
    };

    return () => {
      clearInterval(id);
      delete window.__ilsaKioskReset;
    };
  }, [isKiosk]);

  // Reserve room at the bottom of the screen for the fixed kiosk-caption
  // pill (bottom: 26px, ~40px tall) so a bottom-row quadrant's champion
  // marker never renders directly underneath it.
  const KIOSK_CAPTION_SAFE_PX = 100;

  React.useEffect(() => {
    if (!isKiosk) return;
    function applyCamera() {
      const el = posterRef.current;
      if (!el || !el.offsetWidth || !el.offsetHeight) return;
      const view = kioskViews[kioskIndex % kioskViews.length];
      const frameW = el.offsetWidth, frameH = el.offsetHeight;
      const targetH = Math.max(frameH - KIOSK_CAPTION_SAFE_PX, frameH * 0.6);
      const targetAspect = frameW / targetH;

      // Pad the view's box (symmetrically, around its own center) so its
      // aspect ratio exactly matches the real screen's before computing a
      // single uniform zoom — this is what lets a stop fill the screen on
      // both axes with no letterboxing *and* no distortion. (A non-uniform
      // per-axis scale would fill the screen too, but squashes circles/text
      // to force-fit whatever the mismatch is — that's what made things look
      // "smushed".) Padding that extends past the poster's own 3300x3000
      // canvas just shows more of its plain paper background, which is
      // seamless since .poster's own background is that same color.
      const cx = (view.x0 + view.x1) / 2, cy = (view.y0 + view.y1) / 2;
      let w = view.x1 - view.x0, h = view.y1 - view.y0;
      if (w / h < targetAspect) w = h * targetAspect; else h = w / targetAspect;

      const F = 1.08; // slight overscan so content (and its text) reads larger on a projector
      // Matches the SVG's own default preserveAspectRatio="xMidYMid meet"
      // baseline fit of the 3300x3000 viewBox into the (now real-screen-
      // shaped) poster box, which our transform builds on top of.
      const meetK = Math.min(frameW / POSTER_W, frameH / POSTER_H);
      const z = F * frameW / (meetK * w);
      const x = -z * meetK * (cx - POSTER_W / 2);
      const y = -KIOSK_CAPTION_SAFE_PX / 2 - z * meetK * (cy - POSTER_H / 2);
      setKioskCam({ zoom: z, x, y });
    }
    applyCamera();
    window.addEventListener('resize', applyCamera);
    return () => window.removeEventListener('resize', applyCamera);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isKiosk, kioskIndex]);

  const posterTransform = isKiosk
    ? `translate(${kioskCam.x}px, ${kioskCam.y}px) scale(${kioskCam.zoom})`
    : `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;

  // QR overlay: only on the zoomed-out "FULL BRACKET" stop, since that's the
  // one moment there's screen room for it without covering results. Encoded
  // once per origin — the mobile bracket URL never changes mid-lap.
  const isFullBracketView = isKiosk && kioskViews[kioskIndex % kioskViews.length].label === 'FULL BRACKET';
  const mobileBracketUrl = React.useMemo(() => `${location.origin}/mobile-bracket`, []);
  const kioskQrDataUrl = React.useMemo(() => {
    const qr = window.qrcode(0, 'M');
    qr.addData(mobileBracketUrl);
    qr.make();
    return qr.createDataURL(8, 8);
  }, [mobileBracketUrl]);

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

      {isFullBracketView && (
        <div className="kiosk-qr">
          <img src={kioskQrDataUrl} alt="QR code to the mobile bracket" width="120" height="120" />
          <div className="kiosk-qr-text">
            <div className="kiosk-qr-kicker">FOLLOW ALONG</div>
            <div className="kiosk-qr-title">Scan for the bracket on your phone</div>
          </div>
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
          {t.showResults && finalACourt && (
            <text x={(regLT.champX + leftHalfX) / 2} y={leftHalfY - 15} textAnchor="middle" fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="700" fontSize="11" letterSpacing="0.8" fill="var(--ink-dim)">COURT {finalACourt}</text>
          )}
          {t.showResults && finalBCourt && (
            <text x={(regRT.champX + rightHalfX) / 2} y={rightHalfY - 15} textAnchor="middle" fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="700" fontSize="11" letterSpacing="0.8" fill="var(--ink-dim)">COURT {finalBCourt}</text>
          )}
          <ChampionNode x={CHAMPION_X} y={champY} label1="1ST" label2="PLACE" sub="" size={46} />

          <JunctionNode x={CHAMPION_X} y={thirdY} size={20} />
          {t.showResults && t.showTeamNames && (
            <>
              <MatchupLabel x={CHAMPION_X} bottomY={champY - 46 - 10} teamA={leftHalfWinner} teamB={rightHalfWinner} scoreA={scoreFor(champMatch, leftHalfWinner)} scoreB={scoreFor(champMatch, rightHalfWinner)} court={champMatchCourt} title="CHAMPIONSHIP GAME" />
              <MatchupLabel x={CHAMPION_X} bottomY={thirdY - 20 - 10} teamA={leftHalfLoser} teamB={rightHalfLoser} scoreA={scoreFor(thirdMatch, leftHalfLoser)} scoreB={scoreFor(thirdMatch, rightHalfLoser)} court={thirdMatchCourt} title="3RD PLACE GAME" />
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
          {t.showResults && cFinalACourt && (
            <text x={(cLT.champX + cLeftHalfX) / 2} y={cLeftHalfY - 12} textAnchor="middle" fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="700" fontSize="9" letterSpacing="0.8" fill="var(--ink-dim)">COURT {cFinalACourt}</text>
          )}
          {t.showResults && cFinalBCourt && (
            <text x={(cRT.champX + cRightHalfX) / 2} y={cRightHalfY - 12} textAnchor="middle" fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="700" fontSize="9" letterSpacing="0.8" fill="var(--ink-dim)">COURT {cFinalBCourt}</text>
          )}
          <ChampionNode x={CHAMPION_X} y={cChampY} label1="1ST" label2="PLACE" sub="" size={32} dashed />

          <JunctionNode x={CHAMPION_X} y={cThirdY} size={14} dashed />
          {t.showResults && t.showTeamNames && (
            <>
              <MatchupLabel x={CHAMPION_X} bottomY={cChampY - 32 - 8} teamA={cLeftHalfWinner} teamB={cRightHalfWinner} scoreA={scoreFor(cChampMatch, cLeftHalfWinner)} scoreB={scoreFor(cChampMatch, cRightHalfWinner)} court={cChampMatchCourt} title="CHAMPIONSHIP GAME" small />
              <MatchupLabel x={CHAMPION_X} bottomY={cThirdY - 14 - 8} teamA={cLeftHalfLoser} teamB={cRightHalfLoser} scoreA={scoreFor(cThirdMatch, cLeftHalfLoser)} scoreB={scoreFor(cThirdMatch, cRightHalfLoser)} court={cThirdMatchCourt} title="3RD PLACE GAME" small />
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
  const lineW = 50, lineH = 14, lineGap = 7, lineR = 4;
  const linesTotalW = window.QUARTERS.length * lineW + (window.QUARTERS.length - 1) * lineGap;
  const linesX0 = POSTER_W / 2 - linesTotalW / 2;
  return (
    <g>
      <foreignObject x={POSTER_W - 60 - 190} y="20" width="190" height="190">
        <img src={window.__resources?.logoIlsa || 'assets/logo-ilsa.png'} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </foreignObject>
      <foreignObject x="60" y="30" width="170" height="190">
        <img src={window.__resources?.logoChicago || 'assets/logo-chicago.png'} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </foreignObject>
      <text x={POSTER_W / 2} y="96" textAnchor="middle" fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="900" fontSize="52" fill="var(--ink)" letterSpacing="2">2026 CHICAGO NATIONAL</text>
      <text x={POSTER_W / 2} y="166" textAnchor="middle" fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="900" fontSize="70" fill="var(--ink)" letterSpacing="5">SHUFFLEBOARD TOURNAMENT</text>
      {window.QUARTERS.map((q, i) => (
        <rect key={q.id} x={linesX0 + i * (lineW + lineGap)} y="184" width={lineW} height={lineH} rx={lineR} fill={q.color} />
      ))}
      <text x={POSTER_W / 2} y="226" textAnchor="middle" fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="700" fontSize="19" fill="var(--ink-dim)" letterSpacing="5">{tagline} · ROYAL PALMS · CHICAGO IL · AUGUST 8–9 2026</text>
    </g>
  );
}

function TrainLogo({ x, y, size, color }) {
  const s = size / 67.2;
  return (
    <g transform={`translate(${x},${y}) scale(${s}) translate(-33.7,-666.1)`} fill={color}>
      <path fillRule="evenodd" clipRule="evenodd" d="M43.754,711.312l0.14,0.409l0.233,0.349l0.292,0.339l0.338,0.291l0.361,0.292l0.409,0.232l0.454,0.234l0.922,0.303l0.909,0.21l0.897,0.059l0.198-0.035l0.175-0.023l0.338-0.058v-6.601h1.819h2.473h9.119H63.1h9.178h2.624h1.399v6.658l0.338,0.082l0.374,0.034h0.104h0.315l0.467-0.058l0.908-0.175l0.922-0.351l0.466-0.198l0.396-0.269l0.373-0.279l0.339-0.292l0.292-0.339l0.231-0.349l0.141-0.408l0.081-0.396l2.007-18.716l-1.772-16.49l-0.151-0.757l-0.198-0.688l-0.257-0.642l-0.339-0.596l-0.431-0.559l-0.548-0.491l-0.63-0.432l-0.746-0.372l-0.969-0.433l-0.897-0.314l-0.104-0.035l-1.004-0.303l-1.003-0.292l-0.104-0.023l-1.936-0.384l-0.688-0.094l-1.341-0.198l-2.029-0.198l-2.041-0.116l-3.767-0.141l-0.268-0.011l-4.069,0.151l-2.041,0.116l-2.007,0.198l-1.002,0.152l-1.026,0.14l-1.003,0.175l-0.443,0.093l-0.56,0.14l-0.967,0.292l-0.806,0.245l-0.198,0.058l-1.004,0.35l-0.979,0.433l-0.746,0.372l-0.629,0.432l-0.537,0.491l-0.432,0.559l-0.35,0.596l-0.28,0.642l-0.176,0.688l-0.139,0.757l-1.772,16.454l1.994,18.693L43.754,711.312z M74.282,700.549l-0.126,0.373l-0.188,0.326l-0.245,0.291l-0.292,0.245l-0.349,0.187l-0.374,0.117l-0.432,0.046l-0.396-0.046l-0.386-0.117l-0.337-0.187l-0.327-0.245l-0.245-0.291l-0.186-0.326l-0.094-0.373l-0.058-0.408l0.058-0.408l0.094-0.362l0.186-0.361l0.245-0.292l0.327-0.245l0.337-0.185l0.386-0.105l0.396-0.059l0.432,0.059l0.374,0.105l0.349,0.185l0.292,0.245l0.245,0.292l0.188,0.361l0.126,0.362l0.035,0.408L74.282,700.549z M79.088,700.549l-0.116,0.373l-0.187,0.326l-0.245,0.291l-0.315,0.245l-0.314,0.187l-0.407,0.117l-0.386,0.046h-0.023l-0.396-0.046l-0.372-0.117l-0.352-0.187l-0.29-0.245l-0.27-0.291l-0.197-0.326l-0.094-0.373l-0.035-0.408l0.035-0.408l0.094-0.362l0.197-0.361l0.27-0.292l0.29-0.245l0.352-0.185l0.372-0.105l0.396-0.059h0.023l0.386,0.059l0.407,0.105l0.314,0.185l0.315,0.245l0.245,0.292l0.187,0.361l0.116,0.362l0.046,0.408L79.088,700.549z M69.012,676.363l0.035-0.245l0.095-0.268l0.139-0.246l0.198-0.245l0.175-0.187l0.223-0.162l0.232-0.106l0.21-0.034h1.959h2.624h2.216h0.537l0.384,0.058l0.233,0.083l0.245,0.128l0.269,0.221l0.21,0.279l0.162,0.339l0.082,0.433l1.505,15.159l0.046,0.513l-0.081,0.385l-0.163,0.269l-0.21,0.187l-0.245,0.105l-0.258,0.058l-0.43,0.023h-2.286h-2.216h-2.624H70.4l-0.315-0.105l-0.291-0.186l-0.222-0.187l-0.175-0.211l-0.256-0.466l-0.13-0.385V676.363z M58.797,673.437H63.1h4.315v29.351H63.1h-4.303V673.437z M50.868,700.525l-0.095,0.373l-0.197,0.35l-0.232,0.291l-0.305,0.245l-0.349,0.187l-0.362,0.117l-0.407,0.046h-0.013l-0.407-0.046l-0.386-0.117l-0.35-0.187l-0.292-0.245l-0.231-0.291l-0.188-0.35l-0.116-0.373l-0.047-0.408l0.047-0.396l0.116-0.386l0.188-0.349l0.231-0.293l0.292-0.256l0.35-0.175l0.386-0.14l0.407-0.023h0.013l0.407,0.023l0.362,0.14l0.349,0.175l0.305,0.256l0.232,0.293l0.197,0.349l0.095,0.386l0.058,0.396L50.868,700.525z M55.637,700.525l-0.105,0.373l-0.198,0.35l-0.232,0.291l-0.291,0.245l-0.327,0.187l-0.374,0.117l-0.396,0.046l-0.408-0.046l-0.373-0.117l-0.351-0.187l-0.291-0.245l-0.244-0.291l-0.175-0.35l-0.117-0.373l-0.023-0.408l0.023-0.396l0.117-0.386l0.175-0.349l0.244-0.293l0.291-0.256l0.351-0.175l0.373-0.14l0.408-0.023l0.396,0.023l0.374,0.14l0.327,0.175l0.291,0.256l0.232,0.293l0.198,0.349l0.105,0.386l0.047,0.396L55.637,700.525z M45.41,691.173l1.644-14.705l0.105-0.536l0.175-0.409l0.222-0.302l0.245-0.176l0.21-0.141l0.152-0.058l0.139-0.023h0.606h2.332h2.473h1.901l0.232,0.023l0.245,0.081l0.245,0.13l0.245,0.163l0.198,0.197l0.163,0.234l0.116,0.244l0.046,0.303v15.568l-0.104,0.291l-0.104,0.245l-0.164,0.187l-0.15,0.187l-0.222,0.141l-0.245,0.104l-0.561,0.187h-1.842H51.24h-2.332h-1.666l-0.352-0.023l-0.35-0.082l-0.349-0.15l-0.305-0.198l-0.232-0.269l-0.164-0.35l-0.104-0.409L45.41,691.173z"/>
      <rect x="54.669" y="712.268" width="16.734" height="2.449"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M81.269,726.623l-2.368-2.694h5.038l-2.565-2.787h-4.921l-1.364-1.632h-2.577l0.979,1.632H62.983H52.512l0.991-1.644l-2.508,0.012l-1.41,1.632h-5.41l-2.637,2.834h5.587l-2.31,2.647h-5.458l-3.626,3.999l5.621-0.01l-1.471,1.69h5.854l1.027-1.69l16.221-0.024l16.198-0.023l1.119,1.866h6.063l-1.644-1.878h5.177l-3.731-3.93H81.269z M62.983,726.623H49.177l1.61-2.658l12.196-0.013l12.197-0.011l1.622,2.682H62.983z"/>
      <rect x="51.124" y="708.104" width="2.297" height="10.764"/>
      <rect x="72.465" y="708.104" width="2.296" height="10.764"/>
    </g>
  );
}

function BusLogo({ x, y, size, color }) {
  const s = size / 61.1;
  return (
    <g transform={`translate(${x},${y}) scale(${s}) translate(-35.8,-521.3)`} fill={color}>
      <path d="M62.371,525.76c0.072,0,0.148,0.003,0.222,0.003s0.149-0.003,0.222-0.003H62.371z"/>
      <path d="M83.133,533.99c-0.614-3.071-2.579-4.3-5.528-5.528c-2.906-1.211-9.87-2.658-15.012-2.699c-5.142,0.041-12.105,1.488-15.012,2.699c-2.948,1.229-4.914,2.457-5.529,5.528l-2.211,17.026v23.46h3.808v3.68c0,4.486,6.565,4.486,6.565,0v-3.68h12.119h0.038h12.601v3.68c0,4.486,6.565,4.486,6.565,0v-3.68h3.808v-23.46L83.133,533.99z M53.231,530.059h9.14h9.583c1.843,0,1.843,2.765,0,2.765H62.35h-9.118C51.39,532.823,51.39,530.059,53.231,530.059z M46.935,567.122c-1.739,0-3.149-1.41-3.149-3.148c0-1.739,1.41-3.149,3.149-3.149c1.738,0,3.148,1.41,3.148,3.149C50.083,565.712,48.673,567.122,46.935,567.122z M62.371,552.811H45.669c-1.636,0-1.978-1.175-1.818-2.358l1.723-12.349c0.235-1.501,0.744-2.49,2.69-2.49H62.35h14.572c1.946,0,2.455,0.989,2.691,2.49l1.722,12.349c0.16,1.184-0.183,2.358-1.818,2.358H62.371z M78.252,567.122c-1.739,0-3.149-1.41-3.149-3.148c0-1.739,1.41-3.149,3.149-3.149c1.738,0,3.148,1.41,3.148,3.149C81.4,565.712,79.99,567.122,78.252,567.122z"/>
    </g>
  );
}

function QuarterLabel({ quarter, x, y, anchor, kind }) {
  const isTrain = kind === 'train';
  const w = isTrain ? 190 : 195, h = 34;
  const rectX = anchor === 'start' ? x - 4 : x - w + 4;
  const textX = rectX + 30 + (w - 30) / 2;
  return (
    <g>
      {isTrain ? (
        <>
          <rect x={rectX} y={y} width={w} height={h} rx="6" fill={quarter.color} />
          <TrainLogo x={rectX + 12} y={y + 6} size={22} color="#fff" />
          <text x={textX} y={y + 23} textAnchor="middle" fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="800" fontSize="16" letterSpacing="1.2" fill="#fff">{quarter.name}</text>
        </>
      ) : (
        <>
          <rect x={rectX} y={y} width={w} height={h} rx="6" fill="var(--paper)" stroke={quarter.color} strokeWidth="3" strokeDasharray="7,5" />
          <BusLogo x={rectX + 14} y={y + 6} size={22} color="var(--ink)" />
          <text x={textX} y={y + 23} textAnchor="middle" fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="800" fontSize="13" letterSpacing="0.6" fill="var(--ink)">{quarter.busNum} · {quarter.busName}</text>
        </>
      )}
    </g>
  );
}

function LoopBoundary({ x0, x1, y0, y1 }) {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const r = 56;
  const [qTL, qBL, qTR, qBR] = window.QUARTERS;
  return (
    <g opacity="0.85">
      <path d={`M ${cx} ${y0} L ${x0 + r} ${y0} A ${r} ${r} 0 0 0 ${x0} ${y0 + r} L ${x0} ${cy}`} fill="none" stroke={qTL.color} strokeWidth="2.5" strokeDasharray="3,11" strokeLinecap="round" />
      <path d={`M ${cx} ${y0} L ${x1 - r} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y0 + r} L ${x1} ${cy}`} fill="none" stroke={qTR.color} strokeWidth="2.5" strokeDasharray="3,11" strokeLinecap="round" />
      <path d={`M ${x1} ${cy} L ${x1} ${y1 - r} A ${r} ${r} 0 0 1 ${x1 - r} ${y1} L ${cx} ${y1}`} fill="none" stroke={qBR.color} strokeWidth="2.5" strokeDasharray="3,11" strokeLinecap="round" />
      <path d={`M ${x0} ${cy} L ${x0} ${y1 - r} A ${r} ${r} 0 0 0 ${x0 + r} ${y1} L ${cx} ${y1}`} fill="none" stroke={qBL.color} strokeWidth="2.5" strokeDasharray="3,11" strokeLinecap="round" />
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

function MatchupLabel({ x, bottomY, teamA, teamB, scoreA, scoreB, court, title, small }) {
  const lh = small ? 15 : 18;
  const fsTeam = small ? 12 : 15;
  const fsVs = small ? 8.5 : 10;
  const yB = bottomY;
  const yVs = yB - lh;
  const yA = yVs - lh;
  const yTitle = yA - (small ? 22 : 28);
  const yCourt = yTitle - (small ? 13 : 15);
  return (
    <g>
      {title && (
        <text x={x} y={yCourt} textAnchor="middle" fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="800" fontSize={small ? 10 : 12} letterSpacing="2" fill="var(--ink-dim)">{title}</text>
      )}
      {court && (
        <text x={x} y={yTitle} textAnchor="middle" fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="700" fontSize={small ? 9 : 10} letterSpacing="0.8" fill="var(--ink-dim)">COURT {court}</text>
      )}
      <text x={x} y={yA} textAnchor="middle" fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="800" fontSize={fsTeam} letterSpacing="0.3" fill="var(--ink)">{teamA}{scoreA != null && <tspan fontWeight="700" fill="var(--ink-dim)" dx="6">{scoreA}</tspan>}</text>
      <text x={x} y={yVs} textAnchor="middle" fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="700" fontSize={fsVs} letterSpacing="1.5" fill="var(--ink-dim)">VS</text>
      <text x={x} y={yB} textAnchor="middle" fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="800" fontSize={fsTeam} letterSpacing="0.3" fill="var(--ink)">{teamB}{scoreB != null && <tspan fontWeight="700" fill="var(--ink-dim)" dx="6">{scoreB}</tspan>}</text>
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
