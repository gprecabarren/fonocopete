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
  businessName: "Fonocopete Concepción",
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
  contactEmail: "fonocopetepenquista@gmail.com",
  instagramUrl: "https://www.instagram.com/fonocopeteconcepcion.maverik/",
  facebookUrl: "https://www.facebook.com/",
  mercadoPagoLink: process.env.NEXT_PUBLIC_MERCADOPAGO_LINK || "https://www.mercadopago.cl/",
  whatsappMessageIntro: "Hola, quiero confirmar este pedido de Fonocopete:",
  seo: {
    title: "Fonocopete Concepción | Botillería y delivery",
    titleTemplate: "%s | Fonocopete Concepción",
    description:
      "Catálogo online de Fonocopete Concepción. Compra cervezas, piscos, vinos, destilados y promociones con pedidos directos por WhatsApp.",
    keywords:
      "Fonocopete Concepción, botillería Concepción, delivery de alcohol Concepción, licores Concepción, cervezas Concepción, piscos Concepción",
    ogTitle: "Fonocopete Concepción | Botillería y delivery",
    ogDescription:
      "Cervezas, piscos, vinos, destilados y promociones con pedidos directos por WhatsApp en Concepción y alrededores.",
    twitterTitle: "Fonocopete Concepción | Botillería y delivery",
    twitterDescription:
      "Catálogo de licores y promociones con pedidos directos por WhatsApp en Concepción.",
    canonicalPath: "/",
    googleSiteVerification: "WTh3OsH9HnvMDiu5NrEJ6PvUhVnJl50EnWpsWYub6J0",
  },
  faqs: faqs.map((faq, index) => ({ id: `faq-${index + 1}`, ...faq })),
  coupons: [],
  newsletter: {
    enabled: false,
    provider: "mailchimp",
    audienceId: "",
    formUrl: "",
    defaultTags: "promociones, clientes web",
  },
  email: {
    transactionalEnabled: false,
    fromName: "Fonocopete Concepción",
    fromEmail: "fonocopetepenquista@gmail.com",
    ownerEmail: "fonocopetepenquista@gmail.com",
    replyToEmail: "fonocopetepenquista@gmail.com",
    smtpHost: "",
    smtpPort: "587",
    smtpUser: "",
    credentialsConfigured: false,
  },
  productPriceAdjustment: {
    enabled: false,
    percentage: 0,
    scheduleEnabled: false,
    startDate: "",
    endDate: "",
    startTime: "00:00",
    endTime: "23:59",
  },
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
