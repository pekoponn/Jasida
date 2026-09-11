export function getCurrentPosition(options = { enableHighAccuracy: true, timeout: 10000 }) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation tidak didukung di browser ini.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      options
    );
  });
}

// --- Antrian sederhana buat reverseGeocode ---
// Nominatim (OpenStreetMap) membatasi maksimal ±1 request/detik dari satu sumber.
// Kalau banyak komponen (misal tiap ReportCard di Dashboard) manggil reverseGeocode
// bersamaan, requestnya bisa langsung ditolak/di-rate-limit. Antrian ini memastikan
// semua pemanggilan di seluruh app dijalankan berurutan dengan jeda minimal.
const MIN_INTERVAL_MS = 1100; // sedikit di atas 1 detik, kasih buffer aman
let queueTail = Promise.resolve();
let lastCallAt = 0;

function scheduleGeocodeCall(task) {
  const run = queueTail.then(async () => {
    const now = Date.now();
    const wait = Math.max(0, lastCallAt + MIN_INTERVAL_MS - now);
    if (wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    lastCallAt = Date.now();
    return task();
  });
  // pastikan antrian tetap jalan meski satu task gagal
  queueTail = run.catch(() => {});
  return run;
}

// Cache sederhana biar koordinat yang sama (misal dibuka berkali-kali) nggak
// nge-request ulang ke Nominatim.
const geocodeCache = new Map();

export async function reverseGeocode(lat, lng) {
  const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  const result = await scheduleGeocodeCall(async () => {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;

    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'id'
      }
    });

    if (!res.ok) {
      throw new Error(`Gagal mengambil alamat lokasi (status ${res.status}).`);
    }

    const data = await res.json();
    const addr = data.address || {};

    // Susun jadi "Nama Jalan, Kecamatan, Kabupaten" — lebih ringkas & rapi
    // dibanding display_name mentah yang biasanya kepanjangan.
    const parts = [
      addr.road || addr.pedestrian || addr.footway || addr.neighbourhood,
      addr.suburb || addr.village || addr.town || addr.city_district,
      addr.county || addr.city || addr.state
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(', ') : (data.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
  });

  geocodeCache.set(cacheKey, result);
  return result;
}