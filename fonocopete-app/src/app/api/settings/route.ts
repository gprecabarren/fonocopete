import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { defaultSettings } from "@/lib/settings";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { SiteSettings } from "@/lib/types";

let demoSettings: SiteSettings = defaultSettings;

const settingsSchema = z.object({
  businessName: z.string().min(1),
  maintenanceMode: z.boolean(),
  maintenanceMessage: z.string().min(1),
  whatsappNumber: z.string().min(5),
  mercadoPagoLink: z.string().min(1),
  bankDetails: z.object({
    bank: z.string().min(1),
    accountHolder: z.string().min(1),
    accountType: z.string().min(1),
    accountNumber: z.string().min(1),
    rut: z.string().min(1),
    email: z.email(),
  }),
});

export async function GET() {
  const supabase = createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ settings: demoSettings, source: "demo" });

  const { data, error } = await supabase.from("site_settings").select("value").eq("key", "main").single();
  if (error || !data?.value) return NextResponse.json({ settings: defaultSettings, source: "supabase" });

  return NextResponse.json({ settings: { ...defaultSettings, ...data.value }, source: "supabase" });
}

export async function PATCH(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const parsed = settingsSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Ajustes invalidos" }, { status: 400 });

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    demoSettings = parsed.data;
    return NextResponse.json({ settings: demoSettings, source: "demo" });
  }

  const { error } = await supabase
    .from("site_settings")
    .upsert({ key: "main", value: parsed.data }, { onConflict: "key" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ settings: parsed.data, source: "supabase" });
}
