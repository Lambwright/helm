import { useEffect, useRef, useState } from "react";
import { getStoredToken } from "../auth.js";

// Same suite switcher every other app carries (ported from TALLY, itself from
// scout-intake's). LEDGER is left out on purpose — its Einbau ID status is
// still unconfirmed as of this writing (see kickoff prompt); add it once that's
// settled rather than guessing. PUNCH used to be Ben-only so this gated the link
// to him (comingSoon: !isOwner) — stale now that PUNCH has real multi-user
// access with its own backend auth and a restricted view for non-admins; the
// link is live for everyone here, and PUNCH's own login enforces access on
// click-through.
function appLinks() {
  return [
    { name: "PUNCH", url: "https://lambwright.github.io/PUNCH/" },
    { name: "SCOUT", url: "https://lambwright.github.io/scout-addin/app.html" },
    { name: "INTAKE", url: "https://lambwright.github.io/scout-intake/" },
    { name: "TALLY", url: "https://lambwright.github.io/tally/" },
    { name: "HANDOFF", url: "https://lambwright.github.io/handoff/" },
    { name: "HELM", url: "https://lambwright.github.io/helm/", current: true },
    { name: "CRM", url: "https://lambwright.github.io/crm/" },
  ];
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
            {appLinks().map((app) =>
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
          {user.role === "admin" && <span className="header-role">Admin</span>}
          <button className="btn btn-ghost btn-sm" onClick={copyToken} title="Copy your current session token to the clipboard">
            Copy token
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onLogout}>Log out</button>
        </div>
      )}
    </div>
  );
}
