// Admin page for inspecting and purging the "live-scores" Netlify Blobs
// store (see netlify/functions/live-score-admin.js). Lets the TD/ATD clear
// a bad or stale in-progress entry, or wipe test data before the event,
// without needing Netlify CLI access.
//
// Deliberately not linked from index.html — reached by direct URL only,
// same convention as score.html.

const ADMIN_ENDPOINT = '/.netlify/functions/live-score-admin';

function formatAgo(ts) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${Math.round(s / 3600)}h`;
}

function AdminApp() {
  const [entries, setEntries] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [busyId, setBusyId] = React.useState(null);

  async function load() {
    setError(null);
    try {
      const res = await fetch(ADMIN_ENDPOINT, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();
      setEntries(data.entries || []);
    } catch (e) {
      setError(e.message || 'Failed to load entries');
    }
  }

  React.useEffect(() => {
    load();
  }, []);

  async function deleteOne(matchId) {
    setBusyId(matchId);
    try {
      const res = await fetch(ADMIN_ENDPOINT, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId }),
      });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      setEntries((prev) => (prev || []).filter((e) => e.matchId !== matchId));
    } catch (e) {
      setError(e.message || 'Failed to delete entry');
    } finally {
      setBusyId(null);
    }
  }

  async function clearAll() {
    if (!window.confirm('Delete every live-score entry? This cannot be undone.')) return;
    setBusyId('__all__');
    try {
      const res = await fetch(ADMIN_ENDPOINT, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      if (!res.ok) throw new Error(`Clear all failed (${res.status})`);
      setEntries([]);
    } catch (e) {
      setError(e.message || 'Failed to clear entries');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="a-wrap">
      <div className="a-header">
        <h1>Live Score Admin</h1>
        <div className="a-actions">
          <button className="a-btn" onClick={load} disabled={busyId !== null}>Refresh</button>
          <button
            className="a-btn a-btn-danger"
            onClick={clearAll}
            disabled={busyId !== null || !entries || entries.length === 0}
          >
            Clear all
          </button>
        </div>
      </div>

      {error && <p className="a-error">{error}</p>}

      {entries === null && !error && <p className="a-empty">Loading…</p>}
      {entries && entries.length === 0 && <p className="a-empty">No live-score entries.</p>}

      {entries && entries.length > 0 && (
        <div className="a-list">
          {entries.map((e) => (
            <div className="a-row" key={e.matchId}>
              <div className="a-row-main">
                <div className="a-row-id">
                  {e.matchId}
                  {e.court ? ` · Court ${e.court}` : ''}
                </div>
                <div className="a-row-meta">
                  {e.scorer ? `${e.scorer} · ` : ''}updated {formatAgo(e.updatedAt)} ago
                </div>
              </div>
              <div className={`a-row-status${e.status === 'complete' ? ' a-row-status-complete' : ''}`}>
                {e.status === 'complete' ? 'Complete' : 'In progress'}
              </div>
              <div className="a-row-score">{e.yellowScore}&ndash;{e.blackScore}</div>
              <button
                className="a-btn a-btn-danger"
                onClick={() => deleteOne(e.matchId)}
                disabled={busyId !== null}
              >
                {busyId === e.matchId ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<AdminApp />);
