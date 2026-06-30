import type { Metadata } from "next";
import localFont from "next/font/local";
import { defaultSettings } from "@/lib/settings";
import { siteUrl } from "@/lib/site";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { SiteSettings } from "@/lib/types";
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

export const dynamic = "force-dynamic";

async function getSeoSettings() {
  const supabase = createServerSupabaseClient();
  if (!supabase) return defaultSettings.seo;

  const { data } = await supabase.from("site_settings").select("value").eq("key", "main").single();
  const settings = data?.value as Partial<SiteSettings> | undefined;
  return { ...defaultSettings.seo, ...settings?.seo };
}

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeoSettings();
  const keywords = seo.keywords
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);

  return {
    metadataBase: new URL(siteUrl),
    icons: {
      icon: "/icon.png",
      apple: "/apple-icon.png",
    },
    title: {
      default: seo.title,
      template: seo.titleTemplate,
    },
    description: seo.description,
    keywords,
    alternates: { canonical: seo.canonicalPath || "/" },
    openGraph: {
      type: "website",
      locale: "es_CL",
      url: seo.canonicalPath || "/",
      siteName: "Fonocopete Concepción",
      title: seo.ogTitle,
      description: seo.ogDescription,
      images: [
        {
          url: `${siteUrl}/opengraph-image?v=logo-1`,
          width: 1200,
          height: 630,
          alt: "Fonocopete Concepción",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: seo.twitterTitle,
      description: seo.twitterDescription,
      images: [`${siteUrl}/opengraph-image?v=logo-1`],
    },
    category: "Botillería y delivery de bebidas",
    verification: seo.googleSiteVerification
      ? {
          google: seo.googleSiteVerification,
        }
      : undefined,
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
}

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
