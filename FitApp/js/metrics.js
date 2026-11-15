/* ==========================================================================
   TanYar Body Composition, Diet & Workout Engine (metrics.js)
   ========================================================================== */

window.FIT_METRICS = (() => {
  'use strict';

  const { GOALS, FOODS, GYM_EXERCISES, HOME_EXERCISES } = window.FIT_DATA;

  const GOAL_MAP = Object.fromEntries(GOALS.map(g => [g.id, g]));
  const FOOD_BY_ID = Object.fromEntries(FOODS.map(f => [f.id, f]));
  const GYM_BY_ID = Object.fromEntries(GYM_EXERCISES.map(e => [e.id, e]));
  const HOME_BY_ID = Object.fromEntries(HOME_EXERCISES.map(e => [e.id, e]));

  const DAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
  const MEALS = [
    { key: 'breakfast', title: 'صبحانه', share: 0.25 },
    { key: 'snack', title: 'میان‌وعده', share: 0.12 },
    { key: 'lunch', title: 'ناهار', share: 0.36 },
    { key: 'dinner', title: 'شام', share: 0.27 }
  ];

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  function getBmiCategory(bmi) {
    if (bmi < 18.5) return { label: 'کمبود وزن', color: '#60a5fa', level: 'under' };
    if (bmi < 25) return { label: 'نرمال', color: '#2dd4bf', level: 'normal' };
    if (bmi < 30) return { label: 'اضافه وزن', color: '#f5a623', level: 'over' };
    if (bmi < 35) return { label: 'چاقی درجه ۱', color: '#ff5733', level: 'obese1' };
    return { label: 'چاقی درجه ۲', color: '#e11d48', level: 'obese2' };
  }

  function getBodyFatCategory(bf, gender) {
    if (gender === 'male') {
      const zones = [
        { min: 2, max: 6, color: '#60a5fa', name: 'ضروری' },
        { min: 6, max: 14, color: '#2dd4bf', name: 'ورزشکاری' },
        { min: 14, max: 18, color: '#818cf8', name: 'فیتنس' },
        { min: 18, max: 25, color: '#f5a623', name: 'معمولی' },
        { min: 25, max: 42, color: '#ff5733', name: 'بالا' }
      ];
      if (bf < 6) return { label: 'چربی ضروری', color: '#60a5fa', zones };
      if (bf < 14) return { label: 'ورزشکاری', color: '#2dd4bf', zones };
      if (bf < 18) return { label: 'تناسب اندام', color: '#818cf8', zones };
      if (bf < 25) return { label: 'محدوده معمولی', color: '#f5a623', zones };
      return { label: 'چربی بالا', color: '#ff5733', zones };
    } else {
      const zones = [
        { min: 10, max: 14, color: '#60a5fa', name: 'ضروری' },
        { min: 14, max: 21, color: '#2dd4bf', name: 'ورزشکاری' },
        { min: 21, max: 25, color: '#818cf8', name: 'فیتنس' },
        { min: 25, max: 32, color: '#f5a623', name: 'معمولی' },
        { min: 32, max: 50, color: '#ff5733', name: 'بالا' }
      ];
      if (bf < 14) return { label: 'چربی ضروری', color: '#60a5fa', zones };
      if (bf < 21) return { label: 'ورزشکاری', color: '#2dd4bf', zones };
      if (bf < 25) return { label: 'تناسب اندام', color: '#818cf8', zones };
      if (bf < 32) return { label: 'محدوده معمولی', color: '#f5a623', zones };
      return { label: 'چربی بالا', color: '#ff5733', zones };
    }
  }

  function calculateBodyFat(p, bmi) {
    const h = p.height;
    const neck = Number(p.neck) || 0;
    const waist = Number(p.waist) || 0;
    const hip = Number(p.hip) || 0;

    if (p.gender === 'male' && neck >= 25 && waist > neck + 5 && h >= 120) {
      const navy = 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(h)) - 450;
      if (Number.isFinite(navy)) {
        return { bf: clamp(Math.round(navy * 10) / 10, 3.5, 52), method: 'navy' };
      }
    }
    if (p.gender === 'female' && neck >= 22 && waist >= 45 && hip >= 60 && (waist + hip - neck) > 20 && h >= 120) {
      const navy = 495 / (1.29579 - 0.35004 * Math.log10(waist + hip - neck) + 0.22100 * Math.log10(h)) - 450;
      if (Number.isFinite(navy)) {
        return { bf: clamp(Math.round(navy * 10) / 10, 10, 56), method: 'navy' };
      }
    }

    const isMale = p.gender === 'male' ? 1 : 0;
    const est = 1.20 * bmi + 0.23 * p.age - 10.8 * isMale - 5.4;
    const minBf = isMale ? 4.5 : 11.5;
    return { bf: clamp(Math.round(est * 10) / 10, minBf, 54), method: 'bmi_est' };
  }

  function recommendGoal(bmi, bf, gender) {
    const highBf = gender === 'male' ? 24 : 31;
    const veryHighBf = gender === 'male' ? 30 : 37;
    const midBf = gender === 'male' ? 17.5 : 25;
    const lowBf = gender === 'male' ? 12 : 19;

    if (bmi < 18.5) {
      return { id: 'bulk', reason: 'وزن شما پایین‌تر از بازه نرمال قدتان است؛ افزایش حجم و وزن بهترین انتخاب است.' };
    }
    if (bf >= veryHighBf || bmi >= 30) {
      return { id: 'cut', reason: 'کاهش وزن اصولی با پروتئین کافی بهترین مسیر برای پایین آوردن درصد چربی شماست.' };
    }
    if (bf >= highBf || bmi >= 25.5) {
      return { id: 'cut', reason: 'یک دوره چربی‌سوزی استاندارد شما را به محدوده فیتنس می‌رساند.' };
    }
    if (bf >= midBf && bmi >= 19.5 && bmi <= 25.5) {
      return { id: 'recomp', reason: 'وزن نرمالی دارید ولی برای تفکیک عضلات، «ریکامپ (فرم‌دهی همزمان)» ایده‌آل است.' };
    }
    if (bf <= lowBf && bmi < 23.5) {
      return { id: 'lean_bulk', reason: 'درصد چربی پایینی دارید؛ شرایط برای «حجم خشک» و عضله‌سازی کاملاً مهیاست.' };
    }
    return { id: 'lean_bulk', reason: 'وضعیت بدنی متعادلی دارید؛ «حجم خشک» یا «تثبیت وزن» گزینه‌های مناسبی هستند.' };
  }

  function calcAll(profile) {
    const hMeter = profile.height / 100;
    const bmi = profile.weight / (hMeter * hMeter);
    const bmiCat = getBmiCategory(bmi);

    const { bf: bodyFat, method: bfMethod } = calculateBodyFat(profile, bmi);
    const bfCat = getBodyFatCategory(bodyFat, profile.gender);

    const fatMassKg = Math.round((profile.weight * (bodyFat / 100)) * 10) / 10;
    const leanMassKg = Math.round((profile.weight - fatMassKg) * 10) / 10;
    const ffmi = Math.round((leanMassKg / (hMeter * hMeter)) * 10) / 10;

    const mifflin = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + (profile.gender === 'male' ? 5 : -161);
    const katch = 370 + 21.6 * leanMassKg;
    const bmr = Math.round(bfMethod === 'navy' ? (katch * 0.65 + mifflin * 0.35) : mifflin);

    const activity = Number(profile.activity) || 1.375;
    const tdee = Math.round((bmr * activity) / 10) * 10;
    const floor = profile.gender === 'male' ? 1450 : 1200;

    const goalObj = GOAL_MAP[profile.goal] || GOAL_MAP.maintain;
    let rawGoalKcal = tdee + goalObj.kcalDelta;
    rawGoalKcal = Math.max(rawGoalKcal, floor);

    const hasIntake = profile.intakeKnown && Number(profile.intake) >= 600;
    const currentIntake = hasIntake ? Number(profile.intake) : tdee;
    let target = hasIntake ? clamp(rawGoalKcal, currentIntake - 600, currentIntake + 550) : rawGoalKcal;
    target = Math.round(Math.max(target, floor) / 25) * 25;

    const refWeight = bmi > 28 ? (24.5 * hMeter * hMeter) : profile.weight;
    const protein = Math.round(clamp(refWeight * goalObj.proteinPerKg, 55, 240));
    const fat = Math.round((target * goalObj.fatShare) / 9);
    const carbs = Math.round(Math.max(40, (target - protein * 4 - fat * 9) / 4));

    const healthyMin = Math.round(18.5 * hMeter * hMeter * 10) / 10;
    const healthyMax = Math.round(24.9 * hMeter * hMeter * 10) / 10;
    const idealWeight = Math.round((profile.gender === 'male' ? 22.5 : 21.5) * hMeter * hMeter * 10) / 10;
    const weightDiff = Math.round((profile.weight - idealWeight) * 10) / 10;

    const recommendation = recommendGoal(bmi, bodyFat, profile.gender);

    const warnings = [];
    if (bmi < 18.5 && (profile.goal === 'cut' || profile.goal === 'hard_cut')) {
      warnings.push('شاخص توده بدنی شما زیر بازه نرمال است؛ رژیم کاهش وزن توصیه نمی‌شود.');
    }
    if (bmi >= 30 && profile.goal === 'bulk') {
      warnings.push('در BMI فعلی، مازاد کالری بالا باعث افزایش بافت چربی می‌شود؛ کاهش وزن یا ریکامپ مناسب‌تر است.');
    }
    if (hasIntake && Math.abs(target - rawGoalKcal) >= 100) {
      warnings.push(`کالری برنامه برای جلوگیری از افت ناگهانی انرژی به صورت پله‌ای از ${currentIntake.toLocaleString('fa-IR')} روی ${target.toLocaleString('fa-IR')} تنظیم شد.`);
    }

    return {
      bmi: Math.round(bmi * 10) / 10,
      bmiCat,
      bodyFat,
      bfMethod,
      bfCat,
      fatMassKg,
      leanMassKg,
      ffmi,
      bmr,
      tdee,
      floor,
      currentIntake,
      hasIntake,
      rawGoalKcal: Math.round(rawGoalKcal / 25) * 25,
      target,
      protein,
      fat,
      carbs,
      healthyMin,
      healthyMax,
      idealWeight,
      weightDiff,
      goalObj,
      recommendation,
      warnings
    };
  }

  function scaleAmount(amount, unit, mult) {
    const v = amount * mult;
    if (unit === 'گرم' || unit === 'میلی‌لیتر') {
      return v < 50 ? Math.max(5, Math.round(v / 5) * 5) : Math.round(v / 10) * 10;
    }
    return Math.max(0.5, Math.round(v * 2) / 2);
  }

  function mealKcal(entry) {
    if (!entry || !FOOD_BY_ID[entry.id]) return 0;
    return FOOD_BY_ID[entry.id].kcal * entry.mult;
  }

  function calcMealTarget(dayObj, mealMeta, dayTarget) {
    const others = MEALS.filter(m => m.key !== mealMeta.key);
    const base = dayTarget * mealMeta.share;
    if (!others.every(m => dayObj[m.key])) return base;
    const rest = dayTarget - others.reduce((sum, m) => sum + mealKcal(dayObj[m.key]), 0);
    return clamp(rest, base * 0.6, base * 1.45);
  }

  function pickSmartFood(mealKey, kcalTarget, goalId, dislikedIds, avoidSet, usageMap) {
    const pool = FOODS.filter(f => f.meal === mealKey && !dislikedIds.includes(f.id));
    if (!pool.length) return null;
    let candidates = pool.filter(f => !avoidSet.has(f.id));
    if (!candidates.length) candidates = pool;

    let best = null;
    let bestScore = Infinity;
    for (const f of candidates) {
      const ratio = kcalTarget / f.kcal;
      const fit = Math.abs(Math.log(clamp(ratio, 0.3, 3.5)));
      const outPenalty = (ratio < 0.5 || ratio > 2.2) ? 1.8 : 0;
      const goalBonus = (f.tags && f.tags.includes(goalId)) ? -0.65 : 0;
      const score = fit * 0.85 + outPenalty + (usageMap[f.id] || 0) * 0.75 + goalBonus + Math.random() * 0.85;
      if (score < bestScore) {
        bestScore = score;
        best = f;
      }
    }
    return best;
  }

  function makeFoodEntry(food, kcalTarget) {
    return {
      id: food.id,
      mult: clamp(Math.round((kcalTarget / food.kcal) * 20) / 20, 0.5, 2.5)
    };
  }

  function generateWeeklyDiet(targetKcal, goalId, dislikedIds = []) {
    const week = [];
    const usage = {};
    for (let d = 0; d < 7; d++) {
      const day = {};
      for (const m of MEALS) {
        const t = calcMealTarget(day, m, targetKcal);
        const avoid = new Set(d > 0 && week[d - 1][m.key] ? [week[d - 1][m.key].id] : []);
        const food = pickSmartFood(m.key, t, goalId, dislikedIds, avoid, usage);
        day[m.key] = food ? makeFoodEntry(food, t) : null;
        if (food) usage[food.id] = (usage[food.id] || 0) + 1;
      }
      week.push(day);
    }
    return week;
  }

  function swapMealInWeek(week, dayIndex, mealKey, targetKcal, goalId, dislikedIds = []) {
    const mealMeta = MEALS.find(m => m.key === mealKey);
    if (!mealMeta) return null;
    const current = week[dayIndex][mealKey];
    const avoid = new Set([
      current?.id,
      week[dayIndex - 1]?.[mealKey]?.id,
      week[dayIndex + 1]?.[mealKey]?.id
    ].filter(Boolean));

    const usage = {};
    week.forEach(d => MEALS.forEach(m => {
      const e = d[m.key];
      if (e) usage[e.id] = (usage[e.id] || 0) + 1;
    }));

    const dayWithout = { ...week[dayIndex], [mealKey]: null };
    const t = calcMealTarget(dayWithout, mealMeta, targetKcal);
    const food = pickSmartFood(mealKey, t, goalId, dislikedIds, avoid, usage);
    week[dayIndex][mealKey] = food ? makeFoodEntry(food, t) : null;
    return food;
  }

  function generateWeeklyWorkout(profile, metrics) {
    const mode = profile.workoutMode || 'none';
    if (mode === 'none') return null;

    const goalObj = metrics.goalObj;

    if (mode === 'gym') {
      const daysPerWeek = Number(profile.workoutDays) || 4;
      const userLevel = profile.workoutLevel || 'medium';

      const SPLITS = {
        3: [
          { title: 'سینه، جلو بازو و شکم', muscles: ['chest', 'bicep', 'abs'] },
          { rest: true, title: 'استراحت و ریکاوری' },
          { title: 'پا کامل (ران و ساق)', muscles: ['quadriceps', 'calf'] },
          { rest: true, title: 'ریکاوری فعال' },
          { title: 'زیربغل، سرشانه و پشت بازو', muscles: ['back', 'shoulder', 'tricep'] },
          { rest: true, title: 'استراحت' },
          { rest: true, title: 'استراحت آخر هفته' }
        ],
        4: [
          { title: 'سینه و پشت بازو', muscles: ['chest', 'tricep'] },
          { title: 'پشت، زیربغل و جلو بازو', muscles: ['back', 'bicep'] },
          { rest: true, title: 'استراحت میان‌هفته' },
          { title: 'ران و ساق پا', muscles: ['quadriceps', 'calf'] },
          { title: 'سرشانه و شکم', muscles: ['shoulder', 'abs'] },
          { rest: true, title: 'پیاده‌روی سبک یا کشش' },
          { rest: true, title: 'استراحت کامل' }
        ],
        5: [
          { title: 'سینه و شکم', muscles: ['chest', 'abs'] },
          { title: 'پشت و زیربغل', muscles: ['back'] },
          { title: 'ران و ساق پا', muscles: ['quadriceps', 'calf'] },
          { rest: true, title: 'استراحت' },
          { title: 'سرشانه و شکم', muscles: ['shoulder', 'abs'] },
          { title: 'سوپرست جلو بازو و پشت بازو', muscles: ['bicep', 'tricep'] },
          { rest: true, title: 'استراحت آخر هفته' }
        ]
      };

      let doseScheme = { sets: 3, reps: '۱۰ تا ۱۲ تکرار', restSec: '۶۰ تا ۷۵ ثانیه', cardioNote: '۱۰ دقیقه گرم‌کردن مفاصل پیش از شروع وزنه‌ها' };
      if (goalObj.gymGoal === 'muscle') {
        doseScheme = { sets: 4, reps: '۸ تا ۱۰ تکرار سنگین', restSec: '۹۰ تا ۱۲۰ ثانیه', cardioNote: 'گرم‌کردن سبک ۵ دقیقه‌ای؛ تمرکز اصلی روی افزایش تدریجی رکورد وزنه‌ها' };
      } else if (goalObj.gymGoal === 'fat') {
        doseScheme = { sets: 3, reps: '۱۲ تا ۱۵ تکرار', restSec: '۴۵ تا ۶۰ ثانیه', cardioNote: '۲۰ دقیقه هوازی با ضربان متوسط در پایان تمرین' };
      }

      const allowedLvls = userLevel === 'beginner'
        ? ['beginner', 'medium']
        : userLevel === 'medium'
          ? ['beginner', 'medium', 'advanced']
          : ['medium', 'advanced', 'beginner'];

      const template = SPLITS[daysPerWeek] || SPLITS[4];
      const days = template.map(slot => {
        if (slot.rest) return { type: 'rest', title: slot.title, minutes: 0, items: [] };
        const items = [];
        slot.muscles.forEach(m => {
          const allForMuscle = GYM_EXERCISES.filter(e => e.muscle === m);
          const sorted = [...allForMuscle].sort((a, b) => {
            const ia = a.level === userLevel ? 0 : allowedLvls.indexOf(a.level) + 1;
            const ib = b.level === userLevel ? 0 : allowedLvls.indexOf(b.level) + 1;
            return (ia - ib) + (Math.random() * 0.6 - 0.3);
          });
          const count = slot.muscles.length === 1 ? 3 : 2;
          sorted.slice(0, count).forEach(ex => {
            items.push({
              id: ex.id,
              name: ex.name,
              media: ex.media,
              tip: ex.detail,
              dose: ex.timed ? `${doseScheme.sets} × ۴۵ ثانیه` : `${doseScheme.sets} ست × ${doseScheme.reps}`,
              calories: ex.calories
            });
          });
        });

        const estMinutes = Math.round((10 + items.length * doseScheme.sets * 2.5) / 5) * 5 + (goalObj.gymGoal === 'fat' ? 15 : 0);
        return { type: 'gym', title: slot.title, minutes: estMinutes, items };
      });

      const levelLabels = { beginner: 'مبتدی', medium: 'متوسط', advanced: 'حرفه‌ای' };
      return {
        mode: 'gym',
        summary: `${daysPerWeek} جلسه در هفته · سطح ${levelLabels[userLevel] || 'متوسط'} · استراحت بین ست‌ها: ${doseScheme.restSec}`,
        cardioNote: doseScheme.cardioNote,
        days
      };
    }

    const autoLvl = (metrics.bmi >= 30 || profile.age >= 58) ? 1 : (profile.workoutLevel === 'advanced' ? 3 : 2);
    const SCHEDULES = {
      lose: [['full', 'فول‌بادی A'], ['cardio', 'هوازی و میان‌تنه'], ['full', 'فول‌بادی B'], ['active', 'پیاده‌روی و کشش'], ['full', 'فول‌بادی C'], ['cardio', 'هوازی و شکم'], ['rest', 'استراحت']],
      maintain: [['upper', 'بالاتنه'], ['lower', 'پایین‌تنه'], ['cardio', 'هوازی و میان‌تنه'], ['rest', 'استراحت'], ['upper', 'بالاتنه و بازو'], ['lower', 'پا و شکم'], ['active', 'تحرک‌پذیری و کشش']],
      gain: [['push', 'سینه، سرشانه و پشت بازو'], ['pull', 'زیربغل و جلو بازو'], ['lower', 'ران و ساق'], ['rest', 'استراحت'], ['upper', 'بالاتنه ترکیبی'], ['lower', 'پا و شکم'], ['rest', 'استراحت']]
    };
    const SLOTS = {
      full: ['lower', 'push', 'pull', 'lower', 'core'],
      upper: ['push', 'pull', 'push', 'pull', 'core'],
      lower: ['lower', 'lower', 'lower', 'core'],
      push: ['push', 'push', 'push', 'core'],
      pull: ['pull', 'pull', 'pull', 'core'],
      cardio: ['cardio', 'core', 'core', 'mobility'],
      active: ['cardio', 'mobility', 'mobility'],
      rest: []
    };

    const sched = SCHEDULES[goalObj.workoutStyle] || SCHEDULES.maintain;
    const days = sched.map(([type, title]) => {
      if (type === 'rest') return { type: 'rest', title, minutes: 0, items: [] };
      const used = new Set();
      const items = (SLOTS[type] || []).map(cat => {
        let pool = HOME_EXERCISES.filter(e => e.cat === cat && e.lvl <= autoLvl && !used.has(e.id));
        if (!pool.length) pool = HOME_EXERCISES.filter(e => e.cat === cat && !used.has(e.id));
        if (!pool.length) pool = HOME_EXERCISES.filter(e => e.cat === cat);
        const pick = pool[Math.floor(Math.random() * pool.length)];
        used.add(pick.id);
        let dose = '۳ ست × ۱۲ تکرار';
        if (pick.cat === 'cardio') dose = type === 'active' ? '۳۰ دقیقه پیاده‌روی' : '۲۰ تا ۳۰ دقیقه';
        else if (pick.timed) dose = '۳ × ۳۵ ثانیه';
        else if (goalObj.workoutStyle === 'gain') dose = '۴ ست × ۱۰ تا ۱۲ تکرار';
        return { id: pick.id, name: pick.name, media: pick.media || null, tip: pick.tip, dose };
      });
      const minutes = type === 'active' ? 35 : type === 'cardio' ? 40 : 35;
      return { type: 'home', title, minutes, items };
    });

    return {
      mode: 'home',
      summary: `تمرین در منزل · متناسب با «${goalObj.short}» · استراحت بین ست‌ها: ۶۰ ثانیه`,
      cardioNote: '۵ دقیقه گرم‌کردن پیش از شروع و کشش عضلات در پایان جلسه.',
      days
    };
  }

  return {
    DAYS,
    MEALS,
    GOAL_MAP,
    FOOD_BY_ID,
    GYM_BY_ID,
    HOME_BY_ID,
    calcAll,
    scaleAmount,
    generateWeeklyDiet,
    swapMealInWeek,
    generateWeeklyWorkout
  };
})();
