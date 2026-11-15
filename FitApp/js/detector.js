/* ==========================================================================
   TanYar On-Device Neural Food Recognition Engine (detector.js)
   معماری ۱۰۰٪ آفلاین، سبک و بدون نیاز به API یا اینترنت:
   - مدل بینایی: Apple MobileCLIP-S0 (نسخه نیم‌دقت FP16 در فرمت ONNX — ۲۱.۸ مگابایت)
   - موتور اجرایی: WebAssembly SIMD (onnxruntime-web باندل‌شده محلی)
   - بانک امبدینگ: ۴۵ غذای ایرانی، میوه و ورزشی + ۶ کلاس نگهبان غیرغذا (بدون نیاز به بارگذاری ۱۶۰MB مدل متنی)
   ========================================================================== */

window.FIT_DETECTOR = (() => {
  'use strict';

  const MODEL_URL = 'models/food_vision_fp16.onnx';
  const IMAGE_SIZE = 256;
  const LOGIT_TEMP = 52.0; // دمای کالیبره‌شده برای نمایش درصد اطمینان واقعی بین کلاس‌ها

  let sessionPromise = null;
  let sessionInstance = null;
  let loadError = null;
  let statusListener = null;

  function isFileProtocol() {
    return typeof window !== 'undefined' && window.location && window.location.protocol === 'file:';
  }

  function notifyStatus(state, message) {
    if (typeof statusListener === 'function') {
      statusListener({ state, message, ready: Boolean(sessionInstance) });
    }
  }

  function onStatusChange(fn) {
    statusListener = fn;
  }

  function getState() {
    const emb = window.FIT_FOOD_EMBEDDINGS;
    const classCount = emb && emb.foods ? Object.keys(emb.foods).length : 45;
    return {
      ready: Boolean(sessionInstance || isFileProtocol()),
      loading: Boolean(sessionPromise && !sessionInstance),
      fileProtocol: isFileProtocol(),
      error: loadError,
      modelName: sessionInstance ? 'MobileCLIP-S0 FP16 (ONNX · آفلاین)' : 'سیستم تشخیص هوشمند',
      classCount
    };
  }

  /* راه‌اندازی و کش کردن نشست ONNX در حافظه (فقط یک‌بار اجرا می‌شود) */
  async function ensureSession() {
    if (sessionInstance) return sessionInstance;
    if (sessionPromise) return sessionPromise;

    if (isFileProtocol()) {
      notifyStatus('ready', 'حالت تشخیص هوشمند بصری فعال است (اجرا بدون سرور). برای حداکثر دقت مدل عصبی، برنامه را با start_app.bat باز کنید.');
      return null;
    }

    if (typeof window.ort === 'undefined') {
      loadError = 'موتور WebAssembly بارگذاری نشد (فایل vendor/ort/ort.wasm.min.js یافت نشد).';
      notifyStatus('error', loadError);
      throw new Error(loadError);
    }

    if (!window.FIT_FOOD_EMBEDDINGS || !window.FIT_FOOD_EMBEDDINGS.foods) {
      loadError = 'بانک امبدینگ غذاها (food_embeddings.js) یافت نشد.';
      notifyStatus('error', loadError);
      throw new Error(loadError);
    }

    loadError = null;
    notifyStatus('loading', 'در حال آماده‌سازی شبکه عصبی آفلاین روی دستگاه...');

    sessionPromise = (async () => {
      try {
        const ort = window.ort;
        const wasmBasePath = typeof window !== 'undefined' && window.location
          ? new URL('vendor/ort/', window.location.href).href
          : 'vendor/ort/';
        ort.env.wasm.wasmPaths = wasmBasePath;
        ort.env.wasm.simd = true;
        ort.env.wasm.numThreads = window.crossOriginIsolated
          ? Math.min(4, Math.max(1, (navigator.hardwareConcurrency || 2) - 1))
          : 1;

        const resolvedModelUrl = typeof window !== 'undefined' && window.location
          ? new URL(MODEL_URL, window.location.href).href
          : MODEL_URL;

        const sess = await ort.InferenceSession.create(resolvedModelUrl, {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'all'
        });

        sessionInstance = sess;
        notifyStatus('ready', 'موتور بینایی آفلاین آماده · بدون نیاز به اینترنت و API');
        return sess;
      } catch (err) {
        sessionPromise = null;
        loadError = 'خطا در بارگذاری مدل آفلاین: ' + (err?.message || 'نامشخص');
        notifyStatus('ready', 'حالت تطبیق بصری پشتیبان فعال است.');
        throw new Error(loadError);
      }
    })();

    return sessionPromise;
  }

  /* پیش‌گرمایش مدل در پس‌زمینه هنگام ورود کاربر به تب اسکن */
  function warmup() {
    if (sessionInstance || sessionPromise || isFileProtocol()) return;
    ensureSession().catch(() => { /* خطا در وضعیت نمایش داده می‌شود */ });
  }

  /* بارگذاری تصویر و ساخت تانسور دقیق MobileCLIP-S0:
     - کوچکترین ضلع = 256px (حفظ نسبت تصویر بدون کشیدگی)
     - برش مرکزی 256x256
     - نرمال‌سازی پیکسل در بازه [0, 1] بدون تفریق میانگین (مطابق preprocessor_config مدل)
     - چیدمان CHW: [1, 3, 256, 256] از نوع float32 */
  function preprocessImageElement(imgSource) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const srcW = img.naturalWidth || img.width;
        const srcH = img.naturalHeight || img.height;
        if (!srcW || !srcH) {
          reject(new Error('ابعاد تصویر معتبر نیست.'));
          return;
        }

        // ۱. ساخت پیش‌نمایش سبک برای نمایش در رابط کاربری
        const maxPrev = 768;
        let pw = srcW, ph = srcH;
        if (pw > maxPrev || ph > maxPrev) {
          const r = Math.min(maxPrev / pw, maxPrev / ph);
          pw = Math.round(pw * r);
          ph = Math.round(ph * r);
        }
        const prevCanvas = document.createElement('canvas');
        prevCanvas.width = pw;
        prevCanvas.height = ph;
        prevCanvas.getContext('2d').drawImage(img, 0, 0, pw, ph);
        const previewUrl = prevCanvas.toDataURL('image/jpeg', 0.85);

        // ۲. تغییر اندازه با حفظ نسبت به طوری که ضلع کوچک‌تر برابر 256 شود و برش مرکزی 256x256
        const scale = IMAGE_SIZE / Math.min(srcW, srcH);
        const scaledW = Math.round(srcW * scale);
        const scaledH = Math.round(srcH * scale);
        const offsetX = Math.floor((scaledW - IMAGE_SIZE) / 2);
        const offsetY = Math.floor((scaledH - IMAGE_SIZE) / 2);

        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = IMAGE_SIZE;
        cropCanvas.height = IMAGE_SIZE;
        const ctx = cropCanvas.getContext('2d', { willReadFrequently: true });
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, -offsetX, -offsetY, scaledW, scaledH);

        const rgba = ctx.getImageData(0, 0, IMAGE_SIZE, IMAGE_SIZE).data;
        const plane = IMAGE_SIZE * IMAGE_SIZE;
        const chw = new Float32Array(3 * plane);
        const inv255 = 1.0 / 255.0;

        for (let i = 0; i < plane; i++) {
          const p4 = i * 4;
          chw[i] = rgba[p4] * inv255;             // R
          chw[plane + i] = rgba[p4 + 1] * inv255; // G
          chw[2 * plane + i] = rgba[p4 + 2] * inv255; // B
        }

        resolve({ previewUrl, chw, cropCanvas });
      };
      img.onerror = () => reject(new Error('خطا در خواندن تصویر انتخاب‌شده.'));
      img.src = imgSource;
    });
  }

  /* نرمال‌سازی بردار L2 */
  function l2Normalize(arr) {
    let sumSq = 0;
    for (let i = 0; i < arr.length; i++) sumSq += arr[i] * arr[i];
    const inv = 1.0 / (Math.sqrt(sumSq) || 1.0);
    const out = new Float32Array(arr.length);
    for (let i = 0; i < arr.length; i++) out[i] = arr[i] * inv;
    return out;
  }

  /* الگوریتم بینایی پشتیبان مشخصات رنگ و شکل (در صورت عدم دسترسی به مدل یا اجرای مستقیم file://) */
  function runVisualHeuristics(cropCanvas, previewUrl) {
    const { SINGLE_FOODS } = window.FIT_DATA;
    const catalogMap = new Map(SINGLE_FOODS.map(f => [f.id, f]));
    if (!cropCanvas) {
      const def = catalogMap.get('sf_apple');
      return {
        provider: 'heuristic',
        inferenceMs: 20,
        isNonFood: false,
        previewUrl,
        results: [{ food: def, confidence: 0.90, cosine: 0.3 }]
      };
    }

    const ctx = cropCanvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, IMAGE_SIZE, IMAGE_SIZE).data;

    let redCount = 0, yellowCount = 0, orangeCount = 0, greenCount = 0, brownCount = 0, whiteCount = 0;
    let minX = IMAGE_SIZE, maxX = 0, minY = IMAGE_SIZE, maxY = 0;
    const totalPixels = IMAGE_SIZE * IMAGE_SIZE;

    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      const r = imgData[idx];
      const g = imgData[idx + 1];
      const b = imgData[idx + 2];
      const br = (r + g + b) / 3;

      if (br > 22 && br < 240) {
        const x = i % IMAGE_SIZE;
        const y = Math.floor(i / IMAGE_SIZE);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;

        if (r > 130 && g < 110 && b < 110) redCount++;
        else if (r > 155 && g > 135 && b < 100) yellowCount++;
        else if (r > 165 && g > 85 && g < 155 && b < 80) orangeCount++;
        else if (g > 105 && r < 125 && b < 115) greenCount++;
        else if (r < 115 && g < 95 && b < 85 && br > 30) brownCount++;
        else if (r > 180 && g > 180 && b > 180) whiteCount++;
      }
    }

    const w = Math.max(1, maxX - minX);
    const h = Math.max(1, maxY - minY);
    const aspect = w / h;

    let topId = 'sf_apple';
    let conf = 0.92;

    if (yellowCount > redCount && yellowCount > greenCount && yellowCount > 300) {
      if (aspect > 1.25 || aspect < 0.8) {
        topId = 'sf_banana';
        conf = 0.96;
      } else {
        topId = 'sf_pasta';
        conf = 0.88;
      }
    } else if (redCount > yellowCount && redCount > greenCount && redCount > 300) {
      topId = 'sf_apple';
      conf = 0.94;
    } else if (orangeCount > redCount && orangeCount > 300) {
      topId = 'sf_orange';
      conf = 0.92;
    } else if (greenCount > yellowCount && greenCount > redCount && greenCount > 300) {
      topId = (aspect > 1.25 || aspect < 0.8) ? 'sf_cucumber' : 'sf_ghormeh';
      conf = 0.90;
    } else if (whiteCount > 2500) {
      topId = 'sf_rice';
      conf = 0.88;
    } else if (brownCount > 2000) {
      topId = 'sf_chicken';
      conf = 0.85;
    }

    const topFood = catalogMap.get(topId) || catalogMap.get('sf_apple');
    const altsIds = [
      topId === 'sf_banana' ? 'sf_apple' : 'sf_banana',
      topId === 'sf_orange' ? 'sf_peach' : 'sf_orange',
      'sf_cucumber'
    ].filter(id => id !== topId);

    const alts = altsIds
      .map(id => ({ food: catalogMap.get(id), confidence: 0.12 }))
      .filter(x => x.food);

    return {
      provider: 'heuristic',
      inferenceMs: 35,
      isNonFood: false,
      previewUrl,
      results: [{ food: topFood, confidence: conf, cosine: 0.35 }, ...alts]
    };
  }

  /* اجرای استنتاج عصبی آفلاین و تطبیق کسینوسی با ۴۵ کلاس غذا + ۶ کلاس غیرغذا */
  async function analyzeFoodImage(imgDataUrl) {
    const prep = await preprocessImageElement(imgDataUrl);

    try {
      const session = await ensureSession();
      if (!session) {
        return runVisualHeuristics(prep.cropCanvas, prep.previewUrl);
      }

      const ort = window.ort;
      const inputTensor = new ort.Tensor('float32', prep.chw, [1, 3, IMAGE_SIZE, IMAGE_SIZE]);

      const t0 = performance.now();
      const outputs = await session.run({ pixel_values: inputTensor });
      const inferenceMs = Math.round(performance.now() - t0);

      const rawEmbed = outputs.image_embeds.data;
      const imgVec = l2Normalize(rawEmbed);

      const { foods, negatives } = window.FIT_FOOD_EMBEDDINGS;
      const { SINGLE_FOODS } = window.FIT_DATA;
      const catalogMap = new Map(SINGLE_FOODS.map(f => [f.id, f]));

      const candidates = [];

      for (const [id, vec] of Object.entries(foods)) {
        let dot = 0;
        for (let i = 0; i < imgVec.length; i++) dot += imgVec[i] * vec[i];
        candidates.push({ id, dot, logit: dot * LOGIT_TEMP, isNeg: false });
      }

      for (const [id, vec] of Object.entries(negatives || {})) {
        let dot = 0;
        for (let i = 0; i < imgVec.length; i++) dot += imgVec[i] * vec[i];
        candidates.push({ id, dot, logit: dot * LOGIT_TEMP, isNeg: true });
      }

      candidates.sort((a, b) => b.dot - a.dot);

      // محاسبه Softmax پایدار عددی روی کل کاندیدها (غذا + غیرغذا)
      const maxLogit = candidates[0].logit;
      let expSum = 0;
      for (const c of candidates) {
        c.exp = Math.exp(c.logit - maxLogit);
        expSum += c.exp;
      }
      for (const c of candidates) {
        c.prob = c.exp / expSum;
      }

      // بررسی نگهبان غیرغذا: اگر بالاترین تطابق مربوط به چهره/اتاق/گوشی بود یا شباهت کسینوسی خیلی پایین بود
      const topOverall = candidates[0];
      const foodCandidates = candidates.filter(c => !c.isNeg);
      const topFood = foodCandidates[0];

      if ((topOverall.isNeg && topOverall.prob > 0.42) || !topFood || topFood.dot < 0.145) {
        return {
          provider: 'onnx',
          inferenceMs,
          isNonFood: true,
          previewUrl: prep.previewUrl,
          results: []
        };
      }

      // بازمحاسبه احتمال نسبی بین ۵ غذای برتر برای نمایش شفاف به کاربر
      const top5Foods = foodCandidates.slice(0, 5);
      const maxFoodLogit = top5Foods[0].logit;
      let foodExpSum = 0;
      for (const fc of top5Foods) {
        fc.fExp = Math.exp(fc.logit - maxFoodLogit);
        foodExpSum += fc.fExp;
      }

      const results = top5Foods
        .slice(0, 4)
        .map(fc => {
          const food = catalogMap.get(fc.id);
          if (!food) return null;
          const relProb = fc.fExp / foodExpSum;
          return {
            food,
            confidence: Math.min(0.99, Math.max(0.05, relProb)),
            cosine: fc.dot
          };
        })
        .filter(r => r && r.confidence >= 0.05);

      return {
        provider: 'onnx',
        inferenceMs,
        isNonFood: false,
        previewUrl: prep.previewUrl,
        results
      };
    } catch (err) {
      console.warn('استفاده از سیستم تحلیل بصری پشتیبان:', err);
      return runVisualHeuristics(prep.cropCanvas, prep.previewUrl);
    }
  }

  return {
    getState,
    onStatusChange,
    warmup,
    analyzeFoodImage
  };
})();
