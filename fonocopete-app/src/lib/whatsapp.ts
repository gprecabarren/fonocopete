import type { OrderPayload } from "./types";
import { formatCurrency } from "./format";

export function normalizeChilePhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("9") && digits.length === 9) digits = `56${digits}`;
  if (!digits.startsWith("56") && digits.length >= 8) digits = `56${digits}`;
  return digits;
}

export function buildWhatsAppMessage(order: OrderPayload, purpose: "order" | "mercadopago" | "transfer" = "order") {
  const lines = order.items
    .map((item) => `- ${item.quantity}x ${item.name}: ${formatCurrency(item.lineTotal)}`)
    .join("\n");

  return [
    purpose === "mercadopago"
      ? "Hola, realice el pago por Mercado Pago para este pedido:"
      : purpose === "transfer"
        ? "Hola, realice una transferencia para este pedido:"
        : "Hola, quiero confirmar este pedido:",
    order.orderNumber ? `Pedido: *${order.orderNumber}*` : "",
    "",
    lines,
    "",
    `Subtotal: ${formatCurrency(order.subtotal)}`,
    `Delivery: ${order.zoneName} - ${formatCurrency(order.delivery)}`,
    `Total: ${formatCurrency(order.total)}`,
    "",
    `Nombre: ${order.customer.name}`,
    `Teléfono: ${order.customer.phone}`,
    `Email: ${order.customer.email}`,
    `Dirección: ${order.customer.address}`,
    order.customer.city ? `Ciudad: ${order.customer.city}` : "",
    order.customer.addressExtra ? `Complemento: ${order.customer.addressExtra}` : "",
    order.customer.notes ? `Notas: ${order.customer.notes}` : "",
    "",
    `Link de pago: ${order.paymentLink}`,
    purpose === "transfer" ? "*Y adjunto el comprobante de compra aqui.*" : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildWhatsAppUrl(
  order: OrderPayload,
  configuredNumber?: string,
  purpose: "order" | "mercadopago" | "transfer" = "order",
) {
  const fallbackNumber = "56912345678";
  const phone = normalizeChilePhone(configuredNumber || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || fallbackNumber);
  return `https://wa.me/${phone}?text=${encodeURIComponent(buildWhatsAppMessage(order, purpose))}`;
}
