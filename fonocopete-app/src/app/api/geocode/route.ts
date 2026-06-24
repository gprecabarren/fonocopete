import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const address = new URL(request.url).searchParams.get("address")?.trim();
  if (!address || address.length < 3) {
    return NextResponse.json({ error: "Direccion invalida" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Google Maps no configurado" }, { status: 503 });

  const params = new URLSearchParams({
    address: `${address}, Region del Biobio, Chile`,
    region: "cl",
    language: "es",
    key: apiKey,
  });
  const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`, {
    next: { revalidate: 3600 },
  });
  const data = await response.json();
  const result = data.results?.[0];
  if (!result) return NextResponse.json({ error: "Direccion no encontrada" }, { status: 404 });

  return NextResponse.json({
    formattedAddress: result.formatted_address,
    location: result.geometry.location,
    searchableAddress: result.address_components.map((item: { long_name: string }) => item.long_name).join(" "),
  });
}
