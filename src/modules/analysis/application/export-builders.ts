/**
 * سازنده‌های خروجی گزارش — CSV/XLS با حفظ فارسی و RTL (بند ۸ فاز ۵ · B11).
 *
 *  - CSV: UTF-8 با BOM (Excel فارسی را درست می‌خواند) + نقل‌قول RFC 4180.
 *  - XLS: SpreadsheetML 2003 (XML) با ss:RightToLeft=1 — بدون وابستگی خارجی؛
 *    در Excel/LibreOffice باز می‌شود و فارسی/RTL سالم می‌ماند.
 *    محدودیت ثبت‌شده: قالب XML-2003 است نه xlsx باینری (ADR-014).
 *  - JSON: در سرویس ساخته می‌شود — ردیابی کامل.
 */

import type { ReportColumn, ReportRow } from "@/shared/contracts/analysis";

/** شکل گزارش برای سازنده‌های خروجی — از دامنه (بدون چرخه فایل).
 * template رشته‌ای آزاد است تا قالب‌های فاز ۶ (بالانس) هم بدون چرخه مصرف شوند. */
export interface ReportExportShape {
  template: string;
  templateLabelFa: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  summaryFa: string[];
  trace: { configSemver: string | null; generatedAt: string; formulaVersions: Array<{ key: string; semver: string }> };
}

/** BOM — Excel بدون آن UTF-8 را windows-1252 می‌خواند و فارسی خراب می‌شود. */
const UTF8_BOM = "\uFEFF";

export function escapeCsv(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function escapeXml(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** CSV با سربرگ فارسی + ردیف‌ها + پانوشت ردیابی (نسخه روش/فرمول/تاریخ تولید). */
export function buildCsvExport(report: ReportExportShape): string {
  const lines: string[] = [];
  // سربرگ گزارش
  lines.push(escapeCsv(`گزارش: ${report.templateLabelFa}`));
  for (const s of report.summaryFa) {
    lines.push(escapeCsv(s));
  }
  lines.push("");
  // سربرگ ستون‌ها
  lines.push(report.columns.map((c) => escapeCsv(c.labelFa)).join(","));
  // ردیف‌ها
  for (const row of report.rows) {
    lines.push(report.columns.map((c) => escapeCsv(row[c.key])).join(","));
  }
  lines.push("");
  lines.push(escapeCsv("— پایان گزارش —"));
  lines.push(
    escapeCsv(
      `ردیابی: قالب ${report.template} · نسخه پیکربندی ${report.trace.configSemver ?? "—"} · فرمول‌ها ${report.trace.formulaVersions.map((f) => `${f.key}@${f.semver}`).join("، ") || "—"} · تولید ${new Date(report.trace.generatedAt).toISOString()}`,
    ),
  );
  return UTF8_BOM + lines.join("\r\n");
}

const XML_DECL = '<?xml version="1.0" encoding="UTF-8"?>\n<?mso-application progid="Excel.Sheet"?>\n';

/** SpreadsheetML 2003 با RTL — باز شدن مستقیم در Excel/LibreOffice. */
export function buildXlsExport(report: ReportExportShape): string {
  const headerRows: string[][] = [];
  headerRows.push([`گزارش: ${report.templateLabelFa}`]);
  for (const s of report.summaryFa) {
    headerRows.push([s]);
  }
  headerRows.push([]);
  headerRows.push(report.columns.map((c) => c.labelFa));

  const dataRows: string[][] = report.rows.map((row) => report.columns.map((c) => (row[c.key] === null || row[c.key] === undefined ? "" : String(row[c.key]))));

  const footerRows: string[][] = [[], ["— پایان گزارش —"], [
    `ردیابی: قالب ${report.template} · نسخه پیکربندی ${report.trace.configSemver ?? "—"} · فرمول‌ها ${report.trace.formulaVersions.map((f) => `${f.key}@${f.semver}`).join("، ") || "—"} · تولید ${new Date(report.trace.generatedAt).toISOString()}`,
  ]];

  const allRows = [...headerRows, ...dataRows, ...footerRows];

  const rowsXml = allRows
    .map((cells) => {
      const cellsXml = cells
        .map((c) => `<Cell><Data ss:Type="String">${escapeXml(c)}</Data></Cell>`)
        .join("");
      return `<Row>${cellsXml}</Row>`;
    })
    .join("\n");

  return (
    XML_DECL +
    `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="hdr">
   <Font ss:Bold="1"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${escapeXml(report.templateLabelFa.slice(0, 30))}">
  <Table ss:RightToLeft="1">
${rowsXml}
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <DisplayRightToLeft/>
  </WorksheetOptions>
 </Worksheet>
</Workbook>
`);
}
