"use client";

type AnalyticsEventName =
  | "fonocopete_order_registered"
  | "fonocopete_registration"
  | "fonocopete_profile_created"
  | "fonocopete_review_submitted"
  | "contact_whatsapp"
  | "contact_telegram"
  | "contact_call"
  | "google_preferred_source_click";

type AnalyticsValue = string | number | boolean;

const consentStorageKey = "fonocopete-cookie-consent";
const allowedParameterKeys = new Set([
  "source",
  "payment_method",
  "item_count",
  "value",
  "currency",
  "coupon_applied",
  "shipping_zone_selected",
]);

function dataLayer() {
  if (typeof window === "undefined") return null;
  const browserWindow = window as typeof window & { dataLayer?: unknown[] };
  browserWindow.dataLayer ||= [];
  return browserWindow.dataLayer;
}

export function hasAnalyticsConsent() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(consentStorageKey) === "accepted";
}

export function updateAnalyticsConsent(granted: boolean) {
  const layer = dataLayer();
  if (!layer) return;

  layer.push([
    "consent",
    "update",
    {
      analytics_storage: granted ? "granted" : "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    },
  ]);
}

export function trackAnalyticsEvent(
  event: AnalyticsEventName,
  parameters: Record<string, AnalyticsValue> = {},
) {
  if (!hasAnalyticsConsent()) return;

  const safeParameters = Object.fromEntries(
    Object.entries(parameters).filter(([key]) => allowedParameterKeys.has(key)),
  );

  dataLayer()?.push({ event, ...safeParameters });
}

export const cookieConsentStorageKey = consentStorageKey;
