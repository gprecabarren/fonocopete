"use client";

/* eslint-disable @next/next/no-img-element */

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Beer,
  Bike,
  Check,
  ClipboardList,
  CreditCard,
  Eye,
  EyeOff,
  LogIn,
  LogOut,
  MapPin,
  Mail,
  Menu,
  MessageCircle,
  Minus,
  Plus,
  Save,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  Upload,
  Wine,
  Wrench,
  X,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { FaFacebookF, FaInstagram, FaWhatsapp } from "react-icons/fa";
import { SiMercadopago } from "react-icons/si";
import { categories, deliveryZones as initialDeliveryZones, initialProducts } from "@/lib/catalog";
import { findZoneByAddress, findZoneByCoordinates } from "@/lib/delivery";
import { formatCurrency, normalizeText } from "@/lib/format";
import { buildWhatsAppUrl, normalizeChilePhone } from "@/lib/whatsapp";
import { defaultSettings } from "@/lib/settings";
import type {
  CartItem,
  CategoryId,
  CustomerDetails,
  DeliveryZone,
  FaqItem,
  OrderPayload,
  Product,
  SavedOrder,
  SiteSettings,
} from "@/lib/types";

const catalogStorageKey = "fonocopete.catalog";
const settingsStorageKey = "fonocopete.settings";
const ageStorageKey = "fonocopete.age-ok";

const emptyCustomer: CustomerDetails = {
  name: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  addressExtra: "",
  manualAddress: false,
  zoneId: initialDeliveryZones[0].id,
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

export function Storefront({ mode = "store" }: { mode?: "store" | "admin" }) {
  const [products, setProducts] = useState<Product[]>(() => readLocal(catalogStorageKey, initialProducts));
  const [settings, setSettings] = useState<SiteSettings>(() => readLocal(settingsStorageKey, defaultSettings));
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
  const [adminView, setAdminView] = useState<"orders" | "catalog" | "zones" | "faqs" | "settings">("orders");
  const [productSource, setProductSource] = useState<"local" | "supabase">("local");
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "saved" | "error">("idle");
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [addedProductId, setAddedProductId] = useState<string | null>(null);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>(initialDeliveryZones);
  const [zoneStatus, setZoneStatus] = useState("");
  const [addressResults, setAddressResults] = useState<Array<{
    formattedAddress: string;
    city: string;
    searchableAddress: string;
    location: { lat: number; lng: number };
  }>>([]);
  const [orders, setOrders] = useState<SavedOrder[]>([]);
  const [registeredOrder, setRegisteredOrder] = useState<{ id: string; orderNumber: string } | null>(null);

  useEffect(() => {
    if (productSource === "local") window.localStorage.setItem(catalogStorageKey, JSON.stringify(products));
  }, [products, productSource]);

  useEffect(() => {
    window.localStorage.setItem(settingsStorageKey, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    async function boot() {
      const [productResponse, settingsResponse, sessionResponse, zonesResponse] = await Promise.allSettled([
        fetch("/api/products"),
        fetch("/api/settings"),
        fetch("/api/admin/session"),
        fetch("/api/delivery-zones"),
      ]);

      if (productResponse.status === "fulfilled" && productResponse.value.ok) {
        const data = (await productResponse.value.json()) as { products: Product[]; source: "demo" | "supabase" };
        if (data.source === "supabase") {
          setProductSource("supabase");
          setProducts(data.products.length ? data.products : initialProducts);
        }
      }

      if (settingsResponse.status === "fulfilled" && settingsResponse.value.ok) {
        const data = (await settingsResponse.value.json()) as { settings: SiteSettings; source: "demo" | "supabase" };
        const hasLocalSettings = typeof window !== "undefined" && Boolean(window.localStorage.getItem(settingsStorageKey));
        if (data.source === "supabase" || !hasLocalSettings) {
          setSettings({ ...defaultSettings, ...data.settings });
        }
      }

      if (sessionResponse.status === "fulfilled" && sessionResponse.value.ok) {
        const data = (await sessionResponse.value.json()) as { authenticated: boolean };
        setAdminAuthenticated(data.authenticated);
        if (data.authenticated) void loadOrders();
      }

      if (zonesResponse.status === "fulfilled" && zonesResponse.value.ok) {
        const data = (await zonesResponse.value.json()) as { zones: DeliveryZone[]; source: "demo" | "supabase" };
        if (data.zones.length) {
          setDeliveryZones(data.zones);
          setCustomer((current) => ({ ...current, zoneId: data.zones[0].id }));
        }
      }
    }

    void boot();
  }, []);

  async function loadOrders() {
    const response = await fetch("/api/orders");
    if (!response.ok) return;
    const data = (await response.json()) as { orders: SavedOrder[] };
    setOrders(data.orders);
  }

  const activeZones = deliveryZones.filter((zone) => zone.active);
  const activeZone = activeZones.find((zone) => zone.id === customer.zoneId) ?? activeZones[0] ?? initialDeliveryZones[0];
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
  const featuredProducts = products.filter((product) => product.featured && product.stock !== "hidden").slice(0, 2);
  const cartLines = cart
    .map((item) => {
      const product = products.find((entry) => entry.id === item.productId && entry.stock !== "sold_out");
      return product ? { ...item, product, lineTotal: product.price * item.quantity } : null;
    })
    .filter(Boolean) as Array<CartItem & { product: Product; lineTotal: number }>;
  const subtotal = cartLines.reduce((sum, item) => sum + item.lineTotal, 0);
  const deliveryPrice = settings.deliveryEnabled && subtotal > 0 ? activeZone.price : 0;
  const total = subtotal + deliveryPrice;
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  function confirmAge() {
    window.localStorage.setItem(ageStorageKey, "true");
    setAgeConfirmed(true);
  }

  function addToCart(product: Product) {
    if (product.stock === "sold_out" || product.stock === "hidden" || settings.maintenanceMode) return;
    setCart((current) => {
      const existing = current.find((item) => item.productId === product.id);
      return existing
        ? current.map((item) => (item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item))
        : [...current, { productId: product.id, quantity: 1 }];
    });
    setAddedProductId(product.id);
    window.setTimeout(() => setAddedProductId((current) => (current === product.id ? null : current)), 900);
  }

  function updateQuantity(productId: string, delta: number) {
    setCart((current) =>
      current
        .map((item) => (item.productId === productId ? { ...item, quantity: item.quantity + delta } : item))
        .filter((item) => item.quantity > 0),
    );
  }

  function updateCustomer(field: keyof CustomerDetails, value: string | boolean) {
    setCustomer((current) => ({ ...current, [field]: value }));
    setCheckoutError("");
  }

  async function detectZone() {
    setZoneStatus("Buscando direccion...");
    try {
      const response = await fetch(`/api/geocode?address=${encodeURIComponent(customer.address)}`);
      if (response.ok) {
        const data = (await response.json()) as {
          results: Array<{
            formattedAddress: string;
            city: string;
            searchableAddress: string;
            location: { lat: number; lng: number };
          }>;
        };
        setAddressResults(data.results);
        setZoneStatus(data.results.length ? "Selecciona la direccion correcta." : "No encontramos coincidencias.");
        return;
      }
    } catch {
      setAddressResults([]);
    }
    setZoneStatus("No encontramos coincidencias. Prueba con direccion manual.");
  }

  function selectAddress(result: {
    formattedAddress: string;
    city: string;
    searchableAddress: string;
    location: { lat: number; lng: number };
  }) {
    const zone =
      findZoneByCoordinates(result.location, activeZones) ||
      findZoneByAddress(`${result.formattedAddress} ${result.searchableAddress}`, activeZones);
    setCustomer((current) => ({
      ...current,
      address: result.formattedAddress,
      city: result.city,
      zoneId: zone?.id || current.zoneId,
      manualAddress: false,
    }));
    setAddressResults([]);
    if (zone) {
      setZoneStatus(`Zona detectada: ${zone.name}`);
    } else {
      setZoneStatus("Direccion encontrada, pero la zona requiere confirmacion.");
    }
  }

  function validateCheckout() {
    if (settings.maintenanceMode) return "El sitio esta en mantenimiento.";
    if (!cartLines.length) return "Agrega al menos un producto disponible.";
    if (!customer.name.trim()) return "Ingresa tu nombre.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) return "Ingresa un correo valido.";
    if (customer.phone.replace(/\D/g, "").length < 3) return "Ingresa al menos 3 digitos en el telefono.";
    if (settings.deliveryEnabled && customer.address.trim().length < 3) return "Ingresa tu dirección.";
    if (settings.deliveryEnabled && customer.manualAddress && customer.city.trim().length < 2) return "Ingresa la ciudad.";
    return "";
  }

  function buildOrder(paymentMethod: OrderPayload["paymentMethod"]): OrderPayload {
    return {
      customer: settings.deliveryEnabled ? customer : { ...customer, address: "Por coordinar", manualAddress: true },
      items: cartLines.map((item) => ({
        name: item.product.name,
        quantity: item.quantity,
        unitPrice: item.product.price,
        lineTotal: item.lineTotal,
      })),
      subtotal,
      delivery: deliveryPrice,
      total,
      zoneName: settings.deliveryEnabled
        ? customer.manualAddress
          ? `${activeZone.name} (manual)`
          : activeZone.name
        : "Entrega por coordinar - sin cobro",
      paymentLink: settings.mercadoPagoLink,
      paymentMethod,
    };
  }

  function openPaymentOptions(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const error = validateCheckout();
    setCheckoutError(error);
    if (!error) setShowPayment(true);
  }

  async function completeOrder(
    paymentMethod: OrderPayload["paymentMethod"],
    purpose: "order" | "mercadopago" | "transfer",
    notifyWhatsApp: boolean,
  ) {
    const error = validateCheckout();
    if (error) {
      setCheckoutError(error);
      return;
    }

    setOrderStatus("sending");
    const whatsappWindow = notifyWhatsApp ? window.open("about:blank", "_blank") : null;
    const order = buildOrder(paymentMethod);
    try {
      let saved = registeredOrder;
      if (!saved) {
        const response = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(order),
        });
        if (!response.ok) throw new Error("No se pudo registrar el pedido");
        const data = (await response.json()) as { orderId: string; orderNumber: string };
        saved = { id: data.orderId, orderNumber: data.orderNumber };
        setRegisteredOrder(saved);
      }
      order.orderNumber = saved.orderNumber;
      if (notifyWhatsApp) {
        const whatsappUrl = buildWhatsAppUrl(order, settings.whatsappNumber, purpose);
        if (whatsappWindow) whatsappWindow.location.href = whatsappUrl;
        else window.open(whatsappUrl, "_blank", "noopener,noreferrer");
      }
      setOrderStatus("sent");
      void loadOrders();
    } catch {
      whatsappWindow?.close();
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
      return data.products.length ? data.products : nextProducts;
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

  async function deleteProduct(productId: string) {
    setProducts((current) => current.filter((product) => product.id !== productId));
    await fetch(`/api/products/${productId}`, { method: "DELETE" }).catch(() => setSyncStatus("error"));
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

    if (imported.length) {
      const savedProducts = await persistProducts(imported);
      setProducts((current) => [...savedProducts, ...current]);
      setBulkText("");
    }
  }

  async function saveSettings(nextSettings: SiteSettings) {
    setSettings(nextSettings);
    setSyncStatus("syncing");
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextSettings),
      });
      if (!response.ok) throw new Error("No se pudo guardar");
      setSyncStatus("saved");
    } catch {
      setSyncStatus("error");
    }
  }

  if (mode === "store" && settings.maintenanceMode) {
    return (
      <MaintenanceScreen
        message={settings.maintenanceMessage}
      />
    );
  }

  if (mode === "admin") {
    return (
      <main className="min-h-screen overflow-x-hidden bg-[#f7f4ef] text-neutral-950">
        <AdminHeader businessName={settings.businessName} />
        <AdminPanel
          authenticated={adminAuthenticated}
          setAuthenticated={setAdminAuthenticated}
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
          onDeleteProduct={deleteProduct}
          settings={settings}
          onSaveSettings={saveSettings}
          deliveryZones={deliveryZones}
          setDeliveryZones={setDeliveryZones}
          orders={orders}
          setOrders={setOrders}
          onReloadOrders={loadOrders}
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f7f4ef] text-neutral-950">
      {!ageConfirmed ? <AgeGate onConfirm={confirmAge} /> : null}
      {showPayment ? (
        <PaymentDialog
          settings={settings}
          total={total}
          registeredOrder={registeredOrder}
          onClose={() => setShowPayment(false)}
          onOpenMercadoPago={() => window.open(settings.mercadoPagoLink, "_blank", "noopener,noreferrer")}
          onRegister={(paymentMethod, purpose, notifyWhatsApp) =>
            void completeOrder(paymentMethod, purpose, notifyWhatsApp)
          }
        />
      ) : null}

      <Header settings={settings} cartCount={cartCount} />
      <FloatingWhatsApp whatsappNumber={settings.whatsappNumber} />

      <section id="promociones" className="scroll-mt-20 bg-neutral-950 text-white">
        <div className="mx-auto grid max-w-7xl gap-7 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_0.78fr] lg:py-12">
          <div className="flex min-w-0 flex-col justify-center">
            <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-amber-200">
              <ShieldCheck size={17} />
              Solo mayores de 18 anos
            </div>
            <h1 className="max-w-3xl text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
              {settings.businessName}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-neutral-300 sm:text-lg">
              Catalogo vivo, carrito simple y confirmacion por WhatsApp para comprar sin pedir PDF.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Metric icon={<Beer size={20} />} label="Catalogo" value={`${products.filter((p) => p.stock !== "hidden").length} productos`} />
              <Metric icon={<Bike size={20} />} label="Despacho" value="Por zonas" />
              <Metric icon={<MessageCircle size={20} />} label="Compra" value="WhatsApp" />
            </div>
          </div>
          <div className="grid min-w-0 gap-4">
            {featuredProducts.map((product) => (
              <FeaturedProduct key={product.id} product={product} added={addedProductId === product.id} onAdd={() => addToCart(product)} />
            ))}
          </div>
        </div>
      </section>

      <section id="catalogo" className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_390px]">
        <div className="min-w-0">
          <CatalogToolbar query={query} setQuery={setQuery} activeCategory={activeCategory} setActiveCategory={setActiveCategory} />
          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} added={addedProductId === product.id} onAdd={() => addToCart(product)} />
            ))}
          </div>
        </div>

        <CheckoutPanel
          cartLines={cartLines}
          cartCount={cartCount}
          customer={customer}
          activeZone={activeZone}
          subtotal={subtotal}
          deliveryPrice={deliveryPrice}
          total={total}
          orderStatus={orderStatus}
          checkoutError={checkoutError}
          onSubmit={openPaymentOptions}
          onRemove={(productId) => setCart((current) => current.filter((item) => item.productId !== productId))}
          onQuantity={updateQuantity}
          onCustomer={updateCustomer}
          onDetectZone={detectZone}
          deliveryEnabled={settings.deliveryEnabled}
          deliveryZones={activeZones}
          zoneStatus={zoneStatus}
          addressResults={addressResults}
          onSelectAddress={selectAddress}
        />
      </section>

      <InfoSections settings={settings} />
    </main>
  );
}

function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const stored = window.localStorage.getItem(key);
  if (!stored) return fallback;
  try {
    return JSON.parse(stored) as T;
  } catch {
    window.localStorage.removeItem(key);
    return fallback;
  }
}

function resizeImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const targetWidth = 900;
      const targetHeight = 675;
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("No se pudo procesar la imagen"));
        return;
      }

      const sourceRatio = image.width / image.height;
      const targetRatio = targetWidth / targetHeight;
      const sourceWidth = sourceRatio > targetRatio ? image.height * targetRatio : image.width;
      const sourceHeight = sourceRatio > targetRatio ? image.height : image.width / targetRatio;
      const sourceX = (image.width - sourceWidth) / 2;
      const sourceY = (image.height - sourceHeight) / 2;

      context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, targetWidth, targetHeight);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    image.onerror = () => reject(new Error("Imagen invalida"));
    image.src = URL.createObjectURL(file);
  });
}

function Header({ settings, cartCount }: { settings: SiteSettings; cartCount: number }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const links = [
    { href: "#catalogo", label: "Catalogo" },
    { href: "#promociones", label: "Promociones" },
    { href: "#checkout", label: "Mi pedido" },
    { href: "#faq", label: "Preguntas frecuentes" },
    { href: "#terminos", label: "Terminos" },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200/80 bg-[#f7f4ef]/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setMenuOpen((current) => !current)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Cerrar menu" : "Abrir menu"}
            className="action-button grid size-11 shrink-0 place-items-center rounded-lg border border-neutral-300 bg-white text-neutral-950"
          >
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
          <a href="#catalogo" className="flex min-w-0 items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-neutral-950 text-white">
            <Wine size={22} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-base font-black uppercase leading-tight tracking-wide sm:text-lg">{settings.businessName}</span>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600">Botilleria delivery</span>
          </span>
          </a>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link href="/admin" className="action-button hidden h-11 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-black sm:inline-flex">
            <LogIn size={17} />
            Administrador
          </Link>
          <a href="#checkout" className="action-button inline-flex h-11 items-center gap-2 rounded-lg bg-red-600 px-3 text-sm font-bold text-white sm:px-4">
            <ShoppingCart size={18} />
            <span>{cartCount}</span>
          </a>
        </div>
      </div>
      <div className="border-t border-neutral-200/70 bg-white/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
          <span className="text-xs font-black uppercase text-neutral-500">Encuentranos</span>
          <SocialLinks settings={settings} className="flex" />
        </div>
      </div>
      {menuOpen ? (
        <nav className="absolute left-4 top-[72px] w-[min(330px,calc(100vw-2rem))] overflow-hidden rounded-lg border border-neutral-200 bg-white p-2 shadow-2xl sm:left-6">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="flex h-11 items-center rounded-md px-3 text-sm font-black text-neutral-700 transition hover:bg-neutral-100 hover:text-red-600"
            >
              {link.label}
            </a>
          ))}
          <Link
            href="/admin"
            className="mt-2 flex h-11 items-center gap-2 rounded-md bg-neutral-950 px-3 text-sm font-black text-white sm:hidden"
          >
            <LogIn size={17} />
            Acceso administrador
          </Link>
        </nav>
      ) : null}
    </header>
  );
}

function SocialLinks({ settings, className = "" }: { settings: SiteSettings; className?: string }) {
  const whatsappUrl = `https://wa.me/${settings.whatsappNumber.replace(/\D/g, "")}`;
  return (
    <div className={`items-center gap-1 ${className}`}>
      <SocialIcon href={settings.instagramUrl} label="Instagram"><FaInstagram size={18} /></SocialIcon>
      <SocialIcon href={settings.facebookUrl} label="Facebook"><FaFacebookF size={17} /></SocialIcon>
      <SocialIcon href={`mailto:${settings.contactEmail}`} label="Correo"><Mail size={18} /></SocialIcon>
      <SocialIcon href={whatsappUrl} label="WhatsApp"><FaWhatsapp size={19} /></SocialIcon>
    </div>
  );
}

function SocialIcon({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noreferrer" : undefined}
      aria-label={label}
      title={label}
      className="action-button grid size-10 place-items-center rounded-lg border border-neutral-300 bg-white text-neutral-700 hover:border-red-500 hover:text-red-600"
    >
      {children}
    </a>
  );
}

function FloatingWhatsApp({ whatsappNumber }: { whatsappNumber: string }) {
  return (
    <a
      href={`https://wa.me/${whatsappNumber.replace(/\D/g, "")}`}
      target="_blank"
      rel="noreferrer"
      aria-label="Hablar por WhatsApp"
      title="Hablar por WhatsApp"
      className="action-button fixed bottom-5 left-3 z-40 grid size-12 place-items-center rounded-full border-2 border-white bg-green-600 text-white shadow-lg hover:bg-green-700 sm:left-5 sm:size-14"
    >
      <FaWhatsapp size={25} />
    </a>
  );
}

function AdminHeader({ businessName }: { businessName: string }) {
  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-neutral-950 text-white">
            <Settings size={21} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-black">{businessName}</p>
            <p className="text-xs font-black uppercase text-red-600">Panel administrativo</p>
          </div>
        </div>
        <Link href="/" className="action-button flex h-10 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-black">
          <ArrowLeft size={17} />
          <span className="hidden sm:inline">Volver a la tienda</span>
        </Link>
      </div>
    </header>
  );
}

function CatalogToolbar(props: {
  query: string;
  setQuery: (value: string) => void;
  activeCategory: CategoryId;
  setActiveCategory: (value: CategoryId) => void;
}) {
  return (
    <>
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-3xl font-black">Catalogo</h2>
          <p className="mt-1 text-neutral-600">Ordenado por secciones y listo para comprar.</p>
        </div>
        <label className="relative block w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
          <input
            value={props.query}
            onChange={(event) => props.setQuery(event.target.value)}
            className="h-12 w-full rounded-lg border border-neutral-300 bg-white pl-10 pr-3 text-sm font-medium"
            placeholder="Buscar producto"
          />
        </label>
      </div>
      <div className="mb-6 flex max-w-full gap-2 overflow-x-auto pb-2">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => props.setActiveCategory(category.id)}
            className={`h-11 shrink-0 rounded-lg px-4 text-sm font-black uppercase tracking-wide transition ${
              props.activeCategory === category.id ? "bg-neutral-950 text-white" : "border border-neutral-300 bg-white text-neutral-700"
            }`}
          >
            {category.label}
          </button>
        ))}
      </div>
    </>
  );
}

function FeaturedProduct({ product, onAdd, added }: { product: Product; onAdd: () => void; added: boolean }) {
  const soldOut = product.stock === "sold_out";
  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={soldOut}
      className={`action-button grid min-w-0 grid-cols-[96px_minmax(0,1fr)] overflow-hidden rounded-lg border bg-white text-left text-neutral-950 shadow-2xl disabled:opacity-75 sm:grid-cols-[112px_minmax(0,1fr)] ${
        added ? "border-green-500 ring-4 ring-green-400/30" : "border-white/10"
      }`}
    >
      <img src={product.imageUrl} alt="" className="h-full min-h-28 w-full object-cover" />
      <span className="min-w-0 p-4">
        <span className="text-xs font-black uppercase tracking-[0.16em] text-red-600">{soldOut ? "Agotado" : "Promo activa"}</span>
        <span className="mt-1 block truncate text-lg font-black sm:text-xl">{product.name}</span>
        <span className="mt-1 block text-sm text-neutral-600">{product.volume}</span>
        <span className="mt-3 flex items-center justify-between gap-2">
          <span className="text-xl font-black sm:text-2xl">{formatCurrency(product.price)}</span>
          <span className={`grid size-10 shrink-0 place-items-center rounded-lg text-white transition ${added ? "bg-green-600" : "bg-neutral-950"}`}>
            {added ? <Check size={19} /> : <Plus size={19} />}
          </span>
        </span>
      </span>
    </button>
  );
}

function ProductCard({ product, onAdd, added }: { product: Product; onAdd: () => void; added: boolean }) {
  const soldOut = product.stock === "sold_out";
  return (
    <article className="min-w-0 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
      <div className="relative aspect-[4/3] bg-neutral-100">
        <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
        {soldOut ? (
          <span className="absolute left-3 top-3 rounded-md bg-red-600 px-2 py-1 text-xs font-black text-white">AGOTADO</span>
        ) : product.stock === "low" ? (
          <span className="absolute left-3 top-3 rounded-md bg-amber-300 px-2 py-1 text-xs font-black text-neutral-950">Ultimas unidades</span>
        ) : null}
      </div>
      <div className="p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-black leading-tight">{product.name}</h3>
            <p className="mt-1 text-sm font-semibold text-neutral-500">{product.volume}</p>
          </div>
          <span className="shrink-0 text-lg font-black text-red-600">{formatCurrency(product.price)}</span>
        </div>
        <p className="min-h-10 text-sm leading-5 text-neutral-600">{product.description}</p>
        <button
          type="button"
          onClick={onAdd}
          disabled={soldOut}
          className={`action-button mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-600 ${
            added ? "bg-green-600" : "bg-neutral-950 hover:bg-red-600"
          }`}
        >
          {added ? <Check size={18} /> : <Plus size={18} />}
          {soldOut ? "Agotado" : added ? "Agregado" : "Agregar"}
        </button>
      </div>
    </article>
  );
}

function CheckoutPanel(props: {
  cartLines: Array<CartItem & { product: Product; lineTotal: number }>;
  cartCount: number;
  customer: CustomerDetails;
  activeZone: { id: string; name: string; price: number; eta: string };
  subtotal: number;
  deliveryPrice: number;
  total: number;
  orderStatus: "idle" | "sending" | "sent" | "error";
  checkoutError: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onRemove: (productId: string) => void;
  onQuantity: (productId: string, delta: number) => void;
  onCustomer: (field: keyof CustomerDetails, value: string | boolean) => void;
  onDetectZone: () => void;
  deliveryEnabled: boolean;
  deliveryZones: DeliveryZone[];
  zoneStatus: string;
  addressResults: Array<{
    formattedAddress: string;
    city: string;
    searchableAddress: string;
    location: { lat: number; lng: number };
  }>;
  onSelectAddress: (result: {
    formattedAddress: string;
    city: string;
    searchableAddress: string;
    location: { lat: number; lng: number };
  }) => void;
}) {
  return (
    <aside id="checkout" className="min-w-0 lg:sticky lg:top-24 lg:self-start">
      <form onSubmit={props.onSubmit} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-black">
            <ShoppingCart size={20} />
            Pedido
          </h2>
          <span className="rounded-lg bg-amber-100 px-3 py-1 text-xs font-black text-amber-900">{props.cartCount} items</span>
        </div>
        <div className="max-h-64 space-y-3 overflow-auto pr-1">
          {props.cartLines.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-300 p-5 text-center text-sm font-medium text-neutral-500">
              Tu carrito esta esperando la primera promo.
            </div>
          ) : (
            props.cartLines.map((item) => (
              <div key={item.productId} className="grid grid-cols-[56px_minmax(0,1fr)] gap-3 rounded-lg border border-neutral-200 p-2">
                <img src={item.product.imageUrl} alt="" className="size-14 rounded-md object-cover" />
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-black leading-tight">{item.product.name}</p>
                    <button type="button" onClick={() => props.onRemove(item.productId)} className="text-neutral-400 hover:text-red-600">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <IconButton label="Restar" onClick={() => props.onQuantity(item.productId, -1)}>
                        <Minus size={14} />
                      </IconButton>
                      <span className="grid h-8 min-w-8 place-items-center text-sm font-black">{item.quantity}</span>
                      <IconButton label="Sumar" onClick={() => props.onQuantity(item.productId, 1)}>
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
          <Input label="Nombre" value={props.customer.name} onChange={(value) => props.onCustomer("name", value)} required />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Telefono" type="tel" inputMode="numeric" value={props.customer.phone} onChange={(value) => props.onCustomer("phone", value)} required />
            <Input label="Email" type="email" value={props.customer.email} onChange={(value) => props.onCustomer("email", value)} required />
          </div>
          {props.deliveryEnabled ? (
            <>
              <label className="flex items-center gap-2 rounded-lg bg-neutral-100 px-3 py-2 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={props.customer.manualAddress}
                  onChange={(event) => props.onCustomer("manualAddress", event.target.checked)}
                />
                Ingresar dirección manualmente
              </label>
              <label className="grid gap-1 text-sm font-bold">
                Dirección
                <div className="flex gap-2">
                  <input
                    value={props.customer.address}
                    onChange={(event) => props.onCustomer("address", event.target.value)}
                    className="h-11 min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 font-medium"
                    placeholder={props.customer.manualAddress ? "Calle y número" : "Busca tu calle y número"}
                    required
                  />
                  {!props.customer.manualAddress ? (
                    <button type="button" onClick={props.onDetectZone} title="Buscar dirección" className="action-button grid size-11 shrink-0 place-items-center rounded-lg bg-neutral-950 text-white">
                      <Search size={18} />
                    </button>
                  ) : null}
                </div>
              </label>
              {!props.customer.manualAddress && props.addressResults.length ? (
                <div className="grid gap-2 rounded-lg border border-neutral-200 bg-white p-2 shadow-lg">
                  {props.addressResults.map((result) => (
                    <button
                      key={`${result.formattedAddress}-${result.location.lat}`}
                      type="button"
                      onClick={() => props.onSelectAddress(result)}
                      className="rounded-md px-3 py-3 text-left text-sm font-semibold hover:bg-neutral-100"
                    >
                      {result.formattedAddress}
                    </button>
                  ))}
                </div>
              ) : null}
              {props.zoneStatus ? <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-bold text-blue-800">{props.zoneStatus}</p> : null}
              {props.customer.manualAddress ? (
                <>
                  <Input label="Ciudad" value={props.customer.city} onChange={(value) => props.onCustomer("city", value)} required />
                  <Input label="Departamento, casa, referencia (opcional)" value={props.customer.addressExtra} onChange={(value) => props.onCustomer("addressExtra", value)} />
                  <label className="grid gap-1 text-sm font-bold">
                    Zona de despacho
                    <select value={props.customer.zoneId} onChange={(event) => props.onCustomer("zoneId", event.target.value)} className="h-11 rounded-lg border border-neutral-300 bg-white px-3 font-medium">
                      {props.deliveryZones.map((zone) => (
                        <option key={zone.id} value={zone.id}>
                          {zone.name} - {formatCurrency(zone.price)}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : null}
              {!props.customer.manualAddress ? (
                <p className="text-xs font-semibold text-neutral-500">
                  Búsqueda por <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">OpenStreetMap</a>.
                </p>
              ) : null}
            </>
          ) : (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="font-black text-green-900">Despacho sin calculo automatico</p>
              <p className="mt-1 text-sm text-green-800">La entrega y direccion se coordinaran directamente por WhatsApp. Costo de despacho: $0.</p>
            </div>
          )}
          <label className="grid gap-1 text-sm font-bold">
            Notas
            <textarea value={props.customer.notes} onChange={(event) => props.onCustomer("notes", event.target.value)} className="min-h-20 rounded-lg border border-neutral-300 px-3 py-2 font-medium" />
          </label>
        </div>
        <OrderTotals
          subtotal={props.subtotal}
          delivery={props.deliveryPrice}
          total={props.total}
          zone={props.activeZone}
          deliveryEnabled={props.deliveryEnabled}
        />
        {props.checkoutError ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{props.checkoutError}</p> : null}
        <button type="submit" className="action-button mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-red-600 text-sm font-black text-white hover:bg-red-700">
          <CreditCard size={18} />
          Completar Pago
        </button>
        {props.orderStatus === "sent" ? <p className="mt-3 rounded-lg bg-green-50 p-3 text-sm font-bold text-green-800">Pedido registrado.</p> : null}
        {props.orderStatus === "error" ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">Hubo un problema registrando el pedido.</p> : null}
      </form>
    </aside>
  );
}

function PaymentDialog(props: {
  settings: SiteSettings;
  total: number;
  registeredOrder: { id: string; orderNumber: string } | null;
  onClose: () => void;
  onOpenMercadoPago: () => void;
  onRegister: (
    paymentMethod: OrderPayload["paymentMethod"],
    purpose: "order" | "mercadopago" | "transfer",
    notifyWhatsApp: boolean,
  ) => void;
}) {
  const [advanceMethod, setAdvanceMethod] = useState<"mercadopago" | "transfer">("mercadopago");
  /*
    "Hola, realicé una transferencia y deseo enviar mi comprobante de pago.",
  )}`;
  */

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-neutral-950/80 px-4 py-6 backdrop-blur">
      <div className="w-full max-w-3xl rounded-lg bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black">Completar pago</h2>
            <p className="text-sm font-semibold text-neutral-500">Total: {formatCurrency(props.total)}</p>
            {props.registeredOrder ? <p className="mt-1 text-sm font-black text-green-700">Pedido registrado: {props.registeredOrder.orderNumber}</p> : null}
          </div>
          <button type="button" onClick={props.onClose} className="grid size-10 place-items-center rounded-lg bg-neutral-100">
            <X size={18} />
          </button>
        </div>
        <div className="grid gap-4">
          <section className="rounded-lg border border-neutral-200 p-4">
            <h3 className="text-lg font-black">Pago contra entrega</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              Paga cuando recibas tu pedido. La confirmación manual puede aumentar ligeramente el tiempo de entrega.
            </p>
            <button type="button" onClick={() => props.onRegister("cash_on_delivery", "order", true)} className="action-button mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-green-600 text-sm font-black text-white">
              <FaWhatsapp size={19} />
              Registrar y confirmar por WhatsApp
            </button>
          </section>
          <section className="rounded-lg border border-neutral-200 p-4">
            <h3 className="text-lg font-black">Pago anticipado</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-600">Paga antes del despacho mediante Mercado Pago o transferencia bancaria.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <SegmentButton active={advanceMethod === "mercadopago"} onClick={() => setAdvanceMethod("mercadopago")}>Mercado Pago</SegmentButton>
              <SegmentButton active={advanceMethod === "transfer"} onClick={() => setAdvanceMethod("transfer")}>Transferencia</SegmentButton>
            </div>
            {advanceMethod === "mercadopago" ? (
              <div className="mt-4 rounded-lg bg-sky-50 p-4">
                <button type="button" onClick={props.onOpenMercadoPago} className="action-button flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-sky-600 text-sm font-black text-white">
                  <SiMercadopago size={25} />
                  Pagar con Mercado Pago
                </button>
                <button type="button" onClick={() => props.onRegister("mercadopago", "mercadopago", true)} className="action-button mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-sky-300 bg-white text-sm font-black text-sky-800">
                  <FaWhatsapp size={19} />
                  Avisar pago por WhatsApp
                </button>
              </div>
            ) : (
              <div className="mt-4 min-w-0 rounded-lg bg-neutral-50 p-4">
                <BankDetails settings={props.settings} />
                <button type="button" onClick={() => props.onRegister("transfer", "transfer", true)} className="action-button mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-center text-sm font-black text-white">
                  <FaWhatsapp size={19} />
                  Enviar comprobante por WhatsApp
                </button>
              </div>
            )}
            <button type="button" onClick={() => props.onRegister(advanceMethod, advanceMethod, false)} className="action-button mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-neutral-950 px-3 py-2 text-center text-sm font-black text-white">
              <Check size={18} />
              Confirmar pago y registrar pedido
            </button>
            <p className="mt-2 text-center text-xs font-semibold text-neutral-500">Usa este botón cuando el pago ya fue realizado.</p>
          </section>
        </div>
      </div>
    </div>
  );
}

function BankDetails({ settings }: { settings: SiteSettings }) {
  const bank = settings.bankDetails;
  return (
    <dl className="grid gap-2 text-sm">
      <Detail label="Banco" value={bank.bank} />
      <Detail label="Titular" value={bank.accountHolder} />
      <Detail label={bank.accountType} value={bank.accountNumber} />
      <Detail label="RUT" value={bank.rut} />
      <Detail label="Correo" value={bank.email} />
    </dl>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 gap-1 rounded-md bg-white px-3 py-2 sm:grid-cols-[120px_minmax(0,1fr)]">
      <dt className="font-bold text-neutral-600">{label}</dt>
      <dd className="min-w-0 break-words text-left font-black sm:text-right">{value}</dd>
    </div>
  );
}

function AdminPanel(props: {
  authenticated: boolean;
  setAuthenticated: (value: boolean) => void;
  products: Product[];
  setProducts: (products: Product[]) => void;
  draft: Product;
  setDraft: (draft: Product) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  bulkText: string;
  setBulkText: (value: string) => void;
  importBulkProducts: () => Promise<void>;
  adminView: "orders" | "catalog" | "zones" | "faqs" | "settings";
  setAdminView: (value: "orders" | "catalog" | "zones" | "faqs" | "settings") => void;
  productSource: "local" | "supabase";
  syncStatus: "idle" | "syncing" | "saved" | "error";
  onSaveProduct: (product: Product) => Promise<void>;
  onDeleteProduct: (productId: string) => Promise<void>;
  settings: SiteSettings;
  onSaveSettings: (settings: SiteSettings) => Promise<void>;
  deliveryZones: DeliveryZone[];
  setDeliveryZones: (zones: DeliveryZone[]) => void;
  orders: SavedOrder[];
  setOrders: (orders: SavedOrder[]) => void;
  onReloadOrders: () => Promise<void>;
}) {
  const [login, setLogin] = useState({ username: "bodegon", password: "" });
  const [loginError, setLoginError] = useState("");

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(login),
    });
    if (response.ok) {
      props.setAuthenticated(true);
      void props.onReloadOrders();
      setLogin({ username: "bodegon", password: "" });
      setLoginError("");
    } else {
      setLoginError("Usuario o contraseña incorrectos.");
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    props.setAuthenticated(false);
  }

  if (!props.authenticated) {
    return (
      <section id="admin" className="border-y border-neutral-200 bg-white px-4 py-10 sm:px-6">
        <form onSubmit={submitLogin} className="mx-auto max-w-sm rounded-lg border border-neutral-200 bg-[#f7f4ef] p-5">
          <h2 className="mb-4 flex items-center gap-2 text-2xl font-black">
            <LogIn size={22} />
            Administracion
          </h2>
          <Input label="Usuario" value={login.username} onChange={(value) => setLogin({ ...login, username: value })} />
          <div className="mt-3">
            <Input label="Contraseña" type="password" value={login.password} onChange={(value) => setLogin({ ...login, password: value })} />
          </div>
          {loginError ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{loginError}</p> : null}
          <button className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-neutral-950 text-sm font-black text-white">
            <ShieldCheck size={18} />
            Entrar
          </button>
        </form>
      </section>
    );
  }

  function updateProduct(productId: string, updater: (product: Product) => Product) {
    props.setProducts(props.products.map((product) => (product.id === productId ? updater(product) : product)));
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
              Guardado: {props.productSource === "supabase" ? "Supabase" : "local demo"}
              {props.syncStatus === "syncing" ? " (sincronizando)" : ""}
              {props.syncStatus === "saved" ? " (guardado)" : ""}
              {props.syncStatus === "error" ? " (revisar conexion)" : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <SegmentButton active={props.adminView === "orders"} onClick={() => props.setAdminView("orders")}>Pedidos</SegmentButton>
            <SegmentButton active={props.adminView === "catalog"} onClick={() => props.setAdminView("catalog")}>Catalogo</SegmentButton>
            <SegmentButton active={props.adminView === "zones"} onClick={() => props.setAdminView("zones")}>Zonas</SegmentButton>
            <SegmentButton active={props.adminView === "faqs"} onClick={() => props.setAdminView("faqs")}>FAQ</SegmentButton>
            <SegmentButton active={props.adminView === "settings"} onClick={() => props.setAdminView("settings")}>Ajustes</SegmentButton>
            <button type="button" onClick={() => void logout()} className="flex h-10 items-center gap-2 rounded-lg border border-neutral-300 px-3 text-sm font-black">
              <LogOut size={16} />
              Salir
            </button>
          </div>
        </div>
        {props.adminView === "orders" ? (
          <OrdersAdmin orders={props.orders} setOrders={props.setOrders} />
        ) : props.adminView === "catalog" ? (
          <CatalogAdmin {...props} updateProduct={updateProduct} />
        ) : props.adminView === "zones" ? (
          <ZonesAdmin zones={props.deliveryZones} setZones={props.setDeliveryZones} />
        ) : props.adminView === "faqs" ? (
          <FaqAdmin settings={props.settings} onSaveSettings={props.onSaveSettings} />
        ) : (
          <SettingsAdmin
            key={`${props.settings.businessName}-${props.settings.maintenanceMode}-${props.settings.deliveryEnabled}`}
            settings={props.settings}
            onSaveSettings={props.onSaveSettings}
            syncStatus={props.syncStatus}
          />
        )}
      </div>
    </section>
  );
}

function OrdersAdmin({ orders, setOrders }: { orders: SavedOrder[]; setOrders: (orders: SavedOrder[]) => void }) {
  async function updateOrder(order: SavedOrder, field: "paymentStatus" | "fulfillmentStatus", value: string) {
    const response = await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (response.ok) {
      setOrders(orders.map((item) => item.id === order.id ? { ...item, [field]: value } : item));
    }
  }

  if (!orders.length) {
    return <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center font-bold text-neutral-500">Aún no hay pedidos registrados.</div>;
  }

  return (
    <div className="grid gap-4">
      {orders.map((order) => (
        <article key={order.id} className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-black uppercase text-red-600">{order.orderNumber}</p>
              <h3 className="text-xl font-black">{order.customerName}</h3>
              <p className="mt-1 text-sm text-neutral-600">{new Date(order.createdAt).toLocaleString("es-CL")}</p>
            </div>
            <a
              href={`https://wa.me/${normalizeChilePhone(order.customerPhone)}?text=${encodeURIComponent(`Hola ${order.customerName}, te contactamos por tu pedido ${order.orderNumber}.`)}`}
              target="_blank"
              rel="noreferrer"
              className="action-button flex h-11 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 text-sm font-black text-white"
            >
              <FaWhatsapp size={19} /> Hablar por WhatsApp
            </a>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="min-w-0">
              <p className="break-words text-sm font-semibold">{order.address}{order.city ? `, ${order.city}` : ""}</p>
              {order.addressExtra ? <p className="text-sm text-neutral-600">{order.addressExtra}</p> : null}
              <p className="mt-2 text-sm">{order.customerPhone} · {order.customerEmail}</p>
              <div className="mt-3 grid gap-1 rounded-lg bg-neutral-50 p-3 text-sm">
                {order.items.map((item) => <p key={`${order.id}-${item.name}`}>{item.quantity}x {item.name} · {formatCurrency(item.lineTotal)}</p>)}
              </div>
              <p className="mt-3 text-lg font-black">Total: {formatCurrency(order.total)}</p>
            </div>
            <div className="grid content-start gap-3">
              <label className="grid gap-1 text-sm font-bold">
                Estado del pedido
                <select value={order.fulfillmentStatus} onChange={(event) => void updateOrder(order, "fulfillmentStatus", event.target.value)} className="h-10 rounded-lg border border-neutral-300 px-2">
                  <option value="new">Nuevo</option>
                  <option value="confirmed">Confirmado</option>
                  <option value="preparing">Preparando</option>
                  <option value="delivering">En reparto</option>
                  <option value="completed">Completado</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm font-bold">
                Estado del pago
                <select value={order.paymentStatus} onChange={(event) => void updateOrder(order, "paymentStatus", event.target.value)} className="h-10 rounded-lg border border-neutral-300 px-2">
                  <option value="pending">Pendiente</option>
                  <option value="paid">Pagado</option>
                  <option value="refunded">Reembolsado</option>
                </select>
              </label>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function FaqAdmin({ settings, onSaveSettings }: { settings: SiteSettings; onSaveSettings: (settings: SiteSettings) => Promise<void> }) {
  const [items, setItems] = useState<FaqItem[]>(settings.faqs);

  return (
    <div className="grid gap-4">
      {items.map((faq) => (
        <div key={faq.id} className="grid gap-3 rounded-lg border border-neutral-200 bg-white p-4">
          <Input label="Pregunta" value={faq.question} onChange={(question) => setItems(items.map((item) => item.id === faq.id ? { ...item, question } : item))} />
          <Textarea label="Respuesta" value={faq.answer} onChange={(answer) => setItems(items.map((item) => item.id === faq.id ? { ...item, answer } : item))} />
          <button type="button" onClick={() => setItems(items.filter((item) => item.id !== faq.id))} className="action-button h-10 rounded-lg bg-red-50 text-sm font-black text-red-700">Eliminar</button>
        </div>
      ))}
      <button type="button" onClick={() => setItems([...items, { id: crypto.randomUUID(), question: "Nueva pregunta", answer: "Nueva respuesta" }])} className="action-button h-11 rounded-lg border border-neutral-300 bg-white text-sm font-black">Agregar pregunta</button>
      <button type="button" onClick={() => void onSaveSettings({ ...settings, faqs: items })} className="action-button h-11 rounded-lg bg-neutral-950 text-sm font-black text-white">Guardar preguntas frecuentes</button>
    </div>
  );
}

function CatalogAdmin(props: Parameters<typeof AdminPanel>[0] & { updateProduct: (productId: string, updater: (product: Product) => Product) => void }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="grid gap-4">
        <form onSubmit={props.onSubmit} className="rounded-lg border border-neutral-200 bg-[#f7f4ef] p-4">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-black">
            <Plus size={18} />
            Nuevo producto
          </h3>
          <div className="grid gap-3">
            <Input label="Nombre" value={props.draft.name} onChange={(value) => props.setDraft({ ...props.draft, name: value })} />
            <Input label="Precio" type="number" value={String(props.draft.price || "")} onChange={(value) => props.setDraft({ ...props.draft, price: Number(value) })} />
            <SelectCategory value={props.draft.category} onChange={(category) => props.setDraft({ ...props.draft, category })} />
            <Input label="Formato" value={props.draft.volume} onChange={(value) => props.setDraft({ ...props.draft, volume: value })} />
            <ImagePicker label="Cargar imagen desde PC" onImage={(imageUrl) => props.setDraft({ ...props.draft, imageUrl })} />
            <Input label="Foto URL" value={props.draft.imageUrl} onChange={(value) => props.setDraft({ ...props.draft, imageUrl: value })} />
            <Textarea label="Descripcion" value={props.draft.description} onChange={(value) => props.setDraft({ ...props.draft, description: value })} />
            <button className="flex h-11 items-center justify-center gap-2 rounded-lg bg-neutral-950 text-sm font-black text-white">
              <Check size={18} />
              Guardar producto
            </button>
          </div>
        </form>
        <div className="rounded-lg border border-neutral-200 bg-[#f7f4ef] p-4">
          <h3 className="mb-3 flex items-center gap-2 text-lg font-black">
            <Upload size={18} />
            Carga masiva
          </h3>
          <textarea value={props.bulkText} onChange={(event) => props.setBulkText(event.target.value)} className="min-h-32 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" placeholder="Nombre;12990;promociones;750 cc;https://foto.jpg" />
          <button type="button" onClick={() => void props.importBulkProducts()} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-red-600 text-sm font-black text-white">
            <ClipboardList size={18} />
            Importar lista
          </button>
        </div>
      </div>
      <div className="grid gap-3">
        {props.products.map((product) => (
          <div key={product.id} className="rounded-lg border border-neutral-200 bg-white p-3">
            <div className="grid gap-3 md:grid-cols-[88px_minmax(0,1fr)_150px]">
              <img src={product.imageUrl} alt="" className="h-24 w-full rounded-lg object-cover md:h-full" />
              <div className="grid min-w-0 gap-2">
                <input value={product.name} onChange={(event) => props.updateProduct(product.id, (item) => ({ ...item, name: event.target.value }))} onBlur={() => void props.onSaveProduct(product)} className="rounded-md border border-neutral-300 px-3 py-2 font-black" />
                <textarea value={product.description} onChange={(event) => props.updateProduct(product.id, (item) => ({ ...item, description: event.target.value }))} onBlur={() => void props.onSaveProduct(product)} className="min-h-16 rounded-md border border-neutral-300 px-3 py-2 text-sm" />
                <ImagePicker
                  label="Cambiar imagen desde PC"
                  onImage={(imageUrl) => {
                    const nextProduct = { ...product, imageUrl };
                    props.updateProduct(product.id, () => nextProduct);
                    void props.onSaveProduct(nextProduct);
                  }}
                />
                <input value={product.imageUrl} onChange={(event) => props.updateProduct(product.id, (item) => ({ ...item, imageUrl: event.target.value }))} onBlur={() => void props.onSaveProduct(product)} className="rounded-md border border-neutral-300 px-3 py-2 text-xs" />
              </div>
              <div className="grid gap-2">
                <input value={product.price} type="number" onChange={(event) => props.updateProduct(product.id, (item) => ({ ...item, price: Number(event.target.value) }))} onBlur={() => void props.onSaveProduct(product)} className="h-10 rounded-md border border-neutral-300 px-2 text-sm font-bold" />
                <SelectCategory value={product.category} onChange={(category) => props.updateProduct(product.id, (item) => ({ ...item, category }))} onBlur={() => void props.onSaveProduct(product)} />
                <select value={product.stock} onChange={(event) => {
                  const stock = event.target.value as Product["stock"];
                  const nextProduct = { ...product, stock };
                  props.updateProduct(product.id, () => nextProduct);
                  void props.onSaveProduct(nextProduct);
                }} className="h-10 rounded-md border border-neutral-300 px-2 text-sm font-bold">
                  <option value="available">Activo</option>
                  <option value="low">Bajo stock</option>
                  <option value="sold_out">Agotado</option>
                  <option value="hidden">Oculto</option>
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => {
                    const stock = product.stock === "hidden" ? "available" : "hidden";
                    const nextProduct = { ...product, stock: stock as Product["stock"] };
                    props.updateProduct(product.id, () => nextProduct);
                    void props.onSaveProduct(nextProduct);
                  }} className="grid h-10 place-items-center rounded-md border border-neutral-300" title={product.stock === "hidden" ? "Mostrar" : "Ocultar"}>
                    {product.stock === "hidden" ? <Eye size={17} /> : <EyeOff size={17} />}
                  </button>
                  <button type="button" onClick={() => void props.onDeleteProduct(product.id)} className="grid h-10 place-items-center rounded-md bg-red-50 text-red-700" title="Eliminar">
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ZonesAdmin({ zones, setZones }: { zones: DeliveryZone[]; setZones: (zones: DeliveryZone[]) => void }) {
  const emptyZone: DeliveryZone = {
    id: "",
    name: "",
    price: 0,
    eta: "30-60 min",
    description: "",
    polygon: [],
    matchTerms: [],
    active: true,
  };
  const [draft, setDraft] = useState(emptyZone);
  const [status, setStatus] = useState("");

  async function saveZone(zone: DeliveryZone) {
    setStatus("Guardando zona...");
    const response = await fetch("/api/delivery-zones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(zone),
    });
    if (!response.ok) {
      setStatus("No se pudo guardar la zona.");
      return;
    }
    const data = (await response.json()) as { zone: DeliveryZone };
    setZones([data.zone, ...zones.filter((item) => item.id !== data.zone.id)]);
    setDraft(emptyZone);
    setStatus("Zona guardada.");
  }

  async function deleteZone(id: string) {
    const response = await fetch(`/api/delivery-zones/${id}`, { method: "DELETE" });
    if (response.ok) {
      setZones(zones.filter((zone) => zone.id !== id));
      setStatus("Zona eliminada.");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.name.trim() || !draft.matchTerms.length) return;
          void saveZone({ ...draft, id: draft.id || crypto.randomUUID() });
        }}
        className="h-fit rounded-lg border border-neutral-200 bg-[#f7f4ef] p-4"
      >
        <h3 className="mb-4 flex items-center gap-2 text-lg font-black"><MapPin size={18} /> Nueva zona</h3>
        <div className="grid gap-3">
          <Input label="Nombre" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} />
          <Input label="Precio despacho" type="number" value={String(draft.price || "")} onChange={(value) => setDraft({ ...draft, price: Number(value) })} />
          <Input label="Tiempo estimado" value={draft.eta} onChange={(eta) => setDraft({ ...draft, eta })} />
          <Input
            label="Comunas o palabras para detectar"
            value={draft.matchTerms.join(", ")}
            onChange={(value) => setDraft({ ...draft, matchTerms: value.split(",").map((term) => term.trim()).filter(Boolean) })}
          />
          <Textarea label="Descripcion" value={draft.description} onChange={(description) => setDraft({ ...draft, description })} />
          <button className="action-button flex h-11 items-center justify-center gap-2 rounded-lg bg-neutral-950 text-sm font-black text-white">
            <Save size={18} /> Guardar zona
          </button>
          {status ? <p className="text-sm font-bold text-neutral-600">{status}</p> : null}
        </div>
      </form>
      <div className="grid gap-3">
        {zones.map((zone) => (
          <div key={zone.id} className="grid gap-3 rounded-lg border border-neutral-200 bg-white p-4 md:grid-cols-[minmax(0,1fr)_140px]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-black">{zone.name}</h3>
                <span className={`rounded-md px-2 py-1 text-xs font-black ${zone.active ? "bg-green-100 text-green-800" : "bg-neutral-200 text-neutral-600"}`}>
                  {zone.active ? "Activa" : "Oculta"}
                </span>
              </div>
              <p className="mt-1 text-sm text-neutral-600">{zone.description}</p>
              <p className="mt-2 text-sm font-bold">{zone.matchTerms.join(", ")}</p>
              <p className="mt-2 font-black text-red-600">{formatCurrency(zone.price)} · {zone.eta}</p>
            </div>
            <div className="grid content-start gap-2">
              <button
                type="button"
                onClick={() => void saveZone({ ...zone, active: !zone.active })}
                className="action-button h-10 rounded-lg border border-neutral-300 text-sm font-black"
              >
                {zone.active ? "Ocultar" : "Activar"}
              </button>
              <button
                type="button"
                onClick={() => setDraft(zone)}
                className="action-button h-10 rounded-lg bg-neutral-950 text-sm font-black text-white"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => void deleteZone(zone.id)}
                className="action-button h-10 rounded-lg bg-red-50 text-sm font-black text-red-700"
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsAdmin({
  settings,
  onSaveSettings,
  syncStatus,
}: {
  settings: SiteSettings;
  onSaveSettings: (settings: SiteSettings) => Promise<void>;
  syncStatus: "idle" | "syncing" | "saved" | "error";
}) {
  const [draft, setDraft] = useState(settings);

  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      void onSaveSettings(draft);
    }} className="grid gap-4 rounded-lg border border-neutral-200 bg-[#f7f4ef] p-4 lg:grid-cols-2">
      <Input label="Nombre del negocio" value={draft.businessName} onChange={(value) => setDraft({ ...draft, businessName: value })} />
      <Input label="WhatsApp" value={draft.whatsappNumber} onChange={(value) => setDraft({ ...draft, whatsappNumber: value })} />
      <Input label="Correo de contacto" type="email" value={draft.contactEmail} onChange={(value) => setDraft({ ...draft, contactEmail: value })} />
      <Input label="Instagram" value={draft.instagramUrl} onChange={(value) => setDraft({ ...draft, instagramUrl: value })} />
      <Input label="Facebook" value={draft.facebookUrl} onChange={(value) => setDraft({ ...draft, facebookUrl: value })} />
      <Input label="Link Mercado Pago" value={draft.mercadoPagoLink} onChange={(value) => setDraft({ ...draft, mercadoPagoLink: value })} />
      <label className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-black ${draft.maintenanceMode ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"}`}>
        <input type="checkbox" checked={draft.maintenanceMode} onChange={(event) => setDraft({ ...draft, maintenanceMode: event.target.checked })} />
        {draft.maintenanceMode ? "Modo mantenimiento activado" : "Sitio activo"}
      </label>
      <label className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-black ${draft.deliveryEnabled ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-900"}`}>
        <input type="checkbox" checked={draft.deliveryEnabled} onChange={(event) => setDraft({ ...draft, deliveryEnabled: event.target.checked })} />
        {draft.deliveryEnabled ? "Calculo de despacho activado" : "Despacho sin direccion ni cobro"}
      </label>
      <p className="rounded-lg bg-white px-3 py-3 text-sm font-semibold text-neutral-600 lg:col-span-2">
        Si activas mantenimiento, los clientes veran una pantalla cerrada y solo quedara disponible el login del administrador.
      </p>
      <p className="rounded-lg bg-white px-3 py-3 text-sm font-semibold text-neutral-600 lg:col-span-2">
        Si desactivas el calculo de despacho, se mantienen contacto, notas, pago y pedido. Solo se ocultan direccion, zona y costo de envio.
      </p>
      <div className="lg:col-span-2">
        <Textarea label="Mensaje mantenimiento" value={draft.maintenanceMessage} onChange={(value) => setDraft({ ...draft, maintenanceMessage: value })} />
      </div>
      <Input label="Banco" value={draft.bankDetails.bank} onChange={(value) => setDraft({ ...draft, bankDetails: { ...draft.bankDetails, bank: value } })} />
      <Input label="Titular" value={draft.bankDetails.accountHolder} onChange={(value) => setDraft({ ...draft, bankDetails: { ...draft.bankDetails, accountHolder: value } })} />
      <Input label="Tipo de cuenta" value={draft.bankDetails.accountType} onChange={(value) => setDraft({ ...draft, bankDetails: { ...draft.bankDetails, accountType: value } })} />
      <Input label="Numero de cuenta" value={draft.bankDetails.accountNumber} onChange={(value) => setDraft({ ...draft, bankDetails: { ...draft.bankDetails, accountNumber: value } })} />
      <Input label="RUT" value={draft.bankDetails.rut} onChange={(value) => setDraft({ ...draft, bankDetails: { ...draft.bankDetails, rut: value } })} />
      <Input label="Correo pagos" type="email" value={draft.bankDetails.email} onChange={(value) => setDraft({ ...draft, bankDetails: { ...draft.bankDetails, email: value } })} />
      <button
        disabled={syncStatus === "syncing"}
        className={`action-button flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-black text-white disabled:cursor-wait lg:col-span-2 ${
          syncStatus === "saved" ? "bg-green-600" : syncStatus === "error" ? "bg-red-700" : "bg-neutral-950"
        }`}
      >
        {syncStatus === "saved" ? <Check size={18} /> : <Save size={18} />}
        {syncStatus === "syncing" ? "Guardando..." : syncStatus === "saved" ? "Ajustes guardados" : syncStatus === "error" ? "Reintentar guardado" : "Guardar ajustes"}
      </button>
    </form>
  );
}

function MaintenanceScreen({ message }: { message: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-neutral-950 px-4 py-8 text-white">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-lg bg-white text-neutral-950 shadow-2xl lg:grid-cols-[1fr_420px]">
        <div className="relative min-h-72 bg-neutral-900">
          <img
            src="https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80"
            alt=""
            className="h-full w-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/80 to-transparent" />
          <div className="absolute bottom-5 left-5 right-5 text-white">
            <div className="mb-4 grid size-14 place-items-center rounded-lg bg-amber-300 text-neutral-950">
              <Wrench size={28} />
            </div>
            <h1 className="text-4xl font-black">Fonocopete MAVERIK</h1>
            <p className="mt-3 max-w-xl text-lg leading-8 text-neutral-200">{message}</p>
          </div>
        </div>
        <div className="p-5">
          <h2 className="mb-2 text-2xl font-black">Acceso administrador</h2>
          <p className="mb-5 text-sm font-semibold text-neutral-600">El sitio esta cerrado para clientes. Inicia sesion para volver a activar la tienda.</p>
          <Link href="/admin" className="action-button flex h-11 items-center justify-center gap-2 rounded-lg bg-neutral-950 text-sm font-black text-white">
            <LogIn size={18} />
            Iniciar sesion
          </Link>
        </div>
      </div>
    </main>
  );
}

export function AdminLoginMini({ onLogin }: { onLogin: () => void }) {
  const [login, setLogin] = useState({ username: "bodegon", password: "" });
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(login),
    });
    if (response.ok) onLogin();
    else setError("Credenciales incorrectas.");
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <p className="font-black">Acceso administrador</p>
      <Input label="Usuario" value={login.username} onChange={(value) => setLogin({ ...login, username: value })} />
      <Input label="Contraseña" type="password" value={login.password} onChange={(value) => setLogin({ ...login, password: value })} />
      {error ? <p className="text-sm font-bold text-red-700">{error}</p> : null}
      <button className="h-11 rounded-lg bg-neutral-950 text-sm font-black text-white">Entrar</button>
    </form>
  );
}

function InfoSections({ settings }: { settings: SiteSettings }) {
  return (
    <footer className="bg-[#f7f4ef]">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-2">
        <section id="faq">
          <h2 className="mb-4 text-3xl font-black">Preguntas frecuentes</h2>
          <div className="grid gap-3">
            {settings.faqs.map((faq) => (
              <details key={faq.id} className="rounded-lg border border-neutral-200 bg-white p-4">
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
            <p>El link de MercadoPago funciona como pago externo hasta configurar credenciales reales.</p>
            <p>Las direcciones manuales quedan sujetas a cobertura y costo de despacho confirmado por el local.</p>
          </div>
          <div className="mt-6 flex items-center gap-2 rounded-lg bg-white/10 p-3 text-sm font-bold text-amber-100">
            <AlertTriangle size={18} />
            Beber alcohol en exceso es danino para la salud.
          </div>
        </section>
      </div>
      <div className="border-t border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-6 sm:px-6">
          <SocialLinks settings={settings} className="flex" />
          <a href="https://www.minsal.cl/" target="_blank" rel="noreferrer" className="w-fit opacity-45 transition hover:opacity-75">
            <img src="/minsal-logo.png" alt="Ministerio de Salud de Chile" className="h-12 w-12 object-contain" />
          </a>
        </div>
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
        <p className="mt-3 leading-7 text-neutral-600">Los tiempos de espera son referenciales y pueden cambiar segun demanda, distancia y disponibilidad.</p>
        <button type="button" onClick={onConfirm} className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-neutral-950 text-sm font-black text-white">
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
    <button type="button" aria-label={label} title={label} onClick={onClick} className="grid size-8 place-items-center rounded-md border border-neutral-300 text-neutral-700 hover:border-neutral-950">
      {children}
    </button>
  );
}

function Input(props: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"] }) {
  return (
    <label className="grid gap-1 text-sm font-bold">
      {props.label}
      <input type={props.type || "text"} inputMode={props.inputMode} value={props.value} onChange={(event) => props.onChange(event.target.value)} className="h-11 min-w-0 rounded-lg border border-neutral-300 bg-white px-3 font-medium" required={props.required} />
    </label>
  );
}

function Textarea(props: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1 text-sm font-bold">
      {props.label}
      <textarea value={props.value} onChange={(event) => props.onChange(event.target.value)} className="min-h-20 rounded-lg border border-neutral-300 px-3 py-2" />
    </label>
  );
}

function ImagePicker({ label, onImage }: { label: string; onImage: (imageUrl: string) => void }) {
  const [status, setStatus] = useState("");

  async function handleFile(file?: File) {
    if (!file) return;
    setStatus("Procesando imagen...");
    try {
      const imageUrl = await resizeImage(file);
      onImage(imageUrl);
      setStatus("Imagen cargada y ajustada a 4:3");
    } catch {
      setStatus("No se pudo cargar la imagen");
    }
  }

  return (
    <label className="grid gap-1 text-sm font-bold">
      {label}
      <span className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-400 bg-white px-3 text-sm font-black text-neutral-700">
        <Upload size={17} />
        Seleccionar archivo
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />
      </span>
      {status ? <span className="text-xs font-semibold text-neutral-500">{status}</span> : null}
    </label>
  );
}

function SelectCategory(props: { value: CategoryId; onChange: (value: CategoryId) => void; onBlur?: () => void }) {
  return (
    <label className="grid gap-1 text-sm font-bold">
      Categoria
      <select value={props.value} onChange={(event) => props.onChange(event.target.value as CategoryId)} onBlur={props.onBlur} className="h-10 rounded-md border border-neutral-300 bg-white px-2 text-sm font-bold">
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function OrderTotals({
  subtotal,
  delivery,
  total,
  zone,
  deliveryEnabled,
}: {
  subtotal: number;
  delivery: number;
  total: number;
  zone: { name: string; eta: string };
  deliveryEnabled: boolean;
}) {
  return (
    <div className="mt-4 rounded-lg bg-neutral-100 p-4">
      <div className="flex items-center justify-between text-sm font-bold text-neutral-600">
        <span>Subtotal</span>
        <span>{formatCurrency(subtotal)}</span>
      </div>
      <div className="mt-2 flex items-center justify-between text-sm font-bold text-neutral-600">
        <span>Delivery</span>
        <span>{deliveryEnabled ? formatCurrency(delivery) : "Sin cobro"}</span>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs font-black uppercase tracking-wide text-neutral-500">
        <span>{deliveryEnabled ? zone.name : "Por coordinar"}</span>
        <span>{deliveryEnabled ? zone.eta : "WhatsApp"}</span>
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
    <button type="button" onClick={onClick} className={`h-10 rounded-lg px-4 text-sm font-black transition ${active ? "bg-neutral-950 text-white" : "border border-neutral-300 bg-white text-neutral-700"}`}>
      {children}
    </button>
  );
}
