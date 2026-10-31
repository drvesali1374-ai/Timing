"use client";

/**
 * دیالوگ ایجاد/ویرایش فعالیت/عنصر کاری (مدل B5) — نوع کار از activityModel
 * پیکربندی خوانده می‌شود؛ طبقه‌بندی ارزش فقط با انتخاب صریح کاربر ثبت می‌شود.
 */
import { useState } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ActivityDto, ConfigWorkType } from "@/shared/contracts/config";
import { WORK_TYPE_LABELS_FA_UI } from "@/shared/contracts/config";
import { useCreateActivity, useUpdateActivity } from "@/hooks/use-config";
import { Spinner } from "@/components/app/ui-bits";

const ACTIVITY_KEY_RE = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*$/;
const NO_VALUE = "__none__";

const VA_ITEMS: Array<{ value: string; label: string }> = [
  { value: "valueAdded", label: "ارزش‌افزا" },
  { value: "nonValueAdded", label: "غیرارزش‌افزا" },
  { value: "essentialNonVA", label: "غیرارزش‌افزای ضروری" },
];

const SOURCE_OF_TIME_ITEMS: Array<{ value: string; label: string }> = [
  { value: "measured", label: "اندازه‌گیری‌شده (کرنومتر)" },
  { value: "estimated", label: "برآوردی" },
  { value: "referenced", label: "ارجاعی (استاندارد مرجع)" },
];

export function ActivityDialog({
  projectId,
  activity,
  workTypes,
  open,
  onOpenChange,
}: {
  projectId: string;
  activity?: ActivityDto;
  workTypes: ConfigWorkType[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateActivity(projectId);
  const update = useUpdateActivity(projectId);
  const isEdit = !!activity;
  const pending = create.isPending || update.isPending;

  const [stableKey, setStableKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [workType, setWorkType] = useState<string>(workTypes[0] ?? "operatorManual");
  const [vaClassification, setVaClassification] = useState<string>(NO_VALUE);
  const [sourceOfTime, setSourceOfTime] = useState<string>("measured");

  const keyValid = isEdit || ACTIVITY_KEY_RE.test(stableKey);
  const nameValid = name.trim().length > 0;
  const canSubmit = keyValid && nameValid && !!workType;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const va = vaClassification === NO_VALUE ? null : vaClassification;
    if (isEdit) {
      update.mutate(
        {
          activityId: activity.id,
          name: name.trim(),
          description: description.trim() || null,
          workType,
          vaClassification: va,
          sourceOfTime,
        },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      create.mutate(
        {
          stableKey: stableKey.trim(),
          name: name.trim(),
          ...(description.trim() ? { description: description.trim() } : {}),
          workType,
          vaClassification: va,
          sourceOfTime,
        },
        { onSuccess: () => onOpenChange(false) },
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? `ویرایش فعالیت «${activity.name}»` : "فعالیت / عنصر کاری جدید"}</DialogTitle>
          <DialogDescription>
            فعالیت‌ها واحدهای سنجش کار هستند و توسط نمودار فرایندی (فاز ۳) و کرنومتر (فاز ۴) مصرف می‌شوند.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="activity-key">شناسه فنی (stableKey) *</Label>
            <Input
              id="activity-key"
              dir="ltr"
              className="font-mono"
              placeholder="el.install-door"
              value={isEdit ? activity.stableKey : stableKey}
              onChange={(e) => setStableKey(e.target.value)}
              disabled={isEdit}
              required={!isEdit}
              aria-invalid={!keyValid}
            />
            {!keyValid ? (
              <p className="text-xs text-red-600 dark:text-red-400">
                حروف کوچک لاتین با خط تیره/نقطه (مثل el.install-door)
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">مثل el.install-door — ناورداست</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="activity-name">نام فعالیت *</Label>
            <Input
              id="activity-name"
              placeholder="مثال: نصب درب پنل"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>نوع کار *</Label>
            <Select value={workType} onValueChange={setWorkType}>
              <SelectTrigger aria-label="نوع کار">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {workTypes.map((wt) => (
                  <SelectItem key={wt} value={wt}>
                    {WORK_TYPE_LABELS_FA_UI[wt] ?? wt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>طبقه‌بندی ارزش</Label>
            <Select value={vaClassification} onValueChange={setVaClassification}>
              <SelectTrigger aria-label="طبقه‌بندی ارزش">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_VALUE}>— بدون طبقه‌بندی —</SelectItem>
                {VA_ITEMS.map((it) => (
                  <SelectItem key={it.value} value={it.value}>
                    {it.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="flex items-start gap-1 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3 shrink-0" aria-hidden /> فقط با تأیید کاربر ثبت شود (تحلیل VA/NVA در فاز ۵)
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>منبع زمان</Label>
            <Select value={sourceOfTime} onValueChange={setSourceOfTime}>
              <SelectTrigger aria-label="منبع زمان">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_OF_TIME_ITEMS.map((it) => (
                  <SelectItem key={it.value} value={it.value}>
                    {it.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="activity-desc">توضیحات</Label>
            <Textarea
              id="activity-desc"
              rows={2}
              placeholder="شرح کوتاه مرز شروع/پایان فعالیت"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              انصراف
            </Button>
            <Button type="submit" disabled={pending || !canSubmit}>
              {pending && <Spinner />} {isEdit ? "ذخیره تغییرات" : "ایجاد فعالیت"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
