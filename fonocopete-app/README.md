# Fonocopete Concepcion

Sitio web para venta y coordinacion de pedidos de alcohol en Concepcion. El cliente navega el catalogo, arma el carrito, elige zona de despacho y confirma el pedido por WhatsApp. El panel de administracion permite mantener productos, categorias, zonas, pedidos y ajustes del negocio sin tocar codigo.

## Estado del proyecto

La aplicacion ya esta conectada a Supabase y preparada para despliegue en Vercel. El dominio principal es `fonocopeteconcepcion.cl`.

El catalogo actual se administra desde la base de datos. Los productos pueden tener categoria principal, categoria secundaria opcional, formato de cerveza, precio normal, precio original opcional, imagen, volumen, estado de stock y marca de destacado.

## Funciones principales

- Catalogo por categorias, subfiltro para cervezas y paginacion.
- Busqueda de productos tolerante a mayusculas, minusculas y tildes.
- Carrito con subtotal, descuentos, despacho y total.
- Cupones con descuento por monto o porcentaje.
- Pedido por WhatsApp con datos del cliente, direccion, zona, notas y resumen de compra.
- Pedidos guardados en Supabase para revision desde el admin.
- Estados visuales para pedidos, pagos y productos.
- Panel para categorias, zonas de despacho, FAQ, SEO, correos, cupones y ajustes generales.
- Modo mantenimiento.
- Aviso de atencion abierto/cerrado con modo manual u horario automatico.
- Recargo temporal por porcentaje para fechas u horarios definidos.
- Modo oscuro para clientes.
- Imagenes de producto con carga por archivo o URL.
- Backup/exportacion de datos desde el panel.

## Stack

- Next.js con App Router
- React
- TypeScript
- Supabase
- Nodemailer
- Vercel

## Variables de entorno

Crear `.env.local` a partir de `.env.example` y completar los valores reales. No subir `.env.local` al repositorio.

Variables usadas por la app:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD_HASH`
- `ADMIN_SESSION_SECRET`
- `NEXT_PUBLIC_WHATSAPP_NUMBER`
- `NEXT_PUBLIC_MERCADOPAGO_LINK`
- `GMAIL_USER`
- `GMAIL_APP_PASSWORD`
- `OWNER_EMAIL`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM`
- `MAILCHIMP_API_KEY`
- `MAILCHIMP_SERVER_PREFIX`
- `MAILCHIMP_AUDIENCE_ID`

Las claves privadas se configuran solo en local o en Vercel. No deben quedar escritas en el README, en commits ni en capturas.

## Desarrollo local

```bash
pnpm install
pnpm dev
```

Abrir `http://localhost:3000`.

Para revisar antes de desplegar:

```bash
pnpm lint
pnpm build
```

## Base de datos

Las migraciones estan en `supabase/migrations`.

Supabase tiene RLS activo en las tablas publicas. La app lee y escribe desde rutas API de Next.js usando la service role key en el servidor; el cliente no deberia escribir directo sobre las tablas.

Tablas principales:

- `products`
- `categories`
- `delivery_zones`
- `orders`
- `order_items`
- `site_settings`

## Correos

El envio transaccional esta preparado con Nodemailer. Puede usar Gmail con clave de aplicacion o SMTP de un correo corporativo cuando este disponible.

Los pedidos pueden enviar:

- confirmacion al cliente
- aviso interno al negocio

Para Gmail se usan `GMAIL_USER` y `GMAIL_APP_PASSWORD`. La clave debe ser una clave de aplicacion, no la contrasena normal de la cuenta.

## Despliegue

Configuracion usada en Vercel:

- Framework: Next.js
- Root Directory: `fonocopete-app`
- Install Command: `pnpm install --frozen-lockfile=false`
- Build Command: `pnpm build`

Despues de cambiar variables de entorno en Vercel, hacer un redeploy.

## Seguridad

- No subir `.env.local`.
- No dejar credenciales de administrador en documentacion.
- Mantener `ADMIN_SESSION_SECRET` como texto largo y unico.
- Rotar claves si alguna se comparte por error.
- Revisar el advisor de Supabase despues de tocar migraciones o permisos.
- Mantener los respaldos locales fuera de Git.

## Archivos locales

Los CSV y JSON de auditoria o respaldo generados durante mantenciones quedan fuera del repositorio. Sirven para revisar cambios puntuales, pero no forman parte del codigo de produccion.
