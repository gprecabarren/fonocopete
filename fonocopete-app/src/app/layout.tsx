import type { Metadata } from "next";
import "./globals.css";

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
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
