// Canonical app IDs — must match exactly what auth-worker's `apps` field on a
// user record expects (see auth-worker/README.md, "The user object, and the
// apps field"). HELM itself isn't listed: every authenticated Einbau ID user
// can always open HELM.
export const APPS = [
  { id: "PUNCH", label: "PUNCH", url: "https://lambwright.github.io/PUNCH/" },
  { id: "SCOUT", label: "SCOUT", url: "https://lambwright.github.io/scout-addin/app.html" },
  { id: "INTAKE", label: "INTAKE", url: "https://lambwright.github.io/scout-intake/" },
  { id: "TALLY", label: "TALLY", url: "https://lambwright.github.io/tally/" },
  { id: "HANDOFF", label: "HANDOFF", url: "https://lambwright.github.io/handoff/" },
  {
    id: "LEDGER", label: "LEDGER", url: "https://lambwright.github.io/ledger/",
    roles: [
      { id: "viewer", label: "Viewer" },
      { id: "pm", label: "PM" },
      { id: "accounting", label: "Accounting" },
      { id: "admin", label: "Admin" },
    ],
  },
  { id: "CRM", label: "CRM", url: "https://lambwright.github.io/crm/" },
];

export const ALL_APP_IDS = APPS.map((a) => a.id);

// Per-app roles (auth-worker's `appRoles`). Only list `roles` on an app that
// actually reads appRoles — a dropdown the app ignores would be misleading
// (HANDOFF, for one, keeps its roles in its own users table). No entry for a
// granted app = that app's own default role, which the app decides.

// Drop roles for apps that aren't granted (or have no role vocabulary), so the
// saved map only ever describes access the user actually has.
export function prunedAppRoles(appRoles, grantedIds) {
  const out = {};
  for (const app of APPS) {
    const role = appRoles[app.id];
    if (role && grantedIds.has(app.id) && app.roles?.some((r) => r.id === role)) out[app.id] = role;
  }
  return out;
}

export function roleLabel(appId, roleId) {
  const app = APPS.find((a) => a.id === appId);
  return app?.roles?.find((r) => r.id === roleId)?.label || roleId;
}
