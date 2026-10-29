/**
 * داده نمونه وایرفریم فاز صفر
 * قاعده سند جامع (بخش D): «نمونه‌های آزمایشی نباید با داده واقعی مخلوط شوند»
 * → همه ثابت‌های این فایل صرفاً برای نمایش ساختار UI در فاز صفر هستند
 *   و هیچ مسیر داده واقعی آن‌ها را نمی‌خواند.
 */

export const DEMO_TAG = "نمونه — فاز ۰" as const;

export interface DemoProject {
  id: string;
  code: string;
  title: string;
  profile: string;
  status: "active" | "recording" | "archived" | "demo";
  statusLabel: string;
  readiness: { measurement: boolean; analysis: boolean; approval: boolean };
  meta: string;
  updatedAt: string;
}

export const demoProjects: DemoProject[] = [
  {
    id: "p-001",
    code: "PRJ-1401",
    title: "زمان‌سنجی خط مونتاژ پکیج الکترونیک",
    profile: "مطالعه عمومی زمان صنعتی (ILO-هم‌راستا)",
    status: "recording",
    statusLabel: "در ثبت مشاهدات",
    readiness: { measurement: true, analysis: true, approval: false },
    meta: "خط ۲ · شیفت صبح · ۷ عنصر کاری",
    updatedAt: "۱۴۰۵/۰۸/۰۷",
  },
  {
    id: "p-002",
    code: "PRJ-1402",
    title: "مطالعه جریان بسته‌بندی محصولات غذایی",
    profile: "تحلیل جریان FPC",
    status: "active",
    statusLabel: "فعال — آماده تحلیل",
    readiness: { measurement: true, analysis: true, approval: false },
    meta: "سالن بسته‌بندی · ۱۲ گام فرایندی",
    updatedAt: "۱۴۰۵/۰۸/۰۵",
  },
  {
    id: "p-003",
    code: "PRJ-1399",
    title: "بالانس خط مونتاژ صندلی",
    profile: "کار استاندارد و Yamazumi",
    status: "archived",
    statusLabel: "بایگانی‌شده",
    readiness: { measurement: true, analysis: true, approval: true },
    meta: "۴ ایستگاه · تاکت ۶۰ ثانیه",
    updatedAt: "۱۴۰۵/۰۶/۲۱",
  },
  {
    id: "p-demo",
    code: "EDU-001",
    title: "پروژه آموزشی — آشنایی با محصول",
    profile: "مطالعه عمومی زمان صنعتی",
    status: "demo",
    statusLabel: "نمونه آموزشی ایزوله",
    readiness: { measurement: true, analysis: false, approval: false },
    meta: "جدا از داده واقعی — قابل بازنشانی",
    updatedAt: "۱۴۰۵/۰۸/۰۱",
  },
];

export interface DemoProfile {
  id: string;
  name: string;
  desc: string;
  source: string;
  scope: string;
  phase: string;
  isDefault?: boolean;
}

export const demoProfiles: DemoProfile[] = [
  {
    id: "general",
    name: "مطالعه عمومی زمان صنعتی",
    desc: "تفکیک عناصر، ثبت مشاهدات، ارزیابی عملکرد اختیاری، زمان نرمال و استاندارد با روش مجاز صریح",
    source: "روش مرجع — ILO، مقدمه‌ای بر مطالعه کار (ویرایش ۴) — استناد مفهومی",
    scope: "کارهای تکرارپذیر تولیدی و غیرتولیدی",
    phase: "فاز ۱ و ۲",
    isDefault: true,
  },
  {
    id: "continuous",
    name: "زمان‌سنجی پیوسته",
    desc: "قرائت‌های متوالی و تفکیک عناصر پس از ثبت با کنترل سازگاری جمع عناصر با چرخه",
    source: "روش مرجع — متون مطالعه زمان",
    scope: "چرخه‌های کوتاه و متوسط",
    phase: "فاز ۴",
  },
  {
    id: "snapback",
    name: "زمان‌سنجی بازگشت به صفر",
    desc: "اندازه‌گیری مستقل هر عنصر با محدودیت‌های مستند برای عناصر بسیار کوتاه",
    source: "روش مرجع — متون مطالعه زمان",
    scope: "عناصر بلند و مستقل",
    phase: "فاز ۴",
  },
  {
    id: "manual-machine",
    name: "فعالیت دستی–ماشین",
    desc: "تفکیک کار دستی، زمان خودکار ماشین، انتظار و هم‌پوشانی",
    source: "روش مرجع — مدل فعالیت B5",
    scope: "ایستگاه‌های نیمه‌خودکار",
    phase: "فاز ۲ و ۴",
  },
  {
    id: "lean",
    name: "کار استاندارد و Yamazumi",
    desc: "ترکیب کار، مقایسه با تاکت‌تایم و تحلیل توزیع بار اپراتور",
    source: "روش رایج — Lean (LEI)",
    scope: "خطوط مونتاژ متوازن‌شونده",
    phase: "فاز ۶",
  },
  {
    id: "fpc",
    name: "تحلیل جریان فرایند (FPC)",
    desc: "ثبت عملیات، حمل، بازرسی، تأخیر و انبارش همراه زمان و مسافت",
    source: "روش رایج — نمادهای متعارف فرایند",
    scope: "جریان مواد/فرد/تجهیزات",
    phase: "فاز ۳",
  },
  {
    id: "service",
    name: "خدمات و عملیات اداری",
    desc: "فعالیت‌ها و واحدهای غیرتولیدی؛ فرمول‌های تولیدی قابل غیرفعال‌سازی",
    source: "تعریف محصول — قابل توسعه",
    scope: "دفاتر و خدمات",
    phase: "پس از فاز ۲",
  },
];

export interface DemoParamRow {
  family: string;
  key: string;
  name: string;
  type: string;
  role: string;
  version: number;
  note?: string;
}

export const demoParamRows: DemoParamRow[] = [
  { family: "زمینه مطالعه", key: "study.operator", name: "اپراتور", type: "متن کوتاه", role: "گروه‌بندی", version: 1 },
  { family: "زمینه مطالعه", key: "study.shift", name: "شیفت", type: "انتخاب تکی", role: "گروه‌بندی/فیلتر", version: 2, note: "گزینه‌ها: صبح/عصر/شب" },
  { family: "زمینه مطالعه", key: "study.workstation", name: "ایستگاه", type: "متن کوتاه", role: "گروه‌بندی", version: 1 },
  { family: "روش تجمیع", key: "agg.method", name: "روش تجمیع", type: "انتخاب تکی", role: "محاسباتی", version: 1, note: "میانگین/میانه" },
  { family: "ارزیابی عملکرد", key: "rating.factor", name: "ضریب ارزیابی", type: "درصد ۷۵–۱۲۵", role: "متغیر محاسباتی", version: 1 },
  { family: "مجاز زمان", key: "allowance.rate", name: "نرخ مجاز", type: "درصد ۰–۵۰", role: "متغیر محاسباتی", version: 1, note: "پیش‌فرض ۱۵٪ — پیشنهاد قابل ویرایش" },
];

export interface DemoFormulaRow {
  id: string;
  name: string;
  expr: string;
  scope: string;
  version: string;
  status: "فعال" | "پیش‌نویس" | "منسوخ";
}

export const demoFormulaRows: DemoFormulaRow[] = [
  { id: "TS-001", name: "میانگین عنصر", expr: "mean(observations)", scope: "عنصر", version: "1.0.0", status: "فعال" },
  { id: "TS-010", name: "زمان نرمال", expr: "RT × (RF / 100)", scope: "عنصر", version: "1.0.0", status: "فعال" },
  { id: "TS-011", name: "زمان استاندارد (on-normal)", expr: "NT × (1 + r)", scope: "عنصر", version: "1.1.0", status: "فعال" },
  { id: "TS-012", name: "زمان استاندارد (on-standard)", expr: "NT ÷ (1 − r)", scope: "عنصر", version: "1.0.0", status: "فعال" },
  { id: "TS-013", name: "تاکت‌تایم", expr: "T_net ÷ D", scope: "پروژه", version: "1.0.0", status: "فعال" },
  { id: "TS-020", name: "چرخه دستی–ماشین", expr: "max(Σ manual, machineAuto)", scope: "چرخه", version: "0.2.0", status: "پیش‌نویس" },
];

export const demoTimingElements = [
  { no: 1, name: "برداشتن قطعه از جعبه", hint: "دستی" },
  { no: 2, name: "جای‌گذاری روی فیکسچر", hint: "دستی" },
  { no: 3, name: "نصب درب و پیچ M4", hint: "دستی" },
  { no: 4, name: "اتصال کانکتور", hint: "دستی" },
  { no: 5, name: "پرس سرد", hint: "خودکار ماشین" },
  { no: 6, name: "کنترل کیفیت چشمی", hint: "بازرسی" },
  { no: 7, name: "جداسازی و بسته‌بندی", hint: "دستی" },
];

export const demoReadings = [0.82, 1.1, 0.79, 0.95, 1.02, 0.88, 1.15, 0.91];

export interface DemoFpcNode {
  step: number;
  symbol: "operation" | "transport" | "inspection" | "delay" | "storage";
  label: string;
  time: string;
  distance: string;
  connected: boolean;
}

export const demoFpcNodes: DemoFpcNode[] = [
  { step: 1, symbol: "storage", label: "انبار ماده اولیه", time: "—", distance: "—", connected: true },
  { step: 2, symbol: "transport", label: "انتقال با ترولی به خط", time: "۴٫۲ دقیقه", distance: "۱۸ متر", connected: true },
  { step: 3, symbol: "delay", label: "انتظار کنار خط", time: "۶٫۰ دقیقه", distance: "—", connected: true },
  { step: 4, symbol: "operation", label: "مونتاژ درب", time: "۰٫۹۴ دقیقه", distance: "—", connected: true },
  { step: 5, symbol: "operation", label: "کنترل کانکتور", time: "۰٫۴۰ دقیقه", distance: "—", connected: false },
  { step: 6, symbol: "inspection", label: "بازرسی چشمی", time: "۰٫۳۱ دقیقه", distance: "—", connected: true },
  { step: 7, symbol: "transport", label: "انتقال به انبار محصول", time: "۲٫۸ دقیقه", distance: "۱۲ متر", connected: true },
  { step: 8, symbol: "storage", label: "انبار محصول نهایی", time: "—", distance: "—", connected: true },
];

export const demoAnalysis = {
  element: "نصب درب و پیچ M4",
  chain: [
    { label: "زمان مشاهده‌شده", value: "۰٫۹۲ ث", method: "میانگین ۲۴ مشاهده معتبر (TS-001 v1.0.0)" },
    { label: "زمان نماینده", value: "۰٫۹۴ ث", method: "روش تجمیع: میانگین — agg.method v1" },
    { label: "زمان نرمال", value: "۰٫۹۹ ث", method: "× ضریب ارزیابی ۱۰۵٪ — TS-010 v1.0.0" },
    { label: "زمان استاندارد", value: "۱٫۱۴ ث", method: "on-normal: NT×(1+r)، r=۱۵٪ پیشنهادی — TS-011 v1.1.0" },
  ],
  stats: [
    { k: "تعداد مشاهده", v: "۲۴" },
    { k: "میانگین", v: "۰٫۹۴ ث" },
    { k: "میانه", v: "۰٫۹۳ ث" },
    { k: "انحراف معیار نمونه", v: "۰٫۰۸ ث" },
    { k: "ضریب تغییرات", v: "۸٫۵٪" },
    { k: "کفایت نمونه (۹۵٪/۵٪)", v: "کافی ✓" },
  ],
  histogram: [2, 3, 6, 9, 7, 5, 4, 2, 1, 1],
};

export const demoOutliers = [
  { cycle: 17, value: "۲٫۱۰ ث", reason: "وقفه ثبت‌شده: خرابی فیکسچر", action: "علامت‌گذاری — حذف با قاعده" },
  { cycle: 22, value: "۰٫۴۱ ث", reason: "مشکوک — احتمال ثبت ناقص", action: "نیازمند بررسی" },
];

export const demoBalance = {
  takt: 60,
  stations: [
    { name: "ایستگاه ۱", parts: [["برداشتن قطعه", 12], ["جای‌گذاری", 14], ["نصب درب", 22]] as [string, number][] },
    { name: "ایستگاه ۲", parts: [["اتصال کانکتور", 18], ["پرس سرد", 34]] as [string, number][] },
    { name: "ایستگاه ۳", parts: [["بازرسی", 9], ["بسته‌بندی", 22]] as [string, number][] },
  ],
  metrics: [
    { k: "راندمان بالانس", v: "۸۹٫۴٪", note: "ΣT ÷ (m×C_max) — LB-010" },
    { k: "تأخیر بالانس", v: "۱۰٫۶٪", note: "۱−E — LB-011" },
    { k: "حداقل نظری ایستگاه", v: "۳", note: "⌈ΣT÷تاکت⌉ — LB-020 (کران پایین)" },
    { k: "گلوگاه", v: "ایستگاه ۲ (۵۲ث)", note: "argmax S_k — LB-022" },
    { k: "نیروی نظری", v: "۲٫۸ نفر", note: "ΣT_manual ÷ T_net — LB-030" },
    { k: "تخصیص عملیاتی", v: "۳ نفر", note: "جدا از نیروی نظری — با فرض‌ها" },
  ],
};

export const demoReports = [
  { name: "خلاصه پروژه", desc: "وضعیت داده‌ها، آمادگی و نسخه روش", formats: ["PDF", "HTML"] },
  { name: "مشاهدات خام", desc: "رویدادهای زمانی و قرائت‌ها با شناسه پایدار", formats: ["CSV", "XLSX"] },
  { name: "تحلیل عنصر", desc: "آمار، توزیع و زنجیره زمان با نسخه فرمول", formats: ["PDF", "XLSX"] },
  { name: "زمان نرمال/استاندارد", desc: "با نمایش فرمول، ضرایب و منابع", formats: ["PDF"] },
  { name: "بالانس فعلی/پیشنهادی", desc: "مقایسه سناریوها و شاخص‌ها", formats: ["PDF", "PNG"] },
];

export const navItems = [
  { id: "dashboard", label: "مدیریت پروژه‌ها", icon: "layout", desc: "فهرست، فیلتر، جست‌وجو" },
  { id: "new-project", label: "ایجاد پروژه", icon: "plus", desc: "انتخاب پروفایل" },
  { id: "config", label: "کارگاه پیکربندی", icon: "settings", desc: "خانواده/پارامتر/فرمول" },
  { id: "timing", label: "صفحه زمان‌سنجی", icon: "timer", desc: "کرنومتر و ثبت" },
  { id: "diagrams", label: "نمودارهای OPC/FPC", icon: "git-branch", desc: "ویرایشگر + دستیار" },
  { id: "analysis", label: "تحلیل زمان", icon: "chart", desc: "آمار و زنجیره زمان" },
  { id: "balance", label: "بالانس خط", icon: "bars", desc: "Yamazumi و سناریو" },
  { id: "reports", label: "گزارش‌ها", icon: "file", desc: "خروجی‌ها" },
] as const;

export type ViewId = (typeof navItems)[number]["id"];

export const phaseBadge = {
  phase: "فاز صفر",
  title: "نمونه اولیه قابل بررسی — وایرفریم تعاملی",
  note: "این نمونه ساختار و جریان‌های اصلی UI را نشان می‌دهد؛ منطق واقعی در فازهای ۱ تا ۷ پیاده‌سازی می‌شود.",
};

export function faDigits(input: string | number): string {
  const fa = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return String(input).replace(/[0-9]/g, (d) => fa[Number(d)]);
}

export function faClock(totalSeconds: number, withMs = true): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  const ms = Math.floor((totalSeconds % 1) * 1000);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  const base = faDigits(`${mm}:${ss}`);
  if (!withMs) return base;
  const mss = String(ms).padStart(3, "0");
  return `${base}.${faDigits(mss)}`;
}
