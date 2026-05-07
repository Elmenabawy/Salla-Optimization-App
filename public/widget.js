(function () {
  // Hardcoded API base — Cloudflare Rocket Loader on Salla storefronts
  // rewrites script execution order, so deriving the origin from the last
  // <script> tag picks up unrelated 3rd-party scripts (sift, etc).
  var apiBase = "https://salla-optimization-app-production.up.railway.app";

  // Try to find our own script tag for the ?store= param (Rocket Loader
  // moves it but we can match by src host)
  var self = (function () {
    var all = document.getElementsByTagName("script");
    for (var i = 0; i < all.length; i++) {
      if (all[i].src && all[i].src.indexOf("/widget.js") !== -1) return all[i];
    }
    return null;
  })();

  // Get the store/merchant ID from multiple possible sources
  function getStoreId() {
    // 1. From this script's own src — the most reliable when Salla
    //    expands template vars like ?store={{ store.id }}
    try {
      if (self && self.src) {
        var m = self.src.match(/[?&]store=([^&]+)/);
        if (m && m[1] && m[1] !== "{{" && m[1].indexOf("store.id") === -1) {
          return decodeURIComponent(m[1]);
        }
      }
      // Fallback: scan all scripts for ?store= pattern
      var all = document.getElementsByTagName("script");
      for (var i = 0; i < all.length; i++) {
        if (all[i].src && all[i].src.indexOf("/widget.js") !== -1) {
          var mm = all[i].src.match(/[?&]store=([^&]+)/);
          if (mm && mm[1] && mm[1] !== "{{" && mm[1].indexOf("store.id") === -1) {
            return decodeURIComponent(mm[1]);
          }
        }
      }
    } catch (e) {}
    // 2. From Salla's storefront global (lowercase)
    try {
      if (window.salla && window.salla.config) {
        var v = (window.salla.config.get && window.salla.config.get("store.id"))
          || (window.salla.config.store && window.salla.config.store.id);
        if (v) return v;
      }
    } catch (e) {}
    // 3. From Salla global (capital)
    try {
      if (window.Salla && window.Salla.config) {
        var v2 = window.Salla.config.get && window.Salla.config.get("store.id");
        if (v2) return v2;
      }
    } catch (e) {}
    // 4. Meta tag fallback
    var meta = document.querySelector('meta[name="salla-store-id"]');
    if (meta && meta.content) return meta.content;
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
      ".alfa-wa{position:fixed;width:60px;height:60px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,.18);z-index:99999;cursor:pointer;text-decoration:none;transition:transform .2s ease}" +
      ".alfa-wa:hover{transform:scale(1.08)}" +
      ".alfa-bar{position:relative;width:100%;text-align:center;padding:10px;font-family:system-ui,sans-serif;font-weight:700;font-size:14px;z-index:99998;box-shadow:0 2px 8px rgba(0,0,0,.1)}" +
      ".alfa-cart{position:fixed;padding:12px 24px;border-radius:30px;font-family:system-ui,sans-serif;font-weight:700;text-decoration:none;box-shadow:0 4px 12px rgba(0,0,0,.2);z-index:99997;animation:alfaFade .4s ease;cursor:pointer;user-select:none}" +
      ".alfa-cart:hover{box-shadow:0 6px 16px rgba(0,0,0,.25)}" +
      ".alfa-cart.dragging{opacity:.85;transition:none}" +
      "@keyframes alfaFade{from{opacity:0}to{opacity:1}}";
    document.head.appendChild(s);
  }

  // Apply a 6-way position to a fixed element (and its mirror for "center" cases)
  function applyPosition(el, pos, offsetX, offsetY) {
    offsetX = offsetX || 20;
    offsetY = offsetY || 20;
    el.style.top = el.style.bottom = el.style.left = el.style.right = el.style.transform = "";
    var p = (pos || "bottom-right").toLowerCase();
    if (p.indexOf("top") === 0) el.style.top = offsetY + "px";
    else el.style.bottom = offsetY + "px";
    if (p.indexOf("right") !== -1) el.style.right = offsetX + "px";
    else if (p.indexOf("left") !== -1) el.style.left = offsetX + "px";
    else { el.style.left = "50%"; el.style.transform = "translateX(-50%)"; }
  }

  function renderWhatsApp(opts) {
    if (!opts.enabled) return;
    if (!opts.number) {
      console.warn("[Alfa Widget] WhatsApp enabled but no number configured");
      return;
    }
    var num = String(opts.number).replace(/\D/g, "");
    if (!num) return;
    var msg = encodeURIComponent(opts.message || "");
    var iconColor = opts.iconColor || "#FFFFFF";
    var a = document.createElement("a");
    a.className = "alfa-wa";
    a.href = "https://wa.me/" + num + (msg ? "?text=" + msg : "");
    a.target = "_blank";
    a.rel = "noopener";
    a.setAttribute("aria-label", "WhatsApp");
    a.style.background = opts.color || "#25D366";
    a.innerHTML = '<svg width="32" height="32" viewBox="0 0 24 24" fill="' + iconColor + '"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';
    document.body.appendChild(a);
    applyPosition(a, opts.position || "bottom-right", 20, 20);
  }

  function renderShippingBar(opts) {
    if (!opts.enabled) return;
    var text = (opts.text || "")
      .replace("{threshold}", opts.threshold)
      .replace("{currency}", opts.currency || "");
    var bar = document.createElement("div");
    bar.className = "alfa-bar";
    bar.textContent = text;
    var c1 = opts.bgColor || "#0d9488";
    var c2 = opts.bgColor2 || c1;
    bar.style.background = "linear-gradient(135deg," + c1 + "," + c2 + ")";
    bar.style.color = opts.textColor || "#FFFFFF";
    // Insert at the very top of body so the storefront's header sits below it
    document.body.insertBefore(bar, document.body.firstChild);
  }

  function renderStickyCart(opts) {
    if (!opts.enabled) return;
    var a = document.createElement("a");
    a.className = "alfa-cart";
    a.href = "/cart";
    a.textContent = opts.text || "🛒 أكمل طلبك";
    a.style.background = opts.bgColor || "#0d9488";
    a.style.color = opts.textColor || "#FFFFFF";
    document.body.appendChild(a);
    applyPosition(a, opts.position || "bottom-center", opts.offsetX, opts.offsetY);
    enableDrag(a);
  }

  // Allow user to drag the sticky cart anywhere; on drop it snaps to the
  // nearest screen edge for a clean look. Position is NOT persisted back to
  // the server (user changes position by editing settings in the app).
  function enableDrag(el) {
    var dragging = false, startX, startY, origX, origY, moved = false;
    function onDown(e) {
      var pt = e.touches ? e.touches[0] : e;
      dragging = true; moved = false;
      startX = pt.clientX; startY = pt.clientY;
      var rect = el.getBoundingClientRect();
      origX = rect.left; origY = rect.top;
      el.classList.add("dragging");
      e.preventDefault();
    }
    function onMove(e) {
      if (!dragging) return;
      var pt = e.touches ? e.touches[0] : e;
      var dx = pt.clientX - startX, dy = pt.clientY - startY;
      if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
      el.style.left = (origX + dx) + "px";
      el.style.top = (origY + dy) + "px";
      el.style.right = ""; el.style.bottom = ""; el.style.transform = "";
    }
    function onUp() {
      if (!dragging) return;
      dragging = false;
      el.classList.remove("dragging");
      // Snap to nearest edge
      var rect = el.getBoundingClientRect();
      var w = window.innerWidth, h = window.innerHeight;
      var distances = {
        left: rect.left,
        right: w - rect.right,
        top: rect.top,
        bottom: h - rect.bottom,
      };
      var nearest = Object.keys(distances).reduce(function (a, b) {
        return distances[a] < distances[b] ? a : b;
      });
      el.style.transition = "all .25s ease";
      if (nearest === "left") el.style.left = "20px";
      if (nearest === "right") { el.style.left = ""; el.style.right = "20px"; }
      if (nearest === "top") { el.style.top = "20px"; }
      if (nearest === "bottom") { el.style.top = ""; el.style.bottom = "20px"; }
      setTimeout(function () { el.style.transition = ""; }, 300);
    }
    function onClick(e) { if (moved) { e.preventDefault(); e.stopPropagation(); } }
    el.addEventListener("mousedown", onDown);
    el.addEventListener("touchstart", onDown, { passive: false });
    document.addEventListener("mousemove", onMove);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchend", onUp);
    el.addEventListener("click", onClick, true);
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
