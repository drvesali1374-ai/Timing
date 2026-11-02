/**
 * Service Worker پلتفرم زمان‌سنجی صنعتی — پیاده‌سازی ADR-006 (فاز ۷)
 * ----------------------------------------------------------------
 * استراتژی (نسخه ۱.۲.۰ — خودترمیمی چانک 404):
 *  - ناوبری (request.mode === 'navigate'): شبکه-اول با سقف زمانی ۸s →
 *    عقب‌گرد به کش → صفحه آفلاین. شبکهٔ معلق هرگز صفحه را قفل نمی‌کند.
 *  - دارایی‌های استاتیک (/_next/static/، آیکون‌ها، فونت‌ها): شبکه-اول →
 *    عقب‌گرد به کش. (تغییر از SWR: در محیط dev محتوای فایل‌های هم‌نام پس از
 *    هر بازساخت سرور عوض می‌شود؛ کش-اول JS کهنه/ناسازگار سرو می‌کرد و
 *    صفحهٔ سفید می‌ساخت. شبکه-اول + عقب‌گردِ آفلاین صحت را تضمین می‌کند
 *    و آفلاین همچنان کار می‌کند.)
 *  - **خودترمیمی (v1.2.0):** اگر دارایی /_next/ پس از بازساخت سرور 404/شکست
 *    خورد و کشی هم نبود، تمام کش‌ها پاک می‌شوند — بازآوری بعدی صفحه از صفر
 *    شبکه می‌گیرد و صفحه سفید «دائمی» غیرممکن می‌شود. (در dev، pwa-register
 *    اصلاً SW ثبت نمی‌کند — این لایه برای مرورگرهای گیرکرده با نسخه‌های قدیمی
 *    و برای production است.)
 *  - API (/api/**): فقط-شبکه — هرگز پاسخ API کش نمی‌شود (یکپارچگی داده)؛
 *    صف‌های آفلاین دادهٔ ساخت‌یافته در IndexedDB (timing-chrono / timing-diagrams)
 *    طبق ADR-013/012 مدیریت می‌شوند، نه در این SW.
 *  - پایان‌های احراز هویت (/api/auth/**): کاملاً دست‌نخورده.
 *  - نسخه‌بندی کش: با تغییر APP_VERSION کش‌های قدیمی در activate پاک می‌شوند
 *    (v1.2.0 → پاک شدن خودکار کش‌های کهنهٔ v1.0.0/v1.1.0 در مرورگر همهٔ کاربران).
 *
 * صداقت (قاعده منشور): هیچ «همگام موفق» جعلی ادعا نمی‌شود؛ آفلاین فقط
 * برای پوسته برنامه و دارایی‌هاست، نه داده.
 */

const APP_VERSION = "tazmin-pwa-v1.2.0";
const SHELL_CACHE = `${APP_VERSION}-shell`;
const STATIC_CACHE = `${APP_VERSION}-static`;

/** سقف انتظار شبکه (میلی‌ثانیه) — پس از آن عقب‌گرد به کش/آفلاین، نه انتظار بی‌پایان. */
const NETWORK_TIMEOUT_MS = 8_000;

/** fetch با سقف زمانی — شبکهٔ معلق هرگز صفحه را قفل نمی‌کند. */
async function fetchWithTimeout(req) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), NETWORK_TIMEOUT_MS);
  try {
    return await fetch(req, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * پاک‌سازی کامل همهٔ کش‌های اینorigin — «خودترمیمی».
 * وقتی دارایی /_next/ پس از بازساخت سرور 404 شد یعنی گراف چانک عوض شده؛
 * نگه‌داشتن کش‌های ناسازگار فقط بازآوری بد بعدی می‌سازد. پاک‌سازی کامل تضمین
 * می‌کند بازآوری بعدی از شبکه تازه بخواند.
 */
async function purgeAllCaches() {
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  } catch (err) {
    // بهترین تلاش — خطای پاک‌سازی نباید پاسخ اصلی را عوض کند
  }
}

/** دارایی‌های پایه که همیشه باید آفلاین در دسترس باشند. */
const PRECACHE_URLS = [
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-64.png",
  "/favicon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // addAll all-or-nothing نیست — هر URL جداگانه؛ شکست یکی نصب را نمی‌شکند
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            await cache.add(new Request(url, { cache: "reload" }));
          } catch (err) {
            // در dev ممکن است برخی دارایی‌ها هنوز ساخته نشده باشند — بی‌صدا رد شو
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => !k.startsWith(APP_VERSION))
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

/**
 * آیا درخواست دارایی استاتیک قابل‌کش است؟
 * فقط GET و مسیرهای هش‌شده/عمومی — نه API و نه ناوبری.
 */
function isStaticAsset(url) {
  if (url.pathname.startsWith("/api/")) return false;
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/_next/image") ||
    /\.(?:css|js|woff2?|ttf|png|jpg|jpeg|svg|webp|ico|json|webmanifest)$/.test(
      url.pathname,
    )
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // فقط GET؛ POST/PATCH/PUT/DELETE همیشه به شبکه می‌روند
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // cross-origin (فونت گوگل و…) مدیریت نمی‌شود

  // API داده: فقط-شبکه (خطا شفاف به caller می‌رسد؛ صف‌های IndexedDB خودشان عمل می‌کنند)
  if (url.pathname.startsWith("/api/")) return;

  // ناوبری صفحه: شبکه-اول با سقف زمانی و عقب‌گرد
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetchWithTimeout(req);
          if (!fresh.ok && fresh.status >= 500) {
            // خطای سرور (مثلاً کامپایل قطع‌شده در dev) → عقب‌گرد به کش در صورت وجود
            const cachedErr = (await caches.match(req)) || (await caches.match("/"));
            if (cachedErr) return cachedErr;
          }
          if (fresh.ok) {
            // نسخه تازه پوسته را کش کن (برای بار بعد)
            const cache = await caches.open(SHELL_CACHE);
            cache.put("/", fresh.clone()).catch(() => {});
          }
          return fresh;
        } catch (err) {
          const cached =
            (await caches.match(req)) || (await caches.match("/"));
          if (cached) return cached;
          return (
            (await caches.match("/offline.html")) ||
            new Response("آفلاین", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } })
          );
        }
      })(),
    );
    return;
  }

  // دارایی استاتیک: شبکه-اول → عقب‌گرد به کش (آفلاین) — هرگز JS کهنه سرو نمی‌شود
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const isNextAsset = url.pathname.startsWith("/_next/");
        try {
          const fresh = await fetchWithTimeout(req);
          if (fresh && fresh.status === 200) {
            const put = fresh.clone();
            caches
              .open(STATIC_CACHE)
              .then((c) => c.put(req, put))
              .catch((err) => {
                console.warn("[sw] cache.put failed:", req.url, err && err.message);
              });
            return fresh;
          }
          // 404/خطای دیگر → کش در صورت وجود (دارایی هش‌شده تغییرنکرده)؛ وگرنه همان پاسخ
          const cached = await caches.match(req);
          if (cached) return cached;
          // چانک /_next/ حذف‌شده پس از بازساخت و کشی هم نیست → گراف چانک عوض
          // شده؛ کل کش‌ها پاک شوند تا بازآوری بعدی تمیز از شبکه بخواند (خودترمیمی)
          if (isNextAsset && fresh && fresh.status >= 400) await purgeAllCaches();
          return fresh;
        } catch (err) {
          const cached = await caches.match(req);
          if (cached) return cached;
          // شبکه شکست خورد و کشی نیست؛ اگر چانک /_next/ است کش‌ها ناسازگارند → پاک‌سازی
          if (isNextAsset) await purgeAllCaches();
          return new Response("", { status: 504 });
        }
      })(),
    );
  }
});
