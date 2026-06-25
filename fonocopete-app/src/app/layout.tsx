import type { Metadata } from "next";
import localFont from "next/font/local";
import { siteUrl } from "@/lib/site";
import "./globals.css";

const roboto = localFont({
  variable: "--font-roboto",
  src: [
    { path: "./fonts/Roboto-Regular.ttf", weight: "400" },
    { path: "./fonts/Roboto-Bold.ttf", weight: "700" },
  ],
});
const montserrat = localFont({
  variable: "--font-montserrat",
  src: [
    { path: "./fonts/Montserrat-Regular.ttf", weight: "400" },
    { path: "./fonts/Montserrat-SemiBold.ttf", weight: "600" },
    { path: "./fonts/Montserrat-Bold.ttf", weight: "700" },
  ],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Fonocopete Concepción | Botillería y delivery",
    template: "%s | Fonocopete Concepción",
  },
  description:
    "Catálogo online de Fonocopete Concepción. Compra cervezas, piscos, vinos, destilados y promociones con pedidos directos por WhatsApp.",
  keywords: [
    "Fonocopete Concepción",
    "botillería Concepción",
    "delivery de alcohol Concepción",
    "licores Concepción",
    "cervezas Concepción",
    "piscos Concepción",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "es_CL",
    url: "/",
    siteName: "Fonocopete Concepción",
    title: "Fonocopete Concepción | Botillería y delivery",
    description:
      "Cervezas, piscos, vinos, destilados y promociones con pedidos directos por WhatsApp en Concepción y alrededores.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fonocopete Concepción | Botillería y delivery",
    description:
      "Catálogo de licores y promociones con pedidos directos por WhatsApp en Concepción.",
  },
  category: "Botillería y delivery de bebidas",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${roboto.variable} ${montserrat.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
