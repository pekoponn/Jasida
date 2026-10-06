import { parse } from 'exifr';

export async function readPhotoGpsLocation(file) {
  try {
    const gps = await parse(file, { gps: true });
    if (!gps || typeof gps.latitude !== 'number' || typeof gps.longitude !== 'number') {
      return null;
    }
    return { lat: gps.latitude, lng: gps.longitude };
  } catch (err) {
    console.warn('[exif-location]', err.message);
    return null;
  }
}