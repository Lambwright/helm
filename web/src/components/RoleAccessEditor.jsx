import { APPS, JOB_ROLES, SUPER_ADMIN, NO_ACCESS, levelFor, levelLabel } from "../apps.js";

// Job role + per-app role overrides, with the resulting level per app.
// Apps already switched to the matrix ("live") take their level from the role;
// apps not switched yet keep today's per-person tick-box, shown alongside.
export default function RoleAccessEditor({ matrix, jobRole, onJobRoleChange, overrides, onOverrideChange, legacyApps, onLegacyToggle, locked }) {
  const preview = { jobRole, roleOverrides: overrides, legacyApps: [...legacyApps], legacyAppRoles: {} };
  const anyAccess = jobRole === SUPER_ADMIN || APPS.some((a) => levelFor(preview, matrix, a.id) !== NO_ACCESS);

  return (
    <div>
      <div className="field" style={{ marginBottom: 12 }}>
        <label htmlFor="job-role">Job role</label>
        <select id="job-role" value={jobRole} disabled={locked} onChange={(e) => onJobRoleChange(e.target.value)}>
          {locked && <option value={SUPER_ADMIN}>Super Admin</option>}
          {JOB_ROLES.map((r) => (
            <option key={r.id} value={r.id}>{r.label}</option>
          ))}
        </select>
        {locked && <span className="field-help">The Super Admin has everything, everywhere. This can't be changed.</span>}
      </div>

      {!locked && (
        <div className="field" style={{ marginBottom: 4 }}>
          <label>Access by app</label>
          <table className="table" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th>App</th>
                <th>Acts as</th>
                <th>Gets</th>
              </tr>
            </thead>
            <tbody>
              {APPS.map((app) => {
                const live = !!matrix?.live?.[app.id];
                const level = levelFor(preview, matrix, app.id);
                return (
                  <tr key={app.id}>
                    <td className="mono">{app.label}</td>
                    <td>
                      {live ? (
                        <select
                          value={overrides[app.id] || ""}
                          onChange={(e) => onOverrideChange(app.id, e.target.value)}
                          style={{ fontSize: 12, padding: "3px 6px", width: "auto" }}
                          aria-label={`${app.label} role override`}
                        >
                          <option value="">Their job role</option>
                          {JOB_ROLES.map((r) => (
                            <option key={r.id} value={r.id}>{r.label}</option>
                          ))}
                        </select>
                      ) : (
                        <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 400 }} title="This app hasn't switched to the role matrix yet, so access is still set per person.">
                          <input
                            type="checkbox"
                            checked={legacyApps.has(app.id)}
                            onChange={() => onLegacyToggle(app.id)}
                            style={{ width: "auto", padding: 0, margin: 0 }}
                          />
                          <span className="field-help">Not on roles yet — tick for access</span>
                        </label>
                      )}
                    </td>
                    <td style={{ color: level === NO_ACCESS ? "var(--text-tertiary)" : undefined }}>
                      {levelLabel(matrix, app.id, level)}
                      {live && overrides[app.id] ? <span className="field-help"> (override)</span> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!anyAccess && (
            <span className="field-help" style={{ color: "var(--yellow)" }}>
              This person gets no app access at all, so they can't sign in.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
