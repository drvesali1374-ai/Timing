/**
 * رندر SVG مستقل — خالص و قطعی (بند ۶: خروجی با کیفیت برای چاپ و ارائه).
 * جریان عمودی بالا→پایین؛ پیکان همیشه در مقصد (جهت معنایی مستقل از RTL — B6/B13).
 * متن فارسی با direction=rtl و text-anchor متناسب؛ بدون وابستگی به DOM (قابل آزمون).
 */

import {
  FPC_SUBJECT_LABELS_FA,
  symbolLabelFa,
  type DiagramDoc,
  type DiagramLayout,
  type DiagramSymbol,
} from "./types";
import { summarizeDiagram } from "./validation";

export interface SvgRenderOptions {
  diagramTitle?: string;
  projectTitle?: string;
  includeSummary?: boolean;
  includeLegend?: boolean;
}

const NODE_W = 190;
const NODE_H = 104;
const SYMBOL_R = 22;
const FONT = "Vazirmatn, 'Segoe UI', Tahoma, sans-serif";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** شکستن متن به خطوط با حداکثر نویسه — پایدار و قطعی */
export function wrapText(text: string, maxChars = 18, maxLines = 2): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    if (current.length === 0) {
      current = w;
    } else if ((current + " " + w).length <= maxChars) {
      current += " " + w;
    } else {
      lines.push(current);
      current = w;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && current) lines.push(current);
  if (lines.length === maxLines && current && lines[maxLines - 1] !== current) {
    // کوتاه‌سازی آخرین خط
    lines[maxLines - 1] = lines[maxLines - 1].slice(0, maxChars - 1) + "…";
  }
  return lines.slice(0, maxLines);
}

/** رنگ نماد — پالت خنثی/زمینه‌ای (بدون آبی/نیلی) */
function symbolColor(symbol: DiagramSymbol): string {
  switch (symbol) {
    case "operation":
      return "#0f766e";
    case "inspection":
      return "#b45309";
    case "transport":
      return "#9a3412";
    case "delay":
      return "#a16207";
    case "storage":
      return "#57534e";
    case "componentEntry":
      return "#15803d";
    case "assemblyPoint":
      return "#52525b";
    default:
      return "#44403c";
  }
}

/** شکل نماد بر اساس سنت ASME/Grimshaw (واژه‌نامه: docs/DIAGRAM_GUIDE_FA.md) */
function symbolShape(symbol: DiagramSymbol, cx: number, cy: number): string {
  const c = symbolColor(symbol);
  // فقط stroke — fill در هر case یک‌بار صریح می‌آید (اتریبیوت تکراری XML نامعتبر می‌کند)
  const stroke = `stroke="${c}" stroke-width="2"`;
  switch (symbol) {
    case "operation":
      return `<circle cx="${cx}" cy="${cy}" r="${SYMBOL_R}" ${stroke} fill="#f0fdfa" />`;
    case "inspection":
      return `<rect x="${cx - SYMBOL_R}" y="${cy - SYMBOL_R}" width="${SYMBOL_R * 2}" height="${SYMBOL_R * 2}" ${stroke} fill="#fffbeb" />`;
    case "transport": {
      // پیکان حمل (شیب‌دار کلاسیک)
      const x1 = cx - SYMBOL_R;
      const x2 = cx + SYMBOL_R;
      return `<path d="M ${x1} ${cy - 14} L ${x1} ${cy + 14} L ${x2} ${cy + 8} L ${x2} ${cy + 16} M ${x2} ${cy + 16} l -9 -8 l 9 -3" ${stroke} fill="none" stroke-linejoin="round" />`;
    }
    case "delay":
      return `<path d="M ${cx - SYMBOL_R} ${cy - SYMBOL_R} h ${SYMBOL_R * 1.2} a ${SYMBOL_R} ${SYMBOL_R} 0 0 1 0 ${SYMBOL_R * 2} h ${-SYMBOL_R * 1.2} z" ${stroke} fill="#fefce8" /><text x="${cx - 4}" y="${cy + 7}" text-anchor="middle" font-family="${FONT}" font-size="18" font-weight="700" fill="${c}">D</text>`;
    case "storage":
      return `<path d="M ${cx - SYMBOL_R} ${cy - SYMBOL_R + 4} L ${cx + SYMBOL_R} ${cy - SYMBOL_R + 4} L ${cx} ${cy + SYMBOL_R - 2} Z" ${stroke} fill="#f5f5f4" stroke-linejoin="round" />`;
    case "componentEntry":
      return `<path d="M ${cx - SYMBOL_R - 4} ${cy - SYMBOL_R + 6} L ${cx + SYMBOL_R + 4} ${cy - SYMBOL_R} L ${cx + SYMBOL_R + 4} ${cy + SYMBOL_R} L ${cx - SYMBOL_R - 4} ${cy + SYMBOL_R - 6} Z" ${stroke} fill="#f0fdf4" stroke-linejoin="round" />`;
    case "assemblyPoint":
      return `<path d="M ${cx - SYMBOL_R} ${cy - SYMBOL_R + 2} L ${cx + SYMBOL_R} ${cy - SYMBOL_R + 2} L ${cx} ${cy + SYMBOL_R} Z" ${stroke} fill="#fafaf9" stroke-linejoin="round" />`;
    default:
      return `<circle cx="${cx}" cy="${cy}" r="${SYMBOL_R}" ${stroke} fill="none" />`;
  }
}

function nodeMetaLine(doc: DiagramDoc, node: DiagramDoc["nodes"][number]): string {
  const parts: string[] = [];
  if (node.timeSec !== undefined && node.timeSec !== null) parts.push(`${formatSeconds(node.timeSec)}`);
  if (doc.kind === "fpc" && node.distanceM !== undefined && node.distanceM !== null) {
    parts.push(`${node.distanceM} ${doc.distanceUnit ?? "m"}`);
  }
  if (doc.kind === "opc" && node.quantity !== undefined && node.quantity !== null) parts.push(`×${node.quantity}`);
  return parts.join(" · ");
}

/** قالب‌بندی ثانیه به خوانا — قطعی */
export function formatSeconds(sec: number): string {
  if (!Number.isFinite(sec)) return "—";
  if (sec >= 3600) {
    const h = Math.floor(sec / 3600);
    const m = Math.round(((sec % 3600) / 60) * 10) / 10;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  }
  if (sec >= 60) {
    const m = Math.floor(sec / 60);
    const s = Math.round((sec % 60) * 10) / 10;
    return s > 0 ? `${m}m ${s}s` : `${m}min`;
  }
  return `${Math.round(sec * 100) / 100}s`;
}

/**
 * رندر سند نمودار به SVG مستقل — رشته خروجی قابل ذخیره/چاپ/تبدیل PNG.
 */
export function renderDiagramSvg(doc: DiagramDoc, layout: DiagramLayout, opts: SvgRenderOptions = {}): string {
  const includeSummary = opts.includeSummary !== false;
  const includeLegend = opts.includeLegend !== false;

  const positions = layout.positions;
  const xs = Object.values(positions).map((p) => p.x);
  const ys = Object.values(positions).map((p) => p.y);
  const minX = xs.length ? Math.min(...xs) - NODE_W / 2 : 0;
  const minY = ys.length ? Math.min(...ys) - NODE_H / 2 : 0;
  const maxX = xs.length ? Math.max(...xs) + NODE_W / 2 : 600;
  const maxY = ys.length ? Math.max(...ys) + NODE_H / 2 : 400;

  const headerH = 96;
  const legendH = includeLegend ? 64 : 0;
  const width = Math.max(maxX - minX, 720);
  const height = maxY - minY + headerH + legendH + 40;
  const offX = -minX + 20;
  const offY = -minY + headerH;

  // ── یال‌ها (زیر گره‌ها) ──
  const edgesSvg: string[] = [];
  for (const edge of doc.edges) {
    const from = positions[edge.from];
    const to = positions[edge.to];
    if (!from || !to) continue;
    const sx = from.x + offX;
    const sy = from.y + offY + NODE_H / 2 - 8;
    const tx = to.x + offX;
    const ty = to.y + offY - NODE_H / 2 + 8;
    const midY = (sy + ty) / 2;
    const points = sx === tx ? `${sx},${sy} ${tx},${ty}` : `${sx},${sy} ${sx},${midY} ${tx},${midY} ${tx},${ty}`;
    edgesSvg.push(
      `<polyline points="${points}" fill="none" stroke="#78716c" stroke-width="1.8" marker-end="url(#arrowhead)" />`,
    );
    if (edge.label?.trim()) {
      edgesSvg.push(
        `<text x="${(sx + tx) / 2}" y="${midY - 6}" text-anchor="middle" direction="rtl" font-family="${FONT}" font-size="11" fill="#57534e">${esc(edge.label)}</text>`,
      );
    }
  }

  // ── گره‌ها ──
  const nodesSvg: string[] = [];
  for (const node of doc.nodes) {
    const pos = positions[node.id];
    if (!pos) continue;
    const cx = pos.x + offX;
    const top = pos.y + offY - NODE_H / 2;
    const symbolCy = top + 30;
    const titleLines = wrapText(node.title || "—", 20, 2);
    const meta = nodeMetaLine(doc, node);
    const c = symbolColor(node.symbol);

    const g: string[] = [];
    // کارت زمینه
    g.push(`<rect x="${cx - NODE_W / 2}" y="${top}" width="${NODE_W}" height="${NODE_H}" rx="10" fill="#ffffff" stroke="#e7e5e4" />`);
    // شماره گام
    if (node.stepNo !== null && node.stepNo !== undefined) {
      g.push(`<circle cx="${cx - NODE_W / 2 + 16}" cy="${top + 16}" r="11" fill="${c}" />`);
      g.push(`<text x="${cx - NODE_W / 2 + 16}" y="${top + 20}" text-anchor="middle" font-family="${FONT}" font-size="11" font-weight="700" fill="#ffffff">${node.stepNo}</text>`);
    }
    // نماد
    g.push(symbolShape(node.symbol, cx, symbolCy));
    // عنوان
    titleLines.forEach((line, i) => {
      g.push(
        `<text x="${cx}" y="${top + 68 + i * 15}" text-anchor="middle" direction="rtl" font-family="${FONT}" font-size="12.5" font-weight="600" fill="#1c1917">${esc(line)}</text>`,
      );
    });
    // متا (زمان/مسافت/کمیت)
    if (meta) {
      g.push(
        `<text x="${cx}" y="${top + 68 + titleLines.length * 15 + 2}" text-anchor="middle" direction="rtl" font-family="${FONT}" font-size="10.5" fill="#78716c">${esc(meta)}</text>`,
      );
    }
    // نشان ارجاع فعالیت
    if (node.activityStableKey) {
      g.push(`<title>${esc(`مرتبط با فعالیت: ${node.activityStableKey}`)}</title>`);
      g.push(`<circle cx="${cx + NODE_W / 2 - 14}" cy="${top + 14}" r="5" fill="#0d9488" opacity="0.85" />`);
    }
    nodesSvg.push(`<g>${g.join("")}</g>`);
  }

  // ── سربرگ ──
  const header: string[] = [];
  const kindLabel = doc.kind === "opc" ? "نمودار عملیات فرایند (OPC)" : "نمودار جریان فرایند (FPC)";
  const variantLabel = doc.variant === "current" ? "روش موجود" : "روش پیشنهادی";
  const title = opts.diagramTitle ?? kindLabel;
  header.push(`<text x="${width - 20}" y="34" text-anchor="end" direction="rtl" font-family="${FONT}" font-size="17" font-weight="700" fill="#1c1917">${esc(title)}</text>`);
  let sub = `${kindLabel} · ${variantLabel}`;
  if (doc.kind === "fpc" && doc.subject) sub += ` · موضوع: ${FPC_SUBJECT_LABELS_FA[doc.subject]}`;
  if (opts.projectTitle) sub += ` · پروژه: ${opts.projectTitle}`;
  header.push(`<text x="${width - 20}" y="54" text-anchor="end" direction="rtl" font-family="${FONT}" font-size="11.5" fill="#57534e">${esc(sub)}</text>`);

  // ── جدول خلاصه ──
  if (includeSummary) {
    const summary = summarizeDiagram(doc);
    const symbols = [...new Set(doc.nodes.map((n) => n.symbol))];
    const cells: string[] = [];
    let x = width - 20;
    const cellW = 86;
    for (const s of symbols) {
      cells.push(
        `<text x="${x}" y="78" text-anchor="end" direction="rtl" font-family="${FONT}" font-size="10.5" fill="#44403c">${esc(`${symbolLabelFa(doc.kind, s)}: ${summary.counts[s] ?? 0}`)}</text>`,
      );
      x -= cellW;
    }
    cells.push(
      `<text x="${x}" y="78" text-anchor="end" direction="rtl" font-family="${FONT}" font-size="10.5" fill="#0f766e" font-weight="600">${esc(`مجموع زمان: ${formatSeconds(summary.totalTimeSec)}`)}</text>`,
    );
    x -= cellW;
    if (doc.kind === "fpc") {
      cells.push(
        `<text x="${x}" y="78" text-anchor="end" direction="rtl" font-family="${FONT}" font-size="10.5" fill="#9a3412" font-weight="600">${esc(`مسافت: ${summary.totalDistanceM} ${doc.distanceUnit ?? "m"}`)}</text>`,
      );
    }
    header.push(...cells);
  }

  // ── راهنمای نمادها ──
  const legend: string[] = [];
  if (includeLegend && doc.nodes.length > 0) {
    const symbols = [...new Set(doc.nodes.map((n) => n.symbol))];
    const ly = height - 28;
    let lx = width - 20;
    for (const s of symbols) {
      const label = symbolLabelFa(doc.kind, s);
      const approxW = 26 + label.length * 7;
      legend.push(symbolShape(s, lx - 12, ly));
      legend.push(
        `<text x="${lx - 30}" y="${ly + 4}" text-anchor="end" direction="rtl" font-family="${FONT}" font-size="10.5" fill="#44403c">${esc(label)}</text>`,
      );
      lx -= approxW;
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONT}">`,
    `<defs>`,
    `<marker id="arrowhead" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto-start-reverse">`,
    `<path d="M0,0 L10,4 L0,8 z" fill="#78716c" />`,
    `</marker>`,
    `</defs>`,
    `<rect width="${width}" height="${height}" fill="#fafaf9" />`,
    ...header,
    ...edgesSvg,
    ...nodesSvg,
    ...legend,
    `</svg>`,
  ].join("\n");
}
