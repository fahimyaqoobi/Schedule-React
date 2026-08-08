// Shared distance math — extracted from app/api/time-entries/route.js's
// clock-in/out geofence check so the Dispatch Map's "nearest available
// cleaner" sort uses the exact same formula instead of a second copy.
export function haversineMeters(pointA, pointB) {
    const toRadians = (value) => (value * Math.PI) / 180;
    const earthRadius = 6371000;
    const dLat = toRadians(pointB.lat - pointA.lat);
    const dLng = toRadians(pointB.lng - pointA.lng);
    const lat1 = toRadians(pointA.lat);
    const lat2 = toRadians(pointB.lat);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
