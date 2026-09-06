const SIDOARJO_BOUNDS = {
  minLat: -7.55,
  maxLat: -7.25,
  minLng: 112.45,
  maxLng: 112.95
};

export function isWithinSidoarjo(lat, lng) {
  return (
    lat >= SIDOARJO_BOUNDS.minLat &&
    lat <= SIDOARJO_BOUNDS.maxLat &&
    lng >= SIDOARJO_BOUNDS.minLng &&
    lng <= SIDOARJO_BOUNDS.maxLng
  );
}