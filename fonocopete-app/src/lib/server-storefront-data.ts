import { categories as fallbackCategories, deliveryZones as fallbackDeliveryZones, initialProducts } from "./catalog";
import { mapDeliveryZoneRow } from "./delivery-zone-mapper";
import { mapProductRow } from "./product-mapper";
import { defaultSettings } from "./settings";
import { createServerSupabaseClient } from "./supabase-server";
import type { SiteSettings, StorefrontInitialData } from "./types";

function resolveServerSettings(settings: Partial<SiteSettings> = {}): SiteSettings {
  const whatsappDigits = settings.whatsappNumber?.replace(/\D/g, "");

  return {
    ...defaultSettings,
    ...settings,
    whatsappNumber: whatsappDigits === "56939351855" || whatsappDigits === "56912345678"
      ? "56989351855"
      : settings.whatsappNumber || defaultSettings.whatsappNumber,
    attendanceSchedule: settings.attendanceSchedule || defaultSettings.attendanceSchedule,
    coupons: settings.coupons || defaultSettings.coupons,
    newsletter: { ...defaultSettings.newsletter, ...settings.newsletter },
    email: { ...defaultSettings.email, ...settings.email },
    productPriceAdjustment: { ...defaultSettings.productPriceAdjustment, ...settings.productPriceAdjustment },
    productOrder: settings.productOrder || defaultSettings.productOrder,
    bankDetails: { ...defaultSettings.bankDetails, ...settings.bankDetails },
    seo: { ...defaultSettings.seo, ...settings.seo },
    maintenanceMode:
      process.env.FORCE_MAINTENANCE === "true" ||
      process.env.NEXT_PUBLIC_FORCE_MAINTENANCE === "true" ||
      Boolean(settings.maintenanceMode),
  };
}

export async function loadStorefrontInitialData(): Promise<StorefrontInitialData> {
  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return {
      source: "demo",
      products: initialProducts,
      categories: fallbackCategories,
      deliveryZones: fallbackDeliveryZones,
      settings: resolveServerSettings(defaultSettings),
    };
  }

  const [productsResult, categoriesResult, zonesResult, settingsResult] = await Promise.all([
    supabase
      .from("products")
      .select("id,name,category_id,secondary_category_id,price,original_price,beer_format,image_url,volume,stock,featured")
      .order("featured", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("categories")
      .select("id,label,sort_order")
      .order("sort_order")
      .order("label"),
    supabase.from("delivery_zones").select("*").order("sort_order"),
    supabase.from("site_settings").select("value").eq("key", "main").single(),
  ]);

  return {
    source: "supabase",
    products: productsResult.error ? [] : productsResult.data.map(mapProductRow),
    categories: categoriesResult.error
      ? fallbackCategories
      : categoriesResult.data.map((category) => ({
          id: category.id,
          label: category.label,
          sortOrder: category.sort_order,
        })),
    deliveryZones: zonesResult.error ? [] : zonesResult.data.map(mapDeliveryZoneRow),
    settings: resolveServerSettings(
      settingsResult.error || !settingsResult.data?.value
        ? defaultSettings
        : { ...defaultSettings, ...(settingsResult.data.value as Partial<SiteSettings>) },
    ),
  };
}
