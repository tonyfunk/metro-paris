const BASE = "https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia";

const prim = async (p) => {
  if (!process.env.PRIM_KEY) throw new Error("PRIM_KEY manquante");
  const r = await fetch(BASE + p, { headers: { apiKey: process.env.PRIM_KEY } });
  if (!r.ok) throw new Error(`PRIM ${r.status}`);
  return r.json();
};

// "20261106T143005" -> secondes (heure locale naïve, suffisant pour une différence)
const toSec = (s) => Date.UTC(+s.slice(0,4), +s.slice(4,6)-1, +s.slice(6,8), +s.slice(9,11), +s.slice(11,13), +s.slice(13,15)) / 1000;

exports.lines = async () => {
  const d = await prim("/lines?filter=physical_mode.id%3Dphysical_mode%3AMetro&count=100");
  return d.lines
    .map(l => ({ id: l.id, code: l.code, color: "#" + l.color }))
    .sort((a, b) => a.code.localeCompare(b.code, "fr", { numeric: true }));
};

exports.stations = async (q) => {
  const d = await prim(`/lines/${encodeURIComponent(q.line)}/stop_areas?count=200`);
  return d.stop_areas.map(s => ({ id: s.id, name: s.name })).sort((a, b) => a.name.localeCompare(b.name, "fr"));
};

exports.next = async (q) => {
  const d = await prim(`/stop_areas/${encodeURIComponent(q.stop)}/lines/${encodeURIComponent(q.line)}/departures?count=12&data_freshness=realtime`);
  const now = toSec(d.context.current_datetime);
  const byDir = {};
  for (const x of d.departures) {
    const dir = x.display_informations.direction.replace(/\s*\(.*\)$/, "");
    const mins = Math.max(0, Math.round((toSec(x.stop_date_time.departure_date_time) - now) / 60));
    const realtime = x.stop_date_time.data_freshness === "realtime";
    (byDir[dir] ||= []).push({ mins, realtime });
  }
  return Object.entries(byDir).map(([direction, t]) => ({
    direction, times: t.sort((a, b) => a.mins - b.mins).slice(0, 2),
  }));
};
