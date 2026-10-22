import { useEffect, useState } from "react";
import { getStoredToken } from "../auth.js";

// HELM has no backend of its own for the other suite apps either — this
// tab just calls crm-worker directly with the logged-in user's own Einbau ID
// token (same cross-app pattern as everything else in the suite; crm-worker's
// CORS is wide open for exactly this). Ben, 2026-09: "I want to be able to
// tune [the follow-up cadence] easily as we really roll this out" — rather
// than a CRM code deploy every time, this PATCHes crm-worker's own
// crm_settings row.
const CRM_API = "https://crm-worker.ben-a90.workers.dev";

const STAGE_LABELS = {
  rfq: "RFQ",
  invitation: "Invitation",
  estimating: "Estimating Queue",
  bid_submitted: "Submitted (30 days)",
  to_do: "S/I Queue",
  accepted: "Active (30-60 days)",
  in_progress: "Active (60-90+ days)",
  delayed: "Watch List",
};
const STAGE_ORDER = ["rfq", "invitation", "estimating", "bid_submitted", "to_do", "accepted", "in_progress", "delayed"];

async function crmRequest(path, options = {}) {
  const token = getStoredToken();
  const res = await fetch(`${CRM_API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.error || `HTTP ${res.status}`);
  return data;
}

export default function CrmOptions({ onToast }) {
  const [settings, setSettings] = useState(null);
  const [cadence, setCadence] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    crmRequest("/settings")
      .then((data) => {
        setSettings(data);
        setCadence(data.cadence);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const data = await crmRequest("/settings", {
        method: "PATCH",
        body: JSON.stringify({ followup_cadence_days: cadence }),
      });
      setSettings(data);
      onToast?.("CRM options saved.");
    } catch (e) {
      setError(e.message);
      onToast?.(e.message, true);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="empty-state">Loading…</div>;
  if (error && !settings) return <div className="card" style={{ color: "var(--red)" }}>{error}</div>;

  return (
    <div className="card">
      <div className="card-title">Follow-up cadence</div>
      <p className="field-help" style={{ marginBottom: 12 }}>
        Days an open bid can sit before it shows up on the Follow-ups tab. Applied when a bid enters a
        stage (and doesn't already have a later date someone picked by hand) — not retroactive to bids
        that already have a follow-up date set.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, marginBottom: 20 }}>
        {STAGE_ORDER.map((stage) => (
          <div className="field" key={stage}>
            <label>{STAGE_LABELS[stage]}</label>
            <input
              type="number"
              min="1"
              value={cadence[stage] ?? ""}
              onChange={(e) => setCadence((c) => ({ ...c, [stage]: Number(e.target.value) || null }))}
            />
          </div>
        ))}
      </div>

      {error && <div className="login-error" style={{ marginBottom: 12 }}>{error}</div>}
      <button className="btn btn-accent" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
      {settings?.updated_by && (
        <span className="field-help" style={{ marginLeft: 12 }}>
          Last saved by {settings.updated_by}
        </span>
      )}
    </div>
  );
}
