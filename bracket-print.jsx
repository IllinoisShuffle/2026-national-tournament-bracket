// Blank region builder for the fill-in-by-hand print poster.
// Same geometry as buildRegion but draws blank write-in lines instead of computed team text.

function blankLine(x, y, w, isTrain, dir) {
  const x1 = dir === 1 ? x : x - w;
  const x2 = dir === 1 ? x + w : x;
  return <line x1={x1} y1={y} x2={x2} y2={y} stroke="var(--ink-dim)" strokeWidth="1.5" />;
}

function buildRegionBlank({ key, quarter, n, x0, gaps, dir, y0, y1, style, showLabels, slotNumbers }) {
  const { bendPath, nextRoundYs } = window.LayoutHelpers;
  const N = n;
  const S = Math.log2(N);
  const leafYs = Array.from({ length: N }, (_, i) => y0 + (i + 0.5) * ((y1 - y0) / N));
  const roundYs = [leafYs];
  for (let s = 1; s <= S; s++) roundYs.push(nextRoundYs(roundYs[s - 1]));
  const xs = [x0];
  for (let s = 1; s <= S; s++) xs.push(xs[s - 1] + dir * gaps[s - 1]);

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

  const labelDx = dir === 1 ? 14 : -14;
  const lineW2 = dir === 1 ? 118 : -118;

  const el = (
    <g key={key} className={`region region-${quarter.id}`}>
      {connectors.map(([x1, y1_, x2, y2_], i) => (
        <path key={i} d={bendPath(x1, y1_, x2, y2_, 14)} stroke={color} strokeWidth={lineW}
          strokeDasharray={dash} strokeLinecap="round" fill="none" opacity={isTrain ? 1 : 0.9} />
      ))}
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
              fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="900" fontSize="12" fill={color}>{slotNumbers[i]}</text>
          )}
        </g>
      ))}
      {roundYs.slice(1).map((ys, si) => {
        const s = si + 1;
        return ys.map((y, j) => {
          const isChamp = s === S;
          const r = isChamp ? 15 : (isTrain ? 8 : 6);
          return (
            <g key={`s${s}-${j}`}>
              <circle cx={xs[s]} cy={y} r={r + 4} fill="var(--paper)" />
              <circle cx={xs[s]} cy={y} r={r} fill="var(--paper)" stroke={color} strokeWidth="3" />
            </g>
          );
        });
      })}
    </g>
  );

  return { element: el, champX: xs[S], champY: roundYs[S][0] };
}

window.buildRegionBlank = buildRegionBlank;
