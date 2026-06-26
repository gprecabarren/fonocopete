import type { OrderPayload } from "./types";
import { formatCurrency } from "./format";

export function normalizeChilePhone(value: string) {
  const hadInternationalPrefix = value.trim().startsWith("+") || value.trim().startsWith("00");
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (hadInternationalPrefix) return digits;
  if (digits.startsWith("9") && digits.length === 9) digits = `56${digits}`;
  return digits;
}

export function buildWhatsAppMessage(order: OrderPayload, purpose: "order" | "mercadopago" | "transfer" = "order") {
  const productLines = order.items
    .map((item) => `- ${item.quantity}x ${item.name}: ${formatCurrency(item.lineTotal)}`)
    .join("\n");
  const paymentLabel =
    order.paymentMethod === "cash_on_delivery"
      ? "Pago contra entrega"
      : order.paymentMethod === "mercadopago"
        ? "Mercado Pago"
        : "Transferencia bancaria";
  const defaultIntro =
    purpose === "mercadopago"
      ? "Hola, realice el pago por Mercado Pago para este pedido:"
      : purpose === "transfer"
        ? "Hola, realice una transferencia para este pedido:"
        : "Hola, quiero confirmar este pedido:";
  const bankLines = order.bankDetails
    ? [
        "",
        "*Datos de transferencia:*",
        `Banco: ${order.bankDetails.bank}`,
        `Titular: ${order.bankDetails.accountHolder}`,
        `${order.bankDetails.accountType}: ${order.bankDetails.accountNumber}`,
        `RUT: ${order.bankDetails.rut}`,
        `Correo: ${order.bankDetails.email}`,
      ]
    : [];

  return [
    order.whatsappMessageIntro?.trim() || defaultIntro,
    order.orderNumber ? `Pedido: *${order.orderNumber}*` : "",
    "",
    "*Productos:*",
    productLines,
    "",
    `Subtotal: ${formatCurrency(order.subtotal)}`,
    `Delivery: ${order.zoneName} - ${formatCurrency(order.delivery)}`,
    `Total: ${formatCurrency(order.total)}`,
    `Metodo de pago: ${paymentLabel}`,
    "",
    "*Datos de cliente:*",
    `Nombre: ${order.customer.name}`,
    `Telefono: ${order.customer.phone}`,
    `Email: ${order.customer.email}`,
    `Direccion: ${order.customer.address}`,
    order.zoneName ? `Zona: ${order.zoneName}` : "",
    order.customer.notes ? `Notas: ${order.customer.notes}` : "",
    `Direccion completa: ${order.customer.address}, ${order.zoneName}`,
    ...(purpose === "transfer" ? bankLines : []),
    purpose === "mercadopago" ? `Link de pago: ${order.paymentLink}` : "",
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
  const fallbackNumber = "56989351855";
  const phone = normalizeChilePhone(configuredNumber || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || fallbackNumber);
  return `https://wa.me/${phone}?text=${encodeURIComponent(buildWhatsAppMessage(order, purpose))}`;
}
