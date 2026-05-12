const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");

const DEFAULTS = {
  whatsapp: {
    enabled: false,
    number: "",
    message: "السلام عليكم، أريد الاستفسار عن المنتجات",
    position: "bottom-right",
    color: "#25D366",
    iconColor: "#FFFFFF",
  },
  stickyCart: {
    enabled: false,
    text: "🛒 أكمل طلبك الآن",
    bgColor: "#0d9488",
    textColor: "#FFFFFF",
    position: "bottom-center", // bottom-right | bottom-left | bottom-center | top-right | top-left | top-center
    offsetX: 20,
    offsetY: 20,
  },
  freeShippingBar: {
    enabled: false,
    threshold: 200,
    currency: "SAR",
    text: "🚚 احصل على شحن مجاني عند طلب فوق {threshold} {currency}",
    bgColor: "#0d9488",
    bgColor2: "#2563eb",
    textColor: "#FFFFFF",
  },
  productTimer: {
    enabled: false,
    mode: "daily",
    endDate: "",
    title: "⏰ العرض ينتهي خلال",
    bgColor: "#dc2626",
    bgColor2: "#f97316",
    textColor: "#FFFFFF",
    placement: "above-cart",
  },
  socialProof: {
    enabled: false,
    messages: [
      "🛍️ شخص ما اشترى هذا المنتج للتو",
      "🔥 5 أشخاص يشاهدون هذا المنتج الآن",
      "✨ تم بيع 12 قطعة خلال آخر 24 ساعة",
    ],
    rotateEvery: 7000,
    position: "bottom-left",
    bgColor: "#FFFFFF",
    textColor: "#0f172a",
    accentColor: "#10b981",
  },
  stockUrgency: {
    enabled: false,
    threshold: 5,
    message: "🔥 لم يتبق سوى {count} قطعة!",
    bgColor: "#fef3c7",
    textColor: "#92400e",
  },
  recentlyViewed: {
    enabled: false,
    title: "🕘 شاهدت مؤخراً",
    maxItems: 8,
    bgColor: "#f8fafc",
    textColor: "#0f172a",
  },
  exitIntent: {
    enabled: false,
    title: "انتظر! 👋",
    message: "احصل على خصم 10% على طلبك الأول",
    buttonText: "احصل على الخصم",
    buttonUrl: "/cart",
    bgColor: "#0d9488",
    textColor: "#FFFFFF",
    showOnce: "session",
  },
  trustBadges: {
    enabled: false,
    placement: "below-cart",
    items: [
      { icon: "🚚", text: "شحن مجاني" },
      { icon: "🔒", text: "دفع آمن" },
      { icon: "↩️", text: "استرجاع 14 يوم" },
      { icon: "⭐", text: "ضمان الجودة" },
    ],
    bgColor: "#f1f5f9",
    textColor: "#0f172a",
  },
  performanceBoost: {
    enabled: false,
    lazyLoadImages: true,
    asyncDecode: true,
    lazyLoadIframes: true,
    preconnect: true,
    deferVideos: true,
    optimizeFonts: false,
  },
  spinWheel: {
    enabled: false,
    title: "🎁 جرّب حظك واربح خصماً!",
    subtitle: "أدخل بريدك واحصل على فرصة لربح خصم حتى 25٪",
    buttonText: "أدر العجلة",
    showAfterSeconds: 15,
    showOnce: "session",
    slices: ["5%", "10%", "خسرت", "15%", "20%", "خسرت", "25%", "خسرت"],
    winColors: ["#fbbf24", "#10b981", "#94a3b8", "#3b82f6", "#a855f7", "#94a3b8", "#ef4444", "#94a3b8"],
    bgColor: "#0d9488",
    textColor: "#FFFFFF",
  },
  freeGiftBar: {
    enabled: false,
    threshold: 200,
    currency: "ر.س",
    textBelow: "أضف {remaining} {currency} للحصول على هدية مجانية 🎁",
    textReached: "🎉 رائع! أضفنا الهدية المجانية إلى طلبك",
    position: "top",
    bgColor: "#0d9488",
    textColor: "#FFFFFF",
    progressColor: "#fbbf24",
  },
  stickyMobileCart: {
    enabled: false,
    showQuantity: true,
    addToCartText: "أضف للسلة 🛒",
    bgColor: "#0d9488",
    textColor: "#FFFFFF",
  },
  wishlist: {
    enabled: false,
    floatingButton: true,
    buttonText: "❤️",
    bgColor: "#ef4444",
    textColor: "#FFFFFF",
  },
  liveOrderTicker: {
    enabled: false,
    messages: [
      "أحمد من الرياض اشترى منذ 3 دقائق",
      "سارة من جدة اشترت منذ 7 دقائق",
      "محمد من الدمام اشترى منذ 12 دقيقة",
      "نورة من مكة اشترت منذ 18 دقيقة",
      "خالد من الخبر اشترى منذ 25 دقيقة",
    ],
    position: "bottom-left",
    showEvery: 12000,
    bgColor: "#FFFFFF",
    textColor: "#0f172a",
    accentColor: "#0d9488",
  },
  customPopup: {
    enabled: false,
    title: "🎁 عرض خاص لك!",
    body: "خصم حصري على منتجاتنا المميزة - عرض محدود",
    imageUrl: "",
    buttonText: "تسوق الآن",
    buttonUrl: "/",
    trigger: "delay",
    triggerValue: 5,
    targeting: "all",
    targetIds: "",
    showOnce: "session",
    bgColor: "#FFFFFF",
    textColor: "#0f172a",
    accentColor: "#0d9488",
  },
};

function file(merchantId) {
  return path.join(DATA_DIR, `settings_${merchantId}.json`);
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function mergeAll(raw) {
  return {
    whatsapp: { ...DEFAULTS.whatsapp, ...(raw.whatsapp || {}) },
    stickyCart: { ...DEFAULTS.stickyCart, ...(raw.stickyCart || {}) },
    freeShippingBar: { ...DEFAULTS.freeShippingBar, ...(raw.freeShippingBar || {}) },
    productTimer: { ...DEFAULTS.productTimer, ...(raw.productTimer || {}) },
    socialProof: { ...DEFAULTS.socialProof, ...(raw.socialProof || {}) },
    stockUrgency: { ...DEFAULTS.stockUrgency, ...(raw.stockUrgency || {}) },
    recentlyViewed: { ...DEFAULTS.recentlyViewed, ...(raw.recentlyViewed || {}) },
    exitIntent: { ...DEFAULTS.exitIntent, ...(raw.exitIntent || {}) },
    trustBadges: { ...DEFAULTS.trustBadges, ...(raw.trustBadges || {}) },
    performanceBoost: { ...DEFAULTS.performanceBoost, ...(raw.performanceBoost || {}) },
    spinWheel: { ...DEFAULTS.spinWheel, ...(raw.spinWheel || {}) },
    freeGiftBar: { ...DEFAULTS.freeGiftBar, ...(raw.freeGiftBar || {}) },
    stickyMobileCart: { ...DEFAULTS.stickyMobileCart, ...(raw.stickyMobileCart || {}) },
    wishlist: { ...DEFAULTS.wishlist, ...(raw.wishlist || {}) },
    liveOrderTicker: { ...DEFAULTS.liveOrderTicker, ...(raw.liveOrderTicker || {}) },
    customPopup: { ...DEFAULTS.customPopup, ...(raw.customPopup || {}) },
  };
}

function loadSettings(merchantId) {
  const f = file(merchantId);
  if (!merchantId || !fs.existsSync(f)) return JSON.parse(JSON.stringify(DEFAULTS));
  try {
    return mergeAll(JSON.parse(fs.readFileSync(f, "utf8")));
  } catch {
    return JSON.parse(JSON.stringify(DEFAULTS));
  }
}

function saveSettings(merchantId, partial) {
  if (!merchantId) return null;
  ensureDir();
  const current = loadSettings(merchantId);
  const keys = Object.keys(DEFAULTS);
  const next = {};
  keys.forEach((k) => {
    next[k] = { ...current[k], ...(partial[k] || {}) };
  });
  const merged = mergeAll(next);
  fs.writeFileSync(file(merchantId), JSON.stringify(merged, null, 2));
  return merged;
}

module.exports = { loadSettings, saveSettings, DEFAULTS };
