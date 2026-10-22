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

// The same person in each outside system. `type` is what auth-worker's
// /auth/fields/set expects; `field` is where the link sits on the user.
// matchByName: NetSuite emails are mostly personal, so fall back to an exact
// full-name match there.
export const LINK_TYPES = [
  { type: "procore_user", field: "procoreUser", label: "Procore user", short: "Procore", matchByName: false },
  { type: "rp_person", field: "rpPerson", label: "Resource Planning", short: "RP", matchByName: false },
  { type: "netsuite_employee", field: "netsuiteEmployee", label: "NetSuite employee", short: "NetSuite", matchByName: true },
];

const norm = (s) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();

// Ties each person to their Procore department (one each) and to the same
// person in Procore, Resource Planning and NetSuite. Apps default filters to
// the department, only write a department to Procore if it's tied to someone
// here, and use these ids instead of matching names or hardcoding lists.
// Super Admin and the Admin job role can edit.
export default function Departments({ onToast, onUnauthorized }) {
  const [departments, setDepartments] = useState([]);
  const [options, setOptions] = useState({}); // type → { list, refreshedAt }
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
    Promise.all([api.getDepartments(), api.fieldUsers(), api.linkOptions()])
      .then(([d, u, o]) => {
        setDepartments(d.departments || []);
        setOptions(o || {});
        setMeta({ refreshedAt: d.refreshedAt, refreshedBy: d.refreshedBy });
        setUsers((u.users || []).sort((a, b) => (a.displayName || a.username).localeCompare(b.displayName || b.username)));
      })
      .catch((e) => (e.unauthorized ? unauthorized.current() : setError(e.message)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  async function save(username, fn) {
    setSaving(username);
    try {
      await fn();
      load();
    } catch (e) {
      if (e.unauthorized) unauthorized.current();
      else onToast(e.message, true);
    } finally {
      setSaving(null);
    }
  }

  // Fills every empty link whose email (or email-style username) matches
  // exactly one option — or, for NetSuite, exactly one exact full name.
  // Never overwrites an existing link.
  async function matchAll() {
    setMatching(true);
    let linked = 0;
    try {
      for (const u of users) {
        const emails = [u.email, u.username].map(norm).filter((x) => x.includes("@"));
        for (const t of LINK_TYPES) {
          if (u[t.field]) continue;
          const list = options[t.type]?.list || [];
          let hits = list.filter((p) => p.email && emails.includes(norm(p.email)));
          if (!hits.length && t.matchByName) hits = list.filter((p) => norm(p.name) === norm(u.displayName));
          if (hits.length === 1) {
            await api.setLink(u.username, t.type, hits[0].id);
            linked++;
          }
        }
      }
      onToast(linked ? `Made ${linked} new ${linked === 1 ? "link" : "links"}.` : "No new matches.");
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
      const c = r.counts || {};
      onToast(
        `Loaded ${c.departments || 0} departments, ${c.procoreUsers || 0} Procore employees, ${c.rpPeople || 0} Resource Planning people, ${c.netsuiteEmployees || 0} NetSuite employees.` +
          (r.failed?.length ? ` Couldn't reach: ${r.failed.join(", ")} (kept the previous list).` : ""),
        !!r.failed?.length
      );
      load();
    } catch (e) {
      if (e.unauthorized) unauthorized.current();
      else onToast(e.message, true);
    } finally {
      setRefreshing(false);
    }
  }

  // option id → names of people already linked to it, per link type
  const linkedTo = {};
  for (const t of LINK_TYPES) {
    linkedTo[t.type] = {};
    for (const u of users) if (u[t.field]) (linkedTo[t.type][u[t.field].id] = linkedTo[t.type][u[t.field].id] || []).push(u.displayName || u.username);
  }
  const untied = departments.filter((d) => d.users.length === 0);
  const shared = departments.filter((d) => d.users.length > 1);
  const anyOptions = LINK_TYPES.some((t) => options[t.type]?.list?.length);
  const selectStyle = { maxWidth: 190, fontSize: 12 };

  return (
    <>
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Linked ids</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={matchAll} disabled={matching || !anyOptions} title="Fill empty links by email (NetSuite: by exact name too). Never changes an existing link.">
              {matching ? "Matching…" : "Match by email"}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={refresh} disabled={refreshing}>
              {refreshing ? "Refreshing…" : "Refresh lists"}
            </button>
          </div>
        </div>
        <div className="field-help" style={{ marginBottom: 14 }}>
          Each person's Procore department, and the same person in Procore, Resource Planning and NetSuite. Apps
          use these instead of matching names: a department can only be written to Procore if it's tied to someone
          here, and project-setup syncs (team PM, Resource Planning PM) use the linked ids. Lists last loaded{" "}
          {formatDateTime(meta.refreshedAt)}{meta.refreshedBy ? ` (${meta.refreshedBy})` : ""}
          {LINK_TYPES.map((t) => `, ${options[t.type]?.list?.length || 0} ${t.short}`).join("")}.
          {!anyOptions && " Click Refresh lists to load the people from each system."}
        </div>

        {error && <div className="login-error" style={{ marginBottom: 10 }}>{error}</div>}
        {loading && !users.length ? (
          <div className="empty-state">Loading…</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Department</th>
                {LINK_TYPES.map((t) => <th key={t.type}>{t.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.username}>
                  <td>
                    <div>{u.displayName || u.username}</div>
                    <div className="field-help" style={{ fontSize: 11 }}>{jobRoleLabel(u.jobRole)}</div>
                  </td>
                  <td>
                    <select
                      value={u.department?.id || ""}
                      disabled={saving === u.username}
                      onChange={(e) => save(u.username, () => api.setDepartment(u.username, e.target.value || null))}
                      style={selectStyle}
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
                  {LINK_TYPES.map((t) => {
                    const list = options[t.type]?.list || [];
                    const cur = u[t.field];
                    return (
                      <td key={t.type}>
                        <select
                          value={cur?.id || ""}
                          disabled={saving === u.username || (!list.length && !cur)}
                          onChange={(e) => save(u.username, () => api.setLink(u.username, t.type, e.target.value || null))}
                          style={selectStyle}
                          title={cur ? `${cur.name} (id ${cur.id})` : ""}
                          aria-label={`${u.displayName || u.username}: ${t.label}`}
                        >
                          <option value="">Not linked</option>
                          {cur && !list.some((p) => p.id === cur.id) && (
                            <option value={cur.id}>{cur.name || cur.id} (not in the latest list)</option>
                          )}
                          {list.map((p) => {
                            const others = (linkedTo[t.type][p.id] || []).filter((n) => n !== (u.displayName || u.username));
                            return (
                              <option key={p.id} value={p.id}>
                                {p.name}{p.company ? ` · ${p.company}` : ""}{p.email ? ` (${p.email})` : ""}{others.length ? ` — linked to ${others.join(", ")}` : ""}
                              </option>
                            );
                          })}
                        </select>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!loading && departments.length > 0 && (
        <div className="card">
          <div className="card-title">Departments not tied to anyone</div>
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
