(function () {
  // Find this script's own URL so we can build absolute URLs back to our server
  var scripts = document.getElementsByTagName("script");
  var self = scripts[scripts.length - 1];
  var apiBase = (function () {
    try { return new URL(self.src).origin; } catch (e) { return ""; }
  })();

  // Get the store/merchant ID from Salla's storefront context
  function getStoreId() {
    try {
      if (window.salla && window.salla.config) {
        return (
          window.salla.config.get("store.id") ||
          (window.salla.config.store && window.salla.config.store.id)
        );
      }
    } catch (e) {}
    return null;
  }

  function fetchConfig(cb) {
    var storeId = getStoreId();
    if (!storeId) return cb(null);
    var xhr = new XMLHttpRequest();
    xhr.open("GET", apiBase + "/api/widget-config?store=" + encodeURIComponent(storeId), true);
    xhr.onload = function () {
      try { cb(JSON.parse(xhr.responseText)); } catch (e) { cb(null); }
    };
    xhr.onerror = function () { cb(null); };
    xhr.send();
  }

  function injectStyles() {
    if (document.getElementById("alfa-widget-styles")) return;
    var s = document.createElement("style");
    s.id = "alfa-widget-styles";
    s.innerHTML =
      ".alfa-wa{position:fixed;bottom:20px;width:60px;height:60px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,.18);z-index:99999;cursor:pointer;text-decoration:none;transition:transform .2s ease;animation:alfaPulse 2s infinite}" +
      ".alfa-wa:hover{transform:scale(1.08)}" +
      ".alfa-wa.r{right:20px}.alfa-wa.l{left:20px}" +
      "@keyframes alfaPulse{0%,100%{box-shadow:0 4px 16px rgba(37,211,102,.4)}50%{box-shadow:0 4px 24px rgba(37,211,102,.7)}}" +
      ".alfa-bar{position:fixed;top:0;left:0;right:0;background:linear-gradient(135deg,#0d9488,#2563eb);color:#fff;text-align:center;padding:10px;font-family:system-ui,sans-serif;font-weight:700;font-size:14px;z-index:99998;box-shadow:0 2px 8px rgba(0,0,0,.1)}" +
      ".alfa-cart{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#0d9488;color:#fff;padding:12px 24px;border-radius:30px;font-family:system-ui,sans-serif;font-weight:700;text-decoration:none;box-shadow:0 4px 12px rgba(0,0,0,.2);z-index:99997;animation:alfaSlide .5s ease}" +
      "@keyframes alfaSlide{from{opacity:0;transform:translate(-50%,30px)}to{opacity:1;transform:translate(-50%,0)}}";
    document.head.appendChild(s);
  }

  function renderWhatsApp(opts) {
    if (!opts.enabled || !opts.number) return;
    var num = String(opts.number).replace(/\D/g, "");
    if (!num) return;
    var msg = encodeURIComponent(opts.message || "");
    var a = document.createElement("a");
    a.className = "alfa-wa " + (opts.position === "bottom-left" ? "l" : "r");
    a.href = "https://wa.me/" + num + (msg ? "?text=" + msg : "");
    a.target = "_blank";
    a.rel = "noopener";
    a.setAttribute("aria-label", "WhatsApp");
    a.style.background = opts.color || "#25D366";
    a.innerHTML = '<svg width="32" height="32" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';
    document.body.appendChild(a);
  }

  function renderShippingBar(opts) {
    if (!opts.enabled) return;
    var text = (opts.text || "")
      .replace("{threshold}", opts.threshold)
      .replace("{currency}", opts.currency || "");
    var bar = document.createElement("div");
    bar.className = "alfa-bar";
    bar.textContent = text;
    document.body.insertBefore(bar, document.body.firstChild);
  }

  function renderStickyCart(opts) {
    if (!opts.enabled) return;
    var a = document.createElement("a");
    a.className = "alfa-cart";
    a.href = "/cart";
    a.textContent = opts.text || "🛒 أكمل طلبك";
    document.body.appendChild(a);
  }

  function init() {
    fetchConfig(function (cfg) {
      if (!cfg) return;
      injectStyles();
      try { renderWhatsApp(cfg.whatsapp || {}); } catch (e) {}
      try { renderShippingBar(cfg.freeShippingBar || {}); } catch (e) {}
      try { renderStickyCart(cfg.stickyCart || {}); } catch (e) {}
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
