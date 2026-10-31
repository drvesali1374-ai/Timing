"use client";

/**
 * جزئیات پروژه — تب‌ها: نمای کلی / نسخه‌های پیکربندی (append-only) / اعضا و نقش‌ها / ممیزی.
 * عملیات مجاز بر اساس نقش کاربر (همان ماتریس سرور — shared/contracts/acl).
 */
import { useEffect, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  BookOpen,
  Copy,
  FileClock,
  Pencil,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
import type { MemberDto } from "@/shared/contracts/api";
import { DemoBadge, ErrorState, FaDate, LoadingBlock, LoadingCards, PageHeader, ReadinessChips, Spinner, StatusBadge } from "./ui-bits";
import { ProjectEditDialog } from "./project-edit-dialog";

export function ProjectDetailView({ projectId, onBack, onTitle }: { projectId: string; onBack: () => void; onTitle?: (title: string) => void }) {
  const projectQuery = useProject(projectId);
  const versionsQuery = useProjectVersions(projectId);
  const membersQuery = useProjectMembers(projectId);
  const auditQuery = useProjectAudit(projectId);

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
          <>
            {canUpdate ? (
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditOpen(true)}>
                <Pencil className="size-4" aria-hidden /> ویرایش
              </Button>
            ) : null}
            {canDuplicate ? (
              <Button variant="outline" size="sm" className="gap-2" onClick={() => duplicate.mutate()} disabled={duplicate.isPending}>
                {duplicate.isPending ? <Spinner /> : <Copy className="size-4" aria-hidden />} تکثیر
              </Button>
            ) : null}
            {canArchive ? (
              project.status === "archived" ? (
                <Button variant="outline" size="sm" className="gap-2" onClick={() => archive.mutate(false)} disabled={archive.isPending}>
                  <ArchiveRestore className="size-4" aria-hidden /> خروج از بایگانی
                </Button>
              ) : (
                <Button variant="outline" size="sm" className="gap-2 text-red-600 dark:text-red-400" onClick={() => setConfirmArchive(true)}>
                  <Archive className="size-4" aria-hidden /> بایگانی
                </Button>
              )
            ) : null}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={project.status} />
        {project.isDemo ? <DemoBadge /> : null}
        <ReadinessChips readiness={project.readiness} />
        <Badge variant="secondary" className="gap-1">
          <FileClock className="size-3" aria-hidden /> پیکربندی فعال: {project.currentConfigVersion?.semver ?? "—"}
        </Badge>
        {project.myRole ? (
          <Badge variant="outline">نقش شما: {PROJECT_ROLE_LABELS_FA[project.myRole]}</Badge>
        ) : null}
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">نمای کلی</TabsTrigger>
          <TabsTrigger value="versions">نسخه‌های پیکربندی ({project.configVersionCount})</TabsTrigger>
          <TabsTrigger value="members">اعضا ({project.memberCount})</TabsTrigger>
          {canReadAudit ? <TabsTrigger value="audit">ممیزی</TabsTrigger> : null}
        </TabsList>

        {/* ── نمای کلی ── */}
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
                <CardTitle className="text-base">پروفایل روش‌شناختی و پیکربندی</CardTitle>
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
                  تغییرات ساختاری آینده (خانواده‌ها، پارامترها، فرمول‌ها) در فاز ۲ به‌صورت نسخه‌های جدید append-only ثبت
                  می‌شوند؛ نسخه‌های قبلی برای بازتولید نتایج حفظ می‌شوند.
                </p>
                <div className="rounded-lg border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">
                  بخش‌های بعدی محصول روی همین پروژه ساخته می‌شوند: کارگاه پیکربندی پویا (فاز ۲)، نمودارهای OPC/FPC
                  (فاز ۳)، کرنومتر (فاز ۴)، تحلیل (فاز ۵) و بالانس خط (فاز ۶).
                </div>
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
                  نقش‌ها: مالک (همه)، ویرایشگر (پیکربندی/داده)، ثبت‌کننده (مشاهدات — فاز ۴)، ببیننده (گزارش‌ها)
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
              <pre className="whitespace-pre-wrap p-3 text-left text-[11px] leading-relaxed" dir="ltr">
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
          {canManage ? <TableHead className="text-left">عملیات</TableHead> : null}
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
                  <SelectTrigger className="h-8 w-32" aria-label={`نقش ${m.name ?? m.email}`}>
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
              <TableCell className="text-left">
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
                <SelectItem value="recorder">ثبت‌کننده — ثبت مشاهدات (فاز ۴)</SelectItem>
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
