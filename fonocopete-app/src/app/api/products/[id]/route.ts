import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { mapProductRow, mapProductToRow } from "@/lib/product-mapper";
import type { Product } from "@/lib/types";

const productSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.enum(["promociones", "cervezas", "piscos", "vinos", "destilados", "extras"]),
  price: z.number().int().nonnegative(),
  imageUrl: z.string(),
  volume: z.string(),
  description: z.string(),
  stock: z.enum(["available", "low", "hidden"]),
  featured: z.boolean().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const [{ id }, parsed] = await Promise.all([context.params, productSchema.safeParseAsync(await request.json())]);

  if (!parsed.success || parsed.data.id !== id) {
    return NextResponse.json({ error: "Producto invalido" }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return NextResponse.json({ product: parsed.data, source: "demo" });
  }

  const { data, error } = await supabase
    .from("products")
    .update(mapProductToRow(parsed.data as Product))
    .eq("id", id)
    .select("id,name,category_id,price,image_url,volume,description,stock,featured")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ product: mapProductRow(data), source: "supabase" });
}
