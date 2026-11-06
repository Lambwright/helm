import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Loading from "../components/Loading.jsx";
import { changeErpLinks, getErpLinks } from "./panelApi.js";
import { erpTypeForView } from "./procoreContext.js";
import { ERP_TYPES, ID_RE, plural } from "./erpShared.js";
import { money } from "./format.js";
import ErpRecord from "./ErpRecord.jsx";

// The worker takes 5 per request, to stay under its subrequest ceiling. A Direct Cost's
// lines make it a variable number of calls, so those go one at a time.
const chunkFor = (type) => (type === "direct_cost" ? 1 : 5);

// What's wrong with each ID typed for a record being locked. Two records pointing at one
// NetSuite transaction is the mismatch this tool exists to fix, so a repeat is blocked.
function findIdProblems(lockRows, rows, ids) {
  const problems = {};
  const typed = lockRows.map((r) => (ids[r.id] ?? r.lastOriginId ?? "").trim());
  lockRows.forEach((r, i) => {
    const v = typed[i];
    const label = (x) => x.number || `#${x.id}`;
    const taken = rows.find((x) => x.originId === v);
    if (!v) problems[r.id] = "Enter the NetSuite ID.";
    else if (!ID_RE.test(v)) problems[r.id] = "That doesn't look like a NetSuite ID.";
    else if (taken) problems[r.id] = `Already on ${label(taken)}.`;
    else if (typed.indexOf(v) !== i) problems[r.id] = "Used on another row here.";
  });
  return problems;
}

// On a record, this is that record's settings. The checkbox list is for list pages,
// for changing several at once, and for a page whose record can't be matched.
export default function ErpLinks({ projectId, view, openRecordId, onSignedOut }) {
  const [showAll, setShowAll] = useState(!openRecordId);
  const [unmatched, setUnmatched] = useState(false);
  const showList = useCallback(() => setShowAll(true), []);
  const noMatch = useCallback(() => {
    setUnmatched(true);
    setShowAll(true);
  }, []);

  if (!showAll) {
    return (
      <ErpRecord
        projectId={projectId}
        type={erpTypeForView(view)}
        id={openRecordId}
        onNotFound={noMatch}
        onShowAll={showList}
        onSignedOut={onSignedOut}
      />
    );
  }
  return (
    <>
      {unmatched && <p className="panel-msg erp-note">Couldn't match this page to one record, so here's the list.</p>}
      {openRecordId && !unmatched && (
        <button className="panel-link erp-back" onClick={() => setShowAll(false)}>Back to this record</button>
      )}
      <ErpList projectId={projectId} view={view} openRecordId={openRecordId} onSignedOut={onSignedOut} />
    </>
  );
}

function ErpList({ projectId, view, openRecordId, onSignedOut }) {
  const [type, setType] = useState(() => erpTypeForView(view));
  const [rows, setRows] = useState(null);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [show, setShow] = useState("all"); // all | linked | unlinked
  const [selected, setSelected] = useState(() => new Set());
  const [ids, setIds] = useState({});
  const [reason, setReason] = useState("");
  const [stage, setStage] = useState("edit"); // edit | confirm | running
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState({});
  const [summary, setSummary] = useState(null); // { ok, message }
  const selectAll = useRef(null);

  const load = useCallback(() => {
    setError(null);
    return getErpLinks(projectId, type)
      .then((d) => {
        setRows(d.rows);
        setTruncated(!!d.truncated);
      })
      .catch((e) => {
        if (e.unauthorized) onSignedOut();
        else setError(e.message);
      });
  }, [projectId, type, onSignedOut]);

  useEffect(() => {
    setRows(null);
    setSelected(new Set());
    setIds({});
    setResults({});
    setSummary(null);
    setStage("edit");
    load();
  }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (rows || []).filter((r) => {
      if (show === "linked" && !r.originId) return false;
      if (show === "unlinked" && r.originId) return false;
      return !q || [r.number, r.title, r.originId].some((v) => String(v ?? "").toLowerCase().includes(q));
    });
    // The record open in Procore goes first.
    return [...list].sort((a, b) => (b.id === openRecordId) - (a.id === openRecordId));
  }, [rows, search, show, openRecordId]);

  const chosen = (rows || []).filter((r) => selected.has(r.id));
  const unlockRows = chosen.filter((r) => r.originId);
  const lockRows = chosen.filter((r) => !r.originId);
  const idProblems = findIdProblems(lockRows, rows || [], ids);
  const allShown = visible.length > 0 && visible.every((r) => selected.has(r.id));
  const someShown = visible.some((r) => selected.has(r.id));
  const running = stage === "running";
  const canReview = chosen.length > 0 && reason.trim().length >= 3 && Object.keys(idProblems).length === 0;

  useEffect(() => {
    if (selectAll.current) selectAll.current.indeterminate = someShown && !allShown;
  }, [someShown, allShown]);

  function toggle(id) {
    setStage("edit");
    setSummary(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleShown() {
    setStage("edit");
    setSummary(null);
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of visible) {
        if (allShown) next.delete(r.id);
        else next.add(r.id);
      }
      return next;
    });
  }

  async function apply() {
    setStage("running");
    setProgress(0);
    setResults({});
    setSummary(null);
    const changes = [
      ...unlockRows.map((r) => ({ id: r.id, parent_id: r.parentId, action: "unlock" })),
      ...lockRows.map((r) => ({ id: r.id, parent_id: r.parentId, action: "lock", origin_id: (ids[r.id] ?? r.lastOriginId ?? "").trim() })),
    ];
    const done = {};
    let stopped = null;
    const chunk = chunkFor(type);
    for (let i = 0; i < changes.length && !stopped; i += chunk) {
      const batch = changes.slice(i, i + chunk);
      try {
        const out = await changeErpLinks(projectId, type, reason.trim(), batch);
        for (const r of out.results) done[r.id] = r;
      } catch (e) {
        if (e.unauthorized) {
          onSignedOut();
          return;
        }
        stopped = e.message;
      }
      setResults({ ...done });
      setProgress(Object.keys(done).length);
    }
    const good = Object.values(done).filter((r) => r.ok).length;
    const bad = Object.values(done).filter((r) => !r.ok).length;
    const notRun = changes.length - good - bad;
    const parts = [`${plural(good, "record")} changed`];
    if (bad) parts.push(`${bad} failed`);
    if (notRun) parts.push(`${notRun} not attempted`);
    setSummary({ ok: !bad && !notRun, message: `${parts.join(", ")}.${stopped ? ` ${stopped}` : ""}` });
    setSelected(new Set(chosen.filter((r) => !done[r.id]?.ok).map((r) => r.id)));
    setStage("edit");
    await load();
  }

  return (
    <div className="erp">
      <div className="field">
        <label htmlFor="erp-type">Records on this project</label>
        <select id="erp-type" value={type} disabled={running} onChange={(e) => setType(e.target.value)}>
          {ERP_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </div>

      {error && <p className="panel-msg bad" role="alert">{error}</p>}
      {!rows && !error && <Loading />}

      {rows && (
        <>
          <div className="erp-filters">
            <input aria-label="Search records" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select aria-label="Show" value={show} onChange={(e) => setShow(e.target.value)}>
              <option value="all">All</option>
              <option value="linked">Linked</option>
              <option value="unlinked">Not linked</option>
            </select>
          </div>

          {visible.length === 0 ? (
            <p className="panel-hint">{rows.length ? "Nothing matches." : "No records of this type on this project."}</p>
          ) : (
            <label className="erp-all">
              <input ref={selectAll} type="checkbox" checked={allShown} disabled={running} onChange={toggleShown} />
              <span>Select all shown ({visible.length})</span>
            </label>
          )}

          <ul className="erp-rows">
            {visible.map((r) => {
              const isOn = selected.has(r.id);
              const result = results[r.id];
              return (
                <li key={r.id} className={`erp-row ${isOn ? "on" : ""}`}>
                  <label>
                    <input type="checkbox" checked={isOn} disabled={running} onChange={() => toggle(r.id)} />
                    <span className="erp-row-main">
                      <span className="erp-row-top">
                        <strong title={String(r.number ?? "")}>{r.number ?? `#${r.id}`}</strong>
                        {r.id === openRecordId && <span className="erp-open">Open</span>}
                      </span>
                      {r.title && <span className="erp-row-sub" title={r.title}>{r.title}</span>}
                      <span className="erp-row-sub">{[money(r.amount) !== "—" ? money(r.amount) : null, r.status].filter(Boolean).join(" · ")}</span>
                      <span className={`erp-state ${r.originId ? "linked" : ""}`}>{r.originId ? `Linked: ${r.originId}` : "Not linked"}</span>
                    </span>
                  </label>
                  {isOn && !r.originId && (
                    <div className="erp-id">
                      <input
                        aria-label={`NetSuite ID for ${r.number ?? r.id}`}
                        placeholder="NetSuite ID"
                        disabled={running}
                        value={ids[r.id] ?? r.lastOriginId ?? ""}
                        onChange={(e) => {
                          setStage("edit");
                          setIds({ ...ids, [r.id]: e.target.value });
                        }}
                      />
                      {r.lastOriginId && <span className="panel-hint">Filled in from when it was last unlocked.</span>}
                      {idProblems[r.id] && <span className="erp-problem">{idProblems[r.id]}</span>}
                    </div>
                  )}
                  {result && <p className={`erp-result ${result.ok ? "good" : "bad"}`}>{result.ok ? "Done" : result.error}</p>}
                </li>
              );
            })}
          </ul>
          {truncated && <p className="panel-hint">Showing the first 500. Use search if a record is missing.</p>}
        </>
      )}

      {summary && <p className={`panel-msg ${summary.ok ? "good" : "bad"}`} role="status">{summary.message}</p>}

      {chosen.length > 0 && (
        <div className="erp-bar">
          <div className="erp-bar-count">
            {unlockRows.length > 0 && <span>Unlock {unlockRows.length}</span>}
            {lockRows.length > 0 && <span>Lock {lockRows.length}</span>}
          </div>
          {stage !== "confirm" ? (
            <>
              <div className="field">
                <label htmlFor="erp-reason">Why? (required, saved with the change)</label>
                <input id="erp-reason" value={reason} disabled={running} maxLength={300} onChange={(e) => setReason(e.target.value)} />
              </div>
              <button className="btn btn-accent panel-wide" disabled={!canReview || running} onClick={() => setStage("confirm")}>
                {running ? `Working… ${progress} of ${chosen.length}` : "Review"}
              </button>
            </>
          ) : (
            <div role="group" aria-label="Confirm ERP link changes">
              {unlockRows.length > 0 && (
                <p>Unlock {plural(unlockRows.length, "record")}? Once unlocked, edits in Procore can stop it matching NetSuite.</p>
              )}
              {lockRows.length > 0 && (
                <p>Lock {plural(lockRows.length, "record")} to the NetSuite IDs entered? A wrong ID ties the record to the wrong transaction.</p>
              )}
              <p className="panel-hint">Saved under your name, with your reason.</p>
              <div className="panel-actions">
                <button className="btn btn-accent" onClick={apply}>Yes, apply</button>
                <button className="btn btn-ghost" onClick={() => setStage("edit")}>Back</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
