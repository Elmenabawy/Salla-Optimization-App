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
    mode: "daily", // 'daily' resets at midnight | 'fixed' counts down to endDate
    endDate: "", // ISO datetime, used when mode='fixed'
    title: "⏰ العرض ينتهي خلال",
    bgColor: "#dc2626",
    bgColor2: "#f97316",
    textColor: "#FFFFFF",
    placement: "above-cart", // 'above-cart' | 'below-price'
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
  const merged = mergeAll({
    whatsapp: { ...current.whatsapp, ...(partial.whatsapp || {}) },
    stickyCart: { ...current.stickyCart, ...(partial.stickyCart || {}) },
    freeShippingBar: { ...current.freeShippingBar, ...(partial.freeShippingBar || {}) },
    productTimer: { ...current.productTimer, ...(partial.productTimer || {}) },
  });
  fs.writeFileSync(file(merchantId), JSON.stringify(merged, null, 2));
  return merged;
}

module.exports = { loadSettings, saveSettings, DEFAULTS };
