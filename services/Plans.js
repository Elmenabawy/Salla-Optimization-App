// Subscription plans + feature gating.
//
// Three tiers — keep the catalog in one place so views, API gates,
// and widget-config filtering all read from the same source of truth.
//
//   free      — SEO/CRO analysis view, PageSpeed, WhatsApp widget
//   pro       — all storefront widgets + lead capture
//   business  — everything in pro + product auto-fix API + leads CSV export

const FREE = "free";
const PRO = "pro";
const BUSINESS = "business";

const PLAN_IDS = [FREE, PRO, BUSINESS];

// Feature keys — used by widget-config filter + route guards.
// settingsKey: matches the key in MerchantSettings DEFAULTS (so we can disable
// the feature in widget-config responses for merchants whose plan doesn't include it).
const FEATURES = {
  seoAnalysisView:    { minPlan: FREE,     settingsKey: null },
  pagespeed:          { minPlan: FREE,     settingsKey: null },
  whatsapp:           { minPlan: FREE,     settingsKey: "whatsapp" },

  freeShippingBar:    { minPlan: PRO,      settingsKey: "freeShippingBar" },
  stickyCart:         { minPlan: PRO,      settingsKey: "stickyCart" },
  stickyMobileCart:   { minPlan: PRO,      settingsKey: "stickyMobileCart" },
  productTimer:       { minPlan: PRO,      settingsKey: "productTimer" },
  socialProof:        { minPlan: PRO,      settingsKey: "socialProof" },
  stockUrgency:       { minPlan: PRO,      settingsKey: "stockUrgency" },
  recentlyViewed:     { minPlan: PRO,      settingsKey: "recentlyViewed" },
  exitIntent:         { minPlan: PRO,      settingsKey: "exitIntent" },
  trustBadges:        { minPlan: PRO,      settingsKey: "trustBadges" },
  spinWheel:          { minPlan: PRO,      settingsKey: "spinWheel" },
  freeGiftBar:        { minPlan: PRO,      settingsKey: "freeGiftBar" },
  wishlist:           { minPlan: PRO,      settingsKey: "wishlist" },
  liveOrderTicker:    { minPlan: PRO,      settingsKey: "liveOrderTicker" },
  customPopup:        { minPlan: PRO,      settingsKey: "customPopup" },
  performanceBoost:   { minPlan: PRO,      settingsKey: "performanceBoost" },
  seoFixerStorefront: { minPlan: PRO,      settingsKey: "seoFixer" },
  leadCapture:        { minPlan: PRO,      settingsKey: null },

  autoFixProducts:    { minPlan: BUSINESS, settingsKey: null },
  leadsExport:        { minPlan: BUSINESS, settingsKey: null },
};

function rank(plan) {
  const i = PLAN_IDS.indexOf(plan);
  return i === -1 ? 0 : i;
}

function planAllows(plan, feature) {
  const f = FEATURES[feature];
  if (!f) return false;
  return rank(plan) >= rank(f.minPlan);
}

// Returns a copy of settings with widget keys forcibly disabled for any
// feature the merchant's plan doesn't include. Use before serving
// /api/widget-config so the storefront widget.js never activates
// paid widgets for a free-tier merchant.
function filterSettingsByPlan(settings, plan) {
  if (!settings) return settings;
  const out = JSON.parse(JSON.stringify(settings));
  for (const [feature, def] of Object.entries(FEATURES)) {
    if (!def.settingsKey) continue;
    if (planAllows(plan, feature)) continue;
    if (out[def.settingsKey]) out[def.settingsKey].enabled = false;
  }
  return out;
}

// UI-friendly catalog — view templates can iterate this to render
// the plan-comparison table without hard-coding it in HTML.
const CATALOG = [
  {
    id: FREE,
    name: "Free",
    nameAr: "مجاني",
    priceMonthly: 0,
    features: [
      "تحليل SEO/CRO للمتجر",
      "تكامل Google PageSpeed",
      "زر واتساب على المتجر",
    ],
  },
  {
    id: PRO,
    name: "Pro",
    nameAr: "احترافي",
    priceMonthly: 99,
    features: [
      "كل مزايا الباقة المجانية",
      "كل أدوات رفع التحويلات (شريط الشحن، عجلة الحظ، قائمة الأمنيات، …)",
      "نوافذ مخصّصة + إشعارات الإلحاح",
      "تحسين أداء المتجر",
      "جمع البريد الإلكتروني للعملاء",
    ],
  },
  {
    id: BUSINESS,
    name: "Business",
    nameAr: "أعمال",
    priceMonthly: 249,
    features: [
      "كل مزايا الباقة الاحترافية",
      "إصلاح SEO تلقائي لكل المنتجات (Auto-fix)",
      "تصدير العملاء المحتملين CSV",
      "أولوية الدعم الفني",
    ],
  },
];

module.exports = {
  FREE,
  PRO,
  BUSINESS,
  PLAN_IDS,
  FEATURES,
  CATALOG,
  planAllows,
  filterSettingsByPlan,
};
