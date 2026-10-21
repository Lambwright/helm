import { useMemo, useState } from "react";
import { api } from "../api.js";
import { NO_ACCESS, SUPER_ADMIN } from "../apps.js";
import ConfirmModal from "./ConfirmModal.jsx";

// Super Admin only. People × tool permissions: one switch per person per
// tool (e.g. CRM's follow-up manager, TALLY's receipt waiver). Complements the
// role matrix — the role still sets their level in each app; these switch on
// one specific tool for one person. Stored on the user (auth-worker
// `appExtras`); the list of tools lives in the matrix (`apps[].extras`) so an
// app's code and HELM agree on the id. A switch only works while the person
// can open that app.
export default function ToolPermissions({ matrix, users, onChanged, onToast }) {
  const [busy, setBusy] = useState(null); // "username:APP:id"
  const [adding, setAdding] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null); // { app, extra, holders }

  const tools = useMemo(
    () => (matrix?.apps || []).flatMap((app) => (app.extras || []).map((x) => ({ app, x }))),
    [matrix]
  );
  const people = useMemo(
    () => users.filter((u) => !u.disabled).sort((a, b) => (a.displayName || a.username).localeCompare(b.displayName || b.username)),
    [users]
  );

  if (!matrix) return <div className="card"><div className="empty-state">No role matrix has been saved yet.</div></div>;

  const has = (u, appId, id) => !!u.appExtrasStored?.[appId]?.includes(id);
  const canOpen = (u, appId) => u.jobRole === SUPER_ADMIN || (u.appRoles?.[appId] && u.appRoles[appId] !== NO_ACCESS);

  async function toggle(u, appId, id) {
    const key = `${u.username}:${appId}:${id}`;
    setBusy(key);
    const current = u.appExtrasStored || {};
    const list = current[appId] || [];
    const next = { ...current, [appId]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] };
    try {
      await api.updateUser(u.username, { appExtras: Object.fromEntries(Object.entries(next).filter(([, ids]) => ids.length)) });
      await onChanged();
    } catch (e) {
      onToast(e.message, true);
    } finally {
      setBusy(null);
    }
  }

  async function saveTools(apps, message) {
    await api.setMatrix({ apps, cells: matrix.cells, live: matrix.live });
    onToast(message);
    await onChanged();
  }

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>Tool permissions</div>
        <button className="btn btn-ghost btn-sm" onClick={() => setAdding((v) => !v)}>{adding ? "Cancel" : "+ Add permission"}</button>
      </div>
      <div className="field-help" style={{ marginBottom: 14 }}>
        Switch on a specific tool for a specific person, on top of what their role gives them. A switch only works while
        they can open that app (greyed out otherwise). Every change is in the Audit Log.
      </div>

      {adding && (
        <AddPermission
          matrix={matrix}
          onCancel={() => setAdding(false)}
          onAdd={async (appId, id, label) => {
            const app = matrix.apps.find((a) => a.id === appId);
            if ((app.extras || []).some((x) => x.id === id)) { onToast("That app already has a permission with that id.", true); return; }
            try {
              await saveTools(matrix.apps.map((a) => (a.id === appId ? { ...a, extras: [...(a.extras || []), { id, label }] } : a)), `Added ${app.label}: ${label}.`);
              setAdding(false);
            } catch (e) {
              onToast(e.message, true);
            }
          }}
        />
      )}

      {tools.length === 0 ? (
        <div className="empty-state">No tool permissions yet. Add one when an app asks for it.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="table" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th>Person</th>
                {tools.map(({ app, x }) => (
                  <th key={`${app.id}:${x.id}`} style={{ textAlign: "center" }} title={`id: ${x.id}`}>
                    <div className="mono">{app.label}</div>
                    <div style={{ textTransform: "none", letterSpacing: 0 }}>
                      {x.label}{" "}
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ padding: "0 4px" }}
                        aria-label={`Remove ${app.label} ${x.label}`}
                        onClick={() => setRemoveTarget({ app, x, holders: people.filter((u) => has(u, app.id, x.id)) })}
                      >
                        ×
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((u) => (
                <tr key={u.username}>
                  <td>{u.displayName || u.username}</td>
                  {tools.map(({ app, x }) => {
                    const open = canOpen(u, app.id);
                    const key = `${u.username}:${app.id}:${x.id}`;
                    return (
                      <td key={key} style={{ textAlign: "center" }} title={open ? "" : `No ${app.label} access — this switch does nothing until they have it.`}>
                        <input
                          type="checkbox"
                          checked={has(u, app.id, x.id)}
                          disabled={busy === key || (!open && !has(u, app.id, x.id))}
                          onChange={() => toggle(u, app.id, x.id)}
                          style={{ width: "auto", padding: 0, margin: 0, opacity: open ? 1 : 0.35 }}
                          aria-label={`${u.displayName || u.username}: ${app.label} ${x.label}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {removeTarget && (
        <ConfirmModal
          title={`Remove ${removeTarget.app.label}: ${removeTarget.x.label}?`}
          body={
            removeTarget.holders.length
              ? `${removeTarget.holders.map((u) => u.displayName || u.username).join(", ")} ${removeTarget.holders.length === 1 ? "loses" : "lose"} it immediately. Only remove it if ${removeTarget.app.label} no longer uses it.`
              : `Nobody has it switched on. Only remove it if ${removeTarget.app.label} no longer uses it.`
          }
          confirmLabel="Remove"
          danger
          onClose={() => setRemoveTarget(null)}
          onConfirm={async () => {
            const { app, x } = removeTarget;
            setRemoveTarget(null);
            try {
              await saveTools(matrix.apps.map((a) => (a.id === app.id ? { ...a, extras: (a.extras || []).filter((e) => e.id !== x.id) } : a)), `Removed ${app.label}: ${x.label}.`);
            } catch (e) {
              onToast(e.message, true);
            }
          }}
        />
      )}
    </div>
  );
}

// The id must be exactly what the app's code checks for — the app's Claude
// session supplies it when it asks for a new permission.
function AddPermission({ matrix, onAdd, onCancel }) {
  const [appId, setAppId] = useState(matrix.apps[0]?.id || "");
  const [id, setId] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState(null);

  function submit(e) {
    e.preventDefault();
    const cleanId = id.trim();
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(cleanId)) {
      setError("Id: lowercase letters, numbers and _ only, starting with a letter — exactly as the app expects it.");
      return;
    }
    if (!label.trim()) {
      setError("Give it a label people will recognise.");
      return;
    }
    setError(null);
    onAdd(appId, cleanId, label.trim());
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 14 }}>
      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor="tp-app">App</label>
        <select id="tp-app" value={appId} onChange={(e) => setAppId(e.target.value)} style={{ width: "auto" }}>
          {matrix.apps.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
      </div>
      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor="tp-id">Id (from the app)</label>
        <input id="tp-id" value={id} onChange={(e) => setId(e.target.value)} placeholder="followup_manager" />
      </div>
      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor="tp-label">Label</label>
        <input id="tp-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Follow-up manager" />
      </div>
      <button className="btn btn-accent btn-sm" type="submit">Add</button>
      <button className="btn btn-ghost btn-sm" type="button" onClick={onCancel}>Cancel</button>
      {error && <div className="login-error" style={{ width: "100%" }}>{error}</div>}
    </form>
  );
}
