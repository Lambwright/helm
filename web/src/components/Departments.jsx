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

// Ties each person to their Procore department (one each) and to their own
// Procore user. Apps default their filters to the department, only ever write
// a department to Procore if it's tied to someone here, and build person
// pickers (e.g. SCOUT's estimators) from the linked Procore user instead of
// hardcoded ids. Super Admin and the Admin job role can edit.
export default function Departments({ onToast, onUnauthorized }) {
  const [departments, setDepartments] = useState([]);
  const [procoreUsers, setProcoreUsers] = useState([]);
  const [matching, setMatching] = useState(false);
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
    Promise.all([api.getDepartments(), api.fieldUsers(), api.procoreUsers()])
      .then(([d, u, p]) => {
        setDepartments(d.departments || []);
        setProcoreUsers(p.users || []);
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

  async function changeProcoreUser(username, procoreUserId) {
    setSaving(username);
    try {
      await api.setProcoreUser(username, procoreUserId || null);
      load();
    } catch (e) {
      if (e.unauthorized) unauthorized.current();
      else onToast(e.message, true);
    } finally {
      setSaving(null);
    }
  }

  // Links everyone not yet linked whose email (or email-style username)
  // matches exactly one Procore employee's email. Never overwrites a link.
  async function matchByEmail() {
    setMatching(true);
    let linked = 0;
    try {
      for (const u of users.filter((x) => !x.procoreUser)) {
        const emails = [u.email, u.username].map((x) => (x || "").toLowerCase()).filter((x) => x.includes("@"));
        const hits = procoreUsers.filter((p) => p.email && emails.includes(p.email));
        if (hits.length === 1) {
          await api.setProcoreUser(u.username, hits[0].id);
          linked++;
        }
      }
      onToast(linked ? `Linked ${linked} ${linked === 1 ? "person" : "people"} by email.` : "No new email matches.");
      load();
    } catch (e) {
      if (e.unauthorized) unauthorized.current();
      else onToast(e.message, true);
    } finally {
      setMatching(false);
    }
  }

  async function refresh() {
    setRefreshing(true);
    try {
      const r = await api.refreshDepartments();
      onToast(`Loaded ${r.count} departments and ${r.procoreUsers} Procore employees.`);
      load();
    } catch (e) {
      if (e.unauthorized) unauthorized.current();
      else onToast(e.message, true);
    } finally {
      setRefreshing(false);
    }
  }

  const linkedTo = {}; // procore user id → display names of people linked to it
  for (const u of users) if (u.procoreUser) (linkedTo[u.procoreUser.id] = linkedTo[u.procoreUser.id] || []).push(u.displayName || u.username);
  const untied = departments.filter((d) => d.users.length === 0);
  const shared = departments.filter((d) => d.users.length > 1);

  return (
    <>
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Procore links</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={matchByEmail} disabled={matching || !procoreUsers.length} title="Link everyone not yet linked whose email matches exactly one Procore employee">
              {matching ? "Matching…" : "Match Procore users by email"}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={refresh} disabled={refreshing}>
              {refreshing ? "Refreshing…" : "Refresh from Procore"}
            </button>
          </div>
        </div>
        <div className="field-help" style={{ marginBottom: 14 }}>
          Each person's Procore department and their own Procore user. Apps open on the department by
          default, only departments tied to someone here can be written to Procore, and person pickers in the
          apps (e.g. SCOUT's estimators) use the linked Procore user. {departments.length} departments and{" "}
          {procoreUsers.length} active Procore employees, last loaded {formatDateTime(meta.refreshedAt)}
          {meta.refreshedBy ? ` (${meta.refreshedBy})` : ""}.
          {!procoreUsers.length && " Click Refresh from Procore to load the Procore users."}
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
                <th>Procore user</th>
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
                  <td>
                    <select
                      value={u.procoreUser?.id || ""}
                      disabled={saving === u.username || (!procoreUsers.length && !u.procoreUser)}
                      onChange={(e) => changeProcoreUser(u.username, e.target.value)}
                    >
                      <option value="">Not linked</option>
                      {u.procoreUser && !procoreUsers.some((p) => p.id === u.procoreUser.id) && (
                        <option value={u.procoreUser.id}>{u.procoreUser.name || u.procoreUser.id} (not in the latest list)</option>
                      )}
                      {procoreUsers.map((p) => {
                        const others = (linkedTo[p.id] || []).filter((n) => n !== (u.displayName || u.username));
                        return (
                          <option key={p.id} value={p.id}>
                            {p.name}{p.email ? ` (${p.email})` : ""}{others.length ? ` — linked to ${others.join(", ")}` : ""}
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
