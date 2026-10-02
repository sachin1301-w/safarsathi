export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in km (haversine formula). */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** A lat/lng box around a point, as a Prisma filter: a cheap pre-filter before haversine. */
export function boxAround(p: LatLng, radiusKm: number) {
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.max(0.1, Math.cos(toRad(p.lat))));
  return {
    lat: { gte: p.lat - dLat, lte: p.lat + dLat },
    lng: { gte: p.lng - dLng, lte: p.lng + dLng },
  };
}

/** Roads wind; straight-line distance times this factor approximates road distance. */
export const ROAD_FACTOR = 1.3;

export const roadKm = (a: LatLng, b: LatLng) => haversineKm(a, b) * ROAD_FACTOR;

/** Point a fraction `t` (0..1) of the way from a to b. Good enough over a few hundred km. */
export function interpolate(a: LatLng, b: LatLng, t: number): LatLng {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

/**
 * Where a point sits relative to the straight line a→b:
 * `along` is the fraction of the way (0..1) and `offKm` the sideways distance.
 */
export function projectOnSegment(
  a: LatLng,
  b: LatLng,
  p: LatLng,
): { along: number; offKm: number } {
  // Flat-earth projection, fine at city/regional scale.
  const kx = 111.32 * Math.cos(toRad((a.lat + b.lat) / 2));
  const ky = 110.57;
  const bx = (b.lng - a.lng) * kx;
  const by = (b.lat - a.lat) * ky;
  const px = (p.lng - a.lng) * kx;
  const py = (p.lat - a.lat) * ky;
  const len2 = bx * bx + by * by || 1;
  const along = Math.max(0, Math.min(1, (px * bx + py * by) / len2));
  const offKm = Math.hypot(px - along * bx, py - along * by);
  return { along, offKm };
}
