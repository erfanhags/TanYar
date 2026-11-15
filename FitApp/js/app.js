/* ==========================================================================
   TanYar Application Controller (app.js)
   ========================================================================== */

(() => {
  'use strict';

  const { GOALS, SINGLE_FOODS, MUSCLE_GROUPS, GYM_EXERCISES } = window.FIT_DATA;
  const { DAYS, MEALS, FOOD_BY_ID, calcAll, scaleAmount, generateWeeklyDiet, swapMealInWeek, generateWeeklyWorkout } = window.FIT_METRICS;
  const CHARTS = window.FIT_CHARTS;
  const DETECTOR = window.FIT_DETECTOR;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const fa = (n, d = 0) => Number(n).toLocaleString('fa-IR', { maximumFractionDigits: d });
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function toEn(val) {
    return String(val ?? '')
      .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
      .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
      .replace(/[,٬\s]/g, '')
      .replace('٫', '.')
      .trim();
  }

  function parseNum(val) {
    const s = toEn(val);
    if (!s) return NaN;
    const v = parseFloat(s);
    return Number.isFinite(v) ? v : NaN;
  }

  function faDateShort(date = new Date()) {
    try {
      return date.toLocaleDateString('fa-IR', { month: 'numeric', day: 'numeric' });
    } catch {
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }
  }

  const TODAY_IDX = (new Date().getDay() + 1) % 7;
  const MEAL_NAMES = { breakfast: 'صبحانه', snack: 'میان‌وعده', lunch: 'ناهار', dinner: 'شام' };

  const FOOD_EMOJIS = {
    sf_apple: '🍎', sf_banana: '🍌', sf_orange: '🍊', sf_peach: '🍑',
    sf_strawberry: '🍓', sf_watermelon: '🍉', sf_grapes: '🍇', sf_dates: '🌴',
    sf_cucumber: '🥒', sf_tomato: '🍅', sf_pasta: '🍝', sf_chicken: '🍗',
    sf_beef: '🥩', sf_kotlet: '🧆', sf_fish: '🐟', sf_egg: '🥚',
    sf_eggwhite: '🍳', sf_rice: '🍚', sf_ghormeh: '🍲', sf_gheymeh: '🍲',
    sf_soup: '🥣', sf_lentil: '🫘', sf_sangak: '🍞', sf_toast: '🥪',
    sf_potato: '🥔', sf_fries: '🍟', sf_oats: '🥣', sf_salad: '🥗',
    sf_pizza: '🍕', sf_burger: '🍔', sf_cake: '🍰', sf_milk: '🥛',
    sf_yogurt: '🥛', sf_cheese: '🧀', sf_almond: '🥜', sf_walnut: '🌰',
    sf_pb: '🥜', sf_mixed_rice: '🍛', sf_fesenjan: '🍲', sf_olivieh: '🥗',
    sf_kiwi: '🥝', sf_avocado: '🥑', sf_veggies: '🥦', sf_icecream: '🍦',
    sf_whey: '🥤'
  };

  function getDefaultMealSlot() {
    const h = new Date().getHours();
    if (h >= 5 && h < 11) return 'breakfast';
    if (h >= 11 && h < 16) return 'lunch';
    if (h >= 16 && h < 19) return 'snack';
    return 'dinner';
  }

  function playSuccessChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.setValueAtTime(880, now + 0.1);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
    } catch { /* ignore */ }
  }

  function speakPersian(text) {
    try {
      if ('speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined') {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'fa-IR';
        u.rate = 1.05;
        window.speechSynthesis.speak(u);
      }
    } catch { /* ignore */ }
  }

  /* ================= مدیریت حافظه ================= */
  const STORE_KEY = 'fitplan_store_v1';
  const defaultStore = () => ({ theme: 'dark', currentUserId: null, users: {} });

  let store;
  try {
    store = Object.assign(defaultStore(), JSON.parse(localStorage.getItem(STORE_KEY)) || {});
    if (!store.users || typeof store.users !== 'object') store.users = {};
  } catch {
    store = defaultStore();
  }

  function saveStore() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* ignore */ }
  }

  const currentUser = () => (store.currentUserId ? store.users[store.currentUserId] || null : null);

  const ui = {
    tab: 'dashboard',
    day: TODAY_IDX,
    workoutSub: 'plan',
    selectedMuscle: 'chest',
    favOnly: false,
    wizardDraft: {},
    selectedSingleFood: null,
    camStream: null,
    timerId: null,
    timerLeft: 0,
    timerRestMode: false,
    timerRunning: false
  };

  /* ================= تم ================= */
  function applyTheme(theme) {
    store.theme = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', store.theme);
    $('#themeLbl').textContent = store.theme === 'dark' ? 'روز' : 'شب';
    saveStore();
  }

  $('#themeBtn').addEventListener('click', () => {
    applyTheme(store.theme === 'dark' ? 'light' : 'dark');
  });

  /* ================= اعلان ================= */
  let toastTimer = null;
  function showToast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2900);
  }

  function playBeep(freq = 820, duration = 0.18) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.14, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch { /* ignore */ }
  }

  /* ================= ورود و ثبت‌نام ================= */
  function setAuthTab(mode) {
    $$('[data-auth-tab]').forEach(b => b.classList.toggle('active', b.dataset.authTab === mode));
    $('#loginPanel').hidden = mode !== 'login';
    $('#signupPanel').hidden = mode !== 'signup';
    if (mode === 'login') renderSavedUsers();
  }

  $$('[data-auth-tab]').forEach(btn => {
    btn.addEventListener('click', () => setAuthTab(btn.dataset.authTab));
  });

  function renderSavedUsers() {
    const list = Object.values(store.users);
    const sec = $('#savedUsersSection');
    const box = $('#savedUsersList');
    if (!list.length) {
      sec.hidden = true;
      return;
    }
    sec.hidden = false;
    box.innerHTML = list.map(u => {
      const m = calcAll(u.profile);
      return `
        <div class="saved-user-card" data-quick-login="${esc(u.username)}">
          <div class="saved-user-info">
            <b>${esc(u.name)} <span class="muted-inline">(@${esc(u.username)})</span></b>
            <small>وزن ${fa(u.profile.weight, 1)} کیلو · چربی ${fa(m.bodyFat, 1)}٪ · ${esc(m.goalObj.short)}</small>
          </div>
          <span class="btn btn-primary btn-sm">ورود</span>
        </div>
      `;
    }).join('');
  }

  $('#savedUsersList').addEventListener('click', e => {
    const card = e.target.closest('[data-quick-login]');
    if (!card) return;
    const uname = card.dataset.quickLogin;
    const user = store.users[uname];
    if (!user) return;
    if (user.password || user.faceLogin) {
      $('#liUsername').value = uname;
      $('#liPass').value = '';
      $('#liPass').focus();
      $('#loginErr').textContent = 'رمز عبور را وارد کنید یا دکمه‌ی ورود با تشخیص چهره را بزنید.';
    } else loginAs(uname);
  });

  $('#loginForm').addEventListener('submit', e => {
    e.preventDefault();
    const uname = toEn($('#liUsername').value).toLowerCase();
    const pass = $('#liPass').value;
    const err = $('#loginErr');

    if (!uname) { err.textContent = 'نام کاربری را وارد کنید.'; return; }
    const user = store.users[uname];
    if (!user) { err.textContent = 'حسابی با این نام کاربری یافت نشد.'; return; }
    if (user.password && user.password !== pass) { err.textContent = 'رمز عبور نادرست است.'; return; }
    err.textContent = '';
    loginAs(uname);
  });

  function setWizardStep(step) {
    [1, 2, 3].forEach(n => { $('#wizForm' + n).hidden = n !== step; });
    $$('#wizStepsBar li').forEach(li => {
      const s = Number(li.dataset.wstep);
      li.classList.toggle('active', s === step);
      li.classList.toggle('done', s < step);
    });
  }

  $$('input[name="suGender"]').forEach(r => {
    r.addEventListener('change', () => {
      const gender = $('input[name="suGender"]:checked').value;
      $('#suHipWrap').hidden = gender !== 'female';
    });
  });

  $('#suIntakePresets').addEventListener('click', e => {
    const chip = e.target.closest('[data-kcal]');
    if (!chip) return;
    $('#suIntake').value = chip.dataset.kcal;
  });

  $$('input[name="suWorkoutMode"]').forEach(r => {
    r.addEventListener('change', () => {
      const mode = $('input[name="suWorkoutMode"]:checked').value;
      $('#suGymOpts').hidden = mode === 'none';
      $('#suDaysWrap').hidden = mode !== 'gym';
    });
  });

  $('#wizForm1').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#suName').value.trim();
    const username = toEn($('#suUsername').value).toLowerCase();
    const password = $('#suPass').value;
    const err = $('#wizErr1');

    if (name.length < 2) { err.textContent = 'نام را وارد کنید (حداقل ۲ حرف).'; return; }
    if (username.length < 2) { err.textContent = 'نام کاربری معتبر وارد کنید.'; return; }
    if (store.users[username]) { err.textContent = 'این نام کاربری از قبل وجود دارد.'; return; }
    err.textContent = '';
    ui.wizardDraft = { name, username, password };
    setWizardStep(2);
  });

  $('#wizForm2').addEventListener('submit', e => {
    e.preventDefault();
    const gender = $('input[name="suGender"]:checked').value;
    const age = parseNum($('#suAge').value);
    const height = parseNum($('#suHeight').value);
    const weight = parseNum($('#suWeight').value);
    const activity = parseFloat($('#suActivity').value) || 1.375;
    const intakeVal = parseNum($('#suIntake').value);
    const neck = parseNum($('#suNeck').value);
    const waist = parseNum($('#suWaist').value);
    const hip = parseNum($('#suHip').value);
    const err = $('#wizErr2');

    if (!(age >= 12 && age <= 95)) { err.textContent = 'سن باید بین ۱۲ تا ۹۵ سال باشد.'; return; }
    if (!(height >= 120 && height <= 230)) { err.textContent = 'قد باید بین ۱۲۰ تا ۲۳۰ سانتی‌متر باشد.'; return; }
    if (!(weight >= 30 && weight <= 260)) { err.textContent = 'وزن باید بین ۳۰ تا ۲۶۰ کیلوگرم باشد.'; return; }
    if (!Number.isNaN(intakeVal) && (intakeVal < 600 || intakeVal > 6500)) {
      err.textContent = 'کالری فعلی باید بین ۶۰۰ تا ۶۵۰۰ باشد (یا خالی بگذارید).';
      return;
    }
    err.textContent = '';

    const tempProfile = {
      gender,
      age: Math.round(age),
      height,
      weight,
      activity,
      intake: Number.isNaN(intakeVal) ? null : Math.round(intakeVal),
      intakeKnown: !Number.isNaN(intakeVal),
      neck: Number.isNaN(neck) ? null : neck,
      waist: Number.isNaN(waist) ? null : waist,
      hip: Number.isNaN(hip) ? null : hip,
      goal: 'maintain'
    };

    const preview = calcAll(tempProfile);
    tempProfile.goal = preview.recommendation.id;
    ui.wizardDraft.profile = tempProfile;

    $('#wizLivePreview').innerHTML = `
      <div class="preview-metrics">
        <span class="preview-pill">BMI: <b>${fa(preview.bmi, 1)}</b> (${preview.bmiCat.label})</span>
        <span class="preview-pill">چربی بدن: <b>${fa(preview.bodyFat, 1)}٪</b> (${preview.bfCat.label})</span>
        <span class="preview-pill">توده بدون چربی: <b>${fa(preview.leanMassKg, 1)} kg</b></span>
        <span class="preview-pill">نگهداری: <b>${fa(preview.tdee)} kcal</b></span>
      </div>
      <p class="small muted" style="margin:0">${esc(preview.recommendation.reason)}</p>
    `;

    renderGoalCards('#wizGoalsGrid', 'wizGoalRadio', preview.recommendation.id, preview.recommendation.id);
    setWizardStep(3);
  });

  $('#wizBack1').addEventListener('click', () => setWizardStep(1));
  $('#wizBack2').addEventListener('click', () => setWizardStep(2));

  $('#wizForm3').addEventListener('submit', e => {
    e.preventDefault();
    const chosenGoal = $('input[name="wizGoalRadio"]:checked')?.value || ui.wizardDraft.profile.goal;
    const workoutMode = $('input[name="suWorkoutMode"]:checked')?.value || 'gym';
    const workoutLevel = $('#suWorkoutLevel').value || 'medium';
    const workoutDays = Number($('#suWorkoutDays').value) || 4;

    const profile = {
      ...ui.wizardDraft.profile,
      goal: chosenGoal,
      workoutMode,
      workoutLevel,
      workoutDays
    };

    const metrics = calcAll(profile);
    const newUser = {
      username: ui.wizardDraft.username,
      password: ui.wizardDraft.password || '',
      name: ui.wizardDraft.name,
      createdAt: new Date().toISOString(),
      profile,
      disliked: [],
      diet: generateWeeklyDiet(metrics.target, profile.goal, []),
      workout: generateWeeklyWorkout(profile, metrics),
      eatenMeals: {},
      extraFoods: {},
      weightHistory: [{ date: faDateShort(), weight: profile.weight, bf: metrics.bodyFat }],
      progress: { workouts: 0, streak: 0, lastWorkoutDate: null, badges: [], favExercises: [] }
    };

    store.users[newUser.username] = newUser;
    saveStore();
    loginAs(newUser.username);
    showToast(`پروفایل ${newUser.name} ساخته شد.`);
  });

  function renderGoalCards(containerSel, radioName, selectedId, recommendedId = null) {
    $(containerSel).innerHTML = GOALS.map(g => `
      <label class="goal-option">
        <input type="radio" name="${radioName}" value="${g.id}" ${g.id === selectedId ? 'checked' : ''}>
        <div class="goal-card-inner">
          <div class="goal-card-top">
            <b>${esc(g.title)}</b>
            ${g.id === recommendedId ? '<span class="rec-tag">پیشنهادی</span>' : ''}
          </div>
          <p>${esc(g.desc)}</p>
        </div>
      </label>
    `).join('');
  }

  /* ================= ناوبری اصلی اپلیکیشن ================= */
  function loginAs(username) {
    store.currentUserId = username;
    saveStore();
    ui.day = TODAY_IDX;
    ui.tab = 'dashboard';

    $('#authScreen').hidden = true;
    $('#mainScreen').hidden = false;
    $('#bottomNav').hidden = false;
    $('#logoutBtn').hidden = false;

    renderAll();
    switchMainTab('dashboard');
  }

  function logout() {
    window.FIT_FACE_LOGIN.close();
    pauseIntervalTimer();
    stopCameraStream();
    store.currentUserId = null;
    saveStore();

    $('#mainScreen').hidden = true;
    $('#bottomNav').hidden = true;
    $('#logoutBtn').hidden = true;
    $('#authScreen').hidden = false;
    $('#topUserSub').textContent = 'کنترل تغذیه و تمرین';

    const hasUsers = Object.keys(store.users).length > 0;
    setAuthTab(hasUsers ? 'login' : 'signup');
    setWizardStep(1);
  }

  $('#logoutBtn').addEventListener('click', logout);
  $('#switchAccountBtn').addEventListener('click', logout);

  $('#deleteAccountBtn').addEventListener('click', () => {
    const u = currentUser();
    if (!u) return;
    if (!confirm(`حساب «${u.name}» به طور کامل حذف شود؟`)) return;
    delete store.users[u.username];
    logout();
    showToast('حساب حذف شد.');
  });

  function switchMainTab(tabName) {
    if (ui.tab === 'scan' && tabName !== 'scan') {
      stopCameraStream();
    }
    ui.tab = tabName;
    $$('.app-view').forEach(sec => { sec.hidden = sec.id !== `view-${tabName}`; });
    $$('#bottomNav [data-nav]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.nav === tabName);
    });
    if (tabName === 'scan') {
      updateDetectorStatusBadge();
      DETECTOR.warmup();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  $('#bottomNav').addEventListener('click', e => {
    const btn = e.target.closest('[data-nav]');
    if (!btn) return;
    switchMainTab(btn.dataset.nav);
  });

  $('#goToScannerBtn').addEventListener('click', () => switchMainTab('scan'));
  $('#quickGoalSwitchBtn').addEventListener('click', () => switchMainTab('settings'));

  /* ================= رندر کل بخش‌ها ================= */
  function renderAll() {
    const u = currentUser();
    if (!u) return;
    const m = calcAll(u.profile);
    $('#topUserSub').textContent = `${u.name} · ${m.goalObj.short}`;

    renderDashboard(u, m);
    renderDietSection(u, m);
    renderWorkoutSection(u, m);
    renderSettingsSection(u, m);
    updateDetectorStatusBadge();
  }

  /* ---------- ۱. داشبورد ---------- */
  function getConsumedForDay(u, dayIdx) {
    const res = { kcal: 0, p: 0, c: 0, f: 0 };
    const dayPlan = u.diet?.[dayIdx];
    const eatenMap = u.eatenMeals?.[dayIdx] || {};

    if (dayPlan) {
      MEALS.forEach(m => {
        if (eatenMap[m.key] && dayPlan[m.key]) {
          const entry = dayPlan[m.key];
          const food = FOOD_BY_ID[entry.id];
          if (food) {
            res.kcal += food.kcal * entry.mult;
            res.p += food.p * entry.mult;
            res.c += food.c * entry.mult;
            res.f += food.f * entry.mult;
          }
        }
      });
    }

    const extras = u.extraFoods?.[dayIdx] || [];
    extras.forEach(item => {
      res.kcal += item.kcal;
      res.p += item.p;
      res.c += item.c;
      res.f += item.f;
    });

    return {
      kcal: Math.round(res.kcal),
      p: Math.round(res.p),
      c: Math.round(res.c),
      f: Math.round(res.f)
    };
  }

  function renderDashboard(u, m) {
    const todayConsumed = getConsumedForDay(u, TODAY_IDX);
    const remain = m.target - todayConsumed.kcal;
    const workoutLbl = u.profile.workoutMode === 'none'
      ? 'فقط برنامه غذایی'
      : u.profile.workoutMode === 'gym'
        ? `باشگاهی (${fa(u.profile.workoutDays)} جلسه)`
        : 'خانگی و هوازی';

    $('#heroBanner').innerHTML = `
      <div class="bento-cell accent-cell">
        <small>پروفایل فعال</small>
        <div class="big-num" style="font-size:1.18rem">${esc(u.name)}</div>
        <div class="sub-note">هدف: <b style="color:var(--text)">${esc(m.goalObj.title)}</b> · ${workoutLbl}</div>
      </div>
      <div class="bento-cell">
        <small>کالری امروز</small>
        <div class="big-num" style="color:var(--primary)">${fa(todayConsumed.kcal)} <span class="muted-inline">/ ${fa(m.target)}</span></div>
        <div class="sub-note">${remain >= 0 ? `${fa(remain)} کالری باقی‌مانده` : `${fa(Math.abs(remain))} کالری مازاد`}</div>
      </div>
      <div class="bento-cell">
        <small>درصد چربی بدن</small>
        <div class="big-num">${fa(m.bodyFat, 1)}٪</div>
        <div class="sub-note">${esc(m.bfCat.label)}</div>
      </div>
      <div class="bento-cell">
        <small>وزن و تداوم تمرین</small>
        <div class="big-num">${fa(u.profile.weight, 1)} <span class="muted-inline">kg</span></div>
        <div class="sub-note">استریک: ${fa(u.progress.streak || 0)} روز متوالی</div>
      </div>
    `;

    const warnEl = $('#warnBanner');
    if (m.warnings.length) {
      warnEl.hidden = false;
      warnEl.innerHTML = m.warnings.map(w => `<div>${esc(w)}</div>`).join('');
    } else {
      warnEl.hidden = true;
    }

    $('#bmiChartContainer').innerHTML = CHARTS.renderBmiChart(m);
    $('#bfChartContainer').innerHTML = CHARTS.renderBodyFatChart(m, u.profile.gender);
    $('#bodyCompContainer').innerHTML = CHARTS.renderBodyCompositionBar(m, u.profile.weight);
    $('#nutriChartContainer').innerHTML = CHARTS.renderNutritionCharts(m);
    $('#weightTrendContainer').innerHTML = CHARTS.renderWeightTrendChart(u.weightHistory, m.idealWeight);
  }

  $('#logWeightForm').addEventListener('submit', e => {
    e.preventDefault();
    const u = currentUser();
    if (!u) return;
    const w = parseNum($('#newWeightInput').value);
    if (!(w >= 30 && w <= 260)) {
      showToast('وزن معتبر بین ۳۰ تا ۲۶۰ کیلوگرم وارد کنید.');
      return;
    }
    u.profile.weight = Math.round(w * 10) / 10;
    const m = calcAll(u.profile);
    u.weightHistory = u.weightHistory || [];
    u.weightHistory.push({ date: faDateShort(), weight: u.profile.weight, bf: m.bodyFat });
    u.diet = generateWeeklyDiet(m.target, u.profile.goal, u.disliked);
    $('#newWeightInput').value = '';
    saveStore();
    renderAll();
    showToast(`وزن ${fa(u.profile.weight, 1)} کیلوگرم ثبت شد.`);
  });

  $('#openMeasureBtn').addEventListener('click', () => {
    const u = currentUser();
    if (!u) return;
    $('#mmNeck').value = u.profile.neck || '';
    $('#mmWaist').value = u.profile.waist || '';
    $('#mmHip').value = u.profile.hip || '';
    $('#mmHipField').hidden = u.profile.gender !== 'female';
    $('#measureModal').hidden = false;
  });

  $('#measureModalForm').addEventListener('submit', e => {
    e.preventDefault();
    const u = currentUser();
    if (!u) return;
    const neck = parseNum($('#mmNeck').value);
    const waist = parseNum($('#mmWaist').value);
    const hip = parseNum($('#mmHip').value);

    u.profile.neck = Number.isNaN(neck) ? null : neck;
    u.profile.waist = Number.isNaN(waist) ? null : waist;
    u.profile.hip = Number.isNaN(hip) ? null : hip;
    saveStore();
    $('#measureModal').hidden = true;
    renderAll();
    showToast('درصد چربی بدن بروزرسانی شد.');
  });

  /* ---------- ۲. برنامه غذایی و کالری‌شمار ---------- */
  function renderDietSection(u, m) {
    $('#dietGoalSub').textContent = `هدف: ${m.goalObj.title} · بودجه روزانه: ${fa(m.target)} کالری (${fa(m.protein)}g پروتئین · ${fa(m.carbs)}g کربوهیدرات · ${fa(m.fat)}g چربی)`;

    $('#dietDaysBar').innerHTML = DAYS.map((dName, i) => `
      <button type="button" class="chip ${i === ui.day ? 'active' : ''} ${i === TODAY_IDX ? 'today-dot' : ''}" data-diet-day="${i}">
        ${dName}${i === TODAY_IDX ? ' (امروز)' : ''}
      </button>
    `).join('');

    if (!u.diet || !u.diet.length || !u.diet[ui.day]) {
      u.diet = generateWeeklyDiet(m.target, u.profile.goal, u.disliked || []);
      saveStore();
    }
    const dayPlan = u.diet[ui.day] || {};
    let planTot = { kcal: 0, p: 0, c: 0, f: 0 };
    MEALS.forEach(meal => {
      const e = dayPlan[meal.key];
      if (!e || !FOOD_BY_ID[e.id]) return;
      const f = FOOD_BY_ID[e.id];
      planTot.kcal += f.kcal * e.mult;
      planTot.p += f.p * e.mult;
      planTot.c += f.c * e.mult;
      planTot.f += f.f * e.mult;
    });

    const consumed = getConsumedForDay(u, ui.day);
    const consumedPct = Math.min(100, Math.round((consumed.kcal / Math.max(1, m.target)) * 100));
    const isOver = consumed.kcal > m.target + 80;

    $('#dietTrackerSummary').innerHTML = `
      <div class="tracker-box consumed">
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <b>مصرف ثبت‌شده (${DAYS[ui.day]})</b>
          <span><b style="font-size:1.15rem;color:${isOver ? 'var(--danger)' : 'var(--primary)'}">${fa(consumed.kcal)}</b> <small class="muted">از ${fa(m.target)} kcal</small></span>
        </div>
        <div class="progress-track"><i class="${isOver ? 'over' : ''}" style="width:${consumedPct}%"></i></div>
        <div class="small muted">پروتئین: <b>${fa(consumed.p)}g</b> · کربو: <b>${fa(consumed.c)}g</b> · چربی: <b>${fa(consumed.f)}g</b></div>
      </div>

      <div class="tracker-box">
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <b>جمع برنامه پیشنهادی ${DAYS[ui.day]}</b>
          <span><b>${fa(Math.round(planTot.kcal))}</b> <small class="muted">kcal در ۴ وعده</small></span>
        </div>
        <div class="progress-track"><i style="width:${Math.min(100, Math.round((planTot.kcal / m.target) * 100))}%;background:var(--indigo)"></i></div>
        <div class="small muted">پروتئین: <b>${fa(Math.round(planTot.p))}g</b> · کربو: <b>${fa(Math.round(planTot.c))}g</b> · چربی: <b>${fa(Math.round(planTot.f))}g</b></div>
      </div>
    `;

    const eatenMap = u.eatenMeals?.[ui.day] || {};
    $('#mealsGrid').innerHTML = MEALS.map(meal => {
      const entry = dayPlan[meal.key];
      if (!entry || !FOOD_BY_ID[entry.id]) {
        return `
          <article class="meal-card">
            <span class="meal-tag">${meal.title}</span>
            <h3>گزینه‌ای باقی نمانده</h3>
            <p class="small muted">از لیست پایین صفحه چند غذا را بازگردانید.</p>
          </article>
        `;
      }
      const food = FOOD_BY_ID[entry.id];
      const isEaten = !!eatenMap[meal.key];
      const k = val => fa(Math.round(val * entry.mult));

      return `
        <article class="meal-card ${isEaten ? 'eaten' : ''}" data-meal-key="${meal.key}">
          <div class="meal-head">
            <div>
              <span class="meal-tag">${meal.title}</span>
              <h3>${esc(food.name)}</h3>
            </div>
            <div class="meal-kcal">${k(food.kcal)}<small>kcal</small></div>
          </div>
          <ul class="meal-items">
            ${food.items.map(([itemName, amt, unit]) => `
              <li><span>${esc(itemName)}</span><span>${fa(scaleAmount(amt, unit, entry.mult), 1)} ${esc(unit)}</span></li>
            `).join('')}
          </ul>
          <div class="meal-macros">
            <span>پروتئین ${k(food.p)}g</span>
            <span>کربوهیدرات ${k(food.c)}g</span>
            <span>چربی ${k(food.f)}g</span>
          </div>
          <div class="meal-actions">
            <button type="button" class="eat-btn ${isEaten ? 'done' : ''}" data-meal-act="eat">
              ${isEaten ? 'ثبت شد ✓' : 'خوردم'}
            </button>
            <button type="button" data-meal-act="swap">جایگزینی</button>
            <button type="button" data-meal-act="dislike">حذف</button>
          </div>
        </article>
      `;
    }).join('');

    const extras = u.extraFoods?.[ui.day] || [];
    $('#extraFoodsCard').hidden = extras.length === 0;
    $('#extraFoodsList').innerHTML = extras.map(item => `
      <div class="extra-log-item">
        <div>
          <b>${esc(item.name)}</b>
          <span class="muted small"> · ${fa(item.amount, 1)} ${esc(item.unit)} (${MEAL_NAMES[item.mealSlot] || 'روزانه'})</span>
          <div class="small muted">${fa(item.kcal)} kcal · پروتئین ${fa(item.p, 1)}g · کربو ${fa(item.c, 1)}g · چربی ${fa(item.f, 1)}g</div>
        </div>
        <button type="button" class="btn btn-danger btn-sm" data-del-extra="${item.uid}">حذف</button>
      </div>
    `).join('');

    $('#dislikedCard').hidden = !u.disliked.length;
    $('#dislikedList').innerHTML = u.disliked.map(fid => {
      const f = FOOD_BY_ID[fid];
      return f ? `<button type="button" class="chip" data-restore-food="${fid}">${esc(f.name)} ✕</button>` : '';
    }).join('');
  }

  $('#dietDaysBar').addEventListener('click', e => {
    const btn = e.target.closest('[data-diet-day]');
    if (!btn) return;
    ui.day = Number(btn.dataset.dietDay);
    const u = currentUser();
    renderDietSection(u, calcAll(u.profile));
  });

  $('#mealsGrid').addEventListener('click', e => {
    const btn = e.target.closest('[data-meal-act]');
    if (!btn) return;
    const u = currentUser();
    if (!u) return;
    const m = calcAll(u.profile);
    const mealKey = btn.closest('[data-meal-key]').dataset.mealKey;
    const act = btn.dataset.mealAct;

    if (act === 'eat') {
      u.eatenMeals = u.eatenMeals || {};
      u.eatenMeals[ui.day] = u.eatenMeals[ui.day] || {};
      u.eatenMeals[ui.day][mealKey] = !u.eatenMeals[ui.day][mealKey];
      saveStore();
      renderDashboard(u, m);
      renderDietSection(u, m);
      return;
    }

    if (act === 'swap') {
      const nextFood = swapMealInWeek(u.diet, ui.day, mealKey, m.target, u.profile.goal, u.disliked);
      saveStore();
      renderDietSection(u, m);
      if (nextFood) showToast(`«${nextFood.name}» جایگزین شد.`);
      return;
    }

    if (act === 'dislike') {
      const curEntry = u.diet[ui.day][mealKey];
      if (!curEntry) return;
      const food = FOOD_BY_ID[curEntry.id];
      const othersLeft = window.FIT_DATA.FOODS.filter(f => f.meal === food.meal && f.id !== food.id && !u.disliked.includes(f.id));
      if (!othersLeft.length) {
        showToast('آخرین گزینه این وعده قابل حذف نیست.');
        return;
      }
      u.disliked.push(food.id);
      u.diet.forEach((dObj, dIdx) => {
        MEALS.forEach(ml => {
          if (dObj[ml.key]?.id === food.id) {
            swapMealInWeek(u.diet, dIdx, ml.key, m.target, u.profile.goal, u.disliked);
          }
        });
      });
      saveStore();
      renderDietSection(u, m);
      showToast(`«${food.name}» از برنامه کنار گذاشته شد.`);
    }
  });

  $('#extraFoodsList').addEventListener('click', e => {
    const btn = e.target.closest('[data-del-extra]');
    if (!btn) return;
    const u = currentUser();
    const uid = btn.dataset.delExtra;
    u.extraFoods[ui.day] = (u.extraFoods[ui.day] || []).filter(x => x.uid !== uid);
    saveStore();
    const m = calcAll(u.profile);
    renderDashboard(u, m);
    renderDietSection(u, m);
  });

  $('#dislikedList').addEventListener('click', e => {
    const btn = e.target.closest('[data-restore-food]');
    if (!btn) return;
    const u = currentUser();
    const fid = btn.dataset.restoreFood;
    u.disliked = u.disliked.filter(x => x !== fid);
    const m = calcAll(u.profile);
    u.diet.forEach((dObj, dIdx) => {
      MEALS.forEach(ml => {
        if (!dObj[ml.key]) swapMealInWeek(u.diet, dIdx, ml.key, m.target, u.profile.goal, u.disliked);
      });
    });
    saveStore();
    renderDietSection(u, m);
    showToast('غذا به فهرست مجاز بازگشت.');
  });

  $('#regenDietBtn').addEventListener('click', () => {
    const u = currentUser();
    if (!u) return;
    const m = calcAll(u.profile);
    u.diet = generateWeeklyDiet(m.target, u.profile.goal, u.disliked);
    saveStore();
    renderDietSection(u, m);
    showToast('برنامه هفتگی جدید ساخته شد.');
  });

  /* ---------- ۳. پنل تشخیص غذا با شبکه عصبی آفلاین ONNX + صفحه انتخاب مقدار ---------- */
  function updateDetectorStatusBadge(liveInfo = null) {
    const st = DETECTOR.getState();
    const dot = $('#modelStatusDot');
    const txt = $('#modelStatusTxt');
    const sub = $('#detectorStatusSub');

    if (st.fileProtocol) {
      dot.className = 'dot fat-dot';
      txt.textContent = 'اجرا با سرور محلی';
      sub.textContent = 'برای فعال‌سازی موتور عصبی آفلاین WebAssembly، برنامه را با فایل start_app.bat اجرا کنید.';
      return;
    }

    if (liveInfo?.state === 'loading' || st.loading) {
      dot.className = 'dot ideal-dot';
      txt.textContent = 'بارگذاری مدل...';
      sub.textContent = liveInfo?.message || 'در حال آماده‌سازی شبکه عصبی MobileCLIP روی دستگاه...';
      return;
    }

    if (liveInfo?.state === 'error' || st.error) {
      dot.className = 'dot fat-dot';
      txt.textContent = 'خطای بارگذاری';
      sub.textContent = st.error;
      return;
    }

    if (st.ready) {
      dot.className = 'dot lean-dot';
      txt.textContent = 'آفلاین · آماده';
      sub.textContent = `مدل MobileCLIP-S0 آماده روی دستگاه (${fa(st.classCount)} کلاس غذا · بدون اینترنت و بدون API)`;
    } else {
      dot.className = 'dot lean-dot';
      txt.textContent = 'موتور آفلاین ONNX';
      sub.textContent = `پس از تشخیص نوع غذا، صفحه انتخاب مقدار (عددی / گرمی / پیمانه) خودکار باز می‌شود.`;
    }
  }

  DETECTOR.onStatusChange(info => updateDetectorStatusBadge(info));

  ui.camFacingMode = 'environment';
  ui.liveScanEnabled = true;
  ui.liveScanTimer = null;
  ui.isAnalyzing = false;
  ui.activeDetectedFood = null;
  ui.activeDetectedQty = 1;
  ui.activeDetectedMealSlot = getDefaultMealSlot();

  async function startCameraStream() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showToast('در حال باز کردن دوربین دستگاه...');
      $('#nativeCameraInput').click();
      return;
    }
    try {
      stopCameraStream();
      DETECTOR.warmup();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: ui.camFacingMode || 'environment' }, width: { ideal: 1280 } },
        audio: false
      });
      ui.camStream = stream;
      const video = $('#camVideo');
      video.srcObject = stream;
      video.hidden = false;
      $('#scannerPlaceholder').hidden = true;
      $('#scanPreviewImg').hidden = true;
      $('#startCamBtn').hidden = true;
      $('#capturePhotoBtn').hidden = false;
      $('#flipCamBtn').hidden = false;
      $('#toggleLiveScanBtn').hidden = false;
      $('#stopCamBtn').hidden = false;
      $('#scannerLiveHud').hidden = false;
      $('#liveTargetBadge').hidden = true;
      startLiveScannerLoop();
    } catch (err) {
      console.warn('getUserMedia failed, trying native camera capture:', err);
      showToast('در حال باز کردن دوربین دستگاه...');
      $('#nativeCameraInput').click();
    }
  }

  function flipCameraStream() {
    ui.camFacingMode = ui.camFacingMode === 'environment' ? 'user' : 'environment';
    startCameraStream();
  }

  function stopCameraStream() {
    stopLiveScannerLoop();
    if (ui.camStream) {
      ui.camStream.getTracks().forEach(t => t.stop());
      ui.camStream = null;
    }
    const video = $('#camVideo');
    if (video) {
      video.srcObject = null;
      video.hidden = true;
    }
    $('#startCamBtn').hidden = false;
    $('#capturePhotoBtn').hidden = true;
    $('#flipCamBtn').hidden = true;
    $('#toggleLiveScanBtn').hidden = true;
    $('#stopCamBtn').hidden = true;
    $('#scannerLiveHud').hidden = true;
    if ($('#scanPreviewImg').hidden) {
      $('#scannerPlaceholder').hidden = false;
    }
  }

  function startLiveScannerLoop() {
    stopLiveScannerLoop();
    if (!ui.liveScanEnabled) return;

    ui.liveScanTimer = setInterval(async () => {
      const video = $('#camVideo');
      if (!video || video.hidden || !video.videoWidth || ui.isAnalyzing) return;
      try {
        ui.isAnalyzing = true;
        const cvs = document.createElement('canvas');
        cvs.width = 256;
        cvs.height = 256;
        const ctx = cvs.getContext('2d');
        ctx.drawImage(video, 0, 0, 256, 256);
        const dataUrl = cvs.toDataURL('image/jpeg', 0.72);

        const out = await DETECTOR.analyzeFoodImage(dataUrl);
        if (!out.isNonFood && out.results && out.results.length) {
          const top = out.results[0];
          if (top && top.confidence >= 0.50) {
            const emoji = FOOD_EMOJIS[top.food.id] || '🍽️';
            const kcal = Math.round(top.food.kcal * (top.food.defaultAmt || 1));
            $('#liveTargetEmoji').textContent = emoji;
            $('#liveTargetText').textContent = `${top.food.name} (${fa(Math.round(top.confidence * 100))}٪) · ${fa(top.food.defaultAmt || 1)} ${top.food.unit} = ${fa(kcal)} kcal`;
            $('#liveQuickAddBtn').dataset.quickFoodId = top.food.id;
            $('#liveQuickAddBtn').dataset.quickKcal = kcal;
            $('#liveTargetBadge').hidden = false;
          } else {
            $('#liveTargetBadge').hidden = true;
          }
        } else {
          $('#liveTargetBadge').hidden = true;
        }
      } catch {
        /* نادیده گرفتن خطاهای دوره‌ای اسکن زنده */
      } finally {
        ui.isAnalyzing = false;
      }
    }, 1400);
  }

  function stopLiveScannerLoop() {
    if (ui.liveScanTimer) {
      clearInterval(ui.liveScanTimer);
      ui.liveScanTimer = null;
    }
  }

  $('#startCamBtn').addEventListener('click', startCameraStream);
  $('#stopCamBtn').addEventListener('click', stopCameraStream);
  $('#flipCamBtn').addEventListener('click', flipCameraStream);

  $('#toggleLiveScanBtn').addEventListener('click', () => {
    ui.liveScanEnabled = !ui.liveScanEnabled;
    $('#toggleLiveScanBtn').textContent = ui.liveScanEnabled ? '⚡ تشخیص زنده: روشن' : '⏸ تشخیص زنده: خاموش';
    if (ui.liveScanEnabled) {
      startLiveScannerLoop();
    } else {
      stopLiveScannerLoop();
      $('#liveTargetBadge').hidden = true;
    }
  });

  $('#liveQuickAddBtn').addEventListener('click', e => {
    e.stopPropagation();
    const foodId = $('#liveQuickAddBtn').dataset.quickFoodId;
    if (!foodId) return;
    const food = SINGLE_FOODS.find(f => f.id === foodId);
    if (!food) return;

    const u = currentUser();
    if (!u) return;

    const qty = food.defaultAmt || 1;
    const kcal = Math.round(food.kcal * qty);
    const slot = getDefaultMealSlot();

    u.extraFoods = u.extraFoods || {};
    u.extraFoods[ui.day] = u.extraFoods[ui.day] || [];
    u.extraFoods[ui.day].push({
      uid: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      foodId: food.id,
      name: food.name,
      amount: qty,
      unit: food.unit,
      mealSlot: slot,
      kcal,
      p: Math.round(food.p * qty * 10) / 10,
      c: Math.round(food.c * qty * 10) / 10,
      f: Math.round(food.f * qty * 10) / 10
    });

    saveStore();
    const m = calcAll(u.profile);
    renderDashboard(u, m);
    renderDietSection(u, m);
    playSuccessChime();
    speakPersian(`${food.name}، ${kcal} کالری ثبت شد`);
    showToast(`✅ ${fa(qty, 1)} ${food.unit} ${food.name} (${fa(kcal)} کالری) به کالری امروز اضافه شد.`);
  });

  $('#capturePhotoBtn').addEventListener('click', async () => {
    const video = $('#camVideo');
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    stopCameraStream();
    await runFoodDetection(dataUrl);
  });

  $('#galleryFileInput').addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (!file) return;
    stopCameraStream();
    const reader = new FileReader();
    reader.onload = async ev => {
      await runFoodDetection(ev.target.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  });

  $('#nativeCameraInput').addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (!file) return;
    stopCameraStream();
    const reader = new FileReader();
    reader.onload = async ev => {
      await runFoodDetection(ev.target.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  });

  async function runFoodDetection(imgDataUrl) {
    $('#scannerPlaceholder').hidden = true;
    const previewImg = $('#scanPreviewImg');
    previewImg.src = imgDataUrl;
    previewImg.hidden = false;
    $('#scanBeam').hidden = false;
    $('#scanResultCard').hidden = true;

    try {
      const out = await DETECTOR.analyzeFoodImage(imgDataUrl);
      $('#scanBeam').hidden = true;
      renderDetectionResults(out);
    } catch (err) {
      $('#scanBeam').hidden = true;
      showToast(err.message || 'خطا در تحلیل تصویر');
    }
  }

  function renderDetectionResults(out) {
    $('#scanResultCard').hidden = false;
    $('#scanCelebrationBox').hidden = true;
    const heroBox = $('#detectedHeroContainer');
    const altsBox = $('#detectedAlternativesContainer');
    const metaEl = $('#scanResultMeta');

    const providerName = out.provider === 'onnx' ? 'مدل هوش مصنوعی MobileCLIP' : 'تشخیص هوشمند بصری';
    if (metaEl) {
      metaEl.textContent = out.inferenceMs
        ? `پردازش آفلاین در ${fa(out.inferenceMs)} میلی‌ثانیه · ${providerName}`
        : 'انتخاب مستقیم خوراکی';
    }

    if (out.isNonFood) {
      heroBox.innerHTML = `
        <div style="text-align:center;padding:26px 14px">
          <div style="font-size:2.2rem;margin-bottom:8px">🔍</div>
          <b style="font-size:1.05rem;display:block;margin-bottom:6px">خوراکی مشخصی در تصویر تشخیص داده نشد</b>
          <p class="small muted" style="max-width:400px;margin:0 auto 16px">
            کادر دوربین را مستقیماً روی میوه یا ظرف غذا تنظیم کنید، یا از میانبرها و دکمه جستجوی دستی استفاده کنید.
          </p>
          <div class="actions-row" style="justify-content:center">
            <button type="button" class="btn btn-primary btn-sm" id="retryCamBtn">تلاش مجدد با دوربین</button>
            <button type="button" class="btn btn-secondary btn-sm" id="nonFoodManualBtn">جستجوی دستی غذا</button>
          </div>
        </div>
      `;
      $('#retryCamBtn')?.addEventListener('click', startCameraStream);
      $('#nonFoodManualBtn')?.addEventListener('click', openManualFoodCatalog);
      altsBox.hidden = true;
      return;
    }

    if (!out.results || !out.results.length) {
      heroBox.innerHTML = `
        <p class="small muted" style="margin:10px 0;text-align:center">غذایی شناسایی نشد. از دکمه «جستجوی دستی» استفاده کنید.</p>
      `;
      altsBox.hidden = true;
      return;
    }

    // خوراکی اصلی با بالاترین درصد تطابق
    const topResult = out.results[0];
    ui.activeDetectedFood = topResult.food;
    ui.activeDetectedQty = topResult.food.defaultAmt || 1;
    ui.activeDetectedMealSlot = getDefaultMealSlot();

    updateHeroFoodCard(topResult);

    // سایر پیشنهادات نزدیک
    const alternatives = out.results.slice(1);
    if (alternatives.length) {
      altsBox.hidden = false;
      altsBox.innerHTML = `
        <div class="alternatives-box">
          <span class="small muted" style="display:block;margin-bottom:6px">آیا خوراکی دیگری در تصویر است؟ انتخاب سریع:</span>
          <div class="chips-row">
            ${alternatives.map(r => `
              <button type="button" class="chip" data-switch-food="${r.food.id}">
                ${FOOD_EMOJIS[r.food.id] || '🍽️'} ${esc(r.food.name)} (${fa(Math.round(r.confidence * 100))}٪)
              </button>
            `).join('')}
            <button type="button" class="chip" id="switchManualFoodBtn">🔍 انتخاب از کل لیست غذاها</button>
          </div>
        </div>
      `;
    } else {
      altsBox.hidden = true;
    }
  }

  function updateHeroFoodCard(resultObj = null) {
    const food = ui.activeDetectedFood;
    if (!food) return;

    const heroBox = $('#detectedHeroContainer');
    const emoji = FOOD_EMOJIS[food.id] || '🍽️';
    const confPct = resultObj ? Math.round(resultObj.confidence * 100) : 95;
    const currentQty = ui.activeDetectedQty;
    const totalKcal = Math.round(food.kcal * currentQty);
    const totalP = Math.round(food.p * currentQty * 10) / 10;
    const totalC = Math.round(food.c * currentQty * 10) / 10;
    const totalF = Math.round(food.f * currentQty * 10) / 10;
    const approxGrams = food.unit !== 'گرم' && food.gramPerUnit
      ? `معادل تقریبی: ~${fa(Math.round(currentQty * food.gramPerUnit))} گرم`
      : '';

    const speechText = currentQty === 1
      ? `این خوراکی ${food.name} است — ۱ ${food.unit} حدود ${fa(totalKcal)} کالری دارد.`
      : `شما ${fa(currentQty, 1)} ${food.unit} ${food.name} میل کرده‌اید — معادل ${fa(totalKcal)} کالری.`;

    heroBox.innerHTML = `
      <div class="detected-hero-box">
        <div class="detected-hero-header">
          <div class="detected-hero-emoji">${emoji}</div>
          <div style="flex:1">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <h2 style="margin:0;font-size:1.35rem">${esc(food.name)}</h2>
              <span class="conf-badge">${fa(confPct)}٪ تطابق هوش مصنوعی</span>
            </div>
            <p class="detected-speech-bubble" id="detectedSpeechBubble">
              «${speechText}»
            </p>
          </div>
        </div>

        <div class="detected-calc-card">
          <div class="calc-row-header">
            <span style="font-weight:600">میزان مصرف‌شده:</span>
            <div class="portion-stepper" style="margin:0">
              <button type="button" class="step-btn" id="heroQtyDecBtn" title="کاهش">−</button>
              <span class="hero-qty-val"><b id="heroQtyDisplay">${fa(currentQty, 1)}</b> <small class="muted">${esc(food.unit)}</small></span>
              <button type="button" class="step-btn" id="heroQtyIncBtn" title="افزایش">+</button>
            </div>
          </div>

          <!-- بنتو کارت شاخص‌های تغذیه‌ای زنده -->
          <div class="hero-macros-grid">
            <div class="hero-macro-cell hero-kcal-cell">
              <small>کالری کل محاسبه‌شده</small>
              <div class="big-kcal"><b id="heroKcalVal">${fa(totalKcal)}</b> <span class="muted-inline">kcal</span></div>
              <div class="sub-note" id="heroGramsVal" style="font-size:0.75rem">${approxGrams}</div>
            </div>
            <div class="hero-macro-cell">
              <small>پروتئین</small>
              <div class="macro-val"><b id="heroPVal">${fa(totalP, 1)}</b>g</div>
            </div>
            <div class="hero-macro-cell">
              <small>کربوهیدرات</small>
              <div class="macro-val"><b id="heroCVal">${fa(totalC, 1)}</b>g</div>
            </div>
            <div class="hero-macro-cell">
              <small>چربی</small>
              <div class="macro-val"><b id="heroFVal">${fa(totalF, 1)}</b>g</div>
            </div>
          </div>

          <!-- انتخاب وعده غذایی -->
          <div class="meal-slot-picker">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <span class="small muted">ثبت در کدام وعده غذایی امروز؟</span>
              <button type="button" class="small muted" style="background:none;border:none;cursor:pointer;color:var(--primary)" id="openAdvancedPortionBtn">
                ⚙️ تنظیم مقدار با گرم دقیق
              </button>
            </div>
            <div class="chips-row" id="heroMealSlotChips">
              <button type="button" class="chip ${ui.activeDetectedMealSlot === 'breakfast' ? 'active' : ''}" data-slot="breakfast">صبحانه</button>
              <button type="button" class="chip ${ui.activeDetectedMealSlot === 'lunch' ? 'active' : ''}" data-slot="lunch">ناهار</button>
              <button type="button" class="chip ${ui.activeDetectedMealSlot === 'snack' ? 'active' : ''}" data-slot="snack">میان‌وعده</button>
              <button type="button" class="chip ${ui.activeDetectedMealSlot === 'dinner' ? 'active' : ''}" data-slot="dinner">شام</button>
            </div>
          </div>

          <!-- دکمه ثبت مستقیم در کالری روزانه -->
          <button type="button" id="heroConfirmAddBtn" class="btn btn-primary btn-block btn-lg" style="margin-top:14px;font-size:1.05rem">
            <svg class="ic" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
            ثبت در کالری امروز (<span id="heroBtnKcalVal">${fa(totalKcal)}</span> کیلوکالری)
          </button>
        </div>
      </div>
    `;

    $('#heroQtyDecBtn').addEventListener('click', () => {
      const step = food.step || 0.5;
      const min = food.min || 0.5;
      ui.activeDetectedQty = Math.max(min, Math.round((ui.activeDetectedQty - step) * 100) / 100);
      updateHeroLiveValues();
    });

    $('#heroQtyIncBtn').addEventListener('click', () => {
      const step = food.step || 0.5;
      const max = (food.max || 10) * 2;
      ui.activeDetectedQty = Math.min(max, Math.round((ui.activeDetectedQty + step) * 100) / 100);
      updateHeroLiveValues();
    });

    $('#heroMealSlotChips').addEventListener('click', e => {
      const chip = e.target.closest('[data-slot]');
      if (!chip) return;
      ui.activeDetectedMealSlot = chip.dataset.slot;
      $$('#heroMealSlotChips .chip').forEach(c => c.classList.toggle('active', c === chip));
    });

    $('#heroConfirmAddBtn').addEventListener('click', commitHeroDetectedFood);
    $('#openAdvancedPortionBtn').addEventListener('click', () => {
      openPortionForFood(food.id, ui.activeDetectedQty);
    });
  }

  function updateHeroLiveValues() {
    const food = ui.activeDetectedFood;
    if (!food) return;

    const qty = ui.activeDetectedQty;
    const totalKcal = Math.round(food.kcal * qty);
    const totalP = Math.round(food.p * qty * 10) / 10;
    const totalC = Math.round(food.c * qty * 10) / 10;
    const totalF = Math.round(food.f * qty * 10) / 10;
    const approxGrams = food.unit !== 'گرم' && food.gramPerUnit
      ? `معادل تقریبی: ~${fa(Math.round(qty * food.gramPerUnit))} گرم`
      : '';

    $('#heroQtyDisplay').textContent = fa(qty, 1);
    $('#heroKcalVal').textContent = fa(totalKcal);
    $('#heroPVal').textContent = fa(totalP, 1);
    $('#heroCVal').textContent = fa(totalC, 1);
    $('#heroFVal').textContent = fa(totalF, 1);
    $('#heroGramsVal').textContent = approxGrams;
    $('#heroBtnKcalVal').textContent = fa(totalKcal);

    const speechText = qty === 1
      ? `این خوراکی ${food.name} است — ۱ ${food.unit} حدود ${fa(totalKcal)} کالری دارد.`
      : `شما ${fa(qty, 1)} ${food.unit} ${food.name} میل کرده‌اید — معادل ${fa(totalKcal)} کالری.`;
    $('#detectedSpeechBubble').innerHTML = `«${speechText}»`;
  }

  function commitHeroDetectedFood() {
    const u = currentUser();
    const food = ui.activeDetectedFood;
    if (!u || !food) return;

    const qty = ui.activeDetectedQty || food.defaultAmt || 1;
    const kcal = Math.round(food.kcal * qty);
    const slot = ui.activeDetectedMealSlot || getDefaultMealSlot();

    u.extraFoods = u.extraFoods || {};
    u.extraFoods[ui.day] = u.extraFoods[ui.day] || [];
    u.extraFoods[ui.day].push({
      uid: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      foodId: food.id,
      name: food.name,
      amount: qty,
      unit: food.unit,
      mealSlot: slot,
      kcal,
      p: Math.round(food.p * qty * 10) / 10,
      c: Math.round(food.c * qty * 10) / 10,
      f: Math.round(food.f * qty * 10) / 10
    });

    saveStore();
    const m = calcAll(u.profile);
    renderDashboard(u, m);
    renderDietSection(u, m);

    playSuccessChime();
    speakPersian(`${food.name}، ${kcal} کالری در برنامه امروز ثبت شد`);

    const consumed = getConsumedForDay(u, ui.day);
    const remaining = m.target - consumed.kcal;
    const remainingText = remaining >= 0
      ? `${fa(remaining)} کیلوکالری تا سقف مجاز روزانه باقی‌مانده`
      : `${fa(Math.abs(remaining))} کیلوکالری بیش از هدف روزانه`;

    $('#detectedHeroContainer').innerHTML = '';
    $('#detectedAlternativesContainer').hidden = true;
    const celeb = $('#scanCelebrationBox');
    celeb.hidden = false;
    celeb.innerHTML = `
      <div style="font-size:2.4rem;margin-bottom:8px">🎉</div>
      <h3 style="margin:0 0 6px;color:var(--text)">با موفقیت به کالری امروز اضافه شد!</h3>
      <p style="margin:0 0 14px;color:var(--text-muted);font-size:0.95rem">
        شما امروز <b>${fa(qty, 1)} ${esc(food.unit)} ${esc(food.name)}</b> (معادل <b>${fa(kcal)}</b> کالری) مصرف کردید و در وعده <b>«${esc(MEAL_NAMES[slot])}»</b> ثبت شد.
      </p>
      <div class="consumed-status-mini">
        <span>مجموع مصرف امروز: <b>${fa(consumed.kcal)}</b> از ${fa(m.target)} kcal</span>
        <span class="muted">(${remainingText})</span>
      </div>
      <div class="actions-row" style="justify-content:center;margin-top:16px">
        <button type="button" id="scanNextFoodBtn" class="btn btn-primary">
          <svg class="ic" viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          اسکن خوراکی دیگر
        </button>
        <button type="button" id="viewInDashboardBtn" class="btn btn-secondary">
          مشاهده در داشبورد 📊
        </button>
      </div>
    `;

    $('#scanNextFoodBtn').addEventListener('click', () => {
      celeb.hidden = true;
      $('#scanResultCard').hidden = true;
      $('#scanPreviewImg').hidden = true;
      startCameraStream();
    });

    $('#viewInDashboardBtn').addEventListener('click', () => {
      switchTab('dashboard');
    });
  }

  $('#detectedAlternativesContainer').addEventListener('click', e => {
    const btn = e.target.closest('[data-switch-food]');
    if (btn) {
      const food = SINGLE_FOODS.find(f => f.id === btn.dataset.switchFood);
      if (food) {
        ui.activeDetectedFood = food;
        ui.activeDetectedQty = food.defaultAmt || 1;
        updateHeroFoodCard();
      }
      return;
    }
    if (e.target.closest('#switchManualFoodBtn')) {
      openManualFoodCatalog();
    }
  });

  $('#rescanBtn').addEventListener('click', () => {
    $('#scanResultCard').hidden = true;
    $('#scanPreviewImg').hidden = true;
    startCameraStream();
  });

  $('#quickSimBar').addEventListener('click', e => {
    const btn = e.target.closest('[data-sim-food]');
    if (!btn) return;
    const food = SINGLE_FOODS.find(f => f.id === btn.dataset.simFood);
    if (!food) return;
    renderDetectionResults({
      provider: 'shortcut',
      inferenceMs: 15,
      results: [{ food, confidence: 0.98 }]
    });
  });

  $('#manualFallbackBtn').addEventListener('click', openManualFoodCatalog);

  $('#openModelInfoBtn').addEventListener('click', () => {
    const st = DETECTOR.getState();
    $('#modelInfoClasses').textContent = `${fa(st.classCount)} غذا + فیلتر غیرغذا`;
    $('#modelInfoModal').hidden = false;
  });

  /* ---------- کاتالوگ خوراکی و صفحه انتخاب مقدار (Amount Sheet) ---------- */
  function renderFoodCatalog(query = '') {
    const q = query.trim();
    const list = q ? SINGLE_FOODS.filter(f => f.name.includes(q) || f.cat.includes(q)) : SINGLE_FOODS;
    $('#foodCatalogGrid').innerHTML = list.map(f => `
      <button type="button" class="food-cat-btn" data-pick-sfood="${f.id}">
        <b>${esc(f.name)}</b>
        <small>${esc(f.cat)} · بر حسب ${esc(f.unit)}</small>
      </button>
    `).join('');
  }

  function openManualFoodCatalog() {
    $('#foodModal').hidden = false;
    $('#foodPickerStep').hidden = false;
    $('#portionPickerStep').hidden = true;
    $('#foodModalTitle').textContent = 'انتخاب خوراکی';
    $('#singleFoodSearch').value = '';
    renderFoodCatalog('');
  }

  function openPortionForFood(foodId, overrideAmt = null) {
    const food = SINGLE_FOODS.find(f => f.id === foodId);
    if (!food) return;
    ui.selectedSingleFood = food;

    const initAmt = overrideAmt || food.defaultAmt;

    $('#foodModal').hidden = false;
    $('#foodPickerStep').hidden = true;
    $('#portionPickerStep').hidden = false;
    $('#foodModalTitle').textContent = `مقدار مصرفی — ${food.name}`;

    $('#portionFoodHeader').innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;background:var(--surface-2);padding:12px 14px;border-radius:12px">
        <div>
          <b style="font-size:1.02rem;display:block">${esc(food.name)}</b>
          <small class="muted">${esc(food.hint || `واحد اندازه‌گیری: ${food.unit}`)}</small>
        </div>
        <span class="wday-badge" style="margin:0;background:var(--primary-soft);color:var(--primary)">واحد: ${esc(food.unit)}</span>
      </div>
    `;

    $('#portionUnitLabel').textContent = `چقدر ${food.name} خورده‌اید؟ (${food.unit})`;
    $('#portionUnitSuffix').textContent = food.unit;

    const numInput = $('#portionAmountInput');
    const rangeInput = $('#portionRangeInput');
    numInput.min = food.min;
    numInput.max = food.max * 2;
    numInput.step = food.step;
    numInput.value = initAmt;

    rangeInput.min = food.min;
    rangeInput.max = food.max;
    rangeInput.step = food.step;
    rangeInput.value = initAmt;

    $('#portionPresetsRow').innerHTML = food.presets.map(val => `
      <button type="button" class="chip" data-portion-preset="${val}">${fa(val, 1)} ${esc(food.unit)}</button>
    `).join('');

    updatePortionLiveMacros(initAmt);
  }

  function updatePortionLiveMacros(rawAmt) {
    const food = ui.selectedSingleFood;
    if (!food) return;
    const amt = Math.max(0.1, Number(rawAmt) || food.defaultAmt);
    const kcal = Math.round(food.kcal * amt);
    const p = Math.round(food.p * amt * 10) / 10;
    const c = Math.round(food.c * amt * 10) / 10;
    const f = Math.round(food.f * amt * 10) / 10;
    const approxGrams = food.unit !== 'گرم' && food.gramPerUnit
      ? ` · معادل تقریبی: ~${fa(Math.round(amt * food.gramPerUnit))} گرم`
      : '';

    $('#portionLiveMacros').innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">
        <span class="small muted">${fa(amt, 1)} ${esc(food.unit)}${approxGrams}</span>
        <b style="font-size:1.3rem;color:var(--primary)">${fa(kcal)} kcal</b>
      </div>
      <div class="small muted">پروتئین: <b>${fa(p, 1)}g</b> · کربوهیدرات: <b>${fa(c, 1)}g</b> · چربی: <b>${fa(f, 1)}g</b></div>
    `;
  }

  $('#openFoodModalBtn').addEventListener('click', openManualFoodCatalog);
  $('#singleFoodSearch').addEventListener('input', e => renderFoodCatalog(e.target.value));

  $('#foodCatalogGrid').addEventListener('click', e => {
    const btn = e.target.closest('[data-pick-sfood]');
    if (!btn) return;
    openPortionForFood(btn.dataset.pickSfood);
  });

  function stepPortionBy(dir) {
    const food = ui.selectedSingleFood;
    if (!food) return;
    const cur = parseNum($('#portionAmountInput').value) || food.defaultAmt;
    const next = Math.max(food.min, Math.round((cur + dir * food.step) * 100) / 100);
    $('#portionAmountInput').value = next;
    $('#portionRangeInput').value = Math.min(food.max, next);
    updatePortionLiveMacros(next);
  }

  $('#stepMinusBtn').addEventListener('click', () => stepPortionBy(-1));
  $('#stepPlusBtn').addEventListener('click', () => stepPortionBy(+1));

  $('#portionAmountInput').addEventListener('input', e => {
    const v = parseNum(e.target.value);
    if (!Number.isNaN(v) && v > 0) {
      $('#portionRangeInput').value = v;
      updatePortionLiveMacros(v);
    }
  });

  $('#portionRangeInput').addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    $('#portionAmountInput').value = v;
    updatePortionLiveMacros(v);
  });

  $('#portionPresetsRow').addEventListener('click', e => {
    const chip = e.target.closest('[data-portion-preset]');
    if (!chip) return;
    const v = parseFloat(chip.dataset.portionPreset);
    $('#portionAmountInput').value = v;
    $('#portionRangeInput').value = v;
    updatePortionLiveMacros(v);
  });

  $('#backToFoodListBtn').addEventListener('click', openManualFoodCatalog);

  $('#confirmAddFoodBtn').addEventListener('click', () => {
    const u = currentUser();
    const food = ui.selectedSingleFood;
    if (!u || !food) return;
    const amt = parseNum($('#portionAmountInput').value);
    if (!(amt > 0)) {
      showToast('مقدار معتبری وارد کنید.');
      return;
    }
    const mealSlot = $('#portionMealSelect').value || 'lunch';

    u.extraFoods = u.extraFoods || {};
    u.extraFoods[ui.day] = u.extraFoods[ui.day] || [];
    u.extraFoods[ui.day].push({
      uid: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      foodId: food.id,
      name: food.name,
      amount: amt,
      unit: food.unit,
      mealSlot,
      kcal: Math.round(food.kcal * amt),
      p: Math.round(food.p * amt * 10) / 10,
      c: Math.round(food.c * amt * 10) / 10,
      f: Math.round(food.f * amt * 10) / 10
    });

    saveStore();
    $('#foodModal').hidden = true;
    const m = calcAll(u.profile);
    renderDashboard(u, m);
    renderDietSection(u, m);
    showToast(`${fa(amt, 1)} ${food.unit} ${food.name} به کالری ${DAYS[ui.day]} اضافه شد.`);
  });

  /* ---------- ۴. برنامه تمرینی ---------- */
  function renderWorkoutSection(u, m) {
    const isNone = u.profile.workoutMode === 'none';
    $('#noWorkoutBox').hidden = !isNone;
    $('#activeWorkoutBox').hidden = isNone;
    if (isNone) return;

    if (!u.workout || u.workout.mode !== u.profile.workoutMode) {
      u.workout = generateWeeklyWorkout(u.profile, m);
      saveStore();
    }

    $$('[data-wsub]').forEach(b => b.classList.toggle('active', b.dataset.wsub === ui.workoutSub));
    ['plan', 'bank', 'timer'].forEach(k => { $('#wsub-' + k).hidden = ui.workoutSub !== k; });

    $('#workoutPlanTitle').textContent = u.workout.mode === 'gym' ? 'برنامه بدنسازی هفتگی' : 'برنامه تمرین خانگی و هوازی';
    $('#workoutPlanSub').textContent = u.workout.summary;
    $('#workoutCardioTip').textContent = u.workout.cardioNote;

    $('#workoutDaysGrid').innerHTML = u.workout.days.map((day, i) => {
      const isToday = i === TODAY_IDX;
      if (day.type === 'rest') {
        return `
          <article class="wday-card rest ${isToday ? 'today' : ''}">
            <div class="wday-top">
              <h3>${DAYS[i]}${isToday ? ' (امروز)' : ''}</h3>
              <small class="muted">ریکاوری</small>
            </div>
            <span class="wday-badge">استراحت</span>
            <p class="small muted" style="margin:0">${esc(day.title)}</p>
          </article>
        `;
      }
      return `
        <article class="wday-card ${isToday ? 'today' : ''}">
          <div class="wday-top">
            <h3>${DAYS[i]}${isToday ? ' (امروز)' : ''}</h3>
            <small class="muted">~${fa(day.minutes)} دقیقه</small>
          </div>
          <span class="wday-badge">${esc(day.title)}</span>
          <ul class="wex-list">
            ${day.items.map(ex => `
              <li class="wex-item">
                <div class="wex-row">
                  <span>${esc(ex.name)}</span>
                  <span class="wex-dose">${esc(ex.dose)}</span>
                </div>
                <small class="muted" style="display:block;font-size:0.78rem">${esc(ex.tip)}</small>
                ${ex.media ? `<button type="button" class="wex-gif-btn" data-open-gif="${esc(ex.media)}" data-gif-name="${esc(ex.name)}" data-gif-desc="${esc(ex.tip)}">نمایش انیمیشن حرکت</button>` : ''}
              </li>
            `).join('')}
          </ul>
        </article>
      `;
    }).join('');

    renderExerciseBank(u);
    renderMedalsAndStreak(u);
  }

  $$('[data-wsub]').forEach(btn => {
    btn.addEventListener('click', () => {
      ui.workoutSub = btn.dataset.wsub;
      const u = currentUser();
      if (u) renderWorkoutSection(u, calcAll(u.profile));
    });
  });

  $$('[data-enable-workout]').forEach(btn => {
    btn.addEventListener('click', () => {
      const u = currentUser();
      if (!u) return;
      u.profile.workoutMode = btn.dataset.enableWorkout;
      const m = calcAll(u.profile);
      u.workout = generateWeeklyWorkout(u.profile, m);
      saveStore();
      renderAll();
      showToast('برنامه تمرینی فعال شد.');
    });
  });

  $('#disableWorkoutBtn').addEventListener('click', () => {
    const u = currentUser();
    if (!u) return;
    u.profile.workoutMode = 'none';
    u.workout = null;
    saveStore();
    renderAll();
    showToast('برنامه تمرینی غیرفعال شد.');
  });

  $('#regenWorkoutBtn').addEventListener('click', () => {
    const u = currentUser();
    if (!u) return;
    const m = calcAll(u.profile);
    u.workout = generateWeeklyWorkout(u.profile, m);
    saveStore();
    renderWorkoutSection(u, m);
    showToast('چیدمان جدید حرکات ساخته شد.');
  });

  document.addEventListener('click', e => {
    const gifBtn = e.target.closest('[data-open-gif]');
    if (gifBtn) {
      $('#gifModalTitle').textContent = gifBtn.dataset.gifName;
      $('#gifModalImg').src = gifBtn.dataset.openGif;
      $('#gifModalDesc').textContent = gifBtn.dataset.gifDesc || '';
      $('#gifModal').hidden = false;
      return;
    }

    const closeBtn = e.target.closest('[data-close-modal]');
    if (closeBtn) {
      $('#' + closeBtn.dataset.closeModal).hidden = true;
      return;
    }

    if (e.target.classList.contains('modal-backdrop')) {
      e.target.hidden = true;
    }
  });

  function renderExerciseBank(u) {
    const favs = u.progress.favExercises || [];
    $('#favCountLbl').textContent = fa(favs.length);
    $('#favFilterBtn').classList.toggle('active', ui.favOnly);

    $('#muscleGroupBar').innerHTML = MUSCLE_GROUPS.map(mg => `
      <div class="muscle-chip-card ${!ui.favOnly && ui.selectedMuscle === mg.id ? 'active' : ''}" data-select-muscle="${mg.id}">
        <img src="${mg.icon}" alt="${esc(mg.title)}" loading="lazy" decoding="async">
        <span>${esc(mg.title)}</span>
      </div>
    `).join('');

    const q = $('#exSearchInput').value.trim();
    let list = GYM_EXERCISES;
    if (ui.favOnly) {
      list = list.filter(ex => favs.includes(ex.id));
    } else if (!q) {
      list = list.filter(ex => ex.muscle === ui.selectedMuscle);
    }
    if (q) {
      list = GYM_EXERCISES.filter(ex => ex.name.includes(q) || ex.detail.includes(q));
    }

    if (!list.length) {
      $('#exBankGrid').innerHTML = `<div class="card" style="grid-column:1/-1;text-align:center"><p class="muted" style="margin:0">حرکتی یافت نشد.</p></div>`;
      return;
    }

    const lvlLabel = { beginner: 'مبتدی', medium: 'متوسط', advanced: 'پیشرفته' };
    $('#exBankGrid').innerHTML = list.map(ex => {
      const isFav = favs.includes(ex.id);
      return `
        <article class="ex-bank-card">
          <img src="${ex.media}" alt="${esc(ex.name)}" loading="lazy" decoding="async">
          <div class="ex-bank-body">
            <div class="ex-bank-head">
              <div>
                <h4 style="margin:0 0 4px">${esc(ex.name)}</h4>
                <span class="wday-badge" style="margin:0">${lvlLabel[ex.level] || 'متوسط'} · ${fa(ex.calories)} kcal / ۱۰ دقیقه</span>
              </div>
              <button type="button" class="fav-heart ${isFav ? 'active' : ''}" data-toggle-fav="${ex.id}" title="ذخیره حرکت">
                <svg class="ic" viewBox="0 0 24 24" style="${isFav ? 'fill:currentColor' : ''}"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              </button>
            </div>
            <p class="small muted" style="margin:8px 0 0">${esc(ex.detail)}</p>
          </div>
        </article>
      `;
    }).join('');
  }

  $('#muscleGroupBar').addEventListener('click', e => {
    const card = e.target.closest('[data-select-muscle]');
    if (!card) return;
    ui.selectedMuscle = card.dataset.selectMuscle;
    ui.favOnly = false;
    $('#exSearchInput').value = '';
    const u = currentUser();
    if (u) renderExerciseBank(u);
  });

  $('#favFilterBtn').addEventListener('click', () => {
    ui.favOnly = !ui.favOnly;
    const u = currentUser();
    if (u) renderExerciseBank(u);
  });

  $('#exSearchInput').addEventListener('input', () => {
    const u = currentUser();
    if (u) renderExerciseBank(u);
  });

  $('#exBankGrid').addEventListener('click', e => {
    const favBtn = e.target.closest('[data-toggle-fav]');
    if (!favBtn) return;
    const u = currentUser();
    if (!u) return;
    const exId = favBtn.dataset.toggleFav;
    u.progress.favExercises = u.progress.favExercises || [];
    if (u.progress.favExercises.includes(exId)) {
      u.progress.favExercises = u.progress.favExercises.filter(x => x !== exId);
    } else {
      u.progress.favExercises.push(exId);
    }
    saveStore();
    renderExerciseBank(u);
  });

  $('#completeWorkoutBtn').addEventListener('click', () => {
    const u = currentUser();
    if (!u) return;
    const todayKey = new Date().toDateString();
    if (u.progress.lastWorkoutDate === todayKey) {
      showToast('جلسه تمرین امروز قبلاً ثبت شده است.');
      return;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (u.progress.lastWorkoutDate === yesterday.toDateString()) {
      u.progress.streak = (u.progress.streak || 0) + 1;
    } else {
      u.progress.streak = 1;
    }
    u.progress.workouts = (u.progress.workouts || 0) + 1;
    u.progress.lastWorkoutDate = todayKey;

    const rules = [
      { name: 'اولین گام', ok: u.progress.workouts >= 1 },
      { name: '۳ جلسه تمرین', ok: u.progress.workouts >= 3 },
      { name: '۷ روز پیاپی', ok: u.progress.streak >= 7 },
      { name: '۱۰ جلسه تمرین', ok: u.progress.workouts >= 10 },
      { name: '۳۰ جلسه استمرار', ok: u.progress.workouts >= 30 }
    ];
    u.progress.badges = u.progress.badges || [];
    rules.forEach(r => {
      if (r.ok && !u.progress.badges.includes(r.name)) u.progress.badges.push(r.name);
    });

    saveStore();
    renderAll();
    playBeep(960, 0.22);
    showToast(`جلسه امروز ثبت شد · استریک: ${fa(u.progress.streak)} روز`);
  });

  function renderMedalsAndStreak(u) {
    $('#streakStat').textContent = `${fa(u.progress.streak || 0)} روز`;
    $('#totalWorkoutsStat').textContent = `${fa(u.progress.workouts || 0)} جلسه`;
    const badges = u.progress.badges || [];
    $('#medalsBox').innerHTML = badges.length
      ? badges.map(b => `<span class="medal-pill">${esc(b)}</span>`).join('')
      : `<span class="small muted">با ثبت جلسات تمرین، نشان‌های ثبات تمرینی در اینجا نمایش داده می‌شوند.</span>`;
  }

  function formatClock(sec) {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`.replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
  }

  function startIntervalTimer() {
    if (ui.timerRunning) return;
    if (ui.timerLeft <= 0) {
      const workSec = Math.max(5, parseInt($('#workSecInput').value, 10) || 60);
      const restSec = Math.max(5, parseInt($('#restSecInput').value, 10) || 45);
      ui.timerLeft = ui.timerRestMode ? restSec : workSec;
    }
    $('#timerClock').classList.toggle('rest-mode', ui.timerRestMode);
    $('#timerStateLbl').textContent = ui.timerRestMode ? 'در حال استراحت بین ست' : 'در حال اجرای ست';
    $('#timerClock').textContent = formatClock(ui.timerLeft);

    ui.timerRunning = true;
    ui.timerId = setInterval(() => {
      ui.timerLeft--;
      $('#timerClock').textContent = formatClock(Math.max(0, ui.timerLeft));
      if (ui.timerLeft <= 0) {
        clearInterval(ui.timerId);
        ui.timerRunning = false;
        ui.timerRestMode = !ui.timerRestMode;
        playBeep(ui.timerRestMode ? 620 : 940, 0.28);
        showToast(ui.timerRestMode ? 'زمان استراحت شروع شد' : 'شروع ست بعدی');
        startIntervalTimer();
      }
    }, 1000);
  }

  function pauseIntervalTimer() {
    clearInterval(ui.timerId);
    ui.timerRunning = false;
  }

  function resetIntervalTimer() {
    pauseIntervalTimer();
    ui.timerRestMode = false;
    const workSec = Math.max(5, parseInt($('#workSecInput').value, 10) || 60);
    ui.timerLeft = workSec;
    $('#timerClock').classList.remove('rest-mode');
    $('#timerClock').textContent = formatClock(workSec);
    $('#timerStateLbl').textContent = 'آماده شروع';
  }

  $('#timerStartBtn').addEventListener('click', startIntervalTimer);
  $('#timerPauseBtn').addEventListener('click', pauseIntervalTimer);
  $('#timerResetBtn').addEventListener('click', resetIntervalTimer);

  /* ---------- ۵. تنظیمات و پروفایل ---------- */
  function renderSettingsSection(u, m) {
    window.FIT_FACE_LOGIN.refresh(u);
    renderGoalCards('#settingsGoalsGrid', 'settingsGoalRadio', u.profile.goal, m.recommendation.id);

    $('#setWorkoutMode').value = u.profile.workoutMode || 'gym';
    $('#setWorkoutLevel').value = u.profile.workoutLevel || 'medium';
    $('#setWorkoutDays').value = String(u.profile.workoutDays || 4);
    syncSettingsWorkoutVisibility();

    $('#epName').value = u.name;
    $('#epGender').value = u.profile.gender;
    $('#epAge').value = u.profile.age;
    $('#epHeight').value = u.profile.height;
    $('#epWeight').value = u.profile.weight;
    $('#epIntake').value = u.profile.intakeKnown && u.profile.intake ? u.profile.intake : '';
    $('#epNeck').value = u.profile.neck || '';
    $('#epWaist').value = u.profile.waist || '';
    $('#epHip').value = u.profile.hip || '';
    $('#epActivity').value = String(u.profile.activity);
  }

  function syncSettingsWorkoutVisibility() {
    const mode = $('#setWorkoutMode').value;
    $('#setLevelWrap').hidden = mode === 'none';
    $('#setDaysWrap').hidden = mode !== 'gym';
  }
  $('#setWorkoutMode').addEventListener('change', syncSettingsWorkoutVisibility);

  $('#saveGoalBtn').addEventListener('click', () => {
    const u = currentUser();
    if (!u) return;
    const chosen = $('input[name="settingsGoalRadio"]:checked')?.value;
    if (!chosen) return;

    u.profile.goal = chosen;
    const m = calcAll(u.profile);
    u.diet = generateWeeklyDiet(m.target, u.profile.goal, u.disliked);
    u.workout = generateWeeklyWorkout(u.profile, m);
    saveStore();
    renderAll();
    showToast(`هدف به «${m.goalObj.title}» تغییر یافت و برنامه بروز شد.`);
  });

  $('#saveWorkoutCfgBtn').addEventListener('click', () => {
    const u = currentUser();
    if (!u) return;
    u.profile.workoutMode = $('#setWorkoutMode').value;
    u.profile.workoutLevel = $('#setWorkoutLevel').value;
    u.profile.workoutDays = Number($('#setWorkoutDays').value) || 4;
    const m = calcAll(u.profile);
    u.workout = generateWeeklyWorkout(u.profile, m);
    saveStore();
    renderAll();
    showToast('برنامه تمرینی بروزرسانی شد.');
  });

  $('#editProfileForm').addEventListener('submit', e => {
    e.preventDefault();
    const u = currentUser();
    if (!u) return;

    const age = parseNum($('#epAge').value);
    const height = parseNum($('#epHeight').value);
    const weight = parseNum($('#epWeight').value);
    const intake = parseNum($('#epIntake').value);
    const neck = parseNum($('#epNeck').value);
    const waist = parseNum($('#epWaist').value);
    const hip = parseNum($('#epHip').value);

    if (!(age >= 12 && age <= 95) || !(height >= 120 && height <= 230) || !(weight >= 30 && weight <= 260)) {
      showToast('مقادیر سن، قد و وزن را بررسی کنید.');
      return;
    }

    const prevWeight = u.profile.weight;
    u.name = $('#epName').value.trim() || u.name;
    u.profile.gender = $('#epGender').value;
    u.profile.age = Math.round(age);
    u.profile.height = height;
    u.profile.weight = weight;
    u.profile.activity = parseFloat($('#epActivity').value) || 1.375;
    u.profile.intake = Number.isNaN(intake) ? null : Math.round(intake);
    u.profile.intakeKnown = !Number.isNaN(intake) && intake >= 600;
    u.profile.neck = Number.isNaN(neck) ? null : neck;
    u.profile.waist = Number.isNaN(waist) ? null : waist;
    u.profile.hip = Number.isNaN(hip) ? null : hip;

    const m = calcAll(u.profile);
    if (prevWeight !== weight) {
      u.weightHistory = u.weightHistory || [];
      u.weightHistory.push({ date: faDateShort(), weight, bf: m.bodyFat });
    }
    u.diet = generateWeeklyDiet(m.target, u.profile.goal, u.disliked);
    u.workout = generateWeeklyWorkout(u.profile, m);
    saveStore();
    renderAll();
    switchMainTab('dashboard');
    showToast('مشخصات ذخیره شد.');
  });

  /* ================= Service Worker ================= */
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }

  /* ================= شروع ================= */
  window.FIT_FACE_LOGIN.initialize({
    getUser: currentUser,
    getUsers: () => Object.values(store.users),
    getRequestedUsername: () => toEn($('#liUsername').value).toLowerCase(),
    saveTemplate(username, template) {
      const user = currentUser();
      if (!user || user.username !== username) throw new Error('ابتدا وارد حساب خود شوید.');
      const previous = user.faceLogin;
      if (template) user.faceLogin = template;
      else delete user.faceLogin;
      try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); }
      catch {
        if (previous) user.faceLogin = previous;
        else delete user.faceLogin;
        throw new Error('فضای ذخیره‌سازی مرورگر کافی نیست؛ الگوی چهره ذخیره نشد.');
      }
      window.FIT_FACE_LOGIN.refresh(user);
    },
    onLogin: loginAs,
    notice: showToast
  });
  applyTheme(store.theme);
  resetIntervalTimer();

  if (currentUser()) {
    loginAs(store.currentUserId);
  } else {
    const hasUsers = Object.keys(store.users).length > 0;
    setAuthTab(hasUsers ? 'login' : 'signup');
  }

  window.FitApp = {
    openPortionForFood,
    runFoodDetection
  };
})();
