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
  Copy,
  CreditCard,
  Crop,
  Download,
  Eye,
  EyeOff,
  LogIn,
  LogOut,
  MapPin,
  Mail,
  Menu,
  Minus,
  Moon,
  Plus,
  Save,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sun,
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
  Coupon,
  CustomerDetails,
  DeliveryZone,
  FaqItem,
  OrderPayload,
  Product,
  ProductCategory,
  SavedOrder,
  AttendanceScheduleDay,
  SiteSettings,
} from "@/lib/types";

const catalogStorageKey = "fonocopete.catalog";
const settingsStorageKey = "fonocopete.settings";
const ageStorageKey = "fonocopete.age-ok";
const themeStorageKey = "fonocopete.theme";
const productsPerCatalogPage = 15;
const productsPerAdminPage = 20;
type AdminView = "orders" | "catalog" | "categories" | "zones" | "coupons" | "settings" | "seo" | "faqs" | "emails" | "analytics";
type ProductSortMode = "manual" | "price_asc" | "price_desc";
type ImageCropOptions = { zoom: number; offsetX: number; offsetY: number };
type AnalyticsRange = "day" | "month" | "year";
type AnalyticsSummary = {
  range: AnalyticsRange;
  date: string;
  total: number;
  previousTotal: number;
  peakHour: string | null;
  buckets: Array<{ label: string; value: number }>;
};

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
  secondaryCategory: null,
  price: 0,
  originalPrice: null,
  beerFormat: null,
  imageUrl: "",
  volume: "",
  stock: "available",
};

export function Storefront({ mode = "store" }: { mode?: "store" | "admin" }) {
  const [products, setProducts] = useState<Product[]>(() => cleanProducts(readLocal(catalogStorageKey, initialProducts)));
  const [productCategories, setProductCategories] = useState<ProductCategory[]>(categories);
  const [settings, setSettings] = useState<SiteSettings>(() => mergeSettings(readLocal(settingsStorageKey, defaultSettings)));
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<CategoryId>("promociones");
  const [activeBeerFormat, setActiveBeerFormat] = useState<"all" | "latas" | "botellas">("all");
  const [productSortMode, setProductSortMode] = useState<ProductSortMode>("manual");
  const [currentProductPage, setCurrentProductPage] = useState(1);
  const [query, setQuery] = useState("");
  const [customer, setCustomer] = useState<CustomerDetails>(emptyCustomer);
  const [orderStatus, setOrderStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [ageConfirmed, setAgeConfirmed] = useState(() => {
    if (typeof window === "undefined") return true;
    return readSafeLocalStorage(ageStorageKey) === "true";
  });
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return readSafeLocalStorage(themeStorageKey) === "dark";
  });
  const [draft, setDraft] = useState<Product>(productDraft);
  const [bulkText, setBulkText] = useState("");
  const [adminView, setAdminView] = useState<AdminView>("orders");
  const [productSource, setProductSource] = useState<"local" | "supabase">("local");
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "saved" | "error">("idle");
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const [adminSessionChecking, setAdminSessionChecking] = useState(true);
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
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [couponCode, setCouponCode] = useState("");
  const [couponStatus, setCouponStatus] = useState("");

  useEffect(() => {
    if (productSource === "local") window.localStorage.setItem(catalogStorageKey, JSON.stringify(products));
  }, [products, productSource]);

  useEffect(() => {
    window.localStorage.setItem(settingsStorageKey, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(new Date()), 60000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (mode !== "store") return;
    const today = new Date().toISOString().slice(0, 10);
    const visitKey = `fonocopete.visit.${today}`;
    if (window.sessionStorage.getItem(visitKey)) return;
    window.sessionStorage.setItem(visitKey, "true");
    fetch("/api/analytics", { method: "POST", keepalive: true }).catch(() => undefined);
  }, [mode]);

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
          setProducts(cleanProducts(data.products.length ? data.products : initialProducts));
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
      setAdminSessionChecking(false);

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
  const knownCategoryIds = useMemo(() => new Set(productCategories.map((category) => category.id)), [productCategories]);
  const effectiveIsAttending = getEffectiveAttendance(settings, currentTime);
  const resolvedActiveCategory = productCategories.some((category) => category.id === activeCategory)
    ? activeCategory
    : productCategories[0]?.id || "promociones";
  const selectedZone = activeZones.find((zone) => zone.id === customer.zoneId);
  const activeZone = selectedZone ?? { ...initialDeliveryZones[0], id: "", name: "Selecciona zona", price: 0, eta: "" };
  const priceAdjustment = getEffectivePriceAdjustment(settings, currentTime);
  const filteredProducts = useMemo(() => {
    const cleanQuery = normalizeText(query);
    const matchingProducts = products.filter((product) => {
      const hasKnownCategory = productHasKnownCategory(product, knownCategoryIds);
      const matchesCategory = cleanQuery ? true : productBelongsToCategory(product, resolvedActiveCategory);
      const matchesBeerFormat =
        cleanQuery ||
        !productBelongsToCategory(product, "cervezas") ||
        resolvedActiveCategory !== "cervezas" ||
        activeBeerFormat === "all" ||
        product.beerFormat === activeBeerFormat;
      const matchesQuery =
        !cleanQuery ||
        normalizeText(`${product.name} ${product.volume} ${product.category} ${product.secondaryCategory ?? ""} ${product.beerFormat ?? ""}`).includes(cleanQuery);
      return product.stock !== "hidden" && hasKnownCategory && matchesCategory && matchesBeerFormat && matchesQuery;
    });
    return sortCatalogProducts(matchingProducts, productSortMode, settings.productOrder, resolvedActiveCategory, priceAdjustment);
  }, [products, knownCategoryIds, resolvedActiveCategory, activeBeerFormat, query, productSortMode, settings.productOrder, priceAdjustment]);
  const totalProductPages = Math.max(1, Math.ceil(filteredProducts.length / productsPerCatalogPage));
  const safeProductPage = Math.min(currentProductPage, totalProductPages);
  const paginatedProducts = filteredProducts.slice(
    (safeProductPage - 1) * productsPerCatalogPage,
    safeProductPage * productsPerCatalogPage,
  );
  const currentCategoryLabel =
    productCategories.find((category) => category.id === resolvedActiveCategory)?.label || "productos";
  const catalogCountLabel = getCatalogCountLabel(filteredProducts.length, currentCategoryLabel, activeBeerFormat, query);
  const featuredProducts = products.filter((product) => product.featured && product.stock !== "hidden" && productHasKnownCategory(product, knownCategoryIds)).slice(0, 2);
  const visibleProductCount = products.filter((product) => product.stock !== "hidden" && productHasKnownCategory(product, knownCategoryIds)).length;
  const promoProductCount = products.filter((product) => product.stock !== "hidden" && productHasKnownCategory(product, knownCategoryIds) && productBelongsToCategory(product, "promociones")).length;
  const cartLines = cart
    .map((item) => {
      const product = products.find((entry) => entry.id === item.productId && entry.stock !== "sold_out");
      const unitPrice = applyPriceAdjustment(product?.price, priceAdjustment) || 0;
      return product ? { ...item, product, unitPrice, lineTotal: unitPrice * item.quantity } : null;
    })
    .filter(Boolean) as Array<CartItem & { product: Product; unitPrice: number; lineTotal: number }>;
  const subtotal = cartLines.reduce((sum, item) => sum + item.lineTotal, 0);
  const appliedCoupon = findCoupon(settings.coupons, couponCode);
  const couponError = getCouponError(appliedCoupon, subtotal, settings.minimumOrderAmount);
  const discount = couponError ? 0 : calculateCouponDiscount(appliedCoupon, subtotal, settings.minimumOrderAmount);
  const deliveryPrice = settings.deliveryEnabled && subtotal > 0 && selectedZone ? selectedZone.price : 0;
  const total = subtotal - discount + deliveryPrice;
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  function confirmAge() {
    writeSafeLocalStorage(ageStorageKey, "true");
    setAgeConfirmed(true);
  }

  function toggleDarkMode() {
    setDarkMode((current) => {
      const next = !current;
      writeSafeLocalStorage(themeStorageKey, next ? "dark" : "light");
      return next;
    });
  }

  function updateStoreQuery(value: string) {
    setQuery(value);
    setCurrentProductPage(1);
  }

  function updateStoreCategory(value: CategoryId) {
    setActiveCategory(value);
    setCurrentProductPage(1);
  }

  function updateStoreBeerFormat(value: "all" | "latas" | "botellas") {
    setActiveBeerFormat(value);
    setCurrentProductPage(1);
  }

  function updateStoreSortMode(value: ProductSortMode) {
    setProductSortMode(value);
    setCurrentProductPage(1);
  }

  function goToCatalogPage(page: number) {
    setCurrentProductPage(page);
    window.requestAnimationFrame(() => {
      document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function applyCoupon() {
    const coupon = findCoupon(settings.coupons, couponCode);
    const error = getCouponError(coupon, subtotal, settings.minimumOrderAmount);
    if (!coupon) {
      setCouponStatus("Cupón no encontrado.");
      return;
    }
    setCouponStatus(error || `Cupón aplicado: ${formatCurrency(calculateCouponDiscount(coupon, subtotal, settings.minimumOrderAmount))} de descuento.`);
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
    if (settings.minimumOrderAmount > 0 && subtotal < settings.minimumOrderAmount) {
      return `El monto minimo de compra es ${formatCurrency(settings.minimumOrderAmount)}.`;
    }
    if (!customer.name.trim()) return "Ingresa tu nombre.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) return "Ingresa un correo válido.";
    if (customer.phone.replace(/\D/g, "").length < 3) return "Ingresa al menos 3 dígitos en el teléfono.";
    if (!hasStreetAndNumber(customer.address)) return "Ingresa calle y número en la dirección.";
    if (!hasOnlyAddressCharacters(customer.address)) return "La dirección tiene caracteres no permitidos.";
    if (!customer.zoneId) return "Selecciona una zona de despacho / ciudad.";
    if (couponCode.trim()) {
      if (!appliedCoupon) return "El cupón ingresado no existe o está desactivado.";
      if (couponError) return couponError;
    }
    if (total <= 0) return "El total debe ser mayor a $0.";
    return "";
  }

  function buildOrder(paymentMethod: OrderPayload["paymentMethod"]): OrderPayload {
    return {
      customer: settings.deliveryEnabled && settings.addressSearchEnabled ? customer : { ...customer, manualAddress: true },
      items: cartLines.map((item) => ({
        name: item.product.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      })),
      subtotal,
      discount,
      couponCode: discount > 0 ? normalizeText(couponCode).toUpperCase() : undefined,
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
      priceAdjustmentActive: priceAdjustment.active,
      priceAdjustmentPercent: priceAdjustment.active ? priceAdjustment.percentage : 0,
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
    if (nextProducts.some(hasInvalidOriginalPrice)) {
      window.alert("El precio original debe ser mayor que el precio normal.");
      return nextProducts;
    }
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
      return cleanProducts(data.products.length ? data.products : nextProducts);
    } catch {
      setProductSource("local");
      setSyncStatus("error");
      return nextProducts;
    }
  }

  async function persistProduct(product: Product) {
    if (hasInvalidOriginalPrice(product)) {
      window.alert("El precio original debe ser mayor que el precio normal.");
      return;
    }
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
    const product = products.find((item) => item.id === productId);
    if (!window.confirm(`¿Eliminar definitivamente ${product?.name || "este producto"} del catálogo?`)) return;
    setProducts((current) => current.filter((product) => product.id !== productId));
    await fetch(`/api/products/${productId}`, { method: "DELETE" }).catch(() => setSyncStatus("error"));
  }

  async function addDraftProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.name || draft.price <= 0) return;
    if (hasInvalidOriginalPrice(draft)) {
      window.alert("El precio original debe ser mayor que el precio normal.");
      return;
    }
    if (draft.secondaryCategory && draft.secondaryCategory === draft.category) {
      window.alert("La segunda categoría debe ser distinta a la principal.");
      return;
    }
    if ((draft.category === "cervezas" || draft.secondaryCategory === "cervezas") && !draft.beerFormat) return;
    if (hasDuplicateProductNameAndVolume(products, draft.name, draft.volume, draft.id || undefined)) {
      window.alert("Ya existe un producto con ese nombre y volumen.");
      return;
    }

    const nextProduct: Product = {
      ...draft,
      category: productCategories.some((category) => category.id === draft.category)
        ? draft.category
        : productCategories[0]?.id || "promociones",
      secondaryCategory: draft.secondaryCategory && productCategories.some((category) => category.id === draft.secondaryCategory)
        ? draft.secondaryCategory
        : null,
      id: draft.id || crypto.randomUUID(),
      imageUrl:
        draft.imageUrl ||
        "https://images.unsplash.com/photo-1535958636474-b021ee887b13?auto=format&fit=crop&w=900&q=80",
      volume: draft.volume || "Formato por definir",
      originalPrice: draft.originalPrice && draft.price > 0 ? draft.originalPrice : null,
      stock: draft.stock || "available",
    };

    const savedProducts = await persistProducts([nextProduct]);
    setProducts((current) => [...savedProducts, ...current.filter((product) => product.id !== nextProduct.id)]);
    setDraft(productDraft);
  }

  async function importBulkProducts() {
    const importedRaw = bulkText
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
          secondaryCategory: null,
          volume: volume || "Formato por definir",
          imageUrl:
            imageUrl ||
            "https://images.unsplash.com/photo-1535958636474-b021ee887b13?auto=format&fit=crop&w=900&q=80",
          stock: "available" as const,
        };
      })
      .filter((product) => product.name && product.price > 0);
    const seenNames = new Set(products.map((product) => normalizeText(product.name)));
    const imported = importedRaw.filter((product) => {
      const cleanName = normalizeText(product.name);
      if (seenNames.has(cleanName)) return false;
      seenNames.add(cleanName);
      return true;
    });
    if (importedRaw.length !== imported.length) {
      window.alert("Se omitieron productos con nombres repetidos.");
    }

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
          sessionChecking={adminSessionChecking}
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
    <main className={`min-h-screen overflow-x-hidden text-neutral-950 ${darkMode ? "fonocopete-dark bg-neutral-950" : "bg-[#f7f4ef]"}`}>
      {ageConfirmed === false ? <AgeGate onConfirm={confirmAge} /> : null}
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

      <Header settings={settings} cartCount={cartCount} darkMode={Boolean(darkMode)} onToggleDarkMode={toggleDarkMode} />
      <FloatingWhatsApp whatsappNumber={settings.whatsappNumber} />

      <section id="promociones" className="relative isolate scroll-mt-20 overflow-hidden bg-neutral-950 text-white">
        <img
          src="/hero-liquor-bg.jpg"
          alt=""
          className="absolute inset-0 -z-20 h-full w-full object-cover object-center opacity-30 sm:object-[70%_center] lg:opacity-38"
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(10,10,10,0.96)_0%,rgba(10,10,10,0.88)_42%,rgba(10,10,10,0.7)_100%)]" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_75%_20%,rgba(239,68,68,0.18),transparent_34%)]" />
        <div className="mx-auto grid max-w-7xl gap-7 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_0.78fr] lg:py-12">
          <div className="relative flex min-w-0 flex-col justify-center">
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <div className="inline-flex w-fit items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-amber-200">
                <ShieldCheck size={17} />
                Solo mayores de 18 años
              </div>
              {settings.attendanceStatusEnabled ? <BusinessStatusSign isAttending={effectiveIsAttending} /> : null}
            </div>
            <h1 className="text-4xl font-black uppercase leading-tight sm:text-6xl">Fonocopete</h1>
            <p className="mt-2 text-xl font-black uppercase text-red-500 sm:text-3xl">Concepción</p>
            <p className="mt-4 max-w-2xl text-base leading-7 text-neutral-300 sm:text-lg">
              Delivery de alcohol en Concepción: cervezas, piscos, vinos, destilados, promos y más para que el carrete no se acabe.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Metric icon={<Beer size={20} />} label="Catálogo" value={`${visibleProductCount} productos · ${promoProductCount} promos`} />
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
            <div className="mt-3 grid gap-2 text-xs font-black">
              <span className="text-neutral-400">También coordinamos envíos por</span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-8 items-center gap-2 rounded-md bg-white px-3 text-neutral-950">
                  <SiUbereats size={18} className="text-[#06C167]" /> Uber Eats
                </span>
                <span className="inline-flex h-8 items-center rounded-md bg-[#ef3e46] px-2">
                  <img src="/pedidosya-logo-crop.png" alt="PedidosYa" className="h-6 w-[92px] object-contain" />
                </span>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-black">
              <span className="text-neutral-400">Aceptamos pago por</span>
              <span className="inline-flex h-8 items-center gap-2 rounded-md bg-sky-100 px-3 text-sky-950">
                <SiMercadopago size={20} className="text-sky-600" /> Mercado Pago
              </span>
            </div>
          </div>
          <div className="grid min-w-0 content-start gap-4">
            {featuredProducts.map((product) => (
              <FeaturedProduct key={product.id} product={product} priceAdjustment={priceAdjustment} added={addedProductId === product.id} onAdd={() => addToCart(product)} />
            ))}
          </div>
        </div>
      </section>

      <section id="catalogo" className="mx-auto grid max-w-7xl scroll-mt-24 gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_390px]">
        <div className="min-w-0">
          <CatalogToolbar
            query={query}
            setQuery={updateStoreQuery}
            activeCategory={resolvedActiveCategory}
            setActiveCategory={updateStoreCategory}
            activeBeerFormat={activeBeerFormat}
            setActiveBeerFormat={updateStoreBeerFormat}
            productSortMode={productSortMode}
            setProductSortMode={updateStoreSortMode}
            categories={productCategories}
          />
          <CatalogPagination
            page={safeProductPage}
            totalPages={totalProductPages}
            countLabel={catalogCountLabel}
            onPage={goToCatalogPage}
          />
          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {paginatedProducts.length ? (
              paginatedProducts.map((product) => (
                <ProductCard key={product.id} product={product} priceAdjustment={priceAdjustment} added={addedProductId === product.id} onAdd={() => addToCart(product)} />
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center text-sm font-bold text-neutral-500 sm:col-span-2 xl:col-span-3">
                No hay productos disponibles en esta vista.
              </div>
            )}
          </div>
          <CatalogPagination
            page={safeProductPage}
            totalPages={totalProductPages}
            countLabel={catalogCountLabel}
            onPage={goToCatalogPage}
            bottom
          />
        </div>

        <CheckoutPanel
          cartLines={cartLines}
          cartCount={cartCount}
          customer={customer}
          activeZone={activeZone}
          subtotal={subtotal}
          discount={discount}
          couponCode={couponCode}
          couponStatus={couponStatus}
          deliveryPrice={deliveryPrice}
          total={total}
          minimumOrderAmount={settings.minimumOrderAmount}
          orderStatus={orderStatus}
          checkoutError={checkoutError}
          onSubmit={openPaymentOptions}
          onRemove={(productId) => setCart((current) => current.filter((item) => item.productId !== productId))}
          onQuantity={updateQuantity}
          onCustomer={updateCustomer}
          onCouponCode={(value) => {
            setCouponCode(value.toUpperCase());
            setCouponStatus("");
          }}
          onApplyCoupon={applyCoupon}
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
  const stored = readSafeLocalStorage(key);
  if (!stored) return fallback;
  try {
    return JSON.parse(stored) as T;
  } catch {
    removeSafeLocalStorage(key);
    return fallback;
  }
}

function readSafeLocalStorage(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSafeLocalStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // La preferencia sigue funcionando durante la sesión aunque el navegador bloquee el almacenamiento.
  }
}

function removeSafeLocalStorage(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Sin acción: algunos navegadores privados bloquean localStorage.
  }
}

function cleanProducts(products: Product[]) {
  return products.map((product) => ({
    ...product,
    secondaryCategory: product.secondaryCategory || null,
  }));
}

function mergeSettings(settings: Partial<SiteSettings>): SiteSettings {
  const whatsappDigits = settings.whatsappNumber?.replace(/\D/g, "");
  return {
    ...defaultSettings,
    ...settings,
    whatsappNumber: whatsappDigits === "56939351855" || whatsappDigits === "56912345678"
      ? "56989351855"
      : settings.whatsappNumber || defaultSettings.whatsappNumber,
    attendanceSchedule: settings.attendanceSchedule || defaultSettings.attendanceSchedule,
    coupons: settings.coupons || defaultSettings.coupons,
    newsletter: { ...defaultSettings.newsletter, ...settings.newsletter },
    email: { ...defaultSettings.email, ...settings.email },
    productPriceAdjustment: { ...defaultSettings.productPriceAdjustment, ...settings.productPriceAdjustment },
    productOrder: settings.productOrder || defaultSettings.productOrder,
    bankDetails: { ...defaultSettings.bankDetails, ...settings.bankDetails },
    seo: { ...defaultSettings.seo, ...settings.seo },
  };
}

function minutesFromTime(value: string) {
  const [hours = "0", minutes = "0"] = value.split(":");
  return Number(hours) * 60 + Number(minutes);
}

function toLocalDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getEffectiveAttendance(settings: SiteSettings, date: Date) {
  if (!settings.attendanceStatusEnabled) return settings.isAttending;
  if (!settings.attendanceScheduleEnabled) return settings.isAttending;
  const today = settings.attendanceSchedule.find((entry) => entry.day === date.getDay());
  if (!today?.enabled) return false;
  const now = date.getHours() * 60 + date.getMinutes();
  const open = minutesFromTime(today.open);
  const close = minutesFromTime(today.close);
  if (open === close) return true;
  if (open < close) return now >= open && now < close;
  return now >= open || now < close;
}

function getEffectivePriceAdjustment(settings: SiteSettings, date: Date) {
  const adjustment = { ...defaultSettings.productPriceAdjustment, ...settings.productPriceAdjustment };
  const percentage = Math.max(0, Math.min(300, Math.round(Number(adjustment.percentage) || 0)));
  if (!adjustment.enabled || percentage <= 0) return { active: false, percentage: 0 };
  if (!adjustment.scheduleEnabled) return { active: true, percentage };

  const dateLabel = toLocalDateInputValue(date);
  if (adjustment.startDate && dateLabel < adjustment.startDate) return { active: false, percentage: 0 };
  if (adjustment.endDate && dateLabel > adjustment.endDate) return { active: false, percentage: 0 };

  const now = date.getHours() * 60 + date.getMinutes();
  const start = minutesFromTime(adjustment.startTime || "00:00");
  const end = minutesFromTime(adjustment.endTime || "23:59");
  const matchesTime = start <= end ? now >= start && now <= end : now >= start || now <= end;
  return matchesTime ? { active: true, percentage } : { active: false, percentage: 0 };
}

function applyPriceAdjustment(value: number | null | undefined, adjustment: { active: boolean; percentage: number }) {
  if (!value) return value || null;
  if (!adjustment.active || adjustment.percentage <= 0) return value;
  return Math.max(1, Math.round(value * (1 + adjustment.percentage / 100)));
}

function productBelongsToCategory(product: Product, categoryId: string) {
  return product.category === categoryId || product.secondaryCategory === categoryId;
}

function productHasKnownCategory(product: Product, categoryIds: Set<string>) {
  return categoryIds.has(product.category) || Boolean(product.secondaryCategory && categoryIds.has(product.secondaryCategory));
}

function productAvailabilityRank(product: Product) {
  if (product.stock === "hidden") return 3;
  if (product.stock === "sold_out") return 2;
  return 1;
}

function sortCatalogProducts(
  products: Product[],
  sortMode: ProductSortMode,
  productOrder: Record<string, string[]>,
  viewCategory?: string,
  priceAdjustment: { active: boolean; percentage: number } = { active: false, percentage: 0 },
) {
  return [...products].sort((a, b) => {
    const availability = productAvailabilityRank(a) - productAvailabilityRank(b);
    if (availability) return availability;
    if (sortMode === "price_asc") return (applyPriceAdjustment(a.price, priceAdjustment) || a.price) - (applyPriceAdjustment(b.price, priceAdjustment) || b.price);
    if (sortMode === "price_desc") return (applyPriceAdjustment(b.price, priceAdjustment) || b.price) - (applyPriceAdjustment(a.price, priceAdjustment) || a.price);
    const manual = productOrderIndexForCategory(a, productOrder, viewCategory) - productOrderIndexForCategory(b, productOrder, viewCategory);
    if (manual) return manual;
    return a.name.localeCompare(b.name, "es");
  });
}

function hasDuplicateProductNameAndVolume(products: Product[], name: string, volume: string, currentId?: string) {
  const cleanName = normalizeText(name);
  const cleanVolume = normalizeText(volume || "Formato por definir");
  if (!cleanName || !cleanVolume) return false;
  return products.some(
    (product) =>
      product.id !== currentId &&
      normalizeText(product.name) === cleanName &&
      normalizeText(product.volume || "Formato por definir") === cleanVolume,
  );
}

function productOrderIndexForCategory(product: Product, productOrder: Record<string, string[]>, categoryId?: string) {
  const order = productOrder[categoryId || product.category] || [];
  const index = order.indexOf(product.id);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function hasInvalidOriginalPrice(product: Pick<Product, "price" | "originalPrice">) {
  return Boolean(product.originalPrice && product.originalPrice <= product.price);
}

function findCoupon(coupons: Coupon[], code: string) {
  const cleanCode = normalizeText(code).toUpperCase();
  if (!cleanCode) return null;
  return coupons.find((coupon) => coupon.active && normalizeText(coupon.code).toUpperCase() === cleanCode) || null;
}

function calculateCouponDiscount(coupon: Coupon | null, subtotal: number, minimumOrderAmount: number) {
  if (!coupon || subtotal <= 0) return 0;
  const rawDiscount = coupon.type === "percentage"
    ? Math.floor((subtotal * coupon.value) / 100)
    : coupon.value;
  const maxByPositiveTotal = Math.max(0, subtotal - 1);
  const maxByMinimum = minimumOrderAmount > 0 ? Math.max(0, subtotal - minimumOrderAmount) : maxByPositiveTotal;
  return Math.min(rawDiscount, maxByPositiveTotal, maxByMinimum);
}

function getCouponError(coupon: Coupon | null, subtotal: number, minimumOrderAmount: number) {
  if (!coupon) return "";
  if (coupon.minimumSubtotal > 0 && subtotal < coupon.minimumSubtotal) {
    return `Este cupón requiere un subtotal mínimo de ${formatCurrency(coupon.minimumSubtotal)}.`;
  }
  const discount = calculateCouponDiscount(coupon, subtotal, minimumOrderAmount);
  if (discount <= 0) {
    return minimumOrderAmount > 0
      ? "Este cupón no puede aplicarse porque dejaría el pedido bajo el monto mínimo."
      : "Este cupón no puede dejar el total en $0.";
  }
  return "";
}

function getCatalogCountLabel(totalProducts: number, categoryLabel: string, beerFormat: "all" | "latas" | "botellas", query: string) {
  if (normalizeText(query)) return `${totalProducts} resultados`;
  const cleanCategory = categoryLabel.toLocaleLowerCase("es-CL");
  if (normalizeText(categoryLabel) === "cervezas" && beerFormat !== "all") {
    return `${totalProducts} ${beerFormat} de cervezas`;
  }
  return `${totalProducts} ${cleanCategory}`;
}

function hasStreetAndNumber(address: string) {
  return /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(address) && /\d/.test(address);
}

function sanitizeAddressValue(value: string) {
  return value.replace(/[^0-9A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s.,°ºª\-/'"]/g, "");
}

function hasOnlyAddressCharacters(address: string) {
  return sanitizeAddressValue(address) === address;
}

function resizeImageSource(src: string, crop: ImageCropOptions = { zoom: 1, offsetX: 0, offsetY: 0 }) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    if (!src.startsWith("data:") && !src.startsWith("blob:")) image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const targetWidth = 1200;
      const targetHeight = 900;
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("No se pudo procesar la imagen"));
        return;
      }
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";

      const sourceRatio = image.width / image.height;
      const targetRatio = targetWidth / targetHeight;
      const baseSourceWidth = sourceRatio > targetRatio ? image.height * targetRatio : image.width;
      const baseSourceHeight = sourceRatio > targetRatio ? image.height : image.width / targetRatio;
      const zoom = Math.min(2.5, Math.max(1, crop.zoom || 1));
      const sourceWidth = baseSourceWidth / zoom;
      const sourceHeight = baseSourceHeight / zoom;
      const maxSourceX = Math.max(0, image.width - sourceWidth);
      const maxSourceY = Math.max(0, image.height - sourceHeight);
      const sourceX = Math.min(maxSourceX, Math.max(0, maxSourceX / 2 + (crop.offsetX / 100) * (maxSourceX / 2)));
      const sourceY = Math.min(maxSourceY, Math.max(0, maxSourceY / 2 + (crop.offsetY / 100) * (maxSourceY / 2)));

      context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, targetWidth, targetHeight);
      try {
        resolve(canvas.toDataURL("image/jpeg", 0.9));
      } catch {
        reject(new Error("La imagen no permite optimizacion"));
      }
    };
    image.onerror = () => reject(new Error("Imagen invalida"));
    image.src = src;
  });
}

function Header({
  settings,
  cartCount,
  darkMode,
  onToggleDarkMode,
}: {
  settings: SiteSettings;
  cartCount: number;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}) {
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
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:gap-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setMenuOpen((current) => !current)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
            className="action-button grid size-10 shrink-0 place-items-center rounded-lg border border-neutral-300 bg-white text-neutral-950 sm:size-11"
          >
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
          <a href="#catalogo" className="flex min-w-0 items-center gap-2 sm:gap-3">
          <img src="/fonocopete-logo-circle.jpg" alt="" className="size-10 shrink-0 rounded-full border border-neutral-200 object-cover sm:size-11" />
          <span className="min-w-0 max-w-[132px] sm:max-w-none">
            <span className="block truncate text-sm font-black uppercase leading-tight tracking-wide sm:text-lg">Fonocopete</span>
            <span className="block truncate whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.13em] text-red-600 sm:text-xs sm:tracking-[0.18em]">Botillería delivery</span>
          </span>
          </a>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link href="/admin" className="action-button hidden h-11 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-black sm:inline-flex">
            <LogIn size={17} />
            Administrador
          </Link>
          <button
            type="button"
            onClick={onToggleDarkMode}
            aria-label={darkMode ? "Desactivar modo oscuro" : "Activar modo oscuro"}
            title={darkMode ? "Desactivar modo oscuro" : "Activar modo oscuro"}
            className="action-button grid size-10 place-items-center rounded-lg border border-neutral-300 bg-white text-neutral-950 sm:size-11"
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <a href="#checkout" className="action-button inline-flex h-10 items-center gap-2 rounded-lg bg-red-600 px-3 text-sm font-bold text-white sm:h-11 sm:px-4">
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
    <div className="mt-16 border-t border-neutral-200/70 bg-white/80">
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
      <SocialIcon href={settings.instagramUrl} label="Instagram" hoverClass="hover:border-pink-500 hover:text-pink-600 active:border-pink-500 active:text-pink-600"><FaInstagram size={18} /></SocialIcon>
      <SocialIcon href={settings.facebookUrl} label="Facebook" hoverClass="hover:border-blue-600 hover:text-blue-600 active:border-blue-600 active:text-blue-600"><FaFacebookF size={17} /></SocialIcon>
      <SocialIcon href={`mailto:${settings.contactEmail}`} label="Correo" hoverClass="hover:border-amber-500 hover:text-amber-600 active:border-amber-500 active:text-amber-600"><Mail size={18} /></SocialIcon>
      <SocialIcon href={whatsappUrl} label="WhatsApp" hoverClass="hover:border-green-500 hover:text-green-600 active:border-green-500 active:text-green-600"><FaWhatsapp size={19} /></SocialIcon>
    </div>
  );
}

function SocialIcon({ href, label, hoverClass, children }: { href: string; label: string; hoverClass: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noreferrer" : undefined}
      aria-label={label}
      title={label}
      className={`action-button grid size-10 place-items-center rounded-lg border border-neutral-300 bg-white text-neutral-700 ${hoverClass}`}
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
  productSortMode: ProductSortMode;
  setProductSortMode: (value: ProductSortMode) => void;
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
        <div className="mb-5 flex flex-wrap gap-2">
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
      <div className="mb-5 flex flex-wrap gap-2">
        {([
          ["manual", "Orden tienda"],
          ["price_asc", "Menor precio"],
          ["price_desc", "Mayor precio"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => props.setProductSortMode(value)}
            className={`h-9 rounded-lg px-3 text-xs font-black uppercase ${
              props.productSortMode === value ? "bg-neutral-950 text-white" : "border border-neutral-300 bg-white text-neutral-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </>
  );
}

function CatalogPagination({
  page,
  totalPages,
  countLabel,
  onPage,
  bottom = false,
}: {
  page: number;
  totalPages: number;
  countLabel: string;
  onPage: (page: number) => void;
  bottom?: boolean;
}) {
  if (totalPages <= 1) return null;
  const pageItems = getPaginationItems(page, totalPages);
  const currentBlockStart = Math.floor((page - 1) / 10) * 10 + 1;
  const previousBlockPage = Math.max(1, currentBlockStart - 10);
  const nextBlockPage = Math.min(totalPages, currentBlockStart + 10);
  const hasPreviousBlock = currentBlockStart > 1;
  const hasNextBlock = currentBlockStart + 9 < totalPages;
  return (
    <nav
      aria-label={bottom ? "Paginacion inferior del catalogo" : "Paginacion superior del catalogo"}
      className={`${bottom ? "mt-5" : "mb-4"} flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white/70 p-2 sm:flex-row sm:items-center sm:justify-between`}
    >
      <span className="px-1 text-xs font-black uppercase text-neutral-500">
        {countLabel}
      </span>
      <div className="flex max-w-full items-center gap-1 overflow-x-auto">
        {totalPages > 10 ? (
          <button
            type="button"
            disabled={!hasPreviousBlock}
            onClick={() => onPage(previousBlockPage)}
            className="action-button grid size-9 shrink-0 place-items-center rounded-lg border border-neutral-300 bg-white text-sm font-black text-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-300"
            aria-label="Paginas anteriores"
          >
            ‹
          </button>
        ) : null}
        {pageItems.map((item) => (
          <button
            key={item.page}
            type="button"
            disabled={item.disabled}
            onClick={() => onPage(item.page)}
            aria-current={item.page === page ? "page" : undefined}
            className={`action-button grid size-9 shrink-0 place-items-center rounded-lg text-sm font-black disabled:cursor-not-allowed ${
              item.disabled
                ? "border border-neutral-200 bg-neutral-100 text-neutral-300"
                : item.page === page
                  ? "bg-neutral-950 text-white"
                  : "border border-neutral-300 bg-white text-neutral-700"
            }`}
          >
            {item.page}
          </button>
        ))}
        {totalPages > 10 ? (
          <button
            type="button"
            disabled={!hasNextBlock}
            onClick={() => onPage(nextBlockPage)}
            className="action-button grid size-9 shrink-0 place-items-center rounded-lg border border-neutral-300 bg-white text-sm font-black text-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-300"
            aria-label="Paginas siguientes"
          >
            ›
          </button>
        ) : null}
      </div>
    </nav>
  );
}

function getPaginationItems(page: number, totalPages: number) {
  const blockStart = Math.floor((page - 1) / 10) * 10 + 1;
  return Array.from({ length: 10 }, (_, index) => {
    const itemPage = blockStart + index;
    return {
      page: itemPage,
      disabled: itemPage > totalPages,
    };
  });
}

function BusinessStatusSign({ isAttending }: { isAttending: boolean }) {
  return (
    <div
      className={`relative inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-black uppercase tracking-[0.18em] shadow-2xl ${
        isAttending
          ? "border-emerald-300/70 bg-emerald-400/10 text-emerald-100 shadow-emerald-500/20"
          : "border-red-400/70 bg-red-500/10 text-red-100 shadow-red-500/20"
      }`}
      aria-label={isAttending ? "Estado: atendiendo" : "Estado: cerrado"}
    >
      <span
        className={`size-2.5 rounded-full ${isAttending ? "animate-pulse bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.95)]" : "bg-red-400 shadow-[0_0_14px_rgba(248,113,113,0.95)]"}`}
      />
      <span className={isAttending ? "drop-shadow-[0_0_8px_rgba(110,231,183,0.85)]" : "drop-shadow-[0_0_8px_rgba(248,113,113,0.8)]"}>
        {isAttending ? "Atendiendo" : "Cerrado"}
      </span>
    </div>
  );
}

function FeaturedProduct({
  product,
  priceAdjustment,
  onAdd,
  added,
}: {
  product: Product;
  priceAdjustment: { active: boolean; percentage: number };
  onAdd: () => void;
  added: boolean;
}) {
  const soldOut = product.stock === "sold_out";
  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={soldOut}
      className={`action-button grid min-w-0 self-start grid-cols-[96px_minmax(0,1fr)] overflow-hidden rounded-lg border bg-white text-left text-neutral-950 shadow-2xl disabled:opacity-75 sm:grid-cols-[112px_minmax(0,1fr)] ${
        added ? "border-green-500 ring-4 ring-green-400/30" : "border-white/10"
      }`}
    >
      <img src={product.imageUrl} alt="" className="h-full min-h-28 w-full object-cover" />
      <span className="min-w-0 p-4">
        <span className="text-xs font-black uppercase tracking-[0.16em] text-red-600">{soldOut ? "Agotado" : "Promo activa"}</span>
        <span className="mt-1 block truncate text-lg font-black sm:text-xl">{product.name}</span>
        <span className="mt-1 block text-sm text-neutral-600">{product.volume}</span>
        <span className="mt-3 flex items-center justify-between gap-2">
          <ProductPrice product={product} priceAdjustment={priceAdjustment} featured />
          <span className={`grid size-10 shrink-0 place-items-center rounded-lg text-white transition ${added ? "bg-green-600" : "bg-neutral-950"}`}>
            {added ? <Check size={19} /> : <Plus size={19} />}
          </span>
        </span>
      </span>
    </button>
  );
}

function ProductCard({
  product,
  priceAdjustment,
  onAdd,
  added,
}: {
  product: Product;
  priceAdjustment: { active: boolean; percentage: number };
  onAdd: () => void;
  added: boolean;
}) {
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
          <ProductPrice product={product} priceAdjustment={priceAdjustment} />
        </div>
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

function ProductPrice({
  product,
  priceAdjustment,
  featured = false,
}: {
  product: Product;
  priceAdjustment: { active: boolean; percentage: number };
  featured?: boolean;
}) {
  const effectivePrice = applyPriceAdjustment(product.price, priceAdjustment) || product.price;
  const effectiveOriginalPrice = applyPriceAdjustment(product.originalPrice, priceAdjustment);
  const hasDiscount = Boolean(effectiveOriginalPrice && effectiveOriginalPrice > effectivePrice);
  return (
    <span className="shrink-0">
      {hasDiscount ? (
        <span className="block text-xs font-bold text-neutral-400 line-through">{formatCurrency(effectiveOriginalPrice!)}</span>
      ) : null}
      <span className={`block font-black text-red-600 ${featured ? "text-xl sm:text-2xl" : "text-base sm:text-lg"}`}>
        {formatCurrency(effectivePrice)}
      </span>
    </span>
  );
}

function CheckoutPanel(props: {
  cartLines: Array<CartItem & { product: Product; unitPrice: number; lineTotal: number }>;
  cartCount: number;
  customer: CustomerDetails;
  activeZone: { id: string; name: string; price: number; eta: string };
  subtotal: number;
  discount: number;
  couponCode: string;
  couponStatus: string;
  deliveryPrice: number;
  total: number;
  minimumOrderAmount: number;
  orderStatus: "idle" | "sending" | "sent" | "error";
  checkoutError: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onRemove: (productId: string) => void;
  onQuantity: (productId: string, delta: number) => void;
  onCustomer: (field: keyof CustomerDetails, value: string | boolean) => void;
  onCouponCode: (value: string) => void;
  onApplyCoupon: () => void;
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
                    onChange={(event) => props.onCustomer("address", sanitizeAddressValue(event.target.value))}
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
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <label className="grid gap-1 text-sm font-bold">
              Cupón de descuento (opcional)
              <div className="flex gap-2">
                <input
                  value={props.couponCode}
                  onChange={(event) => props.onCouponCode(event.target.value)}
                  placeholder="Ej: FONO10"
                  className="h-11 min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 font-medium uppercase"
                />
                <button type="button" onClick={props.onApplyCoupon} className="action-button h-11 rounded-lg bg-neutral-950 px-4 text-sm font-black text-white">
                  Aplicar
                </button>
              </div>
            </label>
            {props.couponStatus ? (
              <p className={`mt-2 rounded-lg px-3 py-2 text-xs font-black ${props.discount > 0 ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900"}`}>
                {props.couponStatus}
              </p>
            ) : null}
          </div>
        </div>
        <OrderTotals
          subtotal={props.subtotal}
          discount={props.discount}
          delivery={props.deliveryPrice}
          total={props.total}
          zone={props.activeZone}
          deliveryEnabled={props.deliveryEnabled}
          minimumOrderAmount={props.minimumOrderAmount}
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
              <p className="mb-2 text-sm font-black">Datos disponibles si prefieres transferir desde antes:</p>
              <BankDetails settings={props.settings} />
            </div>
            <button
              type="button"
              disabled={isLocked}
              onClick={() => void registerFirst("cash_on_delivery", "order")}
              className="action-button mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-neutral-950 px-3 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Check size={18} />
              Confirmar compra y registrar pedido
            </button>
            <button
              type="button"
              disabled={lockedMethod !== "cash_on_delivery"}
              onClick={() => void notifyWhatsApp("cash_on_delivery", "order")}
              className="action-button mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-green-600 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              <FaWhatsapp size={19} />
              Confirmar y coordinar entrega por WhatsApp
            </button>
            {lockedMethod === "cash_on_delivery" && !whatsappSent ? (
              <p className="mt-2 rounded-lg bg-amber-50 p-3 text-xs font-black text-amber-900">Obligatorio: ahora presiona WhatsApp para enviar el comprobante o coordinar con el encargado del despacho.</p>
            ) : null}
          </section>
          <section className={`rounded-lg border p-4 ${!props.settings.advancePaymentEnabled || lockedMethod === "cash_on_delivery" ? "border-neutral-200 bg-neutral-50 opacity-60" : "border-neutral-200"}`}>
            <h3 className="text-lg font-black">Pago anticipado <span className="text-xs font-semibold text-red-700">(Beta)</span></h3>
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

function formatBankDetailsForTransfer(bank: SiteSettings["bankDetails"]) {
  return [
    bank.accountHolder,
    bank.accountType,
    `RUT: ${bank.rut}`,
    bank.bank,
    bank.accountNumber,
    bank.email,
  ].join("\n");
}

function csvEscape(value: unknown) {
  const text = value == null
    ? ""
    : Array.isArray(value) || typeof value === "object"
      ? JSON.stringify(value)
      : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadTextFile(filename: string, content: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function exportCsv(filename: string, headers: string[], rows: Array<Array<unknown>>) {
  const delimiter = ";";
  const csv = [
    headers.map(csvEscape).join(delimiter),
    ...rows.map((row) => row.map(csvEscape).join(delimiter)),
  ].join("\n");
  downloadTextFile(filename, `\uFEFF${csv}`);
}

function flattenRecord(value: unknown, prefix = ""): Array<[string, unknown]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [[prefix, value]];
  return Object.entries(value).flatMap(([key, entry]) => flattenRecord(entry, prefix ? `${prefix}.${key}` : key));
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function BankDetails({ settings }: { settings: SiteSettings }) {
  const bank = settings.bankDetails;
  const [copied, setCopied] = useState(false);

  async function copyBankDetails() {
    await copyTextToClipboard(formatBankDetailsForTransfer(bank));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="relative grid gap-3">
      <dl className="grid gap-2 text-sm">
        <Detail label="Banco" value={bank.bank} />
        <Detail label="Titular" value={bank.accountHolder} />
        <Detail label={bank.accountType} value={bank.accountNumber} />
        <Detail label="RUT" value={bank.rut} />
        <Detail label="Correo" value={bank.email} />
      </dl>
      <button
        type="button"
        onClick={() => void copyBankDetails()}
        className={`action-button flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-black transition ${
          copied ? "bg-green-600 text-white" : "border border-neutral-300 bg-white text-neutral-800"
        }`}
      >
        {copied ? <Check size={18} /> : <Copy size={18} />}
        {copied ? "Datos copiados" : "Copiar datos bancarios"}
      </button>
      {copied ? (
        <div className="fixed bottom-5 left-1/2 z-[90] -translate-x-1/2 rounded-lg bg-neutral-950 px-4 py-3 text-sm font-black text-white shadow-2xl">
          Datos copiados
        </div>
      ) : null}
    </div>
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
  sessionChecking: boolean;
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
    if (props.sessionChecking) {
      return (
        <section id="admin" className="border-y border-neutral-200 bg-white px-4 py-10 sm:px-6">
          <div className="mx-auto max-w-sm rounded-lg border border-neutral-200 bg-[#f7f4ef] p-5 text-center">
            <div className="mx-auto mb-3 grid size-11 place-items-center rounded-lg bg-neutral-950 text-white">
              <ShieldCheck size={20} />
            </div>
            <p className="text-lg font-black">Verificando sesión</p>
            <p className="mt-1 text-sm font-semibold text-neutral-600">Un momento mientras abrimos el panel.</p>
          </div>
        </section>
      );
    }
    return (
      <section id="admin" className="border-y border-neutral-200 bg-white px-4 py-10 sm:px-6">
        <form onSubmit={submitLogin} className="mx-auto max-w-sm rounded-lg border border-neutral-200 bg-[#f7f4ef] p-5">
          <h2 className="mb-4 flex items-center gap-2 text-2xl font-black">
            <LogIn size={22} />
            Administración
          </h2>
          <Input label="Usuario" name="username" autoComplete="username" value={login.username} onChange={(value) => setLogin({ ...login, username: value })} />
          <div className="mt-3">
            <Input label="Contraseña" name="current-password" autoComplete="current-password" type="password" value={login.password} onChange={(value) => setLogin({ ...login, password: value })} />
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
            <SegmentButton active={props.adminView === "coupons"} onClick={() => props.setAdminView("coupons")}>Cupones</SegmentButton>
            <SegmentButton active={props.adminView === "settings"} onClick={() => props.setAdminView("settings")}>Ajustes</SegmentButton>
            <SegmentButton active={props.adminView === "emails"} onClick={() => props.setAdminView("emails")}>Correos</SegmentButton>
            <SegmentButton active={props.adminView === "seo"} onClick={() => props.setAdminView("seo")}>SEO</SegmentButton>
            <SegmentButton active={props.adminView === "faqs"} onClick={() => props.setAdminView("faqs")}>FAQ</SegmentButton>
            <SegmentButton active={false} disabled onClick={() => undefined}>Visitas (Beta)</SegmentButton>
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
            products={props.products}
          />
        ) : props.adminView === "zones" ? (
          <ZonesAdmin zones={props.deliveryZones} setZones={props.setDeliveryZones} />
        ) : props.adminView === "coupons" ? (
          <CouponsAdmin settings={props.settings} onSaveSettings={props.onSaveSettings} syncStatus={props.syncStatus} />
        ) : props.adminView === "faqs" ? (
          <FaqAdmin settings={props.settings} onSaveSettings={props.onSaveSettings} />
        ) : props.adminView === "emails" ? (
          <EmailAdmin settings={props.settings} onSaveSettings={props.onSaveSettings} syncStatus={props.syncStatus} />
        ) : props.adminView === "settings" ? (
          <SettingsAdmin
            key={`${props.settings.businessName}-${props.settings.maintenanceMode}-${props.settings.deliveryEnabled}-${props.settings.attendanceStatusEnabled}-${props.settings.isAttending}-${props.settings.attendanceScheduleEnabled}-${props.settings.minimumOrderAmount}`}
            settings={props.settings}
            products={props.products}
            orders={props.orders}
            onSaveSettings={props.onSaveSettings}
            syncStatus={props.syncStatus}
          />
        ) : props.adminView === "seo" ? (
          <SeoAdmin
            settings={props.settings}
            onSaveSettings={props.onSaveSettings}
            syncStatus={props.syncStatus}
          />
        ) : (
          <AnalyticsAdmin />
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
  const orderYears = useMemo(() => {
    const years = new Set<number>([new Date().getFullYear()]);
    orders.forEach((order) => {
      const year = new Date(order.createdAt).getFullYear();
      if (!Number.isNaN(year)) years.add(year);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [orders]);

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
              {dateMode === "year" ? (
                <select
                  value={dateFilter}
                  onChange={(event) => setDateFilter(event.target.value)}
                  className="h-11 rounded-lg border border-neutral-300 bg-white px-3 font-medium"
                >
                  <option value="">Todos los años</option>
                  {orderYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={dateMode === "month" ? "month" : "date"}
                  value={dateFilter}
                  onChange={(event) => setDateFilter(event.target.value)}
                  className="h-11 rounded-lg border border-neutral-300 bg-white px-3 font-medium"
                />
              )}
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
                {order.priceAdjustmentActive ? (
                  <p className="rounded-md bg-amber-100 px-2 py-1 font-black text-amber-900">
                    Compra realizada con recargo temporal activo: +{order.priceAdjustmentPercent}%
                  </p>
                ) : null}
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
                {order.priceAdjustmentActive ? (
                  <p className="flex justify-between gap-3 text-amber-800"><span>Recargo aplicado</span><strong>+{order.priceAdjustmentPercent}%</strong></p>
                ) : null}
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
  const [saveStatus, setSaveStatus] = useState<"idle" | "syncing" | "saved" | "error">("idle");
  function moveFaq(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= items.length) return;
    const nextItems = [...items];
    [nextItems[index], nextItems[nextIndex]] = [nextItems[nextIndex], nextItems[index]];
    setItems(nextItems);
  }

  async function saveFaqs() {
    setSaveStatus("syncing");
    try {
      await onSaveSettings({ ...settings, faqs: items });
      setSaveStatus("saved");
      window.setTimeout(() => setSaveStatus("idle"), 1800);
    } catch {
      setSaveStatus("error");
      window.setTimeout(() => setSaveStatus("idle"), 3500);
    }
  }

  return (
    <div className="grid gap-4 rounded-lg border border-neutral-200 bg-[#f7f4ef] p-4">
      <div className="flex flex-col gap-3 rounded-lg bg-neutral-950 p-4 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-extrabold text-red-300">Contenido del sitio</p>
          <h3 className="mt-1 text-xl font-black">Preguntas frecuentes</h3>
          <p className="mt-1 text-sm font-semibold text-neutral-300">Edita las dudas que verán los clientes antes de comprar.</p>
        </div>
        <div className="grid gap-2 sm:min-w-64">
          <button
            type="button"
            onClick={() => setItems([...items, { id: crypto.randomUUID(), question: "Nueva pregunta", answer: "Nueva respuesta" }])}
            className="action-button flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-black text-neutral-950"
          >
            <Plus size={18} />
            Agregar pregunta
          </button>
          <FaqSaveButton saveStatus={saveStatus} onSave={saveFaqs} variant="light" />
        </div>
      </div>
      {items.map((faq, index) => (
        <div key={faq.id} className="grid gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 border-b border-neutral-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-red-50 text-sm font-black text-red-700">
                {index + 1}
              </span>
              <p className="text-sm font-black text-neutral-600">Pregunta frecuente</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:w-28">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => moveFaq(index, -1)}
                className="action-button grid h-9 place-items-center rounded-lg border border-neutral-300 bg-white text-neutral-700 disabled:cursor-not-allowed disabled:opacity-35"
                title="Subir"
              >
                <ArrowUp size={17} />
              </button>
              <button
                type="button"
                disabled={index === items.length - 1}
                onClick={() => moveFaq(index, 1)}
                className="action-button grid h-9 place-items-center rounded-lg border border-neutral-300 bg-white text-neutral-700 disabled:cursor-not-allowed disabled:opacity-35"
                title="Bajar"
              >
                <ArrowDown size={17} />
              </button>
            </div>
          </div>
          <Input label="Pregunta" value={faq.question} onChange={(question) => setItems(items.map((item) => item.id === faq.id ? { ...item, question } : item))} />
          <Textarea label="Respuesta" value={faq.answer} onChange={(answer) => setItems(items.map((item) => item.id === faq.id ? { ...item, answer } : item))} />
          <button type="button" onClick={() => setItems(items.filter((item) => item.id !== faq.id))} className="action-button h-10 rounded-lg bg-red-50 text-sm font-black text-red-700">Eliminar</button>
        </div>
      ))}
      <FaqSaveButton saveStatus={saveStatus} onSave={saveFaqs} />
    </div>
  );
}

function FaqSaveButton({
  saveStatus,
  onSave,
  variant = "dark",
}: {
  saveStatus: "idle" | "syncing" | "saved" | "error";
  onSave: () => Promise<void>;
  variant?: "dark" | "light";
}) {
  const toneClass =
    saveStatus === "saved"
      ? "bg-green-600 text-white"
      : saveStatus === "error"
        ? "bg-red-700 text-white"
        : variant === "light"
          ? "bg-white text-neutral-950"
          : "bg-neutral-950 text-white";
  return (
    <button
      type="button"
      disabled={saveStatus === "syncing"}
      onClick={() => void onSave()}
      className={`action-button flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-black disabled:cursor-wait ${toneClass}`}
    >
      {saveStatus === "saved" ? <Check size={18} /> : <Save size={18} />}
      {saveStatus === "syncing"
        ? "Guardando..."
        : saveStatus === "saved"
          ? "Preguntas guardadas"
          : saveStatus === "error"
            ? "Reintentar guardado"
            : "Guardar preguntas frecuentes"}
    </button>
  );
}

function AnalyticsAdmin() {
  const [range, setRange] = useState<AnalyticsRange>("day");
  const [date, setDate] = useState(() => defaultAnalyticsDate("day"));
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const maxBucket = Math.max(1, ...(summary?.buckets.map((bucket) => bucket.value) || [1]));
  const difference = summary ? summary.total - summary.previousTotal : 0;

  useEffect(() => {
    async function loadAnalytics() {
      setLoading(true);
      try {
        const response = await fetch(`/api/analytics?range=${range}&date=${encodeURIComponent(date)}`);
        if (!response.ok) return;
        const data = (await response.json()) as { summary: AnalyticsSummary };
        setSummary(data.summary);
      } finally {
        setLoading(false);
      }
    }
    void loadAnalytics();
  }, [range, date]);

  return (
    <section className="grid gap-4">
      <div className="rounded-lg border border-neutral-200 bg-[#f7f4ef] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-2xl font-black">Visitas</h3>
            <p className="mt-1 text-sm font-semibold text-neutral-600">Conteo simple por sesion para mirar movimiento de la pagina.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["day", "month", "year"] as const).map((value) => (
              <SegmentButton key={value} active={range === value} onClick={() => {
                setRange(value);
                setDate(defaultAnalyticsDate(value));
              }}>
                {value === "day" ? "Dia" : value === "month" ? "Mes" : "Ano"}
              </SegmentButton>
            ))}
            <input
              type={range === "day" ? "date" : range === "month" ? "month" : "number"}
              value={date}
              min={range === "year" ? "2024" : undefined}
              max={range === "year" ? "2099" : undefined}
              onChange={(event) => setDate(event.target.value)}
              className="h-10 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-black"
            />
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <AnalyticsCard label="Visitas" value={loading ? "..." : String(summary?.total || 0)} />
        <AnalyticsCard label="Periodo anterior" value={loading ? "..." : String(summary?.previousTotal || 0)} />
        <AnalyticsCard
          label="Hora peak"
          value={loading ? "..." : summary?.peakHour || "Sin datos"}
          note={difference === 0 ? "Sin variacion" : `${difference > 0 ? "+" : ""}${difference} vs anterior`}
        />
      </div>
      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <h4 className="mb-4 text-lg font-black">Detalle</h4>
        <div className="grid gap-2">
          {(summary?.buckets || []).map((bucket) => (
            <div key={bucket.label} className="grid grid-cols-[58px_minmax(0,1fr)_48px] items-center gap-3 text-sm">
              <span className="font-black text-neutral-600">{bucket.label}</span>
              <div className="h-3 overflow-hidden rounded-full bg-neutral-100">
                <div className="h-full rounded-full bg-red-600" style={{ width: `${Math.max(4, (bucket.value / maxBucket) * 100)}%` }} />
              </div>
              <span className="text-right font-black">{bucket.value}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function defaultAnalyticsDate(range: AnalyticsRange) {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  if (range === "year") return String(year);
  if (range === "month") return `${year}-${month}`;
  return `${year}-${month}-${day}`;
}

function AnalyticsCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-neutral-500">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
      {note ? <p className="mt-1 text-sm font-bold text-red-700">{note}</p> : null}
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

function CouponsAdmin({
  settings,
  onSaveSettings,
  syncStatus,
}: {
  settings: SiteSettings;
  onSaveSettings: (settings: SiteSettings) => Promise<void>;
  syncStatus: "idle" | "syncing" | "saved" | "error";
}) {
  const [draft, setDraft] = useState<Coupon>({
    id: "",
    code: "",
    type: "percentage",
    value: 10,
    active: true,
    minimumSubtotal: 0,
    description: "",
  });
  const coupons = settings.coupons || [];

  function saveCoupons(nextCoupons: Coupon[]) {
    void onSaveSettings({ ...settings, coupons: nextCoupons });
  }

  function addCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = normalizeText(draft.code).toUpperCase();
    if (!code) return;
    if (coupons.some((coupon) => normalizeText(coupon.code).toUpperCase() === code)) {
      window.alert("Ya existe un cupón con ese código.");
      return;
    }
    if (draft.value <= 0) {
      window.alert("El descuento debe ser mayor a 0.");
      return;
    }
    if (draft.type === "percentage" && draft.value > 90) {
      window.alert("El porcentaje máximo permitido es 90%.");
      return;
    }
    saveCoupons([{ ...draft, id: crypto.randomUUID(), code }, ...coupons]);
    setDraft({ id: "", code: "", type: "percentage", value: 10, active: true, minimumSubtotal: 0, description: "" });
  }

  function updateCoupon(coupon: Coupon, nextCoupon: Coupon) {
    const nextCode = normalizeText(nextCoupon.code).toUpperCase();
    if (!nextCode || nextCoupon.value <= 0) return;
    if (nextCoupon.type === "percentage" && nextCoupon.value > 90) return;
    const duplicate = coupons.some((item) => item.id !== coupon.id && normalizeText(item.code).toUpperCase() === nextCode);
    if (duplicate) {
      window.alert("Ya existe otro cupón con ese código.");
      return;
    }
    saveCoupons(coupons.map((item) => item.id === coupon.id ? { ...nextCoupon, code: nextCode } : item));
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <form onSubmit={addCoupon} className="rounded-lg border border-neutral-200 bg-[#f7f4ef] p-4">
        <h3 className="mb-4 text-xl font-black">Nuevo cupón</h3>
        <div className="grid gap-3">
          <Input label="Código" value={draft.code} onChange={(value) => setDraft({ ...draft, code: value.toUpperCase() })} placeholder="Ej: FONO10" />
          <label className="grid gap-1 text-sm font-bold">
            Tipo de descuento
            <select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as Coupon["type"] })} className="h-10 rounded-md border border-neutral-300 bg-white px-2 text-sm font-medium">
              <option value="percentage">Porcentaje</option>
              <option value="fixed">Monto fijo</option>
            </select>
          </label>
          <AffixNumberInput label={draft.type === "percentage" ? "Porcentaje" : "Monto"} affix={draft.type === "percentage" ? "%" : "$"} affixPosition={draft.type === "percentage" ? "right" : "left"} value={String(draft.value || "")} onChange={(value) => setDraft({ ...draft, value: Number(value) })} />
          <Input label="Subtotal mínimo para usarlo" type="number" value={String(draft.minimumSubtotal || "")} onChange={(value) => setDraft({ ...draft, minimumSubtotal: Number(value) })} />
          <Textarea label="Descripción interna" value={draft.description} onChange={(value) => setDraft({ ...draft, description: value })} />
          <button className="action-button h-11 rounded-lg bg-neutral-950 text-sm font-black text-white">
            Crear cupón
          </button>
        </div>
      </form>
      <div className="grid content-start gap-3">
        <div className="rounded-lg border border-neutral-200 bg-[#f7f4ef] p-4">
          <h3 className="text-xl font-black">Cupones</h3>
          <p className="text-sm font-semibold text-neutral-600">El descuento nunca dejará el total en $0 ni bajo el monto mínimo configurado.</p>
          <div className="mt-3">
            <SaveSettingsButton
              syncStatus={syncStatus}
              label="Actualizar cupones"
              savedLabel="Cupones actualizados"
              onClick={() => void onSaveSettings({ ...settings, coupons })}
            />
          </div>
        </div>
        {coupons.length ? coupons.map((coupon) => (
          <div key={coupon.id} className="grid gap-3 rounded-lg border border-neutral-200 bg-white p-3 md:grid-cols-[1fr_150px_120px_150px_110px_auto] md:items-end">
            <Input label="Código" value={coupon.code} onChange={(value) => updateCoupon(coupon, { ...coupon, code: value })} />
            <label className="grid gap-1 text-sm font-bold">
              Tipo
              <select value={coupon.type} onChange={(event) => updateCoupon(coupon, { ...coupon, type: event.target.value as Coupon["type"] })} className="h-10 rounded-md border border-neutral-300 bg-white px-2 text-sm font-medium">
                <option value="percentage">Porcentaje</option>
                <option value="fixed">Monto</option>
              </select>
            </label>
            <AffixNumberInput label="Valor" affix={coupon.type === "percentage" ? "%" : "$"} affixPosition={coupon.type === "percentage" ? "right" : "left"} value={String(coupon.value)} onChange={(value) => updateCoupon(coupon, { ...coupon, value: Number(value) })} />
            <Input label="Subtotal mín." type="number" value={String(coupon.minimumSubtotal || "")} onChange={(value) => updateCoupon(coupon, { ...coupon, minimumSubtotal: Number(value) })} />
            <button
              type="button"
              onClick={() => updateCoupon(coupon, { ...coupon, active: !coupon.active })}
              className={`action-button h-10 rounded-lg text-sm font-black ${coupon.active ? "bg-green-600 text-white" : "bg-neutral-200 text-neutral-700"}`}
            >
              {coupon.active ? "Activo" : "Pausado"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`¿Eliminar el cupón ${coupon.code}?`)) saveCoupons(coupons.filter((item) => item.id !== coupon.id));
              }}
              className="action-button grid size-10 place-items-center rounded-lg bg-red-50 text-red-700"
              title="Eliminar"
            >
              <Trash2 size={18} />
            </button>
          </div>
        )) : (
          <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center text-sm font-bold text-neutral-500">
            Aún no hay cupones creados.
          </div>
        )}
      </div>
    </section>
  );
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
  const [productView, setProductView] = useState("__latest");
  const [adminProductQuery, setAdminProductQuery] = useState("");
  const [currentAdminProductPage, setCurrentAdminProductPage] = useState(1);
  const [imageMode, setImageMode] = useState<"upload" | "url">("upload");
  const [showDraftSecondaryCategory, setShowDraftSecondaryCategory] = useState(Boolean(props.draft.secondaryCategory));
  const [optimizeStatus, setOptimizeStatus] = useState("");
  const [optimizingImages, setOptimizingImages] = useState(false);
  const categoryIds = useMemo(() => new Set(props.categories.map((category) => category.id)), [props.categories]);
  const uncategorizedProducts = props.products.filter((product) => !productHasKnownCategory(product, categoryIds));
  const featuredAdminProducts = props.products.filter((product) => product.featured);
  const availableAdminProducts = props.products.filter((product) => product.stock === "available");
  const lowStockAdminProducts = props.products.filter((product) => product.stock === "low");
  const soldOutAdminProducts = props.products.filter((product) => product.stock === "sold_out");
  const hiddenAdminProducts = props.products.filter((product) => product.stock === "hidden");
  const orderableProductsInView =
    !productView.startsWith("__") && productView !== "__latest" && productView !== "__uncategorized" && productView !== "__featured"
      ? sortCatalogProducts(props.products.filter((product) => productBelongsToCategory(product, productView) && product.stock !== "hidden" && product.stock !== "sold_out"), "manual", props.settings.productOrder, productView)
      : [];
  const baseAdminProducts =
    productView === "__latest"
      ? props.products.slice(0, 5)
      : productView === "__featured"
        ? featuredAdminProducts
      : productView === "__available"
        ? availableAdminProducts
      : productView === "__low"
        ? lowStockAdminProducts
      : productView === "__sold_out"
        ? soldOutAdminProducts
      : productView === "__hidden"
        ? hiddenAdminProducts
      : productView === "__uncategorized"
        ? uncategorizedProducts
        : sortCatalogProducts(props.products.filter((product) => productBelongsToCategory(product, productView)), "manual", props.settings.productOrder, productView);
  const cleanAdminProductQuery = normalizeText(adminProductQuery);
  const visibleAdminProducts = cleanAdminProductQuery
    ? props.products.filter((product) =>
        normalizeText(`${product.name} ${product.volume} ${product.category} ${product.secondaryCategory ?? ""}`).includes(cleanAdminProductQuery),
      )
    : baseAdminProducts;
  const totalAdminProductPages = Math.max(1, Math.ceil(visibleAdminProducts.length / productsPerAdminPage));
  const safeAdminProductPage = Math.min(currentAdminProductPage, totalAdminProductPages);
  const paginatedAdminProducts = visibleAdminProducts.slice(
    (safeAdminProductPage - 1) * productsPerAdminPage,
    safeAdminProductPage * productsPerAdminPage,
  );

  function updateAdminProductQuery(value: string) {
    setAdminProductQuery(value);
    setCurrentAdminProductPage(1);
  }

  function updateProductView(value: string) {
    setProductView(value);
    setCurrentAdminProductPage(1);
  }

  async function moveProductInCategory(productId: string, direction: -1 | 1) {
    if (productView.startsWith("__")) return;
    const ids = orderableProductsInView.map((product) => product.id);
    const index = ids.indexOf(productId);
    const nextIndex = index + direction;
    if (index === -1 || nextIndex < 0 || nextIndex >= ids.length) return;
    const nextIds = [...ids];
    [nextIds[index], nextIds[nextIndex]] = [nextIds[nextIndex], nextIds[index]];
    await props.onSaveSettings({
      ...props.settings,
      productOrder: {
        ...props.settings.productOrder,
        [productView]: nextIds,
      },
    });
  }

  async function optimizeCurrentImages() {
    if (!props.products.length || optimizingImages) return;
    if (!window.confirm("Optimizar las imagenes actuales puede tardar un poco. ¿Continuar?")) return;
    setOptimizingImages(true);
    setOptimizeStatus("Procesando imagenes...");
    let optimized = 0;
    let failed = 0;
    for (const product of props.products) {
      try {
        const imageUrl = await resizeImageSource(product.imageUrl);
        const nextProduct = { ...product, imageUrl };
        props.updateProduct(product.id, () => nextProduct);
        await props.onSaveProduct(nextProduct);
        optimized += 1;
      } catch {
        failed += 1;
      }
      setOptimizeStatus(`Procesadas ${optimized + failed}/${props.products.length}`);
    }
    setOptimizeStatus(
      failed
        ? `Listo: ${optimized} imagenes optimizadas. ${failed} no se pudieron procesar por permisos o URL invalida.`
        : `Listo: ${optimized} imagenes optimizadas.`,
    );
    setOptimizingImages(false);
  }

  return (
    <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="grid min-w-0 content-start gap-4">
        <form onSubmit={props.onSubmit} className="min-w-0 overflow-hidden rounded-lg border border-neutral-200 bg-[#f7f4ef] p-4">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-black">
            <Plus size={18} />
            Nuevo producto
          </h3>
          <div className="grid gap-3">
            <Input label="Nombre" value={props.draft.name} onChange={(value) => props.setDraft({ ...props.draft, name: value })} />
            <Input label="Precio normal" type="number" value={String(props.draft.price || "")} onChange={(value) => props.setDraft({ ...props.draft, price: Number(value), originalPrice: Number(value) > 0 ? props.draft.originalPrice : null })} />
            <Input
              label="Precio original (opcional)"
              type="number"
              value={props.draft.originalPrice ? String(props.draft.originalPrice) : ""}
              disabled={!props.draft.price}
              onChange={(value) => props.setDraft({ ...props.draft, originalPrice: props.draft.price && value ? Number(value) : null })}
            />
            <SelectCategory label="Categoría principal" categories={props.categories} value={props.draft.category} onChange={(category) => props.setDraft({ ...props.draft, category, beerFormat: category === "cervezas" || props.draft.secondaryCategory === "cervezas" ? props.draft.beerFormat : null })} />
            <label className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-bold">
              <input
                type="checkbox"
                checked={showDraftSecondaryCategory}
                onChange={(event) => {
                  setShowDraftSecondaryCategory(event.target.checked);
                  if (!event.target.checked) props.setDraft({ ...props.draft, secondaryCategory: null, beerFormat: props.draft.category === "cervezas" ? props.draft.beerFormat : null });
                }}
              />
              Agregar segunda categoría
            </label>
            {showDraftSecondaryCategory ? (
              <SelectCategory
                label="Segunda categoría (opcional)"
                categories={props.categories.filter((category) => category.id !== props.draft.category)}
                value={props.draft.secondaryCategory || ""}
                allowEmpty
                onChange={(secondaryCategory) => props.setDraft({ ...props.draft, secondaryCategory: secondaryCategory || null, beerFormat: props.draft.category === "cervezas" || secondaryCategory === "cervezas" ? props.draft.beerFormat : null })}
              />
            ) : null}
            {(props.draft.category === "cervezas" || props.draft.secondaryCategory === "cervezas") ? <SelectBeerFormat value={props.draft.beerFormat || ""} onChange={(beerFormat) => props.setDraft({ ...props.draft, beerFormat: beerFormat || null })} required /> : null}
            <Input label="Volumen" placeholder="Ej: 750ml, 1L, 40°" value={props.draft.volume} onChange={(value) => props.setDraft({ ...props.draft, volume: value })} />
            <label className="grid gap-1 text-xs font-black uppercase text-neutral-500">
              Estado del producto
              <StockSelect
                value={props.draft.stock || "available"}
                onChange={(stock) => props.setDraft({ ...props.draft, stock })}
              />
            </label>
            <div className="grid gap-2">
              <span className="text-sm font-bold">Imagen del producto</span>
              <div className="grid min-w-0 grid-cols-2 gap-2">
                <SegmentButton active={imageMode === "upload"} onClick={() => setImageMode("upload")}>Subir imagen</SegmentButton>
                <SegmentButton active={imageMode === "url"} onClick={() => setImageMode("url")}>Foto URL</SegmentButton>
              </div>
              {imageMode === "upload" ? (
                <ImagePicker label="Subir imagen" onImage={(imageUrl) => props.setDraft({ ...props.draft, imageUrl })} />
              ) : (
                <Input label="Foto URL" value={props.draft.imageUrl} onChange={(value) => props.setDraft({ ...props.draft, imageUrl: value })} />
              )}
            </div>
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
      <div className="grid content-start gap-4">
        <ProductPriceAdjustmentAdmin
          key={`${props.settings.productPriceAdjustment.enabled}-${props.settings.productPriceAdjustment.percentage}-${props.settings.productPriceAdjustment.scheduleEnabled}-${props.settings.productPriceAdjustment.startDate}-${props.settings.productPriceAdjustment.endDate}-${props.settings.productPriceAdjustment.startTime}-${props.settings.productPriceAdjustment.endTime}`}
          settings={props.settings}
          syncStatus={props.syncStatus}
          onSaveSettings={props.onSaveSettings}
        />
        <div className="min-w-0 overflow-hidden rounded-lg border border-neutral-200 bg-[#f7f4ef] p-4">
          <div className="mb-3">
            <h3 className="text-lg font-black">Productos subidos</h3>
            <p className="text-sm font-semibold text-neutral-600">Edita por categoría o revisa los últimos productos agregados.</p>
          </div>
          <div className="mb-3 rounded-lg border border-neutral-200 bg-white p-3">
            <button
              type="button"
              disabled={optimizingImages || !props.products.length}
              onClick={() => void optimizeCurrentImages()}
              className="action-button flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-neutral-950 px-3 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Upload size={17} />
              {optimizingImages ? "Optimizando imagenes..." : "Optimizar imagenes actuales"}
            </button>
            {optimizeStatus ? <p className="mt-2 text-xs font-bold text-neutral-600">{optimizeStatus}</p> : null}
          </div>
          <label className="mb-3 block">
            <span className="sr-only">Buscar producto subido</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
              <input
                value={adminProductQuery}
                onChange={(event) => updateAdminProductQuery(event.target.value)}
                placeholder="Buscar producto subido"
                className="h-11 w-full rounded-lg border border-neutral-300 bg-white pl-10 pr-3 text-sm font-bold"
              />
            </div>
          </label>
          <div className="mb-3">
            <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-neutral-500">Vistas rápidas</p>
            <div className="flex max-w-full gap-2 overflow-x-auto pb-2">
            <CatalogFilterButton active={productView === "__latest"} onClick={() => updateProductView("__latest")}>
              Últimos 5
            </CatalogFilterButton>
            <CatalogFilterButton active={productView === "__featured"} onClick={() => updateProductView("__featured")}>
              Destacados ({featuredAdminProducts.length})
            </CatalogFilterButton>
            <CatalogFilterButton active={productView === "__available"} onClick={() => updateProductView("__available")}>
              Activos ({availableAdminProducts.length})
            </CatalogFilterButton>
            <CatalogFilterButton active={productView === "__low"} onClick={() => updateProductView("__low")}>
              Bajo stock ({lowStockAdminProducts.length})
            </CatalogFilterButton>
            <CatalogFilterButton active={productView === "__sold_out"} onClick={() => updateProductView("__sold_out")}>
              Agotados ({soldOutAdminProducts.length})
            </CatalogFilterButton>
            <CatalogFilterButton active={productView === "__hidden"} onClick={() => updateProductView("__hidden")}>
              Ocultos ({hiddenAdminProducts.length})
            </CatalogFilterButton>
            <CatalogFilterButton active={productView === "__uncategorized"} onClick={() => updateProductView("__uncategorized")}>
              Sin categoría ({uncategorizedProducts.length})
            </CatalogFilterButton>
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-neutral-500">Categorías</p>
            <div className="flex max-w-full gap-2 overflow-x-auto pb-2">
            {props.categories.map((category) => (
              <CatalogFilterButton key={category.id} active={productView === category.id} onClick={() => updateProductView(category.id)}>
                {category.label} ({props.products.filter((product) => productBelongsToCategory(product, category.id)).length})
              </CatalogFilterButton>
            ))}
          </div>
        </div>
        <CatalogPagination
          page={safeAdminProductPage}
          totalPages={totalAdminProductPages}
          countLabel={`${visibleAdminProducts.length} productos`}
          onPage={setCurrentAdminProductPage}
        />
        {paginatedAdminProducts.length ? (
          paginatedAdminProducts.map((product) => (
            <ProductAdminCard
              key={product.id}
              product={product}
              products={props.products}
              categories={props.categories}
              categoryIds={categoryIds}
              orderControls={!cleanAdminProductQuery && !productView.startsWith("__") && product.stock !== "hidden" && product.stock !== "sold_out" ? {
                canMoveUp: orderableProductsInView.findIndex((item) => item.id === product.id) > 0,
                canMoveDown: orderableProductsInView.findIndex((item) => item.id === product.id) !== -1 && orderableProductsInView.findIndex((item) => item.id === product.id) < orderableProductsInView.length - 1,
                onMoveUp: () => void moveProductInCategory(product.id, -1),
                onMoveDown: () => void moveProductInCategory(product.id, 1),
              } : undefined}
              updateProduct={props.updateProduct}
              onSaveProduct={props.onSaveProduct}
              onDeleteProduct={props.onDeleteProduct}
            />
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center text-sm font-bold text-neutral-500">
            No hay productos en esta vista.
          </div>
        )}
        <CatalogPagination
          page={safeAdminProductPage}
          totalPages={totalAdminProductPages}
          countLabel={`${visibleAdminProducts.length} productos`}
          onPage={setCurrentAdminProductPage}
          bottom
        />
      </div>
    </div>
  </div>
  );
}

function ProductAdminCard({
  product,
  products,
  categories,
  categoryIds,
  orderControls,
  updateProduct,
  onSaveProduct,
  onDeleteProduct,
}: {
  product: Product;
  products: Product[];
  categories: ProductCategory[];
  categoryIds: Set<string>;
  orderControls?: {
    canMoveUp: boolean;
    canMoveDown: boolean;
    onMoveUp: () => void;
    onMoveDown: () => void;
  };
  updateProduct: (productId: string, updater: (product: Product) => Product) => void;
  onSaveProduct: (product: Product) => Promise<void>;
  onDeleteProduct: (productId: string) => Promise<void>;
}) {
  const [showSecondaryCategory, setShowSecondaryCategory] = useState(Boolean(product.secondaryCategory));
  const hasCategory = productHasKnownCategory(product, categoryIds);
  const selectedCategory = hasCategory ? product.category : "";

  function update(nextProduct: Product) {
    updateProduct(product.id, () => nextProduct);
  }

  function save(nextProduct = product) {
    if (!nextProduct.name.trim()) {
      window.alert("El producto necesita nombre.");
      return;
    }
    if (nextProduct.price <= 0) {
      window.alert("Ingresa un precio normal antes de guardar.");
      return;
    }
    if (hasInvalidOriginalPrice(nextProduct)) {
      window.alert("El precio original debe ser mayor que el precio normal.");
      return;
    }
    if (hasDuplicateProductNameAndVolume(products, nextProduct.name, nextProduct.volume, nextProduct.id)) {
      window.alert("Ya existe otro producto con ese nombre y volumen.");
      return;
    }
    if (!categoryIds.has(nextProduct.category)) {
      window.alert("Asigna una categoría válida antes de guardar.");
      return;
    }
    if (nextProduct.secondaryCategory && nextProduct.secondaryCategory === nextProduct.category) {
      window.alert("La segunda categoría debe ser distinta a la principal.");
      return;
    }
    if ((nextProduct.category === "cervezas" || nextProduct.secondaryCategory === "cervezas") && !nextProduct.beerFormat) {
      window.alert("Selecciona si la cerveza es lata o botella.");
      return;
    }
    const cleanProduct = {
      ...nextProduct,
      originalPrice: nextProduct.price > 0 ? nextProduct.originalPrice || null : null,
      secondaryCategory: nextProduct.secondaryCategory || null,
      beerFormat: nextProduct.category === "cervezas" || nextProduct.secondaryCategory === "cervezas" ? nextProduct.beerFormat : null,
    };
    update(cleanProduct);
    void onSaveProduct(cleanProduct);
  }

  return (
    <div className={`min-w-0 overflow-hidden rounded-lg border bg-white p-3 shadow-sm ${hasCategory ? "border-neutral-200" : "border-red-200 ring-2 ring-red-100"}`}>
      {!hasCategory ? (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-black text-red-800">
          Producto sin categoría: no se muestra al cliente hasta asignarle una categoría.
        </p>
      ) : null}
      {orderControls ? (
        <div className="mb-3 flex flex-col gap-2 rounded-lg bg-neutral-50 p-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-bold text-neutral-600">Orden dentro de la categoría</p>
          <div className="grid grid-cols-2 gap-2 sm:w-24">
            <button type="button" disabled={!orderControls.canMoveUp} onClick={orderControls.onMoveUp} className="action-button grid h-9 place-items-center rounded-lg border border-neutral-300 bg-white disabled:cursor-not-allowed disabled:opacity-35" title="Subir">
              <ArrowUp size={17} />
            </button>
            <button type="button" disabled={!orderControls.canMoveDown} onClick={orderControls.onMoveDown} className="action-button grid h-9 place-items-center rounded-lg border border-neutral-300 bg-white disabled:cursor-not-allowed disabled:opacity-35" title="Bajar">
              <ArrowDown size={17} />
            </button>
          </div>
        </div>
      ) : null}
      <div className="grid min-w-0 gap-3 xl:grid-cols-[96px_minmax(0,1fr)_220px]">
        <img src={product.imageUrl} alt="" className="h-24 w-full rounded-lg object-cover xl:h-full" />
        <div className="grid min-w-0 gap-2">
          <input value={product.name} onChange={(event) => update({ ...product, name: event.target.value })} className="w-full min-w-0 rounded-md border border-neutral-300 px-3 py-2 font-normal" />
          <ImagePicker
            label="Subir imagen"
            onImage={(imageUrl) => {
              const nextProduct = { ...product, imageUrl };
              update(nextProduct);
              void onSaveProduct(nextProduct);
            }}
          />
          <input
            value={product.imageUrl}
            onChange={(event) => update({ ...product, imageUrl: event.target.value })}
            placeholder="Foto URL"
            className="w-full min-w-0 rounded-md border border-neutral-300 px-3 py-2 text-xs font-normal"
          />
        </div>
        <div className="grid gap-2">
          <input
            value={product.price || ""}
            type="number"
            placeholder="Precio normal"
            onChange={(event) => {
              const price = Number(event.target.value);
              update({ ...product, price, originalPrice: price > 0 ? product.originalPrice : null });
            }}
            className="h-10 w-full min-w-0 rounded-md border border-neutral-300 px-2 text-sm font-normal"
          />
          <input
            value={product.originalPrice || ""}
            type="number"
            placeholder="Precio original opcional"
            disabled={!product.price}
            onChange={(event) => update({ ...product, originalPrice: product.price && event.target.value ? Number(event.target.value) : null })}
            className="h-10 w-full min-w-0 rounded-md border border-neutral-300 px-2 text-sm font-normal disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500"
          />
          <SelectCategory
            label="Categoría principal"
            categories={categories}
            value={selectedCategory}
            allowEmpty
            onChange={(category) => update({ ...product, category, secondaryCategory: product.secondaryCategory === category ? null : product.secondaryCategory, beerFormat: category === "cervezas" || product.secondaryCategory === "cervezas" ? product.beerFormat || null : null })}
          />
          <label className="flex items-center gap-2 rounded-md bg-neutral-50 px-2 py-2 text-xs font-black uppercase text-neutral-500">
            <input
              type="checkbox"
              checked={showSecondaryCategory}
              onChange={(event) => {
                setShowSecondaryCategory(event.target.checked);
                if (!event.target.checked) update({ ...product, secondaryCategory: null, beerFormat: product.category === "cervezas" ? product.beerFormat : null });
              }}
            />
            Segunda categoría
          </label>
          {showSecondaryCategory ? (
            <SelectCategory
              label="Segunda categoría"
              categories={categories.filter((category) => category.id !== product.category)}
              value={product.secondaryCategory || ""}
              allowEmpty
              onChange={(secondaryCategory) => update({ ...product, secondaryCategory: secondaryCategory || null, beerFormat: product.category === "cervezas" || secondaryCategory === "cervezas" ? product.beerFormat || null : null })}
            />
          ) : null}
          {(product.category === "cervezas" || product.secondaryCategory === "cervezas") ? (
            <SelectBeerFormat value={product.beerFormat || ""} onChange={(beerFormat) => update({ ...product, beerFormat: beerFormat || null })} required />
          ) : null}
          <input
            value={product.volume}
            placeholder="Volumen: 750ml, 1L, 40°"
            onChange={(event) => update({ ...product, volume: event.target.value })}
            className="h-10 w-full min-w-0 rounded-md border border-neutral-300 px-2 text-sm font-normal"
          />
          <label className="grid gap-1 text-xs font-black uppercase text-neutral-500">
            Estado del producto
            <StockSelect
              value={product.stock}
              onChange={(stock) => {
                const nextProduct = { ...product, stock };
                update(nextProduct);
                void onSaveProduct(nextProduct);
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              const featuredCount = products.filter((item) => item.featured && item.id !== product.id).length;
              if (!product.featured && featuredCount >= 2) {
                window.alert("Sólo puedes tener dos productos destacados. Quita uno antes de agregar otro.");
                return;
              }
              const nextProduct = { ...product, featured: !product.featured };
              update(nextProduct);
              void onSaveProduct(nextProduct);
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
            onClick={() => save()}
            className="action-button flex h-10 items-center justify-center gap-2 rounded-md bg-neutral-950 text-sm font-black text-white"
          >
            <Save size={17} />
            Guardar cambios
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => {
              const stock = product.stock === "hidden" ? "available" : "hidden";
              const nextProduct = { ...product, stock: stock as Product["stock"] };
              update(nextProduct);
              void onSaveProduct(nextProduct);
            }} className="grid h-10 place-items-center rounded-md border border-neutral-300" title={product.stock === "hidden" ? "Mostrar" : "Ocultar"}>
              {product.stock === "hidden" ? <Eye size={17} /> : <EyeOff size={17} />}
            </button>
            <button type="button" onClick={() => void onDeleteProduct(product.id)} className="grid h-10 place-items-center rounded-md bg-red-50 text-red-700" title="Eliminar">
              <Trash2 size={17} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CatalogFilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`action-button h-10 shrink-0 rounded-lg px-3 text-sm font-black ${active ? "bg-neutral-950 text-white" : "border border-neutral-300 bg-white text-neutral-700"}`}
    >
      {children}
    </button>
  );
}

function StockSelect({ value, onChange }: { value: Product["stock"]; onChange: (value: Product["stock"]) => void }) {
  const styles: Record<Product["stock"], string> = {
    available: "border-green-200 bg-green-50 text-green-800",
    low: "border-amber-200 bg-amber-50 text-amber-900",
    sold_out: "border-red-200 bg-red-50 text-red-800",
    hidden: "border-neutral-300 bg-neutral-100 text-neutral-700",
  };
  return (
    <select value={value} onChange={(event) => onChange(event.target.value as Product["stock"])} className={`h-10 rounded-md border px-2 text-sm font-black ${styles[value]}`}>
      <option value="available">Activo</option>
      <option value="low">Bajo stock</option>
      <option value="sold_out">Agotado</option>
      <option value="hidden">Oculto</option>
    </select>
  );
}

function ProductPriceAdjustmentAdmin({
  settings,
  onSaveSettings,
  syncStatus,
}: {
  settings: SiteSettings;
  onSaveSettings: (settings: SiteSettings) => Promise<void>;
  syncStatus: "idle" | "syncing" | "saved" | "error";
}) {
  const [draft, setDraft] = useState(settings.productPriceAdjustment);
  const effective = getEffectivePriceAdjustment({ ...settings, productPriceAdjustment: draft }, new Date());

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.enabled && draft.percentage <= 0) {
      window.alert("Ingresa un porcentaje mayor a 0 para activar el recargo.");
      return;
    }
    if (draft.scheduleEnabled && draft.startDate && draft.endDate && draft.endDate < draft.startDate) {
      window.alert("La fecha de termino no puede ser anterior a la fecha de inicio.");
      return;
    }
    void onSaveSettings({ ...settings, productPriceAdjustment: draft });
  }

  return (
    <form onSubmit={save} className="grid gap-3 rounded-lg border border-neutral-200 bg-[#f7f4ef] p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-black">Recargo temporal de precios</h3>
          <p className="mt-1 text-sm font-semibold text-neutral-600">
            Sube todos los precios del catálogo sin modificar los valores guardados.
          </p>
          {effective.active ? (
            <p className="mt-2 inline-flex rounded-md bg-green-100 px-2 py-1 text-xs font-black text-green-800">
              Activo ahora: +{effective.percentage}%
            </p>
          ) : null}
        </div>
        <SaveSettingsButton syncStatus={syncStatus} label="Guardar recargo" savedLabel="Recargo guardado" />
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <BooleanControl
          label="Función de recargo"
          value={draft.enabled}
          onChange={(enabled) => setDraft({ ...draft, enabled })}
          activeLabel="Activar"
          inactiveLabel="Desactivar"
          activeTone="success"
        />
        {draft.enabled ? (
          <>
            <AffixNumberInput
              label="Porcentaje de recargo"
              value={String(draft.percentage || "")}
              affix="%"
              affixPosition="right"
              onChange={(value) => setDraft({ ...draft, percentage: Math.max(0, Math.min(300, Number(value) || 0)) })}
            />
            <BooleanControl
              label="Programar por fecha y hora"
              value={draft.scheduleEnabled}
              onChange={(scheduleEnabled) => setDraft({ ...draft, scheduleEnabled })}
              activeLabel="Activar"
              inactiveLabel="Manual"
              activeTone="success"
            />
          </>
        ) : null}
      </div>
      {draft.enabled && draft.scheduleEnabled ? (
        <div className="grid gap-3 lg:grid-cols-4">
          <Input label="Fecha inicio" type="date" value={draft.startDate} onChange={(startDate) => setDraft({ ...draft, startDate })} />
          <Input label="Fecha termino" type="date" value={draft.endDate} onChange={(endDate) => setDraft({ ...draft, endDate })} />
          <Input label="Hora inicio" type="time" value={draft.startTime} onChange={(startTime) => setDraft({ ...draft, startTime })} />
          <Input label="Hora termino" type="time" value={draft.endTime} onChange={(endTime) => setDraft({ ...draft, endTime })} />
        </div>
      ) : null}
      {draft.enabled ? (
        <p className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-neutral-600">
          El recargo afecta precio normal y precio original/oferta solo al mostrar y comprar. No cambia la base de datos de productos ni los valores de despacho.
        </p>
      ) : null}
    </form>
  );
}

function CategoriesAdmin({
  categories,
  setCategories,
  products,
}: {
  categories: ProductCategory[];
  setCategories: (categories: ProductCategory[]) => void;
  products: Product[];
}) {
  const [newLabel, setNewLabel] = useState("");
  const [status, setStatus] = useState("");
  const [categoryQuery, setCategoryQuery] = useState("");
  const productCounts = useMemo(
    () => new Map(categories.map((category) => [category.id, products.filter((product) => productBelongsToCategory(product, category.id)).length])),
    [categories, products],
  );
  const filteredCategories = categories.filter((category) => normalizeText(category.label).includes(normalizeText(categoryQuery)));

  function hasDuplicateCategoryName(label: string, currentId?: string) {
    const cleanLabel = normalizeText(label);
    if (!cleanLabel) return false;
    return categories.some((category) => category.id !== currentId && normalizeText(category.label) === cleanLabel);
  }

  function slugify(value: string) {
    return normalizeText(value)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  async function saveCategories(nextCategories: ProductCategory[], successMessage: string) {
    const duplicatedName = nextCategories.some((category, index) =>
      nextCategories.some((otherCategory, otherIndex) => otherIndex !== index && normalizeText(otherCategory.label) === normalizeText(category.label)),
    );
    if (duplicatedName) {
      setStatus("No puedes guardar dos categorías con el mismo nombre.");
      return;
    }
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
    if (categories.some((category) => category.id === id) || hasDuplicateCategoryName(newLabel)) {
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
    if (category.id === "cervezas") {
      setStatus("La categoría Cervezas no se puede eliminar.");
      return;
    }
    const associatedProducts = productCounts.get(category.id) ?? 0;
    if (associatedProducts > 0) {
      setStatus(`La categoría tiene ${associatedProducts} producto${associatedProducts === 1 ? "" : "s"}. Muévelos antes de eliminarla.`);
      return;
    }
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
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
          <input
            value={categoryQuery}
            onChange={(event) => setCategoryQuery(event.target.value)}
            placeholder="Buscar categoría"
            className="h-11 w-full rounded-lg border border-neutral-300 bg-white pl-10 pr-3 text-sm font-bold"
          />
        </label>
        {filteredCategories.map((category) => {
          const index = categories.findIndex((item) => item.id === category.id);
          const duplicateName = hasDuplicateCategoryName(category.label, category.id);
          return (
          <div key={category.id} className="grid gap-3 rounded-lg border border-neutral-200 bg-white p-3 sm:grid-cols-[88px_minmax(0,1fr)_auto] sm:items-center">
            <span className="text-sm font-black text-neutral-400">Orden {index + 1}</span>
            <label className="grid gap-1">
              <input
                value={category.label}
                onChange={(event) =>
                  setCategories(categories.map((item) => item.id === category.id ? { ...item, label: event.target.value } : item))
                }
                className={`h-10 min-w-0 rounded-lg border px-3 font-bold ${duplicateName ? "border-red-400 bg-red-50" : "border-neutral-300 bg-white"}`}
              />
              {duplicateName ? <span className="text-xs font-bold text-red-700">Ya existe una categoría con ese nombre.</span> : null}
            </label>
            <div className="flex gap-2">
              <span className="grid h-10 min-w-20 place-items-center rounded-lg bg-neutral-100 px-3 text-xs font-black text-neutral-600">
                {productCounts.get(category.id) ?? 0} prod.
              </span>
              <button type="button" disabled={index === 0} onClick={() => moveCategory(index, -1)} className="action-button grid size-10 place-items-center rounded-lg border border-neutral-300 disabled:opacity-30" title="Subir">
                <ArrowUp size={17} />
              </button>
              <button type="button" disabled={index === categories.length - 1} onClick={() => moveCategory(index, 1)} className="action-button grid size-10 place-items-center rounded-lg border border-neutral-300 disabled:opacity-30" title="Bajar">
                <ArrowDown size={17} />
              </button>
              <button type="button" disabled={category.id === "cervezas"} onClick={() => void deleteCategory(category)} className="action-button grid size-10 place-items-center rounded-lg bg-red-50 text-red-700 disabled:cursor-not-allowed disabled:opacity-35" title={category.id === "cervezas" ? "Cervezas no se puede eliminar" : "Eliminar"}>
                <Trash2 size={17} />
              </button>
            </div>
          </div>
          );
        })}
        {!filteredCategories.length ? (
          <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 text-center text-sm font-bold text-neutral-500">
            No hay categorías con esa búsqueda.
          </div>
        ) : null}
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

function EmailAdmin({
  settings,
  onSaveSettings,
  syncStatus,
}: {
  settings: SiteSettings;
  onSaveSettings: (settings: SiteSettings) => Promise<void>;
  syncStatus: "idle" | "syncing" | "saved" | "error";
}) {
  const [draft, setDraft] = useState(settings);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSaveSettings(draft);
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-[#f7f4ef] px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-xl font-black">Correos</h3>
          <p className="text-sm font-semibold text-neutral-600">
            Confirmaciones de pedidos, remitentes y marketing por correo.
          </p>
        </div>
        <SaveSettingsButton syncStatus={syncStatus} label="Guardar ajustes" savedLabel="Ajustes guardados" />
      </div>

      <SettingsSection title="Contacto visible" description="Datos que ven los clientes en la tienda y enlaces de contacto." columns={2}>
        <Input
          label="Correo de contacto"
          type="email"
          value={draft.contactEmail}
          onChange={(contactEmail) => {
            const nextEmail = { ...draft.email, fromEmail: contactEmail, ownerEmail: contactEmail, replyToEmail: contactEmail };
            setDraft({ ...draft, contactEmail, email: nextEmail });
          }}
        />
        <Input
          label="Nombre remitente"
          value={draft.email.fromName}
          onChange={(fromName) => setDraft({ ...draft, email: { ...draft.email, fromName } })}
        />
      </SettingsSection>

      <SettingsSection title="Correos de pedidos" description="Confirmaciones al cliente y avisos internos al administrador." columns={3}>
        <BooleanControl
          label="Envío automático de pedidos"
          value={draft.email.transactionalEnabled}
          onChange={(transactionalEnabled) => setDraft({ ...draft, email: { ...draft.email, transactionalEnabled } })}
          activeLabel="Activar"
          inactiveLabel="Desactivar"
          activeTone="success"
        />
        <BooleanControl
          label="Credenciales SMTP configuradas"
          value={draft.email.credentialsConfigured}
          onChange={(credentialsConfigured) => setDraft({ ...draft, email: { ...draft.email, credentialsConfigured } })}
          activeLabel="Listo"
          inactiveLabel="Pendiente"
          activeTone="success"
        />
        <Input
          label="Correo remitente"
          type="email"
          value={draft.email.fromEmail}
          onChange={(fromEmail) => setDraft({ ...draft, email: { ...draft.email, fromEmail } })}
        />
        <Input
          label="Correo administrador"
          type="email"
          value={draft.email.ownerEmail}
          onChange={(ownerEmail) => setDraft({ ...draft, email: { ...draft.email, ownerEmail } })}
        />
        <Input
          label="Responder a"
          type="email"
          value={draft.email.replyToEmail}
          onChange={(replyToEmail) => setDraft({ ...draft, email: { ...draft.email, replyToEmail } })}
        />
        <Input
          label="Servidor SMTP"
          value={draft.email.smtpHost}
          placeholder="smtp.tudominio.cl"
          onChange={(smtpHost) => setDraft({ ...draft, email: { ...draft.email, smtpHost } })}
        />
        <Input
          label="Puerto SMTP"
          value={draft.email.smtpPort}
          inputMode="numeric"
          placeholder="587"
          onChange={(smtpPort) => setDraft({ ...draft, email: { ...draft.email, smtpPort } })}
        />
        <Input
          label="Usuario SMTP"
          value={draft.email.smtpUser}
          placeholder="contacto@fonocopeteconcepcion.cl"
          onChange={(smtpUser) => setDraft({ ...draft, email: { ...draft.email, smtpUser } })}
        />
        <p className="rounded-lg bg-white px-3 py-3 text-sm font-semibold text-neutral-600 xl:col-span-3">
          La clave SMTP se guarda como variable segura en Vercel. No se muestra en el panel para evitar exponer el correo del negocio.
        </p>
      </SettingsSection>

      <SettingsSection title="Marketing por correo (Beta)" description="Configuración para promociones y campañas con Mailchimp." columns={2}>
        <BooleanControl
          label="Newsletter Mailchimp (Beta)"
          value={draft.newsletter.enabled}
          onChange={(enabled) => setDraft({ ...draft, newsletter: { ...draft.newsletter, enabled } })}
          activeLabel="Activar"
          inactiveLabel="Desactivar"
          activeTone="success"
        />
        <Input
          label="URL formulario Mailchimp"
          value={draft.newsletter.formUrl}
          placeholder="https://..."
          onChange={(formUrl) => setDraft({ ...draft, newsletter: { ...draft.newsletter, formUrl } })}
        />
        <Input
          label="Audience ID"
          value={draft.newsletter.audienceId}
          placeholder="Se completa al crear la audiencia"
          onChange={(audienceId) => setDraft({ ...draft, newsletter: { ...draft.newsletter, audienceId } })}
        />
        <Input
          label="Etiquetas por defecto"
          value={draft.newsletter.defaultTags}
          onChange={(defaultTags) => setDraft({ ...draft, newsletter: { ...draft.newsletter, defaultTags } })}
        />
      </SettingsSection>

      <SaveSettingsButton syncStatus={syncStatus} label="Guardar ajustes" savedLabel="Ajustes guardados" />
    </form>
  );
}

function SettingsAdmin({
  settings,
  products,
  orders,
  onSaveSettings,
  syncStatus,
}: {
  settings: SiteSettings;
  products: Product[];
  orders: SavedOrder[];
  onSaveSettings: (settings: SiteSettings) => Promise<void>;
  syncStatus: "idle" | "syncing" | "saved" | "error";
}) {
  const [draft, setDraft] = useState(settings);

  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      void onSaveSettings(draft);
    }} className="grid gap-4">
      <SaveSettingsButton syncStatus={syncStatus} label="Guardar ajustes" savedLabel="Ajustes guardados" />
      <SettingsSection title="Datos generales" description="Información visible y enlaces principales del negocio.">
        <Input label="Nombre del negocio" value={draft.businessName} onChange={(value) => setDraft({ ...draft, businessName: value })} />
        <WhatsAppSettingsInput value={draft.whatsappNumber} onChange={(whatsappNumber) => setDraft({ ...draft, whatsappNumber })} />
        <Input label="Correo de contacto" type="email" value={draft.contactEmail} onChange={(value) => setDraft({ ...draft, contactEmail: value })} />
        <SocialHandleInput label="Instagram" prefix="instagram.com/" domain="instagram.com" value={draft.instagramUrl} onChange={(instagramUrl) => setDraft({ ...draft, instagramUrl })} />
        <SocialHandleInput label="Facebook" prefix="facebook.com/" domain="facebook.com" value={draft.facebookUrl} onChange={(facebookUrl) => setDraft({ ...draft, facebookUrl })} />
        <Input label="Link Mercado Pago" value={draft.mercadoPagoLink} onChange={(value) => setDraft({ ...draft, mercadoPagoLink: value })} />
      </SettingsSection>
      <SettingsSection title="Operación del sitio" description="Activa o pausa funciones principales de la tienda.">
        <BooleanControl
          label="Modo mantenimiento"
          value={draft.maintenanceMode}
          onChange={(maintenanceMode) => setDraft({ ...draft, maintenanceMode })}
          activeLabel="Activar"
          inactiveLabel="Desactivar"
          activeTone="danger"
        />
        <BooleanControl
          label="Aviso de atención en inicio"
          value={draft.attendanceStatusEnabled}
          onChange={(attendanceStatusEnabled) => setDraft({ ...draft, attendanceStatusEnabled })}
          activeLabel="Activar"
          inactiveLabel="Desactivar"
          activeTone="success"
        />
        <BooleanControl
          label="Estado actual de atención"
          value={draft.isAttending}
          onChange={(isAttending) => setDraft({ ...draft, isAttending })}
          activeLabel="Atendiendo"
          inactiveLabel="No atendiendo"
          activeTone="success"
          inactiveTone="danger"
          disabled={!draft.attendanceStatusEnabled || draft.attendanceScheduleEnabled}
        />
        <BooleanControl
          label="Horario automático del letrero"
          value={draft.attendanceScheduleEnabled}
          onChange={(attendanceScheduleEnabled) => setDraft({ ...draft, attendanceScheduleEnabled })}
          activeLabel="Activar"
          inactiveLabel="Manual"
          activeTone="success"
          disabled={!draft.attendanceStatusEnabled}
        />
        {draft.attendanceStatusEnabled && draft.attendanceScheduleEnabled ? (
          <p className="rounded-lg bg-white px-3 py-3 text-sm font-semibold text-neutral-600 lg:col-span-2">
            El estado manual queda desactivado mientras el horario automático esté activo.
          </p>
        ) : null}
        {draft.attendanceStatusEnabled && draft.attendanceScheduleEnabled ? (
          <div className="grid gap-2 rounded-lg border border-neutral-200 bg-white p-3 lg:col-span-2">
            <p className="text-sm font-black">Horario semanal</p>
            <div className="grid gap-2">
              {draft.attendanceSchedule.map((entry) => (
                <AttendanceScheduleRow
                  key={entry.day}
                  entry={entry}
                  onChange={(nextEntry) =>
                    setDraft({
                      ...draft,
                      attendanceSchedule: draft.attendanceSchedule.map((item) => item.day === entry.day ? nextEntry : item),
                    })
                  }
                />
              ))}
            </div>
          </div>
        ) : null}
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
        <Input
          label="Monto minimo de compra"
          type="number"
          value={String(draft.minimumOrderAmount)}
          placeholder="0 desactiva el minimo"
          onChange={(value) => setDraft({ ...draft, minimumOrderAmount: Math.max(0, Math.trunc(Number(value) || 0)) })}
        />
        <p className="rounded-lg bg-white px-3 py-3 text-sm font-semibold text-neutral-600 lg:col-span-2">
          Si activas mantenimiento, los clientes verán una pantalla cerrada y solo quedará disponible el inicio de sesión del administrador.
        </p>
        <p className="rounded-lg bg-white px-3 py-3 text-sm font-semibold text-neutral-600 lg:col-span-2">
          Si desactivas el cálculo de despacho, igualmente se solicitarán dirección, ciudad y zona, pero el costo será $0 y no se mostrará al cliente.
        </p>
      </SettingsSection>
      <SettingsSection title="Mensajes y avisos" description="Configura textos visibles para clientes y mensajes preparados de la tienda.">
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
      </SettingsSection>
      <SettingsSection title="Datos bancarios para transferencia" description="Estos datos se muestran y se copian desde el proceso de pago.">
        <Input label="Banco" value={draft.bankDetails.bank} onChange={(value) => setDraft({ ...draft, bankDetails: { ...draft.bankDetails, bank: value } })} />
        <Input label="Titular" value={draft.bankDetails.accountHolder} onChange={(value) => setDraft({ ...draft, bankDetails: { ...draft.bankDetails, accountHolder: value } })} />
        <Input label="Tipo de cuenta" value={draft.bankDetails.accountType} onChange={(value) => setDraft({ ...draft, bankDetails: { ...draft.bankDetails, accountType: value } })} />
        <Input label="Número de cuenta" value={draft.bankDetails.accountNumber} onChange={(value) => setDraft({ ...draft, bankDetails: { ...draft.bankDetails, accountNumber: value } })} />
        <Input label="RUT" value={draft.bankDetails.rut} onChange={(value) => setDraft({ ...draft, bankDetails: { ...draft.bankDetails, rut: value } })} />
        <Input label="Correo pagos" type="email" value={draft.bankDetails.email} onChange={(value) => setDraft({ ...draft, bankDetails: { ...draft.bankDetails, email: value } })} />
      </SettingsSection>
      <BackupExportPanel products={products} orders={orders} settings={draft} />
      <SaveSettingsButton syncStatus={syncStatus} label="Guardar ajustes" savedLabel="Ajustes guardados" />
    </form>
  );
}

function BackupExportPanel({ products, orders, settings }: { products: Product[]; orders: SavedOrder[]; settings: SiteSettings }) {
  const dateLabel = new Date().toISOString().slice(0, 10);

  function exportProducts() {
    exportCsv(
      `fonocopete-productos-${dateLabel}.csv`,
      ["id", "nombre", "categoria_principal", "segunda_categoria", "precio_normal", "precio_original", "tipo_cerveza", "volumen", "stock", "destacado", "imagen"],
      products.map((product) => [
        product.id,
        product.name,
        product.category,
        product.secondaryCategory || "",
        product.price,
        product.originalPrice || "",
        product.beerFormat || "",
        product.volume,
        product.stock,
        product.featured ? "si" : "no",
        product.imageUrl,
      ]),
    );
  }

  function exportOrders() {
    exportCsv(
      `fonocopete-pedidos-${dateLabel}.csv`,
      [
        "pedido",
        "fecha",
        "cliente",
        "telefono",
        "email",
        "direccion",
        "referencia",
        "zona",
        "subtotal",
        "descuento",
        "cupon",
        "delivery",
        "recargo_activo",
        "recargo_porcentaje",
        "total",
        "metodo_pago",
        "estado_pago",
        "estado_pedido",
        "notas",
        "productos",
      ],
      orders.map((order) => [
        order.orderNumber,
        order.createdAt,
        order.customerName,
        order.customerPhone,
        order.customerEmail,
        order.address,
        order.addressExtra,
        order.zoneName,
        order.subtotal,
        order.discount,
        order.couponCode,
        order.delivery,
        order.priceAdjustmentActive ? "si" : "no",
        order.priceAdjustmentPercent,
        order.total,
        paymentMethodLabel(order.paymentMethod),
        paymentStatusMeta(order.paymentStatus).label,
        fulfillmentStatusMeta(order.fulfillmentStatus).label,
        order.notes,
        order.items.map((item) => `${item.quantity}x ${item.name} (${formatCurrency(item.lineTotal)})`).join(" | "),
      ]),
    );
  }

  function exportSettings() {
    exportCsv(
      `fonocopete-ajustes-${dateLabel}.csv`,
      ["campo", "valor"],
      flattenRecord(settings).map(([key, value]) => [key, value]),
    );
  }

  function exportFullBackup() {
    downloadTextFile(
      `fonocopete-backup-completo-${dateLabel}.json`,
      JSON.stringify({ exportedAt: new Date().toISOString(), products, orders, settings }, null, 2),
      "application/json;charset=utf-8",
    );
  }

  return (
    <SettingsSection title="Backup y exportacion" description="Descarga respaldos compatibles con Excel para revisar o guardar fuera del sistema.">
      <ExportButton label={`Productos (${products.length})`} onClick={exportProducts} />
      <ExportButton label={`Pedidos (${orders.length})`} onClick={exportOrders} />
      <ExportButton label="Ajustes CSV" onClick={exportSettings} />
      <ExportButton label="Backup completo JSON" onClick={exportFullBackup} />
    </SettingsSection>
  );
}

function ExportButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="action-button flex h-11 items-center justify-center gap-2 rounded-lg bg-neutral-950 px-3 text-sm font-black text-white hover:bg-red-600"
    >
      <Download size={17} />
      {label}
    </button>
  );
}

function SettingsSection({
  title,
  description,
  children,
  columns = 2,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  columns?: 1 | 2 | 3;
}) {
  const gridClass = columns === 3 ? "xl:grid-cols-3" : columns === 2 ? "lg:grid-cols-2" : "";
  return (
    <section className="space-y-3 rounded-lg border border-neutral-200 bg-[#f7f4ef] p-4 shadow-sm">
      <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2">
        <p className="text-sm font-black text-red-700">{title}</p>
        <p className="mt-0.5 text-xs font-semibold leading-snug text-neutral-600 sm:text-sm">{description}</p>
      </div>
      <div className={`grid items-start gap-3 ${gridClass}`}>
        {children}
      </div>
    </section>
  );
}

const weekDayLabels: Record<number, string> = {
  0: "Domingo",
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
};

function AttendanceScheduleRow({ entry, onChange }: { entry: AttendanceScheduleDay; onChange: (entry: AttendanceScheduleDay) => void }) {
  return (
    <div className="grid gap-2 rounded-lg bg-neutral-50 p-2 sm:grid-cols-[120px_1fr_1fr_120px] sm:items-center">
      <span className="text-sm font-black">{weekDayLabels[entry.day]}</span>
      <label className="grid gap-1 text-xs font-bold text-neutral-600">
        Abre
        <input type="time" value={entry.open} disabled={!entry.enabled} onChange={(event) => onChange({ ...entry, open: event.target.value })} className="h-10 rounded-lg border border-neutral-300 bg-white px-2 font-bold disabled:bg-neutral-100" />
      </label>
      <label className="grid gap-1 text-xs font-bold text-neutral-600">
        Cierra
        <input type="time" value={entry.close} disabled={!entry.enabled} onChange={(event) => onChange({ ...entry, close: event.target.value })} className="h-10 rounded-lg border border-neutral-300 bg-white px-2 font-bold disabled:bg-neutral-100" />
      </label>
      <button
        type="button"
        onClick={() => onChange({ ...entry, enabled: !entry.enabled })}
        className={`action-button h-10 rounded-lg text-sm font-black ${entry.enabled ? "bg-green-600 text-white" : "bg-neutral-200 text-neutral-600"}`}
      >
        {entry.enabled ? "Activo" : "Cerrado"}
      </button>
    </div>
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
      <Input label="Google Search Console" value={draft.seo.googleSiteVerification} placeholder="Codigo de verificacion de Google" onChange={(value) => setDraft({ ...draft, seo: { ...draft.seo, googleSiteVerification: value } })} />
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
  onClick,
}: {
  syncStatus: "idle" | "syncing" | "saved" | "error";
  label: string;
  savedLabel: string;
  onClick?: () => void;
}) {
  return (
    <button
      type={onClick ? "button" : "submit"}
      disabled={syncStatus === "syncing"}
      onClick={onClick}
      className={`action-button flex min-h-11 min-w-fit items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-black text-white disabled:cursor-wait lg:col-span-2 ${
        syncStatus === "saved" ? "bg-green-600" : syncStatus === "error" ? "bg-red-700" : "bg-neutral-950"
      }`}
    >
      {syncStatus === "saved" ? <Check size={18} /> : <Save size={18} />}
      {syncStatus === "syncing" ? "Guardando..." : syncStatus === "saved" ? savedLabel : syncStatus === "error" ? "Reintentar guardado" : label}
    </button>
  );
}

function ControlLabel({ label }: { label: string }) {
  if (!label.includes("(Beta)")) return <>{label}</>;
  return (
    <>
      {label.replace(" (Beta)", "")} <span className="text-xs font-semibold text-red-700">(Beta)</span>
    </>
  );
}

function BooleanControl({
  label,
  value,
  onChange,
  activeLabel,
  inactiveLabel,
  activeTone,
  inactiveTone = "neutral",
  disabled = false,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  activeLabel: string;
  inactiveLabel: string;
  activeTone: "success" | "danger";
  inactiveTone?: "neutral" | "danger";
  disabled?: boolean;
}) {
  const activeClass = activeTone === "danger" ? "bg-red-600 text-white" : "bg-green-600 text-white";
  const inactiveClass = inactiveTone === "danger" ? "bg-red-600 text-white" : "bg-neutral-950 text-white";
  return (
    <fieldset className="rounded-lg border border-neutral-200 bg-white p-3">
      <legend className="px-1 text-sm font-black"><ControlLabel label={label} /></legend>
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
          className={`action-button h-10 rounded-lg text-sm font-black disabled:cursor-not-allowed disabled:opacity-40 ${!value ? inactiveClass : "bg-neutral-100 text-neutral-600"}`}
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
            <h1 className="text-4xl font-black">Fonocopete Concepción</h1>
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
      <Input label="Usuario" name="username" autoComplete="username" value={login.username} onChange={(value) => setLogin({ ...login, username: value })} />
      <Input label="Contraseña" name="current-password" autoComplete="current-password" type="password" value={login.password} onChange={(value) => setLogin({ ...login, password: value })} />
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

function Input(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  name?: string;
  autoComplete?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className="grid gap-0.5 text-sm font-bold">
      {props.label}
      <input
        type={props.type || "text"}
        name={props.name}
        autoComplete={props.autoComplete}
        inputMode={props.inputMode}
        value={props.value}
        disabled={props.disabled}
        placeholder={props.placeholder}
        onChange={(event) => props.onChange(event.target.value)}
        className="h-10 w-full min-w-0 rounded-lg border border-neutral-300 bg-white px-3 font-normal disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500"
        required={props.required}
      />
    </label>
  );
}

function AffixNumberInput({
  label,
  value,
  onChange,
  affix,
  affixPosition,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  affix: "$" | "%";
  affixPosition: "left" | "right";
}) {
  return (
    <label className="grid gap-0.5 text-sm font-bold">
      {label}
      <span className="flex min-w-0">
        {affixPosition === "left" ? (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-l-lg border border-r-0 border-neutral-300 bg-neutral-50 text-sm font-black text-neutral-600">
            {affix}
          </span>
        ) : null}
        <input
          type="number"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`h-10 w-full min-w-0 border border-neutral-300 bg-white px-3 font-normal ${
            affixPosition === "left" ? "rounded-r-lg" : "rounded-l-lg"
          }`}
        />
        {affixPosition === "right" ? (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-r-lg border border-l-0 border-neutral-300 bg-neutral-50 text-sm font-black text-neutral-600">
            {affix}
          </span>
        ) : null}
      </span>
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
          className="h-11 max-w-[116px] rounded-l-lg border border-r-0 border-neutral-300 bg-white px-2 font-bold"
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
          className="h-11 min-w-0 flex-1 rounded-r-lg border border-neutral-300 bg-white px-3 font-medium"
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
        className="min-h-20 w-full min-w-0 rounded-lg border border-neutral-300 bg-white px-3 py-2 font-normal disabled:cursor-not-allowed disabled:bg-white disabled:text-neutral-500"
      />
    </label>
  );
}

function ImagePicker({ label, onImage }: { label: string; onImage: (imageUrl: string) => void }) {
  const [status, setStatus] = useState("");
  const [cropSource, setCropSource] = useState<string | null>(null);

  function handleFile(file?: File) {
    if (!file) return;
    if (cropSource) URL.revokeObjectURL(cropSource);
    setCropSource(URL.createObjectURL(file));
    setStatus("Ajusta el recorte antes de guardar.");
  }

  function closeCropEditor() {
    if (cropSource) URL.revokeObjectURL(cropSource);
    setCropSource(null);
  }

  async function applyCrop(crop: ImageCropOptions) {
    if (!cropSource) return;
    setStatus("Procesando imagen...");
    try {
      const imageUrl = await resizeImageSource(cropSource, crop);
      onImage(imageUrl);
      setStatus("Imagen cargada y ajustada a 1200 x 900 px");
      closeCropEditor();
    } catch {
      setStatus("No se pudo cargar la imagen");
    }
  }

  return (
    <>
      <label className="grid min-w-0 gap-1 text-sm font-bold">
        {label}
        <span className="text-xs font-semibold text-neutral-500">Ideal: 1200 x 900 px, proporcion 4:3.</span>
        <span className="flex min-h-11 w-full min-w-0 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg border border-dashed border-neutral-400 bg-white px-3 text-sm font-black text-neutral-700">
          <Upload size={17} className="shrink-0" />
          <span className="min-w-0 truncate">Seleccionar archivo</span>
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />
        </span>
        {status ? <span className="text-xs font-semibold text-neutral-500">{status}</span> : null}
      </label>
      {cropSource ? <ImageCropDialog src={cropSource} onCancel={closeCropEditor} onApply={(crop) => void applyCrop(crop)} /> : null}
    </>
  );
}

function ImageCropDialog({
  src,
  onCancel,
  onApply,
}: {
  src: string;
  onCancel: () => void;
  onApply: (crop: ImageCropOptions) => void;
}) {
  const [crop, setCrop] = useState<ImageCropOptions>({ zoom: 1, offsetX: 0, offsetY: 0 });

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-neutral-950/80 px-4 py-6 backdrop-blur">
      <div className="w-full max-w-2xl rounded-lg bg-white p-4 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-xl font-black">
              <Crop size={20} />
              Ajustar imagen
            </h3>
            <p className="mt-1 text-sm font-semibold text-neutral-500">Mueve y acerca la foto para que quede bien en el catalogo.</p>
          </div>
          <button type="button" onClick={onCancel} className="grid size-10 place-items-center rounded-lg bg-neutral-100" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100">
          <div className="relative aspect-[4/3] overflow-hidden">
            <img
              src={src}
              alt=""
              className="h-full w-full object-cover"
              style={{
                transform: `translate(${crop.offsetX * 0.4}%, ${crop.offsetY * 0.4}%) scale(${crop.zoom})`,
                transformOrigin: "center",
              }}
            />
            <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/10" />
          </div>
        </div>
        <div className="mt-4 grid gap-3">
          <RangeControl label="Zoom" min={1} max={2.5} step={0.05} value={crop.zoom} onChange={(zoom) => setCrop({ ...crop, zoom })} />
          <RangeControl label="Mover horizontal" min={-100} max={100} step={1} value={crop.offsetX} onChange={(offsetX) => setCrop({ ...crop, offsetX })} />
          <RangeControl label="Mover vertical" min={-100} max={100} step={1} value={crop.offsetY} onChange={(offsetY) => setCrop({ ...crop, offsetY })} />
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={onCancel} className="action-button h-11 rounded-lg border border-neutral-300 bg-white text-sm font-black">
            Cancelar
          </button>
          <button type="button" onClick={() => onApply(crop)} className="action-button flex h-11 items-center justify-center gap-2 rounded-lg bg-neutral-950 text-sm font-black text-white">
            <Save size={17} />
            Guardar recorte
          </button>
        </div>
      </div>
    </div>
  );
}

function RangeControl({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-1 text-sm font-bold">
      <span className="flex items-center justify-between gap-3">
        {label}
        <span className="text-xs font-black text-neutral-500">{value.toFixed(step < 1 ? 2 : 0)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-red-600"
      />
    </label>
  );
}

function SelectCategory(props: { categories: ProductCategory[]; value: CategoryId; onChange: (value: CategoryId) => void; onBlur?: () => void; allowEmpty?: boolean; label?: string }) {
  return (
    <label className="grid gap-1 text-sm font-bold">
      {props.label || "Categoría"}
      <select value={props.value} onChange={(event) => props.onChange(event.target.value as CategoryId)} onBlur={props.onBlur} className="h-10 w-full min-w-0 rounded-md border border-neutral-300 bg-white px-2 text-sm font-medium">
        {props.allowEmpty ? <option value="">Sin categoría</option> : null}
        {props.categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SelectBeerFormat(props: { value: "" | "latas" | "botellas"; onChange: (value: "" | "latas" | "botellas") => void; required?: boolean }) {
  return (
    <label className="grid gap-1 text-sm font-bold">
      Formato de cerveza
      <select value={props.value} required={props.required} onChange={(event) => props.onChange(event.target.value as "" | "latas" | "botellas")} className="h-10 w-full min-w-0 rounded-md border border-neutral-300 bg-white px-2 text-sm font-medium">
        <option value="">Selecciona lata o botella</option>
        <option value="latas">Latas</option>
        <option value="botellas">Botellas</option>
      </select>
    </label>
  );
}

function OrderTotals({
  subtotal,
  discount,
  delivery,
  total,
  zone,
  deliveryEnabled,
  minimumOrderAmount,
}: {
  subtotal: number;
  discount: number;
  delivery: number;
  total: number;
  zone: { name: string; eta: string };
  deliveryEnabled: boolean;
  minimumOrderAmount: number;
}) {
  const missingMinimum = Math.max(0, minimumOrderAmount - subtotal);
  return (
    <div className="mt-4 rounded-lg bg-neutral-100 p-4">
      <div className="flex items-center justify-between text-sm font-bold text-neutral-600">
        <span>Subtotal</span>
        <span>{formatCurrency(subtotal)}</span>
      </div>
      {discount > 0 ? (
        <div className="mt-2 flex items-center justify-between text-sm font-bold text-neutral-600">
          <span>Descuento</span>
          <span>-{formatCurrency(discount)}</span>
        </div>
      ) : null}
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
      {minimumOrderAmount > 0 ? (
        <div className={`mt-3 rounded-lg px-3 py-2 text-xs font-black ${missingMinimum > 0 ? "bg-amber-100 text-amber-900" : "bg-green-100 text-green-800"}`}>
          {missingMinimum > 0
            ? `Monto minimo: ${formatCurrency(minimumOrderAmount)}.${missingMinimum < minimumOrderAmount ? ` Te faltan ${formatCurrency(missingMinimum)}.` : ""}`
            : `Monto minimo alcanzado: ${formatCurrency(minimumOrderAmount)}.`}
        </div>
      ) : null}
    </div>
  );
}

function SegmentButton({ active, onClick, children, disabled = false }: { active: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`h-10 min-w-0 truncate rounded-lg px-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-45 sm:px-4 ${active ? "bg-neutral-950 text-white" : "border border-neutral-300 bg-white text-neutral-700"}`}>
      {children}
    </button>
  );
}
