import { normalizeText } from "./format";
import type { DeliveryZone } from "./types";

export function pointInPolygon(point: { lat: number; lng: number }, polygon: DeliveryZone["polygon"]) {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;
    const intersects =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;

    if (intersects) inside = !inside;
  }

  return inside;
}

export function findZoneByCoordinates(point: { lat: number; lng: number }, zones: DeliveryZone[]) {
  return zones.find((zone) => zone.active && zone.polygon.length > 2 && pointInPolygon(point, zone.polygon));
}

export function findZoneByAddress(address: string, zones: DeliveryZone[]) {
  const value = normalizeText(address);
  if (!value) return null;
  return zones.find(
    (zone) => zone.active && zone.matchTerms.some((term) => value.includes(normalizeText(term))),
  ) || null;
}
