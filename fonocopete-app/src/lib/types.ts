export type CategoryId = string;

export type ProductCategory = {
  id: CategoryId;
  label: string;
  sortOrder: number;
};

export type Product = {
  id: string;
  name: string;
  category: CategoryId;
  price: number;
  originalPrice?: number | null;
  beerFormat?: "latas" | "botellas" | null;
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
  city: string;
  addressExtra: string;
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
  paymentMethod: "cash_on_delivery" | "mercadopago" | "transfer";
  orderNumber?: string;
  bankDetails?: BankDetails;
  whatsappMessageIntro?: string;
};

export type SavedOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  address: string;
  city: string;
  addressExtra: string;
  zoneName: string;
  subtotal: number;
  delivery: number;
  total: number;
  paymentMethod: OrderPayload["paymentMethod"];
  paymentStatus: string;
  fulfillmentStatus: string;
  notes: string;
  createdAt: string;
  items: OrderLine[];
};

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

export type BankDetails = {
  bank: string;
  accountHolder: string;
  accountType: string;
  accountNumber: string;
  rut: string;
  email: string;
};

export type SeoSettings = {
  title: string;
  titleTemplate: string;
  description: string;
  keywords: string;
  ogTitle: string;
  ogDescription: string;
  twitterTitle: string;
  twitterDescription: string;
  canonicalPath: string;
};

export type SiteSettings = {
  businessName: string;
  maintenanceMode: boolean;
  attendanceStatusEnabled: boolean;
  isAttending: boolean;
  deliveryEnabled: boolean;
  addressSearchEnabled: boolean;
  advancePaymentEnabled: boolean;
  maintenanceMessage: string;
  whatsappNumber: string;
  contactEmail: string;
  instagramUrl: string;
  facebookUrl: string;
  mercadoPagoLink: string;
  whatsappMessageIntro: string;
  seo: SeoSettings;
  faqs: FaqItem[];
  bankDetails: BankDetails;
};
