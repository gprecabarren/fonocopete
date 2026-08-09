import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { defaultSettings } from "@/lib/settings";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { OrderPayload, SiteSettings } from "@/lib/types";
import { noStoreHeaders } from "@/lib/no-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const orderSchema = z.object({
  customer: z.object({
    name: z.string().min(1),
    phone: z.string().refine((value) => value.replace(/\D/g, "").length >= 3),
    email: z.email(),
    address: z.string().min(3),
    city: z.string(),
    addressExtra: z.string(),
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
  discount: z.number().nonnegative(),
  couponCode: z.string().optional(),
  delivery: z.number().nonnegative(),
  total: z.number().nonnegative(),
  zoneName: z.string(),
  paymentLink: z.string(),
  paymentMethod: z.enum(["cash_on_delivery", "mercadopago", "transfer"]),
  priceAdjustmentActive: z.boolean().optional(),
  priceAdjustmentPercent: z.number().int().nonnegative().optional(),
});

function formatOrderNumber(value: number | string) {
  return `FM-${String(value).padStart(6, "0")}`;
}

async function loadEmailSettings(supabase: ReturnType<typeof createServerSupabaseClient>) {
  if (!supabase) return { contactEmail: defaultSettings.contactEmail, email: defaultSettings.email };

  const { data } = await supabase.from("site_settings").select("value").eq("key", "main").single();
  const value = (data?.value || {}) as Partial<SiteSettings>;
  return {
    contactEmail: value.contactEmail || defaultSettings.contactEmail,
    email: { ...defaultSettings.email, ...value.email },
  };
}

function createMailConfig(settings: Awaited<ReturnType<typeof loadEmailSettings>>) {
  const email = settings.email;
  if (!email.transactionalEnabled) return null;

  const contactEmail = settings.contactEmail || email.replyToEmail || "fonocopetepenquista@gmail.com";
  const smtpHost = process.env.SMTP_HOST || email.smtpHost;
  const smtpPort = Number(process.env.SMTP_PORT || email.smtpPort || 587);
  const smtpUser = process.env.SMTP_USER || email.smtpUser;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const fromEmail = email.fromEmail || contactEmail;
  const fromName = email.fromName || "Fonocopete Concepción";
  const ownerEmail = email.ownerEmail || process.env.OWNER_EMAIL || contactEmail;
  const replyTo = email.replyToEmail || contactEmail;

  if (smtpHost && smtpUser && smtpPassword) {
    return {
      transporter: nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
          auth: { user: smtpUser, pass: smtpPassword },
      }),
      from: process.env.SMTP_FROM || `"${fromName}" <${fromEmail}>`,
      ownerEmail,
      replyTo,
    };
  }

  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;
  if (!gmailUser || !gmailAppPassword) return null;

  return {
    transporter: nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmailUser, pass: gmailAppPassword },
    }),
    from: `"${fromName}" <${fromEmail || gmailUser}>`,
    ownerEmail,
    replyTo,
  };
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401, headers: noStoreHeaders });
  const supabase = createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ orders: [], source: "demo" }, { headers: noStoreHeaders });

  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    source: "supabase",
    orders: data.map((order) => ({
      id: order.id,
      orderNumber: formatOrderNumber(order.order_number),
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      customerEmail: order.customer_email,
      address: order.address,
      city: order.city,
      addressExtra: order.address_extra,
      zoneName: order.zone_name,
      subtotal: order.subtotal,
      discount: order.discount || 0,
      couponCode: order.coupon_code || "",
      delivery: order.delivery,
      total: order.total,
      paymentMethod: order.payment_method,
      paymentStatus: order.payment_status,
      fulfillmentStatus: order.fulfillment_status,
      notes: order.notes || "",
      priceAdjustmentActive: Boolean(order.price_adjustment_active),
      priceAdjustmentPercent: order.price_adjustment_percent || 0,
      createdAt: order.created_at,
      items: order.order_items.map((item: {
        product_name: string;
        quantity: number;
        unit_price: number;
        line_total: number;
      }) => ({
        name: item.product_name,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        lineTotal: item.line_total,
      })),
    })),
  }, { headers: noStoreHeaders });
}

export async function POST(request: Request) {
  const parsed = orderSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }

  const order: OrderPayload = parsed.data;
  const supabase = createServerSupabaseClient();
  let orderId: string | null = null;

  if (supabase) {
    const { data: savedOrder, error: orderError } = await supabase
      .from("orders")
      .insert({
        customer_name: order.customer.name,
        customer_phone: order.customer.phone,
        customer_email: order.customer.email,
        address: order.customer.address,
        city: order.customer.city,
        address_extra: order.customer.addressExtra,
        manual_address: order.customer.manualAddress,
        zone_name: order.zoneName,
        subtotal: order.subtotal,
        discount: order.discount,
        coupon_code: order.couponCode || null,
        delivery: order.delivery,
        total: order.total,
        payment_method: order.paymentMethod,
        payment_status: order.paymentMethod === "cash_on_delivery" ? "pending" : "paid",
        price_adjustment_active: Boolean(order.priceAdjustmentActive),
        price_adjustment_percent: order.priceAdjustmentActive ? order.priceAdjustmentPercent || 0 : 0,
        notes: order.customer.notes,
      })
      .select("id, order_number")
      .single();

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 500 });
    }

    orderId = savedOrder.id;
    order.orderNumber = formatOrderNumber(savedOrder.order_number);

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

  const emailSettings = await loadEmailSettings(supabase);
  const mailConfig = createMailConfig(emailSettings);

  if (!mailConfig) {
    return NextResponse.json({ ok: true, email: "skipped", orderId, orderNumber: order.orderNumber, source: supabase ? "supabase" : "demo" });
  }

  const itemRows = order.items.map((item) => `${item.quantity}x ${item.name} - $${item.lineTotal}`).join("<br />");

  await mailConfig.transporter.sendMail({
    from: mailConfig.from,
    to: mailConfig.ownerEmail,
    replyTo: mailConfig.replyTo,
    subject: `Nuevo pedido Fonocopete - ${order.customer.name}`,
    html: `
      <h1>Nuevo pedido</h1>
      <p><strong>Cliente:</strong> ${order.customer.name}</p>
      <p><strong>Teléfono:</strong> ${order.customer.phone}</p>
      <p><strong>Email:</strong> ${order.customer.email}</p>
      <p><strong>Dirección:</strong> ${order.customer.address}</p>
      <p><strong>Complemento:</strong> ${order.customer.addressExtra || "Sin complemento"}</p>
      <p><strong>Zona:</strong> ${order.zoneName}</p>
      ${order.priceAdjustmentActive ? `<p><strong>Recargo temporal:</strong> ${order.priceAdjustmentPercent || 0}%</p>` : ""}
      <p>${itemRows}</p>
      <p><strong>Descuento:</strong> $${order.discount}</p>
      <p><strong>Total:</strong> $${order.total}</p>
      <p><strong>Notas:</strong> ${order.customer.notes || "Sin notas"}</p>
    `,
  });

  await mailConfig.transporter.sendMail({
    from: mailConfig.from,
    to: order.customer.email,
    replyTo: mailConfig.replyTo,
    subject: "Confirmación de pedido Fonocopete",
    html: `
      <h1>Recibimos tu pedido</h1>
      <p>Hola ${order.customer.name}, tu pedido fue enviado a la botillería para confirmación.</p>
      <p>${itemRows}</p>
      ${order.priceAdjustmentActive ? `<p><strong>Recargo temporal aplicado:</strong> ${order.priceAdjustmentPercent || 0}%</p>` : ""}
      <p><strong>Descuento:</strong> $${order.discount}</p>
      <p><strong>Total:</strong> $${order.total}</p>
      <p>Si aún no pagaste, usa este enlace: <a href="${order.paymentLink}">Mercado Pago</a>.</p>
    `,
  });

  return NextResponse.json({ ok: true, email: "sent", orderId, orderNumber: order.orderNumber, source: supabase ? "supabase" : "demo" });
}
