import type { SiteSettings } from "./types";
import { faqs } from "./catalog";

const forceMaintenance =
  process.env.NEXT_PUBLIC_FORCE_MAINTENANCE === "true" || process.env.FORCE_MAINTENANCE === "true";

const defaultAttendanceSchedule = [
  { day: 1, enabled: true, open: "12:00", close: "23:59" },
  { day: 2, enabled: true, open: "12:00", close: "23:59" },
  { day: 3, enabled: true, open: "12:00", close: "23:59" },
  { day: 4, enabled: true, open: "12:00", close: "23:59" },
  { day: 5, enabled: true, open: "12:00", close: "23:59" },
  { day: 6, enabled: true, open: "12:00", close: "23:59" },
  { day: 0, enabled: true, open: "12:00", close: "23:59" },
];

export const defaultSettings: SiteSettings = {
  businessName: "Fonocopete MAVERIK",
  maintenanceMode: forceMaintenance,
  attendanceStatusEnabled: true,
  isAttending: true,
  attendanceScheduleEnabled: false,
  attendanceSchedule: defaultAttendanceSchedule,
  deliveryEnabled: true,
  addressSearchEnabled: false,
  advancePaymentEnabled: true,
  minimumOrderAmount: 0,
  maintenanceMessage:
    "Fonocopete Penquista se encuentra temporalmente fuera de servicio. Estamos realizando mejoras para brindarte una mejor experiencia. Inténtalo nuevamente más tarde.",
  whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "56989351855",
  contactEmail: "fonocopeteconcepcion.maverik@gmail.com",
  instagramUrl: "https://www.instagram.com/fonocopeteconcepcion.maverik/",
  facebookUrl: "https://www.facebook.com/",
  mercadoPagoLink: process.env.NEXT_PUBLIC_MERCADOPAGO_LINK || "https://www.mercadopago.cl/",
  whatsappMessageIntro: "Hola, quiero confirmar este pedido de Fonocopete:",
  seo: {
    title: "Fonocopete Concepcion | Botilleria y delivery",
    titleTemplate: "%s | Fonocopete Concepcion",
    description:
      "Catalogo online de Fonocopete Concepcion. Compra cervezas, piscos, vinos, destilados y promociones con pedidos directos por WhatsApp.",
    keywords:
      "Fonocopete Concepcion, botilleria Concepcion, delivery de alcohol Concepcion, licores Concepcion, cervezas Concepcion, piscos Concepcion",
    ogTitle: "Fonocopete Concepcion | Botilleria y delivery",
    ogDescription:
      "Cervezas, piscos, vinos, destilados y promociones con pedidos directos por WhatsApp en Concepcion y alrededores.",
    twitterTitle: "Fonocopete Concepcion | Botilleria y delivery",
    twitterDescription:
      "Catalogo de licores y promociones con pedidos directos por WhatsApp en Concepcion.",
    canonicalPath: "/",
  },
  faqs: faqs.map((faq, index) => ({ id: `faq-${index + 1}`, ...faq })),
  productOrder: {},
  bankDetails: {
    bank: "Banco de Chile",
    accountHolder: "Fonocopete Penquista",
    accountType: "Cuenta Corriente",
    accountNumber: "12345678",
    rut: "11.111.111-1",
    email: "pagos@fonocopetepenquista.cl",
  },
};
