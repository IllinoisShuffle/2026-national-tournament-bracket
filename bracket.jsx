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

// Deterministic score generator — race-to-15, loser margin derived from the same
// hash so scores stay stable across re-renders and agree with pickWinner's
// outcome. Demo mode only (no live backend); live mode uses the sheet's scores.
function pickScore(a, b) {
  let h = 0;
  for (let i = 0; i < a.length; i++) h = (h * 31 + a.charCodeAt(i)) | 0;
  for (let i = 0; i < b.length; i++) h = (h * 17 + b.charCodeAt(i)) | 0;
  const loserScore = Math.abs(h >> 3) % 12; // 0-11
  return { winnerScore: 15, loserScore };
}
window.pickScore = pickScore;

// Deterministic court assignment (1-10). Demo mode only.
function pickCourt(a, b) {
  let h = 0;
  for (let i = 0; i < a.length; i++) h = (h * 13 + a.charCodeAt(i)) | 0;
  for (let i = 0; i < b.length; i++) h = (h * 7 + b.charCodeAt(i)) | 0;
  return (Math.abs(h) % 10) + 1;
}
window.pickCourt = pickCourt;

function buildRegion({ key, quarter, teams, x0, gaps, dir, y0, y1, style, showLabels, showResults, slotNumbers, roundWinners, roundMatches, extraScore }) {
  const { bendPath, nextRoundYs } = window.LayoutHelpers;
  const N = teams.length;
  const S = Math.log2(N);
  const leafYs = teams.map((_, i) => y0 + (i + 0.5) * ((y1 - y0) / N));
  const roundYs = [leafYs];
  for (let s = 1; s <= S; s++) roundYs.push(nextRoundYs(roundYs[s - 1]));
  const xs = [x0];
  for (let s = 1; s <= S; s++) xs.push(xs[s - 1] + dir * gaps[s - 1]);

  // Winners + per-match final scores/courts, round by round. When `roundWinners`
  // is supplied (live mode) each match uses the real recorded winner/score/court
  // from the sheet, or blanks if not decided yet — never a simulated guess.
  // Without it (demo mode, no backend configured) fall back to deterministic
  // mock picks so the poster still looks populated.
  const roundTeams = [teams];
  const matchRecords = []; // matchRecords[s-1][j] = the round-`s` match producing roundTeams[s][j]
  for (let s = 1; s <= S; s++) {
    const prev = roundTeams[s - 1];
    const liveWinners = roundWinners && roundWinners[s - 1];
    const liveMatches = roundMatches && roundMatches[s - 1];
    const cur = [];
    const recs = [];
    for (let j = 0, k = 0; j < prev.length; j += 2, k++) {
      const a = prev[j], b = prev[j + 1];
      if (roundWinners) {
        const winner = (liveWinners && liveWinners[k]) || null;
        const m = (liveMatches && liveMatches[k]) || {};
        cur.push(winner || 'TBD');
        // aScore/bScore keyed by slot position (a = top/prev[j], b = bottom/prev[j+1]),
        // matched against the sheet's yellow/black names rather than assumed order.
        recs.push({
          winner,
          aScore: m.yellow === a ? (m.yellowScore || null) : (m.black === a ? (m.blackScore || null) : null),
          bScore: m.yellow === b ? (m.yellowScore || null) : (m.black === b ? (m.blackScore || null) : null),
          court: m.court || null,
        });
      } else {
        const winner = pickWinner(a, b);
        const score = pickScore(a, b);
        cur.push(winner);
        recs.push({
          winner,
          aScore: winner === a ? score.winnerScore : score.loserScore,
          bScore: winner === b ? score.winnerScore : score.loserScore,
          court: pickCourt(a, b),
        });
      }
    }
    roundTeams.push(cur);
    matchRecords.push(recs);
  }

  // Each node (leaf = round 0 .. round S-1) shows the score IT earned in the
  // match immediately following it — its own winning score if it advanced, its
  // own losing score if it was eliminated there. The champion node (s === S)
  // shows nothing by default; callers can supply `extraScore` for the score it
  // went on to earn in its next match, which lives outside this region (e.g.
  // the semifinal).
  function nodeScore(s, i) {
    if (s === S) return extraScore != null ? extraScore : null;
    const rec = matchRecords[s][Math.floor(i / 2)];
    if (!rec || !rec.winner) return null;
    return i % 2 === 0 ? rec.aScore : rec.bScore;
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

  // Court assignment per match, every round — sits in the gap between the two
  // source lines feeding into that round's node, before they bend together.
  const courtLabels = [];
  for (let s = 1; s <= S; s++) {
    const isLastRound = s === S;
    const cx = xs[s - 1] + dir * (isLastRound ? Math.min(gaps[s - 1] * 0.6, 200) : Math.min(gaps[s - 1] * 0.82, 250));
    const recs = matchRecords[s - 1];
    for (let j = 0; j < roundYs[s].length; j++) {
      const yTop = roundYs[s - 1][2 * j], yBot = roundYs[s - 1][2 * j + 1];
      const court = recs[j] && recs[j].court;
      if (court) courtLabels.push({ x: cx, y: (yTop + yBot) / 2, court });
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
      {showResults && showLabels && courtLabels.map((c, idx) => (
        <text key={`ct-${idx}`} x={c.x} y={c.y + 3.5} textAnchor="middle"
          fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="700"
          fontSize="9.5" letterSpacing="0.8" fill={color}>COURT {c.court}</text>
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
              {dir === -1 && showResults && nodeScore(0, i) != null ? (<tspan fontWeight="800" fill={color}>{nodeScore(0, i)}</tspan>) : null}
              <tspan dx={showResults && nodeScore(0, i) != null ? '6' : '0'}>{teams[i]}</tspan>
              {dir === 1 && showResults && nodeScore(0, i) != null ? (<tspan fontWeight="800" fill={color} dx="6">{nodeScore(0, i)}</tspan>) : null}
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
          const score = nodeScore(s, j);
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
                  {dir === -1 && score != null ? (<tspan fontWeight="700" fill={color}>{score}</tspan>) : null}
                  <tspan dx={dir === -1 && score != null ? '6' : '0'}>{winnerName}</tspan>
                  {dir === 1 && score != null ? (<tspan fontWeight="700" fill={color} dx="6">{score}</tspan>) : null}
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

// Twin tandem lines: splits one merge line into two adjacent half-width colored strands.
// "bend" = horizontal-first elbow (region -> half junction, half -> champion); offset applied vertically.
function twinBend(key, x1, y1, x2, y2, colorA, colorB, width, dash, radius = 20) {
  const { bendPath } = window.LayoutHelpers;
  const d = bendPath(x1, y1, x2, y2, radius);
  const off = width / 2 + 0.4;
  return [
    <path key={key + 'a'} d={d} stroke={colorA} strokeWidth={width} strokeDasharray={dash} strokeLinecap="round" fill="none" transform={`translate(0,${-off})`} />,
    <path key={key + 'b'} d={d} stroke={colorB} strokeWidth={width} strokeDasharray={dash} strokeLinecap="round" fill="none" transform={`translate(0,${off})`} />,
  ];
}
// "drop" = vertical-first elbow (used for 3rd-place lines). Offsets the vertical run
// sideways and the final horizontal run up/down, so the two strands stay a consistent
// parallel distance apart all the way around the corner instead of just shifting as a block.
function twinDrop(key, x1, y1, x2, y2, colorA, colorB, width, dash, radius = 16) {
  const dx = Math.sign(x2 - x1) || 1;
  const off = width / 2 + 0.4;
  // sign=-1/+1 = consistent left/right side of travel direction (not raw x/y sign),
  // so the two strands stay parallel through the corner regardless of which way it bends.
  const strand = (sign) => {
    const xOff = sign * off;
    const yOff = -dx * sign * off;
    const sx = x1 + xOff, sy2 = y2 + yOff;
    return `M ${sx} ${y1} L ${sx} ${sy2 - radius} Q ${sx} ${sy2} ${sx + dx * radius} ${sy2} L ${x2} ${sy2}`;
  };
  // Assign colorA to strand(dx) so it always lands on the same visual side (top)
  // regardless of which half of the bracket we're on, matching twinBend's convention.
  return [
    <path key={key + 'a'} d={strand(dx)} stroke={colorA} strokeWidth={width} strokeDasharray={dash} strokeLinecap="round" fill="none" />,
    <path key={key + 'b'} d={strand(-dx)} stroke={colorB} strokeWidth={width} strokeDasharray={dash} strokeLinecap="round" fill="none" />,
  ];
}

window.buildRegion = buildRegion;
window.mergeConnector = mergeConnector;
window.twinBend = twinBend;
window.twinDrop = twinDrop;
