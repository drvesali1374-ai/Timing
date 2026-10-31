"use client";

/**
 * دیالوگ ایجاد نمودار — نوع (OPC/FPC)، variant، عنوان، موضوع مطالعه (FPC)، مرجع مقایسه.
 */

import { useState } from "react";
import { Network, Workflow } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/app/ui-bits";
import { useCreateDiagram } from "@/hooks/use-diagrams";
import { FPC_SUBJECT_OPTIONS_FA } from "@/shared/contracts/diagrams";

export interface NewDiagramDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (diagramId: string) => void;
  /** برای variant=proposed: نمودار فعلی مرجع */
  presetVariantOfId?: string | null;
  presetVariant?: "current" | "proposed";
  presetKind?: "opc" | "fpc";
}

export function NewDiagramDialog({
  projectId,
  open,
  onOpenChange,
  onCreated,
  presetVariantOfId,
  presetVariant = "current",
  presetKind,
}: NewDiagramDialogProps) {
  const create = useCreateDiagram(projectId);
  const [kind, setKind] = useState<"opc" | "fpc">(presetKind ?? "fpc");
  const [variant, setVariant] = useState<"current" | "proposed">(presetVariant);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState<"material" | "person" | "equipment">("material");
  const [distanceUnit, setDistanceUnit] = useState("m");

  const isProposed = variant === "proposed" || !!presetVariantOfId;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    create.mutate(
      {
        kind,
        variant: isProposed ? "proposed" : "current",
        title: title.trim(),
        description: description.trim() || null,
        subject: kind === "fpc" ? subject : undefined,
        distanceUnit: kind === "fpc" ? distanceUnit : undefined,
        variantOfId: isProposed ? (presetVariantOfId ?? null) : null,
      },
      {
        onSuccess: (d) => {
          onOpenChange(false);
          setTitle("");
          setDescription("");
          onCreated?.(d.id);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>ایجاد نمودار فرایندی جدید</DialogTitle>
          <DialogDescription>
            OPC برای توالی عملیات/بازرسی و مونتاژ اجزا؛ FPC برای جریان گام‌به‌گام یک موضوع (ماده/فرد/تجهیزات) با زمان و مسافت.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setKind("fpc")}
              aria-pressed={kind === "fpc"}
              className={`flex flex-col items-start gap-1.5 rounded-xl border-2 p-3 text-right transition-colors ${
                kind === "fpc" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
              }`}
            >
              <Workflow className={`size-5 ${kind === "fpc" ? "text-primary" : "text-muted-foreground"}`} aria-hidden />
              <span className="text-sm font-semibold">نمودار جریان فرایند (FPC)</span>
              <span className="text-[11px] leading-relaxed text-muted-foreground">
                عملیات/حمل/بازرسی/تأخیر/انبارش + زمان و مسافت
              </span>
            </button>
            <button
              type="button"
              onClick={() => setKind("opc")}
              aria-pressed={kind === "opc"}
              className={`flex flex-col items-start gap-1.5 rounded-xl border-2 p-3 text-right transition-colors ${
                kind === "opc" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
              }`}
            >
              <Network className={`size-5 ${kind === "opc" ? "text-primary" : "text-muted-foreground"}`} aria-hidden />
              <span className="text-sm font-semibold">نمودار عملیات فرایند (OPC)</span>
              <span className="text-[11px] leading-relaxed text-muted-foreground">
                توالی مونتاژ/عملیات/بازرسی + ورود اجزای تشکیل‌دهنده
              </span>
            </button>
          </div>

          {!presetVariant && !presetVariantOfId ? (
            <div className="space-y-1.5">
              <Label>نوع نسخه</Label>
              <Select value={variant} onValueChange={(v) => setVariant(v as "current" | "proposed")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">روش موجود — وضعیت جاری فرایند</SelectItem>
                  <SelectItem value="proposed">روش پیشنهادی — برای مقایسه (نیازمند نمودار مرجع فعلی)</SelectItem>
                </SelectContent>
              </Select>
              {variant === "proposed" ? (
                <p className="text-[11px] text-muted-foreground">
                  بعد از ایجاد، نمودار مرجع (روش موجود) را می‌توانید در کارگاه انتخاب کنید یا از پنل مقایسه پیوند بدهید.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-xs leading-relaxed">
              این نمودار به‌عنوان <strong>نسخه پیشنهادی</strong> از نمودار «روش موجود» فعلی ساخته می‌شود و به آن ارجاع می‌دهد؛ مقایسه
              خلاصه‌ها فعال خواهد بود.
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="nd-title">عنوان نمودار</Label>
            <Input
              id="nd-title"
              required
              maxLength={160}
              placeholder="مثلاً جریان تولید قطعه A — روش موجود"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {kind === "fpc" ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>موضوع مطالعه</Label>
                <Select value={subject} onValueChange={(v) => setSubject(v as typeof subject)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FPC_SUBJECT_OPTIONS_FA.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.labelFa}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>واحد مسافت</Label>
                <Select value={distanceUnit} onValueChange={setDistanceUnit}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="m">متر</SelectItem>
                    <SelectItem value="km">کیلومتر</SelectItem>
                    <SelectItem value="cm">سانتی‌متر</SelectItem>
                    <SelectItem value="ft">فوت</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="nd-desc">توضیح (اختیاری)</Label>
            <Textarea
              id="nd-desc"
              rows={2}
              maxLength={2000}
              placeholder="هدف، محدوده یا مرزهای این نمودار…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              انصراف
            </Button>
            <Button type="submit" disabled={create.isPending || !title.trim()}>
              {create.isPending ? <Spinner /> : null} ایجاد نمودار
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
