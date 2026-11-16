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

// Info trafic : uniquement les perturbations sur la ligne elle-même (pas les arrêts, ascenseurs…)
const SEVERE = new Set(["NO_SERVICE", "REDUCED_SERVICE", "SIGNIFICANT_DELAYS", "DETOUR"]);
const EQUIPMENT = /ascenseur|escalator|escalier|équipement|elevator/i;
const stripHtml = (s = "") => s.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\n{3,}/g, "\n\n").trim();

exports.disruptions = async (q) => {
  const d = await prim(`/lines/${encodeURIComponent(q.line)}/line_reports?disable_geojson=true`);
  const byId = new Map((d.disruptions || []).filter(x => x.status === "active").map(x => [x.id, x]));
  const r = (d.line_reports || []).find(r => r.line.id === q.line);
  const ids = (r?.line.links || []).filter(l => l.type === "disruption").map(l => l.id);
  return ids.map(id => byId.get(id)).filter(Boolean).map(x => {
    const msgs = x.messages || [];
    const pick = (re) => msgs.find(m => re.test(m.channel?.name || "") || (m.channel?.types || []).some(t => re.test(t)));
    const title = stripHtml((pick(/titre|title/i) || {}).text || "");
    const text = stripHtml((pick(/moteur|web|mobile/i) || msgs[0] || {}).text || "");
    return { title: title || "Trafic perturbé", text: text !== title ? text : "",
      severe: SEVERE.has(x.severity?.effect), priority: x.severity?.priority ?? 99 };
  }).filter(x => !EQUIPMENT.test(x.title + " " + x.text))
    .sort((a, b) => (b.severe - a.severe) || (a.priority - b.priority));
};
