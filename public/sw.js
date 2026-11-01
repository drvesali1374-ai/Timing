/**
 * Service Worker پلتفرم زمان‌سنجی صنعتی — پیاده‌سازی ADR-006 (فاز ۷)
 * ----------------------------------------------------------------
 * استراتژی:
 *  - ناوبری (request.mode === 'navigate'): شبکه-اول → عقب‌گرد به کش → صفحه آفلاین
 *  - دارایی‌های استاتیک هش‌شده (/_next/static/، آیکون‌ها، فونت‌ها): کش-اول + بازآوری در پس‌زمینه (SWR)
 *  - API (/api/**): فقط-شبکه — هرگز پاسخ API کش نمی‌شود (یکپارچگی داده)؛
 *    صف‌های آفلاین دادهٔ ساخت‌یافته در IndexedDB (timing-chrono / timing-diagrams)
 *    طبق ADR-013/012 مدیریت می‌شوند، نه در این SW.
 *  - پایان‌های احراز هویت (/api/auth/**): کاملاً دست‌نخورده.
 *  - نسخه‌بندی کش: با تغییر APP_VERSION کش‌های قدیمی در activate پاک می‌شوند.
 *
 * صداقت (قاعده منشور): هیچ «همگام موفق» جعلی ادعا نمی‌شود؛ آفلاین فقط
 * برای پوسته برنامه و دارایی‌هاست، نه داده.
 */

const APP_VERSION = "tazmin-pwa-v1.0.0";
const SHELL_CACHE = `${APP_VERSION}-shell`;
const STATIC_CACHE = `${APP_VERSION}-static`;

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

  // ناوبری صفحه: شبکه-اول با عقب‌گرد
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          // نسخه تازه پوسته را کش کن (برای بار بعدی)
          const cache = await caches.open(SHELL_CACHE);
          cache.put("/", fresh.clone()).catch(() => {});
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

  // دارایی استاتیک: کش-اول + بازآوری در پس‌زمینه (stale-while-revalidate)
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        const revalidate = fetch(req)
          .then((res) => {
            if (res && res.status === 200) {
              const put = res.clone();
              caches
                .open(STATIC_CACHE)
                .then((c) => c.put(req, put))
                .catch((err) => {
                  console.warn("[sw] cache.put failed:", req.url, err && err.message);
                });
            }
            return res;
          })
          .catch(() => null);
        if (cached) {
          revalidate.catch(() => {});
          return cached;
        }
        const fresh = await revalidate;
        if (fresh) return fresh;
        return new Response("", { status: 504 });
      })(),
    );
  }
});
