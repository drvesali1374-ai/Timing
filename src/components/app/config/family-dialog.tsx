"use client";

/**
 * دیالوگ ایجاد/ویرایش خانواده پارامتر — عملیات addFamily/updateFamily با دلیل خودکار.
 * والد این دیالوگ را فقط هنگام باز‌بودن رندر می‌کند (الگوی mount-fresh).
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ConfigFamilyDto } from "@/shared/contracts/config";
import { useApplyConfigOps } from "@/hooks/use-config";
import { Spinner } from "@/components/app/ui-bits";

const STABLE_KEY_RE = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)*$/;

export function FamilyDialog({
  projectId,
  family,
  open,
  onOpenChange,
}: {
  projectId: string;
  family?: ConfigFamilyDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const apply = useApplyConfigOps(projectId);
  const [stableKey, setStableKey] = useState("");
  const [nameFa, setNameFa] = useState("");
  const [description, setDescription] = useState("");
  const [reason, setReason] = useState("");

  const isEdit = !!family;
  const keyValid = isEdit || STABLE_KEY_RE.test(stableKey);
  const nameValid = nameFa.trim().length > 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyValid || !nameValid) return;
    const trimmedName = nameFa.trim();
    const autoReason = isEdit ? `ویرایش خانواده «${trimmedName}»` : `افزودن خانواده «${trimmedName}»`;
    const finalReason = reason.trim() || autoReason;
    const operation = isEdit
      ? {
          op: "updateFamily",
          familyKey: family.stableKey,
          patch: { nameFa: trimmedName, description: description.trim() },
        }
      : {
          op: "addFamily",
          family: {
            stableKey: stableKey.trim(),
            nameFa: trimmedName,
            ...(description.trim() ? { description: description.trim() } : {}),
            parameters: [],
          },
        };
    apply.mutate(
      { reason: finalReason, operations: [operation] },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? `ویرایش خانواده «${family.nameFa}»` : "خانواده پارامتر جدید"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "شناسه فنی خانواده تغییر نمی‌کند (ناوردایی). تغییرات به‌صورت نسخه جدید ثبت می‌شود."
              : "گروهی از پارامترهای مرتبط (مثل تنور، شیفت، نرخ خرابی) — شناسه فنی بعداً تغییر نمی‌کند."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="family-key">شناسه فنی (stableKey) *</Label>
            <Input
              id="family-key"
              dir="ltr"
              className="font-mono"
              placeholder="oven"
              value={isEdit ? family.stableKey : stableKey}
              onChange={(e) => setStableKey(e.target.value)}
              disabled={isEdit}
              required={!isEdit}
              aria-invalid={!keyValid}
              aria-describedby="family-key-hint"
            />
            {!keyValid ? (
              <p className="text-xs text-red-600 dark:text-red-400" id="family-key-hint">
                الگو نادرست است — با حرف کوچک لاتین شروع شود و بخش‌ها با نقطه جدا شوند.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground" id="family-key-hint">
                مثل oven.settings — با حرف کوچک شروع شود
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="family-name">نام فارسی *</Label>
            <Input
              id="family-name"
              placeholder="مثال: مشخصات تنور"
              value={nameFa}
              onChange={(e) => setNameFa(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="family-desc">توضیح</Label>
            <Textarea
              id="family-desc"
              rows={2}
              placeholder="توضیح کوتاه نقش این خانواده در مطالعه"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="family-reason">دلیل تغییر (اختیاری)</Label>
            <Input
              id="family-reason"
              placeholder={`خالی = دلیل خودکار (${isEdit ? "ویرایش" : "افزودن"} خانواده)`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              انصراف
            </Button>
            <Button type="submit" disabled={apply.isPending || !keyValid || !nameValid}>
              {apply.isPending && <Spinner />} {isEdit ? "ذخیره تغییرات" : "ایجاد خانواده"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
