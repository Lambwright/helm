import { useCallback, useEffect, useRef, useState } from "react";
import { getStoredToken, verify, logout as doLogout } from "../auth.js";
import { applyTheme, resetTheme } from "../accentPresets.js";
import LoginScreen from "../components/LoginScreen.jsx";
import Loading from "../components/Loading.jsx";
import { connectProcorePanel, isDirectCostView, isEmbedded } from "./procoreContext.js";
import { attachFiles, getDirectCost } from "./panelApi.js";
import ErpLinks from "./ErpLinks.jsx";
import { fileSize, money, refresh } from "./format.js";
import "./panel.css";

const MAX_FILES = 10;
const MAX_BYTES = 20 * 1024 * 1024;
const CONTEXT_WAIT_MS = 4000;
const THEME_CHECK_MS = 60 * 1000;

function Note({ title, children, action = true }) {
  return (
    <div className="panel-note">
      <h1>{title}</h1>
      {children}
      {action && <button className="btn btn-ghost btn-sm" onClick={refresh}>Refresh</button>}
    </div>
  );
}

export default function ProcorePanel() {
  const [authState, setAuthState] = useState("checking"); // checking | out | in
  const [user, setUser] = useState(null);
  const [context, setContext] = useState(null);
  const [waited, setWaited] = useState(false);
  const [tab, setTab] = useState(null); // null = the page's default
  const lastThemeCheck = useRef(0);

  const signedIn = useCallback((u) => {
    setUser(u);
    applyTheme(u);
    setAuthState("in");
  }, []);

  const signedOut = useCallback(() => {
    doLogout();
    resetTheme();
    setUser(null);
    setAuthState("out");
  }, []);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setAuthState("out");
      return;
    }
    verify(token).then((data) => {
      if (data.valid) signedIn(data.user);
      else setAuthState("out");
    });
  }, [signedIn]);

  // A colour or light/dark change made in HELM shows up without a reload: the panel
  // re-reads the person whenever Procore shows it or it gets focus, at most once a minute.
  const recheckTheme = useCallback(() => {
    const token = getStoredToken();
    if (!token || Date.now() - lastThemeCheck.current < THEME_CHECK_MS) return;
    lastThemeCheck.current = Date.now();
    verify(token).then((data) => {
      if (data.valid) {
        setUser(data.user);
        applyTheme(data.user);
      }
    });
  }, []);

  useEffect(() => {
    document.title = "Einbau tools";
    const stop = connectProcorePanel({ onContext: setContext, onVisible: recheckTheme });
    const timer = setTimeout(() => setWaited(true), CONTEXT_WAIT_MS);
    window.addEventListener("focus", recheckTheme);
    return () => {
      stop();
      clearTimeout(timer);
      window.removeEventListener("focus", recheckTheme);
    };
  }, [recheckTheme]);

  if (authState === "checking") return <div className="panel"><Loading /></div>;
  if (authState === "out") return <LoginScreen onLoggedIn={signedIn} />;

  // The screen only decides what to offer. The worker enforces the same permission.
  const canChangeErp = !!user?.appExtras?.TALLY?.includes("erp_link");
  const onDirectCosts = !!context && isDirectCostView(context.view);
  const dcOpen = onDirectCosts && !!context.recordId;

  let body;
  if (!isEmbedded()) {
    body = <Note title="Open this from Procore" action={false}><p>This panel works from the side of a Procore page.</p></Note>;
  } else if (!context) {
    body = waited
      ? <Note title="Procore didn't say which page this is"><p>Refresh the panel to try again.</p></Note>
      : <Loading />;
  } else {
    const tabs = [
      ...(onDirectCosts ? [{ key: "attach", label: "Attach files" }] : []),
      ...(canChangeErp ? [{ key: "erp", label: "ERP links" }] : []),
    ];
    const active = tabs.some((t) => t.key === tab) ? tab : dcOpen || !canChangeErp ? "attach" : "erp";
    let content;
    if (active === "erp") {
      content = <ErpLinks projectId={context.projectId} view={context.view} openRecordId={context.recordId} onSignedOut={signedOut} />;
    } else if (dcOpen) {
      content = <DirectCostAttach key={context.recordId} projectId={context.projectId} id={context.recordId} onSignedOut={signedOut} />;
    } else if (onDirectCosts) {
      content = <Note title="Open a Direct Cost first"><p>Pick one from the list, then refresh this panel if it doesn't update.</p></Note>;
    } else {
      content = <Note title="Direct Costs only for now"><p>Open a Direct Cost to add files to it. If you've already opened one, refresh this panel.</p></Note>;
    }
    body = (
      <>
        {tabs.length > 1 && (
          <div className="tabs" role="tablist">
            {tabs.map((t) => (
              <button key={t.key} role="tab" aria-selected={active === t.key} className={`tab ${active === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
                {t.label}
              </button>
            ))}
          </div>
        )}
        {content}
      </>
    );
  }
  return (
    <div className="panel-page">
      <header className="panel-header">
        <span className="panel-header-name">Einbau tools</span>
        <span className="panel-header-sub">An Einbau Product</span>
      </header>
      <main className="panel">{body}</main>
    </div>
  );
}

function DirectCostAttach({ projectId, id, onSignedOut }) {
  const [dc, setDc] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [files, setFiles] = useState([]);
  const [problem, setProblem] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { ok, message }
  const input = useRef(null);

  useEffect(() => {
    let live = true;
    getDirectCost(projectId, id)
      .then((d) => live && setDc(d.directCost))
      .catch((e) => {
        if (!live) return;
        if (e.unauthorized) onSignedOut();
        else setLoadError(e.message);
      });
    return () => {
      live = false;
    };
  }, [projectId, id, onSignedOut]);

  function addFiles(list) {
    setResult(null);
    setConfirming(false);
    const next = [...files];
    const empties = [];
    for (const f of list) {
      if (!f.size) empties.push(f.name);
      else if (!next.some((x) => x.name === f.name && x.size === f.size)) next.push(f);
    }
    if (next.length > MAX_FILES) setProblem(`Up to ${MAX_FILES} files at a time.`);
    else if (next.reduce((n, f) => n + f.size, 0) > MAX_BYTES) setProblem("That's over the 20 MB limit for one upload.");
    else {
      setProblem(empties.length ? `Skipped an empty file: ${empties.join(", ")}` : null);
      setFiles(next);
    }
  }

  async function upload() {
    setBusy(true);
    setResult(null);
    try {
      const out = await attachFiles(projectId, id, files);
      setDc(out.directCost);
      setFiles([]);
      setResult({ ok: true, message: `Added ${out.attached.join(", ")}.` });
    } catch (e) {
      if (e.unauthorized) {
        onSignedOut();
        return;
      }
      if (e.data?.directCost) setDc(e.data.directCost);
      // The file may have landed, so don't leave it one click from going on twice.
      if (e.code === "unverified" || e.code === "not_confirmed") setFiles([]);
      setResult({ ok: false, message: e.message });
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  if (loadError) return <Note title="Couldn't open this Direct Cost"><p>{loadError}</p></Note>;
  if (!dc) return <Loading />;

  const label = dc.number || `#${dc.id}`;
  const count = `${files.length} file${files.length === 1 ? "" : "s"}`;

  return (
    <div
      className={`panel-drop-target ${dragging ? "dragging" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!busy) setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!busy) addFiles([...e.dataTransfer.files]);
      }}
    >
      <section className="panel-dc" aria-label="Direct Cost">
        <div className="panel-dc-label">Direct Cost</div>
        <div className="panel-dc-number">{label}</div>
        <dl>
          <dt>Vendor</dt><dd>{dc.vendor || "—"}</dd>
          <dt>Total</dt><dd>{money(dc.total)}</dd>
          <dt>Status</dt><dd className="panel-cap">{dc.status || "—"}</dd>
          <dt>ERP</dt><dd>{dc.erpLinked ? "Linked to NetSuite" : "Not linked"}</dd>
        </dl>
        <button className="panel-link" onClick={refresh}>Not the one you have open? Refresh</button>
      </section>

      <button type="button" className="panel-zone" disabled={busy} onClick={() => input.current?.click()}>
        <strong>Drop files here</strong>
        <span>or click to choose. Up to {MAX_FILES} files, 20 MB in total.</span>
      </button>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          addFiles([...e.target.files]);
          e.target.value = "";
        }}
      />

      {problem && <p className="panel-msg bad" role="alert">{problem}</p>}

      {files.length > 0 && (
        <ul className="panel-files">
          {files.map((f) => (
            <li key={`${f.name}-${f.size}`}>
              <span className="panel-file-name" title={f.name}>{f.name}</span>
              <span className="panel-file-size">{fileSize(f.size)}</span>
              <button
                aria-label={`Remove ${f.name}`}
                disabled={busy}
                onClick={() => {
                  setFiles(files.filter((x) => x !== f));
                  setConfirming(false);
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {files.length > 0 && !confirming && (
        <button className="btn btn-accent panel-wide" onClick={() => setConfirming(true)}>Attach {count}</button>
      )}

      {confirming && (
        <div className="panel-confirm" role="group" aria-label="Confirm upload">
          <p>Add {count} to <strong>{label}</strong> ({dc.vendor || "no vendor"}, {money(dc.total)})?</p>
          <p className="panel-hint">Check this matches the Direct Cost you have open. You may not be able to remove a file from a locked one.</p>
          <div className="panel-actions">
            <button className="btn btn-accent" disabled={busy} onClick={upload}>{busy ? "Attaching…" : "Yes, attach"}</button>
            <button className="btn btn-ghost" disabled={busy} onClick={() => setConfirming(false)}>Cancel</button>
          </div>
        </div>
      )}

      {result && <p className={`panel-msg ${result.ok ? "good" : "bad"}`} role="status">{result.message}</p>}

      <section className="panel-existing" aria-label="Files on this Direct Cost">
        <div className="panel-dc-label">On this Direct Cost ({dc.attachments.length})</div>
        {dc.attachments.length === 0
          ? <p className="panel-hint">No files yet.</p>
          : <ul>{dc.attachments.map((a) => <li key={a.id} title={a.name}>{a.name}</li>)}</ul>}
      </section>
    </div>
  );
}
