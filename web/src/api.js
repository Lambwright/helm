import { getStoredToken, storeToken, clearToken } from "./auth.js";

// HELM has no backend of its own — every call goes straight to auth-worker's
// /auth/admin/* endpoints. Same dev-proxy / prod-base split as auth.js.
const AUTH_BASE = import.meta.env.DEV
  ? ""
  : import.meta.env.VITE_AUTH_API || "https://auth.ben-a90.workers.dev";

class UnauthorizedError extends Error {
  constructor(reason) {
    super(reason || "unauthorized");
    this.unauthorized = true;
  }
}

const ADMIN_ERROR_MESSAGES = {
  user_exists: "That username is already taken.",
  user_not_found: "That user no longer exists.",
  invalid_request: "Missing required fields.",
  cannot_delete_self: "You can't delete your own account.",
  cannot_archive_self: "You can't archive your own account.",
  forbidden: "Admin access required.",
  invalid_current_password: "That's not your current password.",
};

async function request(path, body) {
  const token = getStoredToken();
  const res = await fetch(`${AUTH_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body || {}),
  });

  const data = await res.json().catch(() => ({}));

  if (res.status === 401) {
    clearToken();
    throw new UnauthorizedError(data.error);
  }
  if (!res.ok) {
    const err = new Error(ADMIN_ERROR_MESSAGES[data.error] || data.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  listUsers: () => request("/auth/admin/list-users"), // { users: [{username, displayName, firstName, lastName, email, role, apps, disabled, createdAt}] }
  createUser: (fields) => request("/auth/admin/create-user", fields), // {username, password, firstName, lastName, email, role, apps}
  setPassword: (username, newPassword) => request("/auth/admin/set-password", { username, newPassword }),
  archiveUser: (username) => request("/auth/admin/archive-user", { username }),
  unarchiveUser: (username) => request("/auth/admin/unarchive-user", { username }),
  updateUser: (username, fields) => request("/auth/admin/update-user", { username, ...fields }), // {firstName?, lastName?, email?, apps?}
  listAudit: (limit) => request("/auth/admin/list-audit", limit ? { limit } : {}), // { entries: [{actor, action, target, at, ip}] }

  // Self-service — acts on the caller only.
  updateProfile: (fields) => request("/auth/me/update-profile", fields), // {firstName?, lastName?, email?, themeAccent?}
  changePassword: async (currentPassword, newPassword) => {
    const data = await request("/auth/me/change-password", { currentPassword, newPassword });
    if (data.token) storeToken(data.token); // keep this session alive across the tokenVersion bump
    return data;
  },
};

export { UnauthorizedError };
