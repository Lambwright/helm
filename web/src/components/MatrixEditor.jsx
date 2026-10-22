import { useMemo, useState } from "react";
import { api } from "../api.js";
import { JOB_ROLES, NO_ACCESS, levelFor, levelLabel, jobRoleLabel } from "../apps.js";
import ConfirmModal from "./ConfirmModal.jsx";

const clone = (o) => JSON.parse(JSON.stringify(o));

// Super Admin only. Roles × apps; each cell is "No access" or one of that app's
// levels. The Live switch per app decides whether that app uses the matrix yet
// (off = still today's per-person settings). Nothing is saved until you review
// exactly whose access changes.
export default function MatrixEditor({ matrix, users, onSaved, onToast }) {
  const [cells, setCells] = useState(() => clone(matrix?.cells || {}));
  const [live, setLive] = useState(() => clone(matrix?.live || {}));
  // App definitions (levels can be added here; tool permissions are managed
  // in the Tool permissions sub-tab and pass through untouched).
  const [apps, setApps] = useState(() => clone(matrix?.apps || []));
  const [confirming, setConfirming] = useState(false);

  const draft = useMemo(() => (matrix ? { ...matrix, apps, cells, live } : null), [matrix, apps, cells, live]);

  // Per person: every app whose level differs between now and the draft.
  const changes = useMemo(() => {
    if (!draft) return [];
    const out = [];
    for (const u of users) {
      if (u.disabled) continue;
      const diffs = [];
      for (const app of draft.apps) {
        const before = u.appRoles?.[app.id] || NO_ACCESS;
        const after = levelFor(u, draft, app.id);
        if (before !== after) diffs.push({ app: app.id, before, after });
      }
      if (diffs.length) out.push({ user: u, diffs });
    }
    return out;
  }, [draft, users]);

  const addedLevels = apps.flatMap((a) => {
    const before = new Set((matrix?.apps.find((x) => x.id === a.id)?.levels || []).map((l) => l.id));
    return a.levels.filter((l) => !before.has(l.id)).map((l) => `${a.label}: ${l.label} (${l.id})`);
  });
  const dirty = JSON.stringify(cells) !== JSON.stringify(matrix?.cells || {}) || JSON.stringify(live) !== JSON.stringify(matrix?.live || {}) || addedLevels.length > 0;

  if (!matrix) {
    return <div className="card"><div className="empty-state">No role matrix has been saved yet.</div></div>;
  }

  // A new level only means something once the app's own code checks for it,
  // so the id comes from the app's Claude session (e.g. SCOUT "estimator").
  function addLevel(appId) {
    const app = apps.find((a) => a.id === appId);
    const id = (window.prompt(`New ${app.label} level id, exactly as ${app.label}'s code expects it (lowercase, e.g. estimator):`) || "").trim();
    if (!id) return;
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(id) || id === NO_ACCESS) { onToast("Level ids are lowercase letters, numbers and _ only, starting with a letter.", true); return; }
    if (app.levels.some((l) => l.id === id)) { onToast(`${app.label} already has a level "${id}".`, true); return; }
    const label = (window.prompt("Label shown in HELM (e.g. Estimator):", id.charAt(0).toUpperCase() + id.slice(1)) || "").trim() || id;
    setApps((prev) => prev.map((a) => (a.id === appId ? { ...a, levels: [...a.levels, { id, label }] } : a)));
  }

  function setCell(role, app, level) {
    setCells((prev) => ({ ...prev, [role]: { ...prev[role], [app]: level } }));
  }

  async function save() {
    const { matrix: saved } = await api.setMatrix({ apps, cells, live });
    setConfirming(false);
    onToast(changes.length ? `Saved. ${changes.length} ${changes.length === 1 ? "person's" : "people's"} access changed.` : "Saved.");
    onSaved(saved);
  }

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>Role matrix</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost btn-sm" disabled={!dirty} onClick={() => { setCells(clone(matrix.cells)); setLive(clone(matrix.live)); setApps(clone(matrix.apps)); }}>
            Discard changes
          </button>
          <button className="btn btn-accent btn-sm" disabled={!dirty} onClick={() => setConfirming(true)}>
            Review &amp; save
          </button>
        </div>
      </div>
      <div className="field-help" style={{ marginBottom: 14 }}>
        What each role gets in each app. An app only uses this once its <strong>Live</strong> switch is on — until then
        it keeps today's per-person settings. Switch an app live only after its own code has been updated.
        {matrix.updatedAt && <> Last saved {new Date(matrix.updatedAt).toLocaleString()} by {matrix.updatedBy}.</>}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="table" style={{ fontSize: 12 }}>
          <thead>
            <tr>
              <th>Role</th>
              {matrix.apps.map((app) => (
                <th key={app.id} style={{ textAlign: "center" }}>
                  <div>{app.label}</div>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 400, textTransform: "none", letterSpacing: 0, marginTop: 4, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={!!live[app.id]}
                      onChange={(e) => setLive((prev) => ({ ...prev, [app.id]: e.target.checked }))}
                      style={{ width: "auto", padding: 0, margin: 0 }}
                      aria-label={`${app.label} live`}
                    />
                    <span style={{ color: live[app.id] ? "var(--green)" : "var(--text-tertiary)" }}>{live[app.id] ? "Live" : "Off"}</span>
                  </label>
                  <div>
                    <button type="button" className="btn btn-ghost btn-sm" style={{ padding: "0 6px", marginTop: 4, fontSize: 10 }} onClick={() => addLevel(app.id)} title={`Add a level to ${app.label} (only one its code already knows)`}>
                      + Level
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="row-disabled">
              <td><strong>Super Admin</strong></td>
              {matrix.apps.map((app) => <td key={app.id} style={{ textAlign: "center" }}>Everything</td>)}
            </tr>
            {JOB_ROLES.map((role) => (
              <tr key={role.id}>
                <td><strong>{role.label}</strong></td>
                {matrix.apps.map((app) => {
                  const value = cells[role.id]?.[app.id] || NO_ACCESS;
                  const changed = value !== (matrix.cells[role.id]?.[app.id] || NO_ACCESS);
                  return (
                    <td key={app.id} style={{ textAlign: "center" }}>
                      <select
                        value={value}
                        onChange={(e) => setCell(role.id, app.id, e.target.value)}
                        style={{
                          fontSize: 12, padding: "3px 6px", width: "auto",
                          color: value === NO_ACCESS ? "var(--text-tertiary)" : undefined,
                          borderColor: changed ? "var(--yellow)" : undefined,
                        }}
                        aria-label={`${role.label} in ${app.label}`}
                      >
                        <option value={NO_ACCESS}>No access</option>
                        {(apps.find((a) => a.id === app.id)?.levels || app.levels).map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dirty && (
        <div style={{ marginTop: 14 }}>
          <div className="card-title">If you save: {changes.length ? `${changes.length} ${changes.length === 1 ? "person's" : "people's"} access changes` : "nobody's access changes"}</div>
          <ChangeList changes={changes} matrix={draft} />
          {addedLevels.length > 0 && (
            <div className="field-help" style={{ marginTop: 8 }}>New levels: {addedLevels.join("; ")}.</div>
          )}
        </div>
      )}

      {confirming && (
        <ConfirmModal
          title="Save the role matrix?"
          body={
            changes.length
              ? `${changes.length} ${changes.length === 1 ? "person's" : "people's"} access changes immediately — on their next page load in each affected app. The list below the matrix shows exactly what.`
              : "This changes no one's access right now."
          }
          confirmLabel="Save"
          danger={changes.some((c) => c.diffs.some((d) => d.after === NO_ACCESS))}
          onClose={() => setConfirming(false)}
          onConfirm={save}
        />
      )}
    </div>
  );
}

function ChangeList({ changes, matrix }) {
  if (!changes.length) return null;
  return (
    <table className="table" style={{ fontSize: 12 }}>
      <thead>
        <tr><th>Person</th><th>Role</th><th>Changes</th></tr>
      </thead>
      <tbody>
        {changes.map(({ user, diffs }) => (
          <tr key={user.username}>
            <td>{user.displayName}</td>
            <td>{jobRoleLabel(user.jobRole)}</td>
            <td>
              {diffs.map((d) => (
                <div key={d.app}>
                  <span className="mono">{d.app}</span>: {levelLabel(matrix, d.app, d.before)} →{" "}
                  <strong style={{ color: d.after === NO_ACCESS ? "var(--red)" : d.before === NO_ACCESS ? "var(--green)" : undefined }}>
                    {levelLabel(matrix, d.app, d.after)}
                  </strong>
                </div>
              ))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
