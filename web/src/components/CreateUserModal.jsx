import { useState } from "react";
import Modal from "./Modal.jsx";
import { api } from "../api.js";
import { APPS, ALL_APP_IDS } from "../apps.js";

export default function CreateUserModal({ onClose, onCreated }) {
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [apps, setApps] = useState(new Set(ALL_APP_IDS));
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
    if (!username.trim() || !firstName.trim() || !lastName.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      await api.createUser({
        username: username.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
        role,
        apps: Array.from(apps),
      });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="New Einbau ID user" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="field" style={{ marginBottom: 12 }}>
          <label htmlFor="new-username">Username</label>
          <input id="new-username" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="new-first-name">First name</label>
            <input id="new-first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="new-last-name">Last name</label>
            <input id="new-last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>
        <div className="field" style={{ marginBottom: 12 }}>
          <label htmlFor="new-email">Email</label>
          <input id="new-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 12 }}>
          <label htmlFor="new-password">Temporary password</label>
          <input
            id="new-password"
            type="text"
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <span className="field-help">They can't reset it themselves yet — hand this off directly.</span>
        </div>
        <div className="field" style={{ marginBottom: 12 }}>
          <label htmlFor="new-role">Role</label>
          <select id="new-role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
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
        </div>
        {error && <div className="login-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn-accent btn-sm" disabled={busy}>
            {busy ? "Creating…" : "Create user"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
