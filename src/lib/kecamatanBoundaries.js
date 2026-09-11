import sidoarjoKecamatan from '../data/sidoarjo-kecamatan.json';

function pointInRing(point, ring) {
  let inside = false;
  const [x, y] = point;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInPolygonGeometry(point, geometry) {
  if (geometry.type === 'Polygon') {
    const [outer, ...holes] = geometry.coordinates;
    if (!pointInRing(point, outer)) return false;
    return !holes.some((hole) => pointInRing(point, hole));
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((poly) =>
      pointInPolygonGeometry(point, { type: 'Polygon', coordinates: poly })
    );
  }
  return false;
}

/** Cari nama kecamatan berdasarkan koordinat laporan (lat, lng). */
export function findKecamatan(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  const point = [lng, lat]; // GeoJSON pakai urutan [lng, lat]
  const feature = sidoarjoKecamatan.features.find((f) =>
    pointInPolygonGeometry(point, f.geometry)
  );
  return feature ? feature.properties.kecamatan : null;
}

export function getKecamatanNames() {
  return sidoarjoKecamatan.features
    .map((f) => f.properties.kecamatan)
    .sort((a, b) => a.localeCompare(b));
}

export function getKecamatanGeoJSON() {
  return sidoarjoKecamatan;
}