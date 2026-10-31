"use client";

/**
 * هوک‌های داده UI — TanStack Query برای state سرور + اعمال ACL مشترک.
 * (قاعده: منطق دامنه در UI ممنوع؛ این فایل فقط فراخوانی API و نقش‌هاست)
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, fetchSession, loginWithCredentials, logout } from "@/lib/auth-client";
import type {
  AuditEntryDto,
  ConfigVersionDto,
  MemberDto,
  ProfileDetailDto,
  ProfileSummaryDto,
  ProjectDto,
  ProjectListDto,
  SessionUserDto,
} from "@/shared/contracts/api";
import { roleCan, type ProjectAction } from "@/shared/contracts/acl";
import type { ProjectCreateInput } from "@/shared/validation/project";

// ─────────────── نشست ───────────────

export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: fetchSession,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      loginWithCredentials(email, password),
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("خوش آمدید! ورود با موفقیت انجام شد.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => logout(),
    onSuccess: () => {
      // کوکی نشست حذف شده؛ session دوباره واکشی می‌شود → null → نمای ورود
      qc.invalidateQueries();
      toast.info("از حساب خود خارج شدید.");
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (input: { name: string; email: string; password: string }) =>
      api<{ user: SessionUserDto; messageFa: string }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => toast.success(data.messageFa),
    onError: (e: Error) => toast.error(e.message),
  });
}

// ─────────────── پروفایل‌ها ───────────────

export function useProfiles() {
  const session = useSession();
  return useQuery({
    queryKey: ["profiles"],
    queryFn: () => api<{ items: ProfileSummaryDto[] }>("/api/profiles").then((r) => r.items),
    enabled: !!session.data,
    staleTime: 10 * 60 * 1000,
  });
}

export function useProfileDetail(id: string | null) {
  const session = useSession();
  return useQuery({
    queryKey: ["profile", id],
    queryFn: () => api<ProfileDetailDto>(`/api/profiles/${id}`),
    enabled: !!session.data && !!id,
    staleTime: 10 * 60 * 1000,
  });
}

// ─────────────── پروژه‌ها ───────────────

export interface ProjectFilters {
  q?: string;
  status: "all" | "active" | "archived" | "completed";
  demo: "include" | "exclude" | "only";
}

export function useProjects(filters: ProjectFilters) {
  const session = useSession();
  return useQuery({
    queryKey: ["projects", filters],
    queryFn: () => {
      const sp = new URLSearchParams();
      if (filters.q) sp.set("q", filters.q);
      sp.set("status", filters.status);
      sp.set("demo", filters.demo);
      return api<ProjectListDto>(`/api/projects?${sp.toString()}`);
    },
    enabled: !!session.data,
  });
}

export function useProject(id: string | null) {
  const session = useSession();
  return useQuery({
    queryKey: ["project", id],
    queryFn: () => api<ProjectDto>(`/api/projects/${id}`),
    enabled: !!session.data && !!id,
  });
}

export function useProjectVersions(id: string | null) {
  const session = useSession();
  return useQuery({
    queryKey: ["project-versions", id],
    queryFn: () =>
      api<{ items: ConfigVersionDto[] }>(`/api/projects/${id}/config-versions`).then((r) => r.items),
    enabled: !!session.data && !!id,
  });
}

export function useProjectMembers(id: string | null) {
  const session = useSession();
  return useQuery({
    queryKey: ["project-members", id],
    queryFn: () => api<{ items: MemberDto[] }>(`/api/projects/${id}/members`).then((r) => r.items),
    enabled: !!session.data && !!id,
  });
}

export function useProjectAudit(id: string | null) {
  const session = useSession();
  return useQuery({
    queryKey: ["project-audit", id],
    queryFn: () => api<{ items: AuditEntryDto[] }>(`/api/projects/${id}/audit`).then((r) => r.items),
    enabled: !!session.data && !!id,
  });
}

function useInvalidateProject(id?: string | null) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["projects"] });
    qc.invalidateQueries({ queryKey: ["project", id] });
    qc.invalidateQueries({ queryKey: ["project-versions", id] });
    qc.invalidateQueries({ queryKey: ["project-members", id] });
    qc.invalidateQueries({ queryKey: ["project-audit", id] });
  };
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProjectCreateInput) =>
      api<ProjectDto>("/api/projects", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success(`پروژه «${project.title}» با پیکربندی نسخه ${project.currentConfigVersion?.semver ?? "—"} ساخته شد.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateProject(id: string) {
  const invalidate = useInvalidateProject(id);
  return useMutation({
    mutationFn: (input: Record<string, string>) =>
      api<ProjectDto>(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: (project) => {
      invalidate();
      toast.success(`پروژه «${project.title}» به‌روزرسانی شد.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useArchiveProject(id: string) {
  const invalidate = useInvalidateProject(id);
  return useMutation({
    mutationFn: (archived: boolean) =>
      api<ProjectDto>(`/api/projects/${id}/archive`, {
        method: "POST",
        body: JSON.stringify({ archived }),
      }),
    onSuccess: (project) => {
      invalidate();
      toast.success(project.status === "archived" ? "پروژه بایگانی شد." : "پروژه از بایگانی خارج شد.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDuplicateProject(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<ProjectDto>(`/api/projects/${id}/duplicate`, { method: "POST" }),
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success(`پروژه با کد «${project.code}» تکثیر شد (پیکربندی مستقل).`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ─────────────── اعضا ───────────────

export function useAddMember(id: string) {
  const invalidate = useInvalidateProject(id);
  return useMutation({
    mutationFn: (input: { email: string; role: string }) =>
      api<MemberDto>(`/api/projects/${id}/members`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: (m) => {
      invalidate();
      toast.success(`«${m.name ?? m.email}» با نقش ${m.role === "viewer" ? "ببیننده" : m.role === "recorder" ? "ثبت‌کننده" : "ویرایشگر"} افزوده شد.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateMemberRole(id: string) {
  const invalidate = useInvalidateProject(id);
  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) =>
      api<{ ok: true }>(`/api/projects/${id}/members/${memberId}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => {
      invalidate();
      toast.success("نقش عضو تغییر کرد.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRemoveMember(id: string) {
  const invalidate = useInvalidateProject(id);
  return useMutation({
    mutationFn: (memberId: string) =>
      api<{ ok: true }>(`/api/projects/${id}/members/${memberId}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidate();
      toast.success("عضو حذف شد.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** کنترل نمایش عملیات بر اساس نقش — همان منبع حقیقت سرور (shared/contracts/acl) */
export function useCan(project: ProjectDto | undefined, action: ProjectAction): boolean {
  if (!project?.myRole) return false;
  return roleCan(project.myRole, action);
}
