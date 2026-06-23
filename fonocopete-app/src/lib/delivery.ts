import { deliveryZones } from "./catalog";
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

export function findZoneByCoordinates(point: { lat: number; lng: number }) {
  return deliveryZones.find((zone) => pointInPolygon(point, zone.polygon));
}

export function inferDemoZoneFromAddress(address: string) {
  const value = normalizeText(address);

  if (!value) return null;
  if (value.includes("centro") || value.includes("plaza") || value.includes("local")) {
    return deliveryZones[0];
  }
  if (value.includes("providencia") || value.includes("nunoa") || value.includes("santiago")) {
    return deliveryZones[1];
  }
  if (value.includes("maipu") || value.includes("florida") || value.includes("condes")) {
    return deliveryZones[2];
  }

  return null;
}
