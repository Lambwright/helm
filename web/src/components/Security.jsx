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
  invalid_signature: "Invalid session",
  expired: "Session expired",
  revoked: "Session revoked",
  unauthorized: "Bad server key",
  // reported by the apps themselves (type "app")
  no_token: "No sign-in",
  bad_session: "Bad/expired sign-in",
  forbidden: "Not allowed",
  bad_service_key: "Bad server key",
  other: "Refused",
  refused: "Blocked", // type "block"
};

const ALERT_LABELS = { blocked: "Address blocked", decoy: "Decoy touched", probe_trusted: "Probing (trusted address)", watch: "Probing (watch)" };

function outcomeLabel(e) {
  if (e.type === "admin") return e.outcome.replace(/_/g, " ");
  if (e.type === "block") return "Blocked address";
  if (e.type === "alert") return ALERT_LABELS[e.outcome] || "Alert";
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
  const [blocks, setBlocks] = useState([]);
  const [unblocking, setUnblocking] = useState(null);
  const [digest, setDigest] = useState(null);
  const [sendingDigest, setSendingDigest] = useState(false);
  const [filter, setFilter] = useState("failures"); // all | failures | login | admin
  const [ipFilter, setIpFilter] = useState(null); // null = every address; "" = no address recorded
  const eventsRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const unauthorized = useRef(onUnauthorized);
  unauthorized.current = onUnauthorized;

  const eventQuery = (f) => (f === "failures" ? { failuresOnly: true } : f === "all" ? {} : { type: f });

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.securitySummary(7),
      api.securityEvents({ ...eventQuery(filter), ...(ipFilter !== null ? { ip: ipFilter } : {}), limit: 150 }),
      api.securityTraffic(),
      api.securityBlocks().catch(() => ({ blocks: [] })), // older worker: no blocks yet
    ])
      .then(([s, e, t, b]) => {
        setSummary(s);
        // Filter here too, so it works before the worker supports { ip }.
        setEvents((e.events || []).filter((x) => ipFilter === null || (x.ip || "") === ipFilter));
        setTraffic(t);
        setBlocks(b.blocks || []);
      })
      .catch((e) => (e.unauthorized ? unauthorized.current() : setError(e.message)))
      .finally(() => setLoading(false));
  }, [filter, ipFilter]);

  const showAddress = (ip) => {
    setIpFilter(ip);
    setFilter("all");
    eventsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(load, [load]);

  const unblock = (ip) => {
    setUnblocking(ip);
    api.unblockAddress(ip)
      .then(() => {
        onToast?.(`Unblocked ${ip}`);
        load();
      })
      .catch((e) => (e.unauthorized ? unauthorized.current() : onToast?.(e.message, true)))
      .finally(() => setUnblocking(null));
  };

  const sendDigest = () => {
    setSendingDigest(true);
    api.sendTestDigest()
      .then((d) => {
        setDigest(d);
        onToast?.(d.posted ? `Digest posted to the webhook (${d.severity})` : "Digest built — set ALERT_WEBHOOK_URL to post it to Teams");
      })
      .catch((e) => (e.unauthorized ? unauthorized.current() : onToast?.(e.message, true)))
      .finally(() => setSendingDigest(false));
  };

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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Alerts</div>
          <button className="btn btn-ghost btn-sm" onClick={sendDigest} disabled={sendingDigest} title="Build the daily security digest now and post it to the alert webhook (Super Admin)">
            {sendingDigest ? "Sending…" : "Send test digest"}
          </button>
        </div>
        {digest && (
          <div style={{ marginBottom: 12 }}>
            <pre style={{ whiteSpace: "pre-wrap", margin: 0, padding: 10, borderRadius: 8, background: "var(--surface-2, rgba(127,127,127,0.08))", fontSize: 12, lineHeight: 1.5 }}>{digest.text}</pre>
            <div className="field-help" style={{ marginTop: 6 }}>
              {digest.posted ? "Posted to the alert webhook." : "Not posted — the ALERT_WEBHOOK_URL secret isn't set yet. This is what would go to Teams."}
            </div>
          </div>
        )}
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
          <div className="field-help">Nothing needs attention. Alerts cover: 5+ failed sign-ins for one person in an hour, 10+ refused attempts from one place in an hour, any sign-in or server-key call from outside {COUNTRY_HOME.join("/")}, sign-ins from a new IP, admin changes, and addresses blocked for probing.</div>
        )}
      </div>

      <div className="card">
        <div className="card-title">Blocked addresses</div>
        {blocks.length ? (
          <table className="table" style={{ fontSize: 12 }}>
            <thead><tr><th>Address</th><th>Why</th><th>Until</th><th></th></tr></thead>
            <tbody>
              {blocks.map((b) => (
                <tr key={b.ip}>
                  <td title={b.org || ""}>
                    {place(b)}
                    <div className="mono" style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{b.ip}</div>
                  </td>
                  <td style={{ color: "var(--text-secondary)" }}>{b.reason}{b.level > 1 ? ` · block #${b.level}` : ""}</td>
                  <td className="mono" style={{ whiteSpace: "nowrap" }}>
                    {b.active ? <Pill level="high">{when(b.until)}</Pill> : <span style={{ color: "var(--text-tertiary)" }}>ended {when(b.until)}</span>}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {b.active && (
                      <button className="btn btn-ghost btn-sm" onClick={() => unblock(b.ip)} disabled={unblocking === b.ip}>
                        {unblocking === b.ip ? "Unblocking…" : "Unblock"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="field-help">None in the last 30 days. An address is blocked for an hour after 8 invalid sessions or unknown-account sign-ins in 10 minutes, or at once if it touches a decoy; each repeat doubles the time, up to a week. Addresses someone signed in from in the last 30 days are never blocked, only alerted on.</div>
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
            <div className="sec-sources">
              {summary.sources.map((s) => {
                const max = summary.sources[0].n || 1;
                const blocked = blocks.some((b) => b.active && b.ip === s.ip);
                const kinds = [...new Set(String(s.outcomes || "").split(",").filter(Boolean).map((o) => OUTCOME_LABELS[o] || o))];
                return (
                  <button
                    key={s.ip || "none"}
                    className={`sec-source ${ipFilter === (s.ip || "") ? "active" : ""}`}
                    onClick={() => showAddress(s.ip || "")}
                    title={`${s.ip || "No address recorded"}${s.org ? ` · ${s.org}` : ""}\nLast: ${when(s.last)}\nClick to see its events`}
                  >
                    <span className="sec-source-bar" style={{ width: `${(s.n / max) * 100}%` }} />
                    <span className="sec-source-main">
                      <span className="sec-source-place" style={{ color: s.country && !COUNTRY_HOME.includes(s.country) ? "var(--red)" : undefined }}>
                        {s.ip ? place(s) : "No address"}
                        {s.org && <span className="sec-source-org"> · {s.org}</span>}
                      </span>
                      <span className="sec-source-ip mono">{s.ip || "server-to-server, no visitor address"}</span>
                      <span className="sec-source-tags">
                        {blocked && <Pill level="high">Blocked</Pill>}
                        {!!s.trusted && <Pill level="ok">Staff network</Pill>}
                        {kinds.slice(0, 2).map((k) => <span key={k} className="sec-source-kind">{k}</span>)}
                        {kinds.length > 2 && <span className="sec-source-kind">+{kinds.length - 2}</span>}
                      </span>
                    </span>
                    <span className="sec-source-n mono">{s.n}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="field-help">None.</div>
          )}
        </div>
      </div>

      <div className="card" ref={eventsRef}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div className="card-title" style={{ marginBottom: 0 }}>Events</div>
            {ipFilter !== null && (
              <span className="sec-filter-chip">
                from <span className="mono">{ipFilter || "no address"}</span>
                <button onClick={() => setIpFilter(null)} aria-label="Show every address">×</button>
              </span>
            )}
          </div>
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
                    <Pill level={e.type === "alert" ? "high" : e.type === "admin" ? "info" : e.outcome === "success" ? "ok" : ["expired", "missing_token", "no_token"].includes(e.outcome) ? "info" : "medium"}>{outcomeLabel(e)}</Pill>
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
