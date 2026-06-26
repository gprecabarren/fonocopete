import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { defaultSettings } from "@/lib/settings";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { SiteSettings } from "@/lib/types";

let demoSettings: SiteSettings = defaultSettings;

function withRuntimeOverrides(settings: SiteSettings) {
  const whatsappDigits = settings.whatsappNumber.replace(/\D/g, "");
  return {
    ...defaultSettings,
    ...settings,
    bankDetails: { ...defaultSettings.bankDetails, ...settings.bankDetails },
    seo: { ...defaultSettings.seo, ...settings.seo },
    whatsappNumber: ["56939351855", "56912345678"].includes(whatsappDigits)
      ? "56989351855"
      : settings.whatsappNumber,
    maintenanceMode:
      process.env.FORCE_MAINTENANCE === "true" ||
      process.env.NEXT_PUBLIC_FORCE_MAINTENANCE === "true" ||
      settings.maintenanceMode,
  };
}

const settingsSchema = z.object({
  businessName: z.string().min(1),
  maintenanceMode: z.boolean(),
  deliveryEnabled: z.boolean(),
  addressSearchEnabled: z.boolean(),
  advancePaymentEnabled: z.boolean(),
  maintenanceMessage: z.string().min(1),
  whatsappNumber: z.string().min(5),
  contactEmail: z.email(),
  instagramUrl: z.url(),
  facebookUrl: z.url(),
  mercadoPagoLink: z.string().min(1),
  whatsappMessageIntro: z.string(),
  seo: z.object({
    title: z.string().min(1),
    titleTemplate: z.string().min(1),
    description: z.string().min(1),
    keywords: z.string(),
    ogTitle: z.string().min(1),
    ogDescription: z.string().min(1),
    twitterTitle: z.string().min(1),
    twitterDescription: z.string().min(1),
    canonicalPath: z.string().min(1),
  }),
  faqs: z.array(z.object({
    id: z.string().min(1),
    question: z.string().min(1),
    answer: z.string().min(1),
  })),
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
  if (!supabase) return NextResponse.json({ settings: withRuntimeOverrides(demoSettings), source: "demo" });

  const { data, error } = await supabase.from("site_settings").select("value").eq("key", "main").single();
  if (error || !data?.value) return NextResponse.json({ settings: withRuntimeOverrides(defaultSettings), source: "supabase" });

  return NextResponse.json({ settings: withRuntimeOverrides({ ...defaultSettings, ...data.value }), source: "supabase" });
}

export async function PATCH(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const parsed = settingsSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Ajustes inválidos" }, { status: 400 });

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    demoSettings = parsed.data;
    return NextResponse.json({ settings: withRuntimeOverrides(demoSettings), source: "demo" });
  }

  const { error } = await supabase
    .from("site_settings")
    .upsert({ key: "main", value: parsed.data }, { onConflict: "key" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ settings: withRuntimeOverrides(parsed.data), source: "supabase" });
}
