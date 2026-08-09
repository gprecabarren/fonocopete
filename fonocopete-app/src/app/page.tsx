import { Storefront } from "@/components/storefront";
import { loadStorefrontInitialData } from "@/lib/server-storefront-data";
import { siteUrl } from "@/lib/site";

const brandAssetVersion = "20260709";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const initialData = await loadStorefrontInitialData();
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "LiquorStore",
    name: "Fonocopete Concepción",
    url: siteUrl,
    email: "fonocopetepenquista@gmail.com",
    telephone: "+56 9 8935 1855",
    image: `${siteUrl}/fonocopete-logo-circle.png?v=${brandAssetVersion}`,
    areaServed: ["Concepción", "San Pedro de la Paz", "Talcahuano", "Coronel"],
    sameAs: [
      "https://www.instagram.com/fonocopeteconcepcion.maverik/",
    ],
    currenciesAccepted: "CLP",
    paymentAccepted: "Efectivo, transferencia bancaria y Mercado Pago",
    priceRange: "$$",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      <Storefront initialData={initialData} />
    </>
  );
}
