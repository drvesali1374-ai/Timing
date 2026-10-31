"use client";

/**
 * دیالوگ درون‌ریزی پیکربندی — انتخاب فایل JSON → بررسی پیش از اعمال (dryRun)
 * → نمایش گزارش خطاها یا ✓ اعتبار → اعمال نهایی (نسخه append-only جدید).
 */
import { useRef, useState } from "react";
import { CheckCircle2, FileJson, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { ConfigImportReportDto } from "@/shared/contracts/config";
import { faCount, useImportConfig } from "@/hooks/use-config";
import { Spinner } from "@/components/app/ui-bits";
import { ErrorList } from "./config-bits";

export function ImportDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const importMutation = useImportConfig(projectId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [payload, setPayload] = useState<unknown>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [report, setReport] = useState<ConfigImportReportDto | null>(null);
  const [reason, setReason] = useState("");

  const pickFile = async (file: File | undefined) => {
    setReport(null);
    setParseError(null);
    setPayload(null);
    setFileName(null);
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text) as unknown;
      setPayload(json);
      setFileName(file.name);
    } catch {
      setParseError("فایل JSON معتبر نیست — محتوا قابل تجزیه نیست.");
    }
  };

  const check = () => {
    if (payload === null) return;
    importMutation.mutate(
      { payload, dryRun: true, reason: "" },
      { onSuccess: (r) => setReport(r) },
    );
  };

  const apply = () => {
    if (payload === null || !report?.valid) return;
    importMutation.mutate(
      { payload, dryRun: false, reason: reason.trim() },
      {
        onSuccess: (r) => {
          if (r.valid && r.applied) {
            onOpenChange(false);
            resetState();
          }
        },
      },
    );
  };

  const resetState = () => {
    setReport(null);
    setParseError(null);
    setPayload(null);
    setFileName(null);
    setReason("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const checking = importMutation.isPending && importMutation.variables?.dryRun === true;
  const applying = importMutation.isPending && importMutation.variables?.dryRun === false;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetState();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>درون‌ریزی پیکربندی</DialogTitle>
          <DialogDescription>
            فایل خروجی JSON (قالب <span className="font-mono text-[11px]" dir="ltr">timing-config-snapshot v2</span>) را
            انتخاب کنید؛ ابتدا اعتبارسنجی می‌شود و اعمال فقط با تأیید شما یک نسخه جدید می‌سازد.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-3">
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="import-file">فایل پیکربندی (JSON)</Label>
              <Input
                ref={fileInputRef}
                id="import-file"
                type="file"
                accept="application/json,.json"
                onChange={(e) => pickFile(e.target.files?.[0])}
                aria-describedby="import-file-hint"
              />
              <p id="import-file-hint" className="flex items-center gap-1 text-xs text-muted-foreground">
                <FileJson className="size-3.5" aria-hidden />
                {fileName ?? "خروجی «خروجی JSON» از پروژه‌های همین پلتفرم"}
              </p>
            </div>

            {parseError ? (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
                {parseError}
              </p>
            ) : null}

            <Button variant="outline" size="sm" className="gap-2" onClick={check} disabled={payload === null || checking}>
              {checking ? <Spinner /> : <Upload className="size-4" aria-hidden />} بررسی پیش از اعمال
            </Button>

            {report ? (
              <div className="space-y-3" aria-live="polite">
                <Separator />
                {report.valid ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
                    <p className="flex items-center gap-2 font-medium">
                      <CheckCircle2 className="size-4" aria-hidden /> فایل معتبر است
                    </p>
                    <p className="mt-1 text-xs leading-relaxed">
                      {report.cycleCount > 0
                        ? `${faCount(report.cycleCount)} چرخه وابستگی در فرمول‌ها یافت شد — پیش از اعمال بازبینی کنید.`
                        : "پیکربندی واردشده قوانین snapshot را رعایت می‌کند و اعمال آن نسخه جدیدی می‌سازد."}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/40">
                    <p className="mb-2 text-sm font-medium text-red-800 dark:text-red-300">
                      فایل نامعتبر است — {faCount(report.issues.length)} مورد:
                    </p>
                    <ErrorList errors={report.issues.map((i) => ({ messageFa: `${i.path}: ${i.messageFa}` }))} />
                  </div>
                )}
                {report.valid ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="import-reason">دلیل درون‌ریزی (اختیاری)</Label>
                    <Input
                      id="import-reason"
                      placeholder="خالی = دلیل خودکار (درون‌ریزی از پروژه مبدأ)"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                    <Button className="gap-2" onClick={apply} disabled={applying}>
                      {applying ? <Spinner /> : null} اعمال پیکربندی
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            بستن
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
