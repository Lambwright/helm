import { useState } from "react";
import Modal from "./Modal.jsx";
import { api } from "../api.js";
import { APPS } from "../apps.js";

// App access fails closed: unticked everywhere = no access, and a non-admin
// with nothing ticked can't sign in at all (see auth-worker/README.md).
export default function EditUserModal({ user, isSelf, onClose, onSaved }) {
  const [username, setUsername] = useState(user.username);
  const [role, setRole] = useState(user.role);
  const [firstName, setFirstName] = useState(user.firstName || "");
  const [lastName, setLastName] = useState(user.lastName || "");
  const [email, setEmail] = useState(user.email || "");
  const [apps, setApps] = useState(new Set(user.apps || []));
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  function toggleApp(id) {
    setApps((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!username.trim() || !firstName.trim() || !lastName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const fields = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        apps: Array.from(apps),
      };
      if (!isSelf) {
        fields.newUsername = username.trim();
        fields.role = role;
      }
      await api.updateUser(user.username, fields);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Edit — ${user.username}`} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="edit-username">Username</label>
            <input
              id="edit-username"
              autoFocus
              value={username}
              disabled={isSelf}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="edit-role">Role</label>
            <select id="edit-role" value={role} disabled={isSelf} onChange={(e) => setRole(e.target.value)}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        {isSelf && (
          <div className="field-help" style={{ marginBottom: 12 }}>
            Role is locked for your own account — changing it would sign you out mid-edit; use another admin
            account. To change your own username, use the My Account tab instead — it handles the re-login properly.
          </div>
        )}
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="edit-first-name">First name</label>
            <input id="edit-first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="edit-last-name">Last name</label>
            <input id="edit-last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>
        <div className="field" style={{ marginBottom: 12 }}>
          <label htmlFor="edit-email">Email</label>
          <input id="edit-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 4 }}>
          <label>App access</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {APPS.map((app) => (
              <label key={app.id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 400 }}>
                <input type="checkbox" checked={apps.has(app.id)} onChange={() => toggleApp(app.id)} />
                {app.label}
              </label>
            ))}
          </div>
          {apps.size === 0 && role !== "admin" && (
            <span className="field-help" style={{ color: "var(--yellow)" }}>
              With no apps ticked, this person can't sign in at all.
            </span>
          )}
        </div>
        {error && <div className="login-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn-accent btn-sm" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
