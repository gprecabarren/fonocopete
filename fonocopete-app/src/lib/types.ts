export type CategoryId = "promociones" | "cervezas" | "piscos" | "vinos" | "destilados" | "extras";

export type Product = {
  id: string;
  name: string;
  category: CategoryId;
  price: number;
  imageUrl: string;
  volume: string;
  description: string;
  stock: "available" | "low" | "sold_out" | "hidden";
  featured?: boolean;
};

export type DeliveryZone = {
  id: string;
  name: string;
  price: number;
  eta: string;
  description: string;
  polygon: Array<{ lat: number; lng: number }>;
  matchTerms: string[];
  active: boolean;
};

export type CartItem = {
  productId: string;
  quantity: number;
};

export type CustomerDetails = {
  name: string;
  phone: string;
  email: string;
  address: string;
  manualAddress: boolean;
  zoneId: string;
  notes: string;
};

export type OrderLine = {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type OrderPayload = {
  customer: CustomerDetails;
  items: OrderLine[];
  subtotal: number;
  delivery: number;
  total: number;
  zoneName: string;
  paymentLink: string;
  paymentMethod: "mercadopago" | "transfer";
};

export type BankDetails = {
  bank: string;
  accountHolder: string;
  accountType: string;
  accountNumber: string;
  rut: string;
  email: string;
};

export type SiteSettings = {
  businessName: string;
  maintenanceMode: boolean;
  deliveryEnabled: boolean;
  maintenanceMessage: string;
  whatsappNumber: string;
  contactEmail: string;
  instagramUrl: string;
  facebookUrl: string;
  mercadoPagoLink: string;
  bankDetails: BankDetails;
};
