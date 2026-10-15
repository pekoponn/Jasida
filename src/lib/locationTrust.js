import { checkRoadDistance, ROAD_MAX_M } from './roadCheck.js';
import { findSimilarReports } from './reports.js';

/**
 * Menilai seberapa bisa dipercaya lokasi sebuah laporan.
 *
 * source:
 *   camera_gps | device_gps | exif -> 'trusted'
 *   manual (pin di peta)           -> diperiksa:
 *       lolos semua                -> 'auto_ok'  (tampil publik, tetap bisa dicek admin)
 *       ada tanda bermasalah       -> 'pending'  (ditahan sampai admin memverifikasi)
 *
 * Tanda untuk pin manual:
 *   far_from_road     pin jauh dari jalan (atau tidak ada jalan di sekitarnya)
 *   road_unknown      pengecekan jalan gagal (server Overpass tidak tersedia)
 *   photo_reused      foto sangat mirip dengan laporan di lokasi yang jauh
 *   no_context_photo  pelapor tidak menyertakan foto konteks
 */
export async function assessLocation({
  position,
  source,
  embedding,
  damageType,
  hasContextPhoto = false,
}) {
  const locationSource = source ?? 'device_gps';

  if (locationSource !== 'manual') {
    return { locationSource, roadDistanceM: null, locationFlags: [], locationStatus: 'trusted' };
  }

  const flags = [];
  let roadDistanceM = null;

  // 1) Pin harus dekat jalan
  const road = await checkRoadDistance(position).catch(() => null);
  if (!road) {
    flags.push('road_unknown');
  } else if (!road.nearest) {
    flags.push('far_from_road');
  } else {
    roadDistanceM = Math.round(road.distanceM);
    if (road.distanceM > ROAD_MAX_M) flags.push('far_from_road');
  }

  // 2) Foto yang sangat mirip dengan laporan di lokasi yang jauh (kemungkinan foto dipakai ulang)
  if (embedding) {
    try {
      const similar = await findSimilarReports({
        lat: position.lat,
        lng: position.lng,
        damageType,
        embedding,
        radiusMeters: 200000,
      });
      const reused = similar.some(
        (r) => typeof r.similarity === 'number' && r.similarity >= 0.93 && r.distance_m > 300
      );
      if (reused) flags.push('photo_reused');
    } catch (err) {
      console.warn('[location-trust] cek foto dipakai ulang dilewati:', err.message);
    }
  }

  // 3) Foto konteks bersifat opsional, tapi tanpa foto itu laporan menunggu verifikasi admin
  if (!hasContextPhoto) flags.push('no_context_photo');

  return {
    locationSource,
    roadDistanceM,
    locationFlags: flags,
    locationStatus: 'pending',
  };
}