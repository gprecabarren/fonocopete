import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { mapDeliveryZoneRow, mapDeliveryZoneToRow } from "@/lib/delivery-zone-mapper";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const zoneSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  price: z.number().int().nonnegative(),
  eta: z.string().min(1),
  description: z.string(),
  polygon: z.array(z.object({ lat: z.number(), lng: z.number() })),
  matchTerms: z.array(z.string().min(1)).min(1),
  active: z.boolean(),
});

export async function GET() {
  const supabase = createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ zones: [], source: "demo" });

  const { data, error } = await supabase.from("delivery_zones").select("*").order("sort_order");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ zones: data.map(mapDeliveryZoneRow), source: "supabase" });
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const parsed = zoneSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Zona invalida" }, { status: 400 });

  const supabase = createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ zone: parsed.data, source: "demo" });

  const { data, error } = await supabase
    .from("delivery_zones")
    .upsert(mapDeliveryZoneToRow(parsed.data), { onConflict: "id" })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ zone: mapDeliveryZoneRow(data), source: "supabase" });
}
