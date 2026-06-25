import type { SiteSettings } from "./types";
import { faqs } from "./catalog";

const forceMaintenance =
  process.env.NEXT_PUBLIC_FORCE_MAINTENANCE === "true" || process.env.FORCE_MAINTENANCE === "true";

export const defaultSettings: SiteSettings = {
  businessName: "Fonocopete MAVERIK",
  maintenanceMode: forceMaintenance,
  deliveryEnabled: true,
  maintenanceMessage:
    "Fonocopete Penquista se encuentra temporalmente fuera de servicio. Estamos realizando mejoras para brindarte una mejor experiencia. Inténtalo nuevamente más tarde.",
  whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "56939351855",
  contactEmail: "fonocopeteconcepcion.maverik@gmail.com",
  instagramUrl: "https://www.instagram.com/fonocopeteconcepcion.maverik/",
  facebookUrl: "https://www.instagram.com/fonocopeteconcepcion.maverik/",
  mercadoPagoLink: process.env.NEXT_PUBLIC_MERCADOPAGO_LINK || "https://www.mercadopago.cl/",
  faqs: faqs.map((faq, index) => ({ id: `faq-${index + 1}`, ...faq })),
  bankDetails: {
    bank: "Banco de Chile",
    accountHolder: "Fonocopete Penquista",
    accountType: "Cuenta Corriente",
    accountNumber: "12345678",
    rut: "11.111.111-1",
    email: "pagos@fonocopetepenquista.cl",
  },
};
