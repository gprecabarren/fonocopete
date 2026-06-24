import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await context.params;
  const supabase = createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ ok: true, source: "demo" });

  const { error } = await supabase.from("delivery_zones").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, source: "supabase" });
}
