import type { CategoryId, DeliveryZone, Product } from "./types";

export const categories: Array<{ id: CategoryId; label: string }> = [
  { id: "promociones", label: "Promociones" },
  { id: "cervezas", label: "Cervezas" },
  { id: "piscos", label: "Piscos" },
  { id: "vinos", label: "Vinos" },
  { id: "destilados", label: "Destilados" },
  { id: "extras", label: "Extras" },
];

export const initialProducts: Product[] = [
  {
    id: "promo-pisco-energetica",
    name: "Promo Pisco + Energetica",
    category: "promociones",
    price: 12990,
    volume: "1 botella + 2 latas",
    description: "Pack listo para compartir, frio segun disponibilidad.",
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
    description: "Cervezas rubias para llegar rapido al carrito.",
    imageUrl:
      "https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=900&q=80",
    stock: "available",
    featured: true,
  },
  {
    id: "cristal-lata",
    name: "Cristal Lata",
    category: "cervezas",
    price: 1190,
    volume: "470 cc",
    description: "Clasica chilena, ideal para pedido rapido.",
    imageUrl:
      "https://images.unsplash.com/photo-1584225064785-c62a8b43d148?auto=format&fit=crop&w=900&q=80",
    stock: "available",
  },
  {
    id: "kunstmann-torobayo",
    name: "Kunstmann Torobayo",
    category: "cervezas",
    price: 1790,
    volume: "330 cc",
    description: "Amber ale con cuerpo medio.",
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
    description: "Pisco suave para piscola o sour.",
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
    description: "Formato clasico para reuniones.",
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
    description: "Tinto de mesa para acompanar comida.",
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
    description: "Vodka premium para cocteleria simple.",
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
    description: "Bolsa de hielo para completar el pedido.",
    imageUrl:
      "https://images.unsplash.com/photo-1578662996442-48f60103fc96?auto=format&fit=crop&w=900&q=80",
    stock: "available",
  },
];

export const deliveryZones: DeliveryZone[] = [
  {
    id: "zona-cercana",
    name: "Zona cercana",
    price: 1990,
    eta: "25-40 min",
    description: "Radio cercano a la botilleria.",
    polygon: [
      { lat: -33.432, lng: -70.675 },
      { lat: -33.432, lng: -70.615 },
      { lat: -33.48, lng: -70.615 },
      { lat: -33.48, lng: -70.675 },
    ],
  },
  {
    id: "zona-media",
    name: "Zona media",
    price: 2990,
    eta: "35-55 min",
    description: "Comunas o barrios cercanos al sector principal.",
    polygon: [
      { lat: -33.405, lng: -70.705 },
      { lat: -33.405, lng: -70.585 },
      { lat: -33.51, lng: -70.585 },
      { lat: -33.51, lng: -70.705 },
    ],
  },
  {
    id: "zona-extendida",
    name: "Zona extendida",
    price: 4490,
    eta: "45-75 min",
    description: "Cobertura extendida sujeta a confirmacion.",
    polygon: [
      { lat: -33.385, lng: -70.735 },
      { lat: -33.385, lng: -70.555 },
      { lat: -33.535, lng: -70.555 },
      { lat: -33.535, lng: -70.735 },
    ],
  },
];

export const faqs = [
  {
    question: "¿Puedo pagar por MercadoPago?",
    answer:
      "Si. El pedido muestra el total y abre el link de pago. El pago se verifica manualmente antes del despacho.",
  },
  {
    question: "¿Los tiempos de entrega son exactos?",
    answer:
      "No. Los tiempos dependen de demanda, clima, distancia y disponibilidad del repartidor.",
  },
  {
    question: "¿Que pasa si mi direccion no aparece?",
    answer:
      "Puedes escribir una direccion manual y el despacho queda sujeto a confirmacion por WhatsApp.",
  },
  {
    question: "¿Venden a menores de edad?",
    answer:
      "No. La entrega requiere comprador mayor de 18 anos y se puede solicitar documento.",
  },
];
