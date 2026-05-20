const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function saveAnalysis(merchantId, data) {
  ensureDataDir();
  fs.writeFileSync(
    path.join(DATA_DIR, `analysis_${merchantId}.json`),
    JSON.stringify(data, null, 2)
  );
}

function loadAnalysis(merchantId) {
  const file = path.join(DATA_DIR, `analysis_${merchantId}.json`);
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

// ============================================================
// Google PageSpeed Insights — real Core Web Vitals + SEO audit
// Free API, no key required (optional key for higher quota)
// ============================================================
// Retries 429/5xx with exponential backoff. PageSpeed rate-limits hard
// when called without an API key (shared per-IP quota), so a transient
// 429 shouldn't fail the whole analysis. Honors Retry-After when present.
async function fetchWithRetry(apiUrl, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 30000);
    try {
      const res = await fetch(apiUrl, { signal: ctrl.signal });
      clearTimeout(timeout);
      if (res.ok) return res.json();
      if (res.status !== 429 && res.status < 500) {
        throw new Error(`PageSpeed API ${res.status}`);
      }
      lastErr = new Error(`PageSpeed API ${res.status}`);
      if (i < attempts - 1) {
        const retryAfter = parseInt(res.headers.get("retry-after"), 10);
        const wait = Number.isFinite(retryAfter) ? retryAfter * 1000 : 1000 * 2 ** i;
        console.warn(`[PageSpeed] ${res.status} — retrying in ${wait}ms (${i + 1}/${attempts})`);
        await new Promise((r) => setTimeout(r, wait));
      }
    } catch (err) {
      clearTimeout(timeout);
      lastErr = err;
      if (err.name === "AbortError" || i === attempts - 1) break;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
  throw lastErr;
}

async function fetchPageSpeed(storeUrl) {
  if (!storeUrl) return null;
  const params = new URLSearchParams({
    url: storeUrl,
    strategy: "mobile",
  });
  ["performance", "seo", "accessibility", "best-practices"].forEach((c) => params.append("category", c));
  if (process.env.GOOGLE_PAGESPEED_API_KEY) params.set("key", process.env.GOOGLE_PAGESPEED_API_KEY);

  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`;
  try {
    console.log(`[PageSpeed] Auditing ${storeUrl} ...`);
    const data = await fetchWithRetry(apiUrl);
    const lh = data.lighthouseResult || {};
    const cats = lh.categories || {};
    const audits = lh.audits || {};
    return {
      performance: Math.round((cats.performance?.score || 0) * 100),
      seo: Math.round((cats.seo?.score || 0) * 100),
      accessibility: Math.round((cats.accessibility?.score || 0) * 100),
      bestPractices: Math.round((cats["best-practices"]?.score || 0) * 100),
      lcp: audits["largest-contentful-paint"]?.displayValue || "—",
      fcp: audits["first-contentful-paint"]?.displayValue || "—",
      cls: audits["cumulative-layout-shift"]?.displayValue || "—",
      tbt: audits["total-blocking-time"]?.displayValue || "—",
      tti: audits["interactive"]?.displayValue || "—",
      analyzedUrl: storeUrl,
    };
  } catch (err) {
    console.error("[PageSpeed] failed:", err.message);
    return null;
  }
}

async function fetchStoreData(SallaAPI, accessToken) {
  const [products, storeInfo, categories] = await Promise.allSettled([
    SallaAPI.fetchResource({ url: 'https://api.salla.dev/admin/v2/products?per_page=20', token: accessToken }),
    SallaAPI.fetchResource({ url: 'https://api.salla.dev/admin/v2/store/settings', token: accessToken }),
    SallaAPI.fetchResource({ url: 'https://api.salla.dev/admin/v2/categories', token: accessToken }),
  ]);
  return {
    products: products.status === 'fulfilled' ? products.value : null,
    storeInfo: storeInfo.status === 'fulfilled' ? storeInfo.value : null,
    categories: categories.status === 'fulfilled' ? categories.value : null,
  };
}

// ========== Rule-based analysis ==========

function analyzeSEO(storeData) {
  const products = storeData.products?.data || storeData.products || [];
  const technical_issues = [];
  const on_page_problems = [];
  const keyword_opportunities = [];

  let issuesFound = 0;
  const totalChecks = 8;

  // Check 1: Products without images
  const noImageProducts = products.filter(p => !p.images || p.images.length === 0);
  if (noImageProducts.length > 0) {
    technical_issues.push({
      issue: `${noImageProducts.length} منتج بدون صور`,
      severity: 'high',
      fix: 'أضف صور عالية الجودة لكل منتج (3 صور على الأقل) لتحسين ظهور المنتج في نتائج البحث',
    });
    issuesFound++;
  }

  // Check 2: Products with single image
  const singleImageProducts = products.filter(p => p.images && p.images.length === 1);
  if (singleImageProducts.length > products.length * 0.3) {
    technical_issues.push({
      issue: `${singleImageProducts.length} منتج لديه صورة واحدة فقط`,
      severity: 'medium',
      fix: 'أضف صور إضافية من زوايا مختلفة (3-5 صور) لزيادة الثقة وتحسين معدل التحويل',
    });
    issuesFound++;
  }

  // Check 3: Short product titles
  const shortTitles = products.filter(p => p.name && p.name.length < 20);
  if (shortTitles.length > 0) {
    on_page_problems.push({
      issue: `${shortTitles.length} منتج له عنوان قصير جداً (أقل من 20 حرف)`,
      severity: 'high',
      fix: 'اكتب عناوين وصفية تتراوح بين 50-70 حرف تتضمن: اسم المنتج + الميزة + العلامة التجارية',
    });
    issuesFound++;
  }

  // Check 4: Long product titles
  const longTitles = products.filter(p => p.name && p.name.length > 70);
  if (longTitles.length > 0) {
    on_page_problems.push({
      issue: `${longTitles.length} منتج له عنوان طويل جداً (أكثر من 70 حرف)`,
      severity: 'medium',
      fix: 'اختصر العناوين لتكون أقل من 70 حرف لتظهر كاملة في نتائج بحث جوجل',
    });
    issuesFound++;
  }

  // Check 5: Missing or short descriptions
  const shortDesc = products.filter(p => !p.description || p.description.replace(/<[^>]*>/g, '').length < 100);
  if (shortDesc.length > 0) {
    on_page_problems.push({
      issue: `${shortDesc.length} منتج بدون وصف كافٍ (أقل من 100 حرف)`,
      severity: 'high',
      fix: 'اكتب وصفاً تفصيلياً (200-500 حرف) يشمل: المميزات، الفوائد، المواصفات، طريقة الاستخدام',
    });
    issuesFound++;
  }

  // Check 6: Missing meta descriptions
  const noMeta = products.filter(p => !p.metadata_description);
  if (noMeta.length > products.length * 0.5) {
    on_page_problems.push({
      issue: `${noMeta.length} منتج بدون Meta Description`,
      severity: 'medium',
      fix: 'أضف وصف ميتا (150-160 حرف) لكل منتج يلخص الفائدة الرئيسية ويحفز على النقر',
    });
    issuesFound++;
  }

  // Check 7: Missing SKUs
  const noSku = products.filter(p => !p.sku);
  if (noSku.length > 0) {
    technical_issues.push({
      issue: `${noSku.length} منتج بدون SKU`,
      severity: 'low',
      fix: 'أضف رمز SKU فريد لكل منتج لتسهيل إدارة المخزون والتتبع',
    });
    issuesFound++;
  }

  // Check 8: Store info missing
  const storeInfo = storeData.storeInfo?.data || storeData.storeInfo || {};
  if (!storeInfo.description || storeInfo.description.length < 100) {
    technical_issues.push({
      issue: 'وصف المتجر مفقود أو قصير',
      severity: 'high',
      fix: 'اكتب وصفاً للمتجر يشمل: ما تبيعه، لمن، ولماذا تختارك (200+ حرف)',
    });
    issuesFound++;
  }

  // Keyword opportunities — extract from product names
  const arabicWords = new Set();
  products.forEach(p => {
    if (p.name) {
      p.name.split(/\s+/).filter(w => /^[؀-ۿ]+$/.test(w) && w.length > 3).forEach(w => arabicWords.add(w));
    }
  });
  const topWords = Array.from(arabicWords).slice(0, 5);
  topWords.forEach(word => {
    keyword_opportunities.push({
      keyword_ar: `${word} السعودية`,
      keyword_en: `${word} saudi arabia`,
      opportunity: 'استهدف هذه الكلمة المفتاحية في عناوين المنتجات والمحتوى لزيادة الظهور في السوق السعودي',
    });
  });

  if (keyword_opportunities.length === 0) {
    keyword_opportunities.push({
      keyword_ar: 'منتجات أصلية السعودية',
      keyword_en: 'original products saudi',
      opportunity: 'كلمة مفتاحية شائعة في السوق السعودي - استخدمها في وصف المنتجات',
    });
    keyword_opportunities.push({
      keyword_ar: 'شحن مجاني الرياض جدة',
      keyword_en: 'free shipping riyadh jeddah',
      opportunity: 'يبحث عنها العملاء بكثرة - أضفها لصفحات الشحن إن توفرت',
    });
  }

  const score = Math.max(0, Math.round(100 - (issuesFound / totalChecks) * 100));

  return { score, technical_issues, on_page_problems, keyword_opportunities };
}

function analyzeCRO(storeData) {
  const products = storeData.products?.data || storeData.products || [];
  const storeInfo = storeData.storeInfo?.data || storeData.storeInfo || {};
  const ux_issues = [];
  const trust_issues = [];
  const funnel_dropoffs = [];

  let issuesFound = 0;
  const totalChecks = 8;

  // UX: Out of stock products
  const outOfStock = products.filter(p => p.quantity === 0 || p.status === 'out');
  if (outOfStock.length > 0) {
    ux_issues.push({
      issue: `${outOfStock.length} منتج غير متوفر معروض للزوار`,
      impact: 'high',
      fix: 'أخفِ المنتجات غير المتوفرة أو أضف خيار "إخطارني عند التوفر" بدلاً من إظهارها كـ "نفد المخزون"',
    });
    issuesFound++;
  }

  // UX: Products with no price
  const noPrice = products.filter(p => !p.price || p.price.amount === 0);
  if (noPrice.length > 0) {
    ux_issues.push({
      issue: `${noPrice.length} منتج بدون سعر واضح`,
      impact: 'high',
      fix: 'اعرض السعر بوضوح في كل منتج - الأسعار المخفية تقلل التحويل بنسبة 30%+',
    });
    issuesFound++;
  }

  // UX: Few images per product (mobile viewing)
  const lowImageCount = products.filter(p => p.images && p.images.length < 3);
  if (lowImageCount.length > products.length * 0.5) {
    ux_issues.push({
      issue: `${lowImageCount.length} منتج بأقل من 3 صور`,
      impact: 'medium',
      fix: 'أضف 4-6 صور لكل منتج (المنتج، التفاصيل، الاستخدام، الحجم) - الصور المتعددة تزيد الثقة على الموبايل',
    });
    issuesFound++;
  }

  // Trust: Store description
  if (!storeInfo.description) {
    trust_issues.push({
      issue: 'لا يوجد وصف للمتجر "من نحن"',
      impact: 'high',
      fix: 'أضف صفحة "من نحن" تشرح قصة العلامة التجارية وقيمها - تزيد الثقة بنسبة 25%',
    });
    issuesFound++;
  }

  // Trust: Phone/contact
  if (!storeInfo.phone && !storeInfo.contact_phone) {
    trust_issues.push({
      issue: 'رقم التواصل غير ظاهر',
      impact: 'high',
      fix: 'أضف رقم واتساب وهاتف في الهيدر والفوتر - السوق السعودي يفضل التواصل المباشر قبل الشراء',
    });
    issuesFound++;
  }

  // Trust: Social media
  if (!storeInfo.social || Object.keys(storeInfo.social || {}).length < 2) {
    trust_issues.push({
      issue: 'حسابات السوشيال ميديا قليلة أو مفقودة',
      impact: 'medium',
      fix: 'اربط حسابات Instagram, TikTok, Snapchat - أهم منصات التسوق في السعودية',
    });
    issuesFound++;
  }

  // Funnel: Cart abandonment indicators
  funnel_dropoffs.push({
    stage: 'صفحة المنتج → السلة',
    issue: 'العميل قد يتردد بسبب عدم وجود معلومات شحن واضحة أو مراجعات كافية',
    fix: 'اعرض تكلفة الشحن المتوقعة + مدة التوصيل + المراجعات قبل زر "أضف للسلة"',
  });

  funnel_dropoffs.push({
    stage: 'السلة → الدفع',
    issue: 'تخلي العملاء عن السلة بسبب رسوم شحن مفاجئة أو خطوات دفع طويلة',
    fix: 'قدم شحن مجاني فوق مبلغ محدد + اعرض ملخص واضح + قلل خطوات الدفع لـ 3 خطوات أو أقل',
  });

  funnel_dropoffs.push({
    stage: 'الدفع → إكمال الطلب',
    issue: 'محدودية طرق الدفع تؤدي للتخلي',
    fix: 'فعّل: مدى، Apple Pay، تابي، تمارا، الدفع عند الاستلام - الأخير مهم جداً للسوق السعودي',
  });

  const score = Math.max(0, Math.round(100 - (issuesFound / totalChecks) * 100));

  return { score, ux_issues, trust_issues, funnel_dropoffs };
}

function buildActionPlan(seo, cro) {
  const quick_wins = [];
  const long_term = [];

  // High-severity issues become quick wins
  [...seo.technical_issues, ...seo.on_page_problems, ...cro.ux_issues, ...cro.trust_issues]
    .filter(i => (i.severity || i.impact) === 'high')
    .slice(0, 5)
    .forEach(i => {
      quick_wins.push({
        action: i.issue,
        impact: 'high',
        description: i.fix,
      });
    });

  // Add some standard quick wins
  quick_wins.push({
    action: 'فعّل تابي وتمارا للدفع المقسط',
    impact: 'high',
    description: 'الدفع المقسط يزيد متوسط قيمة الطلب بنسبة 40%+ في السوق السعودي',
  });

  quick_wins.push({
    action: 'أضف زر واتساب للتواصل المباشر',
    impact: 'medium',
    description: '60% من العملاء السعوديين يفضلون التواصل عبر واتساب قبل الشراء',
  });

  // Long-term strategic improvements
  long_term.push({
    action: 'أنشئ مدونة محتوى عربي لمنتجاتك',
    impact: 'high',
    description: 'المحتوى التعليمي يجذب زوار من البحث ويبني سلطة الموقع - استثمار طويل المدى لكنه الأقوى',
  });

  long_term.push({
    action: 'برنامج ولاء ونقاط للعملاء',
    impact: 'high',
    description: 'يزيد معدل العودة والشراء المتكرر بنسبة 25-30% - مهم لاستدامة النمو',
  });

  long_term.push({
    action: 'استراتيجية المؤثرين السعوديين',
    impact: 'medium',
    description: 'تسويق المؤثرين هو القناة الأقوى في السعودية - ابدأ بمؤثري النيش الصغار',
  });

  long_term.push({
    action: 'تطبيق جوال للمتجر',
    impact: 'medium',
    description: 'العملاء السعوديين يقضون 5+ ساعات يومياً على الموبايل - التطبيق يزيد الولاء',
  });

  return { quick_wins, long_term };
}

function buildAISuggestions(storeData) {
  const products = storeData.products?.data || storeData.products || [];
  const product_titles = [];
  const meta_descriptions = [];
  const cta_improvements = [];

  // Suggest improved titles for short ones
  products.filter(p => p.name && p.name.length < 30).slice(0, 5).forEach(p => {
    product_titles.push({
      original: p.name,
      improved_ar: `${p.name} - أصلي 100% | شحن مجاني للسعودية`,
      improved_en: `${p.name} - Authentic | Free Shipping in Saudi Arabia`,
      reason: 'العنوان الأصلي قصير جداً - الإضافات تزيد الثقة وتحسن SEO',
    });
  });

  if (product_titles.length === 0) {
    product_titles.push({
      original: 'مثال: قميص رجالي',
      improved_ar: 'قميص رجالي قطن 100% - مقاسات متعددة | شحن مجاني',
      improved_en: 'Men\'s Cotton Shirt - All Sizes | Free Saudi Shipping',
      reason: 'العنوان الجيد يجمع: نوع المنتج + الميزة + كلمة بيع قوية',
    });
  }

  // Meta descriptions
  meta_descriptions.push({
    page: 'الصفحة الرئيسية',
    improved_ar: 'تسوق أحدث المنتجات الأصلية بأفضل الأسعار. شحن سريع لجميع مناطق المملكة، دفع آمن، وضمان الإرجاع خلال 14 يوم.',
    improved_en: 'Shop authentic products at best prices. Fast shipping across Saudi Arabia, secure payment, and 14-day return guarantee.',
  });

  meta_descriptions.push({
    page: 'صفحة المنتجات',
    improved_ar: 'تشكيلة واسعة من المنتجات المختارة بعناية. أسعار تنافسية، توصيل سريع، وخدمة عملاء على مدار الساعة.',
    improved_en: 'Wide selection of carefully curated products. Competitive prices, fast delivery, and 24/7 customer service.',
  });

  // CTA improvements
  cta_improvements.push({
    current: 'أضف للسلة',
    improved_ar: 'اطلب الآن - شحن مجاني 🛒',
    reason: 'إضافة فائدة فورية (شحن مجاني) تزيد النقر بنسبة 15-20%',
  });

  cta_improvements.push({
    current: 'اشتري الآن',
    improved_ar: 'احصل عليه اليوم 🚚',
    reason: 'التركيز على السرعة والاستلام السريع يحفز الشراء الفوري',
  });

  cta_improvements.push({
    current: 'تواصل معنا',
    improved_ar: 'تحدث معنا الآن على واتساب 💬',
    reason: 'الواتساب أكثر ألفة للعميل السعودي ويزيد التفاعل',
  });

  return { product_titles, meta_descriptions, cta_improvements };
}

function getStoreUrl(storeData) {
  const info = storeData.storeInfo?.data || storeData.storeInfo || {};
  const candidates = [
    info.domain,
    info.url,
    info.public_url,
    info.store_url,
    info.website,
    info.full_url,
    info.subdomain && `https://${info.subdomain}.salla.sa`,
    info.username && `https://${info.username}.salla.sa`,
  ].filter(Boolean);
  for (const c of candidates) {
    if (typeof c !== "string") continue;
    const cleaned = c.trim();
    if (!cleaned) continue;
    return cleaned.startsWith("http") ? cleaned : `https://${cleaned}`;
  }
  console.warn("[SEO Analyzer] No store URL found in:", Object.keys(info));
  return null;
}

async function analyzeStore(merchantId, SallaAPI, accessToken, manualStoreUrl) {
  console.log(`[SEO Analyzer] Analyzing store for merchant ${merchantId}...`);

  const storeData = await fetchStoreData(SallaAPI, accessToken);
  // Prefer merchant-provided URL from settings (more reliable than API guesswork)
  const storeUrl = manualStoreUrl || getStoreUrl(storeData);

  // Run rule-based analysis + real PageSpeed audit in parallel
  const [pagespeed] = await Promise.all([fetchPageSpeed(storeUrl)]);

  const seo_audit = analyzeSEO(storeData);
  const cro_analysis = analyzeCRO(storeData);
  const action_plan = buildActionPlan(seo_audit, cro_analysis);
  const ai_suggestions = buildAISuggestions(storeData);

  // Combine our rule-based SEO score with Google's real SEO score (weighted 50/50)
  if (pagespeed) {
    seo_audit.realSeoScore = pagespeed.seo;
    seo_audit.combinedScore = Math.round((seo_audit.score + pagespeed.seo) / 2);
  }

  const result = {
    merchantId,
    analyzedAt: new Date().toISOString(),
    productsAnalyzed: (storeData.products?.data || storeData.products || []).length,
    storeUrl: storeUrl,
    pagespeed: pagespeed,
    analysis: { seo_audit, cro_analysis, action_plan, ai_suggestions },
  };

  saveAnalysis(merchantId, result);
  console.log(
    `[SEO Analyzer] Done: rules SEO=${seo_audit.score}/100, CRO=${cro_analysis.score}/100` +
      (pagespeed ? `, real SEO=${pagespeed.seo}, perf=${pagespeed.performance}` : "")
  );
  return result;
}

module.exports = { analyzeStore, loadAnalysis };
