import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import Loading from "./Loading.jsx";

// Super Admin, or anyone with HELM's "Security dashboard" tool permission.
// Sign-ins, refused requests, admin changes and per-app traffic. Data comes
// from auth-worker's security event store (and Cloudflare for traffic).

const COUNTRY_HOME = ["CA", "US"];

function when(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const today = new Date().toDateString() === d.toDateString();
    return d.toLocaleString(undefined, today ? { hour: "numeric", minute: "2-digit" } : { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return iso;
  }
}

const OUTCOME_LABELS = {
  success: "Signed in",
  bad_password: "Wrong password",
  unknown_user: "No such user",
  archived: "Archived account",
  rate_limited: "Locked out",
  no_app_access: "No app access",
  missing_token: "Not signed in",
  invalid_signature: "Forged/garbled session",
  expired: "Session expired",
  revoked: "Session revoked",
  unauthorized: "Bad server key",
  // reported by the apps themselves (type "app")
  no_token: "No sign-in",
  bad_session: "Bad/expired sign-in",
  forbidden: "Not allowed",
  bad_service_key: "Bad server key",
  other: "Refused",
};

function outcomeLabel(e) {
  if (e.type === "admin") return e.outcome.replace(/_/g, " ");
  return OUTCOME_LABELS[e.outcome] || e.outcome;
}

function place(e) {
  const p = [e.city, e.country].filter(Boolean).join(", ");
  return p || "—";
}

function Pill({ level, children }) {
  const cls = level === "high" ? "pill-bad" : level === "medium" ? "pill-warn" : level === "ok" ? "pill-ok" : "pill-info";
  return <span className={`sec-pill ${cls}`}>{children}</span>;
}

export default function Security({ onToast, onUnauthorized }) {
  const [summary, setSummary] = useState(null);
  const [events, setEvents] = useState([]);
  const [traffic, setTraffic] = useState(null);
  const [filter, setFilter] = useState("failures"); // all | failures | login | admin
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const unauthorized = useRef(onUnauthorized);
  unauthorized.current = onUnauthorized;

  const eventQuery = (f) => (f === "failures" ? { failuresOnly: true } : f === "all" ? {} : { type: f });

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([api.securitySummary(7), api.securityEvents({ ...eventQuery(filter), limit: 150 }), api.securityTraffic()])
      .then(([s, e, t]) => {
        setSummary(s);
        setEvents(e.events || []);
        setTraffic(t);
      })
      .catch((e) => (e.unauthorized ? unauthorized.current() : setError(e.message)))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(load, [load]);

  if (loading && !summary) return <div className="card"><Loading /></div>;
  if (error && !summary) return <div className="card"><div className="login-error">{error}</div></div>;

  const c = summary?.counts || {};
  // Always 7 slots (oldest → today), zero-filled, so the chart doesn't stretch.
  const byDay = Object.fromEntries((summary?.series || []).map((d) => [d.day, d]));
  const series = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(Date.now() - (6 - i) * 86400000).toISOString().slice(0, 10);
    return byDay[day] || { day, ok: 0, failed: 0 };
  });
  const maxDay = Math.max(1, ...series.map((d) => (d.ok || 0) + (d.failed || 0)));

  return (
    <>
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Security — last 24 hours</div>
          <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>
        </div>
        <div className="sec-metrics">
          <Metric label="Sign-ins" value={c.logins} />
          <Metric label="Failed sign-ins" value={c.failedLogins} warn={c.failedLogins > 0} />
          <Metric label="Lockouts" value={c.lockouts} warn={c.lockouts > 0} />
          <Metric label="Refused requests" value={c.refused} />
          <Metric label={`Outside ${COUNTRY_HOME.join("/")}`} value={c.abroad} bad={c.abroad > 0} />
        </div>
      </div>

      <div className="card">
        <div className="card-title">Alerts</div>
        {summary?.alerts?.length ? (
          <table className="table">
            <tbody>
              {summary.alerts.slice(0, 25).map((a, i) => (
                <tr key={i}>
                  <td style={{ width: 80 }}><Pill level={a.level}>{a.level}</Pill></td>
                  <td>{a.text}</td>
                  <td className="mono" style={{ whiteSpace: "nowrap", color: "var(--text-secondary)" }}>{when(a.ts)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="field-help">Nothing needs attention. Alerts cover: 5+ failed sign-ins for one person in an hour, 10+ refused attempts from one place in an hour, any sign-in or server-key call from outside {COUNTRY_HOME.join("/")}, sign-ins from a new IP, and admin changes.</div>
        )}
      </div>

      <div className="sec-two">
        <div className="card">
          <div className="card-title">Sign-ins, last 7 days</div>
          {summary?.series?.length ? (
            <div className="sec-bars">
              {series.map((d) => (
                <div key={d.day} className="sec-bar-col" title={`${d.day}: ${d.ok} signed in, ${d.failed} failed`}>
                  <div className="sec-bar-stack">
                    <div className="sec-bar-failed" style={{ height: `${(d.failed / maxDay) * 100}%` }} />
                    <div className="sec-bar-ok" style={{ height: `${(d.ok / maxDay) * 100}%` }} />
                  </div>
                  <div className="sec-bar-label">{new Date(`${d.day}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" })}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="field-help">No sign-ins recorded yet. Recording started 2026-10-23.</div>
          )}
          <div className="field-help" style={{ marginTop: 6 }}>
            <span className="sec-key sec-key-ok" /> signed in <span className="sec-key sec-key-failed" style={{ marginLeft: 10 }} /> failed
          </div>
        </div>

        <div className="card">
          <div className="card-title">Top sources of refused attempts (7 days)</div>
          {summary?.sources?.length ? (
            <table className="table">
              <thead><tr><th>IP</th><th>Where</th><th>Network</th><th>#</th></tr></thead>
              <tbody>
                {summary.sources.map((s) => (
                  <tr key={s.ip || "none"}>
                    <td className="mono">{s.ip || "—"}</td>
                    <td style={{ color: s.country && !COUNTRY_HOME.includes(s.country) ? "var(--red)" : undefined }}>{place(s)}</td>
                    <td style={{ fontSize: 11, color: "var(--text-secondary)" }}>{s.org || ""}</td>
                    <td className="mono">{s.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="field-help">None.</div>
          )}
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Events</div>
          <div className="tabs" style={{ marginBottom: 0 }}>
            {[["failures", "Refused / failed"], ["login", "Sign-ins"], ["admin", "Admin changes"], ["all", "All"]].map(([k, l]) => (
              <button key={k} className={`tab ${filter === k ? "active" : ""}`} style={{ fontSize: 11 }} onClick={() => setFilter(k)}>{l}</button>
            ))}
          </div>
        </div>
        {events.length ? (
          <table className="table" style={{ fontSize: 12 }}>
            <thead><tr><th>When</th><th>What</th><th>Who</th><th>From</th><th>Detail</th></tr></thead>
            <tbody>
              {events.map((e, i) => (
                <tr key={i}>
                  <td className="mono" style={{ whiteSpace: "nowrap" }} title={e.ts}>{when(e.ts)}</td>
                  <td>
                    <Pill level={e.type === "admin" ? "info" : e.outcome === "success" ? "ok" : e.outcome === "expired" ? "info" : "medium"}>{outcomeLabel(e)}</Pill>
                    <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{e.type}{e.app ? ` · ${e.app}` : ""}</div>
                  </td>
                  <td className="mono" style={{ fontSize: 11 }}>{e.username || "—"}</td>
                  <td title={[e.ip, e.org].filter(Boolean).join(" · ")} style={{ color: e.country && !COUNTRY_HOME.includes(e.country) ? "var(--red)" : undefined }}>
                    {place(e)}
                    <div className="mono" style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{e.ip || ""}</div>
                  </td>
                  <td style={{ fontSize: 11, color: "var(--text-secondary)", maxWidth: 280 }} title={e.ua || ""}>{e.detail || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="field-help">No events.</div>
        )}
      </div>

      <div className="card">
        <div className="card-title">App servers — last 24 hours</div>
        {!traffic?.configured ? (
          <div className="field-help">
            Not connected yet. Ben: in Cloudflare create an API token with <strong>Account → Account Analytics → Read</strong> and
            give it to the HELM session to store as a secret. Then this shows requests and errors per app server.
          </div>
        ) : traffic.error ? (
          <div className="login-error">Couldn't read Cloudflare analytics ({traffic.error}{traffic.detail ? `: ${traffic.detail}` : ""}).</div>
        ) : (
          <table className="table" style={{ fontSize: 12 }}>
            <thead><tr><th>Server</th><th>Requests</th><th>Errors</th><th>Calls out</th></tr></thead>
            <tbody>
              {traffic.scripts.map((s) => (
                <tr key={s.name}>
                  <td className="mono">{s.name}</td>
                  <td className="mono">{s.requests.toLocaleString()}</td>
                  <td className="mono" style={{ color: s.errors ? "var(--red)" : undefined }}>{s.errors.toLocaleString()}</td>
                  <td className="mono">{s.subrequests.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function Metric({ label, value, warn, bad }) {
  return (
    <div className="sec-metric">
      <div className="sec-metric-label">{label}</div>
      <div className="sec-metric-value" style={{ color: bad ? "var(--red)" : warn ? "var(--yellow)" : undefined }}>{value ?? 0}</div>
    </div>
  );
}
