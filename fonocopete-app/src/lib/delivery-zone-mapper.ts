import type { DeliveryZone } from "./types";

type DeliveryZoneRow = {
  id: string;
  name: string;
  price: number;
  eta: string;
  description: string | null;
  polygon: Array<{ lat: number; lng: number }> | null;
  match_terms: string[] | null;
  active: boolean;
};

export function mapDeliveryZoneRow(row: DeliveryZoneRow): DeliveryZone {
  return {
    id: row.id,
    name: row.name,
    price: row.price,
    eta: row.eta,
    description: row.description || "",
    polygon: row.polygon || [],
    matchTerms: row.match_terms || [],
    active: row.active,
  };
}

export function mapDeliveryZoneToRow(zone: DeliveryZone) {
  return {
    id: zone.id,
    name: zone.name,
    price: zone.price,
    eta: zone.eta,
    description: zone.description,
    polygon: zone.polygon,
    match_terms: zone.matchTerms,
    active: zone.active,
  };
}
