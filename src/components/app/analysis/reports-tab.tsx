"use client";

/**
 * تب گزارش‌ها — قالب‌های شش‌گانه + خروجی CSV/XLS/JSON + چاپ PDF (بند ۷/۸ فاز ۵).
 *  - CSV/XLS/JSON: دانلود فایل واقعی از سرور با ردیابی کامل (نسخه روش/فرمول).
 *  - PDF: نمای چاپ بهینه‌شده (A4/RTL) → window.print → «ذخیره به‌صورت PDF»؛
 *    مسیر بومی مرورگر برای حفظ بی‌نقص فارسی/RTL (B11 چاپ‌پذیری؛ ADR-014).
 */

import { useState } from "react";
import { FileDown, FileJson, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { downloadAnalysisExport } from "@/hooks/use-analysis";
import { useAnalysisPreview } from "@/hooks/use-analysis-reports";
import type { AnalysisDto, ReportDto } from "@/shared/contracts/analysis";
import { REPORT_TEMPLATES, REPORT_TEMPLATE_LABELS_FA, type ReportTemplate } from "@/shared/contracts/analysis";
import { faDigits, fmtSec } from "./analysis-bits";

const TEMPLATE_DESCRIPTIONS_FA: Record<ReportTemplate, string> = {
  "study-summary": "جمع‌بندی جلسات، عناصر، شمارش‌های شفافیت مشاهدات و تنظیمات اثرگذار (روش تجمیع، ارزیابی، مجاز).",
  "raw-observations": "همه مشاهدات ثبت‌شده با عنصر، چرخه، مدت، وضعیت، علامت‌ها و علت حذف.",
  "element-analysis": "آمار توصیفی هر عنصر: n/میانگین/میانه/کمینه/بیشینه/انحراف/CV/زمان نماینده.",
  "sample-quality": "کیفیت نمونه‌گیری: CV، فاصله اطمینان، کفایت حجم نمونه (ST-010) و هشدارها.",
  "standard-time": "زنجیره کامل نرمال/استاندارد هر عنصر با فرمول‌ها، نسخه‌ها و پایه درصد مجاز + جمع چرخه.",
  "formula-outputs": "خروجی ارزیابی فرمول‌های نسخه‌دار به‌ازای هر عنصر — وضعیت/مقدار/واحد/خطا.",
};

export function ReportsTab({ projectId, analysis, canWrite }: { projectId: string; analysis: AnalysisDto | undefined; canWrite: boolean }) {
  const preview = useAnalysisPreview(projectId);
  const [printing, setPrinting] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  if (!analysis) return null;

  const doDownload = async (template: ReportTemplate, format: "csv" | "xls" | "json") => {
    setDownloading(`${template}-${format}`);
    try {
      await downloadAnalysisExport(projectId, template, format);
      toast.success("خروجی تولید شد", {
        description: "فایل با داده واقعی و ردپای نسخه روش/فرمول تولید شد — رکورد ردیابی در تاریخچه پروژه ثبت می‌شود.",
      });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDownloading(null);
    }
  };

  const doPrint = async (template: ReportTemplate) => {
    setPrinting(true);
    try {
      await preview.mutateAsync(template);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPrinting(false);
    }
  };

  const report = preview.data;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-2">
        {REPORT_TEMPLATES.map((tpl) => (
          <Card key={tpl} className="py-0">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <FileText className="size-4 text-primary" aria-hidden /> {REPORT_TEMPLATE_LABELS_FA[tpl]}
                <Badge variant="secondary" className="ms-auto text-[9px]">{tpl}</Badge>
              </CardTitle>
              <p className="text-[11px] leading-6 text-muted-foreground">{TEMPLATE_DESCRIPTIONS_FA[tpl]}</p>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2 p-4 pt-0">
              <Button size="sm" variant="outline" className="gap-1.5" disabled={downloading === `${tpl}-csv`} onClick={() => void doDownload(tpl, "csv")}>
                <FileSpreadsheet className="size-3.5" aria-hidden /> CSV
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" disabled={downloading === `${tpl}-xls`} onClick={() => void doDownload(tpl, "xls")}>
                <FileSpreadsheet className="size-3.5" aria-hidden /> Excel (RTL)
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" disabled={downloading === `${tpl}-json`} onClick={() => void doDownload(tpl, "json")}>
                <FileJson className="size-3.5" aria-hidden /> JSON (ردیابی)
              </Button>
              <Button size="sm" className="gap-1.5" disabled={printing} onClick={() => void doPrint(tpl)}>
                <Printer className="size-3.5" aria-hidden /> PDF / چاپ
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* یادداشت خروجی‌ها */}
      <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-[11px] leading-6 text-muted-foreground">
        <p className="font-semibold text-foreground">درباره خروجی‌ها (صادقانه):</p>
        <p>· CSV با BOM UTF-8 — فارسی در Excel سالم می‌ماند؛ Excel خروجی به‌صورت SpreadsheetML-2003 با جهت راست‌به‌چپ تولید می‌شود و در LibreOffice/Excel باز می‌شود (بدون وابستگی خارجی — ADR-014).</p>
        <p>· PDF از مسیر «چاپ مرورگر» می‌آید (نمای چاپ → ذخیره به PDF) تا فارسی/RTL بی‌نقص بماند؛ خروجی فایل PDF سمت سرور در محدودیت‌ها ثبت شده است.</p>
        <p>· هر دانلود: رکورد ردیابی (نسخه پیکربندی/فرمول/تنظیمات/شمارش ورودی) در تاریخچه پروژه append-only ثبت می‌شود.</p>
        {canWrite ? null : <p>· دانلود برای همه نقش‌های پروژه باز است؛ تغییر تنظیمات/علامت‌ها فقط با مجوز analysis:write.</p>}
      </div>

      {/* دیالوگ پیش‌نمایش چاپ */}
      <Dialog open={!!report} onOpenChange={(open) => !open && preview.reset()}>
        <DialogContent className="max-w-3xl overflow-y-auto">
          <DialogHeader>
            <div className="print:hidden">
              <DialogTitle>{report?.templateLabelFa} — پیش‌نمایش چاپ</DialogTitle>
              <DialogDescription>
                برای PDF: در پنجره چاپ مقصد «Save as PDF» را انتخاب کنید. جهت راست‌به‌چپ و فارسی به‌صورت بومی مرورگر حفظ می‌شود.
              </DialogDescription>
            </div>
          </DialogHeader>

          {report ? (
            <div className="print:bg-white" id="print-area">
              {/* سربرگ گزارش چاپی */}
              <div className="space-y-1 border-b pb-3 text-right">
                <h2 className="text-base font-bold">{report.templateLabelFa}</h2>
                <p className="text-xs text-muted-foreground">
                  {analysis.projectCode} — {analysis.projectTitle} · تاریخ تولید: {new Date(report.trace.generatedAt).toLocaleString("fa-IR")}
                </p>
              </div>

              <ul className="my-3 space-y-1 text-[11px] leading-6 text-muted-foreground">
                {report.summaryFa.map((sline, i) => (
                  <li key={i}>· {sline}</li>
                ))}
              </ul>

              <div className="overflow-x-auto">
                <Table dir="rtl">
                  <TableHeader>
                    <TableRow>
                      {report.columns.map((c) => (
                        <TableHead key={c.key} className="text-right text-[10px]">{c.labelFa}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.rows.slice(0, 200).map((row, i) => (
                      <TableRow key={i}>
                        {report.columns.map((c) => (
                          <TableCell key={c.key} className="py-1 text-[10px]">
                            {row[c.key] === null || row[c.key] === undefined ? "—" : String(row[c.key])}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {report.rows.length > 200 ? (
                <p className="mt-1 text-[10px] text-muted-foreground print:hidden">
                  پیش‌نمایش ۲۰۰ ردیف اول از {faDigits(report.rows.length)} — خروجی CSV/Excel/JSON همه ردیف‌ها را دارد.
                </p>
              ) : null}

              {/* پانوشت ردیابی — بند ۵: هر خروجی مهم قابل ردیابی */}
              <div className="mt-4 border-t pt-2 text-[9px] leading-5 text-muted-foreground">
                <p>
                  ردیابی: نسخه پیکربندی {report.trace.configSemver ?? "—"} · فرمول‌ها{" "}
                  {report.trace.formulaVersions.map((f) => `${f.key}@${f.semver}`).join("، ") || "—"} · {report.trace.inputSummaryFa}
                </p>
                <p>این گزارش از داده واقعی جلسات نهایی‌شده تولید شده است؛ تغییر تنظیمات/علامت‌ها پس از تولید، گزارش را بی‌اعتبار نمی‌کند اما تاریخچه ممیزی اثر را نشان می‌دهد.</p>
              </div>
            </div>
          ) : null}

          <div className="print:hidden">
            <Button className="w-full gap-2" onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden /> چاپ / ذخیره PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
