import { useEffect, useRef, useState } from "react";
import { getStoredToken } from "../auth.js";
import { jobRoleLabel } from "../apps.js";

// Same suite switcher every other app carries — keep the list and the
// visibility rule below identical across apps.
const APP_LINKS = [
  { name: "PUNCH", url: "https://lambwright.github.io/PUNCH/" },
  { name: "SCOUT", url: "https://lambwright.github.io/scout-addin/app.html" },
  { name: "INTAKE", url: "https://lambwright.github.io/scout-intake/" },
  { name: "TALLY", url: "https://lambwright.github.io/tally/" },
  { name: "HANDOFF", url: "https://lambwright.github.io/handoff/" },
  { name: "LEDGER", url: "https://lambwright.github.io/ledger/" },
  { name: "CRM", url: "https://lambwright.github.io/crm/" },
];
const HELM_LINK = { name: "HELM", url: "https://lambwright.github.io/helm/" };
const CURRENT_APP = "HELM";

// Only apps this user can open, then HELM always last (it's where settings
// live). No apps granted = nothing but this app and HELM (access fails
// closed — see auth-worker/README.md).
function appLinks(user) {
  const apps = (Array.isArray(user?.apps) ? user.apps : []).map((a) => String(a).toUpperCase());
  const allowed = (name) => apps.includes(name);
  return [...APP_LINKS.filter((a) => a.name === CURRENT_APP || allowed(a.name)), HELM_LINK].map((a) => ({
    ...a,
    current: a.name === CURRENT_APP,
  }));
}

export default function Header({ user, onLogout, onToast }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  async function copyToken() {
    const token = getStoredToken();
    if (!token) {
      onToast?.("No token in storage — try logging in again.", true);
      return;
    }
    try {
      await navigator.clipboard.writeText(token);
      onToast?.("Session token copied to clipboard.");
    } catch {
      onToast?.("Couldn't copy — clipboard access blocked.", true);
    }
  }

  return (
    <div className="header">
      <div className="header-badge app-switcher" ref={ref}>
        <span
          className="header-badge-name"
          style={{ cursor: "pointer" }}
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        >
          HELM<span className="app-switcher-caret">▾</span>
        </span>
        <span className="header-badge-sub">Einbau ID Admin</span>
        <span className="header-brand-tag">An Einbau Product</span>
        {open && (
          <div className="app-switcher-menu">
            {appLinks(user).map((app) =>
              app.comingSoon ? (
                <div className="app-switcher-item disabled" key={app.name}>
                  {app.name}<span className="app-switcher-soon">COMING SOON</span>
                </div>
              ) : (
                <a className={`app-switcher-item${app.current ? " current" : ""}`} href={app.url} key={app.name}>
                  {app.name}
                </a>
              )
            )}
          </div>
        )}
      </div>
      {user && (
        <div className="header-user">
          <span className="header-username">{user.displayName || user.username}</span>
          {user.jobRole && <span className="header-role">{jobRoleLabel(user.jobRole)}</span>}
          <button className="btn btn-ghost btn-sm" onClick={copyToken} title="Copy your current session token to the clipboard">
            Copy token
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onLogout}>Log out</button>
        </div>
      )}
    </div>
  );
}
