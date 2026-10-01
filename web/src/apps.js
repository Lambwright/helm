// Canonical app IDs — must match exactly what auth-worker's `apps` field on a
// user record expects (see auth-worker/README.md). HELM itself isn't listed:
// anyone who can sign in can open HELM for their own My Account.
export const APPS = [
  { id: "PUNCH", label: "PUNCH", url: "https://lambwright.github.io/PUNCH/" },
  { id: "SCOUT", label: "SCOUT", url: "https://lambwright.github.io/scout-addin/app.html" },
  { id: "INTAKE", label: "INTAKE", url: "https://lambwright.github.io/scout-intake/" },
  { id: "TALLY", label: "TALLY", url: "https://lambwright.github.io/tally/" },
  { id: "HANDOFF", label: "HANDOFF", url: "https://lambwright.github.io/handoff/" },
  { id: "LEDGER", label: "LEDGER", url: "https://lambwright.github.io/ledger/" },
  { id: "CRM", label: "CRM", url: "https://lambwright.github.io/crm/" },
];

// Company job roles (auth-worker's JOB_ROLES + the Super Admin). What each
// gets in each app lives in the role matrix (Role Matrix tab), not here.
export const SUPER_ADMIN = "superadmin";
export const JOB_ROLES = [
  { id: "admin", label: "Admin" },
  { id: "estimator", label: "Estimator" },
  { id: "project_manager", label: "Project Manager" },
  { id: "project_coordinator", label: "Project Coordinator" },
  { id: "crm", label: "CRM" },
  { id: "accounting", label: "Accounting" },
  { id: "logistics", label: "Logistics" },
];
export const DEFAULT_JOB_ROLE = "project_manager";
export const NO_ACCESS = "no_access";

export function jobRoleLabel(id) {
  if (id === SUPER_ADMIN) return "Super Admin";
  return JOB_ROLES.find((r) => r.id === id)?.label || id || "—";
}

// A level's display name, from the matrix's own level list when we have it.
export function levelLabel(matrix, appId, levelId) {
  if (!levelId || levelId === NO_ACCESS) return "No access";
  const found = matrix?.apps?.find((a) => a.id === appId)?.levels.find((l) => l.id === levelId);
  if (found) return found.label;
  return levelId.charAt(0).toUpperCase() + levelId.slice(1).replace(/_/g, " ");
}

// Mirror of auth-worker's effectiveAccess for ONE app, for previews in HELM.
// `live` lets the Role Matrix tab ask "what if this app were switched on?".
// user = an admin list-users row (has jobRole, roleOverrides, legacyApps, legacyAppRoles).
export function levelFor(user, matrix, appId, live = !!matrix?.live?.[appId]) {
  if (live) {
    if (user.jobRole === SUPER_ADMIN) return "admin";
    const roleId = user.roleOverrides?.[appId] || user.jobRole;
    return matrix?.cells?.[roleId]?.[appId] || NO_ACCESS;
  }
  if (!(user.legacyApps || []).includes(appId)) return NO_ACCESS;
  return user.legacyAppRoles?.[appId] || "access";
}
