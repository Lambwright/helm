import { APPS } from "../apps.js";

// Tick an app to grant access; apps that define roles (see apps.js) get a role
// dropdown once ticked. "App default" = no appRoles entry, the app decides.
export default function AppAccessPicker({ apps, onToggle, appRoles, onRoleChange, warnNoApps }) {
  return (
    <div className="field" style={{ marginBottom: 4 }}>
      <label>App access</label>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {APPS.map((app) => {
          const granted = apps.has(app.id);
          return (
            <div key={app.id} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 28 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 400, width: 110 }}>
                <input
                  type="checkbox"
                  checked={granted}
                  onChange={() => onToggle(app.id)}
                  style={{ width: "auto", padding: 0, margin: 0 }}
                />
                {app.label}
              </label>
              {granted && app.roles && (
                <select
                  value={appRoles[app.id] || ""}
                  onChange={(e) => onRoleChange(app.id, e.target.value)}
                  style={{ fontSize: 12, padding: "3px 6px", width: "auto" }}
                  aria-label={`${app.label} role`}
                >
                  <option value="">App default</option>
                  {app.roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      </div>
      {warnNoApps && (
        <span className="field-help" style={{ color: "var(--yellow)" }}>
          With no apps ticked, this person can't sign in at all.
        </span>
      )}
    </div>
  );
}
