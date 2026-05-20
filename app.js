// Import Deps
require("dotenv").config({ quiet: true });
const fs = require("fs");
const path = require("path");
const express = require("express");

// Ensure persistent data directory exists (SQLite + analysis cache)
const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const session = require("express-session");
const passport = require("passport");
const consolidate = require("consolidate");
const getUnixTimestamp = require("./helpers/getUnixTimestamp");
const bodyParser = require("body-parser");
const { analyzeStore, loadAnalysis } = require("./services/SeoAnalyzer");
const DemoData = require("./services/DemoData");
const { loadSettings, saveSettings } = require("./services/MerchantSettings");
const { loadLeads, addLead, toCSV } = require("./services/Leads");
const { autoFixProducts } = require("./services/AutoFixer");
const { planAllows, filterSettingsByPlan, CATALOG } = require("./services/Plans");
const { getMerchantPlan, invalidatePlanCache } = require("./services/SallaSubscription");
const port = process.argv[2] || 8082;

// Initialize Express app first (before using middleware)
var app = express();

/*
  Create a .env file in the root directory of your project.
  Add environment-specific variables on new lines in the form of NAME=VALUE. For example:
  SALLA_OAUTH_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  SALLA_OAUTH_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  ...
*/
const {
  SALLA_OAUTH_CLIENT_ID,
  SALLA_OAUTH_CLIENT_SECRET,
  SALLA_OAUTH_CLIENT_REDIRECT_URI,
  SALLA_WEBHOOK_SECRET,
  SALLA_DATABASE_ORM,
} = process.env;

// Import Salla APIs
const SallaAPIFactory = require("@salla.sa/passport-strategy");
const SallaDatabase = require("./database")(SALLA_DATABASE_ORM || "Sequelize");
const SallaWebhook = require("@salla.sa/webhooks-actions");

SallaWebhook.setSecret(SALLA_WEBHOOK_SECRET);

// Save the access token + trigger SEO/CRO analysis for a merchant
async function persistMerchantAndAnalyze(merchantId, data) {
  const accessToken = data?.access_token;
  const refreshToken = data?.refresh_token;
  const expiresIn = data?.expires || data?.expires_in;
  if (!accessToken || !merchantId) return;

  try {
    const conn = await SallaDatabase.connect();
    if (conn) {
      const userId = await SallaDatabase.saveUser({
        username: data.merchant?.name || `merchant-${merchantId}`,
        email: data.merchant?.email || `merchant-${merchantId}@salla.app`,
        email_verified_at: getUnixTimestamp(),
        verified_at: getUnixTimestamp(),
        password: "",
        remember_token: "",
      });
      await SallaDatabase.saveOauth({
        merchant: merchantId,
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: expiresIn,
        user_id: userId,
      });
      console.log(`[Webhook] Saved tokens for merchant ${merchantId}`);
    }
  } catch (err) {
    console.error("[Webhook] Failed to save tokens:", err.message);
  }

  // Kick off the analysis in the background
  analyzeStore(merchantId, SallaAPI, accessToken, loadSettings(merchantId)?.seoFixer?.storeUrl).catch(err => {
    console.error("[Webhook] Analysis failed:", err.message);
  });
}

// app.store.authorize fires after a merchant authorizes the app (Easy Mode delivers the token here)
SallaWebhook.on("app.store.authorize", (eventBody) => {
  console.log("[Webhook] app.store.authorize received for merchant", eventBody?.merchant);
  const merchantId = eventBody?.merchant || eventBody?.data?.merchant?.id;
  // Fire-and-forget — Salla already got its 200 response
  persistMerchantAndAnalyze(merchantId, eventBody?.data || {}).catch((err) =>
    console.error("[Webhook] persist failed:", err.message)
  );
});

// app.installed fires once when the merchant first installs the app
SallaWebhook.on("app.installed", (eventBody) => {
  console.log("[Webhook] app.installed received for merchant", eventBody?.merchant);
  const merchantId = eventBody?.merchant || eventBody?.data?.merchant?.id;
  persistMerchantAndAnalyze(merchantId, eventBody?.data || {}).catch((err) =>
    console.error("[Webhook] persist failed:", err.message)
  );
});

SallaWebhook.on("all", (eventBody) => {
  console.log("[Webhook] event:", eventBody?.event);
});

// we initialize our Salla API
const SallaAPI = new SallaAPIFactory({
  clientID: SALLA_OAUTH_CLIENT_ID,
  clientSecret: SALLA_OAUTH_CLIENT_SECRET,
  callbackURL: SALLA_OAUTH_CLIENT_REDIRECT_URI,
});

// set Listener on auth success
SallaAPI.onAuth(async (accessToken, refreshToken, expires_in, data) => {
  const merchantId = data?.merchant?.id;
  console.log(`[OAuth] Authentication successful for merchant ${merchantId}`);

  // Save to database — wrap in try/catch so a DB error never breaks the redirect
  try {
    const connection = await SallaDatabase.connect();
    if (connection) {
      const userId = await SallaDatabase.saveUser({
        username: data?.name || `merchant-${merchantId}`,
        email: data?.email || `merchant-${merchantId}@salla.app`,
        email_verified_at: getUnixTimestamp(),
        verified_at: getUnixTimestamp(),
        password: "",
        remember_token: "",
      });
      await SallaDatabase.saveOauth({
        merchant: merchantId,
        access_token: accessToken,
        expires_in: expires_in,
        refresh_token: refreshToken,
        user_id: userId,
      });
      console.log(`[OAuth] Tokens saved for merchant ${merchantId}`);
    }
  } catch (err) {
    console.error("[OAuth] DB save failed:", err.message);
  }

  // Trigger SEO/CRO analysis in background (non-blocking)
  if (merchantId && accessToken) {
    analyzeStore(merchantId, SallaAPI, accessToken, loadSettings(merchantId)?.seoFixer?.storeUrl).catch(err => {
      console.error("[OAuth] Analysis failed:", err.message);
    });
  }
});

// Global SEO Meta Middleware
app.use((req, res, next) => {
  const baseUrl =
    process.env.APP_URL ||
    `${req.protocol}://${req.get("host")}`;

  const isEmbed =
    req.path.startsWith("/embed") ||
    req.path.startsWith("/api");

  res.locals.meta = {
    title: "Alfa Plus | CRO & SEO Optimization for Salla Stores",
    description:
      "Boost conversions and improve search rankings for your Salla store with Alfa Plus. Advanced CRO and SEO tools designed for Salla merchants.",
    keywords:
      "Salla SEO, Salla CRO, Alfa Plus, ecommerce SEO, conversion optimization, Salla app",
    canonical: baseUrl + req.originalUrl,
    robots: isEmbed
      ? "noindex,nofollow,noarchive"
      : "index,follow",

    og: {
      title: "Alfa Plus | CRO & SEO Optimization for Salla Stores",
      description:
        "Advanced SEO and CRO optimization tools for Salla stores.",
      type: "website",
      url: baseUrl + req.originalUrl,
    },

    twitter: {
      card: "summary_large_image",
      title: "Alfa Plus | CRO & SEO Optimization for Salla Stores",
      description:
        "Improve rankings and conversions for your Salla store with Alfa Plus.",
    },
  };

  next();
});

//   Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session. Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing. However, since this example does not
//   have a database of user records, the complete salla user is serialized
//   and deserialized.

passport.serializeUser(function (user, done) {
  done(null, user);
});

passport.deserializeUser(function (obj, done) {
  done(null, obj);
});

//   Use the Salla Strategy within Passport.
passport.use(SallaAPI.getPassportStrategy());
// save token and user data to your selected database

// configure Express
app.set("views", __dirname + "/views");
app.set("view engine", "html");

// set the session secret
// you can store session data in any database (monogdb - mysql - inmemory - etc) for more (https://www.npmjs.com/package/express-session)
app.use(
  session({ secret: "keyboard cat", resave: true, saveUninitialized: true })
);

// Initialize Passport!  Also use passport.session() middleware, to support
// persistent login sessions (recommended).
app.use(passport.initialize());
app.use(passport.session());

// serve static files from public folder
app.use(express.static(__dirname + "/public"));

// set the render engine to nunjucks

app.engine("html", consolidate.nunjucks);
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());

// SallaAPI.setExpressVerify writes to req.query, which is a getter-only
// property in Express 5. We don't actually need it (passport handles the
// session), so we skip it. If you need to call SallaAPI.fetchResource
// directly, pass the access token explicitly.

// POST /webhook
// Salla times out webhook deliveries after 60 seconds. We MUST respond
// immediately, then process the event in the background. Otherwise every
// install/event fails with cURL error 28.
app.post("/webhook", function (req, res) {
  // Respond first so Salla marks the delivery as successful
  res.status(200).json({ ok: true });
  // Then process the webhook (handlers may do DB writes + API calls)
  try {
    SallaWebhook.checkActions(req.body, req.headers.authorization, {});
  } catch (err) {
    console.error("[Webhook] processing error:", err.message);
  }
});

// GET /oauth/redirect
//   Use passport.authenticate() as route middleware to authenticate the
//   request. The first step in salla authentication will involve redirecting
//   the user to accounts.salla.sa. After authorization, salla will redirect the user
//   back to this application at /oauth/callback
app.get(["/oauth/redirect", "/login"], passport.authenticate("salla"));

// GET /oauth/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request. If authentication fails, the user will be redirected back to the
//   login page. Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
app.get(
  "/oauth/callback",
  function (req, res, next) {
    passport.authenticate("salla", { failureRedirect: "/login" }, (err, user) => {
      if (err) {
        console.error("[OAuth Callback] passport error:", err);
        return res.status(500).send(`<h2>OAuth error</h2><pre>${err.message || err}</pre><p><a href="/">Go home</a></p>`);
      }
      if (!user) return res.redirect("/login");
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error("[OAuth Callback] login error:", loginErr);
          return res.status(500).send(`<h2>Login error</h2><pre>${loginErr.message}</pre>`);
        }
        return res.redirect("/");
      });
    })(req, res, next);
  }
);

// GET /
// render the index page

app.get("/", function (req, res) {
  console.log("[Home] req.user =", JSON.stringify(req.user || null).slice(0, 500));

  let u = null;
  try { u = req.user || null; } catch (e) { console.error("[Home] req.user access failed:", e); }

  const userName = (u && u.name) || "تاجر";
  const userEmail = (u && u.email) || "";
  const merchant = (u && u.merchant) || {};
  let userInitial = "ت";
  try {
    userInitial = String(userName).charAt(0).toUpperCase() || "ت";
  } catch (e) { console.error("[Home] userInitial failed:", e); }

  res.render(
    "index.html",
    {
      user: u,
      isLogin: !!u,
      userDetails: { merchant },
      userName,
      userEmail,
      userInitial,
      merchantName: merchant.name || "",
      merchantAvatar: merchant.avatar || "",
    },
    (err, html) => {
      if (err) {
        console.error("[Home] render error:", err.stack || err);
        return res
          .status(500)
          .type("html")
          .send(
            `<!doctype html><meta charset=utf-8><title>Render error</title>` +
            `<h2>Render error</h2><pre>${(err.stack || err.message || err).toString().replace(/</g, "&lt;")}</pre>` +
            `<p><a href="/">Reload</a></p>`
          );
      }
      res.send(html);
    }
  );
});

// Routes /orders, /customers, /account, /refreshToken were starter-kit demos —
// removed because they're not part of the SEO/CRO app and their views/data flow
// were broken after the OAuth changes.

// Allow Salla to iframe our pages (used by the /embed route)
app.use((req, res, next) => {
  if (req.path.startsWith("/embed")) {
    res.removeHeader("X-Frame-Options");
    // Allow embedding from any domain (open during dev; tighten for production)
    res.setHeader("Content-Security-Policy", "frame-ancestors *");
    // Bypass ngrok's free-tier browser warning page
    res.setHeader("ngrok-skip-browser-warning", "true");
  }
  next();
});

// Decode the PASETO v4.public token Salla passes in the iframe URL
// We don't verify the signature here — we trust it because it came from Salla's iframe context
function decodeSallaToken(token) {
  if (!token || !token.startsWith("v4.public.")) return null;
  try {
    const buf = Buffer.from(token.slice("v4.public.".length), "base64url");
    // Format: payload bytes || 64-byte Ed25519 signature
    const payloadJson = buf.slice(0, buf.length - 64).toString("utf8");
    return JSON.parse(payloadJson);
  } catch {
    return null;
  }
}

// Look up the OAuth access token we saved when the merchant installed the app
async function getAccessTokenForMerchant(merchantId) {
  try {
    const conn = await SallaDatabase.connect();
    if (!conn) return null;
    const oauth = await conn.models.OauthTokens.findOne({
      where: { merchant: merchantId },
      order: [["updatedAt", "DESC"]],
    });
    return oauth?.access_token || null;
  } catch (err) {
    console.error("[Embed] Failed to fetch access token:", err.message);
    return null;
  }
}

// ============================================================
// Storefront widget API — public endpoint called by /widget.js
// running on merchants' Salla stores. Returns the merchant's
// feature config (WhatsApp button, shipping bar, sticky cart).
// ============================================================
app.use("/api/widget-config", (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// Public endpoint — called by the widget on storefronts when a visitor
// submits their email (spin wheel, exit intent, newsletter, etc.)
app.use("/api/lead", (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

app.post("/api/lead", async (req, res) => {
  const storeId = req.body?.store || req.query.store;
  const email = req.body?.email;
  if (!storeId || !email) return res.status(400).json({ error: "store and email required" });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "invalid email" });
  // Lead capture is a Pro+ feature — silently drop for free-tier so storefront
  // widgets stay simple (no per-feature error UI required).
  const accessToken = await getAccessTokenForMerchant(storeId);
  const { plan } = await getMerchantPlan(storeId, accessToken);
  if (!planAllows(plan, "leadCapture")) {
    return res.status(402).json({ error: "lead capture requires Pro plan", plan });
  }
  const saved = addLead(storeId, {
    email,
    source: req.body?.source || "unknown",
    prize: req.body?.prize || null,
    userAgent: req.headers["user-agent"],
  });
  res.json({ ok: true, lead: saved });
});

app.get("/api/widget-config", async (req, res) => {
  const storeId = req.query.store;
  // Demo preview used by the marketing landing page
  if (storeId === "demo") {
    return res.json({
      whatsapp: {
        enabled: true,
        number: "966500000000",
        message: "مرحبا، شاهدت تطبيق Site Optimization على متجركم وأريد الاستفسار",
        position: "bottom-right",
        color: "#25D366",
      },
      freeShippingBar: {
        enabled: true,
        threshold: 200,
        currency: "ر.س",
        text: "🚚 شحن مجاني عند الطلب فوق {threshold} {currency}",
      },
      stickyCart: { enabled: false, text: "🛒 أكمل طلبك" },
    });
  }
  if (!storeId) return res.json({});

  // Plan gating — disable any widget the merchant's plan doesn't include
  // before the storefront widget.js sees it. Free-tier merchants can still
  // toggle paid widgets in the dashboard, but they won't render in production.
  const accessToken = await getAccessTokenForMerchant(storeId);
  const { plan } = await getMerchantPlan(storeId, accessToken);
  const settings = loadSettings(storeId);
  res.json(filterSettingsByPlan(settings, plan));
});

// ============================================================
// Merchant data APIs — return real products/categories from
// the merchant's Salla store (used to populate targeting dropdowns).
// Auth via the Salla PASETO token Salla passes in the iframe URL.
// ============================================================

async function getMerchantData(req, res, sallaUrl) {
  const decoded = decodeSallaToken(req.query.token);
  const merchantId = decoded?.data?.merchant_id;
  if (!merchantId) return res.status(401).json({ error: "unauthorized" });
  const accessToken = await getAccessTokenForMerchant(merchantId);
  if (!accessToken) return res.json({ data: [] });
  try {
    const data = await SallaAPI.fetchResource({ url: sallaUrl, token: accessToken });
    res.json(data || { data: [] });
  } catch (err) {
    console.error("[API] getMerchantData failed:", err.message);
    res.json({ data: [] });
  }
}

// Plan info — used by the dashboard to show current tier + upgrade prompts.
// Iframe-token authenticated.
app.get("/api/plan", async (req, res) => {
  const merchantId = authIframeRequest(req, res);
  if (!merchantId) return;
  const accessToken = await getAccessTokenForMerchant(merchantId);
  const info = await getMerchantPlan(merchantId, accessToken);
  res.json({ ...info, catalog: CATALOG });
});

// Session-authenticated counterpart for the main /analysis page.
app.get("/api/my-plan", ensureAuthenticated, async (req, res) => {
  const merchantId = req.user?.merchant?.id;
  if (!merchantId) return res.status(401).json({ error: "no merchant" });
  const accessToken = await getAccessTokenForMerchant(merchantId);
  const info = await getMerchantPlan(merchantId, accessToken);
  res.json({ ...info, catalog: CATALOG });
});

// Force a re-fetch from Salla (call this after a known plan change, e.g. webhook)
app.post("/api/plan/refresh", ensureAuthenticated, (req, res) => {
  invalidatePlanCache(req.user?.merchant?.id);
  res.json({ ok: true });
});

// /plans — public pricing/comparison page. Renders the CATALOG so updates
// to plan definitions automatically flow to the UI.
app.get("/plans", (req, res) => {
  res.render("plans.html", {
    isLogin: !!req.user,
    plans: CATALOG,
    currentPlan: null,
  });
});

// Debug — show who's logged in (which merchant ID the save uses)
app.get("/api/whoami", (req, res) => {
  res.json({
    isAuthenticated: !!req.user,
    user: req.user
      ? {
          name: req.user.name,
          email: req.user.email,
          merchantId: req.user.merchant?.id,
          merchantName: req.user.merchant?.name,
        }
      : null,
  });
});

// Debug — show full analysis JSON (helps diagnose PageSpeed integration)
app.get("/api/debug-analysis/:merchantId", (req, res) => {
  const mid = req.params.merchantId;
  const filePath = path.join(__dirname, "data", `analysis_${mid}.json`);
  if (!fs.existsSync(filePath)) return res.json({ exists: false });
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
    res.json({
      exists: true,
      analyzedAt: raw.analyzedAt,
      storeUrl: raw.storeUrl || null,
      hasPagespeed: !!raw.pagespeed,
      pagespeed: raw.pagespeed,
      seoScore: raw.analysis?.seo_audit?.score,
      croScore: raw.analysis?.cro_analysis?.score,
      // Specific failing checks
      seoIssues: {
        technical: raw.analysis?.seo_audit?.technical_issues || [],
        onPage: raw.analysis?.seo_audit?.on_page_problems || [],
      },
      croIssues: {
        ux: raw.analysis?.cro_analysis?.ux_issues || [],
        trust: raw.analysis?.cro_analysis?.trust_issues || [],
      },
    });
  } catch (e) {
    res.json({ exists: true, error: e.message });
  }
});

// Debug — list all files in /app/data so we can see what was saved
app.get("/api/debug-data-dir", (req, res) => {
  const dir = path.join(__dirname, "data");
  try {
    const files = fs.readdirSync(dir).map((name) => {
      const stat = fs.statSync(path.join(dir, name));
      return { name, size: stat.size, modifiedAt: stat.mtime };
    });
    res.json({ dir, exists: true, files });
  } catch (err) {
    res.json({ dir, exists: false, error: err.message });
  }
});

// Debug endpoint — shows whether settings file actually exists on disk
app.get("/api/debug-settings/:merchantId", (req, res) => {
  const mid = req.params.merchantId;
  const filePath = path.join(__dirname, "data", `settings_${mid}.json`);
  const exists = fs.existsSync(filePath);
  let stat = null, raw = null;
  if (exists) {
    try {
      stat = fs.statSync(filePath);
      raw = fs.readFileSync(filePath, "utf8");
    } catch (e) {}
  }
  res.json({
    merchantId: mid,
    filePath,
    exists,
    size: stat?.size || 0,
    modifiedAt: stat?.mtime || null,
    dataDirExists: fs.existsSync(path.join(__dirname, "data")),
    contents: raw ? JSON.parse(raw) : null,
  });
});

app.get("/api/merchant-products", (req, res) =>
  getMerchantData(req, res, "https://api.salla.dev/admin/v2/products?per_page=100")
);

app.get("/api/merchant-categories", (req, res) =>
  getMerchantData(req, res, "https://api.salla.dev/admin/v2/categories?per_page=100")
);

// ============================================================
// Settings API — used by the in-iframe settings UI.
// Auth via the Salla PASETO token Salla passes in the iframe URL.
// ============================================================
function authIframeRequest(req, res) {
  const decoded = decodeSallaToken(req.query.token || req.body.token);
  const merchantId = decoded?.data?.merchant_id;
  if (!merchantId) {
    res.status(401).json({ error: "unauthorized — missing or invalid Salla token" });
    return null;
  }
  return merchantId;
}

app.get("/api/settings", (req, res) => {
  const merchantId = authIframeRequest(req, res);
  if (!merchantId) return;
  res.json(loadSettings(merchantId));
});

app.post("/api/settings", (req, res) => {
  const merchantId = authIframeRequest(req, res);
  if (!merchantId) return;
  const saved = saveSettings(merchantId, req.body || {});
  res.json({ ok: true, settings: saved });
});

// GET /embed/refresh
// Force a fresh analysis for the merchant identified in the iframe token,
// then redirect back to /embed (preserving the original query string).
app.get("/embed/refresh", async function (req, res) {
  const decoded = decodeSallaToken(req.query.token);
  const merchantId = decoded?.data?.merchant_id;
  if (merchantId) {
    const accessToken = await getAccessTokenForMerchant(merchantId);
    if (accessToken) {
      try {
        await analyzeStore(merchantId, SallaAPI, accessToken, loadSettings(merchantId)?.seoFixer?.storeUrl);
      } catch (err) {
        console.error("[/embed/refresh] failed:", err.message);
      }
    }
  }
  // Preserve original query so the iframe context (token, app_id, etc.) survives
  const qs = new URLSearchParams(req.query).toString();
  res.redirect("/embed" + (qs ? "?" + qs : ""));
});

// GET /embed
// Iframe view loaded inside the merchant's Salla dashboard.
// Salla passes ?token=<paseto>&app_id=... — we decode it to get merchant_id,
// then look up that merchant's saved access_token and run a real analysis.
app.get("/embed", async function (req, res) {
  const decoded = decodeSallaToken(req.query.token);
  const merchantId = decoded?.data?.merchant_id || req.query.store_id || req.query.merchant_id;

  let result = merchantId ? loadAnalysis(merchantId) : null;
  let isReal = !!result;
  let installNeeded = false;

  // If we have a merchant but no cached analysis, try to run one now using their saved access token
  if (merchantId && !result) {
    const accessToken = await getAccessTokenForMerchant(merchantId);
    if (accessToken) {
      try {
        result = await analyzeStore(merchantId, SallaAPI, accessToken, loadSettings(merchantId)?.seoFixer?.storeUrl);
        isReal = true;
      } catch (err) {
        console.error("[Embed] Analysis failed for merchant", merchantId, err.message);
      }
    } else {
      // Merchant ID is in token but we don't have an OAuth token saved → app not installed yet
      installNeeded = true;
    }
  }

  const data = result || DemoData;
  const refreshQs = new URLSearchParams(req.query).toString();
  const settings = merchantId ? loadSettings(merchantId) : null;
  let planInfo = { plan: "free", source: "default" };
  if (merchantId) {
    const accessToken = await getAccessTokenForMerchant(merchantId);
    planInfo = await getMerchantPlan(merchantId, accessToken);
  }
  res.render("embed.html", {
    analysis: data.analysis,
    pagespeed: data.pagespeed || null,
    analyzedAt: new Date(data.analyzedAt).toLocaleString("ar-SA"),
    productsAnalyzed: data.productsAnalyzed,
    isReal: isReal,
    installNeeded: installNeeded,
    merchantId: merchantId || null,
    refreshQs: refreshQs,
    settings: settings,
    iframeToken: req.query.token || "",
    plan: planInfo.plan,
    planInfo: planInfo,
    plansCatalog: CATALOG,
  });
});

// GET /demo
// Public demo - shows what the analysis looks like with sample data (no login required)
app.get("/demo", function (req, res) {
  res.render("analysis.html", {
    isLogin: req.user,
    isDemo: true,
    analysis: DemoData.analysis,
    analyzedAt: new Date(DemoData.analyzedAt).toLocaleString('ar-SA'),
    productsAnalyzed: DemoData.productsAnalyzed,
    pending: false,
  });
});

// GET /analysis
// Show SEO/CRO analysis for the authenticated merchant.
// If no cached analysis exists yet, run one synchronously so the page shows real data.
app.get("/analysis", ensureAuthenticated, async function (req, res) {
  const merchantId = req.user?.merchant?.id;
  let saved = merchantId ? loadAnalysis(merchantId) : null;

  // First-time visit after install — try to generate the analysis now
  if (merchantId && !saved) {
    const accessToken = await getAccessTokenForMerchant(merchantId) || SallaAPI.getToken();
    if (accessToken) {
      try {
        saved = await analyzeStore(merchantId, SallaAPI, accessToken, loadSettings(merchantId)?.seoFixer?.storeUrl);
      } catch (err) {
        console.error("[/analysis] Inline analyze failed:", err.message);
      }
    }
  }

  const settings = merchantId ? loadSettings(merchantId) : null;
  let planInfo = { plan: "free", source: "default" };
  if (merchantId) {
    const accessToken = await getAccessTokenForMerchant(merchantId) || SallaAPI.getToken();
    planInfo = await getMerchantPlan(merchantId, accessToken);
  }

  res.render("analysis.html", {
    isLogin: req.user,
    analysis: saved?.analysis || null,
    pagespeed: saved?.pagespeed || null,
    pagespeedPending: !!saved?.pagespeedPending,
    analyzedAt: saved?.analyzedAt ? new Date(saved.analyzedAt).toLocaleString('ar-SA') : null,
    productsAnalyzed: saved?.productsAnalyzed || 0,
    pending: false,
    settings: settings,
    merchantId: merchantId || null,
    plan: planInfo.plan,
    planInfo: planInfo,
    plansCatalog: CATALOG,
  });
});

// API for the main-site analysis page (uses session auth, not iframe token)
app.get("/api/my-settings", ensureAuthenticated, function (req, res) {
  const merchantId = req.user?.merchant?.id;
  if (!merchantId) return res.status(401).json({ error: "no merchant" });
  res.json(loadSettings(merchantId));
});

app.post("/api/my-settings", ensureAuthenticated, function (req, res) {
  const merchantId = req.user?.merchant?.id;
  if (!merchantId) return res.status(401).json({ error: "no merchant" });
  const saved = saveSettings(merchantId, req.body || {});
  res.json({ ok: true, settings: saved });
});

// Session-authenticated counterparts for the main-site analysis page
async function getMyMerchantData(req, res, sallaUrl) {
  const merchantId = req.user?.merchant?.id;
  if (!merchantId) return res.status(401).json({ data: [] });
  const accessToken = await getAccessTokenForMerchant(merchantId) || SallaAPI.getToken();
  if (!accessToken) return res.json({ data: [] });
  try {
    const data = await SallaAPI.fetchResource({ url: sallaUrl, token: accessToken });
    res.json(data || { data: [] });
  } catch (err) {
    console.error("[API] getMyMerchantData failed:", err.message);
    res.json({ data: [] });
  }
}

app.get("/api/my-merchant-products", ensureAuthenticated, (req, res) =>
  getMyMerchantData(req, res, "https://api.salla.dev/admin/v2/products?per_page=100")
);

// ============================================================
// Leads APIs — return collected emails per merchant
// ============================================================

// Iframe-token authenticated
app.get("/api/leads", (req, res) => {
  const merchantId = authIframeRequest(req, res);
  if (!merchantId) return;
  res.json({ leads: loadLeads(merchantId) });
});

app.get("/api/leads/export", async (req, res) => {
  const merchantId = authIframeRequest(req, res);
  if (!merchantId) return;
  const accessToken = await getAccessTokenForMerchant(merchantId);
  const { plan } = await getMerchantPlan(merchantId, accessToken);
  if (!planAllows(plan, "leadsExport")) {
    return res.status(402).json({ error: "CSV export requires Business plan", plan, upgradeRequired: "business" });
  }
  const csv = toCSV(loadLeads(merchantId));
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=leads_${merchantId}.csv`);
  res.send("﻿" + csv); // BOM so Excel reads UTF-8 (Arabic) correctly
});

// Session-authenticated (for the main /analysis page)
app.get("/api/my-leads", ensureAuthenticated, (req, res) => {
  const merchantId = req.user?.merchant?.id;
  if (!merchantId) return res.status(401).json({ leads: [] });
  res.json({ leads: loadLeads(merchantId) });
});

app.get("/api/my-leads/export", ensureAuthenticated, async (req, res) => {
  const merchantId = req.user?.merchant?.id;
  if (!merchantId) return res.status(401).send("Unauthorized");
  const accessToken = await getAccessTokenForMerchant(merchantId);
  const { plan } = await getMerchantPlan(merchantId, accessToken);
  if (!planAllows(plan, "leadsExport")) {
    return res.status(402).json({ error: "CSV export requires Business plan", plan, upgradeRequired: "business" });
  }
  const csv = toCSV(loadLeads(merchantId));
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=leads_${merchantId}.csv`);
  res.send("﻿" + csv);
});

app.get("/api/my-merchant-categories", ensureAuthenticated, (req, res) =>
  getMyMerchantData(req, res, "https://api.salla.dev/admin/v2/categories?per_page=100")
);

// POST /api/auto-fix-seo
// Test/dev tool — pads short titles/descriptions, adds missing meta + SKU
// on all merchant products via the Salla API so the rule-based SEO score
// climbs. Useful for verifying what the score actually measures.
app.post("/api/auto-fix-seo", ensureAuthenticated, async function (req, res) {
  const merchantId = req.user?.merchant?.id;
  if (!merchantId) return res.status(401).json({ error: "no merchant" });
  const accessToken = await getAccessTokenForMerchant(merchantId);
  if (!accessToken) return res.status(400).json({ error: "no access token saved — reinstall the app" });
  const { plan } = await getMerchantPlan(merchantId, accessToken);
  if (!planAllows(plan, "autoFixProducts")) {
    return res.status(402).json({ error: "auto-fix requires Business plan", plan, upgradeRequired: "business" });
  }
  try {
    const stats = await autoFixProducts(accessToken);
    // Invalidate cached analysis so the next /analysis re-runs against the updated products
    try {
      const cachePath = path.join(__dirname, "data", `analysis_${merchantId}.json`);
      if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath);
    } catch (e) {}
    res.json({ ok: true, stats });
  } catch (err) {
    console.error("[auto-fix-seo] failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /analysis/refresh
// Re-run the analysis synchronously, then redirect back to /analysis
app.get("/analysis/refresh", ensureAuthenticated, async function (req, res) {
  const merchantId = req.user?.merchant?.id;
  const accessToken = await getAccessTokenForMerchant(merchantId) || SallaAPI.getToken();

  if (!merchantId || !accessToken) {
    return res.redirect("/analysis");
  }

  try {
    await analyzeStore(merchantId, SallaAPI, accessToken, loadSettings(merchantId)?.seoFixer?.storeUrl);
  } catch (err) {
    console.error("[/analysis/refresh] failed:", err.message);
  }
  res.redirect("/analysis");
});

// GET /api/pagespeed
// Lightweight poll endpoint for the PageSpeed card. The analysis itself
// renders instantly; the slow Lighthouse audit runs in the background and
// this reports {pending} until it lands. Works for the session dashboard
// (req.user) and the Salla iframe (?token=).
app.get("/api/pagespeed", async function (req, res) {
  let merchantId = req.user?.merchant?.id;
  if (!merchantId && req.query.token) {
    merchantId = decodeSallaToken(req.query.token)?.data?.merchant_id;
  }
  if (!merchantId) return res.json({ pending: false, pagespeed: null });
  const saved = loadAnalysis(merchantId);
  if (!saved) return res.json({ pending: false, pagespeed: null });
  res.json({ pending: !!saved.pagespeedPending, pagespeed: saved.pagespeed || null });
});

// GET /logout
//   logout from passport
app.get("/logout", function (req, res) {
  SallaAPI.logout();
  req.logout(function (err) {
    if (err) { return next(err); }
    res.redirect("/");
  });
});

app.listen(port, async () => {
  console.log(`🚀 Server is running on http://localhost:${port}`);

  // Auto-start tunnel in development when NGROK_AUTHTOKEN is set
  if (process.env.NGROK_AUTHTOKEN) {
    try {
      const ngrok = require("@ngrok/ngrok");
      const listener = await ngrok.forward({
        addr: port,
        authtoken: process.env.NGROK_AUTHTOKEN,
      });
      const url = listener.url();
      console.log(`🌐 Public URL: ${url}`);
      console.log(`   OAuth Callback: ${url}/oauth/callback`);
      console.log(`   Webhook URL:    ${url}/webhook`);
    } catch (err) {
      console.error("ngrok failed:", err.message);
    }
  }
});


// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed. Otherwise, the user will be redirected to the
//   login page.
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/login");
}
