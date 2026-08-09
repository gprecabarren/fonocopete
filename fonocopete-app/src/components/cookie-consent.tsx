"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  cookieConsentStorageKey,
  hasAnalyticsConsent,
  trackAnalyticsEvent,
  updateAnalyticsConsent,
} from "@/lib/analytics";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const accepted = hasAnalyticsConsent();
    const necessaryOnly = window.localStorage.getItem(cookieConsentStorageKey) === "necessary";
    if (accepted) updateAnalyticsConsent(true);
    const showNotice = window.setTimeout(() => setVisible(!accepted && !necessaryOnly), 0);

    function onDocumentClick(event: MouseEvent) {
      const element = event.target instanceof Element ? event.target.closest("a[href]") : null;
      const href = element?.getAttribute("href") || "";
      if (/wa\.me|whatsapp\.com/i.test(href)) trackAnalyticsEvent("contact_whatsapp", { source: "link" });
      if (/^tel:/i.test(href)) trackAnalyticsEvent("contact_call", { source: "link" });
      if (/t\.me|telegram\.me/i.test(href)) trackAnalyticsEvent("contact_telegram", { source: "link" });
    }

    document.addEventListener("click", onDocumentClick);
    return () => {
      window.clearTimeout(showNotice);
      document.removeEventListener("click", onDocumentClick);
    };
  }, []);

  function choose(consent: "accepted" | "necessary") {
    window.localStorage.setItem(cookieConsentStorageKey, consent);
    updateAnalyticsConsent(consent === "accepted");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <aside className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-xl rounded-lg border border-neutral-200 bg-white p-4 shadow-2xl sm:bottom-5 sm:p-5" aria-label="Preferencias de cookies">
      <p className="text-sm font-bold text-neutral-950">Privacidad y medicion</p>
      <p className="mt-1 text-sm leading-6 text-neutral-600">
        Usamos cookies necesarias para que la tienda funcione. Con tu permiso, medimos visitas y acciones generales sin enviar nombres, correos, telefonos, direcciones ni otros datos personales a Google.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => choose("accepted")} className="action-button h-10 rounded-lg bg-neutral-950 px-4 text-sm font-bold text-white">
          Aceptar medicion
        </button>
        <button type="button" onClick={() => choose("necessary")} className="action-button h-10 rounded-lg border border-neutral-300 bg-white px-4 text-sm font-bold text-neutral-800">
          Solo necesarias
        </button>
        <Link href="/privacidad" className="px-1 text-sm font-bold text-red-700 underline underline-offset-2">
          Ver politica
        </Link>
      </div>
    </aside>
  );
}
