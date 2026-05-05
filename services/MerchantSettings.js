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
  },
  stickyCart: {
    enabled: false,
    text: "🛒 أكمل طلبك الآن",
  },
  freeShippingBar: {
    enabled: false,
    threshold: 200,
    currency: "SAR",
    text: "🚚 احصل على شحن مجاني عند طلب فوق {threshold} {currency}",
  },
};

function file(merchantId) {
  return path.join(DATA_DIR, `settings_${merchantId}.json`);
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadSettings(merchantId) {
  const f = file(merchantId);
  if (!merchantId || !fs.existsSync(f)) return JSON.parse(JSON.stringify(DEFAULTS));
  try {
    const raw = JSON.parse(fs.readFileSync(f, "utf8"));
    return {
      whatsapp: { ...DEFAULTS.whatsapp, ...(raw.whatsapp || {}) },
      stickyCart: { ...DEFAULTS.stickyCart, ...(raw.stickyCart || {}) },
      freeShippingBar: { ...DEFAULTS.freeShippingBar, ...(raw.freeShippingBar || {}) },
    };
  } catch {
    return JSON.parse(JSON.stringify(DEFAULTS));
  }
}

function saveSettings(merchantId, partial) {
  if (!merchantId) return null;
  ensureDir();
  const current = loadSettings(merchantId);
  const merged = {
    whatsapp: { ...current.whatsapp, ...(partial.whatsapp || {}) },
    stickyCart: { ...current.stickyCart, ...(partial.stickyCart || {}) },
    freeShippingBar: { ...current.freeShippingBar, ...(partial.freeShippingBar || {}) },
  };
  fs.writeFileSync(file(merchantId), JSON.stringify(merged, null, 2));
  return merged;
}

module.exports = { loadSettings, saveSettings, DEFAULTS };
