import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { categories as fallbackCategories } from "@/lib/catalog";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { noStoreHeaders } from "@/lib/no-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const categorySchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/).min(1),
  label: z.string().trim().min(1),
  sortOrder: z.number().int().nonnegative(),
});

export async function GET() {
  const supabase = createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ categories: fallbackCategories, source: "demo" }, { headers: noStoreHeaders });

  const { data, error } = await supabase
    .from("categories")
    .select("id,label,sort_order")
    .order("sort_order")
    .order("label");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    categories: data.map((category) => ({
      id: category.id,
      label: category.label,
      sortOrder: category.sort_order,
    })),
    source: "supabase",
  }, { headers: noStoreHeaders });
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const parsed = z.union([categorySchema, z.array(categorySchema).min(1)]).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });

  const categories = Array.isArray(parsed.data) ? parsed.data : [parsed.data];
  const supabase = createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ categories, source: "demo" });

  const { data, error } = await supabase
    .from("categories")
    .upsert(
      categories.map((category) => ({
        id: category.id,
        label: category.label,
        sort_order: category.sortOrder,
      })),
      { onConflict: "id" },
    )
    .select("id,label,sort_order");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    categories: data.map((category) => ({
      id: category.id,
      label: category.label,
      sortOrder: category.sort_order,
    })),
    source: "supabase",
  });
}
