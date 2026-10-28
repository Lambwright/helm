// HELM uses the suite-wide theme file (public/einbau-theme.js, served at
// https://lambwright.github.io/helm/einbau-theme.js and loaded by index.html),
// the same one every other app loads — so colours and light/dark behave the
// same everywhere. Per person: user.themeAccent = { APP: presetId } (one colour
// per app) and user.themeMode = 'system' | 'dark' | 'light' (all apps).
export const HELM_DEFAULT_ACCENT = "#9BA8B5"; // tungsten

const T = () => window.EinbauTheme;
export const ACCENT_PRESETS = T()?.PRESETS || [];
export const THEME_MODES = T()?.MODES || [];

export function applyTheme(user) {
  T()?.apply({ app: "HELM", defaultAccent: HELM_DEFAULT_ACCENT, user: user || null });
}

// Signed out: back to HELM's default colour, following the device's light/dark.
export function resetTheme() {
  T()?.reset();
}

// Before anyone signs in (the sign-in screen).
applyTheme(null);
