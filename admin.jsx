// Admin page for inspecting and purging the "live-scores" Netlify Blobs
// store (see netlify/functions/live-score-admin.js). Lets the TD/ATD clear
// a bad or stale in-progress entry, or wipe test data before the event,
// without needing Netlify CLI access.
//
// Gated by a single shared admin PIN (see netlify/functions/_shared/
// adminAuth.js) — known only to the TD/ATD, not a per-person login like
// score.jsx's, since there's no need to know who purged an entry. The PIN
// is kept in sessionStorage (not localStorage) so it doesn't outlive the
// browser tab — this page can wipe all live scores at once, so it's worth
// not leaving that access sitting around on a shared device.
//
// Deliberately not linked from index.html — reached by direct URL only,
// same convention as score.html.

const ADMIN_ENDPOINT = '/.netlify/functions/live-score-admin';
const ADMIN_PIN_KEY = 'adminPin';

function readStoredPin() {
  try {
    return sessionStorage.getItem(ADMIN_PIN_KEY) || '';
  } catch (e) {
    return '';
  }
}

function storePin(pin) {
  try {
    sessionStorage.setItem(ADMIN_PIN_KEY, pin);
  } catch (e) {
    // Storage unavailable (private browsing, etc.) — the PIN still works
    // for the current session, it just won't stick on reload.
  }
}

function clearStoredPin() {
  try {
    sessionStorage.removeItem(ADMIN_PIN_KEY);
  } catch (e) {
    // Storage unavailable — nothing to clear.
  }
}

function authHeaders(pin) {
  return { 'X-Admin-Pin': pin };
}

function formatAgo(ts) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${Math.round(s / 3600)}h`;
}

function AdminApp() {
  const [pin, setPin] = React.useState(readStoredPin);
  const [pinError, setPinError] = React.useState('');
  const [entries, setEntries] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [busyId, setBusyId] = React.useState(null);

  function handleUnauthorized() {
    clearStoredPin();
    setPin('');
    setEntries(null);
    setPinError('Incorrect PIN, or your session expired — enter it again.');
  }

  async function load(currentPin) {
    setError(null);
    try {
      const res = await fetch(ADMIN_ENDPOINT, { cache: 'no-store', headers: authHeaders(currentPin) });
      if (res.status === 401) return handleUnauthorized();
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();
      setEntries(data.entries || []);
    } catch (e) {
      setError(e.message || 'Failed to load entries');
    }
  }

  React.useEffect(() => {
    if (pin) load(pin);
  }, [pin]);

  function handlePinSubmit(nextPin) {
    storePin(nextPin);
    setPinError('');
    setPin(nextPin);
  }

  function handleLogout() {
    clearStoredPin();
    setPin('');
    setEntries(null);
  }

  async function deleteOne(matchId) {
    setBusyId(matchId);
    try {
      const res = await fetch(ADMIN_ENDPOINT, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...authHeaders(pin) },
        body: JSON.stringify({ matchId }),
      });
      if (res.status === 401) return handleUnauthorized();
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
        headers: { 'Content-Type': 'application/json', ...authHeaders(pin) },
        body: JSON.stringify({ all: true }),
      });
      if (res.status === 401) return handleUnauthorized();
      if (!res.ok) throw new Error(`Clear all failed (${res.status})`);
      setEntries([]);
    } catch (e) {
      setError(e.message || 'Failed to clear entries');
    } finally {
      setBusyId(null);
    }
  }

  if (!pin) {
    return <PinGate onSubmit={handlePinSubmit} error={pinError} />;
  }

  return (
    <div className="a-wrap">
      <div className="a-header">
        <h1>Live Score Admin</h1>
        <div className="a-actions">
          <button className="a-btn" onClick={() => load(pin)} disabled={busyId !== null}>Refresh</button>
          <button
            className="a-btn a-btn-danger"
            onClick={clearAll}
            disabled={busyId !== null || !entries || entries.length === 0}
          >
            Clear all
          </button>
          <button className="a-btn" onClick={handleLogout}>Log out</button>
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

function PinGate({ onSubmit, error }) {
  const [draft, setDraft] = React.useState('');

  function submit(e) {
    e.preventDefault();
    if (!draft.trim()) return;
    onSubmit(draft.trim());
  }

  return (
    <div className="a-wrap">
      <div className="a-pin-wrap">
        <h1>Live Score Admin</h1>
        <p className="a-pin-sub">Enter the admin PIN to continue.</p>
        <form onSubmit={submit}>
          <input
            className="a-pin-input"
            type="password"
            inputMode="numeric"
            autoFocus
            maxLength={40}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button className="a-btn a-pin-submit" type="submit">Continue</button>
          {error && <p className="a-error">{error}</p>}
        </form>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<AdminApp />);
