// Sample analysis data for the public demo page
module.exports = {
  analyzedAt: new Date().toISOString(),
  productsAnalyzed: 24,
  analysis: {
    seo_audit: {
      score: 58,
      technical_issues: [
        { issue: '7 منتجات بدون صور', severity: 'high', fix: 'أضف صور عالية الجودة لكل منتج (3 صور على الأقل) لتحسين ظهور المنتج في نتائج البحث' },
        { issue: '12 منتج لديه صورة واحدة فقط', severity: 'medium', fix: 'أضف صور إضافية من زوايا مختلفة (3-5 صور) لزيادة الثقة وتحسين معدل التحويل' },
        { issue: 'وصف المتجر مفقود أو قصير', severity: 'high', fix: 'اكتب وصفاً للمتجر يشمل: ما تبيعه، لمن، ولماذا تختارك (200+ حرف)' },
        { issue: '5 منتجات بدون SKU', severity: 'low', fix: 'أضف رمز SKU فريد لكل منتج لتسهيل إدارة المخزون والتتبع' },
      ],
      on_page_problems: [
        { issue: '9 منتجات لها عنوان قصير جداً (أقل من 20 حرف)', severity: 'high', fix: 'اكتب عناوين وصفية تتراوح بين 50-70 حرف تتضمن: اسم المنتج + الميزة + العلامة التجارية' },
        { issue: '15 منتج بدون وصف كافٍ (أقل من 100 حرف)', severity: 'high', fix: 'اكتب وصفاً تفصيلياً (200-500 حرف) يشمل: المميزات، الفوائد، المواصفات، طريقة الاستخدام' },
        { issue: '20 منتج بدون Meta Description', severity: 'medium', fix: 'أضف وصف ميتا (150-160 حرف) لكل منتج يلخص الفائدة الرئيسية ويحفز على النقر' },
      ],
      keyword_opportunities: [
        { keyword_ar: 'عطور رجالية أصلية', keyword_en: 'authentic men perfumes', opportunity: 'كلمة مفتاحية ذات حجم بحث عالي في السوق السعودي - استخدمها في عناوين المنتجات' },
        { keyword_ar: 'شحن مجاني الرياض جدة', keyword_en: 'free shipping riyadh jeddah', opportunity: 'يبحث عنها العملاء بكثرة - أضفها لصفحات الشحن والمنتجات' },
        { keyword_ar: 'منتجات سعودية الصنع', keyword_en: 'made in saudi products', opportunity: 'ترند متزايد في السوق المحلي - استثمر فيه إذا كانت منتجاتك محلية' },
        { keyword_ar: 'تابي تمارا تقسيط', keyword_en: 'tabby tamara installments', opportunity: 'كلمات مرتبطة بالدفع المقسط - مهمة جداً للسوق السعودي' },
        { keyword_ar: 'هدايا للنساء السعودية', keyword_en: 'gifts for women saudi', opportunity: 'حجم بحث ممتاز خصوصاً قبل المناسبات والأعياد' },
      ],
    },
    cro_analysis: {
      score: 45,
      ux_issues: [
        { issue: '4 منتجات غير متوفرة معروضة للزوار', impact: 'high', fix: 'أخفِ المنتجات غير المتوفرة أو أضف خيار "إخطارني عند التوفر" بدلاً من إظهارها كـ "نفد المخزون"' },
        { issue: '3 منتجات بدون سعر واضح', impact: 'high', fix: 'اعرض السعر بوضوح في كل منتج - الأسعار المخفية تقلل التحويل بنسبة 30%+' },
        { issue: '14 منتج بأقل من 3 صور', impact: 'medium', fix: 'أضف 4-6 صور لكل منتج (المنتج، التفاصيل، الاستخدام، الحجم) - الصور المتعددة تزيد الثقة على الموبايل' },
      ],
      trust_issues: [
        { issue: 'لا يوجد وصف للمتجر "من نحن"', impact: 'high', fix: 'أضف صفحة "من نحن" تشرح قصة العلامة التجارية وقيمها - تزيد الثقة بنسبة 25%' },
        { issue: 'رقم التواصل غير ظاهر', impact: 'high', fix: 'أضف رقم واتساب وهاتف في الهيدر والفوتر - السوق السعودي يفضل التواصل المباشر قبل الشراء' },
        { issue: 'حسابات السوشيال ميديا قليلة', impact: 'medium', fix: 'اربط حسابات Instagram, TikTok, Snapchat - أهم منصات التسوق في السعودية' },
      ],
      funnel_dropoffs: [
        { stage: 'صفحة المنتج → السلة', issue: 'العميل قد يتردد بسبب عدم وجود معلومات شحن واضحة أو مراجعات كافية', fix: 'اعرض تكلفة الشحن المتوقعة + مدة التوصيل + المراجعات قبل زر "أضف للسلة"' },
        { stage: 'السلة → الدفع', issue: 'تخلي العملاء عن السلة بسبب رسوم شحن مفاجئة أو خطوات دفع طويلة', fix: 'قدم شحن مجاني فوق مبلغ محدد + اعرض ملخص واضح + قلل خطوات الدفع لـ 3 خطوات أو أقل' },
        { stage: 'الدفع → إكمال الطلب', issue: 'محدودية طرق الدفع تؤدي للتخلي', fix: 'فعّل: مدى، Apple Pay، تابي، تمارا، الدفع عند الاستلام - الأخير مهم جداً للسوق السعودي' },
      ],
    },
    action_plan: {
      quick_wins: [
        { action: 'أضف صور لـ 7 منتجات بدون صور', impact: 'high', description: 'أهم تحسين فوري - المنتجات بدون صور لا تحقق مبيعات' },
        { action: 'فعّل تابي وتمارا للدفع المقسط', impact: 'high', description: 'الدفع المقسط يزيد متوسط قيمة الطلب بنسبة 40%+ في السوق السعودي' },
        { action: 'أضف زر واتساب للتواصل المباشر', impact: 'high', description: '60% من العملاء السعوديين يفضلون التواصل عبر واتساب قبل الشراء' },
        { action: 'اكتب وصف "من نحن" للمتجر', impact: 'high', description: 'تزيد الثقة بنسبة 25% وتحسن معدل التحويل بشكل ملحوظ' },
        { action: 'أكمل 9 عناوين منتجات قصيرة', impact: 'medium', description: 'العناوين الطويلة الوصفية تحسن SEO وتزيد النقر من نتائج البحث' },
      ],
      long_term: [
        { action: 'أنشئ مدونة محتوى عربي لمنتجاتك', impact: 'high', description: 'المحتوى التعليمي يجذب زوار من البحث ويبني سلطة الموقع - استثمار طويل المدى لكنه الأقوى' },
        { action: 'برنامج ولاء ونقاط للعملاء', impact: 'high', description: 'يزيد معدل العودة والشراء المتكرر بنسبة 25-30% - مهم لاستدامة النمو' },
        { action: 'استراتيجية المؤثرين السعوديين', impact: 'medium', description: 'تسويق المؤثرين هو القناة الأقوى في السعودية - ابدأ بمؤثري النيش الصغار' },
        { action: 'تطبيق جوال للمتجر', impact: 'medium', description: 'العملاء السعوديين يقضون 5+ ساعات يومياً على الموبايل - التطبيق يزيد الولاء' },
      ],
    },
    ai_suggestions: {
      product_titles: [
        { original: 'عطر', improved_ar: 'عطر رجالي فاخر 100ml - عبق شرقي طويل الأمد | شحن مجاني', improved_en: 'Luxury Men\'s Oriental Perfume 100ml - Long Lasting | Free Shipping', reason: 'العنوان الأصلي عام جداً - الإضافات تحدد نوع المنتج، الحجم، الميزة، وعرض الشحن' },
        { original: 'فستان', improved_ar: 'فستان سهرة فاخر - تصميم سعودي حصري | متوفر بمقاسات S-XXL', improved_en: 'Luxury Evening Dress - Exclusive Saudi Design | Sizes S-XXL', reason: 'إضافة المناسبة، التصميم، والمقاسات تساعد العميل في اتخاذ قرار الشراء' },
        { original: 'حقيبة', improved_ar: 'حقيبة يد جلدية أصلية - تصميم 2026 | ضمان سنة كاملة', improved_en: 'Genuine Leather Handbag - 2026 Design | 1 Year Warranty', reason: 'إضافة الخامة، السنة، والضمان تزيد الثقة بشكل كبير' },
      ],
      meta_descriptions: [
        { page: 'الصفحة الرئيسية', improved_ar: 'تسوق أحدث المنتجات الأصلية بأفضل الأسعار. شحن سريع لجميع مناطق المملكة، دفع آمن، وضمان الإرجاع خلال 14 يوم.', improved_en: 'Shop authentic products at best prices. Fast shipping across Saudi Arabia, secure payment, and 14-day return guarantee.' },
        { page: 'صفحة المنتجات', improved_ar: 'تشكيلة واسعة من المنتجات المختارة بعناية. أسعار تنافسية، توصيل سريع، وخدمة عملاء على مدار الساعة.', improved_en: 'Wide selection of carefully curated products. Competitive prices, fast delivery, and 24/7 customer service.' },
        { page: 'صفحة من نحن', improved_ar: 'متجر سعودي رائد يقدم منتجات أصلية بجودة عالمية. خبرة تزيد عن 5 سنوات في خدمة العملاء بالمملكة والخليج.', improved_en: 'Leading Saudi store offering authentic products with global quality. 5+ years of customer service expertise in Saudi Arabia and the Gulf.' },
      ],
      cta_improvements: [
        { current: 'أضف للسلة', improved_ar: 'اطلب الآن - شحن مجاني 🛒', reason: 'إضافة فائدة فورية (شحن مجاني) تزيد النقر بنسبة 15-20%' },
        { current: 'اشتري الآن', improved_ar: 'احصل عليه اليوم 🚚', reason: 'التركيز على السرعة والاستلام السريع يحفز الشراء الفوري' },
        { current: 'تواصل معنا', improved_ar: 'تحدث معنا الآن على واتساب 💬', reason: 'الواتساب أكثر ألفة للعميل السعودي ويزيد التفاعل بنسبة 3x' },
        { current: 'سجل دخول', improved_ar: 'انضم إلى العائلة - عرض ترحيبي 🎁', reason: 'تحويل التسجيل من واجب إلى عرض جذاب يضاعف معدل التسجيل' },
      ],
    },
  },
};
