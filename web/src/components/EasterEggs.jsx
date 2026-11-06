import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { APPS } from "../apps.js";
import { ACCENT_PRESETS } from "../accentPresets.js";
import Loading from "./Loading.jsx";

// Super Admin only. Seasonal decorations (read by einbau-festive.js in every
// app through auth-worker's public /auth/festive), awards, and who has earned
// them. Nothing here touches anyone's data or what they can do in an app.

const SEASONS = [
  {
    id: "halloween",
    label: "Halloween",
    pieces: [
      ["webs", "Cobwebs"],
      ["bats", "Bats"],
      ["costume", "Frankenstein Claude"],
      ["phrases", "Spooky loading lines"],
      ["tag", "A Spooky Einbau Product"],
    ],
  },
  {
    id: "christmas",
    label: "Christmas",
    pieces: [
      ["lights", "Christmas lights"],
      ["icicles", "Icicles"],
      ["snow", "Snow in the headers"],
      ["drifts", "Snowdrifts"],
      ["costume", "Santa hat on Claude"],
      ["phrases", "Festive loading lines"],
      ["tag", "A Festive Einbau Product"],
    ],
  },
];

const MODES = [
  { id: "date", label: "By date" },
  { id: "on", label: "On now" },
  { id: "off", label: "Off" },
];

const LEVELS = ["bronze", "silver", "gold", "platinum"];

const METRICS = [
  { id: "days_active", label: "Days active" },
  { id: "logins", label: "Sign-ins" },
  { id: "apps_used", label: "Apps used" },
  { id: "requests", label: "Requests" },
  { id: "days_in_app", label: "Days in one app" },
];

const SECRET_COLOURS = ACCENT_PRESETS.filter((p) => p.hidden);

function metricValue(person, award) {
  if (award.metric === "days_in_app") return person.stats.perApp[award.app] || 0;
  return person.stats[award.metric] || 0;
}

function newAwardId(awards) {
  let n = awards.length + 1;
  while (awards.some((a) => a.id === `award_${n}`)) n++;
  return `award_${n}`;
}

function SeasonCard({ season, config, onChange }) {
  const c = config.seasons[season.id];
  const set = (patch) => onChange({ ...config, seasons: { ...config.seasons, [season.id]: { ...c, ...patch } } });
  function setPiece(id, on) {
    const pieces = { ...c.pieces };
    if (on) delete pieces[id];
    else pieces[id] = false;
    set({ pieces });
  }
  return (
    <div className="egg-season">
      <div className="egg-season-head">
        <strong>{season.label}</strong>
        <div className="egg-modes">
          {MODES.map((m) => (
            <button key={m.id} className={`btn btn-sm ${c.mode === m.id ? "btn-accent" : "btn-ghost"}`} onClick={() => set({ mode: m.id })}>
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div className="egg-dates">
        <label>
          From
          <input value={c.start} maxLength={5} aria-label={`${season.label} start, month-day`} onChange={(e) => set({ start: e.target.value })} />
        </label>
        <label>
          to
          <input value={c.end} maxLength={5} aria-label={`${season.label} end, month-day`} onChange={(e) => set({ end: e.target.value })} />
        </label>
        <span className="field-help">month-day</span>
      </div>
      <div className="egg-pieces">
        {season.pieces.map(([id, label]) => (
          <label key={id}>
            <input type="checkbox" checked={c.pieces[id] !== false} onChange={(e) => setPiece(id, e.target.checked)} />
            {label}
          </label>
        ))}
      </div>
    </div>
  );
}

function AwardRow({ award, onChange, onRemove }) {
  const set = (patch) => onChange({ ...award, ...patch });
  function toggleUnlock(id, on) {
    set({ unlocks: on ? [...award.unlocks, id] : award.unlocks.filter((u) => u !== id) });
  }
  return (
    <tr>
      <td><input className="egg-icon" value={award.icon} aria-label="Icon" onChange={(e) => set({ icon: e.target.value })} /></td>
      <td><input value={award.name} maxLength={40} aria-label="Name" onChange={(e) => set({ name: e.target.value })} /></td>
      <td>
        <select value={award.level} aria-label="Level" onChange={(e) => set({ level: e.target.value })}>
          {LEVELS.map((l) => <option key={l} value={l}>{l[0].toUpperCase() + l.slice(1)}</option>)}
        </select>
      </td>
      <td>
        <select value={award.metric} aria-label="Measured by" onChange={(e) => set({ metric: e.target.value, ...(e.target.value === "days_in_app" && !award.app ? { app: APPS[0].id } : {}) })}>
          {METRICS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        {award.metric === "days_in_app" && (
          <select value={award.app} aria-label="App" style={{ marginTop: 4 }} onChange={(e) => set({ app: e.target.value })}>
            {APPS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        )}
      </td>
      <td><input className="egg-num" type="number" min="1" value={award.threshold} aria-label="Threshold" onChange={(e) => set({ threshold: Number(e.target.value) })} /></td>
      <td>
        <div className="egg-unlocks">
          {SECRET_COLOURS.map((p) => (
            <label key={p.id}>
              <input type="checkbox" checked={award.unlocks.includes(p.id)} onChange={(e) => toggleUnlock(p.id, e.target.checked)} />
              {p.label}
            </label>
          ))}
        </div>
      </td>
      <td><input type="checkbox" checked={award.on} aria-label="Offered" onChange={(e) => set({ on: e.target.checked })} /></td>
      <td><button className="btn btn-danger btn-sm" onClick={onRemove}>Remove</button></td>
    </tr>
  );
}

function PersonRow({ person, awards, busy, onAward }) {
  const held = new Set(person.awards.map((a) => a.id));
  const crossed = awards.filter((a) => a.on && !held.has(a.id) && metricValue(person, a) >= a.threshold);
  const notCrossed = awards.filter((a) => !held.has(a.id) && !crossed.includes(a));
  return (
    <tr>
      <td>
        <div style={{ fontWeight: 600 }}>{person.displayName}</div>
        <div className="mono" style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{person.username}</div>
      </td>
      <td className="mono">{person.stats.logins}</td>
      <td className="mono">{person.stats.days_active}</td>
      <td className="mono">{person.stats.apps_used}</td>
      <td className="mono">{person.stats.requests}</td>
      <td>
        <div className="egg-chips">
          {awards.filter((a) => held.has(a.id)).map((a) => (
            <button key={a.id} className={`egg-chip level-${a.level}`} title="Take this award back" disabled={busy} onClick={() => onAward([person.username], a.id, false)}>
              {a.icon} {a.name} ×
            </button>
          ))}
          {crossed.map((a) => (
            <button key={a.id} className="btn btn-accent btn-sm" disabled={busy} onClick={() => onAward([person.username], a.id, true)}>
              Give {a.icon} {a.name}
            </button>
          ))}
          {notCrossed.length > 0 && (
            <select
              value=""
              aria-label={`Give ${person.displayName} an award early`}
              className="egg-give"
              disabled={busy}
              onChange={(e) => e.target.value && onAward([person.username], e.target.value, true)}
            >
              <option value="">Give early…</option>
              {notCrossed.map((a) => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
            </select>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function EasterEggs({ onToast, onUnauthorized }) {
  const [config, setConfig] = useState(null); // what's being edited
  const [saved, setSaved] = useState(null); // what's live
  const [people, setPeople] = useState([]);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.getEggs();
      setConfig(data.config);
      setSaved(data.config);
      setPeople(data.people);
      setError(null);
    } catch (e) {
      if (e.unauthorized) onUnauthorized();
      else setError(e.message);
    }
  }, [onUnauthorized]);

  useEffect(() => { load(); }, [load]);

  const dirty = useMemo(() => JSON.stringify(config) !== JSON.stringify(saved), [config, saved]);
  const awards = saved?.awards || [];
  const sortedPeople = useMemo(
    () => [...people].sort((a, b) => b.stats.days_active - a.stats.days_active || a.displayName.localeCompare(b.displayName)),
    [people]
  );
  const unclaimed = useMemo(
    () => awards.filter((a) => a.on).flatMap((a) => people
      .filter((p) => !p.awards.some((h) => h.id === a.id) && metricValue(p, a) >= a.threshold)
      .map((p) => ({ username: p.username, awardId: a.id }))),
    [awards, people]
  );

  async function save() {
    setSaving(true);
    try {
      const data = await api.setEggs(config);
      setConfig(data.config);
      setSaved(data.config);
      await load();
      onToast("Saved. The apps pick it up within a minute or two.");
    } catch (e) {
      onToast(e.message, true);
    } finally {
      setSaving(false);
    }
  }

  async function award(usernames, awardId, give) {
    setBusy(true);
    try {
      await api.giveAward(usernames, awardId, give);
      await load();
    } catch (e) {
      onToast(e.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function giveAllCrossed() {
    setBusy(true);
    try {
      for (const id of new Set(unclaimed.map((u) => u.awardId))) {
        await api.giveAward(unclaimed.filter((u) => u.awardId === id).map((u) => u.username), id, true);
      }
      await load();
      onToast("Awards given.");
    } catch (e) {
      onToast(e.message, true);
    } finally {
      setBusy(false);
    }
  }

  if (error) return <div className="card"><div className="empty-state">{error}</div></div>;
  if (!config) return <div className="card"><Loading /></div>;

  const setAward = (i, next) => setConfig({ ...config, awards: config.awards.map((a, j) => (j === i ? next : a)) });

  return (
    <>
      <div className="card">
        <div className="egg-title-row">
          <div className="card-title" style={{ marginBottom: 0 }}>Seasons and decorations</div>
          <label className="egg-master">
            <input type="checkbox" checked={config.master} onChange={(e) => setConfig({ ...config, master: e.target.checked })} />
            All decorations on
          </label>
        </div>
        <div className="sec-two" style={{ opacity: config.master ? 1 : 0.5 }}>
          {SEASONS.map((s) => <SeasonCard key={s.id} season={s} config={config} onChange={setConfig} />)}
        </div>
      </div>

      <div className="card">
        <div className="egg-title-row">
          <div className="card-title" style={{ marginBottom: 0 }}>Awards</div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setConfig({
              ...config,
              awards: [...config.awards, { id: newAwardId(config.awards), name: "New award", icon: "🏅", level: "bronze", metric: "days_active", threshold: 10, unlocks: [], on: true }],
            })}
          >
            + Add award
          </button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="table egg-table">
            <thead>
              <tr><th></th><th>Name</th><th>Level</th><th>Measured by</th><th>At</th><th>Unlocks</th><th>Offered</th><th></th></tr>
            </thead>
            <tbody>
              {config.awards.map((a, i) => (
                <AwardRow
                  key={a.id}
                  award={a}
                  onChange={(next) => setAward(i, next)}
                  onRemove={() => setConfig({ ...config, awards: config.awards.filter((x) => x.id !== a.id) })}
                />
              ))}
            </tbody>
          </table>
        </div>
        <div className="field-help" style={{ marginTop: 8 }}>
          Removing an award takes it back from everyone who holds it. Switching off "Offered" keeps it for those who already have it.
        </div>
      </div>

      <div className="egg-save">
        <button className="btn btn-accent" disabled={!dirty || saving} onClick={save}>{saving ? "Saving…" : "Save changes"}</button>
        {dirty && <button className="btn btn-ghost" disabled={saving} onClick={() => setConfig(saved)}>Discard</button>}
      </div>

      <div className="card">
        <div className="egg-title-row">
          <div className="card-title" style={{ marginBottom: 0 }}>People</div>
          <button className="btn btn-accent btn-sm" disabled={busy || !unclaimed.length} onClick={giveAllCrossed}>
            Give all earned ({unclaimed.length})
          </button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr><th>Person</th><th>Sign-ins</th><th>Days active</th><th>Apps</th><th>Requests</th><th>Awards</th></tr>
            </thead>
            <tbody>
              {sortedPeople.map((p) => <PersonRow key={p.username} person={p} awards={awards} busy={busy} onAward={award} />)}
            </tbody>
          </table>
        </div>
        <div className="field-help" style={{ marginTop: 8 }}>
          Counting started November 2026, with sign-ins going back to late October. "Requests" counts how often an app checked someone's session, so it's a rough measure of activity.
        </div>
      </div>
    </>
  );
}
