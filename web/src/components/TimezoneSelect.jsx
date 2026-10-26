// IANA time zone picker: Canada/US zones first, then every zone the browser
// knows. Each person sets their own in My Account (Ben, 2026-10-26); the
// Super Admin can also set it in Users → Edit. Default is America/Toronto.
export const DEFAULT_TIMEZONE = "America/Toronto";

const COMMON = [
  ["America/St_Johns", "Newfoundland"],
  ["America/Halifax", "Atlantic (Halifax)"],
  ["America/Toronto", "Eastern (Toronto)"],
  ["America/Winnipeg", "Central (Winnipeg)"],
  ["America/Regina", "Saskatchewan (Regina)"],
  ["America/Edmonton", "Mountain (Edmonton)"],
  ["America/Vancouver", "Pacific (Vancouver)"],
  ["America/New_York", "US Eastern (New York)"],
  ["America/Chicago", "US Central (Chicago)"],
  ["America/Denver", "US Mountain (Denver)"],
  ["America/Phoenix", "US Arizona (Phoenix)"],
  ["America/Los_Angeles", "US Pacific (Los Angeles)"],
];

function allZones() {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return [];
  }
}

export default function TimezoneSelect({ id, value, onChange, disabled }) {
  const common = new Set(COMMON.map(([z]) => z));
  const rest = allZones().filter((z) => !common.has(z));
  const current = value || DEFAULT_TIMEZONE;
  return (
    <select id={id} value={current} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      <optgroup label="Canada and US">
        {COMMON.map(([z, label]) => (
          <option key={z} value={z}>{label}</option>
        ))}
      </optgroup>
      {rest.length > 0 && (
        <optgroup label="Everywhere else">
          {!common.has(current) && !rest.includes(current) && <option value={current}>{current}</option>}
          {rest.map((z) => (
            <option key={z} value={z}>{z.replace(/_/g, " ")}</option>
          ))}
        </optgroup>
      )}
    </select>
  );
}
