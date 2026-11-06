import { getStoredToken, storeToken, clearToken } from "../auth.js";

// HELM otherwise only talks to auth-worker. This panel's Procore work runs on TALLY's
// worker, so Direct Cost uploads draw on TALLY's Procore limits, not LEDGER's.
const TALLY_BASE = import.meta.env.VITE_TALLY_API ?? "https://tally-worker.ben-a90.workers.dev";

async function request(path, init = {}) {
  const token = getStoredToken();
  const res = await fetch(`${TALLY_BASE}${path}`, {
    ...init,
    headers: { ...init.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const refreshed = res.headers.get("X-Refreshed-Token");
  if (refreshed) storeToken(refreshed);
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    clearToken();
    const err = new Error("Your session has ended. Please sign in again.");
    err.unauthorized = true;
    throw err;
  }
  if (!res.ok) {
    const err = new Error(data.detail || data.reason || `Something went wrong (HTTP ${res.status}).`);
    err.status = res.status;
    err.code = data.error;
    err.data = data;
    throw err;
  }
  return data;
}

export function getDirectCost(projectId, id) {
  const q = new URLSearchParams({ project_id: projectId, id });
  return request(`/direct-cost-panel?${q}`);
}

export function getErpLinks(projectId, type) {
  const q = new URLSearchParams({ project_id: projectId, type });
  return request(`/erp-links?${q}`);
}

export function getErpRecord(projectId, type, id) {
  const q = new URLSearchParams({ project_id: projectId, type, id });
  return request(`/erp-links?${q}`);
}

export function changeErpLinks(projectId, type, reason, changes) {
  return request("/erp-links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: projectId, type, reason, changes }),
  });
}

export function attachFiles(projectId, id, files) {
  const form = new FormData();
  form.append("project_id", projectId);
  form.append("id", id);
  for (const f of files) form.append("files", f);
  return request("/direct-cost-panel/attach", { method: "POST", body: form });
}
