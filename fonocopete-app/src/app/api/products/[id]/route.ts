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
    secondaryCategory: z.string().nullable().optional(),
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
    if (product.secondaryCategory && product.secondaryCategory === product.category) {
      context.addIssue({
        code: "custom",
        path: ["secondaryCategory"],
        message: "La segunda categoría debe ser distinta.",
      });
    }
  });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const [{ id }, parsed] = await Promise.all([context.params, productSchema.safeParseAsync(await request.json())]);

  if (!parsed.success || parsed.data.id !== id) {
    return NextResponse.json({ error: "Producto inválido" }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return NextResponse.json({ product: parsed.data, source: "demo" });
  }

  const { data, error } = await supabase
    .from("products")
    .update(mapProductToRow(parsed.data as Product))
    .eq("id", id)
    .select("id,name,category_id,secondary_category_id,price,original_price,beer_format,image_url,volume,description,stock,featured")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ product: mapProductRow(data), source: "supabase" });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await context.params;
  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return NextResponse.json({ ok: true, source: "demo" });
  }

  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, source: "supabase" });
}
