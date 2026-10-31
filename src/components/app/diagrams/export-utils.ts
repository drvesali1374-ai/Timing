"use client";

/**
 * خروجی‌های نمودار — SVG/PNG/چاپ (بند ۶: خروجی با کیفیت برای چاپ و ارائه).
 * رندر با همان تابع خالص renderDiagramSvg (قطعی؛ ویرایشگر و خروجی یکسان).
 */

import { renderDiagramSvg } from "@/shared/diagrams/svg";
import type { DiagramDoc, DiagramLayout } from "@/shared/diagrams/types";

export interface ExportOptions {
  diagramTitle?: string;
  projectTitle?: string;
}

function buildSvg(doc: DiagramDoc, layout: DiagramLayout, opts: ExportOptions): string {
  return renderDiagramSvg(doc, layout, {
    diagramTitle: opts.diagramTitle,
    projectTitle: opts.projectTitle,
    includeSummary: true,
    includeLegend: true,
  });
}

/** دانلود SVG مستقل */
export function downloadSvg(doc: DiagramDoc, layout: DiagramLayout, fileName: string, opts: ExportOptions = {}): void {
  const svg = buildSvg(doc, layout, opts);
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName}.svg`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** دانلود PNG (رندر SVG روی canvas — وابسته به فونت سیستم برای فارسی) */
export async function downloadPng(doc: DiagramDoc, layout: DiagramLayout, fileName: string, opts: ExportOptions = {}): Promise<void> {
  const svg = buildSvg(doc, layout, opts);
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "sync";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("رندر تصویر از SVG ناموفق بود."));
      img.src = url;
    });
    const scale = 2; // کیفیت چاپ
    const canvas = document.createElement("canvas");
    canvas.width = (img.width || 900) * scale;
    canvas.height = (img.height || 650) * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas در دسترس نیست.");
    ctx.fillStyle = "#fafaf9";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    // تبدیل به Blob — دانلود با dataURL در برخی مرورگرها/حالت‌های headless مسدود است
    const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!pngBlob) throw new Error("تبدیل PNG ناموفق بود.");
    const pngUrl = URL.createObjectURL(pngBlob);
    const a = document.createElement("a");
    a.href = pngUrl;
    a.download = `${fileName}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(pngUrl), 8000);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
}

/** چاپ نمودار — پنجره چاپ با SVG جاسازی‌شده (RTL حفظ می‌شود) */
export function printDiagram(doc: DiagramDoc, layout: DiagramLayout, opts: ExportOptions = {}): void {
  const svg = buildSvg(doc, layout, opts);
  const win = window.open("", "_blank", "width=1000,height=700");
  if (!win) {
    window.print();
    return;
  }
  win.document.write(`<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(opts.diagramTitle ?? "نمودار فرایند")}</title>
<style>
  @page { margin: 12mm; }
  body { margin: 0; background: #fff; font-family: Vazirmatn, 'Segoe UI', Tahoma, sans-serif; }
  .svg-wrap { width: 100%; }
  .svg-wrap svg { max-width: 100%; height: auto; }
  .print-note { font-size: 11px; color: #57534e; margin: 8px 4px; }
  @media print { .print-note { display: none; } }
</style>
</head>
<body>
<div class="svg-wrap">${svg}</div>
<p class="print-note">نسخه چاپی تولیدشده از «زمان‌سنجی صنعتی» — تاریخ: ${new Date().toLocaleDateString("fa-IR")}</p>
<script>window.onload = () => setTimeout(() => window.print(), 350);</script>
</body>
</html>`);
  win.document.close();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
