import { useState } from "react";
import { api } from "../api.js";
import { APPS } from "../apps.js";
import { ACCENT_PRESETS, applyAccentPreset } from "../accentPresets.js";

function ProfileSection({ user, onUserUpdated, onToast }) {
  const [username, setUsername] = useState(user.username);
  const [firstName, setFirstName] = useState(user.firstName || "");
  const [lastName, setLastName] = useState(user.lastName || "");
  const [email, setEmail] = useState(user.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const renaming = username.trim().toLowerCase() !== user.username.toLowerCase();

  async function handleSubmit(e) {
    e.preventDefault();
    if (renaming && !currentPassword) return;
    setBusy(true);
    setError(null);
    try {
      const fields = { firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() };
      if (renaming) {
        fields.newUsername = username.trim();
        fields.currentPassword = currentPassword;
      }
      const data = await api.updateProfile(fields);
      onUserUpdated(data.user);
      setCurrentPassword("");
      onToast(renaming ? `Username changed to ${data.user.username}.` : "Profile updated.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="field" style={{ marginBottom: 12 }}>
        <label htmlFor="my-username">Username</label>
        <input id="my-username" value={username} onChange={(e) => setUsername(e.target.value)} />
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="my-first-name">First name</label>
          <input id="my-first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="my-last-name">Last name</label>
          <input id="my-last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
      </div>
      <div className="field" style={{ marginBottom: 12 }}>
        <label htmlFor="my-email">Email</label>
        <input id="my-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      {renaming && (
        <div className="field" style={{ marginBottom: 12 }}>
          <label htmlFor="my-username-password">Current password</label>
          <input
            id="my-username-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <span className="field-help">Required to change your username — confirms it's really you.</span>
        </div>
      )}
      {error && <div className="login-error" style={{ marginBottom: 10 }}>{error}</div>}
      <button className="btn btn-accent btn-sm" type="submit" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button>
    </form>
  );
}

function PasswordSection({ onToast }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onToast("Password changed. Your other sessions have been signed out.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="field" style={{ marginBottom: 12 }}>
        <label htmlFor="current-password">Current password</label>
        <input
          id="current-password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="new-password-self">New password</label>
          <input
            id="new-password-self"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="confirm-password-self">Confirm new password</label>
          <input
            id="confirm-password-self"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
      </div>
      <span className="field-help" style={{ display: "block", marginBottom: 10 }}>
        This signs you out of every other session — this one stays logged in.
      </span>
      {error && <div className="login-error" style={{ marginBottom: 10 }}>{error}</div>}
      <button className="btn btn-accent btn-sm" type="submit" disabled={busy}>{busy ? "Changing…" : "Change password"}</button>
    </form>
  );
}

function AppAccessSection({ user }) {
  const accessible = user.apps
    ? APPS.filter((app) => user.apps.includes(app.id))
    : APPS;

  return (
    <div>
      {!user.apps && <div className="field-help" style={{ marginBottom: 10 }}>Full access — no restrictions set.</div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {accessible.length === 0 ? (
          <span className="field-help">No app access granted yet.</span>
        ) : (
          accessible.map((app) => (
            <a key={app.id} className="badge badge-active" href={app.url} style={{ textDecoration: "none" }}>
              {app.label}
            </a>
          ))
        )}
      </div>
      <span className="field-help" style={{ display: "block", marginTop: 10 }}>
        Read-only — ask an admin in HELM to change what you can access.
      </span>
    </div>
  );
}

function AppearanceSection({ user, onUserUpdated, onToast }) {
  const [busy, setBusy] = useState(null); // preset id currently saving

  async function choose(presetId) {
    setBusy(presetId);
    applyAccentPreset(presetId);
    try {
      const data = await api.updateProfile({ themeAccent: presetId });
      onUserUpdated(data.user);
      onToast("Appearance updated.");
    } catch (err) {
      onToast(err.message, true);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      {ACCENT_PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={busy === preset.id}
          onClick={() => choose(preset.id)}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            borderColor: user.themeAccent === preset.id ? preset.accent : undefined,
          }}
        >
          <span style={{ width: 12, height: 12, borderRadius: "50%", background: preset.accent, display: "inline-block" }} />
          {preset.label}
        </button>
      ))}
    </div>
  );
}

function SessionsSection({ user, onToast }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    try {
      await api.logoutEverywhere();
      setConfirming(false);
      onToast("Signed out of every other session. This one stays logged in.");
    } catch (err) {
      onToast(err.message, true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="field-help" style={{ marginBottom: 12 }}>
        Last login: {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "—"}
        {user.lastLoginIp ? ` from ${user.lastLoginIp}` : ""}
      </div>
      {!confirming ? (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming(true)}>
          Sign out everywhere else
        </button>
      ) : (
        <div>
          <div className="field-help" style={{ marginBottom: 8 }}>
            This signs out every other device/browser signed in as you. This one stays logged in. Sure?
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming(false)} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger btn-sm" onClick={handleConfirm} disabled={busy}>
              {busy ? "Signing out…" : "Yes, sign out everywhere else"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MyAccount({ user, onUserUpdated, onToast }) {
  return (
    <>
      <div className="card">
        <div className="card-title">Profile</div>
        <ProfileSection user={user} onUserUpdated={onUserUpdated} onToast={onToast} />
      </div>
      <div className="card">
        <div className="card-title">Password</div>
        <PasswordSection onToast={onToast} />
      </div>
      <div className="card">
        <div className="card-title">Sessions</div>
        <SessionsSection user={user} onToast={onToast} />
      </div>
      <div className="card">
        <div className="card-title">My app access</div>
        <AppAccessSection user={user} />
      </div>
      <div className="card">
        <div className="card-title">Appearance</div>
        <AppearanceSection user={user} onUserUpdated={onUserUpdated} onToast={onToast} />
      </div>
    </>
  );
}
