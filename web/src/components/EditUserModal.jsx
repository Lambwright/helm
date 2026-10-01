import { useState } from "react";
import Modal from "./Modal.jsx";
import { api } from "../api.js";
import { SUPER_ADMIN } from "../apps.js";
import RoleAccessEditor from "./RoleAccessEditor.jsx";

export default function EditUserModal({ user, isSelf, matrix, onClose, onSaved }) {
  const [username, setUsername] = useState(user.username);
  const [firstName, setFirstName] = useState(user.firstName || "");
  const [lastName, setLastName] = useState(user.lastName || "");
  const [email, setEmail] = useState(user.email || "");
  const [jobRole, setJobRole] = useState(user.jobRole || "project_manager");
  const [overrides, setOverrides] = useState(user.roleOverrides || {});
  const [legacyApps, setLegacyApps] = useState(new Set(user.legacyApps || []));
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const isSuperAdmin = user.jobRole === SUPER_ADMIN;

  function toggleLegacy(id) {
    setLegacyApps((prev) => {
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
        apps: Array.from(legacyApps),
      };
      if (!isSuperAdmin) {
        fields.jobRole = jobRole;
        fields.roleOverrides = Object.fromEntries(Object.entries(overrides).filter(([, r]) => r));
      }
      if (!isSelf) fields.newUsername = username.trim();
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
        <div className="field" style={{ marginBottom: 12 }}>
          <label htmlFor="edit-username">Username</label>
          <input id="edit-username" autoFocus value={username} disabled={isSelf} onChange={(e) => setUsername(e.target.value)} />
          {isSelf && <span className="field-help">Change your own username from My Account — it handles the re-login properly.</span>}
        </div>
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
        <RoleAccessEditor
          matrix={matrix}
          jobRole={isSuperAdmin ? SUPER_ADMIN : jobRole}
          onJobRoleChange={setJobRole}
          overrides={overrides}
          onOverrideChange={(appId, roleId) => setOverrides((prev) => ({ ...prev, [appId]: roleId }))}
          legacyApps={legacyApps}
          onLegacyToggle={toggleLegacy}
          locked={isSuperAdmin}
        />
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
