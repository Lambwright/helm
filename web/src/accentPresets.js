// Personal accent overrides for "My Account" → Appearance. Applied by setting
// the same three CSS custom properties theme.css defines on :root, so nothing
// else in the app needs to know a preference is active.
export const ACCENT_PRESETS = [
  { id: "tungsten", label: "Tungsten", accent: "#9BA8B5", accentDark: "#7A8794", rgb: "155, 168, 181" },
  { id: "amber", label: "Amber", accent: "#D1A93F", accentDark: "#A6842F", rgb: "209, 169, 63" },
  { id: "crimson", label: "Crimson", accent: "#D14343", accentDark: "#A63333", rgb: "209, 67, 67" },
  { id: "forest", label: "Forest", accent: "#6FB35C", accentDark: "#559244", rgb: "111, 179, 92" },
  { id: "violet", label: "Violet", accent: "#9B7ED1", accentDark: "#7C5FA8", rgb: "155, 126, 209" },
];

export function applyAccentPreset(presetId) {
  const preset = ACCENT_PRESETS.find((p) => p.id === presetId);
  const root = document.documentElement.style;
  if (!preset) {
    root.removeProperty("--accent");
    root.removeProperty("--accent-dark");
    root.removeProperty("--accent-rgb");
    return;
  }
  root.setProperty("--accent", preset.accent);
  root.setProperty("--accent-dark", preset.accentDark);
  root.setProperty("--accent-rgb", preset.rgb);
}
