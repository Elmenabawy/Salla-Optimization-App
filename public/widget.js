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
      ".alfa-timer{font-family:system-ui,sans-serif;border-radius:12px;padding:14px 18px;margin:14px 0;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,.08);animation:alfaFade .4s ease}" +
      ".alfa-timer-title{font-size:14px;font-weight:700;margin-bottom:8px;opacity:.95}" +
      ".alfa-timer-clock{display:flex;justify-content:center;gap:8px;font-variant-numeric:tabular-nums}" +
      ".alfa-timer-cell{background:rgba(255,255,255,.18);backdrop-filter:blur(4px);border-radius:8px;padding:6px 10px;min-width:54px}" +
      ".alfa-timer-num{font-size:22px;font-weight:900;line-height:1}" +
      ".alfa-timer-label{font-size:10px;opacity:.8;margin-top:3px}" +
      ".alfa-toast{position:fixed;bottom:20px;border-radius:12px;padding:12px 16px;font-family:system-ui,sans-serif;font-size:13px;display:flex;align-items:center;gap:10px;box-shadow:0 8px 24px rgba(0,0,0,.12);z-index:99996;max-width:320px;animation:alfaSlideIn .4s ease;border:1px solid rgba(0,0,0,.05)}" +
      ".alfa-toast.l{left:20px}.alfa-toast.r{right:20px}" +
      ".alfa-toast-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;animation:alfaPulseDot 1.5s infinite}" +
      "@keyframes alfaPulseDot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(1.4)}}" +
      "@keyframes alfaSlideIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}" +
      ".alfa-stock{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;font-family:system-ui,sans-serif;font-weight:700;font-size:13px;margin:8px 0}" +
      ".alfa-rv{margin:30px auto;padding:20px;border-radius:16px;font-family:system-ui,sans-serif;max-width:1200px}" +
      ".alfa-rv-title{font-size:18px;font-weight:800;margin-bottom:16px}" +
      ".alfa-rv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px}" +
      ".alfa-rv-item{background:#fff;border-radius:10px;overflow:hidden;text-decoration:none;color:inherit;border:1px solid #e2e8f0;transition:transform .2s,box-shadow .2s}" +
      ".alfa-rv-item:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(0,0,0,.08)}" +
      ".alfa-rv-img{width:100%;aspect-ratio:1;object-fit:cover;background:#f1f5f9}" +
      ".alfa-rv-name{padding:8px;font-size:12px;font-weight:600;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}" +
      ".alfa-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;animation:alfaFade .3s ease}" +
      ".alfa-popup{background:#fff;border-radius:20px;max-width:480px;width:100%;overflow:hidden;font-family:system-ui,sans-serif;animation:alfaPop .4s cubic-bezier(.16,1,.3,1)}" +
      ".alfa-popup-img{width:100%;aspect-ratio:16/9;object-fit:cover;background:#f1f5f9}" +
      ".alfa-popup-body{padding:24px;text-align:center}" +
      ".alfa-popup-title{font-size:24px;font-weight:900;margin-bottom:8px}" +
      ".alfa-popup-text{font-size:15px;line-height:1.6;margin-bottom:20px;opacity:.85}" +
      ".alfa-popup-btn{display:inline-block;padding:12px 28px;border-radius:10px;font-weight:800;text-decoration:none;font-size:15px;transition:transform .15s}" +
      ".alfa-popup-btn:hover{transform:scale(1.04)}" +
      ".alfa-popup-close{position:absolute;top:16px;right:16px;background:rgba(0,0,0,.1);border:none;width:34px;height:34px;border-radius:50%;cursor:pointer;font-size:20px;line-height:1;color:#475569}" +
      "@keyframes alfaPop{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}" +
      ".alfa-trust{display:flex;flex-wrap:wrap;justify-content:center;gap:16px;padding:14px;border-radius:12px;margin:14px 0;font-family:system-ui,sans-serif}" +
      ".alfa-trust-item{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:12px;font-weight:600;text-align:center;flex:1;min-width:80px}" +
      ".alfa-trust-icon{font-size:28px}" +
      ".alfa-wheel-wrap{position:relative;width:300px;height:300px;margin:20px auto}" +
      ".alfa-wheel{width:100%;height:100%;border-radius:50%;position:relative;transition:transform 4.5s cubic-bezier(.17,.67,.21,1.04);box-shadow:0 0 0 8px rgba(255,255,255,.2),0 10px 40px rgba(0,0,0,.3);overflow:hidden}" +
      ".alfa-wheel-arrow{position:absolute;top:-6px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:14px solid transparent;border-right:14px solid transparent;border-top:26px solid #1f2937;z-index:3;filter:drop-shadow(0 2px 4px rgba(0,0,0,.4))}" +
      ".alfa-wheel-hub{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:54px;height:54px;background:#fff;border-radius:50%;box-shadow:inset 0 0 0 6px rgba(0,0,0,.06),0 4px 8px rgba(0,0,0,.15);display:flex;align-items:center;justify-content:center;font-size:22px;z-index:2}" +
      ".alfa-wheel-label{position:absolute;left:50%;top:50%;width:0;height:0;display:flex;align-items:center;justify-content:center;pointer-events:none}" +
      ".alfa-wheel-label span{position:absolute;font-weight:900;color:#fff;font-size:15px;text-shadow:0 1px 3px rgba(0,0,0,.4);white-space:nowrap;transform:translateY(-100px);font-family:system-ui,sans-serif}" +
      ".alfa-gift-bar{position:fixed;left:0;right:0;padding:10px 20px;display:flex;align-items:center;gap:12px;font-family:system-ui,sans-serif;font-weight:700;font-size:13px;z-index:99998;box-shadow:0 2px 8px rgba(0,0,0,.1)}" +
      ".alfa-gift-bar.top{top:0}.alfa-gift-bar.bottom{bottom:0}" +
      ".alfa-gift-progress{flex:1;height:6px;background:rgba(255,255,255,.25);border-radius:3px;overflow:hidden}" +
      ".alfa-gift-progress-fill{height:100%;transition:width .4s ease;border-radius:3px}" +
      ".alfa-mobile-cart{position:fixed;bottom:0;left:0;right:0;padding:12px;display:none;justify-content:space-between;align-items:center;font-family:system-ui,sans-serif;z-index:99996;box-shadow:0 -4px 16px rgba(0,0,0,.12);gap:12px}" +
      "@media (max-width:768px){.alfa-mobile-cart{display:flex}}" +
      ".alfa-mobile-cart-btn{flex:1;padding:14px;border:none;border-radius:10px;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit}" +
      ".alfa-mobile-cart-qty{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.2);border-radius:10px;padding:6px 8px;color:#fff}" +
      ".alfa-mobile-cart-qty button{background:rgba(255,255,255,.3);border:none;color:#fff;width:32px;height:32px;border-radius:8px;font-size:18px;cursor:pointer;font-weight:700}" +
      ".alfa-wish-btn{position:fixed;bottom:90px;right:20px;width:54px;height:54px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:22px;box-shadow:0 4px 14px rgba(0,0,0,.18);z-index:99995;border:none;transition:transform .2s}" +
      ".alfa-wish-btn:hover{transform:scale(1.08)}" +
      ".alfa-wish-count{position:absolute;top:-4px;right:-4px;background:#fff;color:#ef4444;font-size:11px;font-weight:900;padding:2px 6px;border-radius:9999px;min-width:20px;text-align:center}" +
      ".alfa-wish-heart{position:absolute;top:8px;right:8px;width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,.6);color:#fff;border:none;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;z-index:10;transition:all .2s}" +
      ".alfa-wish-heart:hover{transform:scale(1.1)}" +
      ".alfa-wish-heart.active{background:#ef4444}" +
      ".alfa-wish-panel{position:fixed;top:0;right:0;bottom:0;width:380px;max-width:90vw;background:#fff;color:#0f172a;box-shadow:-8px 0 30px rgba(0,0,0,.18);z-index:99999;transform:translateX(100%);transition:transform .3s;display:flex;flex-direction:column;font-family:system-ui,sans-serif}" +
      ".alfa-wish-panel.open{transform:translateX(0)}" +
      ".alfa-wish-head{padding:18px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;font-weight:800}" +
      ".alfa-wish-list{flex:1;overflow-y:auto;padding:12px}" +
      ".alfa-wish-item{display:flex;gap:12px;padding:10px;border-bottom:1px solid #f1f5f9;text-decoration:none;color:inherit}" +
      ".alfa-wish-item img{width:60px;height:60px;border-radius:8px;object-fit:cover}" +
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

  // ---- Product page detection + countdown timer ----

  function isProductPage() {
    // 1. URL pattern
    if (/\/p\d+|\/product\/|\/products\//.test(location.pathname)) return true;
    // 2. Salla page-type config
    try {
      if (window.salla && salla.config && salla.config.get) {
        var pt = salla.config.get("page.type") || salla.config.get("type");
        if (pt && /^product/.test(String(pt))) return true;
      }
    } catch (e) {}
    // 3. DOM signals (product-specific custom elements/buttons)
    return !!document.querySelector(
      "salla-add-product-button, salla-product-card-buttons, [data-product-id], #product, .product-page, .product-details"
    );
  }

  // Find a node we can insert the timer beside. Tries several Salla selectors.
  function findProductInsertTarget(placement) {
    var aboveCart = [
      "salla-add-product-button",
      ".product-actions",
      ".add-to-cart",
      "form.product-form",
      ".product-buttons",
    ];
    var belowPrice = [
      ".product-price",
      ".price",
      "salla-product-price",
      ".s-product-price",
    ];
    var list = placement === "below-price" ? belowPrice.concat(aboveCart) : aboveCart.concat(belowPrice);
    for (var i = 0; i < list.length; i++) {
      var el = document.querySelector(list[i]);
      if (el) return el;
    }
    return null;
  }

  function renderProductTimer(opts) {
    if (!opts.enabled) return;
    if (!isProductPage()) return;

    function endsAt() {
      if (opts.mode === "fixed" && opts.endDate) {
        var t = Date.parse(opts.endDate);
        return isNaN(t) ? null : t;
      }
      // Default: midnight tonight (local time)
      var d = new Date();
      d.setHours(23, 59, 59, 999);
      return d.getTime();
    }

    function buildEl() {
      var el = document.createElement("div");
      el.className = "alfa-timer";
      el.setAttribute("dir", "rtl");
      var c1 = opts.bgColor || "#dc2626";
      var c2 = opts.bgColor2 || c1;
      el.style.background = "linear-gradient(135deg," + c1 + "," + c2 + ")";
      el.style.color = opts.textColor || "#FFFFFF";
      el.innerHTML =
        '<div class="alfa-timer-title">' + (opts.title || "⏰ العرض ينتهي خلال") + "</div>" +
        '<div class="alfa-timer-clock">' +
        '<div class="alfa-timer-cell"><div class="alfa-timer-num" data-d>00</div><div class="alfa-timer-label">يوم</div></div>' +
        '<div class="alfa-timer-cell"><div class="alfa-timer-num" data-h>00</div><div class="alfa-timer-label">ساعة</div></div>' +
        '<div class="alfa-timer-cell"><div class="alfa-timer-num" data-m>00</div><div class="alfa-timer-label">دقيقة</div></div>' +
        '<div class="alfa-timer-cell"><div class="alfa-timer-num" data-s>00</div><div class="alfa-timer-label">ثانية</div></div>' +
        "</div>";
      return el;
    }

    function tryInsert() {
      var target = findProductInsertTarget(opts.placement);
      if (!target) return false;
      if (document.getElementById("alfa-product-timer")) return true; // already inserted
      var el = buildEl();
      el.id = "alfa-product-timer";
      target.parentNode.insertBefore(el, target);
      var pad2 = function (n) { return n < 10 ? "0" + n : "" + n; };
      var deadline = endsAt();
      function tick() {
        var diff = Math.max(0, deadline - Date.now());
        var d = Math.floor(diff / 86400000);
        var h = Math.floor((diff % 86400000) / 3600000);
        var m = Math.floor((diff % 3600000) / 60000);
        var s = Math.floor((diff % 60000) / 1000);
        el.querySelector("[data-d]").textContent = pad2(d);
        el.querySelector("[data-h]").textContent = pad2(h);
        el.querySelector("[data-m]").textContent = pad2(m);
        el.querySelector("[data-s]").textContent = pad2(s);
        if (diff <= 0 && opts.mode === "fixed") {
          clearInterval(timerId);
          el.style.opacity = ".6";
        }
      }
      tick();
      var timerId = setInterval(tick, 1000);
      return true;
    }

    if (tryInsert()) return;
    // The product element might not be in the DOM yet (Salla SPA). Retry briefly.
    var attempts = 0;
    var retryId = setInterval(function () {
      if (tryInsert() || ++attempts > 20) clearInterval(retryId);
    }, 500);
    // Also re-run on Salla SPA navigation
    if (window.salla && salla.event && salla.event.on) {
      try { salla.event.on("page::changed", function () { setTimeout(tryInsert, 300); }); } catch (e) {}
    }
  }

  // ---- Helper: get current product info from Salla / DOM ----
  function getCurrentProduct() {
    var info = { id: null, name: "", url: location.pathname, image: "", price: "", quantity: null };
    try {
      if (window.salla && salla.config && salla.config.get) {
        info.id = salla.config.get("page.id") || salla.config.get("product.id") || null;
        info.name = salla.config.get("product.name") || "";
        info.image = salla.config.get("product.image") || "";
        info.price = salla.config.get("product.price") || "";
        info.quantity = salla.config.get("product.quantity");
      }
    } catch (e) {}
    if (!info.name) {
      var h1 = document.querySelector("h1, .product-title, salla-product-title");
      if (h1) info.name = h1.textContent.trim();
    }
    if (!info.image) {
      var img = document.querySelector(".product-image img, .product-gallery img, salla-product-image img, [class*='product'] img");
      if (img) info.image = img.src;
    }
    return info;
  }

  // ---- Helper: shown-once tracking ----
  function shouldShow(key, freq) {
    if (freq === "always") return true;
    var k = "alfa-shown-" + key;
    try {
      if (freq === "session") {
        if (sessionStorage.getItem(k)) return false;
        sessionStorage.setItem(k, "1");
        return true;
      }
      if (freq === "day") {
        var today = new Date().toDateString();
        if (localStorage.getItem(k) === today) return false;
        localStorage.setItem(k, today);
        return true;
      }
    } catch (e) {}
    return true;
  }

  // ---- Social proof toaster ----
  function renderSocialProof(opts) {
    if (!opts.enabled) return;
    var msgs = (opts.messages || []).filter(Boolean);
    if (!msgs.length) return;
    var idx = 0;
    function show() {
      var t = document.createElement("div");
      t.className = "alfa-toast " + (opts.position === "bottom-right" ? "r" : "l");
      t.style.background = opts.bgColor || "#FFFFFF";
      t.style.color = opts.textColor || "#0f172a";
      t.innerHTML = '<span class="alfa-toast-dot" style="background:' + (opts.accentColor || "#10b981") + '"></span><span>' + msgs[idx] + "</span>";
      document.body.appendChild(t);
      setTimeout(function () {
        t.style.transition = "opacity .4s, transform .4s";
        t.style.opacity = "0";
        t.style.transform = "translateY(20px)";
        setTimeout(function () { t.remove(); }, 400);
      }, (opts.rotateEvery || 7000) - 500);
      idx = (idx + 1) % msgs.length;
    }
    setTimeout(show, 2000);
    setInterval(show, opts.rotateEvery || 7000);
  }

  // ---- Stock urgency badge ----
  function renderStockUrgency(opts) {
    if (!opts.enabled || !isProductPage()) return;
    var info = getCurrentProduct();
    var qty = info.quantity;
    if (qty === null || qty === undefined) {
      // Try to scrape from DOM
      var stockEl = document.querySelector("[class*='stock'], salla-product-quantity");
      if (stockEl) {
        var m = stockEl.textContent.match(/\d+/);
        if (m) qty = parseInt(m[0], 10);
      }
    }
    if (qty === null || qty === undefined || qty === "" || qty <= 0) return;
    if (qty > (opts.threshold || 5)) return;
    var msg = (opts.message || "🔥 لم يتبق سوى {count} قطعة!").replace("{count}", qty);
    var target = findProductInsertTarget("below-price");
    if (!target) return;
    var el = document.createElement("div");
    el.className = "alfa-stock";
    el.style.background = opts.bgColor || "#fef3c7";
    el.style.color = opts.textColor || "#92400e";
    el.textContent = msg;
    target.parentNode.insertBefore(el, target.nextSibling);
  }

  // ---- Recently viewed (track + render) ----
  var RV_KEY = "alfa-rv-products";
  function trackRecentlyViewed() {
    if (!isProductPage()) return;
    var info = getCurrentProduct();
    if (!info.name) return;
    try {
      var list = JSON.parse(localStorage.getItem(RV_KEY) || "[]");
      // De-dupe by URL
      list = list.filter(function (x) { return x.url !== info.url; });
      list.unshift({ name: info.name, url: info.url, image: info.image });
      list = list.slice(0, 12);
      localStorage.setItem(RV_KEY, JSON.stringify(list));
    } catch (e) {}
  }
  function renderRecentlyViewed(opts) {
    if (!opts.enabled) return;
    var list = [];
    try { list = JSON.parse(localStorage.getItem(RV_KEY) || "[]"); } catch (e) {}
    // Don't show on the page of the product the user is currently viewing
    list = list.filter(function (x) { return x.url !== location.pathname; });
    if (!list.length) return;
    var max = opts.maxItems || 8;
    list = list.slice(0, max);
    var wrap = document.createElement("div");
    wrap.className = "alfa-rv";
    wrap.style.background = opts.bgColor || "#f8fafc";
    wrap.style.color = opts.textColor || "#0f172a";
    var html = '<div class="alfa-rv-title">' + (opts.title || "🕘 شاهدت مؤخراً") + "</div>";
    html += '<div class="alfa-rv-grid">';
    list.forEach(function (p) {
      html += '<a class="alfa-rv-item" href="' + p.url + '">';
      if (p.image) html += '<img class="alfa-rv-img" src="' + p.image + '" alt="">';
      html += '<div class="alfa-rv-name">' + (p.name || "") + "</div></a>";
    });
    html += "</div>";
    wrap.innerHTML = html;
    // Insert before footer (or at end of body)
    var footer = document.querySelector("footer, .footer, salla-footer");
    if (footer) footer.parentNode.insertBefore(wrap, footer);
    else document.body.appendChild(wrap);
  }

  // ---- Trust badges ----
  function renderTrustBadges(opts) {
    if (!opts.enabled || !isProductPage()) return;
    var items = (opts.items || []).filter(function (x) { return x && (x.icon || x.text); });
    if (!items.length) return;
    var target = findProductInsertTarget(opts.placement === "below-price" ? "below-price" : "above-cart");
    if (!target) return;
    var wrap = document.createElement("div");
    wrap.className = "alfa-trust";
    wrap.style.background = opts.bgColor || "#f1f5f9";
    wrap.style.color = opts.textColor || "#0f172a";
    items.forEach(function (it) {
      wrap.innerHTML += '<div class="alfa-trust-item"><div class="alfa-trust-icon">' + (it.icon || "✓") + "</div><div>" + (it.text || "") + "</div></div>";
    });
    if (opts.placement === "below-price") target.parentNode.insertBefore(wrap, target.nextSibling);
    else target.parentNode.insertBefore(wrap, target);
  }

  // ---- Popup helper (used by exit-intent + custom popup) ----
  function showPopup(opts) {
    var overlay = document.createElement("div");
    overlay.className = "alfa-overlay";
    var popup = document.createElement("div");
    popup.className = "alfa-popup";
    popup.style.background = opts.bgColor || "#FFFFFF";
    popup.style.color = opts.textColor || "#0f172a";
    popup.style.position = "relative";
    var html = "";
    html += '<button class="alfa-popup-close" aria-label="إغلاق">×</button>';
    if (opts.imageUrl) html += '<img class="alfa-popup-img" src="' + opts.imageUrl + '" alt="">';
    html += '<div class="alfa-popup-body">';
    html += '<div class="alfa-popup-title">' + (opts.title || "") + "</div>";
    html += '<div class="alfa-popup-text">' + (opts.body || opts.message || "") + "</div>";
    if (opts.buttonText) {
      html += '<a class="alfa-popup-btn" href="' + (opts.buttonUrl || "#") + '" style="background:' + (opts.accentColor || opts.bgColor || "#0d9488") + ";color:" + (opts.buttonTextColor || opts.textColor || "#FFFFFF") + '">' + opts.buttonText + "</a>";
    }
    html += "</div>";
    popup.innerHTML = html;
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    function close() { overlay.style.transition = "opacity .25s"; overlay.style.opacity = "0"; setTimeout(function () { overlay.remove(); }, 250); }
    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
    popup.querySelector(".alfa-popup-close").addEventListener("click", close);
  }

  // ---- Exit-intent popup ----
  function renderExitIntent(opts) {
    if (!opts.enabled) return;
    if (!shouldShow("exit-intent", opts.showOnce || "session")) return;
    var fired = false;
    function trigger() {
      if (fired) return;
      fired = true;
      showPopup({
        title: opts.title,
        body: opts.message,
        buttonText: opts.buttonText,
        buttonUrl: opts.buttonUrl,
        bgColor: "#FFFFFF",
        textColor: "#0f172a",
        accentColor: opts.bgColor || "#0d9488",
        buttonTextColor: opts.textColor || "#FFFFFF",
      });
    }
    document.addEventListener("mouseleave", function (e) {
      if (e.clientY < 10 && !fired) trigger();
    });
    // Mobile fallback: trigger on visibility change after some interaction
    var seen = 0;
    document.addEventListener("scroll", function () { seen++; });
    setTimeout(function () {
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "hidden" && seen > 3) trigger();
      });
    }, 5000);
  }

  // ---- Custom popup with targeting ----
  function popupShouldShowOnPage(opts) {
    var target = (opts.targeting || "all").toLowerCase();
    if (target === "all") return true;
    if (target === "product") return isProductPage();
    var info = getCurrentProduct();
    var ids = String(opts.targetIds || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    if (target === "specific-product") {
      return isProductPage() && info.id && ids.indexOf(String(info.id)) !== -1;
    }
    if (target === "category") {
      return /\/c\d+|\/category\/|\/categories\//.test(location.pathname) ||
        ids.some(function (id) { return location.pathname.indexOf(id) !== -1; });
    }
    return true;
  }
  function renderCustomPopup(opts) {
    if (!opts.enabled) return;
    if (!popupShouldShowOnPage(opts)) return;
    if (!shouldShow("custom-popup", opts.showOnce || "session")) return;
    var trig = (opts.trigger || "delay").toLowerCase();
    function fire() {
      showPopup({
        title: opts.title,
        body: opts.body,
        imageUrl: opts.imageUrl,
        buttonText: opts.buttonText,
        buttonUrl: opts.buttonUrl,
        bgColor: opts.bgColor,
        textColor: opts.textColor,
        accentColor: opts.accentColor,
      });
    }
    if (trig === "pageload") fire();
    else if (trig === "delay") setTimeout(fire, (opts.triggerValue || 5) * 1000);
    else if (trig === "scroll") {
      var threshold = opts.triggerValue || 50;
      var done = false;
      window.addEventListener("scroll", function () {
        if (done) return;
        var scrolled = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
        if (scrolled >= threshold) { done = true; fire(); }
      });
    } else if (trig === "exit") {
      document.addEventListener("mouseleave", function (e) { if (e.clientY < 10) fire(); }, { once: true });
    }
  }

  // ---- Performance Booster ----
  // Runs FIRST (before everything else) so images that exist on initial
  // paint get lazy-loaded before they fetch. Then a MutationObserver
  // keeps applying optimizations to dynamically added content.
  function applyPerformanceBoost(opts) {
    if (!opts.enabled) return;

    function tagImage(img) {
      if (opts.lazyLoadImages && !img.hasAttribute("loading")) {
        // Don't lazy-load images already in the viewport (avoid hurting LCP)
        var rect = img.getBoundingClientRect();
        var inView = rect.top < window.innerHeight && rect.bottom > 0;
        img.setAttribute("loading", inView ? "eager" : "lazy");
      }
      if (opts.asyncDecode && !img.hasAttribute("decoding")) {
        img.setAttribute("decoding", "async");
      }
    }

    function tagIframe(f) {
      if (opts.lazyLoadIframes && !f.hasAttribute("loading")) {
        f.setAttribute("loading", "lazy");
      }
      if (opts.deferVideos) {
        // YouTube/Vimeo lazy-load: defer src until in viewport
        var src = f.getAttribute("src") || "";
        if (/(youtube|vimeo)\.com/.test(src) && !f.dataset.alfaDeferred) {
          f.dataset.alfaSrc = src;
          f.dataset.alfaDeferred = "1";
          f.removeAttribute("src");
          var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
              if (e.isIntersecting) {
                e.target.setAttribute("src", e.target.dataset.alfaSrc);
                io.unobserve(e.target);
              }
            });
          });
          io.observe(f);
        }
      }
    }

    function applyAll() {
      document.querySelectorAll("img").forEach(tagImage);
      document.querySelectorAll("iframe").forEach(tagIframe);
    }

    function addPreconnects() {
      if (!opts.preconnect) return;
      var domains = [
        "https://fonts.googleapis.com",
        "https://fonts.gstatic.com",
        "https://cdn.salla.network",
        "https://cdn.assets.salla.network",
        "https://api.salla.dev",
      ];
      domains.forEach(function (d) {
        if (document.querySelector('link[rel="preconnect"][href="' + d + '"]')) return;
        var l = document.createElement("link");
        l.rel = "preconnect";
        l.href = d;
        l.crossOrigin = "anonymous";
        document.head.appendChild(l);
      });
    }

    function optimizeFonts() {
      if (!opts.optimizeFonts) return;
      // Add font-display: swap to all custom @font-face declarations we own
      document.querySelectorAll("link[rel='stylesheet']").forEach(function (link) {
        if (/fonts\.googleapis|salla\.network/.test(link.href) && !link.href.includes("display=")) {
          link.href = link.href + (link.href.includes("?") ? "&" : "?") + "display=swap";
        }
      });
    }

    addPreconnects();
    optimizeFonts();
    applyAll();

    // Watch for dynamically added content (Salla SPA navigation, infinite scroll, etc.)
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          if (node.tagName === "IMG") tagImage(node);
          else if (node.tagName === "IFRAME") tagIframe(node);
          node.querySelectorAll && node.querySelectorAll("img").forEach(tagImage);
          node.querySelectorAll && node.querySelectorAll("iframe").forEach(tagIframe);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ---- Lead capture helper (POSTs email to our server) ----
  function saveLead(payload) {
    var storeId = getStoreId();
    if (!storeId) return;
    try {
      fetch(apiBase + "/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store: storeId,
          email: payload.email,
          source: payload.source || "widget",
          prize: payload.prize || null,
        }),
      }).catch(function () {});
    } catch (e) {}
  }

  // ---- Spin-the-Wheel Discount Popup ----
  function renderSpinWheel(opts) {
    if (!opts.enabled) return;
    if (!shouldShow("spin-wheel", opts.showOnce || "session")) return;
    setTimeout(function () { openSpinWheel(opts); }, (opts.showAfterSeconds || 15) * 1000);
  }
  function openSpinWheel(opts) {
    var slices = opts.slices || [];
    if (!slices.length) return;
    var sliceAngle = 360 / slices.length;
    var defaultColors = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#a855f7", "#ec4899", "#06b6d4", "#84cc16"];

    // Build conic-gradient for the slices
    var stops = [];
    slices.forEach(function (s, i) {
      var color = (opts.winColors && opts.winColors[i]) || defaultColors[i % defaultColors.length];
      var start = (i * sliceAngle - sliceAngle / 2 + 360) % 360;
      var end = start + sliceAngle;
      stops.push(color + " " + start + "deg " + end + "deg");
    });
    // Use 'from 0deg' so slice 0 is centered at top (under the arrow)
    var gradient = "conic-gradient(from " + (-sliceAngle / 2) + "deg, " + stops.join(", ") + ")";

    // Build label divs — each at center, rotated to its slice center
    var labelsHTML = "";
    slices.forEach(function (s, i) {
      var angle = i * sliceAngle;
      labelsHTML +=
        '<div class="alfa-wheel-label" style="transform:translate(-50%,-50%) rotate(' + angle + 'deg)">' +
        '<span style="transform:translateY(-100px) rotate(' + (-angle) + 'deg)">' + s + "</span>" +
        "</div>";
    });

    var overlay = document.createElement("div");
    overlay.className = "alfa-overlay";
    var popup = document.createElement("div");
    popup.className = "alfa-popup";
    popup.style.background = opts.bgColor || "#0d9488";
    popup.style.color = opts.textColor || "#fff";
    popup.style.position = "relative";
    popup.style.maxWidth = "440px";
    popup.innerHTML =
      '<button class="alfa-popup-close" aria-label="إغلاق">×</button>' +
      '<div class="alfa-popup-body" style="padding:24px">' +
      '<div class="alfa-popup-title">' + (opts.title || "🎁 جرّب حظك") + "</div>" +
      '<div class="alfa-popup-text">' + (opts.subtitle || "أدخل بريدك وأدر العجلة") + "</div>" +
      '<input type="email" id="alfa-sw-email" placeholder="بريدك الإلكتروني" style="width:100%;padding:12px;border-radius:10px;border:none;font-size:14px;margin-bottom:12px;text-align:center;font-family:inherit;color:#0f172a;outline:none">' +
      '<div class="alfa-wheel-wrap">' +
      '<div class="alfa-wheel-arrow"></div>' +
      '<div class="alfa-wheel" id="alfa-sw-wheel" style="background:' + gradient + '">' + labelsHTML + "</div>" +
      '<div class="alfa-wheel-hub">🎁</div>' +
      "</div>" +
      '<button class="alfa-popup-btn" id="alfa-sw-spin" style="background:#fff;color:' + (opts.bgColor || "#0d9488") + ';margin-top:12px">' + (opts.buttonText || "أدر العجلة") + "</button>" +
      '<div id="alfa-sw-result" style="margin-top:14px;font-size:18px;font-weight:900;min-height:28px"></div>' +
      "</div>";
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    function close() { overlay.style.transition = "opacity .25s"; overlay.style.opacity = "0"; setTimeout(function () { overlay.remove(); }, 250); }
    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
    popup.querySelector(".alfa-popup-close").addEventListener("click", close);

    var spun = false;
    popup.querySelector("#alfa-sw-spin").addEventListener("click", function () {
      if (spun) return;
      var emailEl = popup.querySelector("#alfa-sw-email");
      var email = emailEl.value.trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        emailEl.style.boxShadow = "0 0 0 2px #ef4444";
        emailEl.focus();
        return;
      }
      emailEl.style.boxShadow = "";
      spun = true;
      var winnerIdx = pickWinnerIndex(slices);
      var prize = slices[winnerIdx];
      // Spin 5 full turns clockwise, ending with slice center under top arrow
      var degrees = 5 * 360 - winnerIdx * sliceAngle;
      var wheel = popup.querySelector("#alfa-sw-wheel");
      wheel.style.transform = "rotate(" + degrees + "deg)";
      this.disabled = true;
      this.style.opacity = ".5";

      // Save the lead to our server
      saveLead({ email: email, source: "spin-wheel", prize: prize });

      setTimeout(function () {
        var winning = prize && !/خسرت|loss|lost|نفد/i.test(prize);
        popup.querySelector("#alfa-sw-result").innerHTML = winning
          ? "🎉 ربحت خصم <span style='color:#fbbf24'>" + prize + "</span>! تم إرسال الكوبون لبريدك"
          : "💔 حظ أوفر المرة القادمة";
      }, 4600);
    });
  }
  function pickWinnerIndex(slices) {
    // Weighted toward better outcomes (slight house edge — adjust as needed)
    return Math.floor(Math.random() * slices.length);
  }

  // ---- Free Gift Threshold Bar ----
  function renderFreeGiftBar(opts) {
    if (!opts.enabled) return;

    var currentTotal = 0;

    // Salla's cart.total can be a number OR an object like { amount: 99.5, currency: 'SAR' }
    function normalizeTotal(t) {
      if (t === null || t === undefined) return null;
      if (typeof t === "object") return Number(t.amount) || 0;
      return Number(t) || 0;
    }

    function fetchCartTotal() {
      // 1. Promise-based fetch (most reliable in Twilight themes)
      try {
        if (window.salla && salla.cart && typeof salla.cart.fetch === "function") {
          var p = salla.cart.fetch();
          if (p && typeof p.then === "function") {
            p.then(function (cart) {
              var t = cart && (cart.total !== undefined ? cart.total : cart.sub_total);
              var n = normalizeTotal(t);
              if (n !== null) { currentTotal = n; update(); }
            }).catch(function () {});
            return;
          }
        }
      } catch (e) {}

      // 2. Config (sync) — multiple possible paths
      try {
        if (window.salla && salla.config && salla.config.get) {
          var keys = ["cart.total", "store.cart.total", "cart.sub_total", "cart.subtotal"];
          for (var i = 0; i < keys.length; i++) {
            var v = salla.config.get(keys[i]);
            var n = normalizeTotal(v);
            if (n !== null && n > 0) { currentTotal = n; update(); return; }
          }
        }
      } catch (e) {}

      // 3. DOM scraping — broad set of common selectors
      var selectors = [
        "salla-cart-summary [data-total]",
        ".cart-summary .total",
        ".cart-total",
        "[data-cart-total]",
        ".total-amount",
        "[class*='cart'][class*='total']",
      ];
      for (var j = 0; j < selectors.length; j++) {
        var el = document.querySelector(selectors[j]);
        if (el) {
          var m = el.textContent.replace(/,/g, "").match(/[\d.]+/);
          if (m) { currentTotal = parseFloat(m[0]) || 0; update(); return; }
        }
      }
    }

    var bar = document.createElement("div");
    bar.className = "alfa-gift-bar " + (opts.position === "bottom" ? "bottom" : "top");
    bar.style.background = opts.bgColor || "#0d9488";
    bar.style.color = opts.textColor || "#fff";
    document.body.appendChild(bar);

    function update() {
      var threshold = opts.threshold || 200;
      var pct = Math.min(100, (currentTotal / threshold) * 100);
      var remaining = Math.max(0, threshold - currentTotal).toFixed(2);
      var text = currentTotal >= threshold
        ? (opts.textReached || "🎉 رائع! أضفنا الهدية المجانية إلى طلبك")
        : (opts.textBelow || "أضف {remaining} {currency} للحصول على هدية مجانية 🎁")
            .replace("{remaining}", remaining)
            .replace("{currency}", opts.currency || "ر.س");
      bar.innerHTML =
        '<span>' + text + '</span>' +
        '<div class="alfa-gift-progress"><div class="alfa-gift-progress-fill" style="width:' + pct + '%;background:' + (opts.progressColor || "#fbbf24") + '"></div></div>' +
        '<span style="font-weight:900;min-width:36px;text-align:center">' + Math.round(pct) + "%</span>";
    }

    update();

    // Subscribe to every Salla cart event we know of — different theme
    // versions emit different event names
    if (window.salla && salla.event && salla.event.on) {
      ["cart::updated", "cart::added", "cart::removed", "cart::ready", "cart::item.added", "cart::item.removed", "cart::changed", "salla::cart::updated"].forEach(function (ev) {
        try {
          salla.event.on(ev, function (data) {
            var t = data && (data.total !== undefined ? data.total : (data.cart && data.cart.total));
            var n = normalizeTotal(t);
            if (n !== null) { currentTotal = n; update(); }
            else fetchCartTotal();
          });
        } catch (e) {}
      });
    }

    // Fetch immediately + poll every 3 seconds as safety net
    fetchCartTotal();
    setInterval(fetchCartTotal, 3000);
  }

  // ---- Sticky Mobile Add-to-Cart ----
  function renderStickyMobileCart(opts) {
    if (!opts.enabled || !isProductPage()) return;
    var bar = document.createElement("div");
    bar.className = "alfa-mobile-cart";
    bar.style.background = opts.bgColor || "#0d9488";
    bar.style.color = opts.textColor || "#fff";
    var qtyHTML = opts.showQuantity
      ? '<div class="alfa-mobile-cart-qty"><button id="alfa-mc-minus">−</button><span id="alfa-mc-qty">1</span><button id="alfa-mc-plus">+</button></div>'
      : "";
    bar.innerHTML = qtyHTML + '<button class="alfa-mobile-cart-btn" style="background:rgba(255,255,255,.95);color:' + (opts.bgColor || "#0d9488") + '">' + (opts.addToCartText || "أضف للسلة 🛒") + "</button>";
    document.body.appendChild(bar);
    if (opts.showQuantity) {
      var q = 1, qEl = bar.querySelector("#alfa-mc-qty");
      bar.querySelector("#alfa-mc-minus").onclick = function () { if (q > 1) qEl.textContent = --q; };
      bar.querySelector("#alfa-mc-plus").onclick = function () { qEl.textContent = ++q; };
    }
    bar.querySelector(".alfa-mobile-cart-btn").onclick = function () {
      var realBtn = document.querySelector("salla-add-product-button, .add-to-cart, .product-add-to-cart");
      if (realBtn) realBtn.click();
      else { var info = getCurrentProduct(); if (info.id && window.salla && salla.cart && salla.cart.addItem) salla.cart.addItem(info.id, q); }
    };
  }

  // ---- Wishlist (localStorage) ----
  var WL_KEY = "alfa-wishlist";
  function getWishlist() { try { return JSON.parse(localStorage.getItem(WL_KEY) || "[]"); } catch (e) { return []; } }
  function setWishlist(list) { try { localStorage.setItem(WL_KEY, JSON.stringify(list)); } catch (e) {} }
  function toggleWishItem(item) {
    var list = getWishlist();
    var idx = list.findIndex(function (x) { return x.url === item.url; });
    if (idx >= 0) list.splice(idx, 1); else list.unshift(item);
    setWishlist(list);
    return idx < 0;
  }
  function renderWishlist(opts) {
    if (!opts.enabled) return;

    // === Hook into Salla's existing wishlist button ===
    // Salla product cards already have a button with aria-label="Add or remove to wishlist".
    // We DON'T add our own heart icon — we just listen for clicks on Salla's and
    // mirror the action into our localStorage so the floating panel shows the items.

    function infoFromCard(card) {
      if (!card) return null;
      var link = card.querySelector('a[href*="/p"]') || card.querySelector("a[href]");
      if (!link || !link.href) return null;
      var img = card.querySelector("img");
      var nameEl = card.querySelector(".product-title, h3, h4, salla-product-title") || link;
      return {
        url: link.href,
        name: (nameEl.textContent || "").trim(),
        image: img ? img.src : "",
      };
    }

    function syncFromSallaClick(target) {
      var card = target.closest("salla-product-card, .product-card, .product-item, [class*='product-card'], .product");
      var info = card ? infoFromCard(card) : null;
      // Fallback for product detail pages (no card around the button)
      if (!info) {
        var p = getCurrentProduct();
        if (!p.name) return;
        info = { url: location.href, name: p.name, image: p.image };
      }
      toggleWishItem(info);
      updateCount();
      openOnce();
    }

    // Click listener for Salla's wishlist buttons
    document.addEventListener("click", function (e) {
      var btn = e.target.closest('[aria-label="Add or remove to wishlist" i], [aria-label*="wishlist" i], [aria-label*="مفضلة"], [aria-label*="المفضلة"], salla-wishlist-button');
      if (!btn) return;
      // Slight delay so Salla finishes its own toggle first
      setTimeout(function () { syncFromSallaClick(btn); }, 50);
    }, true);

    // Subscribe to Salla SDK events for the most reliable sync
    if (window.salla && salla.event && salla.event.on) {
      try {
        salla.event.on("wishlist::added", function (data) {
          var p = (data && (data.product || data.payload || data)) || {};
          if (!p.name && !p.url) return;
          var list = getWishlist();
          var url = p.url || p.permalink || "";
          if (!list.some(function (x) { return x.url === url; })) {
            list.unshift({
              url: url,
              name: p.name || "",
              image: p.image || (p.images && p.images[0]) || "",
            });
            setWishlist(list);
            updateCount();
          }
        });
        salla.event.on("wishlist::removed", function (data) {
          var p = (data && (data.product || data.payload || data)) || {};
          var url = p.url || p.permalink || "";
          if (!url) return;
          setWishlist(getWishlist().filter(function (x) { return x.url !== url; }));
          updateCount();
        });
      } catch (e) {}
    }

    // === Floating button + slide-in panel (unchanged) ===
    var btn = null, panel = null, countEl = null;
    var openedOnce = false;
    function openOnce() {
      // Briefly pulse the floating button so user notices their list grew
      if (btn && !openedOnce) {
        btn.style.transform = "scale(1.18)";
        setTimeout(function () { if (btn) btn.style.transform = ""; }, 250);
      }
    }
    if (opts.floatingButton) {
      btn = document.createElement("button");
      btn.className = "alfa-wish-btn";
      btn.style.background = opts.bgColor || "#ef4444";
      btn.style.color = opts.textColor || "#fff";
      btn.innerHTML = (opts.buttonText || "❤️") + '<span class="alfa-wish-count" id="alfa-wl-count">0</span>';
      document.body.appendChild(btn);
      countEl = btn.querySelector("#alfa-wl-count");
      btn.addEventListener("click", function () { openWishPanel(); });
    }
    function updateCount() {
      var c = getWishlist().length;
      if (countEl) { countEl.textContent = c; countEl.style.display = c ? "" : "none"; }
    }
    function openWishPanel() {
      if (!panel) {
        panel = document.createElement("div");
        panel.className = "alfa-wish-panel";
        panel.innerHTML =
          '<div class="alfa-wish-head"><span>❤️ قائمة المفضلة</span><button style="background:none;border:none;cursor:pointer;font-size:24px">×</button></div>' +
          '<div class="alfa-wish-list" id="alfa-wish-list"></div>';
        document.body.appendChild(panel);
        panel.querySelector("button").addEventListener("click", function () { panel.classList.remove("open"); });
      }
      var list = getWishlist();
      panel.querySelector("#alfa-wish-list").innerHTML = list.length
        ? list.map(function (p) {
            return '<a class="alfa-wish-item" href="' + p.url + '">' +
              (p.image ? '<img src="' + p.image + '">' : "") +
              '<div style="flex:1"><div style="font-weight:600;font-size:13px">' + p.name + "</div></div></a>";
          }).join("")
        : '<div style="text-align:center;padding:40px;color:#94a3b8">قائمتك فارغة</div>';
      panel.classList.add("open");
    }
    updateCount();
  }

  // ---- Live Order Ticker ----
  function renderLiveOrderTicker(opts) {
    if (!opts.enabled) return;
    var msgs = (opts.messages || []).filter(Boolean);
    if (!msgs.length) return;
    var idx = 0;
    function tick() {
      var t = document.createElement("div");
      t.className = "alfa-toast " + (opts.position === "bottom-right" ? "r" : "l");
      t.style.background = opts.bgColor || "#FFFFFF";
      t.style.color = opts.textColor || "#0f172a";
      t.innerHTML = '<span style="font-size:22px">🛍️</span><span>' + msgs[idx] + "</span>";
      document.body.appendChild(t);
      setTimeout(function () { t.style.transition = "opacity .4s,transform .4s"; t.style.opacity = "0"; t.style.transform = "translateY(20px)"; setTimeout(function () { t.remove(); }, 400); }, (opts.showEvery || 12000) - 1500);
      idx = (idx + 1) % msgs.length;
    }
    setTimeout(tick, 4000);
    setInterval(tick, opts.showEvery || 12000);
  }

  function init() {
    fetchConfig(function (cfg) {
      if (!cfg) return;
      injectStyles();
      // Performance boost runs FIRST so it tags existing images before they load
      try { applyPerformanceBoost(cfg.performanceBoost || {}); } catch (e) {}
      try { renderWhatsApp(cfg.whatsapp || {}); } catch (e) {}
      try { renderShippingBar(cfg.freeShippingBar || {}); } catch (e) {}
      try { renderStickyCart(cfg.stickyCart || {}); } catch (e) {}
      try { renderProductTimer(cfg.productTimer || {}); } catch (e) {}
      try { renderSocialProof(cfg.socialProof || {}); } catch (e) {}
      try { renderStockUrgency(cfg.stockUrgency || {}); } catch (e) {}
      try { renderTrustBadges(cfg.trustBadges || {}); } catch (e) {}
      try { trackRecentlyViewed(); } catch (e) {}
      try { renderRecentlyViewed(cfg.recentlyViewed || {}); } catch (e) {}
      try { renderExitIntent(cfg.exitIntent || {}); } catch (e) {}
      try { renderCustomPopup(cfg.customPopup || {}); } catch (e) {}
      try { renderSpinWheel(cfg.spinWheel || {}); } catch (e) {}
      try { renderFreeGiftBar(cfg.freeGiftBar || {}); } catch (e) {}
      try { renderStickyMobileCart(cfg.stickyMobileCart || {}); } catch (e) {}
      try { renderWishlist(cfg.wishlist || {}); } catch (e) {}
      try { renderLiveOrderTicker(cfg.liveOrderTicker || {}); } catch (e) {}
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
