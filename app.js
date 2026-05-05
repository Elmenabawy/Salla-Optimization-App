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
const port = process.argv[2] || 8082;

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
  analyzeStore(merchantId, SallaAPI, accessToken).catch(err => {
    console.error("[Webhook] Analysis failed:", err.message);
  });
}

// app.store.authorize fires after a merchant authorizes the app (Easy Mode delivers the token here)
SallaWebhook.on("app.store.authorize", async (eventBody) => {
  console.log("[Webhook] app.store.authorize received");
  const merchantId = eventBody?.merchant || eventBody?.data?.merchant?.id;
  await persistMerchantAndAnalyze(merchantId, eventBody?.data || {});
});

// app.installed fires once when the merchant first installs the app
SallaWebhook.on("app.installed", async (eventBody) => {
  console.log("[Webhook] app.installed received");
  const merchantId = eventBody?.merchant || eventBody?.data?.merchant?.id;
  await persistMerchantAndAnalyze(merchantId, eventBody?.data || {});
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
    analyzeStore(merchantId, SallaAPI, accessToken).catch(err => {
      console.error("[OAuth] Analysis failed:", err.message);
    });
  }
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

var app = express();

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

app.use((req, res, next) => SallaAPI.setExpressVerify(req, res, next));

// POST /webhook
app.post("/webhook", function (req, res) {
  SallaWebhook.checkActions(req.body, req.headers.authorization, {
    /* your args to pass to action files or listeners */
  });
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

app.get("/", async function (req, res) {
  let userDetails = {
    user: req.user,
    isLogin: req.user
  }
  if (req.user) {
    try {
      const userFromDB = await SallaDatabase.retrieveUser({ email: req.user.email }, true);
      const accessToken = userFromDB?.oauthId?.access_token || SallaAPI.getToken();
      if (accessToken) {
        const userFromAPI = await SallaAPI.getResourceOwner(accessToken);
        userDetails = { ...userDetails, ...userFromAPI };
      }
    } catch (err) {
      console.error("Error fetching user details:", err.message);
    }
  }
  res.render("index.html", userDetails);
});

// GET /account
// get account information and ensure user is authenticated

app.get("/account", ensureAuthenticated, function (req, res) {
  res.render("account.html", {
    user: req.user,
    isLogin: req.user,
  });
});

// GET /refreshToken
// get new access token

app.get("/refreshToken", ensureAuthenticated, function (req, res) {
  SallaAPI.requestNewAccessToken(SallaAPI.getRefreshToken())
    .then((token) => {
      res.render("token.html", {
        token,
        isLogin: req.user,
      });
    })
    .catch((err) => res.send(err));
});

// GET /orders
// get all orders from user store

app.get("/orders", ensureAuthenticated, async function (req, res) {
  res.render("orders.html", {
    orders: await SallaAPI.getAllOrders(),
    isLogin: req.user,
  });
});

// GET /customers
// get all customers from user store

app.get("/customers", ensureAuthenticated, async function (req, res) {
  res.render("customers.html", {
    customers: await SallaAPI.getAllCustomers(),
    isLogin: req.user,
  });
});

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
        result = await analyzeStore(merchantId, SallaAPI, accessToken);
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
  res.render("embed.html", {
    analysis: data.analysis,
    analyzedAt: new Date(data.analyzedAt).toLocaleString("ar-SA"),
    productsAnalyzed: data.productsAnalyzed,
    isReal: isReal,
    installNeeded: installNeeded,
    merchantId: merchantId || null,
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
// Show SEO/CRO analysis for the authenticated merchant
app.get("/analysis", ensureAuthenticated, function (req, res) {
  const merchantId = req.user?.merchant?.id;
  const saved = merchantId ? loadAnalysis(merchantId) : null;
  res.render("analysis.html", {
    isLogin: req.user,
    analysis: saved?.analysis || null,
    analyzedAt: saved?.analyzedAt ? new Date(saved.analyzedAt).toLocaleString('ar-SA') : null,
    productsAnalyzed: saved?.productsAnalyzed || 0,
    pending: false,
  });
});

// GET /analysis/refresh
// Re-run the analysis for the authenticated merchant
app.get("/analysis/refresh", ensureAuthenticated, async function (req, res) {
  const merchantId = req.user?.merchant?.id;
  const accessToken = req.user?.token || SallaAPI.getToken();
  if (merchantId && accessToken) {
    analyzeStore(merchantId, SallaAPI, accessToken).catch(err => {
      console.error("[SEO Analyzer] Refresh failed:", err.message);
    });
  }
  res.render("analysis.html", {
    isLogin: req.user,
    analysis: null,
    analyzedAt: null,
    productsAnalyzed: 0,
    pending: true,
  });
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
