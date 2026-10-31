/**
 * آزمون‌های واحد هسته نمودار (فاز ۳) — خالص، قطعی، بدون DOM.
 * پوشش: اعتبارسنجی (خطاها/هشدارها)، خلاصه، چیدمان خودکار، دیف نسخه‌ها، رندر SVG.
 */

import { describe, expect, test } from "bun:test";
import { emptyDoc, makeNode, FPC_SYMBOLS, OPC_SYMBOLS, type DiagramDoc } from "./types";
import { validateDiagram, summarizeDiagram, topologicalOrder, findCycle } from "./validation";
import { autoLayout } from "./layout";
import { diffVariants } from "./diff";
import { renderDiagramSvg, wrapText, formatSeconds } from "./svg";

function fpcDoc(): DiagramDoc {
  return { kind: "fpc", variant: "current", subject: "material", distanceUnit: "m", nodes: [], edges: [] };
}

function opcDoc(): DiagramDoc {
  return { kind: "opc", variant: "current", nodes: [], edges: [] };
}

describe("اعتبارسنجی نمودار — خطاها", () => {
  test("اتصال به گره ناموجود = invalid-connection", () => {
    const doc = fpcDoc();
    doc.nodes.push(makeNode("fpc", "n1", "operation", "برش"));
    doc.edges.push({ id: "e1", from: "n1", to: "nX" });
    const r = validateDiagram(doc);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.code === "invalid-connection")).toBe(true);
  });

  test("خودحلقه = invalid-connection", () => {
    const doc = fpcDoc();
    doc.nodes.push(makeNode("fpc", "n1", "operation", "برش"));
    doc.edges.push({ id: "e1", from: "n1", to: "n1" });
    const r = validateDiagram(doc);
    expect(r.errors.some((e) => e.code === "invalid-connection" && e.messageFa.includes("خودحلقه"))).toBe(true);
  });

  test("شناسه گره تکراری = duplicate-id", () => {
    const doc = fpcDoc();
    doc.nodes.push(makeNode("fpc", "n1", "operation", "برش"));
    doc.nodes.push(makeNode("fpc", "n1", "transport", "حمل"));
    const r = validateDiagram(doc);
    expect(r.errors.some((e) => e.code === "duplicate-id")).toBe(true);
  });

  test("یال تکراری = duplicate-edge", () => {
    const doc = fpcDoc();
    doc.nodes.push(makeNode("fpc", "n1", "operation", "برش"));
    doc.nodes.push(makeNode("fpc", "n2", "operation", "خردن"));
    doc.edges.push({ id: "e1", from: "n1", to: "n2" });
    doc.edges.push({ id: "e2", from: "n1", to: "n2" });
    const r = validateDiagram(doc);
    expect(r.errors.some((e) => e.code === "duplicate-edge")).toBe(true);
  });

  test("مرجع فعالیت ناموجود = unknown-activity", () => {
    const doc = fpcDoc();
    const n = makeNode("fpc", "n1", "operation", "برش");
    n.activityStableKey = "el.nonexistent";
    doc.nodes.push(n);
    const r = validateDiagram(doc, { knownActivityKeys: ["el.cut"] });
    expect(r.errors.some((e) => e.code === "unknown-activity")).toBe(true);
  });

  test("نماد FPC در سند OPC = bad-symbol", () => {
    const doc = opcDoc();
    doc.nodes.push(makeNode("opc", "n1", "storage", "انبار"));
    const r = validateDiagram(doc);
    expect(r.errors.some((e) => e.code === "bad-symbol")).toBe(true);
  });

  test("زمان منفی = bad-value", () => {
    const doc = fpcDoc();
    const n = makeNode("fpc", "n1", "operation", "برش");
    n.timeSec = -5;
    doc.nodes.push(n);
    const r = validateDiagram(doc);
    expect(r.errors.some((e) => e.code === "bad-value")).toBe(true);
  });

  test("FPC بدون موضوع مطالعه = missing-subject", () => {
    const doc = emptyDoc("fpc");
    doc.nodes.push(makeNode("fpc", "n1", "operation", "برش"));
    const r = validateDiagram(doc);
    expect(r.errors.some((e) => e.code === "missing-subject")).toBe(true);
  });

  test("OPC بدون subject معتبر است", () => {
    const doc = opcDoc();
    doc.nodes.push(makeNode("opc", "n1", "operation", "مونتاژ"));
    const r = validateDiagram(doc);
    expect(r.errors.filter((e) => e.code === "missing-subject")).toHaveLength(0);
  });
});

describe("اعتبارسنجی نمودار — هشدارها", () => {
  test("گام بدون اتصال = unconnected", () => {
    const doc = fpcDoc();
    doc.nodes.push(makeNode("fpc", "n1", "operation", "برش"));
    doc.nodes.push(makeNode("fpc", "n2", "storage", "انبار"));
    const r = validateDiagram(doc);
    expect(r.warnings.filter((w) => w.code === "unconnected")).toHaveLength(2);
  });

  test("چرخه = order-inconsistent (هشدار)", () => {
    const doc = fpcDoc();
    doc.nodes.push(makeNode("fpc", "n1", "operation", "برش"));
    doc.nodes.push(makeNode("fpc", "n2", "operation", "خردن"));
    doc.edges.push({ id: "e1", from: "n1", to: "n2" });
    doc.edges.push({ id: "e2", from: "n2", to: "n1" });
    const r = validateDiagram(doc);
    expect(r.warnings.some((w) => w.code === "order-inconsistent" && w.messageFa.includes("چرخه"))).toBe(true);
    expect(r.valid).toBe(true); // چرخه هشدار است نه خطا
  });

  test("نماد بدون زمان = no-time", () => {
    const doc = fpcDoc();
    doc.nodes.push(makeNode("fpc", "n1", "operation", "برش"));
    const r = validateDiagram(doc);
    expect(r.warnings.some((w) => w.code === "no-time")).toBe(true);
  });

  test("حمل بدون مسافت = no-distance", () => {
    const doc = fpcDoc();
    const n = makeNode("fpc", "n1", "transport", "حمل به انبار");
    n.timeSec = 30;
    doc.nodes.push(n);
    const r = validateDiagram(doc);
    expect(r.warnings.some((w) => w.code === "no-distance")).toBe(true);
  });

  test("ورود جزء بدون منبع = component-no-source", () => {
    const doc = opcDoc();
    const n = makeNode("opc", "n1", "componentEntry", "پیچ M6");
    n.timeSec = 2;
    doc.nodes.push(n);
    const r = validateDiagram(doc);
    expect(r.warnings.some((w) => w.code === "component-no-source")).toBe(true);
  });

  test("انبارش بدون زمان هشدار no-time ندارد", () => {
    const doc = fpcDoc();
    doc.nodes.push(makeNode("fpc", "n1", "storage", "انبار قطعات"));
    const r = validateDiagram(doc);
    expect(r.warnings.some((w) => w.code === "no-time")).toBe(false);
  });

  test("سند کامل معتبر: بدون خطا", () => {
    const doc = fpcDoc();
    const n1 = makeNode("fpc", "n1", "operation", "برش ورق");
    n1.timeSec = 12;
    const n2 = makeNode("fpc", "n2", "transport", "حمل به دستگاه");
    n2.timeSec = 20;
    n2.distanceM = 15;
    const n3 = makeNode("fpc", "n3", "inspection", "کنترل ابعادی");
    n3.timeSec = 8;
    doc.nodes.push(n1, n2, n3);
    doc.edges.push({ id: "e1", from: "n1", to: "n2" }, { id: "e2", from: "n2", to: "n3" });
    const r = validateDiagram(doc);
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
    expect(r.warnings).toHaveLength(0);
  });
});

describe("خلاصه و گراف", () => {
  test("شمارش نمادها + مجموع زمان/مسافت", () => {
    const doc = fpcDoc();
    const n1 = makeNode("fpc", "n1", "operation", "برش");
    n1.timeSec = 12;
    const n2 = makeNode("fpc", "n2", "transport", "حمل");
    n2.timeSec = 20;
    n2.distanceM = 15;
    const n3 = makeNode("fpc", "n3", "transport", "حمل دوم");
    n3.timeSec = 10;
    n3.distanceM = 5;
    doc.nodes.push(n1, n2, n3);
    const s = summarizeDiagram(doc);
    expect(s.counts.operation).toBe(1);
    expect(s.counts.transport).toBe(2);
    expect(s.totalTimeSec).toBe(42);
    expect(s.totalDistanceM).toBe(20);
    expect(s.nodeCount).toBe(3);
  });

  test("توپولوژی پایدار و چرخه‌یابی", () => {
    const doc = fpcDoc();
    doc.nodes.push(makeNode("fpc", "a", "operation", "A"), makeNode("fpc", "b", "operation", "B"), makeNode("fpc", "c", "operation", "C"));
    doc.edges.push({ id: "e1", from: "a", to: "b" }, { id: "e2", from: "b", to: "c" });
    expect(topologicalOrder(doc)).toEqual(["a", "b", "c"]);
    expect(findCycle(doc)).toBeNull();
    doc.edges.push({ id: "e3", from: "c", to: "a" });
    expect(findCycle(doc)).not.toBeNull();
    expect(topologicalOrder(doc)).toBeNull();
  });
});

describe("چیدمان خودکار", () => {
  test("زنجیره خطی: هر گره یک ردیف پایین‌تر", () => {
    const doc = fpcDoc();
    doc.nodes.push(makeNode("fpc", "a", "operation", "A"), makeNode("fpc", "b", "operation", "B"), makeNode("fpc", "c", "operation", "C"));
    doc.edges.push({ id: "e1", from: "a", to: "b" }, { id: "e2", from: "b", to: "c" });
    const layout = autoLayout(doc);
    expect(layout.positions.a.y).toBeLessThan(layout.positions.b.y);
    expect(layout.positions.b.y).toBeLessThan(layout.positions.c.y);
  });

  test("قطعیت: دو فراخوانی → خروجی یکسان", () => {
    const doc = fpcDoc();
    doc.nodes.push(makeNode("fpc", "a", "operation", "A"), makeNode("fpc", "b", "transport", "B"));
    doc.edges.push({ id: "e1", from: "a", to: "b" });
    expect(autoLayout(doc)).toEqual(autoLayout(doc));
  });

  test("سند خالی → positions خالی", () => {
    expect(autoLayout(fpcDoc()).positions).toEqual({});
  });

  test("چرخه → همچنان همه گره‌ها چیده می‌شوند (خروجی کامل)", () => {
    const doc = fpcDoc();
    doc.nodes.push(makeNode("fpc", "a", "operation", "A"), makeNode("fpc", "b", "operation", "B"));
    doc.edges.push({ id: "e1", from: "a", to: "b" }, { id: "e2", from: "b", to: "a" });
    const layout = autoLayout(doc);
    expect(Object.keys(layout.positions)).toHaveLength(2);
  });
});

describe("مقایسه variant (فعلی/پیشنهادی)", () => {
  test("دلتای شمارش/زمان/مسافت + گام‌های افزوده/حذف‌شده", () => {
    const cur = fpcDoc();
    const c1 = makeNode("fpc", "n1", "operation", "برش");
    c1.timeSec = 12;
    const c2 = makeNode("fpc", "n2", "delay", "انتظار");
    c2.timeSec = 60;
    const c3 = makeNode("fpc", "n3", "transport", "حمل");
    c3.timeSec = 20;
    c3.distanceM = 30;
    cur.nodes.push(c1, c2, c3);

    const pro: DiagramDoc = { ...fpcDoc(), variant: "proposed" };
    const p1 = makeNode("fpc", "n1", "operation", "برش");
    p1.timeSec = 10; // بهبود زمان
    const p3 = makeNode("fpc", "n3", "transport", "حمل");
    p3.timeSec = 20;
    p3.distanceM = 12; // کاهش مسافت
    const p4 = makeNode("fpc", "n4", "inspection", "بازرسی جدید");
    p4.timeSec = 6;
    pro.nodes.push(p1, p3, p4);

    const d = diffVariants(cur, pro);
    expect(d.countDelta.delay).toBe(-1); // حذف تأخیر
    expect(d.countDelta.inspection).toBe(1); // افزودن بازرسی
    expect(d.totalTimeDeltaSec).toBe(10 + 20 + 6 - (12 + 60 + 20)); // -56
    expect(d.totalDistanceDeltaM).toBe(12 - 30); // -18
    expect(d.removedSteps.some((s) => s.title === "انتظار")).toBe(true);
    expect(d.addedSteps.some((s) => s.title === "بازرسی جدید")).toBe(true);
    expect(d.changedSteps.some((s) => s.title === "برش" && s.timeBefore === 12 && s.timeAfter === 10)).toBe(true);
  });
});

describe("رندر SVG", () => {
  test("خروجی رشته SVG معتبر شامل marker جهت‌دار و متن فارسی", () => {
    const doc = fpcDoc();
    const n1 = makeNode("fpc", "n1", "operation", "برش ورق");
    n1.timeSec = 12;
    const n2 = makeNode("fpc", "n2", "transport", "حمل به انبار");
    n2.timeSec = 20;
    n2.distanceM = 15;
    doc.nodes.push(n1, n2);
    doc.edges.push({ id: "e1", from: "n1", to: "n2" });
    const svg = renderDiagramSvg(doc, autoLayout(doc), { diagramTitle: "جریان برش" });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.includes('marker-end="url(#arrowhead)"')).toBe(true);
    expect(svg.includes("برش ورق")).toBe(true);
    expect(svg.includes("جریان برش")).toBe(true);
    expect(svg.includes("direction=\"rtl\"")).toBe(true);
    expect(svg).not.toInclude("undefined");
  });

  test("escape XML: عنوان با نویسه خاص خراب نمی‌کند", () => {
    const doc = fpcDoc();
    const n = makeNode("fpc", "n1", "operation", "برش <تست> & \"خطر\"");
    n.timeSec = 5;
    doc.nodes.push(n);
    const svg = renderDiagramSvg(doc, autoLayout(doc));
    expect(svg).not.toInclude("<تست>");
    expect(svg.includes("&lt;تست&gt;")).toBe(true);
  });

  test("قطعیت رندر", () => {
    const doc = fpcDoc();
    doc.nodes.push(makeNode("fpc", "n1", "storage", "انبار"));
    expect(renderDiagramSvg(doc, autoLayout(doc))).toBe(renderDiagramSvg(doc, autoLayout(doc)));
  });

  test("بدون اتریبیوت تکراری در XML (رگرسیون fill تکراری — بارگذاری Image خراب می‌شد)", () => {
    const doc = fpcDoc();
    const n1 = makeNode("fpc", "n1", "operation", "برش");
    n1.timeSec = 5;
    const n2 = makeNode("fpc", "n2", "transport", "حمل");
    n2.timeSec = 6;
    n2.distanceM = 7;
    const n3 = makeNode("fpc", "n3", "delay", "انتظار");
    n3.timeSec = 8;
    const n4 = makeNode("fpc", "n4", "storage", "انبار");
    doc.nodes.push(n1, n2, n3, n4);
    doc.edges.push({ id: "e1", from: "n1", to: "n2" });
    const svg = renderDiagramSvg(doc, autoLayout(doc));
    // هیچ تگ نباید اتریبیوت تکراری داشته باشد
    const tags = svg.match(/<[a-z]+[^>]*>/g) ?? [];
    for (const tag of tags) {
      const attrs = [...tag.matchAll(/\s([a-zA-Z-]+)=/g)].map((m) => m[1]);
      const dupes = attrs.filter((a, i) => attrs.indexOf(a) !== i);
      expect(dupes).toEqual([]);
    }
  });
});

describe("ابزارهای متنی", () => {
  test("wrapText حداکثر دو خط", () => {
    const lines = wrapText("برش ورق فولادی به اندازه مشخص و کنترل کیفیت نهایی", 20, 2);
    expect(lines.length).toBeLessThanOrEqual(2);
  });

  test("formatSeconds", () => {
    expect(formatSeconds(45.5)).toBe("45.5s");
    expect(formatSeconds(90)).toBe("1m 30s");
    expect(formatSeconds(3600)).toBe("1h");
    expect(formatSeconds(Number.NaN)).toBe("—");
  });
});

describe("فهرست بسته نمادها", () => {
  test("OPC و FPC مجموعه‌های بسته مجزا هستند", () => {
    expect(OPC_SYMBOLS).not.toContain("transport");
    expect(FPC_SYMBOLS).toContain("transport");
    expect(FPC_SYMBOLS).not.toContain("componentEntry");
    expect(OPC_SYMBOLS).toContain("componentEntry");
  });
});
