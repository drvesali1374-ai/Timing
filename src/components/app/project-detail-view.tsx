"use client";

/**
 * جزئیات پروژه — مسیر مرحله‌ای مطالعه (Stepper بر اساس داده واقعی readiness) + تب‌ها:
 * نسخه‌های پیکربندی (append-only) / اعضا و نقش‌ها / ممیزی.
 * عملیات مجاز بر اساس نقش کاربر (همان ماتریس سرور — shared/contracts/acl).
 * دکمه هر عملیات فقط در یک مکان منطقی (بند ۳.۳ مأموریت UX):
 *   ورود به کارگاه‌ها = دکمه مرحله مربوطه؛ ویرایش/تکثیر/بایگانی = منوی «عملیات پروژه».
 */
import { useEffect, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Circle,
  CircleDot,
  Copy,
  Factory,
  FileClock,
  ListChecks,
  Network,
  Pencil,
  Scale,
  Timer,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { roleCan, PROJECT_ROLE_LABELS_FA, type ProjectRole } from "@/shared/contracts/acl";
import type { ProjectReadinessDto } from "@/shared/contracts/api";
import {
  useAddMember,
  useArchiveProject,
  useDuplicateProject,
  useProject,
  useProjectAudit,
  useProjectMembers,
  useProjectVersions,
  useRemoveMember,
  useUpdateMemberRole,
} from "@/hooks/use-api";
import { useProjectStations } from "@/hooks/use-config";
import type { MemberDto } from "@/shared/contracts/api";
import { DemoBadge, ErrorState, FaDate, LoadingBlock, LoadingCards, PageHeader, Spinner, StatusBadge } from "./ui-bits";
import { Hint } from "./hint";
import { ProjectEditDialog } from "./project-edit-dialog";
import { cn } from "@/lib/utils";

export function ProjectDetailView({ projectId, onBack, onTitle, onOpenConfig, onOpenStations, onOpenDiagrams, onOpenTiming, onOpenAnalysis, onOpenBalance, onOpenGuide }: { projectId: string; onBack: () => void; onTitle?: (title: string) => void; onOpenConfig: () => void; onOpenStations: () => void; onOpenDiagrams: () => void; onOpenTiming: () => void; onOpenAnalysis: () => void; onOpenBalance: () => void; onOpenGuide: () => void }) {
  const projectQuery = useProject(projectId);
  const versionsQuery = useProjectVersions(projectId);
  const membersQuery = useProjectMembers(projectId);
  const auditQuery = useProjectAudit(projectId);
  const stationsQuery = useProjectStations(projectId);

  const archive = useArchiveProject(projectId);
  const duplicate = useDuplicateProject(projectId);

  const [editOpen, setEditOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const projectData = projectQuery.data;
  useEffect(() => {
    if (projectData?.title) onTitle?.(projectData.title);
  }, [projectData?.title, onTitle]);

  if (projectQuery.isLoading) {
    return (
      <div className="space-y-6">
        <LoadingCards count={2} />
        <LoadingBlock lines={5} />
      </div>
    );
  }
  if (projectQuery.isError || !projectQuery.data) {
    return (
      <ErrorState
        message={(projectQuery.error as Error)?.message ?? "پروژه یافت نشد یا شما به آن دسترسی ندارید."}
        onRetry={onBack}
      />
    );
  }
  const project = projectQuery.data;
  const canUpdate = roleCan(project.myRole ?? "viewer", "project:update");
  const canArchive = roleCan(project.myRole ?? "viewer", "project:archive");
  const canDuplicate = roleCan(project.myRole ?? "viewer", "project:duplicate");
  const canManageMembers = roleCan(project.myRole ?? "viewer", "project:manage-members");
  const canReadAudit = roleCan(project.myRole ?? "viewer", "audit:read");

  const infoRows: Array<[string, string | null]> = [
    ["هدف مطالعه", project.goal],
    ["محل", project.location],
    ["بخش", project.department],
    ["خط تولید", project.line],
    ["ایستگاه", project.station],
    ["محصول", project.product],
    ["فرایند", project.process],
    ["مسئول", project.responsible],
    ["شیفت", project.shift],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={project.title}
        description={`کد ${project.code} · ساخته‌شده توسط ${project.createdByName ?? "—"} · ${new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(new Date(project.createdAt))}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={onOpenGuide} className="gap-2">
              <BookOpen className="size-4" aria-hidden /> راهنمای قدم‌به‌قدم مطالعه
            </Button>
            {/* عملیات پروژه — منوی واحد (بند ۵.۱: عملیات کم‌کاربرد/مدیریتی در منوی بیشتر) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Pencil className="size-4" aria-hidden /> عملیات پروژه
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>مدیریت پروژه</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {canUpdate ? (
                  <DropdownMenuItem onClick={() => setEditOpen(true)} className="gap-2">
                    <Pencil className="size-4" aria-hidden /> ویرایش اطلاعات
                  </DropdownMenuItem>
                ) : null}
                {canDuplicate ? (
                  <DropdownMenuItem onClick={() => duplicate.mutate()} disabled={duplicate.isPending} className="gap-2">
                    {duplicate.isPending ? <Spinner /> : <Copy className="size-4" aria-hidden />} تکثیر پروژه
                  </DropdownMenuItem>
                ) : null}
                {canArchive ? (
                  project.status === "archived" ? (
                    <DropdownMenuItem onClick={() => archive.mutate(false)} disabled={archive.isPending} className="gap-2">
                      <ArchiveRestore className="size-4" aria-hidden /> خروج از بایگانی
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem variant="destructive" onClick={() => setConfirmArchive(true)} className="gap-2">
                      <Archive className="size-4" aria-hidden /> بایگانی پروژه
                    </DropdownMenuItem>
                  )
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      {/* وضعیت کلی — فشرده (بدون ده‌ها Badge پراکنده) */}
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={project.status} />
        {project.isDemo ? <DemoBadge /> : null}
        {project.myRole ? (
          <Badge variant="outline">نقش شما: {PROJECT_ROLE_LABELS_FA[project.myRole]}</Badge>
        ) : null}
        <Badge variant="secondary" className="gap-1">
          <FileClock className="size-3" aria-hidden /> پیکربندی فعال: {project.currentConfigVersion?.semver ?? "—"}
        </Badge>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">مراحل مطالعه</TabsTrigger>
          <TabsTrigger value="versions">نسخه‌های پیکربندی ({project.configVersionCount})</TabsTrigger>
          <TabsTrigger value="members">اعضا ({project.memberCount})</TabsTrigger>
          {canReadAudit ? <TabsTrigger value="audit">ممیزی</TabsTrigger> : null}
        </TabsList>

        {/* ── مراحل انجام مطالعه ── */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          {project.isDemo ? (
            <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
              <BookOpen className="mt-0.5 size-5 shrink-0" aria-hidden />
              <p className="leading-relaxed">
                این یک <strong>پروژه آموزشی ایزوله</strong> است: مالکیت آن با «کاربر نمونه» است و در فهرست پروژه‌های
                کاربران واقعی ظاهر نمی‌شود؛ داده آن هرگز وارد نتایج پروژه‌های واقعی نمی‌شود.
              </p>
            </div>
          ) : null}

          <StudyPathStepper
            readiness={project.readiness}
            stationCount={stationsQuery.data?.length ?? 0}
            onOpenConfig={onOpenConfig}
            onOpenStations={onOpenStations}
            onOpenDiagrams={onOpenDiagrams}
            onOpenTiming={onOpenTiming}
            onOpenAnalysis={onOpenAnalysis}
            onOpenBalance={onOpenBalance}
            onOpenGuide={onOpenGuide}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">داده‌های عمومی پروژه</CardTitle>
                <CardDescription>اطلاعات زمینه‌ای مطالعه (B1)</CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  {infoRows.map(([label, value]) => (
                    <div key={label} className="min-w-0">
                      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                      <dd className="truncate text-sm" title={value ?? undefined}>
                        {value ?? <span className="text-muted-foreground">—</span>}
                      </dd>
                    </div>
                  ))}
                  <div className="min-w-0 sm:col-span-2">
                    <dt className="text-xs font-medium text-muted-foreground">یادداشت‌ها</dt>
                    <dd className="whitespace-pre-wrap text-sm">{project.notes ?? <span className="text-muted-foreground">—</span>}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  پروفایل روش‌شناختی
                  <Hint
                    text="کپی مستقل از الگوی روش‌شناختی در لحظه ایجاد پروژه. تغییرات ساختاری (خانواده‌ها، پارامترها، فرمول‌ها) به‌صورت نسخه‌های جدید append-only ثبت می‌شوند و نسخه‌های قبلی برای بازتولید نتایج حفظ می‌شوند."
                    title="پروفایل و نسخه‌بندی"
                  />
                </CardTitle>
                <CardDescription>کپی مستقل از الگو — لحظه ایجاد پروژه (ADR-005)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-2 rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{project.profile.templateNameFa ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      نسخه الگو: {project.profile.templateVersion ?? "—"} · شناسه snapshot:
                      <span className="ms-1 font-mono text-[10px]" dir="ltr">{(project.profile.snapshotId ?? "—").slice(0, 13)}…</span>
                    </p>
                  </div>
                  <Badge variant="secondary">نسخه فعال {project.currentConfigVersion?.semver ?? "—"}</Badge>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  تب «نسخه‌های پیکربندی» تاریخچه کامل و قابل بازبینی نسخه‌ها را نشان می‌دهد؛ درون‌ریزی و برون‌ریزی
                  پیکربندی از کارگاه پیکربندی در دسترس است.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── نسخه‌های پیکربندی ── */}
        <TabsContent value="versions" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">تاریخچه نسخه‌های پیکربندی (append-only)</CardTitle>
              <CardDescription>نسخه‌ها هرگز ویرایش یا حذف نمی‌شوند؛ هر تغییر ساختاری نسخه جدیدی می‌سازد.</CardDescription>
            </CardHeader>
            <CardContent>
              {versionsQuery.isLoading ? (
                <LoadingBlock lines={4} />
              ) : versionsQuery.isError ? (
                <ErrorState message={(versionsQuery.error as Error).message} onRetry={() => versionsQuery.refetch()} />
              ) : (
                <VersionList versions={versionsQuery.data ?? []} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── اعضا ── */}
        <TabsContent value="members" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-base">اعضا و کنترل دسترسی</CardTitle>
                <CardDescription>
                  نقش‌ها: مالک (همه)، ویرایشگر (پیکربندی/داده)، ثبت‌کننده (مشاهدات)، ببیننده (گزارش‌ها)
                </CardDescription>
              </div>
              {canManageMembers ? (
                <Button size="sm" className="gap-2" onClick={() => setAddMemberOpen(true)}>
                  <UserPlus className="size-4" aria-hidden /> افزودن عضو
                </Button>
              ) : null}
            </CardHeader>
            <CardContent>
              {membersQuery.isLoading ? (
                <LoadingBlock lines={3} />
              ) : membersQuery.isError ? (
                <ErrorState message={(membersQuery.error as Error).message} onRetry={() => membersQuery.refetch()} />
              ) : (
                <MembersTable projectId={projectId} members={membersQuery.data ?? []} canManage={canManageMembers} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ممیزی ── */}
        {canReadAudit ? (
          <TabsContent value="audit" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">ردپوی ممیزی</CardTitle>
                <CardDescription>عملیات حساس ثبت‌شده روی این پروژه (ADR-009)</CardDescription>
              </CardHeader>
              <CardContent>
                {auditQuery.isLoading ? (
                  <LoadingBlock lines={5} />
                ) : auditQuery.isError ? (
                  <ErrorState message={(auditQuery.error as Error).message} onRetry={() => auditQuery.refetch()} />
                ) : (
                  <AuditTable entries={auditQuery.data ?? []} />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}
      </Tabs>

      {/* دیالوگ‌ها */}
      {editOpen ? <ProjectEditDialog project={project} open={editOpen} onOpenChange={setEditOpen} /> : null}
      {addMemberOpen ? (
        <AddMemberDialog projectId={projectId} open={addMemberOpen} onOpenChange={setAddMemberOpen} />
      ) : null}
      <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>بایگانی پروژه «{project.title}»؟</AlertDialogTitle>
            <AlertDialogDescription>
              پروژه بایگانی‌شده در فهرست پیش‌فرض نمایش داده نمی‌شود اما داده آن کامل حفظ و قابل بازیابی است. این عملیات
              در ممیزی ثبت می‌شود.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction onClick={() => archive.mutate(true)}>بایگانی کن</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─────────────────────── مسیر مرحله‌ای مطالعه ───────────────────────

interface StepDef {
  key: string;
  title: string;
  desc: string;
  icon: React.ElementType;
  done: boolean;
  /** دکمه ورود به مرحله — همیشه در دسترس (کاربران حرفه‌ای مستقیم وارد هر بخش می‌شوند) */
  enter: () => void;
  ctaDone: string;
  ctaNext: string;
}

function StudyPathStepper({
  readiness,
  stationCount,
  onOpenConfig,
  onOpenStations,
  onOpenDiagrams,
  onOpenTiming,
  onOpenAnalysis,
  onOpenBalance,
  onOpenGuide,
}: {
  readiness: ProjectReadinessDto;
  stationCount: number;
  onOpenConfig: () => void;
  onOpenStations: () => void;
  onOpenDiagrams: () => void;
  onOpenTiming: () => void;
  onOpenAnalysis: () => void;
  onOpenBalance: () => void;
  onOpenGuide: () => void;
}) {
  // جریان ساده‌شده برای کاربر تازه‌کار (دستورالعمل ۶٫۱) — نمودار اختیاری است و
  // کاربر فقط زمان‌خواه می‌تواند مستقیم از ثبت زمان شروع کند.
  const steps: StepDef[] = [
    {
      key: "stations",
      title: "خط و ایستگاه‌های کاری",
      desc: "ایستگاه‌های خط تولید را به ترتیب جریان کار وارد کنید — تکی یا یک‌جا از Excel.",
      icon: Factory,
      done: stationCount > 0,
      enter: onOpenStations,
      ctaDone: "مشاهده ایستگاه‌ها",
      ctaNext: "تعریف ایستگاه‌ها",
    },
    {
      key: "activities",
      title: "فعالیت‌ها",
      desc: "کارهای قابل‌اندازه‌گیری هر ایستگاه را تعریف کنید و به ایستگاه متصل کنید.",
      icon: ListChecks,
      done: readiness.measurementReady,
      enter: onOpenConfig,
      ctaDone: "مدیریت فعالیت‌ها",
      ctaNext: "تعریف فعالیت‌ها",
    },
    {
      key: "diagram",
      title: "نمودار فرایندی (اختیاری)",
      desc: "در صورت نیاز، جریان کار را با نمودار OPC/FPC طراحی و به فعالیت‌ها متصل کنید.",
      icon: Network,
      done: readiness.diagramReady,
      enter: onOpenDiagrams,
      ctaDone: "مشاهده نمودارها",
      ctaNext: "شروع طراحی نمودار",
    },
    {
      key: "timing",
      title: "ثبت زمان‌ها",
      desc: "زمان‌های اندازه‌گیری‌شده خود را در برگه ثبت (جدول فعالیت × نمونه) وارد کنید.",
      icon: Timer,
      done: readiness.analysisReady,
      enter: onOpenTiming,
      ctaDone: "مشاهده برگه‌های ثبت",
      ctaNext: "ثبت زمان‌ها",
    },
    {
      key: "analysis",
      title: "تحلیل مهندسی زمان",
      desc: "میانگین/داده پرت و زنجیره زمان (نماینده/نرمال/استاندارد) را ببینید.",
      icon: BarChart3,
      done: readiness.approvalReady,
      enter: onOpenAnalysis,
      ctaDone: "کارگاه تحلیل",
      ctaNext: "شروع تحلیل",
    },
    {
      key: "balance",
      title: "بالانس خط و گزارش",
      desc: "در صورت نیاز بالانس خط و در پایان گزارش نهایی مطالعه را دریافت کنید.",
      icon: Scale,
      done: readiness.approvalReady,
      enter: onOpenBalance,
      ctaDone: "کارگاه بالانس خط",
      ctaNext: "شروع بالانس خط",
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const currentIdx = steps.findIndex((s) => !s.done);
  const current = currentIdx >= 0 ? steps[currentIdx] : null;

  return (
    <section aria-label="مراحل انجام مطالعه" className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">مراحل انجام مطالعه</h2>
          <Hint
            text="مسیر پیشنهادی انجام یک مطالعه زمان‌سنجی است، نه محدودیت اجباری: با دکمه هر مرحله می‌توانید مستقیم به همان بخش بروید. وضعیت هر مرحله از داده واقعی پروژه به دست می‌آید."
            title="مسیر مطالعه"
          />
          <Button variant="ghost" size="sm" onClick={onOpenGuide} className="gap-1.5 text-xs text-primary hover:text-primary">
            <BookOpen className="size-3.5" aria-hidden /> راهنمای کامل قدم‌به‌قدم
          </Button>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            {doneCount} از {steps.length} مرحله کامل
          </span>
          <Progress value={(doneCount / steps.length) * 100} className="h-2 w-28 sm:w-40" aria-label="پیشرفت مطالعه" />
        </div>
      </div>

      {current ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-primary/[0.04] p-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <current.icon className="size-4.5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">اقدام پیشنهادی — {current.title}</p>
              <p className="truncate text-xs text-muted-foreground">{current.desc}</p>
            </div>
          </div>
          <Button className="gap-2" onClick={current.enter}>
            <current.icon className="size-4" aria-hidden /> {current.ctaNext}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-emerald-50 p-4 dark:bg-emerald-950/30">
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
            همه مراحل پایه کامل شده‌اند — گزارش‌ها و مقایسه سناریوهای بالانس در کارگاه تحلیل/بالانس در دسترس است.
          </p>
          <Button variant="outline" size="sm" className="gap-2" onClick={onOpenBalance}>
            <Scale className="size-4" aria-hidden /> کارگاه بالانس خط
          </Button>
        </div>
      )}

      <ol className="grid gap-0 sm:grid-cols-2 lg:grid-cols-6">
        {steps.map((s, i) => {
          const isCurrent = current?.key === s.key;
          return (
            <li
              key={s.key}
              className={cn(
                "flex flex-col gap-2 border-b border-e p-4 last:border-b-0 last:border-e-0 sm:[&:nth-last-child(-n+1)]:border-e-0 lg:[&:nth-last-child(-n+6)]:border-b-0 lg:[&:nth-last-child(-n+6)]:border-e",
                i < steps.length - 1 && "lg:border-e",
                isCurrent && "bg-muted/40",
              )}
              aria-current={isCurrent ? "step" : undefined}
            >
              <div className="flex items-center gap-2">
                {s.done ? (
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden />
                ) : isCurrent ? (
                  <CircleDot className="size-4 shrink-0 text-primary" aria-hidden />
                ) : (
                  <Circle className="size-4 shrink-0 text-muted-foreground/50" aria-hidden />
                )}
                <span className={cn("text-xs font-semibold", isCurrent && "text-primary")}>
                  {i + 1}. {s.title}
                </span>
              </div>
              <p className="min-h-8 text-[11px] leading-relaxed text-muted-foreground">{s.desc}</p>
              <Button variant={isCurrent ? "default" : "outline"} size="sm" className="mt-auto w-full gap-1.5 text-xs" onClick={s.enter}>
                <s.icon className="size-3.5" aria-hidden />
                {s.done ? s.ctaDone : isCurrent ? s.ctaNext : "ورود به مرحله"}
              </Button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// ─────────────────────── نسخه‌ها ───────────────────────

function VersionList({ versions }: { versions: Array<{ id: string; semver: string; reason: string | null; isCurrent: boolean; createdByName: string | null; createdAt: string; snapshot: unknown }> }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  if (versions.length === 0) {
    return <p className="text-sm text-muted-foreground">هنوز نسخه‌ای ثبت نشده است.</p>;
  }
  return (
    <div className="space-y-3">
      {versions.map((v) => (
        <div key={v.id} className="rounded-lg border">
          <div className="flex flex-wrap items-center justify-between gap-2 p-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Badge variant={v.isCurrent ? "default" : "outline"} className="font-mono" dir="ltr">
                v{v.semver}
              </Badge>
              {v.isCurrent ? <Badge variant="secondary">نسخه فعال</Badge> : null}
              <span className="truncate text-sm text-muted-foreground">{v.reason ?? "—"}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{v.createdByName ?? "—"}</span>
              <FaDate iso={v.createdAt} withTime />
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setExpanded(expanded === v.id ? null : v.id)}
                aria-expanded={expanded === v.id}
              >
                {expanded === v.id ? "بستن جزئیات" : "مشاهده snapshot"}
              </Button>
            </div>
          </div>
          {expanded === v.id ? (
            <ScrollArea className="max-h-72 border-t">
              <pre className="whitespace-pre-wrap p-3 text-start text-[11px] leading-relaxed" dir="ltr">
                {JSON.stringify(v.snapshot, null, 2)}
              </pre>
            </ScrollArea>
          ) : null}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────── اعضا ───────────────────────

function MembersTable({
  projectId,
  members,
  canManage,
}: {
  projectId: string;
  members: MemberDto[];
  canManage: boolean;
}) {
  const updateRole = useUpdateMemberRole(projectId);
  const removeMember = useRemoveMember(projectId);

  if (members.length === 0) {
    return <p className="text-sm text-muted-foreground">عضوی ثبت نشده است.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>کاربر</TableHead>
          <TableHead>نقش</TableHead>
          <TableHead>عضویت از</TableHead>
          {canManage ? <TableHead>عملیات</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((m) => (
          <TableRow key={m.id}>
            <TableCell>
              <div className="flex flex-col">
                <span className="font-medium">{m.name ?? "بدون نام"}</span>
                <span className="text-xs text-muted-foreground" dir="ltr">{m.email}</span>
              </div>
            </TableCell>
            <TableCell>
              {m.role === "owner" ? (
                <Badge>مالک</Badge>
              ) : canManage ? (
                <Select
                  value={m.role}
                  onValueChange={(role) => updateRole.mutate({ memberId: m.id, role })}
                  disabled={updateRole.isPending}
                >
                  <SelectTrigger className="h-8 w-36" aria-label={`نقش ${m.name ?? m.email}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="editor">ویرایشگر</SelectItem>
                    <SelectItem value="recorder">ثبت‌کننده</SelectItem>
                    <SelectItem value="viewer">ببیننده</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant="outline">{PROJECT_ROLE_LABELS_FA[m.role as ProjectRole] ?? m.role}</Badge>
              )}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              <FaDate iso={m.createdAt} />
            </TableCell>
            {canManage ? (
              <TableCell>
                {m.role !== "owner" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-red-600 dark:text-red-400"
                    onClick={() => removeMember.mutate(m.id)}
                    disabled={removeMember.isPending}
                  >
                    {removeMember.isPending ? <Spinner /> : "حذف"}
                  </Button>
                ) : null}
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function AddMemberDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const addMember = useAddMember(projectId);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) return;
    addMember.mutate(
      { email: email.trim().toLowerCase(), role },
      {
        onSuccess: () => {
          onOpenChange(false);
          setEmail("");
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>افزودن عضو به پروژه</DialogTitle>
          <DialogDescription>
            کاربر باید پیش‌تر در پلتفرم ثبت‌نام کرده باشد. نقش در هر زمان قابل تغییر است.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="member-email">رایانامه کاربر</Label>
            <Input
              id="member-email"
              type="email"
              dir="ltr"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>نقش</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger aria-label="نقش عضو جدید">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="editor">ویرایشگر — پیکربندی و ویرایش داده</SelectItem>
                <SelectItem value="recorder">ثبت‌کننده — ثبت مشاهدات</SelectItem>
                <SelectItem value="viewer">ببیننده — فقط مشاهده و گزارش</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              انصراف
            </Button>
            <Button type="submit" disabled={addMember.isPending || !email.includes("@")}>
              {addMember.isPending && <Spinner />} افزودن
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────── ممیزی ───────────────────────

const AUDIT_LABELS_FA: Record<string, string> = {
  "user.registered": "ثبت‌نام کاربر",
  "project.created": "ایجاد پروژه",
  "project.updated": "ویرایش پروژه",
  "project.archived": "بایگانی پروژه",
  "project.unarchived": "خروج از بایگانی",
  "project.duplicated": "تکثیر پروژه",
  "config.version-created": "ایجاد نسخه پیکربندی",
  "member.added": "افزودن عضو",
  "member.role-changed": "تغییر نقش عضو",
  "member.removed": "حذف عضو",
};

function AuditTable({ entries }: { entries: Array<{ id: string; action: string; userName: string | null; userEmail: string | null; createdAt: string }> }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">رخدادی ثبت نشده است.</p>;
  }
  return (
    <div className="max-h-96 overflow-y-auto">
      <Table>
        <TableHeader className="sticky top-0 bg-background">
          <TableRow>
            <TableHead>رخداد</TableHead>
            <TableHead>کاربر</TableHead>
            <TableHead>زمان</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="font-medium">{AUDIT_LABELS_FA[e.action] ?? e.action}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {e.userName ?? e.userEmail ?? "سیستم"}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                <FaDate iso={e.createdAt} withTime />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
