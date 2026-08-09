import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const address = new URL(request.url).searchParams.get("address")?.trim();
  if (!address || address.length < 3) {
    return NextResponse.json({ error: "Dirección inválida" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    const params = new URLSearchParams({
      q: `${address}, Region del Biobio, Chile`,
      format: "jsonv2",
      addressdetails: "1",
      limit: "5",
      countrycodes: "cl",
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: {
        "User-Agent": "Fonocopete-Concepcion/1.0 (fonocopetepenquista@gmail.com)",
        "Accept-Language": "es",
      },
      next: { revalidate: 86400 },
    });
    const results = await response.json();
    if (!results.length) return NextResponse.json({ error: "Dirección no encontrada" }, { status: 404 });

    return NextResponse.json({
      provider: "openstreetmap",
      results: results.map((result: {
        display_name: string;
        lat: string;
        lon: string;
        address?: Record<string, string>;
      }) => ({
        formattedAddress: result.display_name,
        city: result.address?.city || result.address?.town || result.address?.municipality || result.address?.county || "",
        location: { lat: Number(result.lat), lng: Number(result.lon) },
        searchableAddress: Object.values(result.address || {}).join(" "),
      })),
    });
  }

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
  if (!result) return NextResponse.json({ error: "Dirección no encontrada" }, { status: 404 });

  return NextResponse.json({
    provider: "google",
    results: [{
      formattedAddress: result.formatted_address,
      city: result.address_components.find((item: { types: string[] }) =>
        item.types.includes("locality") || item.types.includes("administrative_area_level_3")
      )?.long_name || "",
      location: result.geometry.location,
      searchableAddress: result.address_components.map((item: { long_name: string }) => item.long_name).join(" "),
    }],
  });
}
