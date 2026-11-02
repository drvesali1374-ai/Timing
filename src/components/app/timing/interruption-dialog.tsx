"use client";

/**
 * دیالوگ ثبت/ویرایش وقفه — مستقل از کرنومتر (دستورالعمل ۵٫۵).
 * علت از فهرست متداول صنعتی؛ «سایر» → فیلد متنی الزامی؛
 * مدت دستی با قالب آزاد (۱۲٫۵ / 00:12.5) یا «نامشخص» بدون عدد ساختگی.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/app/ui-bits";
import { FieldHelp } from "@/components/app/field-help";
import { parseDurationMs } from "@/shared/timing/parse-duration";
import { INTERRUPTION_REASONS, INTERRUPTION_REASON_LABELS_FA } from "@/shared/contracts/manual-study";
import type { ManualInterruptionDto, ManualSheetRowDto } from "@/shared/contracts/manual-study";

const NO_ACTIVITY = "__none__";

export interface InterruptionFormValue {
  activityId: string | null;
  reason: string;
  reasonOther: string;
  durationKnown: boolean;
  durationValue: string;
  note: string;
}

export function InterruptionDialog({
  open,
  onOpenChange,
  rows,
  editing,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: ManualSheetRowDto[];
  editing?: ManualInterruptionDto | null;
  pending: boolean;
  onSubmit: (value: InterruptionFormValue) => void;
}) {
  const [value, setValue] = useState<InterruptionFormValue>(() => ({
    activityId: editing?.activityId ?? null,
    reason: editing?.reason ?? "fixture-failure",
    reasonOther: editing?.reasonOther ?? "",
    durationKnown: editing ? editing.durationKnown : true,
    durationValue: editing?.durationMs != null ? String(editing.durationMs / 1000) : "",
    note: editing?.note ?? "",
  }));

  // فرم تازه با الگوی mount-fresh: والد این دیالوگ را فقط هنگام باز‌بودن رندر می‌کند
  // (دستورالعمل ۳٫۱ بند ۷) — مقداردهی اولیه lazy از prop کافی است.

  const isOther = value.reason === "other";
  const otherValid = !isOther || value.reasonOther.trim().length > 0;
  const durationParse = !value.durationKnown || value.durationValue.trim() === "" ? { ok: true as const, ms: 0 } : parseDurationMs(value.durationValue);
  const durationValid = durationParse.ok;
  const canSubmit = otherValid && durationValid;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      ...value,
      reasonOther: isOther ? value.reasonOther.trim() : "",
      durationValue: value.durationKnown ? value.durationValue.trim() : "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "ویرایش وقفه" : "ثبت وقفه"}</DialogTitle>
          <DialogDescription>
            وقفه‌هایی که هنگام اندازه‌گیری رخ داده‌اند — علت و مدت هر وقفه دستی ثبت می‌شود.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5">
              <Label>علت وقفه *</Label>
              <FieldHelp
                label="علت وقفه"
                content={{
                  meaning: "چرایی توقف کار هنگام اندازه‌گیری این نمونه.",
                  input: "علت متداول را از فهرست انتخاب کنید؛ اگر در فهرست نیست «سایر» را انتخاب و علت را خودتان بنویسید.",
                  example: "قطعه در دسترس نبود → «کمبود قطعه»؛ گفت‌وگو با سرپرست → «گفت‌وگوی اپراتور».",
                  usage: "در گزارش تحلیل وقفه‌ها و شناسایی زمینه‌های بهبود خط استفاده می‌شود.",
                  required: true,
                }}
              />
            </span>
            <Select value={value.reason} onValueChange={(v) => setValue((s) => ({ ...s, reason: v }))}>
              <SelectTrigger aria-label="علت وقفه">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERRUPTION_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {INTERRUPTION_REASON_LABELS_FA[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isOther ? (
            <div className="space-y-1.5">
              <Label htmlFor="int-other">علت دیگر (الزامی) *</Label>
              <Input
                id="int-other"
                placeholder="مثال: انتظار برای تأیید سرپرست"
                value={value.reasonOther}
                onChange={(e) => setValue((s) => ({ ...s, reasonOther: e.target.value }))}
                required
                aria-invalid={!otherValid}
              />
              {!otherValid ? <p className="text-xs text-red-600 dark:text-red-400">با انتخاب «سایر»، نوشتن علت الزامی است.</p> : null}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="int-duration">مدت وقفه</Label>
            <div className="flex items-center gap-2">
              <Input
                id="int-duration"
                dir="ltr"
                className="flex-1 font-mono"
                placeholder="مثال: 45 یا 00:45"
                disabled={!value.durationKnown}
                value={value.durationValue}
                onChange={(e) => setValue((s) => ({ ...s, durationValue: e.target.value }))}
                aria-invalid={!durationValid}
              />
              <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                <Checkbox
                  checked={!value.durationKnown}
                  onCheckedChange={(c) => setValue((s) => ({ ...s, durationKnown: !c }))}
                  aria-label="مدت نامشخص"
                />
                مدت نامشخص است
              </label>
            </div>
            {value.durationKnown ? (
              !durationValid ? (
                <p className="text-xs text-red-600 dark:text-red-400">{(durationParse as { messageFa: string }).messageFa}</p>
              ) : (
                <p className="text-xs text-muted-foreground">ثانیه (مثل 45) یا قالب دقیقه:ثانیه (مثل 02:30) — فارسی/لاتین پذیرفته می‌شود.</p>
              )
            ) : (
              <p className="text-xs text-muted-foreground">مدت نامشخص ثبت می‌شود — هیچ عدد تقریبی ساخته نمی‌شود.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>فعالیت مرتبط</Label>
            <Select
              value={value.activityId ?? NO_ACTIVITY}
              onValueChange={(v) => setValue((s) => ({ ...s, activityId: v === NO_ACTIVITY ? null : v }))}
            >
              <SelectTrigger aria-label="فعالیت مرتبط">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_ACTIVITY}>— بدون فعالیت مشخص —</SelectItem>
                {rows.map((r) => (
                  <SelectItem key={r.activityId} value={r.activityId}>
                    {r.activityName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">در صورت مربوط‌بودن وقفه به فعالیت مشخص، انتخاب آن گزارش‌ها را دقیق‌تر می‌کند.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="int-note">توضیحات</Label>
            <Textarea
              id="int-note"
              rows={2}
              placeholder="شرح تکمیلی وقفه (اختیاری)"
              value={value.note}
              onChange={(e) => setValue((s) => ({ ...s, note: e.target.value }))}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              انصراف
            </Button>
            <Button type="submit" disabled={pending || !canSubmit}>
              {pending && <Spinner />} {editing ? "ذخیره تغییرات" : "ثبت وقفه"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
