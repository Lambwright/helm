import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { jobRoleLabel } from "../apps.js";

function formatDateTime(iso) {
  if (!iso) return "never";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// Ties each person to their Procore department (one each). Apps use it to
// default their filters, and only ever write a department to Procore if it's
// tied to someone here. Super Admin and the Admin job role can edit.
export default function Departments({ onToast, onUnauthorized }) {
  const [departments, setDepartments] = useState([]);
  const [meta, setMeta] = useState({ refreshedAt: null, refreshedBy: null });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(null); // username
  const [refreshing, setRefreshing] = useState(false);
  // App passes a fresh function every render; a ref keeps load() stable so it
  // doesn't re-run (and re-toast) on every parent render.
  const unauthorized = useRef(onUnauthorized);
  unauthorized.current = onUnauthorized;

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([api.getDepartments(), api.fieldUsers()])
      .then(([d, u]) => {
        setDepartments(d.departments || []);
        setMeta({ refreshedAt: d.refreshedAt, refreshedBy: d.refreshedBy });
        setUsers((u.users || []).sort((a, b) => (a.displayName || a.username).localeCompare(b.displayName || b.username)));
      })
      .catch((e) => (e.unauthorized ? unauthorized.current() : setError(e.message)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  async function change(username, departmentId) {
    setSaving(username);
    try {
      await api.setDepartment(username, departmentId || null);
      load();
    } catch (e) {
      if (e.unauthorized) unauthorized.current();
      else onToast(e.message, true);
    } finally {
      setSaving(null);
    }
  }

  async function refresh() {
    setRefreshing(true);
    try {
      const r = await api.refreshDepartments();
      onToast(`Loaded ${r.count} departments from Procore.`);
      load();
    } catch (e) {
      if (e.unauthorized) unauthorized.current();
      else onToast(e.message, true);
    } finally {
      setRefreshing(false);
    }
  }

  const untied = departments.filter((d) => d.users.length === 0);
  const shared = departments.filter((d) => d.users.length > 1);

  return (
    <>
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Departments</div>
          <button className="btn btn-ghost btn-sm" onClick={refresh} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "Refresh from Procore"}
          </button>
        </div>
        <div className="field-help" style={{ marginBottom: 14 }}>
          Each person's Procore department. Apps open on this department by default, and only departments
          tied to someone here can be written to Procore. {departments.length} departments in Procore,
          last loaded {formatDateTime(meta.refreshedAt)}{meta.refreshedBy ? ` (${meta.refreshedBy})` : ""}.
        </div>

        {error && <div className="login-error" style={{ marginBottom: 10 }}>{error}</div>}
        {loading && !users.length ? (
          <div className="empty-state">Loading…</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Job role</th>
                <th>Department</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.username}>
                  <td>{u.displayName || u.username}</td>
                  <td>{jobRoleLabel(u.jobRole)}</td>
                  <td>
                    <select
                      value={u.department?.id || ""}
                      disabled={saving === u.username}
                      onChange={(e) => change(u.username, e.target.value)}
                    >
                      <option value="">No department</option>
                      {u.department?.missing && (
                        <option value={u.department.id}>Removed from Procore ({u.department.id})</option>
                      )}
                      {departments.map((d) => {
                        const others = d.users.filter((x) => x.username !== u.username);
                        return (
                          <option key={d.id} value={d.id}>
                            {d.name}{others.length ? ` — ${others.map((x) => x.displayName || x.username).join(", ")}` : ""}
                          </option>
                        );
                      })}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!loading && departments.length > 0 && (
        <div className="card">
          <div className="card-title">Not tied to anyone</div>
          <div className="field-help" style={{ marginBottom: 10 }}>
            Apps won't write these to Procore. They can still appear as filters where an app has data for them.
          </div>
          <div className="mono" style={{ fontSize: 12, lineHeight: 1.8 }}>
            {untied.length ? untied.map((d) => d.name).join(" · ") : "Every department is tied to someone."}
          </div>
          {shared.length > 0 && (
            <div className="field-help" style={{ marginTop: 10 }}>
              Shared by more than one person: {shared.map((d) => `${d.name} (${d.users.map((x) => x.displayName || x.username).join(", ")})`).join("; ")}.
            </div>
          )}
        </div>
      )}
    </>
  );
}
