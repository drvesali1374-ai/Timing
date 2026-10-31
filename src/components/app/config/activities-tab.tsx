"use client";

/**
 * تب «فعالیت‌ها» — فهرست فعالیت‌ها/عناصر کاری (B5) با نوع کار، طبقه‌بندی ارزش
 * و منبع زمان. ایجاد/ویرایش/بایگانی با API مستقل فعالیت‌ها (نه عملیات پیکربندی).
 */
import { useState } from "react";
import { Archive, ArchiveRestore, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ActivityDto, ConfigWorkType, CurrentConfigDto } from "@/shared/contracts/config";
import { faCount, useProjectActivities, useSetActivityArchived } from "@/hooks/use-config";
import { EmptyState, ErrorState, FaDate, LoadingBlock, Spinner } from "@/components/app/ui-bits";
import { ArchivedBadge, MonoKey, VaBadge, WorkTypeBadge } from "./config-bits";
import { ActivityDialog } from "./activity-dialog";

const SOURCE_OF_TIME_LABELS_FA: Record<string, string> = {
  measured: "اندازه‌گیری‌شده",
  estimated: "برآوردی",
  referenced: "ارجاعی",
};

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
  const setArchived = useSetActivityArchived(projectId);
  const [dialogState, setDialogState] = useState<{ activity?: ActivityDto } | null>(null);

  const workTypes: ConfigWorkType[] = config.snapshot.activityModel.workTypes?.length
    ? config.snapshot.activityModel.workTypes
    : (["operatorManual", "machineAuto", "waiting", "transport", "inspection", "setupChangeover", "overlap"] as ConfigWorkType[]);

  const activities = [...(activitiesQuery.data ?? [])].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "fa"));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-3">
          <div>
            <CardTitle className="text-base">فعالیت‌ها و عناصر کاری</CardTitle>
            <CardDescription>
              واحدهای سنجش کار — مصرف‌کننده: نمودار فرایندی (فاز ۳) و کرنومتر (فاز ۴)
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
              <Button size="sm" className="gap-2" onClick={() => setDialogState({})}>
                <Plus className="size-4" aria-hidden /> فعالیت جدید
              </Button>
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
              title={includeArchived ? "فعالیتی ثبت نشده است" : "فعالیت فعالی ثبت نشده است"}
              description={
                canWrite
                  ? "فعالیت‌ها گام‌های قابل سنجش کار هستند (مثل «نصب درب پنل»). برای اندازه‌گیری در فاز ۴، فعالیت‌های خط را تعریف کنید."
                  : "فعالیت‌ها توسط ویرایشگر/مالک پروژه تعریف می‌شوند."
              }
              action={
                canWrite && !includeArchived ? (
                  <Button size="sm" className="gap-2" onClick={() => setDialogState({})}>
                    <Plus className="size-4" aria-hidden /> فعالیت جدید
                  </Button>
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
                      <TableHead>شناسه فنی</TableHead>
                      <TableHead>نوع کار</TableHead>
                      <TableHead className="hidden md:table-cell">ارزش</TableHead>
                      <TableHead className="hidden lg:table-cell">منبع زمان</TableHead>
                      <TableHead className="hidden lg:table-cell">به‌روزرسانی</TableHead>
                      {canWrite ? <TableHead className="w-28 text-center">عملیات</TableHead> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activities.map((activity) => (
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
                          <MonoKey value={activity.stableKey} />
                        </TableCell>
                        <TableCell>
                          <WorkTypeBadge workType={activity.workType} />
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <VaBadge va={activity.vaClassification} />
                        </TableCell>
                        <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                          {SOURCE_OF_TIME_LABELS_FA[activity.sourceOfTime] ?? activity.sourceOfTime}
                        </TableCell>
                        <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                          <FaDate iso={activity.updatedAt} />
                        </TableCell>
                        {canWrite ? (
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
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
                    ))}
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
          open={true}
          onOpenChange={(o) => !o && setDialogState(null)}
        />
      ) : null}
    </div>
  );
}
