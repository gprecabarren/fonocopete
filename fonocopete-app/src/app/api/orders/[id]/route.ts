import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const updateSchema = z.object({
  paymentStatus: z.string().min(1).optional(),
  fulfillmentStatus: z.string().min(1).optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  const { id } = await context.params;
  const supabase = createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ ok: true, source: "demo" });

  const values: Record<string, string> = {};
  if (parsed.data.paymentStatus) values.payment_status = parsed.data.paymentStatus;
  if (parsed.data.fulfillmentStatus) values.fulfillment_status = parsed.data.fulfillmentStatus;
  const { error } = await supabase.from("orders").update(values).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, source: "supabase" });
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await context.params;
  const supabase = createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ ok: true, source: "demo" });
  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, source: "supabase" });
}
