import type { DeliveryZone, Product, ProductCategory } from "./types";

export const categories: ProductCategory[] = [
  { id: "promociones", label: "Promociones", sortOrder: 1 },
  { id: "cervezas", label: "Cervezas", sortOrder: 2 },
  { id: "piscos", label: "Piscos", sortOrder: 3 },
  { id: "vinos", label: "Vinos", sortOrder: 4 },
  { id: "destilados", label: "Destilados", sortOrder: 5 },
  { id: "extras", label: "Extras", sortOrder: 6 },
];

export const initialProducts: Product[] = [
  {
    id: "promo-pisco-energetica",
    name: "Promo Pisco + Energética",
    category: "promociones",
    price: 12990,
    volume: "1 botella + 2 latas",
    imageUrl:
      "https://images.unsplash.com/photo-1605270012917-bf157c5a9541?auto=format&fit=crop&w=900&q=80",
    stock: "available",
    featured: true,
  },
  {
    id: "promo-six-pack",
    name: "Six Pack Lager",
    category: "promociones",
    price: 6990,
    volume: "6 x 355 cc",
    imageUrl:
      "https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=900&q=80",
    stock: "available",
    featured: true,
  },
  {
    id: "cristal-lata",
    name: "Cristal Lata",
    category: "cervezas",
    beerFormat: "latas",
    price: 1190,
    volume: "470 cc",
    imageUrl:
      "https://images.unsplash.com/photo-1584225064785-c62a8b43d148?auto=format&fit=crop&w=900&q=80",
    stock: "available",
  },
  {
    id: "kunstmann-torobayo",
    name: "Kunstmann Torobayo",
    category: "cervezas",
    beerFormat: "botellas",
    price: 1790,
    volume: "330 cc",
    imageUrl:
      "https://images.unsplash.com/photo-1618885472179-5e474019f2a9?auto=format&fit=crop&w=900&q=80",
    stock: "low",
  },
  {
    id: "mistral-35",
    name: "Mistral 35",
    category: "piscos",
    price: 8990,
    volume: "750 cc",
    imageUrl:
      "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?auto=format&fit=crop&w=900&q=80",
    stock: "available",
  },
  {
    id: "alto-del-carmen",
    name: "Alto del Carmen 40",
    category: "piscos",
    price: 9490,
    volume: "750 cc",
    imageUrl:
      "https://images.unsplash.com/photo-1527281400683-1aae777175f8?auto=format&fit=crop&w=900&q=80",
    stock: "available",
  },
  {
    id: "casillero-cabernet",
    name: "Casillero Cabernet",
    category: "vinos",
    price: 5490,
    volume: "750 cc",
    imageUrl:
      "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=900&q=80",
    stock: "available",
  },
  {
    id: "absolut-vodka",
    name: "Vodka Absolut",
    category: "destilados",
    price: 14990,
    volume: "750 cc",
    imageUrl:
      "https://images.unsplash.com/photo-1614313511387-1436a4480ebb?auto=format&fit=crop&w=900&q=80",
    stock: "available",
  },
  {
    id: "hielo-2kg",
    name: "Hielo",
    category: "extras",
    price: 1990,
    volume: "2 kg",
    imageUrl:
      "https://images.unsplash.com/photo-1578662996442-48f60103fc96?auto=format&fit=crop&w=900&q=80",
    stock: "available",
  },
];

export const deliveryZones: DeliveryZone[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "San Pedro de la Paz",
    price: 1990,
    description: "Cobertura inicial para San Pedro de la Paz.",
    polygon: [],
    matchTerms: ["san pedro de la paz", "san pedro"],
    active: true,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Talcahuano",
    price: 2990,
    description: "Cobertura inicial para Talcahuano.",
    polygon: [],
    matchTerms: ["talcahuano"],
    active: true,
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    name: "Coronel",
    price: 4490,
    description: "Cobertura inicial para Coronel.",
    polygon: [],
    matchTerms: ["coronel"],
    active: true,
  },
];

export const faqs = [
  {
    question: "¿Puedo pagar por Mercado Pago?",
    answer:
      "Sí. El pedido muestra el total y abre el enlace de pago. El pago se verifica manualmente antes del despacho.",
  },
  {
    question: "¿Los tiempos de entrega son exactos?",
    answer:
      "No. Los tiempos dependen de demanda, clima, distancia y disponibilidad del repartidor.",
  },
  {
    question: "¿Qué pasa si mi dirección no aparece?",
    answer:
      "Puedes escribir una dirección manual y el despacho queda sujeto a confirmación por WhatsApp.",
  },
  {
    question: "¿Venden a menores de edad?",
    answer:
      "No. La entrega requiere comprador mayor de 18 años y se puede solicitar documento.",
  },
];
