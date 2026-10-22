import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { jobRoleLabel, levelLabel, NO_ACCESS } from "../apps.js";
import CreateUserModal from "./CreateUserModal.jsx";
import EditUserModal from "./EditUserModal.jsx";
import SetPasswordModal from "./SetPasswordModal.jsx";
import ConfirmModal from "./ConfirmModal.jsx";

// Short dates for the table: the year only when it isn't this year. The full
// date and time are in the cell's tooltip.
function sameYear(d) {
  return d.getFullYear() === new Date().getFullYear();
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", ...(sameYear(d) ? {} : { year: "numeric" }) });
  } catch {
    return iso;
  }
}

function formatDateTime(iso) {
  if (!iso) return "Never";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit", ...(sameYear(d) ? {} : { year: "numeric" }),
    });
  } catch {
    return iso;
  }
}

function fullDateTime(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

// What they can actually open right now, one line per app with the level —
// e.g. TALLY Submitter. "*" marks a per-app override; switched-on tool
// permissions follow the level.
function accessRows(u, matrix) {
  return Object.entries(u.appRoles || {})
    .filter(([, level]) => level && level !== NO_ACCESS)
    .map(([app, level]) => {
      const overridden = matrix?.live?.[app] && u.roleOverrides?.[app];
      const tools = (u.appExtras?.[app] || []).map((id) => matrix?.apps?.find((a) => a.id === app)?.extras?.find((x) => x.id === id)?.label || id);
      return [app, `${levelLabel(matrix, app, level)}${overridden ? "*" : ""}`, tools];
    });
}

// "Actions ▾" — the less common, mostly disruptive actions, out of the way.
function RowMenu({ label, items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("click", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div className="row-menu" ref={ref}>
      <button className="btn btn-ghost btn-sm" aria-haspopup="menu" aria-expanded={open} aria-label={label} onClick={() => setOpen((v) => !v)}>
        Actions ▾
      </button>
      {open && (
        <div className="row-menu-list" role="menu">
          {items.map((it) => (
            <button
              key={it.label}
              role="menuitem"
              className={`row-menu-item${it.danger ? " danger" : ""}`}
              disabled={it.disabled}
              title={it.title || ""}
              onClick={() => { setOpen(false); it.onClick(); }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function UserList({ users, matrix, currentUsername, loading, error, onRefresh, onToast }) {
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // user object
  const [passwordTarget, setPasswordTarget] = useState(null); // username
  const [archiveTarget, setArchiveTarget] = useState(null); // { username, disabled }
  const [logoutTarget, setLogoutTarget] = useState(null); // username
  const [checkingLockout, setCheckingLockout] = useState(null); // username

  function afterMutate(message) {
    onToast?.(message);
    onRefresh();
  }

  async function checkLockout(username) {
    setCheckingLockout(username);
    try {
      const data = await api.rateLimitStatus(username);
      if (!data.limited) {
        onToast(`${username}: not locked out (${data.count}/${data.limit} recent failed attempts).`);
      } else {
        const minutes = Math.ceil(data.retryAfterSeconds / 60);
        onToast(`${username}: locked out (${data.count}/${data.limit} failed attempts) — clears in ~${minutes}m.`, true);
      }
    } catch (err) {
      onToast(err.message, true);
    } finally {
      setCheckingLockout(null);
    }
  }

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>Einbau ID users</div>
        <button className="btn btn-accent btn-sm" onClick={() => setShowCreate(true)}>+ New user</button>
      </div>

      {error && <div className="login-error" style={{ marginBottom: 10 }}>{error}</div>}
      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : users.length === 0 ? (
        <div className="empty-state">No users yet.</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Person</th>
              <th>Job role</th>
              <th>Access now</th>
              <th>Status</th>
              <th>Last login</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.username.toLowerCase() === currentUsername?.toLowerCase();
              return (
                <tr key={u.username} className={u.disabled ? "row-disabled" : ""}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{u.displayName}</div>
                    <div className="mono" style={{ fontSize: 11, color: "var(--text-secondary)" }}>{u.username}</div>
                    {u.email && u.email.toLowerCase() !== u.username.toLowerCase() && (
                      <div className="mono" style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{u.email}</div>
                    )}
                  </td>
                  <td>{jobRoleLabel(u.jobRole)}</td>
                  <td className="mono" style={{ fontSize: 11 }}>
                    {accessRows(u, matrix).length ? (
                      <div className="access-list">
                        {accessRows(u, matrix).map(([app, label, tools]) => (
                          <span key={app} style={{ display: "contents" }}>
                            <span style={{ color: "var(--text-secondary)" }}>{app}</span>
                            <span>
                              {label}
                              {tools.length > 0 && <span className="access-tools">+ {tools.join(", ")}</span>}
                            </span>
                          </span>
                        ))}
                      </div>
                    ) : "None"}
                  </td>
                  <td>
                    <span className={`badge ${u.disabled ? "badge-archived" : "badge-active"}`}>
                      {u.disabled ? "Archived" : "Active"}
                    </span>
                  </td>
                  <td className="mono" style={{ whiteSpace: "nowrap" }} title={u.lastLoginAt ? `${fullDateTime(u.lastLoginAt)}${u.lastLoginIp ? ` from ${u.lastLoginIp}` : ""}` : ""}>
                    {formatDateTime(u.lastLoginAt)}
                  </td>
                  <td className="mono" style={{ whiteSpace: "nowrap" }} title={fullDateTime(u.createdAt)}>{formatDate(u.createdAt)}</td>
                  <td>
                    <div className="table-actions" style={{ flexWrap: "nowrap" }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditTarget(u)}>Edit</button>
                      <RowMenu
                        label={`Actions for ${u.username}`}
                        items={[
                          {
                            label: checkingLockout === u.username ? "Checking…" : "Check lockout",
                            title: "Is this person temporarily blocked from signing in after too many wrong passwords?",
                            disabled: checkingLockout === u.username,
                            onClick: () => checkLockout(u.username),
                          },
                          {
                            label: "Force sign-out",
                            title: isSelf ? "Use 'Sign out everywhere' in My Account instead" : "Sign them out on every device now",
                            disabled: isSelf,
                            onClick: () => setLogoutTarget(u.username),
                          },
                          u.disabled
                            ? { label: "Unarchive", onClick: () => setArchiveTarget({ username: u.username, disabled: true }) }
                            : { label: "Archive", danger: true, disabled: isSelf, onClick: () => setArchiveTarget({ username: u.username, disabled: false }) },
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {!loading && users.length > 0 && (
        <div className="field-help" style={{ marginTop: 8 }}>* = per-app override. Apps not yet switched to the role matrix show as "Access".</div>
      )}

      {showCreate && (
        <CreateUserModal
          matrix={matrix}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            afterMutate("User created.");
          }}
        />
      )}

      {editTarget && (
        <EditUserModal
          user={editTarget}
          matrix={matrix}
          isSelf={editTarget.username.toLowerCase() === currentUsername?.toLowerCase()}
          onClose={() => setEditTarget(null)}
          onSetPassword={() => {
            const name = editTarget.username;
            setEditTarget(null);
            setPasswordTarget(name);
          }}
          onSaved={() => {
            setEditTarget(null);
            afterMutate(`${editTarget.username} updated.`);
          }}
        />
      )}

      {passwordTarget && (
        <SetPasswordModal
          username={passwordTarget}
          onClose={() => setPasswordTarget(null)}
          onDone={() => {
            setPasswordTarget(null);
            afterMutate(`Password updated for ${passwordTarget}.`);
          }}
        />
      )}

      {logoutTarget && (
        <ConfirmModal
          title={`Force sign-out — ${logoutTarget}?`}
          body="This immediately kills every active session for this account. Their password stays the same and they can log back in right away — this just clears out anything currently signed in (a stolen device, an old laptop, whatever prompted the check)."
          confirmLabel="Sign out everywhere"
          danger
          onClose={() => setLogoutTarget(null)}
          onConfirm={async () => {
            await api.forceLogout(logoutTarget);
            setLogoutTarget(null);
            afterMutate(`${logoutTarget} signed out everywhere.`);
          }}
        />
      )}

      {archiveTarget && !archiveTarget.disabled && (
        <ConfirmModal
          title={`Archive ${archiveTarget.username}?`}
          body="This immediately signs them out everywhere and blocks login. Their account and history stay intact — you can unarchive any time. Permanent deletion is not available in HELM; it's a terminal-only operation on auth-worker for the rare case you really mean it."
          confirmLabel="Archive"
          danger
          onClose={() => setArchiveTarget(null)}
          onConfirm={async () => {
            await api.archiveUser(archiveTarget.username);
            setArchiveTarget(null);
            afterMutate(`${archiveTarget.username} archived.`);
          }}
        />
      )}

      {archiveTarget && archiveTarget.disabled && (
        <ConfirmModal
          title={`Unarchive ${archiveTarget.username}?`}
          body="This restores login access for this account."
          confirmLabel="Unarchive"
          onClose={() => setArchiveTarget(null)}
          onConfirm={async () => {
            await api.unarchiveUser(archiveTarget.username);
            setArchiveTarget(null);
            afterMutate(`${archiveTarget.username} unarchived.`);
          }}
        />
      )}
    </div>
  );
}
