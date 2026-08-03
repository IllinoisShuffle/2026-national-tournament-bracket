const PRINT_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "paper",
  "tagline": "ALL LINES LEAD TO THE LOOP"
}/*EDITMODE-END*/;

function PrintPoster() {
  const [t, setTweak] = window.useTweaks(PRINT_TWEAK_DEFAULTS);
  const {
    POSTER_W, POSTER_H, HEADER_H, MAIN_Y0, MAIN_Y1, DIVIDER_Y0, DIVIDER_Y1,
    CONSOL_Y0, CONSOL_Y1, FOOTER_Y0, CHAMPION_X,
  } = window.LayoutConsts;
  const { bendPath } = window.LayoutHelpers;

  const dark = t.theme === 'ink';
  const themeStyle = dark
    ? { '--paper': '#0E0E10', '--ink': '#F4EEDF', '--ink-dim': 'rgba(244,238,223,0.55)' }
    : { '--paper': '#F4EEDF', '--ink': '#15151A', '--ink-dim': 'rgba(21,21,26,0.55)' };

  const byPos = (side, pos) => window.QUARTERS.find(q => q.side === side && q.pos === pos);
  const qLT = byPos('L', 'top'), qLB = byPos('L', 'bottom'), qRT = byPos('R', 'top'), qRB = byPos('R', 'bottom');

  // ---------- MAIN BRACKET ----------
  const mainMidY = (MAIN_Y0 + MAIN_Y1) / 2;
  const MAIN_GAPS = [305, 295, 285, 255];
  const MAIN_HALF_GAP = 260;
  const regLT = window.buildRegionBlank({ key: 'm-lt', quarter: qLT, n: 16, x0: 100, gaps: MAIN_GAPS, dir: 1, y0: MAIN_Y0 + 68, y1: mainMidY - 10, style: 'train', showLabels: true, slotNumbers: Array.from({length:16},(_,i)=>i+1) });
  const regLB = window.buildRegionBlank({ key: 'm-lb', quarter: qLB, n: 16, x0: 100, gaps: MAIN_GAPS, dir: 1, y0: mainMidY + 58, y1: MAIN_Y1 - 20, style: 'train', showLabels: true, slotNumbers: Array.from({length:16},(_,i)=>i+17) });
  const regRT = window.buildRegionBlank({ key: 'm-rt', quarter: qRT, n: 16, x0: POSTER_W - 100, gaps: MAIN_GAPS, dir: -1, y0: MAIN_Y0 + 68, y1: mainMidY - 10, style: 'train', showLabels: true, slotNumbers: Array.from({length:16},(_,i)=>i+33) });
  const regRB = window.buildRegionBlank({ key: 'm-rb', quarter: qRB, n: 16, x0: POSTER_W - 100, gaps: MAIN_GAPS, dir: -1, y0: mainMidY + 58, y1: MAIN_Y1 - 20, style: 'train', showLabels: true, slotNumbers: Array.from({length:16},(_,i)=>i+49) });

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
  const thirdY = champY + 210;
  const thirdPlaceMerges = [
    ...window.twinDrop('tp1', leftHalfX + 15, leftHalfY, CHAMPION_X, thirdY, qLT.color, qLB.color, 4.5, '9,7'),
    ...window.twinDrop('tp2', rightHalfX - 15, rightHalfY, CHAMPION_X, thirdY, qRT.color, qRB.color, 4.5, '9,7'),
  ];
  const loopBounds = {
    x0: Math.min(regLT.champX, regLB.champX) - 45, x1: Math.max(regRT.champX, regRB.champX) + 45,
    y0: Math.min(regLT.champY, regRT.champY) - 55, y1: Math.max(regLB.champY, regRB.champY, thirdY) + 70,
  };

  // ---------- CONSOLATION BRACKET ----------
  const consolMidY = (CONSOL_Y0 + CONSOL_Y1) / 2;
  const CONSOL_GAPS = [420, 400, 300];
  const CONSOL_HALF_GAP = 230;
  const cLT = window.buildRegionBlank({ key: 'c-lt', quarter: qLT, n: 8, x0: 100, gaps: CONSOL_GAPS, dir: 1, y0: CONSOL_Y0 + 58, y1: consolMidY - 10, style: 'bus', showLabels: true });
  const cLB = window.buildRegionBlank({ key: 'c-lb', quarter: qLB, n: 8, x0: 100, gaps: CONSOL_GAPS, dir: 1, y0: consolMidY + 68, y1: CONSOL_Y1 - 30, style: 'bus', showLabels: true });
  const cRT = window.buildRegionBlank({ key: 'c-rt', quarter: qRT, n: 8, x0: POSTER_W - 100, gaps: CONSOL_GAPS, dir: -1, y0: CONSOL_Y0 + 58, y1: consolMidY - 10, style: 'bus', showLabels: true });
  const cRB = window.buildRegionBlank({ key: 'c-rb', quarter: qRB, n: 8, x0: POSTER_W - 100, gaps: CONSOL_GAPS, dir: -1, y0: consolMidY + 68, y1: CONSOL_Y1 - 30, style: 'bus', showLabels: true });

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
  const cThirdY = cChampY + 150;
  const consolThirdPlaceMerges = [
    ...window.twinDrop('ctp1', cLeftHalfX + 10, cLeftHalfY, CHAMPION_X, cThirdY, qLT.color, qLB.color, 2, '7,6', 12),
    ...window.twinDrop('ctp2', cRightHalfX - 10, cRightHalfY, CHAMPION_X, cThirdY, qRT.color, qRB.color, 2, '7,6', 12),
  ];

  return (
    <div className="poster-stage">
      <window.TweaksPanel>
        <window.TweakRadio label="Background" value={t.theme} options={['paper', 'ink']} onChange={(v) => setTweak('theme', v)} />
        <window.TweakText label="Tagline" value={t.tagline} onChange={(v) => setTweak('tagline', v)} />
      </window.TweaksPanel>

      <div className="poster" style={themeStyle} data-screen-label="Print Poster">
        <svg viewBox={`0 0 ${POSTER_W} ${POSTER_H}`} xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" className="poster-svg">
          <rect x="0" y="0" width={POSTER_W} height={POSTER_H} fill="var(--paper)" />
          <PrintHeader tagline={t.tagline} />
          <rect x="20" y="20" width={POSTER_W - 40} height={POSTER_H - 40} fill="none" stroke="var(--ink)" strokeWidth="3" rx="14" />

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
          <BlankMatchup x={CHAMPION_X} bottomY={champY - 46 - 10} title="CHAMPIONSHIP GAME" />
          <BlankMatchup x={CHAMPION_X} bottomY={thirdY - 20 - 10} title="3RD PLACE GAME" />

          <SectionLabel y={MAIN_Y0 - 30} text="MAIN BRACKET · SUBWAY" />

          <BlankFinalRanking y0={loopBounds.y1 + 15} />

          <Divider />

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
          <BlankMatchup x={CHAMPION_X} bottomY={cChampY - 32 - 8} title="CHAMPIONSHIP GAME" small />
          <BlankMatchup x={CHAMPION_X} bottomY={cThirdY - 14 - 8} title="3RD PLACE GAME" small />

          <SectionLabel y={CONSOL_Y0 - 8} text="CONSOLATION BRACKET · BUS ROUTES" />

          <BlankFinalRanking y0={cThirdY + 55} small />

          <PrintFooter />
        </svg>
      </div>
    </div>
  );
}

function PrintHeader({ tagline }) {
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
      <circle cx={x} cy={y} r="15" fill="var(--paper)" stroke={color} strokeWidth="3.5" />
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

function BlankMatchup({ x, bottomY, title, small }) {
  const lh = small ? 15 : 18;
  const w = small ? 90 : 120;
  const yB = bottomY;
  const yVs = yB - lh;
  const yA = yVs - lh;
  const yTitle = yA - (small ? 22 : 28);
  return (
    <g>
      <text x={x} y={yTitle} textAnchor="middle" fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="800" fontSize={small ? 10 : 12} letterSpacing="2" fill="var(--ink-dim)">{title}</text>
      <line x1={x - w / 2} y1={yA} x2={x + w / 2} y2={yA} stroke="var(--ink-dim)" strokeWidth="1.5" />
      <text x={x} y={yVs} textAnchor="middle" fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="700" fontSize={small ? 8.5 : 10} letterSpacing="1.5" fill="var(--ink-dim)">VS</text>
      <line x1={x - w / 2} y1={yB} x2={x + w / 2} y2={yB} stroke="var(--ink-dim)" strokeWidth="1.5" />
    </g>
  );
}

function BlankFinalRanking({ y0, small }) {
  const { POSTER_W } = window.LayoutConsts;
  const slots = [
    { rank: '1ST', label: 'CHAMPION' }, { rank: '2ND', label: 'RUNNER-UP' },
    { rank: '3RD', label: 'THIRD PLACE' }, { rank: '4TH', label: 'FOURTH PLACE' },
  ];
  const pitch = small ? 56 : 76;
  const r = small ? 11 : 14;
  const listTop = y0 + (small ? 32 : 44);
  const cx = POSTER_W / 2;
  const w = small ? 200 : 260;
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
            <line x1={cx - w / 2} y1={rowY + r + (small ? 24 : 30)} x2={cx + w / 2} y2={rowY + r + (small ? 24 : 30)} stroke="var(--ink-dim)" strokeWidth="1.5" />
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

function PrintFooter() {
  const { POSTER_W, FOOTER_Y0 } = window.LayoutConsts;
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

ReactDOM.createRoot(document.getElementById('root')).render(<PrintPoster />);
