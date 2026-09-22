import { useState } from "react";
import Modal from "./Modal.jsx";
import { api } from "../api.js";

export default function CreateUserModal({ onClose, onCreated }) {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!username.trim() || !displayName.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      await api.createUser({
        username: username.trim(),
        displayName: displayName.trim(),
        password,
        role,
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
        <div className="field" style={{ marginBottom: 12 }}>
          <label htmlFor="new-display-name">Display name</label>
          <input id="new-display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
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
        <div className="field" style={{ marginBottom: 4 }}>
          <label htmlFor="new-role">Role</label>
          <select id="new-role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
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
