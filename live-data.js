// live-data.js
// Fetches live results from the Netlify Function backed by the "Matches"
// Google Sheet tab, and maps match IDs onto bracket regions.
//
// Match ID scheme (see netlify/functions/results.js for the sheet format):
//   M64-01..32, M32-01..16, M16-01..08, M8-01..04, M4-01..02, M2-01/M2-02
//   (main bracket), same pattern with a "C" prefix for consolation.
// Each round's match numbers split into 4 equal blocks in fixed order:
// Red, Blue, Green, Orange (window.QUARTERS order) — e.g. M64-01..08 = Red,
// 09..16 = Blue, 17..24 = Green, 25..32 = Orange.
//
// Returns null from fetchLiveData() on any failure (no backend deployed yet,
// network error, etc.) so callers fall back to demo/mock data.

const LIVE_ENDPOINT = '/.netlify/functions/results';
const LIVE_POLL_MS = 45000;

async function fetchLiveData() {
  try {
    const res = await fetch(LIVE_ENDPOINT, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.matches) return null;
    return data;
  } catch (e) {
    return null;
  }
}

// Match IDs for one bracket region (quarterIndex 0-3 = Red/Blue/Green/Orange)
// in a given round. `roundSize` is the "team count entering this round" label
// used in the ID (64, 32, 16, 8, 4, or 2) — total matches globally = roundSize / 2.
function regionMatchIds(prefix, roundSize, quarterIndex) {
  const totalMatches = roundSize / 2;
  const perRegion = totalMatches / 4;
  const start = quarterIndex * perRegion + 1;
  const ids = [];
  for (let i = 0; i < perRegion; i++) {
    ids.push(`${prefix}${roundSize}-${String(start + i).padStart(2, '0')}`);
  }
  return ids;
}

// Resolves one region's leaf team names + per-round winners from live match
// data. `sizes` is the ordered list of round-size labels for this bracket,
// largest first (e.g. [64, 32, 16, 8] for the main bracket, [32, 16, 8] for
// consolation — consolation regions start at 8 teams, not 16).
function resolveRegion(liveData, prefix, sizes, quarterIndex) {
  const matches = (liveData && liveData.matches) || {};
  const get = (id) => matches[id.toUpperCase()] || {};

  const leafIds = regionMatchIds(prefix, sizes[0], quarterIndex);
  const leafNames = [];
  leafIds.forEach((id) => {
    const m = get(id);
    leafNames.push(m.yellow || 'TBD');
    leafNames.push(m.black || 'TBD');
  });

  const roundWinners = sizes.map((size) => {
    const ids = regionMatchIds(prefix, size, quarterIndex);
    return ids.map((id) => get(id).winner || null);
  });

  // In-progress court scores (see netlify/functions/live-score.js), only
  // ever present on matches that don't have a winner yet.
  const roundLive = sizes.map((size) => {
    const ids = regionMatchIds(prefix, size, quarterIndex);
    return ids.map((id) => get(id).liveScore || null);
  });

  return { leafNames, roundWinners, roundLive };
}

window.LiveData = { fetchLiveData, regionMatchIds, resolveRegion, LIVE_POLL_MS };
