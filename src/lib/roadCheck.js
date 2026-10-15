// Cek jarak titik ke jalan terdekat memakai data OpenStreetMap (Overpass API, gratis).

export const ROAD_MAX_M = 30; // batas wajar jarak pin ke jalan

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const HIGHWAYS = [
  'motorway',
  'trunk',
  'primary',
  'secondary',
  'tertiary',
  'unclassified',
  'residential',
  'living_street',
  'service',
  'motorway_link',
  'trunk_link',
  'primary_link',
  'secondary_link',
  'tertiary_link',
].join('|');

function toXY(p, origin) {
  const k = Math.PI / 180;
  return {
    x: (p.lng - origin.lng) * Math.cos(origin.lat * k) * 111320,
    y: (p.lat - origin.lat) * 110540,
  };
}

function nearestOnSegment(a, b, origin) {
  const A = toXY(a, origin);
  const B = toXY(b, origin);
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? (-A.x * dx + -A.y * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const px = A.x + t * dx;
  const py = A.y + t * dy;
  return {
    distanceM: Math.hypot(px, py),
    lat: a.lat + t * (b.lat - a.lat),
    lng: a.lng + t * (b.lng - a.lng),
  };
}

/**
 * @returns {Promise<null | { distanceM: number|null, nearest: {lat,lng}|null, name: string|null }>}
 *  null            -> pemeriksaan gagal (server Overpass tidak tersedia)
 *  nearest === null -> tidak ada jalan dalam radius
 */
export async function checkRoadDistance(point, radius = 60) {
  const query = `[out:json][timeout:10];way(around:${radius},${point.lat},${point.lng})["highway"~"^(${HIGHWAYS})$"];out geom;`;

  let json = null;
  for (const url of ENDPOINTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      if (!res.ok) continue;
      json = await res.json();
      break;
    } catch {
      // coba server berikutnya
    } finally {
      clearTimeout(timer);
    }
  }
  if (!json) return null;

  let best = null;
  for (const way of json.elements ?? []) {
    const g = way.geometry ?? [];
    for (let i = 0; i < g.length - 1; i++) {
      const hit = nearestOnSegment(
        { lat: g[i].lat, lng: g[i].lon },
        { lat: g[i + 1].lat, lng: g[i + 1].lon },
        point
      );
      if (!best || hit.distanceM < best.distanceM) {
        best = { ...hit, name: way.tags?.name ?? null };
      }
    }
  }

  if (!best) return { distanceM: null, nearest: null, name: null };
  return {
    distanceM: best.distanceM,
    nearest: { lat: best.lat, lng: best.lng },
    name: best.name,
  };
}