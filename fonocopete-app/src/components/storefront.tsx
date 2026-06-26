"use client";

/* eslint-disable @next/next/no-img-element */

import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
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
  Minus,
  Plus,
  Save,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  Upload,
  Wrench,
  X,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { FaFacebookF, FaInstagram, FaWhatsapp } from "react-icons/fa";
import { SiGooglemaps, SiMercadopago, SiUbereats, SiWaze } from "react-icons/si";
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
  ProductCategory,
  SavedOrder,
  SiteSettings,
} from "@/lib/types";

const catalogStorageKey = "fonocopete.catalog";
const settingsStorageKey = "fonocopete.settings";
const ageStorageKey = "fonocopete.age-ok";
type AdminView = "orders" | "catalog" | "categories" | "zones" | "faqs" | "settings" | "seo";

const latinAmericanPhones = [
  { code: "56", country: "Chile", flag: "🇨🇱", placeholder: "9 1234 5678" },
  { code: "54", country: "Argentina", flag: "🇦🇷", placeholder: "9 11 1234 5678" },
  { code: "51", country: "Perú", flag: "🇵🇪", placeholder: "912 345 678" },
  { code: "57", country: "Colombia", flag: "🇨🇴", placeholder: "300 123 4567" },
  { code: "52", country: "México", flag: "🇲🇽", placeholder: "55 1234 5678" },
  { code: "58", country: "Venezuela", flag: "🇻🇪", placeholder: "412 123 4567" },
  { code: "593", country: "Ecuador", flag: "🇪🇨", placeholder: "99 123 4567" },
  { code: "591", country: "Bolivia", flag: "🇧🇴", placeholder: "7123 4567" },
  { code: "595", country: "Paraguay", flag: "🇵🇾", placeholder: "981 123 456" },
  { code: "598", country: "Uruguay", flag: "🇺🇾", placeholder: "94 123 456" },
  { code: "55", country: "Brasil", flag: "🇧🇷", placeholder: "11 91234 5678" },
  { code: "506", country: "Costa Rica", flag: "🇨🇷", placeholder: "8312 3456" },
  { code: "507", country: "Panamá", flag: "🇵🇦", placeholder: "6123 4567" },
  { code: "502", country: "Guatemala", flag: "🇬🇹", placeholder: "5123 4567" },
  { code: "503", country: "El Salvador", flag: "🇸🇻", placeholder: "7123 4567" },
  { code: "504", country: "Honduras", flag: "🇭🇳", placeholder: "9123 4567" },
  { code: "505", country: "Nicaragua", flag: "🇳🇮", placeholder: "8123 4567" },
  { code: "1809", country: "Rep. Dominicana", flag: "🇩🇴", placeholder: "234 5678" },
] as const;

const emptyCustomer: CustomerDetails = {
  name: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  addressExtra: "",
  manualAddress: false,
  zoneId: "",
  notes: "",
};

const productDraft: Product = {
  id: "",
  name: "",
  category: "promociones",
  price: 0,
  originalPrice: null,
  beerFormat: null,
  imageUrl: "",
  volume: "",
  description: "",
  stock: "available",
};

export function Storefront({ mode = "store" }: { mode?: "store" | "admin" }) {
  const [products, setProducts] = useState<Product[]>(() => readLocal(catalogStorageKey, initialProducts));
  const [productCategories, setProductCategories] = useState<ProductCategory[]>(categories);
  const [settings, setSettings] = useState<SiteSettings>(() => mergeSettings(readLocal(settingsStorageKey, defaultSettings)));
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<CategoryId>("promociones");
  const [activeBeerFormat, setActiveBeerFormat] = useState<"all" | "latas" | "botellas">("all");
  const [query, setQuery] = useState("");
  const [customer, setCustomer] = useState<CustomerDetails>(emptyCustomer);
  const [orderStatus, setOrderStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [ageConfirmed, setAgeConfirmed] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem(ageStorageKey) === "true",
  );
  const [draft, setDraft] = useState<Product>(productDraft);
  const [bulkText, setBulkText] = useState("");
  const [adminView, setAdminView] = useState<AdminView>("orders");
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
  const [registeredOrder, setRegisteredOrder] = useState<{
    id: string;
    orderNumber: string;
    paymentMethod?: OrderPayload["paymentMethod"];
  } | null>(null);

  useEffect(() => {
    if (productSource === "local") window.localStorage.setItem(catalogStorageKey, JSON.stringify(products));
  }, [products, productSource]);

  useEffect(() => {
    window.localStorage.setItem(settingsStorageKey, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    async function boot() {
      const [productResponse, settingsResponse, sessionResponse, zonesResponse, categoriesResponse] = await Promise.allSettled([
        fetch("/api/products"),
        fetch("/api/settings"),
        fetch("/api/admin/session"),
        fetch("/api/delivery-zones"),
        fetch("/api/categories"),
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
          setSettings(mergeSettings(data.settings));
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
          setCustomer((current) => ({ ...current, zoneId: current.zoneId }));
        }
      }

      if (categoriesResponse.status === "fulfilled" && categoriesResponse.value.ok) {
        const data = (await categoriesResponse.value.json()) as { categories: ProductCategory[] };
        if (data.categories.length) {
          setProductCategories(data.categories);
          setActiveCategory((current) =>
            data.categories.some((category) => category.id === current) ? current : data.categories[0].id,
          );
          setDraft((current) => ({
            ...current,
            category: data.categories.some((category) => category.id === current.category)
              ? current.category
              : data.categories[0].id,
          }));
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
  const resolvedActiveCategory = productCategories.some((category) => category.id === activeCategory)
    ? activeCategory
    : productCategories[0]?.id || "promociones";
  const selectedZone = activeZones.find((zone) => zone.id === customer.zoneId);
  const activeZone = selectedZone ?? { ...initialDeliveryZones[0], id: "", name: "Selecciona zona", price: 0, eta: "" };
  const filteredProducts = useMemo(() => {
    const cleanQuery = normalizeText(query);
    return products.filter((product) => {
      const matchesCategory = cleanQuery ? true : product.category === resolvedActiveCategory;
      const matchesBeerFormat =
        cleanQuery ||
        resolvedActiveCategory !== "cervezas" ||
        activeBeerFormat === "all" ||
        product.beerFormat === activeBeerFormat;
      const matchesQuery =
        !cleanQuery ||
        normalizeText(`${product.name} ${product.description} ${product.volume} ${product.category} ${product.beerFormat ?? ""}`).includes(cleanQuery);
      return product.stock !== "hidden" && matchesCategory && matchesBeerFormat && matchesQuery;
    });
  }, [products, resolvedActiveCategory, activeBeerFormat, query]);
  const featuredProducts = products.filter((product) => product.featured && product.stock !== "hidden").slice(0, 2);
  const cartLines = cart
    .map((item) => {
      const product = products.find((entry) => entry.id === item.productId && entry.stock !== "sold_out");
      return product ? { ...item, product, lineTotal: product.price * item.quantity } : null;
    })
    .filter(Boolean) as Array<CartItem & { product: Product; lineTotal: number }>;
  const subtotal = cartLines.reduce((sum, item) => sum + item.lineTotal, 0);
  const deliveryPrice = settings.deliveryEnabled && subtotal > 0 && selectedZone ? selectedZone.price : 0;
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
    setZoneStatus("Buscando dirección...");
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
        setZoneStatus(data.results.length ? "Selecciona la dirección correcta." : "No encontramos coincidencias.");
        return;
      }
    } catch {
      setAddressResults([]);
    }
    setZoneStatus("No encontramos coincidencias. Prueba con dirección manual.");
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
      setZoneStatus("Dirección encontrada, pero la zona requiere confirmación.");
    }
  }

  function validateCheckout() {
    if (settings.maintenanceMode) return "El sitio está en mantenimiento.";
    if (!cartLines.length) return "Agrega al menos un producto disponible.";
    if (!customer.name.trim()) return "Ingresa tu nombre.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) return "Ingresa un correo válido.";
    if (customer.phone.replace(/\D/g, "").length < 3) return "Ingresa al menos 3 dígitos en el teléfono.";
    if (!hasStreetAndNumber(customer.address)) return "Ingresa calle y número en la dirección.";
    if (!customer.zoneId) return "Selecciona una zona de despacho / ciudad.";
    return "";
  }

  function buildOrder(paymentMethod: OrderPayload["paymentMethod"]): OrderPayload {
    return {
      customer: settings.deliveryEnabled && settings.addressSearchEnabled ? customer : { ...customer, manualAddress: true },
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
        : `${activeZone.name} - sin cobro`,
      paymentLink: settings.mercadoPagoLink,
      paymentMethod,
      bankDetails: settings.bankDetails,
      whatsappMessageIntro: settings.whatsappMessageIntro,
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
  ): Promise<boolean> {
    const error = validateCheckout();
    if (error) {
      setCheckoutError(error);
      return false;
    }

    setOrderStatus("sending");
    const whatsappWindow = notifyWhatsApp ? window.open("about:blank", "_blank") : null;
    const order = buildOrder(paymentMethod);
    try {
      let saved = registeredOrder;
      if (saved?.paymentMethod && saved.paymentMethod !== paymentMethod) {
        setOrderStatus("sent");
        whatsappWindow?.close();
        return false;
      }
      if (!saved) {
        const response = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(order),
        });
        if (!response.ok) throw new Error("No se pudo registrar el pedido");
        const data = (await response.json()) as { orderId: string; orderNumber: string };
        saved = { id: data.orderId, orderNumber: data.orderNumber, paymentMethod };
        setRegisteredOrder(saved);
      } else if (!saved.paymentMethod) {
        saved = { ...saved, paymentMethod };
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
      return true;
    } catch {
      whatsappWindow?.close();
      setOrderStatus("error");
      return false;
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
      category: productCategories.some((category) => category.id === draft.category)
        ? draft.category
        : productCategories[0]?.id || "promociones",
      id: draft.id || crypto.randomUUID(),
      imageUrl:
        draft.imageUrl ||
        "https://images.unsplash.com/photo-1535958636474-b021ee887b13?auto=format&fit=crop&w=900&q=80",
      description: draft.description || "Producto cargado desde administración.",
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
          category: (category as CategoryId) || productCategories[0]?.id || "promociones",
          volume: volume || "Formato por definir",
          imageUrl:
            imageUrl ||
            "https://images.unsplash.com/photo-1535958636474-b021ee887b13?auto=format&fit=crop&w=900&q=80",
          description: "Carga rápida desde lista.",
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
    setSettings(mergeSettings(nextSettings));
    setSyncStatus("syncing");
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextSettings),
      });
      if (!response.ok) throw new Error("No se pudo guardar");
      setSyncStatus("saved");
      window.setTimeout(() => setSyncStatus("idle"), 1800);
    } catch {
      setSyncStatus("error");
      window.setTimeout(() => setSyncStatus("idle"), 3500);
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
          categories={productCategories}
          setCategories={setProductCategories}
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
            completeOrder(paymentMethod, purpose, notifyWhatsApp)
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
              Solo mayores de 18 años
            </div>
            <h1 className="text-4xl font-black uppercase leading-tight sm:text-6xl">Fonocopete</h1>
            <p className="mt-2 text-xl font-black uppercase text-red-500 sm:text-3xl">Concepción</p>
            <p className="mt-4 max-w-2xl text-base leading-7 text-neutral-300 sm:text-lg">
              Catálogo vivo, carrito simple y confirmación por WhatsApp para comprar sin pedir PDF.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Metric icon={<Beer size={20} />} label="Catálogo" value={`${products.filter((p) => p.stock !== "hidden" && p.category === "promociones").length} promos`} />
              <Metric
                icon={<Bike size={20} />}
                label="Zonas habilitadas"
                value={activeZones.length ? activeZones.map((zone) => zone.name).join(" · ") : "Sin zonas activas"}
              />
              <Metric
                icon={<CreditCard size={20} />}
                label="Medios de pago"
                value="Transferencia y Mercado Pago"
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-black">
              <span className="text-neutral-400">También coordinamos envíos por</span>
              <span className="inline-flex h-8 items-center gap-2 rounded-md bg-white px-3 text-neutral-950">
                <SiUbereats size={18} className="text-[#06C167]" /> Uber Eats
              </span>
              <span className="inline-flex h-8 items-center rounded-md bg-[#ef3e46] px-2">
                <img src="/pedidosya-logo.png" alt="PedidosYa" className="h-6 w-[104px] object-contain" />
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-black">
              <span className="text-neutral-400">Aceptamos pago por</span>
              <span className="inline-flex h-8 items-center gap-2 rounded-md bg-sky-100 px-3 text-sky-950">
                <SiMercadopago size={20} className="text-sky-600" /> Mercado Pago
              </span>
            </div>
          </div>
          <div className="grid min-w-0 gap-4">
            {featuredProducts.map((product) => (
              <FeaturedProduct key={product.id} product={product} added={addedProductId === product.id} onAdd={() => addToCart(product)} />
            ))}
          </div>
        </div>
      </section>

      <section id="catalogo" className="mx-auto grid max-w-7xl scroll-mt-24 gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_390px]">
        <div className="min-w-0">
          <CatalogToolbar
            query={query}
            setQuery={setQuery}
            activeCategory={resolvedActiveCategory}
            setActiveCategory={setActiveCategory}
            activeBeerFormat={activeBeerFormat}
            setActiveBeerFormat={setActiveBeerFormat}
            categories={productCategories}
          />
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
          addressSearchEnabled={settings.addressSearchEnabled}
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

function mergeSettings(settings: Partial<SiteSettings>): SiteSettings {
  const whatsappDigits = settings.whatsappNumber?.replace(/\D/g, "");
  return {
    ...defaultSettings,
    ...settings,
    whatsappNumber: whatsappDigits === "56939351855" || whatsappDigits === "56912345678"
      ? "56989351855"
      : settings.whatsappNumber || defaultSettings.whatsappNumber,
    bankDetails: { ...defaultSettings.bankDetails, ...settings.bankDetails },
    seo: { ...defaultSettings.seo, ...settings.seo },
  };
}

function hasStreetAndNumber(address: string) {
  return /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(address) && /\d/.test(address);
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
    { href: "#catalogo", label: "Catálogo" },
    { href: "#promociones", label: "Promociones" },
    { href: "#checkout", label: "Mi pedido" },
    { href: "#faq", label: "Preguntas frecuentes" },
    { href: "#terminos", label: "Términos" },
  ];

  return (
    <>
    <header className="fixed inset-x-0 top-0 z-50 border-b border-neutral-200/80 bg-[#f7f4ef]/95 backdrop-blur supports-[backdrop-filter]:bg-[#f7f4ef]/85">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setMenuOpen((current) => !current)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
            className="action-button grid size-11 shrink-0 place-items-center rounded-lg border border-neutral-300 bg-white text-neutral-950"
          >
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
          <a href="#catalogo" className="flex min-w-0 items-center gap-3">
          <img src="/fonocopete-logo-circle.jpg" alt="" className="size-11 shrink-0 rounded-full border border-neutral-200 object-cover" />
          <span className="min-w-0">
            <span className="block truncate text-base font-black uppercase leading-tight tracking-wide sm:text-lg">Fonocopete</span>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600">Botillería delivery</span>
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
    <div className="mt-[68px] border-t border-neutral-200/70 bg-white/80">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <span className="text-xs font-black uppercase text-neutral-500">Encuéntranos</span>
        <SocialLinks settings={settings} className="flex" />
      </div>
    </div>
    </>
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
    <div className="fixed left-3 top-1/2 z-40 -translate-y-1/2 sm:left-5">
      <a
        href={`https://wa.me/${whatsappNumber.replace(/\D/g, "")}`}
        target="_blank"
        rel="noreferrer"
        aria-label="Hablar por WhatsApp"
        title="Hablar por WhatsApp"
        className="action-button grid size-12 place-items-center rounded-full border-2 border-white bg-green-600 text-white shadow-lg hover:bg-green-700 sm:size-14"
      >
        <FaWhatsapp size={25} />
      </a>
    </div>
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
  activeBeerFormat: "all" | "latas" | "botellas";
  setActiveBeerFormat: (value: "all" | "latas" | "botellas") => void;
  categories: ProductCategory[];
}) {
  return (
    <>
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-3xl font-black">Catálogo</h2>
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
        {props.categories.map((category) => (
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
      {props.activeCategory === "cervezas" ? (
        <div className="mb-5 flex gap-2">
          {([
            ["all", "Todas"],
            ["latas", "Latas"],
            ["botellas", "Botellas"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => props.setActiveBeerFormat(value)}
              className={`h-9 rounded-lg px-3 text-xs font-black uppercase ${
                props.activeBeerFormat === value ? "bg-red-600 text-white" : "border border-neutral-300 bg-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
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
          <ProductPrice product={product} featured />
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
    <article className="grid min-w-0 grid-cols-[112px_minmax(0,1fr)] overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm sm:flex sm:h-full sm:flex-col">
      <div className="relative min-h-full bg-neutral-100 sm:aspect-[16/10] sm:min-h-0">
        <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
        {soldOut ? (
          <span className="absolute left-3 top-3 rounded-md bg-red-600 px-2 py-1 text-xs font-black text-white">AGOTADO</span>
        ) : product.stock === "low" ? (
          <span className="absolute left-3 top-3 rounded-md bg-amber-300 px-2 py-1 text-xs font-black text-neutral-950">Últimas unidades</span>
        ) : null}
      </div>
      <div className="min-w-0 p-3 sm:flex sm:flex-1 sm:flex-col sm:p-4">
        <div className="mb-2 flex flex-col gap-1 sm:mb-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-base font-black leading-tight sm:truncate sm:text-lg">{product.name}</h3>
            <p className="mt-1 text-xs font-semibold text-neutral-500 sm:text-sm">{product.volume}</p>
            {product.category === "cervezas" && product.beerFormat ? <p className="mt-1 text-xs font-black uppercase text-red-600">{product.beerFormat}</p> : null}
          </div>
          <ProductPrice product={product} />
        </div>
        <p className="line-clamp-2 text-xs leading-4 text-neutral-600 sm:min-h-10 sm:text-sm sm:leading-5">{product.description}</p>
        <button
          type="button"
          onClick={onAdd}
          disabled={soldOut}
          className={`action-button mt-3 flex h-9 w-full items-center justify-center gap-1 rounded-lg text-xs font-black text-white disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-600 sm:mt-auto sm:h-11 sm:gap-2 sm:text-sm ${
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

function ProductPrice({ product, featured = false }: { product: Product; featured?: boolean }) {
  const hasDiscount = Boolean(product.originalPrice && product.originalPrice > product.price);
  return (
    <span className="shrink-0">
      {hasDiscount ? (
        <span className="block text-xs font-bold text-neutral-400 line-through">{formatCurrency(product.originalPrice!)}</span>
      ) : null}
      <span className={`block font-black text-red-600 ${featured ? "text-xl sm:text-2xl" : "text-base sm:text-lg"}`}>
        {formatCurrency(product.price)}
      </span>
    </span>
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
  addressSearchEnabled: boolean;
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
  const canSearchAddress = props.deliveryEnabled && props.addressSearchEnabled;
  const manualMode = !props.deliveryEnabled || !props.addressSearchEnabled || props.customer.manualAddress;
  const [phoneCountry, setPhoneCountry] = useState("56");
  const countryConfig = latinAmericanPhones.find((country) => country.code === phoneCountry) ?? latinAmericanPhones[0];
  const phoneDigits = props.customer.phone.replace(/\D/g, "");
  const localPhone = phoneDigits.startsWith(phoneCountry) ? phoneDigits.slice(phoneCountry.length) : phoneDigits;

  function updatePhoneCountry(nextCode: string) {
    setPhoneCountry(nextCode);
    props.onCustomer("phone", localPhone ? `+${nextCode} ${localPhone}` : `+${nextCode} `);
  }

  return (
    <aside id="checkout" className="min-w-0 scroll-mt-24 lg:sticky lg:top-24 lg:self-start">
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
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm font-bold">
              Teléfono
              <span className="flex min-w-0">
                <select
                  aria-label="País del teléfono"
                  value={phoneCountry}
                  onChange={(event) => updatePhoneCountry(event.target.value)}
                  className="h-11 max-w-[116px] rounded-l-lg border border-r-0 border-neutral-300 bg-neutral-50 px-2 font-bold"
                >
                  {latinAmericanPhones.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.flag} +{country.code}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={localPhone}
                  onChange={(event) => {
                    const digits = event.target.value.replace(/\D/g, "");
                    props.onCustomer("phone", `+${phoneCountry} ${digits}`);
                  }}
                  placeholder={countryConfig.placeholder}
                  className="h-11 min-w-0 flex-1 rounded-r-lg border border-neutral-300 px-3 font-medium"
                  required
                />
              </span>
              {phoneCountry === "56" ? <span className="text-xs font-medium text-neutral-500">Ingresa los 9 dígitos, comenzando por 9.</span> : null}
            </label>
            <Input label="Email" type="email" value={props.customer.email} onChange={(value) => props.onCustomer("email", value)} required />
          </div>
          <>
              {canSearchAddress ? (
              <label className="flex items-center gap-2 rounded-lg bg-neutral-100 px-3 py-2 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={props.customer.manualAddress}
                  onChange={(event) => props.onCustomer("manualAddress", event.target.checked)}
                />
                Ingresar dirección manualmente
              </label>
              ) : !props.deliveryEnabled ? (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                  <p className="font-black text-green-900">Despacho manual sin cobro</p>
                  <p className="mt-1 text-sm text-green-800">Ingresa la dirección y zona. El precio de despacho no se mostrará ni se sumará al pedido.</p>
                </div>
              ) : null}
              <label className="grid gap-1 text-sm font-bold">
                Dirección
                <div className="flex gap-2">
                  <input
                    value={props.customer.address}
                    onChange={(event) => props.onCustomer("address", event.target.value)}
                    className="h-11 min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 font-medium"
                    placeholder={manualMode ? "Calle y número" : "Busca tu calle y número"}
                    required
                  />
                  {!manualMode ? (
                    <button type="button" onClick={props.onDetectZone} title="Buscar dirección" className="action-button grid size-11 shrink-0 place-items-center rounded-lg bg-neutral-950 text-white">
                      <Search size={18} />
                    </button>
                  ) : null}
                </div>
              </label>
              {!manualMode && props.addressResults.length ? (
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
              <Input label="Departamento, casa, referencia (opcional)" value={props.customer.addressExtra} onChange={(value) => props.onCustomer("addressExtra", value)} />
              <label className="grid gap-1 text-sm font-bold">
                Zona de despacho / Ciudad
                <select required value={props.customer.zoneId} onChange={(event) => props.onCustomer("zoneId", event.target.value)} className="h-11 rounded-lg border border-neutral-300 bg-white px-3 font-medium">
                  <option value="">-</option>
                  {props.deliveryZones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name}{props.deliveryEnabled ? ` - ${formatCurrency(zone.price)}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              {canSearchAddress && !manualMode ? (
                <p className="text-xs font-semibold text-neutral-500">
                  Búsqueda por <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">OpenStreetMap</a> (Beta).
                </p>
              ) : null}
            </>
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
  registeredOrder: { id: string; orderNumber: string; paymentMethod?: OrderPayload["paymentMethod"] } | null;
  onClose: () => void;
  onOpenMercadoPago: () => void;
  onRegister: (
    paymentMethod: OrderPayload["paymentMethod"],
    purpose: "order" | "mercadopago" | "transfer",
    notifyWhatsApp: boolean,
  ) => Promise<boolean>;
}) {
  const [advanceMethod, setAdvanceMethod] = useState<"mercadopago" | "transfer">("mercadopago");
  const [lockedMethod, setLockedMethod] = useState<OrderPayload["paymentMethod"] | null>(props.registeredOrder?.paymentMethod ?? null);
  const [whatsappSent, setWhatsappSent] = useState(false);
  const isLocked = Boolean(lockedMethod);
  const canUseAdvance = props.settings.advancePaymentEnabled && (!isLocked || lockedMethod === advanceMethod);

  async function registerFirst(paymentMethod: OrderPayload["paymentMethod"], purpose: "order" | "mercadopago" | "transfer") {
    const ok = await props.onRegister(paymentMethod, purpose, false);
    if (ok) setLockedMethod(paymentMethod);
  }

  async function notifyWhatsApp(paymentMethod: OrderPayload["paymentMethod"], purpose: "order" | "mercadopago" | "transfer") {
    const ok = await props.onRegister(paymentMethod, purpose, true);
    if (ok) setWhatsappSent(true);
  }
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-neutral-950/80 px-4 py-6 backdrop-blur">
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
          <section className={`rounded-lg border p-4 ${lockedMethod && lockedMethod !== "cash_on_delivery" ? "border-neutral-200 bg-neutral-50 opacity-60" : "border-neutral-200"}`}>
            <h3 className="text-lg font-black">Pago contra entrega</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              Paga cuando recibas tu pedido. La confirmación manual puede aumentar ligeramente el tiempo de entrega.
            </p>
            <div className="mt-4 min-w-0 rounded-lg bg-neutral-50 p-3">
              <p className="mb-2 text-sm font-black">Datos disponibles si prefieres transferir al recibir:</p>
              <BankDetails settings={props.settings} />
            </div>
            <button
              type="button"
              disabled={isLocked}
              onClick={() => void registerFirst("cash_on_delivery", "order")}
              className="action-button mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-neutral-950 px-3 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Check size={18} />
              Confirmar pago y registrar pedido
            </button>
            <button
              type="button"
              disabled={lockedMethod !== "cash_on_delivery"}
              onClick={() => void notifyWhatsApp("cash_on_delivery", "order")}
              className="action-button mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-green-600 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              <FaWhatsapp size={19} />
              Registrar y confirmar por WhatsApp
            </button>
            {lockedMethod === "cash_on_delivery" && !whatsappSent ? (
              <p className="mt-2 rounded-lg bg-amber-50 p-3 text-xs font-black text-amber-900">Obligatorio: ahora presiona WhatsApp para enviar el comprobante o coordinar con el encargado del despacho.</p>
            ) : null}
          </section>
          <section className={`rounded-lg border p-4 ${!props.settings.advancePaymentEnabled || lockedMethod === "cash_on_delivery" ? "border-neutral-200 bg-neutral-50 opacity-60" : "border-neutral-200"}`}>
            <h3 className="text-lg font-black">Pago anticipado <span className="text-xs text-red-600">(Beta)</span></h3>
            <p className="mt-2 text-sm leading-6 text-neutral-600">Paga antes del despacho mediante Mercado Pago o transferencia bancaria.</p>
            {!props.settings.advancePaymentEnabled ? (
              <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-black text-amber-900">Pago anticipado desactivado desde ajustes.</p>
            ) : null}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <SegmentButton active={advanceMethod === "mercadopago"} disabled={!canUseAdvance || isLocked} onClick={() => setAdvanceMethod("mercadopago")}>Mercado Pago</SegmentButton>
              <SegmentButton active={advanceMethod === "transfer"} disabled={!canUseAdvance || isLocked} onClick={() => setAdvanceMethod("transfer")}>Transferencia</SegmentButton>
            </div>
            {advanceMethod === "mercadopago" ? (
              <div className="mt-4 rounded-lg bg-sky-50 p-4">
                <button type="button" disabled={!canUseAdvance || isLocked} onClick={props.onOpenMercadoPago} className="action-button flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-sky-600 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">
                  <SiMercadopago size={25} />
                  Pagar con Mercado Pago
                </button>
                <button type="button" disabled={!canUseAdvance || isLocked} onClick={() => void registerFirst("mercadopago", "mercadopago")} className="action-button mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-neutral-950 px-3 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">
                  <Check size={18} />
                  Confirmar pago y registrar pedido
                </button>
                <button type="button" disabled={lockedMethod !== "mercadopago"} onClick={() => void notifyWhatsApp("mercadopago", "mercadopago")} className="action-button mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-sky-300 bg-white text-sm font-black text-sky-800 disabled:cursor-not-allowed disabled:opacity-45">
                  <FaWhatsapp size={19} />
                  Avisar pago por WhatsApp
                </button>
              </div>
            ) : (
              <div className="mt-4 min-w-0 rounded-lg bg-neutral-50 p-4">
                <BankDetails settings={props.settings} />
                <button type="button" disabled={!canUseAdvance || isLocked} onClick={() => void registerFirst("transfer", "transfer")} className="action-button mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-neutral-950 px-3 py-2 text-center text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">
                  <Check size={18} />
                  Confirmar pago y registrar pedido
                </button>
                <button type="button" disabled={lockedMethod !== "transfer"} onClick={() => void notifyWhatsApp("transfer", "transfer")} className="action-button mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-center text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-45">
                  <FaWhatsapp size={19} />
                  Enviar comprobante por WhatsApp
                </button>
              </div>
            )}
            {lockedMethod && lockedMethod !== "cash_on_delivery" && !whatsappSent ? (
              <p className="mt-2 rounded-lg bg-amber-50 p-3 text-xs font-black text-amber-900">Obligatorio: después de registrar, avisa por WhatsApp para enviar el comprobante y coordinar con el encargado.</p>
            ) : null}
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
  categories: ProductCategory[];
  setCategories: (categories: ProductCategory[]) => void;
  draft: Product;
  setDraft: (draft: Product) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  bulkText: string;
  setBulkText: (value: string) => void;
  importBulkProducts: () => Promise<void>;
  adminView: AdminView;
  setAdminView: (value: AdminView) => void;
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
            Administración
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
            <SegmentButton active={props.adminView === "catalog"} onClick={() => props.setAdminView("catalog")}>Catálogo</SegmentButton>
            <SegmentButton active={props.adminView === "categories"} onClick={() => props.setAdminView("categories")}>Categorías</SegmentButton>
            <SegmentButton active={props.adminView === "zones"} onClick={() => props.setAdminView("zones")}>Zonas</SegmentButton>
            <SegmentButton active={props.adminView === "faqs"} onClick={() => props.setAdminView("faqs")}>FAQ</SegmentButton>
            <SegmentButton active={props.adminView === "settings"} onClick={() => props.setAdminView("settings")}>Ajustes</SegmentButton>
            <SegmentButton active={props.adminView === "seo"} onClick={() => props.setAdminView("seo")}>SEO</SegmentButton>
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
        ) : props.adminView === "categories" ? (
          <CategoriesAdmin
            categories={props.categories}
            setCategories={props.setCategories}
          />
        ) : props.adminView === "zones" ? (
          <ZonesAdmin zones={props.deliveryZones} setZones={props.setDeliveryZones} />
        ) : props.adminView === "faqs" ? (
          <FaqAdmin settings={props.settings} onSaveSettings={props.onSaveSettings} />
        ) : props.adminView === "settings" ? (
          <SettingsAdmin
            key={`${props.settings.businessName}-${props.settings.maintenanceMode}-${props.settings.deliveryEnabled}`}
            settings={props.settings}
            onSaveSettings={props.onSaveSettings}
            syncStatus={props.syncStatus}
          />
        ) : (
          <SeoAdmin
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dateMode, setDateMode] = useState<"day" | "month" | "year">("day");
  const [dateFilter, setDateFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [fulfillmentFilter, setFulfillmentFilter] = useState("all");
  const [searchMode, setSearchMode] = useState<"email" | "phone">("email");
  const [searchValue, setSearchValue] = useState("");
  const filteredOrders = useMemo(
    () =>
      orders.filter((order) => {
        const matchesDate = !dateFilter || orderMatchesDate(order.createdAt, dateMode, dateFilter);
        const matchesPayment = paymentFilter === "all" || order.paymentStatus === paymentFilter;
        const matchesFulfillment = fulfillmentFilter === "all" || order.fulfillmentStatus === fulfillmentFilter;
        const cleanSearch = normalizeText(searchValue);
        const searchTarget =
          searchMode === "email"
            ? normalizeText(order.customerEmail)
            : order.customerPhone.replace(/\D/g, "");
        const normalizedSearch = searchMode === "email" ? cleanSearch : searchValue.replace(/\D/g, "");
        const matchesSearch = !normalizedSearch || searchTarget.includes(normalizedSearch);
        return matchesDate && matchesPayment && matchesFulfillment && matchesSearch;
      }),
    [orders, dateMode, dateFilter, paymentFilter, fulfillmentFilter, searchMode, searchValue],
  );

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

  async function deleteOrder(order: SavedOrder) {
    if (!window.confirm(`¿Eliminar definitivamente el pedido ${order.orderNumber}?`)) return;
    const response = await fetch(`/api/orders/${order.id}`, { method: "DELETE" });
    if (response.ok) setOrders(orders.filter((item) => item.id !== order.id));
  }

  if (!orders.length) {
    return <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center font-bold text-neutral-500">Aún no hay pedidos registrados.</div>;
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-lg border border-neutral-200 bg-[#f7f4ef] p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-black">Pedidos</h3>
            <p className="text-sm font-semibold text-neutral-600">
              Mostrando {filteredOrders.length} de {orders.length}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen((current) => !current)}
            className={`action-button h-11 rounded-lg px-4 text-sm font-black ${filtersOpen ? "bg-neutral-950 text-white" : "border border-neutral-300 bg-white text-neutral-700"}`}
          >
            {filtersOpen ? "Ocultar filtros" : "Mostrar filtros"}
          </button>
        </div>
        {filtersOpen ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[130px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_150px_minmax(0,1.2fr)]">
            <label className="grid gap-1 text-sm font-bold">
              Fecha
              <select
                value={dateMode}
                onChange={(event) => {
                  setDateMode(event.target.value as "day" | "month" | "year");
                  setDateFilter("");
                }}
                className="h-11 rounded-lg border border-neutral-300 bg-white px-3 font-medium"
              >
                <option value="day">Día</option>
                <option value="month">Mes</option>
                <option value="year">Año</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Valor fecha
              <input
                type={dateMode === "year" ? "number" : dateMode === "month" ? "month" : "date"}
                min={dateMode === "year" ? "2024" : undefined}
                max={dateMode === "year" ? "2100" : undefined}
                value={dateFilter}
                onChange={(event) => setDateFilter(event.target.value)}
                className="h-11 rounded-lg border border-neutral-300 bg-white px-3 font-medium"
              />
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Estado pago
              <select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)} className="h-11 rounded-lg border border-neutral-300 bg-white px-3 font-medium">
                <option value="all">Todos</option>
                <option value="pending">Pendiente</option>
                <option value="paid">Pagado</option>
                <option value="refunded">Reembolsado</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Estado pedido
              <select value={fulfillmentFilter} onChange={(event) => setFulfillmentFilter(event.target.value)} className="h-11 rounded-lg border border-neutral-300 bg-white px-3 font-medium">
                <option value="all">Todos</option>
                <option value="new">Nuevo</option>
                <option value="confirmed">Confirmado</option>
                <option value="preparing">Preparando</option>
                <option value="delivering">En reparto</option>
                <option value="completed">Completado</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Buscar por
              <select value={searchMode} onChange={(event) => setSearchMode(event.target.value as "email" | "phone")} className="h-11 rounded-lg border border-neutral-300 bg-white px-3 font-medium">
                <option value="email">Correo</option>
                <option value="phone">Teléfono</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Búsqueda
              <input
                type={searchMode === "phone" ? "tel" : "email"}
                inputMode={searchMode === "phone" ? "numeric" : "email"}
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder={searchMode === "phone" ? "Ej: 987213634" : "correo@ejemplo.cl"}
                className="h-11 rounded-lg border border-neutral-300 bg-white px-3 font-medium"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setDateFilter("");
                setPaymentFilter("all");
                setFulfillmentFilter("all");
                setSearchValue("");
              }}
              className="action-button h-11 rounded-lg border border-neutral-300 bg-white text-sm font-black md:col-span-2 xl:col-span-6"
            >
              Limpiar filtros
            </button>
          </div>
        ) : null}
      </div>
      {!filteredOrders.length ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center font-bold text-neutral-500">
          No hay pedidos con esos filtros.
        </div>
      ) : null}
      {filteredOrders.map((order) => {
        const cleanZoneName = cleanOrderZoneName(order.zoneName);
        const mapQuery = [order.address, cleanZoneName].filter(Boolean).join(", ");
        return (
        <article key={order.id} className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-black uppercase text-red-600">{order.orderNumber}</p>
              <h3 className="text-xl font-black">{order.customerName}</h3>
              <p className="mt-1 text-sm text-neutral-600">{new Date(order.createdAt).toLocaleString("es-CL")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={`https://wa.me/${normalizeChilePhone(order.customerPhone)}?text=${encodeURIComponent(`Hola ${order.customerName}, te contactamos por tu pedido ${order.orderNumber}.`)}`}
                target="_blank"
                rel="noreferrer"
                className="action-button flex h-11 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 text-sm font-black text-white"
              >
                <FaWhatsapp size={19} /> WhatsApp
              </a>
              <button
                type="button"
                onClick={() => void deleteOrder(order)}
                className="action-button flex h-11 items-center justify-center gap-2 rounded-lg bg-red-50 px-4 text-sm font-black text-red-700"
              >
                <Trash2 size={18} /> Eliminar
              </button>
            </div>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="min-w-0">
              <div className="grid gap-2 rounded-lg bg-neutral-50 p-3 text-sm">
                <p className="break-words font-black">Dirección: {order.address}</p>
                <p className="font-bold text-red-700">Zona: {cleanZoneName || order.zoneName}</p>
                {order.city ? <p className="text-neutral-700">Ciudad guardada: {order.city}</p> : null}
                {order.addressExtra ? <p className="text-neutral-700">Referencia: {order.addressExtra}</p> : null}
                {order.notes ? <p className="text-neutral-700">Notas: {order.notes}</p> : null}
                <p className="text-neutral-700">Teléfono: {order.customerPhone}</p>
                <p className="break-words text-neutral-700">Email: {order.customerEmail}</p>
                <p className="text-neutral-700">Método de pago: {paymentMethodLabel(order.paymentMethod)}</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="action-button flex h-10 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-sm font-black text-blue-800"
                >
                  <SiGooglemaps className="text-[#4285F4]" size={18} /> Google Maps
                </a>
                <a
                  href={`https://www.waze.com/ul?q=${encodeURIComponent(mapQuery)}&navigate=yes`}
                  target="_blank"
                  rel="noreferrer"
                  className="action-button flex h-10 items-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-3 text-sm font-black text-cyan-900"
                >
                  <SiWaze className="text-[#33CCFF]" size={19} /> Waze
                </a>
              </div>
              <div className="mt-3 grid gap-1 rounded-lg bg-neutral-50 p-3 text-sm">
                {order.items.map((item) => <p key={`${order.id}-${item.name}`}>{item.quantity}x {item.name} · {formatCurrency(item.lineTotal)}</p>)}
              </div>
              <div className="mt-3 grid gap-2 rounded-lg border border-neutral-200 p-3 text-sm">
                <p className="flex justify-between gap-3"><span>Subtotal</span><strong>{formatCurrency(order.subtotal)}</strong></p>
                <p className="flex justify-between gap-3"><span>Despacho</span><strong>{formatCurrency(order.delivery)}</strong></p>
                <p className="flex justify-between gap-3 border-t border-neutral-200 pt-2 text-lg font-black"><span>Total</span><span>{formatCurrency(order.total)}</span></p>
              </div>
            </div>
            <div className="grid content-start gap-3">
              <label className="grid gap-1 text-sm font-bold">
                <span className="flex items-center justify-between gap-2">
                  Estado del pedido
                  <StatusPill {...fulfillmentStatusMeta(order.fulfillmentStatus)} />
                </span>
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
                <span className="flex items-center justify-between gap-2">
                  Estado del pago
                  <StatusPill {...paymentStatusMeta(order.paymentStatus)} />
                </span>
                <select value={order.paymentStatus} onChange={(event) => void updateOrder(order, "paymentStatus", event.target.value)} className="h-10 rounded-lg border border-neutral-300 px-2">
                  <option value="pending">Pendiente</option>
                  <option value="paid">Pagado</option>
                  <option value="refunded">Reembolsado</option>
                </select>
              </label>
            </div>
          </div>
        </article>
        );
      })}
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

function paymentStatusMeta(status: string) {
  if (status === "paid") return { label: "Pagado", className: "bg-green-100 text-green-800" };
  if (status === "refunded") return { label: "Reembolsado", className: "bg-sky-100 text-sky-800" };
  return { label: "Pendiente", className: "bg-amber-100 text-amber-900" };
}

function fulfillmentStatusMeta(status: string) {
  const labels: Record<string, string> = {
    new: "Nuevo",
    confirmed: "Confirmado",
    preparing: "Preparando",
    delivering: "En reparto",
    completed: "Completado",
    cancelled: "Cancelado",
  };
  if (status === "cancelled") return { label: labels[status], className: "bg-red-100 text-red-800" };
  if (status === "completed") return { label: labels[status], className: "bg-green-100 text-green-800" };
  if (status === "delivering") return { label: labels[status], className: "bg-blue-100 text-blue-800" };
  return { label: labels[status] || "Nuevo", className: "bg-neutral-100 text-neutral-700" };
}

function StatusPill({ label, className }: { label: string; className: string }) {
  return <span className={`rounded-md px-2 py-1 text-xs font-black ${className}`}>{label}</span>;
}

function paymentMethodLabel(method: OrderPayload["paymentMethod"]) {
  if (method === "cash_on_delivery") return "Pago contra entrega";
  if (method === "mercadopago") return "Mercado Pago";
  return "Transferencia bancaria";
}

function cleanOrderZoneName(zoneName: string) {
  return zoneName.replace(/\s+-\s+sin cobro$/i, "").replace(/\s+\(manual\)$/i, "").trim();
}

function orderMatchesDate(createdAt: string, mode: "day" | "month" | "year", value: string) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return false;
  const year = String(date.getFullYear());
  const month = `${year}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  const day = `${month}-${String(date.getDate()).padStart(2, "0")}`;
  if (mode === "year") return year === value;
  if (mode === "month") return month === value;
  return day === value;
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
            <Input label="Precio original (opcional)" type="number" value={props.draft.originalPrice ? String(props.draft.originalPrice) : ""} onChange={(value) => props.setDraft({ ...props.draft, originalPrice: value ? Number(value) : null })} />
            <SelectCategory categories={props.categories} value={props.draft.category} onChange={(category) => props.setDraft({ ...props.draft, category, beerFormat: category === "cervezas" ? props.draft.beerFormat || "latas" : null })} />
            {props.draft.category === "cervezas" ? <SelectBeerFormat value={props.draft.beerFormat || "latas"} onChange={(beerFormat) => props.setDraft({ ...props.draft, beerFormat })} /> : null}
            <Input label="Formato" value={props.draft.volume} onChange={(value) => props.setDraft({ ...props.draft, volume: value })} />
            <ImagePicker label="Cargar imagen desde PC" onImage={(imageUrl) => props.setDraft({ ...props.draft, imageUrl })} />
            <Input label="Foto URL" value={props.draft.imageUrl} onChange={(value) => props.setDraft({ ...props.draft, imageUrl: value })} />
            <Textarea label="Descripción" value={props.draft.description} onChange={(value) => props.setDraft({ ...props.draft, description: value })} />
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
                <input value={product.originalPrice || ""} type="number" placeholder="Precio original" onChange={(event) => props.updateProduct(product.id, (item) => ({ ...item, originalPrice: event.target.value ? Number(event.target.value) : null }))} onBlur={() => void props.onSaveProduct(product)} className="h-10 rounded-md border border-neutral-300 px-2 text-sm font-bold" />
                <SelectCategory categories={props.categories} value={product.category} onChange={(category) => props.updateProduct(product.id, (item) => ({ ...item, category, beerFormat: category === "cervezas" ? item.beerFormat || "latas" : null }))} onBlur={() => void props.onSaveProduct(product)} />
                {product.category === "cervezas" ? <SelectBeerFormat value={product.beerFormat || "latas"} onChange={(beerFormat) => {
                  const nextProduct = { ...product, beerFormat };
                  props.updateProduct(product.id, () => nextProduct);
                  void props.onSaveProduct(nextProduct);
                }} /> : null}
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
                <button
                  type="button"
                  onClick={() => {
                    const featuredCount = props.products.filter((item) => item.featured && item.id !== product.id).length;
                    if (!product.featured && featuredCount >= 2) {
                      window.alert("Sólo puedes tener dos productos destacados. Quita uno antes de agregar otro.");
                      return;
                    }
                    const nextProduct = { ...product, featured: !product.featured };
                    props.updateProduct(product.id, () => nextProduct);
                    void props.onSaveProduct(nextProduct);
                  }}
                  className={`action-button h-10 rounded-md border text-sm font-black ${
                    product.featured
                      ? "border-amber-400 bg-amber-100 text-amber-900"
                      : "border-neutral-300 bg-white text-neutral-600"
                  }`}
                >
                  {product.featured ? "Destacado activo" : "Marcar destacado"}
                </button>
                <button
                  type="button"
                  onClick={() => void props.onSaveProduct(product)}
                  className="action-button flex h-10 items-center justify-center gap-2 rounded-md bg-neutral-950 text-sm font-black text-white"
                >
                  <Save size={17} />
                  Guardar cambios
                </button>
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

function CategoriesAdmin({
  categories,
  setCategories,
}: {
  categories: ProductCategory[];
  setCategories: (categories: ProductCategory[]) => void;
}) {
  const [newLabel, setNewLabel] = useState("");
  const [status, setStatus] = useState("");

  function slugify(value: string) {
    return normalizeText(value)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  async function saveCategories(nextCategories: ProductCategory[], successMessage: string) {
    const ordered = nextCategories.map((category, index) => ({ ...category, sortOrder: index + 1 }));
    const response = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ordered),
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setStatus(data.error || "No se pudieron guardar las categorías.");
      return;
    }
    setCategories(ordered);
    setStatus(successMessage);
  }

  async function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = slugify(newLabel);
    if (!id) return;
    if (categories.some((category) => category.id === id)) {
      setStatus("Ya existe una categoría con ese nombre.");
      return;
    }
    await saveCategories(
      [...categories, { id, label: newLabel.trim(), sortOrder: categories.length + 1 }],
      "Categoría agregada.",
    );
    setNewLabel("");
  }

  async function deleteCategory(category: ProductCategory) {
    if (!window.confirm(`¿Eliminar la categoría ${category.label}?`)) return;
    const response = await fetch(`/api/categories/${category.id}`, { method: "DELETE" });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setStatus(data.error || "No se pudo eliminar la categoría.");
      return;
    }
    setCategories(categories.filter((item) => item.id !== category.id));
    setStatus("Categoría eliminada.");
  }

  function moveCategory(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= categories.length) return;
    const next = [...categories];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    void saveCategories(next, "Orden actualizado.");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <form onSubmit={addCategory} className="h-fit rounded-lg border border-neutral-200 bg-[#f7f4ef] p-4">
        <h3 className="mb-4 text-lg font-black">Nueva categoría</h3>
        <Input label="Nombre" value={newLabel} onChange={setNewLabel} required />
        <button className="action-button mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-neutral-950 text-sm font-black text-white">
          <Plus size={18} /> Agregar categoría
        </button>
        {status ? <p className="mt-3 text-sm font-bold text-neutral-600">{status}</p> : null}
      </form>
      <div className="grid gap-3">
        <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-[#f7f4ef] p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-bold text-neutral-600">Edita nombres u orden y guarda los cambios cuando termines.</p>
          <button
            type="button"
            onClick={() => void saveCategories(categories, "Categorías guardadas.")}
            className="action-button flex h-11 items-center justify-center gap-2 rounded-lg bg-neutral-950 px-4 text-sm font-black text-white"
          >
            <Save size={18} /> Guardar categorías
          </button>
        </div>
        {categories.map((category, index) => (
          <div key={category.id} className="grid gap-3 rounded-lg border border-neutral-200 bg-white p-3 sm:grid-cols-[88px_minmax(0,1fr)_auto] sm:items-center">
            <span className="text-sm font-black text-neutral-400">Orden {index + 1}</span>
            <input
              value={category.label}
              onChange={(event) =>
                setCategories(categories.map((item) => item.id === category.id ? { ...item, label: event.target.value } : item))
              }
              className="h-10 min-w-0 rounded-lg border border-neutral-300 px-3 font-bold"
            />
            <div className="flex gap-2">
              <button type="button" disabled={index === 0} onClick={() => moveCategory(index, -1)} className="action-button grid size-10 place-items-center rounded-lg border border-neutral-300 disabled:opacity-30" title="Subir">
                <ArrowUp size={17} />
              </button>
              <button type="button" disabled={index === categories.length - 1} onClick={() => moveCategory(index, 1)} className="action-button grid size-10 place-items-center rounded-lg border border-neutral-300 disabled:opacity-30" title="Bajar">
                <ArrowDown size={17} />
              </button>
              <button type="button" onClick={() => void deleteCategory(category)} className="action-button grid size-10 place-items-center rounded-lg bg-red-50 text-red-700" title="Eliminar">
                <Trash2 size={17} />
              </button>
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
          <Input label="Precio despacho" type="number" value={String(draft.price)} onChange={(value) => setDraft({ ...draft, price: value === "" ? 0 : Number(value) })} />
          <Input label="Tiempo estimado" value={draft.eta} onChange={(eta) => setDraft({ ...draft, eta })} />
          <Input
            label="Comunas o palabras para detectar"
            value={draft.matchTerms.join(", ")}
            onChange={(value) => setDraft({ ...draft, matchTerms: value.split(",").map((term) => term.trim()).filter(Boolean) })}
          />
          <Textarea label="Descripción" value={draft.description} onChange={(description) => setDraft({ ...draft, description })} />
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
      <SaveSettingsButton syncStatus={syncStatus} label="Guardar ajustes" savedLabel="Ajustes guardados" />
      <Input label="Nombre del negocio" value={draft.businessName} onChange={(value) => setDraft({ ...draft, businessName: value })} />
      <WhatsAppSettingsInput value={draft.whatsappNumber} onChange={(whatsappNumber) => setDraft({ ...draft, whatsappNumber })} />
      <Input label="Correo de contacto" type="email" value={draft.contactEmail} onChange={(value) => setDraft({ ...draft, contactEmail: value })} />
      <SocialHandleInput label="Instagram" prefix="instagram.com/" domain="instagram.com" value={draft.instagramUrl} onChange={(instagramUrl) => setDraft({ ...draft, instagramUrl })} />
      <SocialHandleInput label="Facebook" prefix="facebook.com/" domain="facebook.com" value={draft.facebookUrl} onChange={(facebookUrl) => setDraft({ ...draft, facebookUrl })} />
      <Input label="Link Mercado Pago" value={draft.mercadoPagoLink} onChange={(value) => setDraft({ ...draft, mercadoPagoLink: value })} />
      <BooleanControl
        label="Modo mantenimiento"
        value={draft.maintenanceMode}
        onChange={(maintenanceMode) => setDraft({ ...draft, maintenanceMode })}
        activeLabel="Activar"
        inactiveLabel="Desactivar"
        activeTone="danger"
      />
      <BooleanControl
        label="Cálculo y cobro de despacho"
        value={draft.deliveryEnabled}
        onChange={(deliveryEnabled) => setDraft({ ...draft, deliveryEnabled, addressSearchEnabled: deliveryEnabled ? draft.addressSearchEnabled : false })}
        activeLabel="Activar"
        inactiveLabel="Desactivar"
        activeTone="success"
      />
      <BooleanControl
        label="Búsqueda por OpenStreetMap (Beta)"
        value={draft.addressSearchEnabled}
        onChange={(addressSearchEnabled) => setDraft({ ...draft, addressSearchEnabled: draft.deliveryEnabled ? addressSearchEnabled : false })}
        activeLabel="Activar"
        inactiveLabel="Desactivar"
        activeTone="success"
        disabled={!draft.deliveryEnabled}
      />
      <BooleanControl
        label="Pago anticipado (Beta)"
        value={draft.advancePaymentEnabled}
        onChange={(advancePaymentEnabled) => setDraft({ ...draft, advancePaymentEnabled })}
        activeLabel="Activar"
        inactiveLabel="Desactivar"
        activeTone="success"
      />
      <p className="rounded-lg bg-white px-3 py-3 text-sm font-semibold text-neutral-600 lg:col-span-2">
        Si activas mantenimiento, los clientes verán una pantalla cerrada y solo quedará disponible el inicio de sesión del administrador.
      </p>
      <p className="rounded-lg bg-white px-3 py-3 text-sm font-semibold text-neutral-600 lg:col-span-2">
        Si desactivas el cálculo de despacho, igualmente se solicitarán dirección, ciudad y zona, pero el costo será $0 y no se mostrará al cliente.
      </p>
      <div className="lg:col-span-2">
        <Textarea label="Mensaje mantenimiento" value={draft.maintenanceMessage} onChange={(value) => setDraft({ ...draft, maintenanceMessage: value })} />
      </div>
      <BooleanControl
        label="Mensaje editable de WhatsApp (Beta)"
        value={false}
        onChange={() => undefined}
        activeLabel="Activar"
        inactiveLabel="Desactivar"
        activeTone="success"
        disabled
      />
      <div className="lg:col-span-2">
        <Textarea label="Mensaje inicial de WhatsApp (Beta)" value={draft.whatsappMessageIntro} onChange={() => undefined} disabled />
      </div>
      <Input label="Banco" value={draft.bankDetails.bank} onChange={(value) => setDraft({ ...draft, bankDetails: { ...draft.bankDetails, bank: value } })} />
      <Input label="Titular" value={draft.bankDetails.accountHolder} onChange={(value) => setDraft({ ...draft, bankDetails: { ...draft.bankDetails, accountHolder: value } })} />
      <Input label="Tipo de cuenta" value={draft.bankDetails.accountType} onChange={(value) => setDraft({ ...draft, bankDetails: { ...draft.bankDetails, accountType: value } })} />
      <Input label="Número de cuenta" value={draft.bankDetails.accountNumber} onChange={(value) => setDraft({ ...draft, bankDetails: { ...draft.bankDetails, accountNumber: value } })} />
      <Input label="RUT" value={draft.bankDetails.rut} onChange={(value) => setDraft({ ...draft, bankDetails: { ...draft.bankDetails, rut: value } })} />
      <Input label="Correo pagos" type="email" value={draft.bankDetails.email} onChange={(value) => setDraft({ ...draft, bankDetails: { ...draft.bankDetails, email: value } })} />
      <SaveSettingsButton syncStatus={syncStatus} label="Guardar ajustes" savedLabel="Ajustes guardados" />
    </form>
  );
}

function SeoAdmin({
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
      <SaveSettingsButton syncStatus={syncStatus} label="Guardar SEO" savedLabel="SEO guardado" />
      <Input label="Título SEO" value={draft.seo.title} onChange={(value) => setDraft({ ...draft, seo: { ...draft.seo, title: value } })} />
      <Input label="Plantilla de título" value={draft.seo.titleTemplate} onChange={(value) => setDraft({ ...draft, seo: { ...draft.seo, titleTemplate: value } })} />
      <div className="lg:col-span-2">
        <Textarea label="Descripción SEO" value={draft.seo.description} onChange={(value) => setDraft({ ...draft, seo: { ...draft.seo, description: value } })} />
      </div>
      <div className="lg:col-span-2">
        <Textarea label="Palabras clave separadas por coma" value={draft.seo.keywords} onChange={(value) => setDraft({ ...draft, seo: { ...draft.seo, keywords: value } })} />
      </div>
      <Input label="Open Graph título" value={draft.seo.ogTitle} onChange={(value) => setDraft({ ...draft, seo: { ...draft.seo, ogTitle: value } })} />
      <Input label="Twitter título" value={draft.seo.twitterTitle} onChange={(value) => setDraft({ ...draft, seo: { ...draft.seo, twitterTitle: value } })} />
      <div className="lg:col-span-2">
        <Textarea label="Open Graph descripción" value={draft.seo.ogDescription} onChange={(value) => setDraft({ ...draft, seo: { ...draft.seo, ogDescription: value } })} />
      </div>
      <div className="lg:col-span-2">
        <Textarea label="Twitter descripción" value={draft.seo.twitterDescription} onChange={(value) => setDraft({ ...draft, seo: { ...draft.seo, twitterDescription: value } })} />
      </div>
      <Input label="Ruta canonical" value={draft.seo.canonicalPath} onChange={(value) => setDraft({ ...draft, seo: { ...draft.seo, canonicalPath: value } })} />
    </form>
  );
}

function SaveSettingsButton({
  syncStatus,
  label,
  savedLabel,
}: {
  syncStatus: "idle" | "syncing" | "saved" | "error";
  label: string;
  savedLabel: string;
}) {
  return (
    <button
      disabled={syncStatus === "syncing"}
      className={`action-button flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-black text-white disabled:cursor-wait lg:col-span-2 ${
        syncStatus === "saved" ? "bg-green-600" : syncStatus === "error" ? "bg-red-700" : "bg-neutral-950"
      }`}
    >
      {syncStatus === "saved" ? <Check size={18} /> : <Save size={18} />}
      {syncStatus === "syncing" ? "Guardando..." : syncStatus === "saved" ? savedLabel : syncStatus === "error" ? "Reintentar guardado" : label}
    </button>
  );
}

function BooleanControl({
  label,
  value,
  onChange,
  activeLabel,
  inactiveLabel,
  activeTone,
  disabled = false,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  activeLabel: string;
  inactiveLabel: string;
  activeTone: "success" | "danger";
  disabled?: boolean;
}) {
  const activeClass = activeTone === "danger" ? "bg-red-600 text-white" : "bg-green-600 text-white";
  return (
    <fieldset className="rounded-lg border border-neutral-200 bg-white p-3">
      <legend className="px-1 text-sm font-black">{label}</legend>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          aria-pressed={value}
          disabled={disabled}
          onClick={() => onChange(true)}
          className={`action-button h-10 rounded-lg text-sm font-black disabled:cursor-not-allowed disabled:opacity-40 ${value ? activeClass : "bg-neutral-100 text-neutral-600"}`}
        >
          {activeLabel}
        </button>
        <button
          type="button"
          aria-pressed={!value}
          disabled={disabled}
          onClick={() => onChange(false)}
          className={`action-button h-10 rounded-lg text-sm font-black disabled:cursor-not-allowed disabled:opacity-40 ${!value ? "bg-neutral-950 text-white" : "bg-neutral-100 text-neutral-600"}`}
        >
          {inactiveLabel}
        </button>
      </div>
    </fieldset>
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
          <p className="mb-5 text-sm font-semibold text-neutral-600">El sitio está cerrado para clientes. Inicia sesión para volver a activar la tienda.</p>
          <Link href="/admin" className="action-button flex h-11 items-center justify-center gap-2 rounded-lg bg-neutral-950 text-sm font-black text-white">
            <LogIn size={18} />
            Iniciar sesión
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
          <h2 className="mb-4 text-3xl font-black">Términos</h2>
          <div className="grid gap-4 text-sm leading-7 text-neutral-300">
            <p>Venta exclusiva para mayores de 18 años. La entrega puede requerir cédula de identidad.</p>
            <p>La disponibilidad, precios y tiempos de despacho pueden variar hasta la confirmación final por WhatsApp.</p>
            <p>El link de MercadoPago funciona como pago externo hasta configurar credenciales reales.</p>
            <p>Las direcciones manuales quedan sujetas a cobertura y costo de despacho confirmado por el local.</p>
          </div>
          <div className="mt-6 flex items-center gap-2 rounded-lg bg-white/10 p-3 text-sm font-bold text-amber-100">
            <AlertTriangle size={18} />
            Beber alcohol en exceso es dañino para la salud.
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
        <h2 className="text-2xl font-black">Solo mayores de 18 años</h2>
        <p className="mt-3 leading-7 text-neutral-600">Los tiempos de espera son referenciales y pueden cambiar según demanda, distancia y disponibilidad.</p>
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

function WhatsAppSettingsInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const digits = value.replace(/\D/g, "");
  const currentCountry =
    [...latinAmericanPhones].sort((a, b) => b.code.length - a.code.length).find((country) => digits.startsWith(country.code)) ||
    latinAmericanPhones[0];
  const [phoneCountry, setPhoneCountry] = useState<string>(currentCountry.code);
  const countryConfig = latinAmericanPhones.find((country) => country.code === phoneCountry) ?? latinAmericanPhones[0];
  const localPhone = digits.startsWith(phoneCountry) ? digits.slice(phoneCountry.length) : digits;

  function updatePhoneCountry(nextCode: string) {
    setPhoneCountry(nextCode);
    onChange(localPhone ? `+${nextCode} ${localPhone}` : `+${nextCode} `);
  }

  return (
    <label className="grid gap-1 text-sm font-bold">
      WhatsApp
      <span className="flex min-w-0">
        <select
          aria-label="País del WhatsApp"
          value={phoneCountry}
          onChange={(event) => updatePhoneCountry(event.target.value)}
          className="h-11 max-w-[116px] rounded-l-lg border border-r-0 border-neutral-300 bg-neutral-50 px-2 font-bold"
        >
          {latinAmericanPhones.map((country) => (
            <option key={country.code} value={country.code}>
              {country.flag} +{country.code}
            </option>
          ))}
        </select>
        <input
          type="tel"
          inputMode="numeric"
          value={localPhone}
          onChange={(event) => onChange(`+${phoneCountry} ${event.target.value.replace(/\D/g, "")}`)}
          placeholder={countryConfig.placeholder}
          className="h-11 min-w-0 flex-1 rounded-r-lg border border-neutral-300 px-3 font-medium"
        />
      </span>
    </label>
  );
}

function SocialHandleInput({
  label,
  prefix,
  domain,
  value,
  onChange,
}: {
  label: string;
  prefix: string;
  domain: "instagram.com" | "facebook.com";
  value: string;
  onChange: (value: string) => void;
}) {
  const handle = socialPathFromUrl(value, domain);
  return (
    <label className="grid gap-1 text-sm font-bold">
      {label}
      <span className="flex min-w-0">
        <span className="flex h-11 shrink-0 items-center rounded-l-lg border border-r-0 border-neutral-300 bg-neutral-50 px-3 text-xs font-black text-neutral-600 sm:text-sm">
          {prefix}
        </span>
        <input
          value={handle}
          onChange={(event) => onChange(socialUrlFromPath(event.target.value, domain))}
          className="h-11 min-w-0 flex-1 rounded-r-lg border border-neutral-300 bg-white px-3 font-medium"
        />
      </span>
    </label>
  );
}

function socialPathFromUrl(value: string, domain: "instagram.com" | "facebook.com") {
  try {
    const parsed = new URL(value.startsWith("http") ? value : `https://${value}`);
    return parsed.hostname.includes(domain) ? parsed.pathname.replace(/^\/+|\/+$/g, "") : "";
  } catch {
    return "";
  }
}

function socialUrlFromPath(path: string, domain: "instagram.com" | "facebook.com") {
  const cleanPath = path.replace(/^https?:\/\//, "").replace(domain, "").replace(/^\/+/, "").trim();
  return `https://www.${domain}/${cleanPath}`;
}

function Textarea(props: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <label className="grid gap-1 text-sm font-bold">
      {props.label}
      <textarea
        value={props.value}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.target.value)}
        className="min-h-20 rounded-lg border border-neutral-300 bg-white px-3 py-2 font-medium disabled:cursor-not-allowed disabled:bg-white disabled:text-neutral-500"
      />
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

function SelectCategory(props: { categories: ProductCategory[]; value: CategoryId; onChange: (value: CategoryId) => void; onBlur?: () => void }) {
  return (
    <label className="grid gap-1 text-sm font-bold">
      Categoría
      <select value={props.value} onChange={(event) => props.onChange(event.target.value as CategoryId)} onBlur={props.onBlur} className="h-10 rounded-md border border-neutral-300 bg-white px-2 text-sm font-bold">
        {props.categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SelectBeerFormat(props: { value: "latas" | "botellas"; onChange: (value: "latas" | "botellas") => void }) {
  return (
    <label className="grid gap-1 text-sm font-bold">
      Formato de cerveza
      <select value={props.value} onChange={(event) => props.onChange(event.target.value as "latas" | "botellas")} className="h-10 rounded-md border border-neutral-300 bg-white px-2 text-sm font-bold">
        <option value="latas">Latas</option>
        <option value="botellas">Botellas</option>
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
        <span>{zone.name}</span>
        <span>{deliveryEnabled ? zone.eta : "Sin cobro"}</span>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-neutral-300 pt-3 text-xl font-black">
        <span>Total</span>
        <span>{formatCurrency(total)}</span>
      </div>
    </div>
  );
}

function SegmentButton({ active, onClick, children, disabled = false }: { active: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`h-10 rounded-lg px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-45 ${active ? "bg-neutral-950 text-white" : "border border-neutral-300 bg-white text-neutral-700"}`}>
      {children}
    </button>
  );
}
