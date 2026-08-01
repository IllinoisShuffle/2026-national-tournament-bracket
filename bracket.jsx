// Region + connector builders — plain functions (not components) so callers can
// read back champion coordinates for further connections.

// Deterministic "coin flip" advance — same inputs always produce the same winner,
// so the mock bracket looks consistent across re-renders.
function pickWinner(a, b) {
  let h = 0;
  for (let i = 0; i < a.length; i++) h = (h * 31 + a.charCodeAt(i)) | 0;
  for (let i = 0; i < b.length; i++) h = (h * 17 + b.charCodeAt(i)) | 0;
  return (h & 1) === 0 ? a : b;
}
window.pickWinner = pickWinner;

function buildRegion({ key, quarter, teams, x0, gaps, dir, y0, y1, style, showLabels, showResults, slotNumbers }) {
  const { bendPath, nextRoundYs } = window.LayoutHelpers;
  const N = teams.length;
  const S = Math.log2(N);
  const leafYs = teams.map((_, i) => y0 + (i + 0.5) * ((y1 - y0) / N));
  const roundYs = [leafYs];
  for (let s = 1; s <= S; s++) roundYs.push(nextRoundYs(roundYs[s - 1]));
  const xs = [x0];
  for (let s = 1; s <= S; s++) xs.push(xs[s - 1] + dir * gaps[s - 1]);

  // Simulate winners round by round
  const roundTeams = [teams];
  for (let s = 1; s <= S; s++) {
    const prev = roundTeams[s - 1];
    const cur = [];
    for (let j = 0; j < prev.length; j += 2) cur.push(pickWinner(prev[j], prev[j + 1]));
    roundTeams.push(cur);
  }

  const isTrain = style === 'train';
  const lineW = isTrain ? 9 : 4.5;
  const dash = isTrain ? undefined : '9,7';
  const color = quarter.color;

  const connectors = [];
  for (let s = 1; s <= S; s++) {
    for (let j = 0; j < roundYs[s].length; j++) {
      connectors.push([xs[s - 1], roundYs[s - 1][2 * j], xs[s], roundYs[s][j]]);
      connectors.push([xs[s - 1], roundYs[s - 1][2 * j + 1], xs[s], roundYs[s][j]]);
    }
  }

  const labelAnchor = dir === 1 ? 'start' : 'end';
  const labelDx = dir === 1 ? 14 : -14;

  const el = (
    <g key={key} className={`region region-${quarter.id}`}>
      {connectors.map(([x1, y1_, x2, y2_], i) => (
        <path key={i} d={bendPath(x1, y1_, x2, y2_, 14)} stroke={color} strokeWidth={lineW}
          strokeDasharray={dash} strokeLinecap="round" fill="none" opacity={isTrain ? 1 : 0.9} />
      ))}
      {/* leaf stations */}
      {leafYs.map((y, i) => (
        <g key={`leaf-${i}`}>
          {isTrain ? (
            <>
              <circle cx={xs[0]} cy={y} r="9" fill="var(--paper)" />
              <circle cx={xs[0]} cy={y} r="6.5" fill="var(--paper)" stroke={color} strokeWidth="3.5" />
            </>
          ) : (
            <rect x={xs[0] - 6} y={y - 6} width="12" height="12" fill="var(--paper)" stroke={color} strokeWidth="3" />
          )}
          {slotNumbers && (
            <text x={xs[0] - dir * 20} y={y + 4} textAnchor={dir === 1 ? 'end' : 'start'}
              fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="900"
              fontSize="12" fill={color}>{slotNumbers[i]}</text>
          )}
          {showLabels && (
            <text x={xs[0] + labelDx} y={y - 10} textAnchor={labelAnchor}
              fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="700"
              fontSize={isTrain ? 13 : 11.5} letterSpacing="0.2" fill="var(--ink)">
              {teams[i]}
            </text>
          )}
        </g>
      ))}
      {/* intermediate + champion stations */}
      {roundYs.slice(1).map((ys, si) => {
        const s = si + 1;
        return ys.map((y, j) => {
          const isChamp = s === S;
          const r = isChamp ? 15 : (isTrain ? 8 : 6);
          const winnerName = roundTeams[s][j];
          return (
            <g key={`s${s}-${j}`}>
              <circle cx={xs[s]} cy={y} r={r + 4} fill="var(--paper)" />
              <circle cx={xs[s]} cy={y} r={r} fill={isChamp ? color : 'var(--paper)'}
                stroke={color} strokeWidth={isChamp ? 3 : 3} />
              {isChamp && (
                <text x={xs[s]} y={y + 4} textAnchor="middle" fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
                  fontWeight="900" fontSize="11" fill="#fff">{isTrain ? 'W' : 'W'}</text>
              )}
              {showResults && showLabels && (
                <text x={xs[s] + labelDx} y={y - (isChamp ? 20 : 12)} textAnchor={labelAnchor}
                  fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="800"
                  fontSize={isChamp ? 13 : (isTrain ? 12 : 10.5)} letterSpacing="0.2" fill="var(--ink)">
                  {winnerName}
                </text>
              )}
            </g>
          );
        });
      })}
    </g>
  );

  return { element: el, champX: xs[S], champY: roundYs[S][0], champTeam: roundTeams[S][0] };
}

// Connect two champion points with a bend path (used for half-champ + final merges)
function mergeConnector(key, x1, y1, x2, y2, color, style) {
  const { bendPath } = window.LayoutHelpers;
  const isTrain = style === 'train';
  return (
    <path key={key} d={bendPath(x1, y1, x2, y2, 20)} stroke={color} strokeWidth={isTrain ? 9 : 4.5}
      strokeDasharray={isTrain ? undefined : '9,7'} strokeLinecap="round" fill="none" />
  );
}

window.buildRegion = buildRegion;
window.mergeConnector = mergeConnector;
