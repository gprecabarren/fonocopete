import type { Metadata } from "next";
import localFont from "next/font/local";
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
  title: "Fonocopete MAVERIK | Delivery de botilleria",
  description: "Catalogo online de Fonocopete MAVERIK con pedidos por WhatsApp.",
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
