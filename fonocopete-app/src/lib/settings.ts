import type { SiteSettings } from "./types";

export const defaultSettings: SiteSettings = {
  businessName: "Fonocopete MAVERIK",
  maintenanceMode: false,
  maintenanceMessage:
    "Fonocopete Penquista se encuentra temporalmente fuera de servicio. Estamos realizando mejoras para brindarte una mejor experiencia. Inténtalo nuevamente más tarde.",
  whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "56912345678",
  mercadoPagoLink: process.env.NEXT_PUBLIC_MERCADOPAGO_LINK || "https://www.mercadopago.cl/",
  bankDetails: {
    bank: "Banco de Chile",
    accountHolder: "Fonocopete Penquista",
    accountType: "Cuenta Corriente",
    accountNumber: "12345678",
    rut: "11.111.111-1",
    email: "pagos@fonocopetepenquista.cl",
  },
};
