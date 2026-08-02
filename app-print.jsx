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
