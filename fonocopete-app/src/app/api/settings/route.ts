import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { defaultSettings } from "@/lib/settings";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { SiteSettings } from "@/lib/types";
import { noStoreHeaders } from "@/lib/no-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

let demoSettings: SiteSettings = defaultSettings;

function withRuntimeOverrides(settings: SiteSettings) {
  const whatsappDigits = settings.whatsappNumber.replace(/\D/g, "");
  return {
    ...defaultSettings,
    ...settings,
    bankDetails: { ...defaultSettings.bankDetails, ...settings.bankDetails },
    seo: { ...defaultSettings.seo, ...settings.seo },
    attendanceSchedule: settings.attendanceSchedule || defaultSettings.attendanceSchedule,
    productOrder: settings.productOrder || defaultSettings.productOrder,
    coupons: settings.coupons || defaultSettings.coupons,
    newsletter: { ...defaultSettings.newsletter, ...settings.newsletter },
    email: { ...defaultSettings.email, ...settings.email },
    productPriceAdjustment: { ...defaultSettings.productPriceAdjustment, ...settings.productPriceAdjustment },
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
  attendanceStatusEnabled: z.boolean(),
  isAttending: z.boolean(),
  attendanceScheduleEnabled: z.boolean(),
  attendanceSchedule: z.array(z.object({
    day: z.number().int().min(0).max(6),
    enabled: z.boolean(),
    open: z.string().regex(/^\d{2}:\d{2}$/),
    close: z.string().regex(/^\d{2}:\d{2}$/),
  })),
  deliveryEnabled: z.boolean(),
  addressSearchEnabled: z.boolean(),
  advancePaymentEnabled: z.boolean(),
  minimumOrderAmount: z.number().int().nonnegative(),
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
    googleSiteVerification: z.string(),
  }),
  faqs: z.array(z.object({
    id: z.string().min(1),
    question: z.string().min(1),
    answer: z.string().min(1),
  })),
  coupons: z.array(z.object({
    id: z.string().min(1),
    code: z.string().min(1),
    type: z.enum(["percentage", "fixed"]),
    value: z.number().int().nonnegative(),
    active: z.boolean(),
    minimumSubtotal: z.number().int().nonnegative(),
    description: z.string(),
  })),
  newsletter: z.object({
    enabled: z.boolean(),
    provider: z.literal("mailchimp"),
    audienceId: z.string(),
    formUrl: z.string(),
    defaultTags: z.string(),
  }),
  email: z.object({
    transactionalEnabled: z.boolean(),
    fromName: z.string().min(1),
    fromEmail: z.email(),
    ownerEmail: z.email(),
    replyToEmail: z.email(),
    smtpHost: z.string(),
    smtpPort: z.string(),
    smtpUser: z.string(),
    credentialsConfigured: z.boolean(),
  }),
  productPriceAdjustment: z.object({
    enabled: z.boolean(),
    percentage: z.number().int().min(0).max(300),
    scheduleEnabled: z.boolean(),
    startDate: z.string(),
    endDate: z.string(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
  }),
  productOrder: z.record(z.string(), z.array(z.string())),
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
  if (!supabase) return NextResponse.json({ settings: withRuntimeOverrides(demoSettings), source: "demo" }, { headers: noStoreHeaders });

  const { data, error } = await supabase.from("site_settings").select("value").eq("key", "main").single();
  if (error || !data?.value) return NextResponse.json({ settings: withRuntimeOverrides(defaultSettings), source: "supabase" }, { headers: noStoreHeaders });

  return NextResponse.json({ settings: withRuntimeOverrides({ ...defaultSettings, ...data.value }), source: "supabase" }, { headers: noStoreHeaders });
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
