"use client";

/**
 * تب «فعالیت‌ها» — فهرست فعالیت‌ها/عناصر کاری (B5) با ایستگاه متصل (ADR-017)،
 * ورود گروهی (Paste از Excel)، ارتباط با گام‌های نمودار و منبع زمان.
 * ایجاد/ویرایش/بایگانی با API مستقل فعالیت‌ها (نه عملیات پیکربندی).
 */
import { useState } from "react";
import { Archive, ArchiveRestore, ClipboardPaste, Pencil, Plus, Share2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { ActivityDto, ConfigWorkType, CurrentConfigDto } from "@/shared/contracts/config";
import { faCount, useActivityLinks, useCreateActivitiesBulk, useProjectActivities, useProjectStations, useSetActivityArchived } from "@/hooks/use-config";
import { useDiagramActivityLink, useUnlinkDiagramStep } from "@/hooks/use-manual-sheets";
import { useDiagrams } from "@/hooks/use-diagrams";
import { EmptyState, ErrorState, FaDate, LoadingBlock, Spinner } from "@/components/app/ui-bits";
import { ArchivedBadge, MonoKey, VaBadge, WorkTypeBadge } from "./config-bits";
import { ActivityDialog } from "./activity-dialog";
import { faDigits } from "@/components/app/timing/timing-bits";

const SOURCE_OF_TIME_LABELS_FA: Record<string, string> = {
  measured: "اندازه‌گیری‌شده",
  estimated: "برآوردی",
  referenced: "ارجاعی",
};

const NO_STATION = "__none__";

export function ActivitiesTab({
  projectId,
  config,
  canWrite,
}: {
  projectId: string;
  config: CurrentConfigDto;
  canWrite: boolean;
}) {
  const [includeArchived, setIncludeArchived] = useState(false);
  const activitiesQuery = useProjectActivities(projectId, includeArchived);
  const stationsQuery = useProjectStations(projectId);
  const linksQuery = useActivityLinks(projectId);
  const diagramsQuery = useDiagrams(projectId);
  const setArchived = useSetActivityArchived(projectId);
  const bulkCreate = useCreateActivitiesBulk(projectId);
  const linkMutation = useDiagramActivityLink(projectId);
  const unlinkMutation = useUnlinkDiagramStep(projectId);
  const [dialogState, setDialogState] = useState<{ activity?: ActivityDto } | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkStation, setBulkStation] = useState<string>(NO_STATION);
  const [linkDialogActivity, setLinkDialogActivity] = useState<ActivityDto | null>(null);
  const [linkDiagramId, setLinkDiagramId] = useState("");

  const workTypes: ConfigWorkType[] = config.snapshot.activityModel.workTypes?.length
    ? config.snapshot.activityModel.workTypes
    : (["operatorManual", "machineAuto", "waiting", "transport", "inspection", "setupChangeover", "overlap"] as ConfigWorkType[]);

  const activities = [...(activitiesQuery.data ?? [])].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "fa"));
  const stations = stationsQuery.data ?? [];
  const links = linksQuery.data;
  const diagrams = (diagramsQuery.data ?? []).filter((d) => d.status !== "archived");

  const submitBulk = () => {
    const names = bulkText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (names.length === 0) return;
    bulkCreate.mutate(
      names.map((name) => ({ name, stationId: bulkStation === NO_STATION ? null : bulkStation })),
      { onSuccess: () => { setBulkOpen(false); setBulkText(""); } },
    );
  };

  const submitLink = () => {
    if (!linkDialogActivity || !linkDiagramId) return;
    linkMutation.mutate(
      {
        activityStableKey: linkDialogActivity.stableKey,
        diagramId: linkDiagramId,
        symbol: "operation",
      },
      { onSuccess: () => { setLinkDialogActivity(null); setLinkDiagramId(""); } },
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-3">
          <div>
            <CardTitle className="text-base">فعالیت‌ها و عناصر کاری</CardTitle>
            <CardDescription>
              کارهای قابل‌اندازه‌گیری خط — به ایستگاه متصل می‌شوند و مبنای ثبت زمان، نمودار فرایندی و بالانس خط هستند.
              {config.snapshot.activityModel.notesFa ? ` · ${config.snapshot.activityModel.notesFa}` : ""}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="show-archived-activities"
                checked={includeArchived}
                onCheckedChange={setIncludeArchived}
                disabled={activitiesQuery.isLoading}
              />
              <Label htmlFor="show-archived-activities" className="cursor-pointer text-sm text-muted-foreground">
                بایگانی‌شده‌ها
              </Label>
            </div>
            {canWrite ? (
              <>
                <Button size="sm" variant="outline" className="gap-2" onClick={() => setBulkOpen(true)}>
                  <ClipboardPaste className="size-4" aria-hidden /> ورود گروهی
                </Button>
                <Button size="sm" className="gap-2" onClick={() => setDialogState({})}>
                  <Plus className="size-4" aria-hidden /> فعالیت جدید
                </Button>
              </>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {activitiesQuery.isLoading ? (
            <LoadingBlock lines={5} />
          ) : activitiesQuery.isError ? (
            <ErrorState message={(activitiesQuery.error as Error)?.message ?? "خطا در بارگذاری فعالیت‌ها."} onRetry={() => activitiesQuery.refetch()} />
          ) : activities.length === 0 ? (
            <EmptyState
              title={includeArchived ? "فعالیتی ثبت نشده است" : "هنوز فعالیتی ثبت نشده است"}
              description={
                canWrite
                  ? "فعالیت‌ها کارهای قابل‌سنجش خط‌اند (مثل «نصب درب پنل»). فهرست آماده دارید؟ یک‌جا از Excel واردش کنید."
                  : "فعالیت‌ها توسط ویرایشگر/مالک پروژه تعریف می‌شوند."
              }
              action={
                canWrite && !includeArchived ? (
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button size="sm" variant="outline" className="gap-2" onClick={() => setBulkOpen(true)}>
                      <ClipboardPaste className="size-4" aria-hidden /> ورود گروهی از Excel
                    </Button>
                    <Button size="sm" className="gap-2" onClick={() => setDialogState({})}>
                      <Plus className="size-4" aria-hidden /> فعالیت جدید
                    </Button>
                  </div>
                ) : undefined
              }
            />
          ) : (
            <>
              <p className="mb-2 text-sm text-muted-foreground">{faCount(activities.length)} فعالیت</p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>فعالیت</TableHead>
                      <TableHead>ایستگاه</TableHead>
                      <TableHead>شناسه داخلی</TableHead>
                      <TableHead>نوع کار</TableHead>
                      <TableHead className="hidden md:table-cell">نمودار</TableHead>
                      <TableHead className="hidden lg:table-cell">منبع زمان</TableHead>
                      {canWrite ? <TableHead className="w-28 text-center">عملیات</TableHead> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activities.map((activity) => {
                      const activityLinks = links?.byActivity[activity.stableKey] ?? [];
                      const invalidRef = links?.invalidRefs.find((r) => r.stableKey === activity.stableKey);
                      return (
                        <TableRow key={activity.id} className={activity.archived ? "opacity-60" : undefined}>
                          <TableCell>
                            <div className="flex max-w-56 flex-col">
                              <span className="font-medium">
                                {activity.name}
                                {activity.archived ? <span className="ms-2"><ArchivedBadge /></span> : null}
                              </span>
                              {activity.description ? (
                                <span className="truncate text-xs text-muted-foreground" title={activity.description}>
                                  {activity.description}
                                </span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>
                            {activity.stationName ? (
                              <Badge variant="outline" className="text-[11px]">{activity.stationName}</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <MonoKey value={activity.stableKey} />
                          </TableCell>
                          <TableCell>
                            <WorkTypeBadge workType={activity.workType} />
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {activityLinks.length > 0 ? (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] hover:bg-accent">
                                    <Share2 className="size-3 text-primary" aria-hidden />
                                    {faDigits(activityLinks.length)} گام
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent side="top" align="start" className="w-72 text-xs">
                                  <p className="mb-2 font-medium">گام‌های ارجاع‌دهنده به «{activity.name}»</p>
                                  <ul className="space-y-1.5">
                                    {activityLinks.map((l) => (
                                      <li key={l.diagramId + l.nodeId} className="flex items-center justify-between gap-2 rounded-md border p-1.5">
                                        <div className="min-w-0">
                                          <p className="truncate font-medium">{l.nodeTitle}</p>
                                          <p className="text-[10px] text-muted-foreground">
                                            {l.diagramTitle} {l.stepNo ? `· گام ${faDigits(l.stepNo)}` : ""}
                                          </p>
                                        </div>
                                        {canWrite ? (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 shrink-0 px-2 text-[10px] text-muted-foreground hover:text-destructive"
                                            onClick={() =>
                                              unlinkMutation.mutate({
                                                activityStableKey: activity.stableKey,
                                                diagramId: l.diagramId,
                                                nodeId: l.nodeId,
                                              })
                                            }
                                          >
                                            قطع ارجاع
                                          </Button>
                                        ) : null}
                                      </li>
                                    ))}
                                  </ul>
                                </PopoverContent>
                              </Popover>
                            ) : invalidRef ? (
                              <Badge variant="outline" className="border-destructive/50 text-[10px] text-destructive">
                                ارجاع نامعتبر در نمودار
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                            {SOURCE_OF_TIME_LABELS_FA[activity.sourceOfTime] ?? activity.sourceOfTime}
                          </TableCell>
                          {canWrite ? (
                            <TableCell>
                              <div className="flex items-center justify-center gap-1">
                                {diagrams.length > 0 ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-11"
                                    onClick={() => setLinkDialogActivity(activity)}
                                    aria-label={`اتصال ${activity.name} به نمودار`}
                                    title="اتصال به گام نمودار"
                                  >
                                    <Share2 className="size-4" aria-hidden />
                                  </Button>
                                ) : null}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-11"
                                  onClick={() => setDialogState({ activity })}
                                  aria-label={`ویرایش فعالیت ${activity.name}`}
                                >
                                  <Pencil className="size-4" aria-hidden />
                                </Button>
                                {activity.archived ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-11"
                                    onClick={() => setArchived.mutate({ activityId: activity.id, archived: false })}
                                    disabled={setArchived.isPending}
                                    aria-label={`بازگردانی فعالیت ${activity.name}`}
                                  >
                                    <ArchiveRestore className="size-4" aria-hidden />
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-11 text-red-600 dark:text-red-400"
                                    onClick={() => setArchived.mutate({ activityId: activity.id, archived: true })}
                                    disabled={setArchived.isPending}
                                    aria-label={`بایگانی فعالیت ${activity.name}`}
                                  >
                                    {setArchived.isPending ? <Spinner /> : <Archive className="size-4" aria-hidden />}
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          ) : null}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {dialogState ? (
        <ActivityDialog
          projectId={projectId}
          activity={dialogState.activity}
          workTypes={workTypes}
          stations={stations}
          open={true}
          onOpenChange={(o) => !o && setDialogState(null)}
        />
      ) : null}

      {/* دیالوگ ورود گروهی فعالیت‌ها */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>ورود گروهی فعالیت‌ها</DialogTitle>
            <DialogDescription>
              نام فعالیت‌ها را هر سطر یک نام بنویسید یا از Excel بچسبانید — شناسه داخلی خودکار ساخته می‌شود و
              تکراری‌ها با دلیل اعلام می‌شوند.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {stations.length > 0 ? (
              <div className="space-y-1.5">
                <Label>اتصال همه به ایستگاه</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                  value={bulkStation}
                  onChange={(e) => setBulkStation(e.target.value)}
                  aria-label="ایستگاه دسته"
                >
                  <option value={NO_STATION}>— بدون ایستگاه (بعداً متصل می‌کنید) —</option>
                  {stations.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="bulk-activities">فهرست فعالیت‌ها (هر سطر یک نام)</Label>
              <Textarea
                id="bulk-activities"
                rows={8}
                placeholder={"برداشتن قطعه از جعبه\nقرار دادن قطعه در محل\nنصب پیچ\nکنترل اتصال"}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setBulkOpen(false)}>
              انصراف
            </Button>
            <Button onClick={submitBulk} disabled={bulkCreate.isPending || bulkText.trim() === ""} className="gap-2">
              {bulkCreate.isPending && <Spinner />} ثبت فعالیت‌ها
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* دیالوگ اتصال فعالیت به گام نمودار */}
      <Dialog open={linkDialogActivity !== null} onOpenChange={(o) => !o && setLinkDialogActivity(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>اتصال «{linkDialogActivity?.name}» به نمودار</DialogTitle>
            <DialogDescription>
              گامی با نام این فعالیت در نمودار انتخابی ساخته می‌شود و از هر دو سمت (نمودار و فعالیت) قابل مدیریت است.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>نمودار مقصد</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
              value={linkDiagramId}
              onChange={(e) => setLinkDiagramId(e.target.value)}
              aria-label="نمودار مقصد"
            >
              <option value="">یک نمودار انتخاب کنید…</option>
              {diagrams.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title} ({d.kind === "opc" ? "OPC" : "FPC"})
                </option>
              ))}
            </select>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setLinkDialogActivity(null)}>
              انصراف
            </Button>
            <Button onClick={submitLink} disabled={linkMutation.isPending || !linkDiagramId} className="gap-2">
              {linkMutation.isPending && <Spinner />} ایجاد گام مرتبط
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
