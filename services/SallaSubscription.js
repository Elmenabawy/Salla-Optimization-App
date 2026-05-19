// Resolve a merchant's current plan.
//
// Source of truth = Salla App Subscription API. Salla handles checkout;
// we just look up the merchant's active subscription and map it to one
// of our tiers (free / pro / business).
//
// Plan resolution order:
//   1. .env override (DEV_FORCE_PLAN) — for local testing
//   2. In-memory cache (TTL 5 min) — avoid hammering Salla on every request
//   3. Salla API call — GET /admin/v2/subscriptions
//   4. Fallback: "free"
//
// Mapping is done by matching the Salla plan name against substrings.
// Set SALLA_PRO_PLAN_NAMES / SALLA_BUSINESS_PLAN_NAMES in .env to control
// which Salla product names map to which tier (comma-separated).

const { FREE, PRO, BUSINESS } = require("./Plans");

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map(); // merchantId -> { plan, expiresAt }

function namesFromEnv(envKey, fallback) {
  const raw = (process.env[envKey] || "").trim();
  if (!raw) return fallback;
  return raw.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
}

// Default name matching — override via env in production.
const PRO_NAMES      = () => namesFromEnv("SALLA_PRO_PLAN_NAMES",      ["pro", "احترافي", "professional"]);
const BUSINESS_NAMES = () => namesFromEnv("SALLA_BUSINESS_PLAN_NAMES", ["business", "أعمال", "enterprise"]);

function mapSallaPlanToTier(planName) {
  if (!planName) return FREE;
  const name = String(planName).toLowerCase();
  if (BUSINESS_NAMES().some(n => name.includes(n))) return BUSINESS;
  if (PRO_NAMES().some(n => name.includes(n))) return PRO;
  return FREE;
}

async function fetchActiveSubscription(accessToken) {
  // Salla App Subscriptions endpoint — returns the merchant's active
  // subscription to *your* app. Returns null if the merchant hasn't
  // purchased a paid tier (they're on the free install).
  const res = await fetch("https://api.salla.dev/admin/v2/subscriptions", {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!res.ok) {
    // 404 / 403 are normal when there's no active paid subscription
    return null;
  }
  const json = await res.json();
  const subs = Array.isArray(json?.data) ? json.data : [];
  const active = subs.find(s => s.status === "active" || s.status === "trial");
  if (!active) return null;
  return {
    planName: active.plan_name || active.name || active.plan?.name || "",
    status: active.status,
    expiresAt: active.expiry_date || active.expires_at || null,
    raw: active,
  };
}

async function getMerchantPlan(merchantId, accessToken) {
  // Dev override
  const forced = process.env.DEV_FORCE_PLAN;
  if (forced && [FREE, PRO, BUSINESS].includes(forced)) {
    return { plan: forced, source: "env-override" };
  }

  if (!merchantId) return { plan: FREE, source: "no-merchant" };

  // Cache hit
  const cached = cache.get(merchantId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  let result = { plan: FREE, source: "default" };
  if (accessToken) {
    try {
      const sub = await fetchActiveSubscription(accessToken);
      if (sub) {
        result = {
          plan: mapSallaPlanToTier(sub.planName),
          source: "salla-api",
          planName: sub.planName,
          status: sub.status,
          expiresAt: sub.expiresAt,
        };
      }
    } catch (err) {
      console.error("[SallaSubscription] lookup failed:", err.message);
    }
  }

  cache.set(merchantId, { value: result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}

function invalidatePlanCache(merchantId) {
  if (merchantId) cache.delete(merchantId);
  else cache.clear();
}

module.exports = { getMerchantPlan, invalidatePlanCache, mapSallaPlanToTier };
