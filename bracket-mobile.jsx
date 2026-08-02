// Vertical bracket builder for mobile — rounds stack top-to-bottom instead of left-to-right.
function pickWinner(a, b) {
  let h = 0;
  for (let i = 0; i < a.length; i++) h = (h * 31 + a.charCodeAt(i)) | 0;
  for (let i = 0; i < b.length; i++) h = (h * 17 + b.charCodeAt(i)) | 0;
  return (h & 1) === 0 ? a : b;
}
window.pickWinnerM = pickWinner;

// Real team names run longer than the mock "TEAM 01" placeholders these
// vertical labels were tuned for. Truncate defensively instead of letting
// the SVG hard-clip long names at the top of the region card.
function truncateLabel(s, max = 16) {
  if (!s) return s;
  return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;
}

function bendPathV(x1, y1, x2, y2, radius = 10) {
  if (x1 === x2) return `M ${x1} ${y1} L ${x2} ${y2}`;
  const dx = Math.sign(x2 - x1);
  const r = Math.min(radius, Math.abs(y2 - y1) / 2 || radius);
  return `M ${x1} ${y1} L ${x1} ${y2 - r} Q ${x1} ${y2} ${x1 + dx * r} ${y2} L ${x2} ${y2}`;
}

// Builds a vertical region: N leaves at top, converging to 1 champion at bottom.
// Progress through the region is shown by filling in each line/node as the
// round it represents gets an actual recorded result — everything ahead of
// that point stays outlined until the bracket catches up.
function buildRegionV({ quarter, teams, y0, gaps, x0, x1, style, showLabels, showResults, slotNumbers, roundWinners }) {
  const N = teams.length;
  const S = Math.log2(N);
  const leafXs = teams.map((_, i) => x0 + (i + 0.5) * ((x1 - x0) / N));
  const nextXs = (xs) => { const out = []; for (let i = 0; i < xs.length; i += 2) out.push((xs[i] + xs[i + 1]) / 2); return out; };
  const roundXs = [leafXs];
  for (let s = 1; s <= S; s++) roundXs.push(nextXs(roundXs[s - 1]));
  const ys = [y0];
  for (let s = 1; s <= S; s++) ys.push(ys[s - 1] + gaps[s - 1]);

  // See bracket.jsx buildRegion for the live-vs-demo winner logic this mirrors.
  // roundDecided[s-1][k] is true once round s's k-th match has an actual
  // recorded winner (live mode), or true everywhere in demo mode — with no
  // backend configured the mock bracket is shown fully played out.
  const roundTeams = [teams];
  const roundDecided = [];
  for (let s = 1; s <= S; s++) {
    const prev = roundTeams[s - 1];
    const liveRound = roundWinners && roundWinners[s - 1];
    const cur = [];
    const decided = [];
    for (let j = 0, k = 0; j < prev.length; j += 2, k++) {
      const live = liveRound && liveRound[k];
      cur.push(live || (roundWinners ? 'TBD' : pickWinner(prev[j], prev[j + 1])));
      decided.push(roundWinners ? !!live : true);
    }
    roundTeams.push(cur);
    roundDecided.push(decided);
  }

  const isTrain = style === 'train';
  const lineW = isTrain ? 6 : 3.5;
  const dash = isTrain ? undefined : '7,6';
  const color = quarter.color;

  const connectors = [];
  for (let s = 1; s <= S; s++) {
    for (let j = 0; j < roundXs[s].length; j++) {
      const leftIsWinner = roundTeams[s - 1][2 * j] === roundTeams[s][j];
      const decided = roundDecided[s - 1][j];
      connectors.push([roundXs[s - 1][2 * j], ys[s - 1], roundXs[s][j], ys[s], leftIsWinner && decided]);
      connectors.push([roundXs[s - 1][2 * j + 1], ys[s - 1], roundXs[s][j], ys[s], !leftIsWinner && decided]);
    }
  }

  const el = (
    <g className={`region-v region-${quarter.id}`}>
      {connectors.map(([x1_, y1_, x2_, y2_, filled], i) => {
        const d = bendPathV(x1_, y1_, x2_, y2_, 10);
        if (filled) {
          return <path key={i} d={d} stroke={color} strokeWidth={lineW} strokeDasharray={dash} strokeLinecap="round" fill="none" />;
        }
        return (
          <g key={i}>
            <path d={d} stroke={color} strokeWidth={lineW} strokeDasharray={dash} strokeLinecap="round" fill="none" strokeOpacity="0.3" />
            <path d={d} stroke="var(--paper)" strokeWidth={lineW - 3} strokeDasharray={dash} strokeLinecap="round" fill="none" />
          </g>
        );
      })}
      {leafXs.map((x, i) => {
        const leafWon = roundDecided[0][Math.floor(i / 2)] && roundTeams[1][Math.floor(i / 2)] === teams[i];
        return (
          <g key={`leaf-${i}`}>
            {isTrain ? (
              <>
                <circle cx={x} cy={y0} r="7" fill="var(--paper)" />
                <circle cx={x} cy={y0} r="5" fill={leafWon ? color : 'var(--paper)'} stroke={color} strokeWidth={leafWon ? 2 : 1.5} strokeOpacity={leafWon ? 1 : 0.35} />
              </>
            ) : (
              <rect x={x - 5} y={y0 - 5} width="10" height="10" fill={leafWon ? color : 'var(--paper)'} stroke={color} strokeWidth={leafWon ? 2 : 1.5} strokeOpacity={leafWon ? 1 : 0.35} />
            )}
            {slotNumbers && (
              <text x={x - 11} y={y0 + 3} textAnchor="end" fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="900" fontSize="9" fill={color}>{slotNumbers[i]}</text>
            )}
            {showLabels && (
              <text transform={`translate(${x}, ${y0 - 14}) rotate(-90)`} textAnchor="start"
                fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="700" fontSize="9" fill="var(--ink)">
                {truncateLabel(teams[i], 25)}
              </text>
            )}
          </g>
        );
      })}
      {roundXs.slice(1).map((xs, si) => {
        const s = si + 1;
        const isChamp = s === S;
        return xs.map((x, j) => {
          const r = isChamp ? 11 : (isTrain ? 6 : 5);
          // Non-final nodes light up once the *next* round confirms this team
          // advanced through them — otherwise a node would fill in while the
          // outgoing line past it is still outlined, which reads as broken.
          const decided = isChamp
            ? roundDecided[s - 1][j]
            : (roundDecided[s][Math.floor(j / 2)] && roundTeams[s][j] === roundTeams[s + 1][Math.floor(j / 2)]);
          const fillColor = decided ? color : 'var(--paper)';
          const strokeColor = decided ? 'var(--paper)' : color;
          const strokeW = decided ? 2 : 1.5;
          const strokeOp = decided ? 1 : 0.35;
          if (isTrain) {
            return (
              <g key={`s${s}-${j}`}>
                <circle cx={x} cy={ys[s]} r={r + 3} fill="var(--paper)" />
                <circle cx={x} cy={ys[s]} r={r} fill={fillColor} stroke={strokeColor} strokeWidth={strokeW} strokeOpacity={strokeOp} />
              </g>
            );
          }
          return (
            <g key={`s${s}-${j}`}>
              <rect x={x - r - 3} y={ys[s] - r - 3} width={(r + 3) * 2} height={(r + 3) * 2} fill="var(--paper)" />
              <rect x={x - r} y={ys[s] - r} width={r * 2} height={r * 2} fill={fillColor} stroke={strokeColor} strokeWidth={strokeW} strokeOpacity={strokeOp} />
            </g>
          );
        });
      })}
    </g>
  );

  return { element: el, champX: roundXs[S][0], champY: ys[S], champTeam: roundTeams[S][0] };
}

window.buildRegionV = buildRegionV;
window.bendPathV = bendPathV;
