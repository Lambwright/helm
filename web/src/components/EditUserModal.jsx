import { useState } from "react";
import Modal from "./Modal.jsx";
import { api } from "../api.js";
import { APPS, ALL_APP_IDS } from "../apps.js";

// `user.apps === undefined` means unrestricted (every app) — see
// auth-worker/README.md. Editing always makes that explicit going forward:
// checking every box and saving writes the full list rather than leaving it
// implicit, which is more auditable from the user list.
export default function EditUserModal({ user, onClose, onSaved }) {
  const [firstName, setFirstName] = useState(user.firstName || "");
  const [lastName, setLastName] = useState(user.lastName || "");
  const [email, setEmail] = useState(user.email || "");
  const [apps, setApps] = useState(new Set(user.apps || ALL_APP_IDS));
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
    if (!firstName.trim() || !lastName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.updateUser(user.username, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        apps: Array.from(apps),
      });
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
            <label htmlFor="edit-first-name">First name</label>
            <input id="edit-first-name" autoFocus value={firstName} onChange={(e) => setFirstName(e.target.value)} />
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
          <span className="field-help">
            Note: apps enforce this themselves on their own schedule — some may not check it yet.
          </span>
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
