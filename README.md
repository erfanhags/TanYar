# تن‌یار | TanYar

**برنامهٔ فارسی تغذیه، تشخیص آفلاین غذا و برنامه‌ریزی تمرین**

TanYar is a Persian, right-to-left fitness and nutrition web app with local food-image recognition, weekly meal and workout planning, and optional face login. The interface uses vanilla JavaScript, a small Node.js server, and an optional Python face-recognition worker.

## امکانات

- رابط فارسی و راست‌به‌چپ، نمایش اعداد فارسی و حالت روشن و تاریک.
- محاسبهٔ شاخص‌های بدن، هدف کالری و درشت‌مغذی‌ها، همراه با نمودار تغییرات وزن.
- ساخت برنامهٔ غذایی هفتگی، جایگزینی وعده‌ها و ثبت خوراکی‌های خارج از برنامه.
- تشخیص تصویر غذا روی دستگاه با مدل MobileCLIP-S0 در قالب ONNX و موتور WebAssembly؛ بدون نیاز به کلید API.
- برنامهٔ تمرینی هفتگی، تصاویر متحرک حرکات، گروه‌های عضلانی و تایمر تمرین و استراحت.
- حساب‌های محلی در مرورگر و ورود اختیاری با چهره پس از راه‌اندازی موتور Python.
- مانیفست PWA و Service Worker برای کش فایل‌های برنامه.

## اجرای سریع

Node.js را نصب کنید و مخزن را دریافت کنید:

```sh
git clone https://github.com/erfanhags/TanYar.git
cd TanYar/FitApp
node server.js
```

سپس آدرس `http://localhost:5173` را باز کنید. اگر پورت اشغال باشد، سرور پورت بعدی را انتخاب می‌کند؛ آدرس دقیق در ترمینال نمایش داده می‌شود.

در ویندوز می‌توانید فایل `start_app.bat` در ریشهٔ مخزن را اجرا کنید. برای بخش اصلی برنامه نصب بسته‌های npm لازم نیست. فایل‌های مدل غذا و موتور ONNX داخل مخزن هستند.

## راه‌اندازی اختیاری ورود با چهره

در ویندوز، Python 3.11 و Python Launcher (`py`) را نصب و سپس فایل زیر را اجرا کنید:

```bat
FitApp\setup_face_login.bat
```

این مرحله برای نصب وابستگی‌ها و دریافت دو مدل چهره به اینترنت نیاز دارد. پس از نصب، سرور را دوباره اجرا کنید و از بخش پروفایل، چهرهٔ خود را ثبت کنید. جزئیات در [راهنمای ورود با چهره](FitApp/FACE_LOGIN.txt) آمده است.

## داده‌ها و محدودیت‌ها

اطلاعات حساب، برنامه‌ها و الگوهای چهره در `localStorage` همان مرورگر نگهداری می‌شوند؛ همگام‌سازی ابری و پایگاه دادهٔ سروری وجود ندارد. پاک‌کردن داده‌های مرورگر می‌تواند این اطلاعات را حذف کند. رمز حساب نیز در همین ذخیره‌سازی محلی نگهداری می‌شود، بنابراین این نسخه برای احراز هویت حساس یا استقرار عمومی آماده نیست.

تشخیص غذا داخل مرورگر انجام می‌شود. برای تشخیص چهره، فریم دوربین به سرور محلی برنامه ارسال و در حافظه پردازش می‌شود. ورود با چهره قابلیت تشخیص زنده‌بودن ندارد. دوربین روی `localhost` قابل استفاده است؛ برای دسترسی از گوشی به اتصال امن HTTPS نیاز است.

پیشنهادهای غذایی، شاخص‌های بدن و نتایج تشخیص تصویر تخمینی هستند. اجرای برنامه با سرور محلی برای مدل ONNX و API چهره توصیه می‌شود؛ بازکردن مستقیم `index.html` امکانات یکسانی ندارد.

## ساختار پروژه

```text
TanYar/
├── start_app.bat             # Windows launcher
└── FitApp/
    ├── index.html           # Persian RTL interface
    ├── css/                 # Styles
    ├── js/                  # App, metrics, charts, food and face matching
    ├── assets/              # Fonts, icons, exercise animations
    ├── models/              # Bundled food vision model
    ├── vendor/ort/          # ONNX Runtime Web and WebAssembly
    ├── server.js            # Local HTTP server
    ├── face-api.js          # Face API and Python worker bridge
    ├── face_worker.py       # Dlib face encoding
    ├── setup_face_login.bat # Optional Windows face setup
    ├── setup_face_models.py # Face model downloads and hash verification
    └── tests/               # JavaScript and Python tests
```

محیط `face-runtime/`، بکاپ‌ها، فایل‌های موقت و نسخهٔ تکراری پروژه در Git نگهداری نمی‌شوند؛ محیط چهره با اسکریپت نصب ساخته می‌شود.

## Tests

Run the JavaScript tests from the application directory:

```sh
cd FitApp
node --test
```

After installing the optional Windows face runtime, run the Python tests from the repository root:

```bat
face-runtime\Scripts\python.exe -m unittest discover -s FitApp\tests -p "test_*.py"
```

Two additional image-based Python tests require the optional `FACE_TEST_IMAGE` and `FACE_TEST_MULTIPLE` environment variables pointing to local test fixtures.

## English overview

- Persian RTL meal and workout planner with body metrics, calorie/macronutrient targets, and weight charts.
- On-device food recognition using a bundled MobileCLIP-S0 FP16 ONNX model and ONNX Runtime Web.
- Exercise animations, muscle-group browsing, workout tracking, and rest timers.
- Optional Dlib HOG / 128-dimensional face matching through a local Python worker.
- Browser-local account storage, plus a PWA manifest and service-worker asset caching.

Start with `node FitApp/server.js` or the root Windows launcher. The core app needs Node.js and a modern browser; the optional face setup targets Windows and Python 3.11. Initial face dependency/model installation needs internet access. Food inference and the installed face engine run locally without a cloud API.

This is a local application: browser-stored passwords and face templates are not production server authentication, and face matching does not include liveness detection. Food recognition and nutrition calculations are estimates.

## Components and credits

The project includes or integrates ONNX Runtime Web, MobileCLIP, Dlib, the `face_recognition_models` model files, and the Vazirmatn font. Existing notices in bundled files are retained. Exercise images and other bundled assets remain subject to their respective owners' terms; this repository does not assign a new blanket license to third-party material.

The face-login integration's original references are listed in [FACE_LOGIN.txt](FitApp/FACE_LOGIN.txt).
