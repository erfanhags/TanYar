window.FIT_FACE_LOGIN = (() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const matcher = window.FIT_FACE_MATCHER;
  const errors = {
    NO_FACE: 'چهره دیده نشد؛ روبه‌روی دوربین و در نور کافی قرار بگیرید.',
    MULTIPLE_FACES: 'فقط یک نفر باید مقابل دوربین باشد.',
    FACE_TOO_SMALL: 'کمی به دوربین نزدیک‌تر شوید.',
    ENGINE_UNAVAILABLE: 'موتور چهره در دسترس نیست. برنامه را ببندید و start_app.bat را دوباره اجرا کنید. برای نصب اولیه setup_face_login.bat را اجرا کنید.',
    ENGINE_BUSY: 'موتور مشغول است؛ چند لحظه بعد دوباره تلاش کنید.',
    ENCODING_TIMEOUT: 'پردازش طول کشید؛ دوباره تلاش کنید.',
    INVALID_IMAGE: 'تصویر دوربین قابل پردازش نیست؛ دوباره تلاش کنید.'
  };
  let config;
  let mode;
  let account;
  let requestedUsername;
  let stream;
  let controller;
  let timer;
  let run = 0;
  let previousFocus;

  function status(message, error = false) {
    $('#faceAuthStatus').textContent = message;
    $('#faceAuthStatus').classList.toggle('face-auth-error', error);
  }

  function stop() {
    run++;
    clearTimeout(timer);
    controller?.abort();
    controller = null;
    if (stream) stream.getTracks().forEach(track => track.stop());
    stream = null;
    $('#faceAuthVideo').srcObject = null;
    $('#startFaceAuthBtn').disabled = false;
  }

  function close() {
    stop();
    $('#faceAuthModal').hidden = true;
    $('#faceEnrollPassword').value = '';
    previousFocus?.focus();
  }

  function open(nextMode) {
    stop();
    mode = nextMode;
    account = config.getUser();
    requestedUsername = config.getRequestedUsername();
    if (mode === 'enroll' && !account) return;
    if (mode === 'login') {
      if (!config.getUsers().some(u => u.faceLogin?.model === matcher.MODEL)) {
        config.notice('ابتدا با حساب خود وارد شوید و در بخش پروفایل، چهره‌تان را ثبت کنید.');
        return;
      }
      if (requestedUsername && !config.getUsers().some(u => u.username === requestedUsername && u.faceLogin?.model === matcher.MODEL)) {
        config.notice('برای این نام کاربری چهره‌ای ثبت نشده است؛ از رمز عبور استفاده کنید.');
        return;
      }
    }
    previousFocus = document.activeElement;
    $('#faceAuthTitle').textContent = mode === 'enroll' ? 'ثبت چهره برای ورود' : 'ورود با تشخیص چهره';
    $('#faceAuthHelp').textContent = mode === 'enroll'
      ? 'سه نمونه با تغییر اندک زاویه‌ی صورت ثبت می‌شود. فقط خودتان مقابل دوربین باشید.'
      : 'روبه‌روی دوربین بمانید تا چهره‌ی شما در سه فریم پیاپی تأیید شود.';
    $('#facePasswordField').hidden = mode !== 'enroll' || !account.password;
    $('#faceEnrollPassword').value = '';
    $('#faceAuthProgress').value = 0;
    status('برای شروع، دکمه‌ی زیر را بزنید و دسترسی دوربین را مجاز کنید.');
    $('#faceAuthModal').hidden = false;
    $('#closeFaceAuthBtn').focus();
  }

  async function frameBlob(video) {
    if (!video.videoWidth || !video.videoHeight) return null;
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  }

  async function start() {
    if (mode === 'enroll' && account.password && $('#faceEnrollPassword').value !== account.password) {
      status('رمز فعلی حساب را درست وارد کنید.', true);
      $('#faceEnrollPassword').focus();
      return;
    }
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      status('برای دسترسی دوربین، برنامه را با start_app.bat و آدرس localhost یا HTTPS باز کنید.', true);
      return;
    }
    stop();
    const currentRun = run;
    controller = new AbortController();
    const signal = controller.signal;
    $('#startFaceAuthBtn').disabled = true;
    $('#faceAuthProgress').value = 0;
    status('در حال آماده‌سازی موتور تشخیص چهره…');
    try {
      const check = await fetch('/api/face/status', { cache: 'no-store', signal });
      if (!check.ok || !(await check.json()).ok) throw new Error('ENGINE_UNAVAILABLE');
      if (run !== currentRun) return;
      const camera = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      if (run !== currentRun) { camera.getTracks().forEach(track => track.stop()); return; }
      stream = camera;
      const video = $('#faceAuthVideo');
      video.srcObject = stream;
      await video.play();
      if (run !== currentRun) return;
      const samples = [];
      const tracker = matcher.createTracker();
      const deadline = Date.now() + 60000;

      async function scan() {
        if (run !== currentRun) return;
        try {
          if (Date.now() > deadline) throw new Error('زمان اسکن تمام شد؛ نور و موقعیت دوربین را بررسی کنید و دوباره شروع کنید.');
          const image = await frameBlob(video);
          if (!image) { timer = setTimeout(scan, 300); return; }
          const response = await fetch('/api/face/encode', { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: image, signal, cache: 'no-store' });
          const result = await response.json();
          if (run !== currentRun) return;
          if (!response.ok) throw new Error(result.code || 'ENGINE_UNAVAILABLE');
          if (!result.ok) {
            if (!['NO_FACE', 'MULTIPLE_FACES', 'FACE_TOO_SMALL'].includes(result.code)) throw new Error(result.code || 'INVALID_IMAGE');
            tracker.push(null);
            samples.length = 0;
            $('#faceAuthProgress').value = 0;
            status(errors[result.code], true);
          } else if (result.model !== matcher.MODEL) {
            throw new Error('ENGINE_UNAVAILABLE');
          } else if (mode === 'enroll') {
            if (config.getUser()?.username !== account.username) { close(); return; }
            const other = matcher.matchFace(result.descriptor, config.getUsers().filter(u => u.username !== account.username));
            if (other) throw new Error('این چهره برای حساب دیگری ثبت شده است؛ از همان حساب وارد شوید.');
            samples.push(result.descriptor);
            $('#faceAuthProgress').value = samples.length;
            status(`نمونه‌ی ${samples.length} از ۳ ثبت شد؛ کمی زاویه‌ی صورت را تغییر دهید.`);
            if (samples.length === 3) {
              const template = matcher.enrollSamples(samples);
              if (!template) throw new Error('نمونه‌ها با هم سازگار نیستند؛ فقط یک نفر در کادر باشد و دوباره تلاش کنید.');
              config.saveTemplate(account.username, template);
              close();
              config.notice('چهره ثبت شد. از این پس می‌توانید با تشخیص چهره وارد این حساب شوید.');
              return;
            }
          } else {
            let username = matcher.matchFace(result.descriptor, config.getUsers());
            if (requestedUsername && username !== requestedUsername) username = null;
            const verified = tracker.push(username);
            $('#faceAuthProgress').value = tracker.count;
            status(username ? `تأیید چهره: ${tracker.count} از ۳؛ مقابل دوربین بمانید.` : 'چهره با حساب ثبت‌شده تطبیق ندارد؛ دوباره تلاش کنید یا با رمز وارد شوید.', !username);
            if (verified) {
              close();
              config.onLogin(username);
              config.notice('چهره تأیید شد؛ خوش آمدید.');
              return;
            }
          }
          timer = setTimeout(scan, mode === 'enroll' ? 900 : 350);
        } catch (error) { failed(error, currentRun); }
      }
      status('چهره‌ی خود را روبه‌روی دوربین نگه دارید…');
      scan();
    } catch (error) { failed(error, currentRun); }
  }

  function failed(error, currentRun) {
    if (run !== currentRun) return;
    stop();
    const message = error.name === 'NotAllowedError' ? 'دسترسی دوربین مجاز نشد؛ مجوز دوربین مرورگر را بررسی کنید یا با رمز وارد شوید.'
      : error.name === 'NotFoundError' ? 'دوربینی پیدا نشد؛ دوربین را وصل کنید یا با رمز وارد شوید.'
      : error.name === 'NotReadableError' ? 'دوربین در برنامه‌ی دیگری مشغول است؛ آن برنامه را ببندید و دوباره تلاش کنید.'
      : errors[error.message] || (error instanceof TypeError ? errors.ENGINE_UNAVAILABLE : error.message);
    status(message, true);
  }

  function refresh(user) {
    const enrolled = user?.faceLogin?.model === matcher.MODEL;
    $('#faceEnrollmentStatus').textContent = enrolled ? 'ورود با چهره برای این حساب فعال است.' : 'هنوز چهره‌ای برای این حساب ثبت نشده است.';
    $('#enrollFaceBtn').textContent = enrolled ? 'ثبت دوباره‌ی چهره' : 'ثبت چهره‌ی من';
    $('#removeFaceBtn').hidden = !enrolled;
  }

  function initialize(options) {
    config = options;
    $('#faceLoginBtn').addEventListener('click', () => open('login'));
    $('#enrollFaceBtn').addEventListener('click', () => open('enroll'));
    $('#removeFaceBtn').addEventListener('click', () => {
      const user = config.getUser();
      if (!user || !confirm('الگوی چهره‌ی این حساب حذف شود؟ ورود با رمز همچنان در دسترس است.')) return;
      try {
        config.saveTemplate(user.username, null);
        config.notice('الگوی چهره حذف شد.');
      } catch (error) { config.notice(error.message); }
    });
    $('#startFaceAuthBtn').addEventListener('click', start);
    $('#closeFaceAuthBtn').addEventListener('click', close);
    $('#faceAuthModal').addEventListener('click', event => { if (event.target === $('#faceAuthModal')) close(); });
    document.addEventListener('keydown', event => {
      if ($('#faceAuthModal').hidden) return;
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key === 'Tab') {
        const focusable = [...$('#faceAuthModal').querySelectorAll('button, input')].filter(el => !el.disabled && el.getClientRects().length);
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    window.addEventListener('pagehide', stop);
    document.addEventListener('visibilitychange', () => { if (document.hidden && !$('#faceAuthModal').hidden) close(); });
  }

  return { initialize, refresh, close };
})();
