"use client";

/**
 * دیالوگ ویرایش داده‌های عمومی پروژه (B1) — اعتبارسنجی با همان zod سرور.
 * والد این دیالوگ را فقط هنگام باز‌بودن رندر می‌کند؛ بنابراین state در هر بار
 * باز‌شدن از داده پروژه مقدار اولیه می‌گیرد (الگوی mount-fresh بدون effect).
 */
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUpdateProject } from "@/hooks/use-api";
import { projectInfoSchema } from "@/shared/validation/project";
import type { ProjectDto } from "@/shared/contracts/api";
import { Spinner } from "./ui-bits";

const TEXT_FIELDS: Array<{ key: keyof ProjectInfoState; label: string; placeholder?: string }> = [
  { key: "title", label: "عنوان پروژه *", placeholder: "مثال: زمان‌سنجی خط مونتاژ A" },
  { key: "code", label: "کد پروژه *", placeholder: "مثال: PRJ-001" },
  { key: "goal", label: "هدف مطالعه" },
  { key: "location", label: "محل" },
  { key: "department", label: "بخش" },
  { key: "line", label: "خط تولید" },
  { key: "station", label: "ایستگاه" },
  { key: "product", label: "محصول" },
  { key: "process", label: "فرایند" },
  { key: "responsible", label: "مسئول" },
  { key: "shift", label: "شیفت" },
];

interface ProjectInfoState {
  title: string;
  code: string;
  goal: string;
  location: string;
  department: string;
  line: string;
  station: string;
  product: string;
  process: string;
  responsible: string;
  shift: string;
  notes: string;
}

function fromProject(p: ProjectDto): ProjectInfoState {
  return {
    title: p.title,
    code: p.code,
    goal: p.goal ?? "",
    location: p.location ?? "",
    department: p.department ?? "",
    line: p.line ?? "",
    station: p.station ?? "",
    product: p.product ?? "",
    process: p.process ?? "",
    responsible: p.responsible ?? "",
    shift: p.shift ?? "",
    notes: p.notes ?? "",
  };
}

export function ProjectEditDialog({
  project,
  open,
  onOpenChange,
  onSaved,
}: {
  project: ProjectDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (p: ProjectDto) => void;
}) {
  const update = useUpdateProject(project.id);
  const [form, setForm] = useState<ProjectInfoState>(() => fromProject(project));

  const set = (key: keyof ProjectInfoState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = projectInfoSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "داده‌های فرم نامعتبر است.");
      return;
    }
    update.mutate(parsed.data, {
      onSuccess: (p) => {
        onOpenChange(false);
        onSaved?.(p);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>ویرایش اطلاعات پروژه</DialogTitle>
          <DialogDescription>
            داده‌های عمومی پروژه را اصلاح کنید. تغییرات در Audit ثبت می‌شود.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <ScrollArea className="max-h-[65vh] pr-3">
            <div className="grid gap-4 py-2 sm:grid-cols-2">
              {TEXT_FIELDS.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label htmlFor={`edit-${f.key}`}>{f.label}</Label>
                  <Input id={`edit-${f.key}`} value={form[f.key]} onChange={set(f.key)} placeholder={f.placeholder} />
                </div>
              ))}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="edit-notes">یادداشت‌ها</Label>
                <Textarea id="edit-notes" rows={3} value={form.notes} onChange={set("notes")} />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="mt-4 gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              انصراف
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending && <Spinner />} ذخیره تغییرات
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
