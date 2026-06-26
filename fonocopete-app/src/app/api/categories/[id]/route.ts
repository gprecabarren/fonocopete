import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await context.params;
  if (id === "cervezas") {
    return NextResponse.json({ error: "La categoría Cervezas no se puede eliminar." }, { status: 409 });
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ ok: true, source: "demo" });

  const { count, error: countError } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id);

  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });
  if (count) {
    return NextResponse.json(
      { error: `La categoría tiene ${count} producto${count === 1 ? "" : "s"}. Muévelos antes de eliminarla.` },
      { status: 409 },
    );
  }

  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, source: "supabase" });
}
