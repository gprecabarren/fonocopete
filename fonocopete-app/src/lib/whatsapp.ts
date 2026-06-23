import type { OrderPayload } from "./types";
import { formatCurrency } from "./format";

export function buildWhatsAppMessage(order: OrderPayload) {
  const lines = order.items
    .map((item) => `- ${item.quantity}x ${item.name}: ${formatCurrency(item.lineTotal)}`)
    .join("\n");

  return [
    "Hola, quiero hacer este pedido:",
    "",
    lines,
    "",
    `Subtotal: ${formatCurrency(order.subtotal)}`,
    `Delivery: ${order.zoneName} - ${formatCurrency(order.delivery)}`,
    `Total: ${formatCurrency(order.total)}`,
    "",
    `Nombre: ${order.customer.name}`,
    `Telefono: ${order.customer.phone}`,
    `Email: ${order.customer.email}`,
    `Direccion: ${order.customer.address}`,
    order.customer.notes ? `Notas: ${order.customer.notes}` : "",
    "",
    `Link de pago: ${order.paymentLink}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildWhatsAppUrl(order: OrderPayload) {
  const fallbackNumber = "56912345678";
  const phone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || fallbackNumber;
  return `https://wa.me/${phone}?text=${encodeURIComponent(buildWhatsAppMessage(order))}`;
}
