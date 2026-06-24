import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const orderSchema = z.object({
  customer: z.object({
    name: z.string().min(1),
    phone: z.string().refine((value) => value.replace(/\D/g, "").length >= 3),
    email: z.email(),
    address: z.string().min(3),
    manualAddress: z.boolean(),
    zoneId: z.string(),
    notes: z.string(),
  }),
  items: z.array(
    z.object({
      name: z.string(),
      quantity: z.number().int().positive(),
      unitPrice: z.number().nonnegative(),
      lineTotal: z.number().nonnegative(),
    }),
  ),
  subtotal: z.number().nonnegative(),
  delivery: z.number().nonnegative(),
  total: z.number().nonnegative(),
  zoneName: z.string(),
  paymentLink: z.string(),
  paymentMethod: z.enum(["mercadopago", "transfer"]),
});

export async function POST(request: Request) {
  const parsed = orderSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Pedido invalido" }, { status: 400 });
  }

  const order = parsed.data;
  const supabase = createServerSupabaseClient();
  const resendKey = process.env.RESEND_API_KEY;
  const ownerEmail = process.env.OWNER_EMAIL;
  const fromEmail = process.env.FROM_EMAIL || "Fonocopete <onboarding@resend.dev>";
  let orderId: string | null = null;

  if (supabase) {
    const { data: savedOrder, error: orderError } = await supabase
      .from("orders")
      .insert({
        customer_name: order.customer.name,
        customer_phone: order.customer.phone,
        customer_email: order.customer.email,
        address: order.customer.address,
        manual_address: order.customer.manualAddress,
        zone_name: order.zoneName,
        subtotal: order.subtotal,
        delivery: order.delivery,
        total: order.total,
        notes: order.customer.notes,
      })
      .select("id")
      .single();

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 500 });
    }

    orderId = savedOrder.id;

    const { error: itemsError } = await supabase.from("order_items").insert(
      order.items.map((item) => ({
        order_id: orderId,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        line_total: item.lineTotal,
      })),
    );

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }
  }

  if (!resendKey || !ownerEmail) {
    return NextResponse.json({ ok: true, email: "skipped", orderId, source: supabase ? "supabase" : "demo" });
  }

  const resend = new Resend(resendKey);
  const itemRows = order.items.map((item) => `${item.quantity}x ${item.name} - $${item.lineTotal}`).join("<br />");

  await resend.emails.send({
    from: fromEmail,
    to: ownerEmail,
    subject: `Nuevo pedido Fonocopete - ${order.customer.name}`,
    html: `
      <h1>Nuevo pedido</h1>
      <p><strong>Cliente:</strong> ${order.customer.name}</p>
      <p><strong>Telefono:</strong> ${order.customer.phone}</p>
      <p><strong>Email:</strong> ${order.customer.email}</p>
      <p><strong>Direccion:</strong> ${order.customer.address}</p>
      <p><strong>Zona:</strong> ${order.zoneName}</p>
      <p>${itemRows}</p>
      <p><strong>Total:</strong> $${order.total}</p>
      <p><strong>Notas:</strong> ${order.customer.notes || "Sin notas"}</p>
    `,
  });

  await resend.emails.send({
    from: fromEmail,
    to: order.customer.email,
    subject: "Confirmacion de pedido Fonocopete",
    html: `
      <h1>Recibimos tu pedido</h1>
      <p>Hola ${order.customer.name}, tu pedido fue enviado a la botilleria para confirmacion.</p>
      <p>${itemRows}</p>
      <p><strong>Total:</strong> $${order.total}</p>
      <p>Si aun no pagaste, usa este link: <a href="${order.paymentLink}">MercadoPago</a>.</p>
    `,
  });

  return NextResponse.json({ ok: true, email: "sent", orderId, source: supabase ? "supabase" : "demo" });
}
