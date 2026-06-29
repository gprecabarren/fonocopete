import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { mapProductRow, mapProductToRow } from "@/lib/product-mapper";
import type { Product } from "@/lib/types";
import { requireAdmin } from "@/lib/auth";

const productSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    category: z.string().min(1),
    price: z.number().int().nonnegative(),
    originalPrice: z.number().int().nonnegative().nullable().optional(),
    beerFormat: z.enum(["latas", "botellas"]).nullable().optional(),
    imageUrl: z.string(),
    volume: z.string(),
    description: z.string(),
    stock: z.enum(["available", "low", "sold_out", "hidden"]),
    featured: z.boolean().optional(),
  })
  .superRefine((product, context) => {
    if (product.originalPrice && product.originalPrice <= product.price) {
      context.addIssue({
        code: "custom",
        path: ["originalPrice"],
        message: "El precio original debe ser mayor que el precio normal.",
      });
    }
  });

export async function GET() {
  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return NextResponse.json({ products: [], source: "demo" });
  }

  const { data, error } = await supabase
    .from("products")
    .select("id,name,category_id,price,original_price,beer_format,image_url,volume,description,stock,featured")
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ products: data.map(mapProductRow), source: "supabase" });
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const parsed = z.union([productSchema, z.array(productSchema)]).safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Producto inválido" }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return NextResponse.json({ products: Array.isArray(parsed.data) ? parsed.data : [parsed.data], source: "demo" });
  }

  const products = (Array.isArray(parsed.data) ? parsed.data : [parsed.data]) as Product[];
  const { data, error } = await supabase
    .from("products")
    .upsert(products.map(mapProductToRow), { onConflict: "id" })
    .select("id,name,category_id,price,original_price,beer_format,image_url,volume,description,stock,featured");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ products: data.map(mapProductRow), source: "supabase" });
}
