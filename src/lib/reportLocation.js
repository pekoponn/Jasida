import { isWithinSidoarjo } from './geofence.js';

export function validateReportLocation(position, testingMode = false) {
  const { lat, lng } = position ?? {};
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return 'Lokasi belum terdeteksi. Izinkan GPS, lalu tekan Lokasi saat ini.';
  }
  if (!testingMode && !isWithinSidoarjo(lat, lng)) {
    return 'Laporan Real hanya untuk wilayah Kabupaten Sidoarjo. Untuk penilaian lomba dari daerah lain, pilih Mode Uji Coba (Bebas Lokasi).';
  }
  return null;
}

export function distanceMeters(a, b) {
  const radians = Math.PI / 180;
  const dLat = (b.lat - a.lat) * radians;
  const dLng = (b.lng - a.lng) * radians;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
