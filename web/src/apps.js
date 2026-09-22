// Canonical app IDs — must match exactly what auth-worker's `apps` field on a
// user record expects (see auth-worker/README.md, "The user object, and the
// apps field"). HELM itself isn't listed: every authenticated Einbau ID user
// can always open HELM.
export const APPS = [
  { id: "PUNCH", label: "PUNCH", url: "https://lambwright.github.io/PUNCH/" },
  { id: "SCOUT", label: "SCOUT", url: "https://lambwright.github.io/scout-addin/app.html" },
  { id: "INTAKE", label: "INTAKE", url: "https://lambwright.github.io/scout-intake/" },
  { id: "TALLY", label: "TALLY", url: "https://lambwright.github.io/tally/" },
  { id: "HANDOFF", label: "HANDOFF", url: "https://lambwright.github.io/handoff/" },
];

export const ALL_APP_IDS = APPS.map((a) => a.id);
