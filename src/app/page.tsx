"use client";

/**
 * ریشه برنامه (SPA تک‌صفحه‌ای) — مسیرها به‌صورت نما:
 *  ورود/ثبت‌نام → داشبورد پروژه‌ها → ایجاد پروژه → جزئیات پروژه → کارگاه پیکربندی.
 * ناوبری داخلی با state (محیط پیش‌نمایش تک-مسیر).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw, WifiOff } from "lucide-react";
import { AppProviders } from "@/components/app/providers";
import { AuthView } from "@/components/app/auth-view";
import { AppShell, type ViewName } from "@/components/app/app-shell";
import { DashboardView } from "@/components/app/dashboard-view";
import { NewProjectView } from "@/components/app/new-project-view";
import { ProjectDetailView } from "@/components/app/project-detail-view";
import { StationsView } from "@/components/app/stations-view";
import { ConfigWorkshopView } from "@/components/app/config/config-workshop-view";
import { DiagramWorkshopView } from "@/components/app/diagrams/diagram-workshop-view";
import { TimingWorkshopView } from "@/components/app/timing/timing-workshop-view";
import { AnalysisWorkshopView } from "@/components/app/analysis/analysis-workshop-view";
import { BalanceWorkshopView } from "@/components/app/balance/balance-workshop-view";
import { StudyGuideView } from "@/components/app/study-guide-view";
import { useSession } from "@/hooks/use-api";
import { LoadingBlock } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Route {
  name: ViewName;
  projectId?: string;
}

/**
 * دروازهٔ بارگذاری نشست — تا ۸ ثانیه اسکلتون؛ پس از آن کارت «تلاش دوباره».
 * با پایان بارگذاری unmount می‌شود تا حالت کهنه برای بار بعدی نماند.
 */
function SessionGate({ onRetry }: { onRetry: () => void }) {
  const [tooLong, setTooLong] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTooLong(true), 8_000);
    return () => clearTimeout(t);
  }, []);

  if (!tooLong) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-md">
          <LoadingBlock lines={4} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            <WifiOff className="size-6" aria-hidden />
          </div>
          <CardTitle>اتصال به سرور بیش از حد طول کشید</CardTitle>
          <CardDescription>
            احتمالاً اتصال شبکه قطع یا کند است. می‌توانید دوباره تلاش کنید یا صفحه را بازآوری کنید.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button onClick={onRetry} className="w-full gap-2">
            <RotateCcw className="size-4" aria-hidden /> تلاش دوباره
          </Button>
          <Button variant="outline" className="w-full" onClick={() => window.location.reload()}>
            بازآوری کامل صفحه
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function AppRoot() {
  const session = useSession();
  const [route, setRoute] = useState<Route>({ name: "dashboard" });
  const [projectTitle, setProjectTitle] = useState<string | null>(null);

  // پرچم بالاآمدن کلاینت برای گارد صفحه سفیدِ layout — فقط در مرورگر معنا دارد.
  useEffect(() => {
    try {
      (window as unknown as { __appBooted?: boolean }).__appBooted = true;
      (window as unknown as { __hideBootFallback?: () => void }).__hideBootFallback?.();
    } catch {
      // نادیده — فقط بهبود تجربه است
    }
  }, []);

  const navigate = useCallback((view: ViewName, projectId?: string) => {
    setRoute({ name: view, projectId });
    if (view !== "project" && view !== "project-config" && view !== "project-stations" && view !== "project-diagrams" && view !== "project-timing" && view !== "project-analysis" && view !== "project-balance" && view !== "project-guide") setProjectTitle(null);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }, []);

  // با خروج کاربر، نما به داشبورد ریست می‌شود تا ورود کاربر بعدی (همان یا متفاوت)
  // ناخواسته پروژه انتخابی کاربر قبلی را باز نکند (که برای او ۴۰۴/۴۰۳ می‌دهد).
  const hadSessionRef = useRef(false);
  useEffect(() => {
    const hasSession = !!session.data;
    if (hadSessionRef.current && !hasSession) {
      setRoute({ name: "dashboard" });
      setProjectTitle(null);
    }
    hadSessionRef.current = hasSession;
  }, [session.data]);

  // سقف زمانی بارگذاری نشست — اگر شبکه/سرور معلق بود، اسکلتون بی‌پایان
  // («صفحه سفید گیرکرده») نمایش داده نمی‌شود؛ کارت تلاش دوباره ظاهر می‌شود.
  if (session.isLoading) {
    return <SessionGate onRetry={() => void session.refetch()} />;
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
          onOpenStations={() => navigate("project-stations", route.projectId)}
          onOpenDiagrams={() => navigate("project-diagrams", route.projectId)}
          onOpenTiming={() => navigate("project-timing", route.projectId)}
          onOpenAnalysis={() => navigate("project-analysis", route.projectId)}
          onOpenBalance={() => navigate("project-balance", route.projectId)}
          onOpenGuide={() => navigate("project-guide", route.projectId)}
        />
      ) : route.name === "project-stations" && route.projectId ? (
        <StationsView
          projectId={route.projectId}
          onBack={() => navigate("project", route.projectId)}
          onOpenActivities={() => navigate("project-config", route.projectId)}
          onTitle={setProjectTitle}
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
      ) : route.name === "project-timing" && route.projectId ? (
        <TimingWorkshopView
          projectId={route.projectId}
          onBack={() => navigate("project", route.projectId)}
          onTitle={setProjectTitle}
        />
      ) : route.name === "project-analysis" && route.projectId ? (
        <AnalysisWorkshopView
          projectId={route.projectId}
          onBack={() => navigate("project", route.projectId)}
          onTitle={setProjectTitle}
          onOpenTiming={() => navigate("project-timing", route.projectId)}
        />
      ) : route.name === "project-balance" && route.projectId ? (
        <BalanceWorkshopView
          projectId={route.projectId}
          onBack={() => navigate("project", route.projectId)}
          onTitle={setProjectTitle}
          onOpenAnalysis={() => navigate("project-analysis", route.projectId)}
        />
      ) : route.name === "project-guide" && route.projectId ? (
        <StudyGuideView
          projectId={route.projectId}
          onBack={() => navigate("project", route.projectId)}
          onOpenStations={() => navigate("project-stations", route.projectId)}
          onOpenConfig={() => navigate("project-config", route.projectId)}
          onOpenDiagrams={() => navigate("project-diagrams", route.projectId)}
          onOpenTiming={() => navigate("project-timing", route.projectId)}
          onOpenAnalysis={() => navigate("project-analysis", route.projectId)}
          onOpenBalance={() => navigate("project-balance", route.projectId)}
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
