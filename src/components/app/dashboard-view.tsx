"use client";

/**
 * داشبورد — مدیریت پروژه‌ها: جست‌وجو، فیلتر وضعیت/نمونه، کارت پروژه‌ها
 * با عملیات مشاهده/ویرایش/تکثیر/بایگانی (عملیات مجاز بر اساس نقش کاربر).
 */
import { useRef, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  BookOpen,
  Copy,
  Eye,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useArchiveProject, useDuplicateProject, useProjects, type ProjectFilters } from "@/hooks/use-api";
import { roleCan } from "@/shared/contracts/acl";
import type { ProjectDto } from "@/shared/contracts/api";
import { DemoBadge, EmptyState, ErrorState, FaDate, LoadingCards, MembersCount, PageHeader, ReadinessChips, Spinner, StatusBadge } from "./ui-bits";
import { ProjectEditDialog } from "./project-edit-dialog";

export function DashboardView({ onOpenProject, onNewProject }: { onOpenProject: (id: string) => void; onNewProject: () => void }) {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [status, setStatus] = useState<ProjectFilters["status"]>("all");
  const [demo, setDemo] = useState<ProjectFilters["demo"]>("include");

  // جست‌وجو با تأخیر کوتاه (debounce)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSearchChange = (value: string) => {
    setQ(value);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      setDebouncedQ(value);
    }, 350);
  };

  const query = useProjects({ q: debouncedQ, status, demo });

  return (
    <div className="space-y-6">
      <PageHeader
        title="داشبورد پروژه‌ها"
        description="پروژه‌های زمان‌سنجی خود را ایجاد، جست‌وجو و مدیریت کنید."
        actions={
          <Button onClick={onNewProject} className="gap-2">
            <FolderPlus className="size-4" aria-hidden /> پروژه جدید
          </Button>
        }
      />

      {/* فیلترها */}
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={q}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="جست‌وجو در عنوان، کد، محصول، خط، مسئول…"
            className="pr-9"
            aria-label="جست‌وجوی پروژه‌ها"
          />
        </div>
        <Tabs value={status} onValueChange={(v) => setStatus(v as ProjectFilters["status"])}>
          <TabsList>
            <TabsTrigger value="all">همه</TabsTrigger>
            <TabsTrigger value="active">فعال</TabsTrigger>
            <TabsTrigger value="archived">بایگانی</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Switch id="demo-filter" checked={demo === "only"} onCheckedChange={(v) => setDemo(v ? "only" : "include")} />
          <Label htmlFor="demo-filter" className="text-xs font-normal text-muted-foreground">
            فقط نمونه‌های آموزشی
          </Label>
        </div>
      </div>

      {/* محتوا */}
      {query.isLoading ? (
        <LoadingCards />
      ) : query.isError ? (
        <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />
      ) : !query.data || query.data.items.length === 0 ? (
        <EmptyState
          title={debouncedQ ? "پروژه‌ای یافت نشد" : "هنوز پروژه‌ای ندارید"}
          description={
            debouncedQ
              ? "عبارت جست‌وجو را تغییر دهید یا فیلترها را بازنشانی کنید."
              : "اولین پروژه زمان‌سنجی خود را با پروفایل روش‌شناختی آماده بسازید؛ یا با حساب نمونه آموزشی وارد شوید و محصول را ببینید."
          }
          action={
            !debouncedQ ? (
              <Button onClick={onNewProject} variant="outline" className="gap-2">
                <FolderPlus className="size-4" aria-hidden /> ساخت اولین پروژه
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {query.data.items.map((p) => (
            <ProjectCard key={p.id} project={p} onOpen={() => onOpenProject(p.id)} onNewProject={onNewProject} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({
  project,
  onOpen,
  onNewProject,
}: {
  project: ProjectDto;
  onOpen: () => void;
  onNewProject: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const archive = useArchiveProject(project.id);
  const duplicate = useDuplicateProject(project.id);

  const canUpdate = roleCan(project.myRole ?? "viewer", "project:update");
  const canArchive = roleCan(project.myRole ?? "viewer", "project:archive");
  const canDuplicate = roleCan(project.myRole ?? "viewer", "project:duplicate");

  return (
    <Card
      className={
        project.isDemo
          ? "border-amber-200 bg-amber-50/40 dark:border-amber-900 dark:bg-amber-950/20"
          : "transition-shadow hover:shadow-md"
      }
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              <span className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[11px] font-semibold text-secondary-foreground" dir="ltr">
                {project.code}
              </span>
              {project.isDemo ? <DemoBadge /> : null}
            </div>
            <button
              onClick={onOpen}
              className="line-clamp-2 text-right text-base font-semibold leading-snug hover:text-primary hover:underline"
              title={project.title}
            >
              {project.title}
            </button>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <StatusBadge status={project.status} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8" aria-label="عملیات پروژه">
                  <MoreHorizontal className="size-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={onOpen} className="gap-2">
                  <Eye className="size-4" aria-hidden /> مشاهده جزئیات
                </DropdownMenuItem>
                {canUpdate ? (
                  <DropdownMenuItem onClick={() => setEditOpen(true)} className="gap-2">
                    <Pencil className="size-4" aria-hidden /> ویرایش اطلاعات
                  </DropdownMenuItem>
                ) : null}
                {canDuplicate ? (
                  <DropdownMenuItem onClick={() => duplicate.mutate()} className="gap-2" disabled={duplicate.isPending}>
                    {duplicate.isPending ? <Spinner /> : <Copy className="size-4" aria-hidden />} تکثیر پروژه
                  </DropdownMenuItem>
                ) : null}
                {canArchive ? (
                  <>
                    <DropdownMenuSeparator />
                    {project.status === "archived" ? (
                      <DropdownMenuItem onClick={() => archive.mutate(false)} className="gap-2" disabled={archive.isPending}>
                        {archive.isPending ? <Spinner /> : <ArchiveRestore className="size-4" aria-hidden />} خروج از بایگانی
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => archive.mutate(true)} className="gap-2" disabled={archive.isPending}>
                        {archive.isPending ? <Spinner /> : <Archive className="size-4" aria-hidden />} بایگانی
                      </DropdownMenuItem>
                    )}
                  </>
                ) : null}
                {!canUpdate && !canArchive && !canDuplicate ? (
                  <DropdownMenuItem disabled>عملیاتی برای نقش شما موجود نیست</DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pb-3">
        <ReadinessChips readiness={project.readiness} compact />
        <div className="space-y-1 text-xs text-muted-foreground">
          <p className="truncate">
            <span className="font-medium text-foreground/70">پروفایل:</span> {project.profile.templateNameFa ?? "—"}
            {project.profile.templateVersion ? ` (نسخه ${project.profile.templateVersion})` : ""}
          </p>
          <p className="truncate">
            <span className="font-medium text-foreground/70">محصول/فرایند:</span> {project.product ?? "—"}
            {project.line ? ` · خط ${project.line}` : ""}
          </p>
          <p className="truncate">
            <span className="font-medium text-foreground/70">مسئول:</span> {project.responsible ?? "—"}
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
        <MembersCount count={project.memberCount} />
        <span className="flex items-center gap-1">
          <FaDate iso={project.updatedAt} /> · پیکربندی {project.currentConfigVersion?.semver ?? "—"}
        </span>
      </CardFooter>

      {editOpen ? (
        <ProjectEditDialog
          project={project}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      ) : null}
    </Card>
  );
}

export { ProjectEditDialog };
export function DashboardHint() {
  return (
    <div className="flex items-center gap-2 rounded-md border border-dashed p-2 text-xs text-muted-foreground">
      <BookOpen className="size-4" aria-hidden />
      کارت پروژه نمونه با رنگ کهربایی مشخص می‌شود و از داده واقعی ایزوله است.
    </div>
  );
}

export function notifyNotImplemented(feature: string) {
  toast.info(`«${feature}» در فاز بعدی فعال می‌شود.`);
}
