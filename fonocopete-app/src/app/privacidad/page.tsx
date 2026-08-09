import Link from "next/link";

export const metadata = {
  title: "Privacidad y cookies",
  description: "Política de privacidad y cookies de Fonocopete Concepción.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f7f4ef] px-4 py-10 text-neutral-950 sm:px-6">
      <article className="mx-auto max-w-3xl rounded-lg border border-neutral-200 bg-white p-6 shadow-sm sm:p-10">
        <Link href="/" className="text-sm font-bold text-red-700 underline underline-offset-2">Volver a la tienda</Link>
        <h1 className="mt-5 text-3xl font-black sm:text-4xl">Privacidad y cookies</h1>
        <div className="mt-7 grid gap-6 text-sm leading-7 text-neutral-700">
          <section>
            <h2 className="text-lg font-black text-neutral-950">Información del pedido</h2>
            <p>Los datos que ingresas para un pedido se usan solamente para preparar, coordinar y atender tu compra. Incluyen datos como nombre, teléfono, correo, dirección, zona de despacho y notas que decidas enviar.</p>
          </section>
          <section>
            <h2 className="text-lg font-black text-neutral-950">Medición opcional</h2>
            <p>Si aceptas la medición, Google Tag Manager y Google Analytics reciben información técnica y agregada de uso, como páginas visitadas, ciudad aproximada, fuente de tráfico y clics de contacto. No enviamos a Google nombres, correos, teléfonos, RUT, direcciones, notas, contenido de pedidos ni otros datos personales o sensibles.</p>
          </section>
          <section>
            <h2 className="text-lg font-black text-neutral-950">Cookies</h2>
            <p>Las cookies necesarias permiten recordar preferencias esenciales de la tienda. Las cookies de Analytics solo se habilitan cuando eliges aceptar la medición. Puedes conservar únicamente las necesarias desde el aviso inicial.</p>
          </section>
          <section>
            <h2 className="text-lg font-black text-neutral-950">Contacto</h2>
            <p>Para consultas sobre privacidad, escríbenos a fonocopetepenquista@gmail.com.</p>
          </section>
        </div>
      </article>
    </main>
  );
}
