"use client";

/**
 * ریشه برنامه (SPA تک‌صفحه‌ای) — مسیرها به‌صورت نما:
 *  ورود/ثبت‌نام → داشبورد پروژه‌ها → ایجاد پروژه → جزئیات پروژه → کارگاه پیکربندی.
 * ناوبری داخلی با state (محیط پیش‌نمایش تک-مسیر).
 */
import { useCallback, useState } from "react";
import { AppProviders } from "@/components/app/providers";
import { AuthView } from "@/components/app/auth-view";
import { AppShell, type ViewName } from "@/components/app/app-shell";
import { DashboardView } from "@/components/app/dashboard-view";
import { NewProjectView } from "@/components/app/new-project-view";
import { ProjectDetailView } from "@/components/app/project-detail-view";
import { ConfigWorkshopView } from "@/components/app/config/config-workshop-view";
import { DiagramWorkshopView } from "@/components/app/diagrams/diagram-workshop-view";
import { useSession } from "@/hooks/use-api";
import { LoadingBlock } from "@/components/app/ui-bits";

interface Route {
  name: ViewName;
  projectId?: string;
}

function AppRoot() {
  const session = useSession();
  const [route, setRoute] = useState<Route>({ name: "dashboard" });
  const [projectTitle, setProjectTitle] = useState<string | null>(null);

  const navigate = useCallback((view: ViewName, projectId?: string) => {
    setRoute({ name: view, projectId });
    if (view !== "project" && view !== "project-config" && view !== "project-diagrams") setProjectTitle(null);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }, []);

  if (session.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-md">
          <LoadingBlock lines={4} />
        </div>
      </div>
    );
  }

  // بدون نشست → نمای ورود/ثبت‌نام
  if (!session.data) {
    return <AuthView />;
  }

  return (
    <AppShell user={session.data} view={route.name} onNavigate={navigate} projectTitle={projectTitle}>
      {route.name === "dashboard" ? (
        <DashboardView
          onOpenProject={(id) => navigate("project", id)}
          onNewProject={() => navigate("new-project")}
        />
      ) : route.name === "new-project" ? (
        <NewProjectView
          onCreated={(id) => navigate("project", id)}
          onCancel={() => navigate("dashboard")}
        />
      ) : route.name === "project" && route.projectId ? (
        <ProjectDetailView
          projectId={route.projectId}
          onBack={() => navigate("dashboard")}
          onTitle={setProjectTitle}
          onOpenConfig={() => navigate("project-config", route.projectId)}
          onOpenDiagrams={() => navigate("project-diagrams", route.projectId)}
        />
      ) : route.name === "project-config" && route.projectId ? (
        <ConfigWorkshopView
          projectId={route.projectId}
          onBack={() => navigate("project", route.projectId)}
          onTitle={setProjectTitle}
        />
      ) : route.name === "project-diagrams" && route.projectId ? (
        <DiagramWorkshopView
          projectId={route.projectId}
          onBack={() => navigate("project", route.projectId)}
          onTitle={setProjectTitle}
        />
      ) : null}
    </AppShell>
  );
}

export default function Home() {
  return (
    <AppProviders>
      <AppRoot />
    </AppProviders>
  );
}
