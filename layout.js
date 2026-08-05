const POSTER_W = 3300;
const POSTER_H = 3000;

const HEADER_H = 280;
const MAIN_Y0 = 280, MAIN_Y1 = 1600;
const DIVIDER_Y0 = 1760, DIVIDER_Y1 = 1860;
const CONSOL_Y0 = 1860, CONSOL_Y1 = 2775;
const FOOTER_Y0 = 2775;

const CHAMPION_X = POSTER_W / 2; // 1000

// Round-average helper: given an array of y-positions, produce the next round's
// y-positions by averaging consecutive pairs.
function nextRoundYs(ys) {
  const out = [];
  for (let i = 0; i < ys.length; i += 2) out.push((ys[i] + ys[i + 1]) / 2);
  return out;
}

// Rounded elbow connector between two points (child -> parent)
function bendPath(x1, y1, x2, y2, radius = 16) {
  if (y1 === y2) return `M ${x1} ${y1} L ${x2} ${y2}`;
  const dx = Math.sign(x2 - x1) || 1;
  const dy = Math.sign(y2 - y1);
  const r = Math.min(radius, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2 || radius);
  return `M ${x1} ${y1} L ${x2 - dx * r} ${y1} Q ${x2} ${y1} ${x2} ${y1 + dy * r} L ${x2} ${y2}`;
}

// The sheet's "Court" column is host-entered free text and sometimes already
// includes the word "Court" (e.g. "Court 7"), sometimes just the number. We
// always render our own "COURT " label, so strip any existing prefix first
// to avoid "COURT Court 7".
function formatCourt(court) {
  if (!court) return null;
  const s = String(court).trim();
  if (!s) return null;
  return s.replace(/^court\s*/i, '') || s;
}

window.LayoutConsts = {
  POSTER_W, POSTER_H, HEADER_H,
  MAIN_Y0, MAIN_Y1, DIVIDER_Y0, DIVIDER_Y1, CONSOL_Y0, CONSOL_Y1, FOOTER_Y0,
  CHAMPION_X,
};
window.LayoutHelpers = { nextRoundYs, bendPath, formatCourt };
