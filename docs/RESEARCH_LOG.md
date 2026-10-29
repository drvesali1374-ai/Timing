# سوابق پژوهش و راستی‌آزمایی منابع (RESEARCH LOG)

**فاز:** صفر — **تاریخ هر واکشی:** ۲۹ اکتبر ۲۰۲۶ (UTC) — ابزار: واکشی خودکار HTTP + مرور در دسترس محیط

## ۱. منابع مهندسی صنایع

| منبع | URL | روش راستی‌آزمایی | نتیجه | استفاده در تصمیم |
|---|---|---|---|---|
| ILO — Introduction to Work Study (4th ed.) | ilo.org/publications/... | واکشی خودکار | صفحه عمومی؛ در واکشی خودکار چالش ربات (Cloudflare) — قابل مشاهده انسانی | PROFILES §۳ (استناد مفهومی فقط) |
| REFA Lexikon — Verteilzeitstudie | refa.de/service/refa-lexikon/verteilzeitstudie | واکشی خودکار | ✅ عنوان تأیید: «Verteilzeitstudie Definition \| REFA» | STANDARDS ردیف ۲ |
| ISO 6385:2016 | iso.org/standard/63785.html | واکشی خودکار | چالش ربات؛ وضعیت استاندارد از سند جامع نقل شد | STANDARDS ردیف ۳ |
| ISO 22400-1:2014 | iso.org/standard/56847.html | واکشی خودکار | چالش ربات؛ «تأیید ۲۰۲۵ و جاری» طبق سند جامع (نقل صفحه ISO) | STANDARDS ردیف ۴ |
| LEI — Operator Balance Chart | lean.org/lexicon-terms/operator-balance-chart/ | واکشی خودکار | ✅ عنوان تأیید | PROFILES §۴٫۴ |
| ScienceDirect — Process Chart | sciencedirect.com/topics/engineering/process-chart | واکشی خودکار | ✅ در دسترس | STANDARDS ردیف ۶ |
| MDPI Sensors 2025 — Line Balancing Review | mdpi.com/1424-8220/25/20/6337 | واکشی خودکار | عنوان در واکشی خودکار خالی (محافظت ربات)؛ استناد کتاب‌شناختی از سند جامع | ADR-008 |
| Production Engineering Archives 2026 | reference-global.com/article/10.30657/pea.2026.32.16 | از سند جامع | استناد کتاب‌شناختی | ADR-008 |
| JMS 2025 — Mixed/multi-model review | doi.org/10.1016/j.jmsy.2025.07.005 | از سند جامع | اشتراکی؛ دسترسی آزموده نشد | افق آتی (KNOWN_LIMITATIONS) |

## ۲. منابع فنی وب

| منبع | نتیجه واکشی ۲۰۲۶-۱۰-۲۹ |
|---|---|
| MDN — High precision timing | ✅ «High precision timing - Web APIs \| MDN» |
| MDN — Page Visibility API | ✅ |
| MDN — Offline and background operation (PWA) | ✅ |
| MDN — WebGPU API | ✅ |
| WebLLM — Local Inference | ✅ «Local Inference \| WebLLM.io» |
| Hugging Face — Transformers.js | ✅ |
| OWASP — Multi-Tenant Security Cheat Sheet | ✅ |
| W3C WAI — WCAG 2 Overview | ✅ (WCAG 2.2 جاری طبق صفحه) |

## ۳. نسخه‌های کتابخانه (npm registry، ۲۰۲۶-۱۰-۲۹)

| بسته | آخرین نسخه پایدار | یادداشت |
|---|---|---|
| next | 16.4.3 | کانال پایدار؛ محیط: 16.1.x |
| react | 19.3.1 | — |
| tailwindcss | 4.3.3 | — |
| @xyflow/react | 12.12.0 | انتخاب فاز ۳ (ADR-007) |
| zustand | 5.0.16 | — |
| zod | 4.6.7 | — |
| recharts | 3.10.1 | موجود در محیط: 2.15.4 |
| @prisma/client | 7.10.1 | prisma CLI: 8.0.0-rc → در فاز ۱ کانال پایدار |
| jsep | 1.6.0 | الگوی طراحی پارسر (ADR-003) |
| mathjs | 15.2.0 | رد‌شده (ADR-003) |
| next-auth | 4.24.15 | — |

## ۴. تصمیم‌های مستندشده با منبع

| تصمیم | منبع پشتیبان | فاز مؤثر |
|---|---|---|
| تفکیک monotonic/دیواری + مدیریت خواب تب | MDN Performance/Visibility (۲۰۲۶-۱۰-۲۹) | ADR-004 → فاز ۴ |
| PWA + IndexedDB آفلاین | MDN PWA Offline (۲۰۲۶-۱۰-۲۹) | ADR-006 → فاز ۳/۴ |
| لایه اختیاری مدل محلی با تشخیص قابلیت | WebLLM Local Inference + MDN WebGPU | ADR-002/PROFILES → فاز ۳ |
| مجوزسنجی سرور چند-مستأجری | OWASP Multi-Tenant | ADR-009 → فاز ۱ |
| دسترس‌پذیری هدف AA | WCAG 2.2 (W3C) | فاز ۷ |
| مجموعه الگوریتم‌های بالانس | مرورهای ۲۰۲۵/۲۰۲۶ | ADR-008 → فاز ۶ |
| تفکیک مجاز on-normal/on-standard | متون مرجع IE (ILO مفهومی) | FORMULA_CATALOG TS-011/012 |

## ۵. تعهد پژوهش برای فازهای بعد

- هر فاز پیش از تصمیم روش‌شناختی جدید، منبع معتبر جاری را راستی‌آزمایی و در همین سند ثبت می‌کند.
- صفحات ISO/ILO/MDPI که در واکشی خودکار چالش داشتند، در فاز مربوطه با مرورگر واقعی مجدداً بررسی می‌شوند.
