function formatDateTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

const ACTION_LABELS = {
  create_user: "Created user",
  set_password: "Set password",
  delete_user: "Deleted user",
  archive_user: "Archived user",
  unarchive_user: "Unarchived user",
  bootstrap_admin: "Bootstrapped admin",
};

export default function AuditLog({ entries, loading, error, onRefresh }) {
  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>Admin audit log</div>
        <button className="btn btn-ghost btn-sm" onClick={onRefresh} disabled={loading}>
          {loading ? "↻ …" : "↻ Refresh"}
        </button>
      </div>

      {error && <div className="login-error" style={{ marginBottom: 10 }}>{error}</div>}
      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="empty-state">No audit entries yet.</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Target</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={`${e.at}-${i}`}>
                <td className="mono">{formatDateTime(e.at)}</td>
                <td className="mono">{e.actor}</td>
                <td>{ACTION_LABELS[e.action] || e.action}</td>
                <td className="mono">{e.target}</td>
                <td className="mono">{e.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
