"use client";

/* eslint-disable @next/next/no-img-element */

import {
  AlertTriangle,
  BadgeCheck,
  Beer,
  Bike,
  Check,
  ChevronRight,
  ClipboardList,
  CreditCard,
  MapPin,
  MessageCircle,
  Minus,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  Upload,
  Wine,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { categories, deliveryZones, faqs, initialProducts } from "@/lib/catalog";
import { inferDemoZoneFromAddress } from "@/lib/delivery";
import { formatCurrency, normalizeText } from "@/lib/format";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import type { CartItem, CategoryId, CustomerDetails, DeliveryZone, OrderPayload, Product } from "@/lib/types";

const catalogStorageKey = "fonocopete.catalog";
const ageStorageKey = "fonocopete.age-ok";

const emptyCustomer: CustomerDetails = {
  name: "",
  phone: "",
  email: "",
  address: "",
  manualAddress: false,
  zoneId: deliveryZones[0].id,
  notes: "",
};

const productDraft: Product = {
  id: "",
  name: "",
  category: "promociones",
  price: 0,
  imageUrl: "",
  volume: "",
  description: "",
  stock: "available",
};

export function Storefront() {
  const [products, setProducts] = useState<Product[]>(() => {
    if (typeof window === "undefined") return initialProducts;
    const storedCatalog = window.localStorage.getItem(catalogStorageKey);
    if (!storedCatalog) return initialProducts;
    try {
      return JSON.parse(storedCatalog) as Product[];
    } catch {
      window.localStorage.removeItem(catalogStorageKey);
      return initialProducts;
    }
  });
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<CategoryId>("promociones");
  const [query, setQuery] = useState("");
  const [customer, setCustomer] = useState<CustomerDetails>(emptyCustomer);
  const [orderStatus, setOrderStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [ageConfirmed, setAgeConfirmed] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem(ageStorageKey) === "true",
  );
  const [draft, setDraft] = useState<Product>(productDraft);
  const [bulkText, setBulkText] = useState("");
  const [adminView, setAdminView] = useState<"catalog" | "zones">("catalog");
  const [productSource, setProductSource] = useState<"local" | "supabase">("local");
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "saved" | "error">("idle");

  useEffect(() => {
    if (productSource === "local") {
      window.localStorage.setItem(catalogStorageKey, JSON.stringify(products));
    }
  }, [products, productSource]);

  useEffect(() => {
    async function loadProducts() {
      try {
        const response = await fetch("/api/products");
        if (!response.ok) return;
        const data = (await response.json()) as { products: Product[]; source: "demo" | "supabase" };
        if (data.source === "supabase") {
          setProductSource("supabase");
          setProducts(data.products.length > 0 ? data.products : initialProducts);
        }
      } catch {
        setProductSource("local");
      }
    }

    void loadProducts();
  }, []);

  const activeZone = deliveryZones.find((zone) => zone.id === customer.zoneId) ?? deliveryZones[0];
  const paymentLink = process.env.NEXT_PUBLIC_MERCADOPAGO_LINK || "https://www.mercadopago.cl/";

  const filteredProducts = useMemo(() => {
    const cleanQuery = normalizeText(query);
    return products.filter((product) => {
      const matchesCategory = product.category === activeCategory;
      const matchesQuery =
        !cleanQuery ||
        normalizeText(`${product.name} ${product.description} ${product.volume}`).includes(cleanQuery);
      return product.stock !== "hidden" && matchesCategory && matchesQuery;
    });
  }, [products, activeCategory, query]);

  const featuredProducts = useMemo(() => products.filter((product) => product.featured), [products]);

  const cartLines = useMemo(() => {
    return cart
      .map((item) => {
        const product = products.find((entry) => entry.id === item.productId);
        if (!product) return null;
        return {
          ...item,
          product,
          lineTotal: product.price * item.quantity,
        };
      })
      .filter(Boolean) as Array<CartItem & { product: Product; lineTotal: number }>;
  }, [cart, products]);

  const subtotal = cartLines.reduce((sum, item) => sum + item.lineTotal, 0);
  const deliveryPrice = customer.manualAddress ? activeZone.price : activeZone.price;
  const total = subtotal + (subtotal > 0 ? deliveryPrice : 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  function confirmAge() {
    window.localStorage.setItem(ageStorageKey, "true");
    setAgeConfirmed(true);
  }

  function addToCart(productId: string) {
    setCart((current) => {
      const existing = current.find((item) => item.productId === productId);
      if (existing) {
        return current.map((item) =>
          item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [...current, { productId, quantity: 1 }];
    });
  }

  function updateQuantity(productId: string, delta: number) {
    setCart((current) =>
      current
        .map((item) => (item.productId === productId ? { ...item, quantity: item.quantity + delta } : item))
        .filter((item) => item.quantity > 0),
    );
  }

  function removeProduct(productId: string) {
    setCart((current) => current.filter((item) => item.productId !== productId));
  }

  function updateCustomer(field: keyof CustomerDetails, value: string | boolean) {
    setCustomer((current) => ({ ...current, [field]: value }));
  }

  function detectZone() {
    const zone = inferDemoZoneFromAddress(customer.address);
    if (zone) {
      updateCustomer("zoneId", zone.id);
      updateCustomer("manualAddress", false);
      return;
    }
    updateCustomer("manualAddress", true);
  }

  function buildOrder(): OrderPayload {
    return {
      customer,
      items: cartLines.map((item) => ({
        name: item.product.name,
        quantity: item.quantity,
        unitPrice: item.product.price,
        lineTotal: item.lineTotal,
      })),
      subtotal,
      delivery: subtotal > 0 ? deliveryPrice : 0,
      total,
      zoneName: customer.manualAddress ? `${activeZone.name} (manual)` : activeZone.name,
      paymentLink,
    };
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (cartLines.length === 0 || !customer.name || !customer.phone || !customer.email || !customer.address) {
      setOrderStatus("error");
      return;
    }

    setOrderStatus("sending");
    const order = buildOrder();

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(order),
      });

      if (!response.ok) throw new Error("No se pudo registrar el pedido");

      window.open(buildWhatsAppUrl(order), "_blank", "noopener,noreferrer");
      setOrderStatus("sent");
    } catch {
      window.open(buildWhatsAppUrl(order), "_blank", "noopener,noreferrer");
      setOrderStatus("error");
    }
  }

  async function persistProducts(nextProducts: Product[]) {
    setSyncStatus("syncing");
    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextProducts),
      });
      if (!response.ok) throw new Error("No se pudo guardar");
      const data = (await response.json()) as { products: Product[]; source: "demo" | "supabase" };
      if (data.source === "supabase") setProductSource("supabase");
      setSyncStatus("saved");
      return data.products.length > 0 ? data.products : nextProducts;
    } catch {
      setProductSource("local");
      setSyncStatus("error");
      return nextProducts;
    }
  }

  async function persistProduct(product: Product) {
    setSyncStatus("syncing");
    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(product),
      });
      if (!response.ok) throw new Error("No se pudo guardar");
      const data = (await response.json()) as { source: "demo" | "supabase" };
      if (data.source === "supabase") setProductSource("supabase");
      setSyncStatus("saved");
    } catch {
      setProductSource("local");
      setSyncStatus("error");
    }
  }

  async function addDraftProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.name || draft.price <= 0) return;

    const nextProduct: Product = {
      ...draft,
      id: draft.id || crypto.randomUUID(),
      imageUrl:
        draft.imageUrl ||
        "https://images.unsplash.com/photo-1535958636474-b021ee887b13?auto=format&fit=crop&w=900&q=80",
      description: draft.description || "Producto cargado desde administracion.",
      volume: draft.volume || "Formato por definir",
    };

    const savedProducts = await persistProducts([nextProduct]);
    setProducts((current) => [...savedProducts, ...current.filter((product) => product.id !== nextProduct.id)]);
    setDraft(productDraft);
  }

  async function importBulkProducts() {
    const imported = bulkText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, price, category, volume, imageUrl] = line.split(";").map((value) => value.trim());
        return {
          id: crypto.randomUUID(),
          name,
          price: Number(price),
          category: (category as CategoryId) || "promociones",
          volume: volume || "Formato por definir",
          imageUrl:
            imageUrl ||
            "https://images.unsplash.com/photo-1535958636474-b021ee887b13?auto=format&fit=crop&w=900&q=80",
          description: "Carga rapida desde lista.",
          stock: "available" as const,
        };
      })
      .filter((product) => product.name && product.price > 0);

    if (imported.length > 0) {
      const savedProducts = await persistProducts(imported);
      setProducts((current) => [...savedProducts, ...current]);
      setBulkText("");
    }
  }

  return (
    <main className="min-h-screen bg-[#fbfaf7] text-neutral-950">
      {!ageConfirmed ? <AgeGate onConfirm={confirmAge} /> : null}

      <header className="sticky top-0 z-30 border-b border-neutral-200/80 bg-[#fbfaf7]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <a href="#catalogo" className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-lg bg-neutral-950 text-white">
              <Wine size={22} />
            </span>
            <span>
              <span className="block text-lg font-black uppercase leading-none tracking-wide">Fonocopete</span>
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600">Botilleria delivery</span>
            </span>
          </a>
          <nav className="hidden items-center gap-5 text-sm font-semibold text-neutral-700 md:flex">
            <a href="#catalogo">Catalogo</a>
            <a href="#checkout">Pedido</a>
            <a href="#admin">Admin</a>
            <a href="#faq">FAQ</a>
          </nav>
          <a
            href="#checkout"
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-red-700"
          >
            <ShoppingCart size={18} />
            <span>{cartCount}</span>
          </a>
        </div>
      </header>

      <section className="border-b border-neutral-200 bg-neutral-950 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-14">
          <div className="flex flex-col justify-center">
            <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-amber-200">
              <ShieldCheck size={17} />
              Solo mayores de 18 anos
            </div>
            <h1 className="max-w-3xl text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
              Catalogo vivo para pedir alcohol por WhatsApp.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-neutral-300">
              Productos, promociones, delivery por zona y confirmacion directa para que Instagram mande al cliente al link,
              no a un PDF viejo.
            </p>
            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              <Metric icon={<Beer size={20} />} label="Catalogo" value={`${products.length} productos`} />
              <Metric icon={<Bike size={20} />} label="Despacho" value="Por zonas" />
              <Metric icon={<MessageCircle size={20} />} label="Compra" value="WhatsApp" />
            </div>
          </div>
          <div className="grid content-end gap-4">
            {featuredProducts.slice(0, 2).map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => addToCart(product.id)}
                className="group grid grid-cols-[112px_1fr] overflow-hidden rounded-lg border border-white/10 bg-white text-left text-neutral-950 shadow-2xl transition hover:-translate-y-0.5"
              >
                <img src={product.imageUrl} alt="" className="h-full min-h-32 w-full object-cover" />
                <span className="flex flex-col justify-between p-4">
                  <span>
                    <span className="text-xs font-black uppercase tracking-[0.16em] text-red-600">Promo activa</span>
                    <span className="mt-1 block text-xl font-black">{product.name}</span>
                    <span className="mt-1 block text-sm text-neutral-600">{product.volume}</span>
                  </span>
                  <span className="mt-4 flex items-center justify-between">
                    <span className="text-2xl font-black">{formatCurrency(product.price)}</span>
                    <span className="grid size-10 place-items-center rounded-lg bg-neutral-950 text-white transition group-hover:bg-red-600">
                      <Plus size={19} />
                    </span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section id="catalogo" className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_390px]">
        <div>
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-3xl font-black">Catalogo</h2>
              <p className="mt-1 text-neutral-600">Ordenado por secciones y listo para comprar.</p>
            </div>
            <label className="relative block w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-12 w-full rounded-lg border border-neutral-300 bg-white pl-10 pr-3 text-sm font-medium"
                placeholder="Buscar producto"
              />
            </label>
          </div>

          <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveCategory(category.id)}
                className={`h-11 shrink-0 rounded-lg px-4 text-sm font-black uppercase tracking-wide transition ${
                  activeCategory === category.id
                    ? "bg-neutral-950 text-white"
                    : "border border-neutral-300 bg-white text-neutral-700 hover:border-neutral-950"
                }`}
              >
                {category.label}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} onAdd={() => addToCart(product.id)} />
            ))}
          </div>
        </div>

        <aside id="checkout" className="lg:sticky lg:top-24 lg:self-start">
          <form onSubmit={submitOrder} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-xl font-black">
                <ShoppingCart size={20} />
                Pedido
              </h2>
              <span className="rounded-lg bg-amber-100 px-3 py-1 text-xs font-black text-amber-900">
                {cartCount} items
              </span>
            </div>

            <div className="max-h-64 space-y-3 overflow-auto pr-1">
              {cartLines.length === 0 ? (
                <div className="rounded-lg border border-dashed border-neutral-300 p-5 text-center text-sm font-medium text-neutral-500">
                  Tu carrito esta esperando la primera promo.
                </div>
              ) : (
                cartLines.map((item) => (
                  <div key={item.productId} className="grid grid-cols-[56px_1fr] gap-3 rounded-lg border border-neutral-200 p-2">
                    <img src={item.product.imageUrl} alt="" className="size-14 rounded-md object-cover" />
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-black leading-tight">{item.product.name}</p>
                        <button type="button" onClick={() => removeProduct(item.productId)} className="text-neutral-400 hover:text-red-600">
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <IconButton label="Restar" onClick={() => updateQuantity(item.productId, -1)}>
                            <Minus size={14} />
                          </IconButton>
                          <span className="grid h-8 min-w-8 place-items-center text-sm font-black">{item.quantity}</span>
                          <IconButton label="Sumar" onClick={() => updateQuantity(item.productId, 1)}>
                            <Plus size={14} />
                          </IconButton>
                        </div>
                        <span className="text-sm font-black">{formatCurrency(item.lineTotal)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 grid gap-3">
              <Input label="Nombre" value={customer.name} onChange={(value) => updateCustomer("name", value)} required />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Telefono" value={customer.phone} onChange={(value) => updateCustomer("phone", value)} required />
                <Input label="Email" type="email" value={customer.email} onChange={(value) => updateCustomer("email", value)} required />
              </div>
              <label className="grid gap-1 text-sm font-bold">
                Direccion
                <div className="flex gap-2">
                  <input
                    value={customer.address}
                    onChange={(event) => updateCustomer("address", event.target.value)}
                    className="h-11 min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 font-medium"
                    placeholder="Calle, numero, comuna"
                    required
                  />
                  <button
                    type="button"
                    onClick={detectZone}
                    title="Calcular zona"
                    className="grid size-11 shrink-0 place-items-center rounded-lg bg-neutral-950 text-white"
                  >
                    <MapPin size={18} />
                  </button>
                </div>
              </label>
              <label className="flex items-center gap-2 rounded-lg bg-neutral-100 px-3 py-2 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={customer.manualAddress}
                  onChange={(event) => updateCustomer("manualAddress", event.target.checked)}
                />
                Direccion manual
              </label>
              <label className="grid gap-1 text-sm font-bold">
                Zona de despacho
                <select
                  value={customer.zoneId}
                  onChange={(event) => updateCustomer("zoneId", event.target.value)}
                  className="h-11 rounded-lg border border-neutral-300 bg-white px-3 font-medium"
                >
                  {deliveryZones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name} - {formatCurrency(zone.price)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-bold">
                Notas
                <textarea
                  value={customer.notes}
                  onChange={(event) => updateCustomer("notes", event.target.value)}
                  className="min-h-20 rounded-lg border border-neutral-300 px-3 py-2 font-medium"
                  placeholder="Depto, referencia, cambio, etc."
                />
              </label>
            </div>

            <OrderTotals subtotal={subtotal} zone={activeZone} delivery={subtotal > 0 ? deliveryPrice : 0} total={total} />

            <a
              href={paymentLink}
              target="_blank"
              rel="noreferrer"
              className="mb-2 mt-4 flex h-12 items-center justify-center gap-2 rounded-lg border border-neutral-950 bg-white text-sm font-black text-neutral-950 transition hover:bg-neutral-100"
            >
              <CreditCard size={18} />
              Abrir pago MercadoPago
            </a>
            <button
              type="submit"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-green-600 text-sm font-black text-white transition hover:bg-green-700 disabled:opacity-50"
              disabled={orderStatus === "sending"}
            >
              <MessageCircle size={18} />
              {orderStatus === "sending" ? "Enviando..." : "Confirmar por WhatsApp"}
            </button>
            {orderStatus === "sent" ? (
              <p className="mt-3 rounded-lg bg-green-50 p-3 text-sm font-bold text-green-800">Pedido registrado y WhatsApp abierto.</p>
            ) : null}
            {orderStatus === "error" ? (
              <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">
                Revisa los datos. Si el correo falla, el WhatsApp igual queda preparado.
              </p>
            ) : null}
          </form>
        </aside>
      </section>

      <AdminPanel
        products={products}
        setProducts={setProducts}
        draft={draft}
        setDraft={setDraft}
        onSubmit={addDraftProduct}
        bulkText={bulkText}
        setBulkText={setBulkText}
        importBulkProducts={importBulkProducts}
        adminView={adminView}
        setAdminView={setAdminView}
        productSource={productSource}
        syncStatus={syncStatus}
        onSaveProduct={persistProduct}
      />

      <InfoSections />
    </main>
  );
}

function ProductCard({ product, onAdd }: { product: Product; onAdd: () => void }) {
  return (
    <article className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
      <div className="relative aspect-[4/3] bg-neutral-100">
        <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
        {product.stock === "low" ? (
          <span className="absolute left-3 top-3 rounded-lg bg-amber-300 px-2 py-1 text-xs font-black text-neutral-950">
            Ultimas unidades
          </span>
        ) : null}
      </div>
      <div className="p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-black leading-tight">{product.name}</h3>
            <p className="mt-1 text-sm font-semibold text-neutral-500">{product.volume}</p>
          </div>
          <span className="text-lg font-black text-red-600">{formatCurrency(product.price)}</span>
        </div>
        <p className="min-h-10 text-sm leading-5 text-neutral-600">{product.description}</p>
        <button
          type="button"
          onClick={onAdd}
          className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-neutral-950 text-sm font-black text-white transition hover:bg-red-600"
        >
          <Plus size={18} />
          Agregar
        </button>
      </div>
    </article>
  );
}

function AdminPanel(props: {
  products: Product[];
  setProducts: (products: Product[]) => void;
  draft: Product;
  setDraft: (draft: Product) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  bulkText: string;
  setBulkText: (value: string) => void;
  importBulkProducts: () => Promise<void>;
  adminView: "catalog" | "zones";
  setAdminView: (value: "catalog" | "zones") => void;
  productSource: "local" | "supabase";
  syncStatus: "idle" | "syncing" | "saved" | "error";
  onSaveProduct: (product: Product) => Promise<void>;
}) {
  const {
    products,
    setProducts,
    draft,
    setDraft,
    onSubmit,
    bulkText,
    setBulkText,
    importBulkProducts,
    adminView,
    setAdminView,
    productSource,
    syncStatus,
    onSaveProduct,
  } = props;

  function updateProduct(productId: string, field: keyof Product, value: string | number) {
    setProducts(
      products.map((product) =>
        product.id === productId
          ? {
              ...product,
              [field]: field === "price" ? Number(value) : value,
            }
          : product,
      ),
    );
  }

  return (
    <section id="admin" className="border-y border-neutral-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-3xl font-black">
              <Settings size={26} />
              Admin
            </h2>
            <p className="mt-1 text-neutral-600">
              Carga rapida desde PC o celular. Guardado: {productSource === "supabase" ? "Supabase" : "local demo"}
              {syncStatus === "syncing" ? " (sincronizando)" : ""}
              {syncStatus === "saved" ? " (guardado)" : ""}
              {syncStatus === "error" ? " (sin conexion real)" : ""}
            </p>
          </div>
          <div className="flex rounded-lg border border-neutral-300 bg-neutral-100 p-1">
            <SegmentButton active={adminView === "catalog"} onClick={() => setAdminView("catalog")}>
              Catalogo
            </SegmentButton>
            <SegmentButton active={adminView === "zones"} onClick={() => setAdminView("zones")}>
              Zonas
            </SegmentButton>
          </div>
        </div>

        {adminView === "catalog" ? (
          <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
            <div className="grid gap-4">
              <form onSubmit={onSubmit} className="rounded-lg border border-neutral-200 bg-[#fbfaf7] p-4">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-black">
                  <Plus size={18} />
                  Nuevo producto
                </h3>
                <div className="grid gap-3">
                  <Input label="Nombre" value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      label="Precio"
                      type="number"
                      value={String(draft.price || "")}
                      onChange={(value) => setDraft({ ...draft, price: Number(value) })}
                    />
                    <label className="grid gap-1 text-sm font-bold">
                      Categoria
                      <select
                        value={draft.category}
                        onChange={(event) => setDraft({ ...draft, category: event.target.value as CategoryId })}
                        className="h-11 rounded-lg border border-neutral-300 bg-white px-3"
                      >
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <Input label="Formato" value={draft.volume} onChange={(value) => setDraft({ ...draft, volume: value })} />
                  <Input label="Foto URL" value={draft.imageUrl} onChange={(value) => setDraft({ ...draft, imageUrl: value })} />
                  <label className="grid gap-1 text-sm font-bold">
                    Descripcion
                    <textarea
                      value={draft.description}
                      onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                      className="min-h-20 rounded-lg border border-neutral-300 px-3 py-2"
                    />
                  </label>
                  <button className="flex h-11 items-center justify-center gap-2 rounded-lg bg-neutral-950 text-sm font-black text-white">
                    <Check size={18} />
                    Guardar producto
                  </button>
                </div>
              </form>

              <div className="rounded-lg border border-neutral-200 bg-[#fbfaf7] p-4">
                <h3 className="mb-3 flex items-center gap-2 text-lg font-black">
                  <Upload size={18} />
                  Carga masiva
                </h3>
                <textarea
                  value={bulkText}
                  onChange={(event) => setBulkText(event.target.value)}
                  className="min-h-32 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  placeholder="Nombre;12990;promociones;750 cc;https://foto.jpg"
                />
                <button
                  type="button"
                  onClick={importBulkProducts}
                  className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-red-600 text-sm font-black text-white"
                >
                  <ClipboardList size={18} />
                  Importar lista
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-neutral-200">
              <div className="grid grid-cols-[1fr_120px_110px] bg-neutral-950 px-4 py-3 text-xs font-black uppercase tracking-wide text-white">
                <span>Producto</span>
                <span>Precio</span>
                <span>Estado</span>
              </div>
              <div className="max-h-[560px] divide-y divide-neutral-200 overflow-auto bg-white">
                {products.map((product) => (
                  <div key={product.id} className="grid grid-cols-[1fr_120px_110px] gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <input
                        value={product.name}
                        onChange={(event) => updateProduct(product.id, "name", event.target.value)}
                        onBlur={() => {
                          const nextProduct = products.find((entry) => entry.id === product.id);
                          if (nextProduct) void onSaveProduct(nextProduct);
                        }}
                        className="w-full rounded-md border border-transparent px-2 py-1 font-bold hover:border-neutral-300"
                      />
                      <p className="truncate px-2 text-xs font-semibold text-neutral-500">{product.category}</p>
                    </div>
                    <input
                      value={product.price}
                      onChange={(event) => updateProduct(product.id, "price", event.target.value)}
                      onBlur={() => {
                        const nextProduct = products.find((entry) => entry.id === product.id);
                        if (nextProduct) void onSaveProduct(nextProduct);
                      }}
                      className="h-10 rounded-md border border-neutral-300 px-2 text-sm font-bold"
                      type="number"
                    />
                    <select
                      value={product.stock}
                      onChange={(event) => {
                        const stock = event.target.value as Product["stock"];
                        updateProduct(product.id, "stock", stock);
                        void onSaveProduct({ ...product, stock });
                      }}
                      className="h-10 rounded-md border border-neutral-300 px-2 text-sm font-bold"
                    >
                      <option value="available">Activo</option>
                      <option value="low">Bajo</option>
                      <option value="hidden">Oculto</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {deliveryZones.map((zone) => (
              <ZoneCard key={zone.id} zone={zone} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function InfoSections() {
  return (
    <footer className="bg-[#fbfaf7]">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_1fr]">
        <section id="faq">
          <h2 className="mb-4 text-3xl font-black">Preguntas frecuentes</h2>
          <div className="grid gap-3">
            {faqs.map((faq) => (
              <details key={faq.question} className="rounded-lg border border-neutral-200 bg-white p-4">
                <summary className="cursor-pointer text-base font-black">{faq.question}</summary>
                <p className="mt-3 leading-7 text-neutral-600">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section id="terminos" className="rounded-lg border border-neutral-200 bg-neutral-950 p-6 text-white">
          <h2 className="mb-4 text-3xl font-black">Terminos</h2>
          <div className="grid gap-4 text-sm leading-7 text-neutral-300">
            <p>Venta exclusiva para mayores de 18 anos. La entrega puede requerir cedula de identidad.</p>
            <p>La disponibilidad, precios y tiempos de despacho pueden variar hasta la confirmacion final por WhatsApp.</p>
            <p>El link de MercadoPago funciona como pago externo. La botilleria verifica manualmente el monto antes de despachar.</p>
            <p>Las direcciones manuales quedan sujetas a cobertura y costo de despacho confirmado por el local.</p>
          </div>
          <div className="mt-6 flex items-center gap-2 rounded-lg bg-white/10 p-3 text-sm font-bold text-amber-100">
            <AlertTriangle size={18} />
            Beber alcohol en exceso es danino para la salud.
          </div>
        </section>
      </div>
    </footer>
  );
}

function AgeGate({ onConfirm }: { onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-neutral-950/90 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg bg-white p-6 text-center shadow-2xl">
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-lg bg-red-600 text-white">
          <ShieldCheck size={28} />
        </div>
        <h2 className="text-2xl font-black">Solo mayores de 18 anos</h2>
        <p className="mt-3 leading-7 text-neutral-600">
          Los tiempos de espera son referenciales y pueden cambiar segun demanda, distancia y disponibilidad.
        </p>
        <button
          type="button"
          onClick={onConfirm}
          className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-neutral-950 text-sm font-black text-white"
        >
          <BadgeCheck size={18} />
          Soy mayor de 18
        </button>
      </div>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/10 p-4">
      <div className="mb-3 text-amber-200">{icon}</div>
      <p className="text-xs font-black uppercase tracking-[0.16em] text-neutral-400">{label}</p>
      <p className="mt-1 text-lg font-black">{value}</p>
    </div>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-md border border-neutral-300 text-neutral-700 hover:border-neutral-950"
    >
      {children}
    </button>
  );
}

function Input(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1 text-sm font-bold">
      {props.label}
      <input
        type={props.type || "text"}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="h-11 rounded-lg border border-neutral-300 bg-white px-3 font-medium"
        required={props.required}
      />
    </label>
  );
}

function OrderTotals({
  subtotal,
  delivery,
  total,
  zone,
}: {
  subtotal: number;
  delivery: number;
  total: number;
  zone: DeliveryZone;
}) {
  return (
    <div className="mt-4 rounded-lg bg-neutral-100 p-4">
      <div className="flex items-center justify-between text-sm font-bold text-neutral-600">
        <span>Subtotal</span>
        <span>{formatCurrency(subtotal)}</span>
      </div>
      <div className="mt-2 flex items-center justify-between text-sm font-bold text-neutral-600">
        <span>Delivery</span>
        <span>{formatCurrency(delivery)}</span>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs font-black uppercase tracking-wide text-neutral-500">
        <span>{zone.name}</span>
        <span>{zone.eta}</span>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-neutral-300 pt-3 text-xl font-black">
        <span>Total</span>
        <span>{formatCurrency(total)}</span>
      </div>
    </div>
  );
}

function SegmentButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 rounded-md px-4 text-sm font-black transition ${
        active ? "bg-white text-neutral-950 shadow-sm" : "text-neutral-600"
      }`}
    >
      {children}
    </button>
  );
}

function ZoneCard({ zone }: { zone: DeliveryZone }) {
  return (
    <article className="rounded-lg border border-neutral-200 bg-[#fbfaf7] p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="grid size-11 place-items-center rounded-lg bg-green-600 text-white">
          <Bike size={21} />
        </span>
        <span className="text-2xl font-black">{formatCurrency(zone.price)}</span>
      </div>
      <h3 className="text-xl font-black">{zone.name}</h3>
      <p className="mt-2 leading-7 text-neutral-600">{zone.description}</p>
      <div className="mt-4 flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm font-black">
        <span>{zone.eta}</span>
        <ChevronRight size={18} />
      </div>
    </article>
  );
}
