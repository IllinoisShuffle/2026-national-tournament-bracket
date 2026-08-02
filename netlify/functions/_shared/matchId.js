// Shared match ID format used across the results (read) and live-score
// (write) functions. ID format: "M64-01".."M64-32", "M32-01".."M32-16", ...
// "M4-01".."M4-02", "M2-01" (final), "M2-02" (3rd place) for the main
// bracket, and the same pattern with a "C" prefix for the consolation
// bracket.

const MATCH_ID_RE = /^[MC](64|32|16|8|4|2)-\d+$/i;

module.exports = { MATCH_ID_RE };
