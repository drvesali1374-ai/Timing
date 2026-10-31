/**
 * آزمون‌های واحد موتور دستیار آفلاین (لایه الف — قواعد قطعی).
 * پوشش: پارسر متن→گام (طبقه‌بندی/عدد/واحد/مبدأ-مقصد/پرسش‌ها) + موتور پیشنهاد (قواعد/فرضیه‌ها/کنترل‌ها).
 */

import { describe, expect, test } from "bun:test";
import { draftFromText, normalizeDigits } from "./parser";
import { analyzeDiagram, proposeVariantSuggestion, ASSISTANT_ENGINE_VERSION } from "./rules";
import { KNOWLEDGE_ENTRIES, KNOWLEDGE_VERSION, searchKnowledge } from "./knowledge";
import { emptyDoc, makeNode, type DiagramDoc } from "@/shared/diagrams/types";

describe("پارسر: طبقه‌بندی نماد با واژه‌گانه", () => {
  test("حمل شناسایی و مسافت استخراج می‌شود", () => {
    const r = draftFromText({ kind: "fpc", text: "حمل از انبار به دستگاه — 15 متر", subject: "material" });
    expect(r.steps).toHaveLength(1);
    expect(r.steps[0].symbol).toBe("transport");
    expect(r.steps[0].distanceM).toBe(15);
    expect(r.steps[0].origin).toBe("انبار");
    expect(r.steps[0].destination).toBe("دستگاه");
  });

  test("اعداد فارسی + دقیقه/ساعت تبدیل می‌شوند", () => {
    const r = draftFromText({ kind: "fpc", text: "انتظار برای آزادسازی ۳ دقیقه", subject: "material" });
    expect(r.steps[0].symbol).toBe("delay");
    expect(r.steps[0].timeSec).toBe(180);
  });

  test("انبارش و بازرسی و عملیات پیش‌فرض", () => {
    const r = draftFromText({
      kind: "fpc",
      text: "ذخیره در انبار\nکنترل ابعادی قطعه\nخردن مواد اولیه",
      subject: "material",
    });
    expect(r.steps.map((s) => s.symbol)).toEqual(["storage", "inspection", "operation"]);
  });

  test("شماره‌گذاری خطوط حذف می‌شود", () => {
    const r = draftFromText({ kind: "fpc", text: "1. برش ورق\n۲- جوشکاری", subject: "material" });
    expect(r.steps).toHaveLength(2);
    expect(r.steps[0].title.startsWith("برش")).toBe(true);
    expect(r.steps[1].title.startsWith("جوشکاری")).toBe(true);
  });

  test("کیلومتر به متر تبدیل می‌شود", () => {
    const r = draftFromText({ kind: "fpc", text: "حمل به انبار محصول ۲ کیلومتر", subject: "material" });
    expect(r.steps[0].distanceM).toBe(2000);
  });

  test("متن خالی → پرسش بازنویسی", () => {
    const r = draftFromText({ kind: "fpc", text: "", subject: "material" });
    expect(r.steps).toHaveLength(0);
    expect(r.questions.some((q) => q.kind === "rephrase")).toBe(true);
  });

  test("بدون موضوع → پرسش موضوع مطالعه", () => {
    const r = draftFromText({ kind: "fpc", text: "برش ورق" });
    expect(r.questions.some((q) => q.kind === "subject")).toBe(true);
  });

  test("حمل بدون مسافت → پرسش مسافت", () => {
    const r = draftFromText({ kind: "fpc", text: "حمل به انبار", subject: "material" });
    expect(r.questions.some((q) => q.kind === "distance")).toBe(true);
  });

  test("واژه چندپهلو → پرسش نوع گام", () => {
    // «بررسی و حمل» هم بازرسی هم حمل — ابهام
    const r = draftFromText({ kind: "fpc", text: "بررسی و حمل قطعه به ایستگاه بعد", subject: "material" });
    expect(r.questions.some((q) => q.kind === "step-type")).toBe(true);
    // اولویت transport در ابهام
    expect(r.steps[0].symbol).toBe("transport");
  });

  test("نرمال‌سازی ارقام فارسی", () => {
    expect(normalizeDigits("۱۲٫۵")).toBe("12.5");
    expect(normalizeDigits("۴۵")).toBe("45");
  });
});

describe("موتور پیشنهاد: قواعد اصلاح", () => {
  test("حمل بدون مسافت → پیشنهاد R-DIST-1 با منبع", () => {
    const doc: DiagramDoc = { ...emptyDoc("fpc"), subject: "material" };
    const n = makeNode("fpc", "n1", "transport", "حمل به انبار");
    n.timeSec = 10;
    doc.nodes.push(n);
    const s = analyzeDiagram(doc);
    const dist = s.find((x) => x.ruleId === "R-DIST-1");
    expect(dist).toBeDefined();
    expect(dist?.sourceRef).toContain("کتابخانه دانش");
    expect(dist?.status).toBe("pending"); // هرگز خودکار اعمال نمی‌شود
  });

  test("تأخیر → فرضیه حذف با برچسب صریح", () => {
    const doc: DiagramDoc = { ...emptyDoc("fpc"), subject: "material" };
    const n = makeNode("fpc", "n1", "delay", "انتظار برای crane");
    n.timeSec = 120;
    doc.nodes.push(n);
    const s = analyzeDiagram(doc);
    const hyp = s.find((x) => x.ruleId === "R-HYP-1");
    expect(hyp?.kind).toBe("hypothesis");
    expect(hyp?.messageFa).toContain("فرضیه قابل آزمون");
  });

  test("حمل بدون علت تأخیر ثبت‌شده — علت در reason ذکر می‌شود", () => {
    const doc: DiagramDoc = { ...emptyDoc("fpc"), subject: "material" };
    const n = makeNode("fpc", "n1", "delay", "انتظار صف");
    n.timeSec = 60;
    n.note = "صف تجهیز شستشو";
    doc.nodes.push(n);
    const s = analyzeDiagram(doc);
    const hyp = s.find((x) => x.ruleId === "R-HYP-1");
    expect(hyp?.reasonFa).toContain("صف تجهیز شستشو");
  });

  test("حمل طولانی → فرضیه کاهش مسافت", () => {
    const doc: DiagramDoc = { ...emptyDoc("fpc"), subject: "material" };
    const n = makeNode("fpc", "n1", "transport", "حمل به انبار遥远");
    n.timeSec = 60;
    n.distanceM = 45;
    doc.nodes.push(n);
    const s = analyzeDiagram(doc);
    expect(s.some((x) => x.ruleId === "R-HYP-2")).toBe(true);
  });

  test("دو حمل متوالی (stepNo) → فرضیه ادغام", () => {
    const doc: DiagramDoc = { ...emptyDoc("fpc"), subject: "material" };
    const a = makeNode("fpc", "a", "transport", "حمل اول");
    a.stepNo = 1;
    a.timeSec = 10;
    a.distanceM = 5;
    const b = makeNode("fpc", "b", "transport", "حمل دوم");
    b.stepNo = 2;
    b.timeSec = 10;
    b.distanceM = 5;
    doc.nodes.push(a, b);
    const s = analyzeDiagram(doc);
    expect(s.some((x) => x.ruleId === "R-HYP-3")).toBe(true);
  });

  test("گام تکراری → پرسش R-DUP-1", () => {
    const doc: DiagramDoc = { ...emptyDoc("fpc"), subject: "material" };
    const a = makeNode("fpc", "a", "operation", "برش");
    a.timeSec = 5;
    const b = makeNode("fpc", "b", "operation", "برش");
    b.timeSec = 5;
    doc.nodes.push(a, b);
    const s = analyzeDiagram(doc);
    expect(s.some((x) => x.ruleId === "R-DUP-1")).toBe(true);
  });

  test("حمل با مسافت صفر → تناقض R-CONTRA-1", () => {
    const doc: DiagramDoc = { ...emptyDoc("fpc"), subject: "material" };
    const n = makeNode("fpc", "a", "transport", "حمل صفر");
    n.timeSec = 5;
    n.distanceM = 0;
    doc.nodes.push(n);
    const s = analyzeDiagram(doc);
    expect(s.some((x) => x.ruleId === "R-CONTRA-1")).toBe(true);
  });

  test("شناسه پیشنهاد قطعی + نسخه موتور", () => {
    const doc: DiagramDoc = { ...emptyDoc("fpc"), subject: "material" };
    const n = makeNode("fpc", "n1", "transport", "حمل");
    n.timeSec = 5;
    doc.nodes.push(n);
    const s1 = analyzeDiagram(doc);
    const s2 = analyzeDiagram(doc);
    expect(s1.map((x) => x.id)).toEqual(s2.map((x) => x.id));
    expect(s1.every((x) => x.engineVersion === ASSISTANT_ENGINE_VERSION)).toBe(true);
  });

  test("نمودار سالم OPC بدون پیشنهاد حمل/تأخیر", () => {
    const doc = emptyDoc("opc");
    const a = makeNode("opc", "a", "operation", "مونتاژ بدنه");
    a.timeSec = 30;
    const b = makeNode("opc", "b", "inspection", "کنترل نهایی");
    b.timeSec = 10;
    doc.nodes.push(a, b);
    doc.edges.push({ id: "e1", from: "a", to: "b" });
    const s = analyzeDiagram(doc);
    expect(s.filter((x) => x.kind === "hypothesis")).toHaveLength(0);
  });
});

describe("پیشنهاد نسخه پیشنهادی", () => {
  test("با وجود تأخیر → پیشنهاد ساخت variant", () => {
    const doc: DiagramDoc = { ...emptyDoc("fpc"), subject: "material" };
    const n = makeNode("fpc", "n1", "delay", "انتظار");
    n.timeSec = 30;
    doc.nodes.push(n);
    const s = proposeVariantSuggestion(doc);
    expect(s).not.toBeNull();
    expect(s?.sourceRef).toContain("مقایسه روش‌ها");
  });

  test("بدون تأخیر/حمل طولانی → null", () => {
    const doc: DiagramDoc = { ...emptyDoc("fpc"), subject: "material" };
    const n = makeNode("fpc", "n1", "operation", "برش");
    n.timeSec = 10;
    doc.nodes.push(n);
    expect(proposeVariantSuggestion(doc)).toBeNull();
  });
});

describe("کتابخانه دانش محلی", () => {
  test("نسخه‌دار و غیرخالی", () => {
    expect(KNOWLEDGE_VERSION).toBe("1.0.0");
    expect(KNOWLEDGE_ENTRIES.length).toBeGreaterThanOrEqual(15);
  });

  test("جست‌وجو: «تأخیر» → قاعده علت + نماد", () => {
    const results = searchKnowledge("تأخیر");
    expect(results.some((e) => e.id === "guide.delay-reason" || e.id === "sym.fpc.delay")).toBe(true);
  });

  test("جست‌وجوی خالی → خالی", () => {
    expect(searchKnowledge("")).toEqual([]);
  });

  test("هر مدخل منبع محلی دارد (بدون منبع بدون ارجاع)", () => {
    for (const e of KNOWLEDGE_ENTRIES) {
      expect(e.sourceRef.trim().length).toBeGreaterThan(3);
    }
  });
});
