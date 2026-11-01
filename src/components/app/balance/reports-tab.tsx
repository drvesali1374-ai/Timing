"use client";

/**
 * تب گزارش‌ها — خروجی CSV/XLS/JSON با ردیابی (بند ۸ · B11 — الگوی فاز ۵).
 */

import { useState } from "react";
import { FileDown, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { EmptyState } from "@/components/app/ui-bits";
import type { BalanceScenarioDetailDto, BalanceReportTemplate, BalanceExportFormat } from "@/shared/contracts/balance";
import { BALANCE_REPORT_TEMPLATE_LABELS_FA } from "@/shared/contracts/balance";
import { downloadBalanceExport } from "@/hooks/use-balance";
import { faDigits } from "./balance-bits";

interface ReportsTabProps {
  projectId: string;
  scenarioId: string | null;
  scenario: BalanceScenarioDetailDto | undefined;
}

export function ReportsTab({ projectId, scenarioId, scenario }: ReportsTabProps) {
  const [template, setTemplate] = useState<BalanceReportTemplate>("balance-summary");
  const [format, setFormat] = useState<BalanceExportFormat>("csv");
  const [busy, setBusy] = useState(false);

  if (!scenarioId || !scenario) {
    return <EmptyState title="سناریویی انتخاب نشده است" description="از تب «سناریوها» انتخاب کنید." />;
  }

  const hasResult = !!scenario.currentResult;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">گزارش‌های بالانس — {scenario.scenario.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasResult ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
              این سناریو نتیجه ذخیره‌شده ندارد — گزارش‌ها بدون داده معنادار خواهند بود. ابتدا از تب «یامازومی» اجرا کنید.
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">قالب گزارش</Label>
              <Select value={template} onValueChange={(v) => setTemplate(v as BalanceReportTemplate)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(BALANCE_REPORT_TEMPLATE_LABELS_FA) as BalanceReportTemplate[]).map((t) => (
                    <SelectItem key={t} value={t}>{BALANCE_REPORT_TEMPLATE_LABELS_FA[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">نوع فایل</Label>
              <RadioGroup value={format} onValueChange={(v) => setFormat(v as BalanceExportFormat)} className="flex gap-4 pt-1.5">
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="csv" id="fmt-csv" />
                  <Label htmlFor="fmt-csv" className="text-xs font-normal">CSV (Excel فارسی)</Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="xls" id="fmt-xls" />
                  <Label htmlFor="fmt-xls" className="text-xs font-normal">XLS (RTL)</Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="json" id="fmt-json" />
                  <Label htmlFor="fmt-json" className="text-xs font-normal">JSON (ردیابی)</Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              className="gap-2"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await downloadBalanceExport(projectId, scenarioId, template, format);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <FileDown className="size-4" aria-hidden /> {busy ? "در حال آماده‌سازی…" : "دانلود گزارش"}
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden /> چاپ / PDF مرورگر
            </Button>
          </div>

          <p className="text-[10px] leading-relaxed text-muted-foreground">
            CSV با BOM (فارسی سالم در Excel) · XLS با راست‌به‌چپ · JSON با ردیابی کامل (سناریو/مسئله/همه نتایج).
            هر دانلود: رکورد CalculationResult + ممیزی ثبت می‌شود — {faDigits(scenario.results.length)} نتیجه در تاریخچه این سناریو موجود است.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
