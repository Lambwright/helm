import { useState } from "react";
import Modal from "./Modal.jsx";
import { api } from "../api.js";

export default function SetPasswordModal({ username, onClose, onDone }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    setError(null);
    try {
      await api.setPassword(username, password);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Set password — ${username}`} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="modal-body">
          This immediately invalidates {username}'s existing sessions — they'll need to log in again.
        </div>
        <div className="field" style={{ marginBottom: 4 }}>
          <label htmlFor="set-password">New password</label>
          <input
            id="set-password"
            type="text"
            autoFocus
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <div className="login-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn-accent btn-sm" disabled={busy}>
            {busy ? "Setting…" : "Set password"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
