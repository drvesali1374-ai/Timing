"use client";

/**
 * نمای خط و ایستگاه‌های کاری (ADR-017 — دستورالعمل ۶٫۱ گام دوم).
 * ورود سریع ایستگاه‌های خط تولید — تکی یا گروهی (Paste از Excel/متن با پیش‌نمایش).
 */

import { useState } from "react";
import {
  ArrowRight,
  ClipboardPaste,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, ErrorState, LoadingBlock, PageHeader, Spinner } from "@/components/app/ui-bits";
import { FieldHelp } from "@/components/app/field-help";
import {
  useCreateStation,
  useCreateStationsBulk,
  useProjectStations,
  useUpdateStation,
} from "@/hooks/use-config";
import { useProject } from "@/hooks/use-api";
import { faDigits } from "@/components/app/timing/timing-bits";

interface StationsViewProps {
  projectId: string;
  onBack: () => void;
  onOpenActivities: () => void;
  onTitle?: (title: string) => void;
}

export function StationsView({ projectId, onBack, onOpenActivities, onTitle }: StationsViewProps) {
  const project = useProject(projectId);
  const stations = useProjectStations(projectId);
  const createStation = useCreateStation(projectId);
  const createBulk = useCreateStationsBulk(projectId);
  const updateStation = useUpdateStation(projectId);

  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkPreview, setBulkPreview] = useState<string[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const canWrite = project.data ? ["owner", "editor"].includes(project.data.myRole ?? "") : false;

  const submitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    createStation.mutate(
      { name: newName.trim(), description: newDescription.trim() || undefined },
      {
        onSuccess: () => {
          setAddOpen(false);
          setNewName("");
          setNewDescription("");
        },
      },
    );
  };

  const parseBulk = () => {
    // تقسیم سطرها — هر سطر یک نام ایستگاه (منطق ارائه، بدون وابستگی به ماژول)
    setBulkPreview(
      bulkText
        .split(/\r?\n/)
        .map((l) => l.trim().replace(/\s+/g, " "))
        .filter((l) => l.length > 0 && l.length <= 80),
    );
  };

  const applyBulk = () => {
    if (!bulkPreview || bulkPreview.length === 0) return;
    createBulk.mutate(
      { names: bulkPreview },
      { onSuccess: () => { setBulkOpen(false); setBulkText(""); setBulkPreview(null); } },
    );
  };

  const submitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !editName.trim()) return;
    updateStation.mutate(
      { stationId: editingId, name: editName.trim() },
      { onSuccess: () => setEditingId(null) },
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="خط و ایستگاه‌های کاری"
        description={
          project.data?.line
            ? `خط تولید «${project.data.line}» — ایستگاه‌ها به ترتیب جریان کار وارد می‌شوند و فعالیت‌ها به آن‌ها متصل می‌شوند.`
            : "ایستگاه‌های خط تولید را به ترتیب جریان کار وارد کنید — فعالیت‌ها بعداً به ایستگاه‌ها متصل می‌شوند."
        }
        actions={
          <>
            <Button variant="outline" onClick={onBack} className="gap-2">
              <ArrowRight className="size-4" aria-hidden /> بازگشت به پروژه
            </Button>
            {canWrite ? (
              <>
                <Button variant="outline" onClick={() => setBulkOpen(true)} className="gap-2">
                  <ClipboardPaste className="size-4" aria-hidden /> ورود گروهی
                </Button>
                <Button onClick={() => setAddOpen(true)} className="gap-2">
                  <Plus className="size-4" aria-hidden /> ایستگاه جدید
                </Button>
              </>
            ) : null}
          </>
        }
      />

      {stations.isLoading ? (
        <LoadingBlock lines={5} />
      ) : stations.isError ? (
        <ErrorState message={(stations.error as Error)?.message ?? "خطا در بارگذاری ایستگاه‌ها."} onRetry={() => void stations.refetch()} />
      ) : (stations.data?.length ?? 0) === 0 ? (
        <EmptyState
          title="هنوز ایستگاهی تعریف نشده است"
          description="ایستگاه‌های خط تولید خود را وارد کنید — مثلاً: آماده‌سازی، مونتاژ، بازرسی، بسته‌بندی. می‌توانید فهرست را یک‌جا از Excel بچسبانید."
          action={
            canWrite ? (
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => setBulkOpen(true)} variant="outline" className="gap-2">
                  <ClipboardPaste className="size-4" aria-hidden /> ورود گروهی از Excel
                </Button>
                <Button onClick={() => setAddOpen(true)} className="gap-2">
                  <Plus className="size-4" aria-hidden /> ایستگاه جدید
                </Button>
              </div>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {faDigits(stations.data?.length ?? 0)} ایستگاه ·{" "}
            {faDigits(stations.data?.reduce((a, s) => a + s.activityCount, 0) ?? 0)} فعالیت متصل
          </p>
          <ol className="space-y-2">
            {stations.data?.map((s, i) => (
              <li key={s.id}>
                <Card className="py-0 transition-shadow hover:shadow-md">
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 font-mono text-sm font-bold text-primary">
                        {faDigits(i + 1)}
                      </span>
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 font-medium leading-5">
                          {s.name}
                          {s.activityCount > 0 ? (
                            <Badge variant="secondary" className="text-[10px]">
                              {faDigits(s.activityCount)} فعالیت
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              بدون فعالیت
                            </Badge>
                          )}
                        </p>
                        {s.description ? <p className="truncate text-xs text-muted-foreground">{s.description}</p> : null}
                      </div>
                    </div>
                    {canWrite ? (
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`ویرایش ${s.name}`}
                          onClick={() => { setEditingId(s.id); setEditName(s.name); }}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`بایگانی ${s.name}`}
                          className="text-muted-foreground hover:text-destructive"
                          disabled={s.activityCount > 0}
                          title={s.activityCount > 0 ? "ابتدا فعالیت‌های این ایستگاه را منتقل یا بایگانی کنید." : undefined}
                          onClick={() => updateStation.mutate({ stationId: s.id, archived: true })}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ol>
          <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-[11px] leading-6 text-muted-foreground">
            گام بعدی: <button className="font-medium text-primary hover:underline" onClick={onOpenActivities}>تعریف فعالیت‌های هر ایستگاه</button> —
            فعالیت‌ها به ایستگاه متصل می‌شوند و در جدول ثبت زمان و بالانس خط گروه‌بندی می‌شوند.
          </div>
        </div>
      )}

      {/* دیالوگ ایستگاه جدید */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>ایستگاه کاری جدید</DialogTitle>
            <DialogDescription>یک ایستگاه از خط تولید — به ترتیب جریان کار اضافه می‌شود.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitAdd} className="space-y-3">
            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1.5">
                <Label htmlFor="station-name">نام ایستگاه *</Label>
                <FieldHelp
                  label="نام ایستگاه"
                  content={{
                    meaning: "محل یا واحدی از خط تولید که مجموعه‌ای از فعالیت‌ها در آن انجام می‌شود.",
                    input: "نام ایستگاه را همان‌طور که در کارخانه می‌شناسید بنویسید.",
                    example: "«آماده‌سازی قطعات»، «مونتاژ»، «بازرسی نهایی» یا «بسته‌بندی».",
                    usage: "فعالیت‌ها به ایستگاه متصل می‌شوند؛ بالانس خط روی همین تقسیم‌بندی کار می‌کند.",
                    required: true,
                  }}
                />
              </span>
              <Input
                id="station-name"
                placeholder="مثال: مونتاژ"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="station-desc">توضیح</Label>
              <Input
                id="station-desc"
                placeholder="اختیاری — مثال: مونتاژ درب و قفل پنل"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                انصراف
              </Button>
              <Button type="submit" disabled={createStation.isPending || !newName.trim()} className="gap-2">
                {createStation.isPending && <Spinner />} افزودن ایستگاه
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* دیالوگ ورود گروهی */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>ورود گروهی ایستگاه‌ها</DialogTitle>
            <DialogDescription>
              نام ایستگاه‌ها را هر سطر یک نام بنویسید یا از Excel/متن بچسبانید — تکراری‌ها با دلیل اعلام می‌شوند.
            </DialogDescription>
          </DialogHeader>
          {bulkPreview ? (
            <div className="space-y-3">
              <div className="max-h-64 overflow-y-auto rounded-lg border">
                <ol className="divide-y text-sm">
                  {bulkPreview.map((name, i) => (
                    <li key={i} className="flex items-center gap-2 p-2">
                      <span className="font-mono text-xs text-muted-foreground">{faDigits(i + 1)}.</span>
                      {name}
                    </li>
                  ))}
                </ol>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setBulkPreview(null); setBulkText(""); }}>
                  ویرایش مجدد
                </Button>
                <Button onClick={applyBulk} disabled={createBulk.isPending || bulkPreview.length === 0} className="gap-2">
                  {createBulk.isPending ? <Spinner /> : null} ثبت {faDigits(bulkPreview.length)} ایستگاه
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="bulk-stations">فهرست ایستگاه‌ها (هر سطر یک نام)</Label>
                <Textarea
                  id="bulk-stations"
                  rows={7}
                  placeholder={"آماده‌سازی قطعات\nمونتاژ\nبازرسی\nبسته‌بندی"}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={parseBulk} disabled={bulkText.trim() === ""} className="gap-2">
                  <ClipboardPaste className="size-4" aria-hidden /> پیش‌نمایش
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* دیالوگ ویرایش نام */}
      <Dialog open={editingId !== null} onOpenChange={(o) => !o && setEditingId(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>ویرایش نام ایستگاه</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitEdit} className="space-y-3">
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} required aria-label="نام ایستگاه" />
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setEditingId(null)}>
                انصراف
              </Button>
              <Button type="submit" disabled={updateStation.isPending || !editName.trim()}>
                {updateStation.isPending && <Spinner />} ذخیره
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
