import { useState } from "react";
import { api } from "../api.js";
import CreateUserModal from "./CreateUserModal.jsx";
import EditUserModal from "./EditUserModal.jsx";
import SetPasswordModal from "./SetPasswordModal.jsx";
import ConfirmModal from "./ConfirmModal.jsx";

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function appsSummary(apps) {
  if (!apps) return "All";
  if (apps.length === 0) return "None";
  return apps.join(", ");
}

export default function UserList({ users, currentUsername, loading, error, onRefresh, onToast }) {
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // user object
  const [passwordTarget, setPasswordTarget] = useState(null); // username
  const [archiveTarget, setArchiveTarget] = useState(null); // { username, disabled }

  function afterMutate(message) {
    onToast?.(message);
    onRefresh();
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
              <th>Username</th>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Apps</th>
              <th>Status</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.username} className={u.disabled ? "row-disabled" : ""}>
                <td className="mono">{u.username}</td>
                <td>{u.displayName}</td>
                <td className="mono">{u.email || "—"}</td>
                <td><span className={`badge badge-${u.role}`}>{u.role}</span></td>
                <td className="mono">{appsSummary(u.apps)}</td>
                <td>
                  <span className={`badge ${u.disabled ? "badge-archived" : "badge-active"}`}>
                    {u.disabled ? "Archived" : "Active"}
                  </span>
                </td>
                <td className="mono">{formatDate(u.createdAt)}</td>
                <td>
                  <div className="table-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditTarget(u)}>Edit</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setPasswordTarget(u.username)}>
                      Set password
                    </button>
                    {u.disabled ? (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setArchiveTarget({ username: u.username, disabled: true })}
                      >
                        Unarchive
                      </button>
                    ) : (
                      <button
                        className="btn btn-danger btn-sm"
                        disabled={u.username.toLowerCase() === currentUsername?.toLowerCase()}
                        onClick={() => setArchiveTarget({ username: u.username, disabled: false })}
                      >
                        Archive
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showCreate && (
        <CreateUserModal
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
          onClose={() => setEditTarget(null)}
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
