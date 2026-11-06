import { useCallback, useEffect, useState } from "react";
import Loading from "../components/Loading.jsx";
import { changeErpLinks, getErpLinks, getErpRecord } from "./panelApi.js";
import { ERP_TYPES, ID_RE } from "./erpShared.js";
import { money } from "./format.js";

// The record open in Procore: read it, then offer whichever change applies to it.
export default function ErpRecord({ projectId, type, id, onNotFound, onShowAll, onSignedOut }) {
  const [row, setRow] = useState(null);
  const [error, setError] = useState(null);
  const [originId, setOriginId] = useState(null); // null = untouched, so the old ID can show
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState(null);
  const [stage, setStage] = useState("edit"); // edit | checking | confirm | running
  const [unchecked, setUnchecked] = useState(false);
  const [result, setResult] = useState(null); // { ok, message }

  const load = useCallback(() => {
    return getErpRecord(projectId, type, id)
      .then((d) => setRow(d.row))
      .catch((e) => {
        if (e.unauthorized) onSignedOut();
        else if (e.status === 404) onNotFound();
        else setError(e.message);
      });
  }, [projectId, type, id, onNotFound, onSignedOut]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <p className="panel-msg bad" role="alert">{error}</p>;
  if (!row) return <Loading />;

  const typeInfo = ERP_TYPES.find((t) => t.id === type);
  const label = row.number ?? `#${row.id}`;
  const linked = !!row.originId;
  const value = (originId ?? row.lastOriginId ?? "").trim();
  const busy = stage === "checking" || stage === "running";
  const ready = reason.trim().length >= 3 && (linked || ID_RE.test(value));

  // Two records on one NetSuite transaction is the mismatch this tool exists to fix, so look
  // for the ID on this type's records first. A failed check shouldn't stop a real fix, so the
  // confirm step says so instead.
  async function review() {
    setProblem(null);
    setResult(null);
    setUnchecked(false);
    if (linked) {
      setStage("confirm");
      return;
    }
    setStage("checking");
    try {
      const { rows } = await getErpLinks(projectId, type);
      const taken = rows.find((r) => r.originId === value && r.id !== row.id);
      if (taken) {
        setProblem(`That ID is already on ${taken.number ?? `#${taken.id}`}.`);
        setStage("edit");
        return;
      }
    } catch (e) {
      if (e.unauthorized) {
        onSignedOut();
        return;
      }
      setUnchecked(true);
    }
    setStage("confirm");
  }

  async function apply() {
    setStage("running");
    const change = linked
      ? { id: row.id, parent_id: row.parentId, action: "unlock" }
      : { id: row.id, parent_id: row.parentId, action: "lock", origin_id: value };
    try {
      const out = await changeErpLinks(projectId, type, reason.trim(), [change]);
      const r = out.results[0];
      if (r.ok) {
        setResult({ ok: true, message: linked ? "Unlocked. Procore confirms the link is gone." : `Locked to ${value}. Procore confirms it saved.` });
        setReason("");
        setOriginId(null);
        await load();
      } else {
        setResult({ ok: false, message: r.error });
      }
    } catch (e) {
      if (e.unauthorized) {
        onSignedOut();
        return;
      }
      setResult({ ok: false, message: e.message });
    }
    setStage("edit");
  }

  return (
    <div className="erp">
      <section className="panel-dc" aria-label={typeInfo?.one}>
        <div className="panel-dc-label">{typeInfo?.one}</div>
        <div className="panel-dc-number">{label}</div>
        <dl>
          {row.title && <><dt>Name</dt><dd>{row.title}</dd></>}
          {money(row.amount) !== "—" && <><dt>Total</dt><dd>{money(row.amount)}</dd></>}
          {row.status && <><dt>Status</dt><dd className="panel-cap">{row.status}</dd></>}
          <dt>ERP</dt><dd>{linked ? `Linked: ${row.originId}` : "Not linked"}</dd>
        </dl>
      </section>

      {stage !== "confirm" && stage !== "running" ? (
        <>
          {!linked && (
            <div className="field">
              <label htmlFor="erp-record-id">NetSuite ID</label>
              <input
                id="erp-record-id"
                value={originId ?? row.lastOriginId ?? ""}
                disabled={busy}
                onChange={(e) => {
                  setProblem(null);
                  setOriginId(e.target.value);
                }}
              />
              {originId === null && row.lastOriginId && <span className="panel-hint">Filled in from when it was last unlocked.</span>}
              {value && !ID_RE.test(value) && <span className="erp-problem">That doesn't look like a NetSuite ID.</span>}
              {problem && <span className="erp-problem">{problem}</span>}
            </div>
          )}
          <div className="field">
            <label htmlFor="erp-record-reason">Why? (required, saved with the change)</label>
            <input id="erp-record-reason" value={reason} disabled={busy} maxLength={300} onChange={(e) => setReason(e.target.value)} />
          </div>
          <button className="btn btn-accent panel-wide" disabled={!ready || busy} onClick={review}>
            {stage === "checking" ? "Checking…" : linked ? "Unlock" : "Lock"}
          </button>
        </>
      ) : (
        <div className="panel-confirm" role="group" aria-label="Confirm ERP link change">
          {linked ? (
            <p>Unlock <strong>{label}</strong> from NetSuite ID {row.originId}? Once unlocked, edits in Procore can stop it matching NetSuite.</p>
          ) : (
            <p>Lock <strong>{label}</strong> to NetSuite ID <strong>{value}</strong>? A wrong ID ties it to the wrong transaction.</p>
          )}
          {unchecked && <p className="erp-problem">Couldn't check whether this ID is already in use.</p>}
          <p className="panel-hint">Saved under your name, with your reason.</p>
          <div className="panel-actions">
            <button className="btn btn-accent" disabled={stage === "running"} onClick={apply}>{stage === "running" ? "Working…" : "Yes, apply"}</button>
            <button className="btn btn-ghost" disabled={stage === "running"} onClick={() => setStage("edit")}>Back</button>
          </div>
        </div>
      )}

      {result && <p className={`panel-msg ${result.ok ? "good" : "bad"}`} role="status">{result.message}</p>}

      <button className="panel-link" onClick={onShowAll}>Change several records</button>
    </div>
  );
}
