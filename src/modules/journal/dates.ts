export function browserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}
export function localDay(date = new Date(), timezone = browserTimezone()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: timezone }).format(date);
}
export function localDateTime(iso: string) {
  const d = new Date(iso);
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function displayDate(iso: string, timezone = browserTimezone()) {
  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(iso));
}
export function shiftDay(day: string, offset: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}
export function weekRange(today: string) {
  const day = new Date(`${today}T12:00:00Z`).getUTCDay();
  const from = shiftDay(today, -((day + 6) % 7));
  return { from, to: shiftDay(from, 6) };
}
export function monthRange(month: string) {
  const [year, number] = month.split("-").map(Number);
  return {
    from: `${month}-01`,
    to: new Date(Date.UTC(year, number, 0, 12)).toISOString().slice(0, 10),
  };
}
