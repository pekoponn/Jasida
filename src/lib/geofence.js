import { findKecamatan } from './kecamatanBoundaries.js';

export function isWithinSidoarjo(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  return findKecamatan(lat, lng) != null;
}