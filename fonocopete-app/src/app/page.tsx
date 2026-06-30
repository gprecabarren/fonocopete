import { Storefront } from "@/components/storefront";
import { siteUrl } from "@/lib/site";

export default function Home() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "LiquorStore",
    name: "Fonocopete Concepción",
    url: siteUrl,
    email: "contacto@fonocopeteconcepcion.cl",
    telephone: "+56 9 8935 1855",
    image: `${siteUrl}/fonocopete-logo-circle.jpg`,
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
      <Storefront />
    </>
  );
}
