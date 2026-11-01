"use client";

/**
 * کارگاه بالانس خط و نیروی کار — فاز ۶ (B10).
 * ۸ تب: سناریوها · Yamazumi · گراف تقدم · ماتریس تخصیص · شاخص‌ها · مقایسه · گزارش‌ها · راهنما.
 * ورودی: فعالیت‌های پروژه (B5) + زمان‌های تحلیل فاز ۵ (B4) یا بازتنظیم دستی.
 */

import { useState } from "react";
import { BookOpen, GitBranch, Grid3x3, LayoutList, Scale, BarChart3, FileDown, Info } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingBlock, PageHeader } from "@/components/app/ui-bits";
import { useBalanceOverview, useBalanceScenario } from "@/hooks/use-balance";
import { ScenariosTab } from "./scenarios-tab";
import { YamazumiTab } from "./yamazumi-tab";
import { PrecedenceTab } from "./precedence-tab";
import { MatrixTab } from "./matrix-tab";
import { MetricsTab } from "./metrics-tab";
import { CompareTab } from "./compare-tab";
import { ReportsTab } from "./reports-tab";
import { GuideTab } from "./guide-tab";

interface BalanceWorkshopViewProps {
  projectId: string;
  onBack: () => void;
  onTitle?: (title: string) => void;
  onOpenAnalysis: () => void;
}

const TABS = [
  { key: "scenarios", labelFa: "سناریوها", icon: LayoutList },
  { key: "yamazumi", labelFa: "یامازومی", icon: BarChart3 },
  { key: "precedence", labelFa: "گراف تقدم", icon: GitBranch },
  { key: "matrix", labelFa: "ماتریس تخصیص", icon: Grid3x3 },
  { key: "metrics", labelFa: "شاخص‌ها", icon: Scale },
  { key: "compare", labelFa: "مقایسه", icon: LayoutList },
  { key: "reports", labelFa: "گزارش‌ها", icon: FileDown },
  { key: "guide", labelFa: "راهنما", icon: BookOpen },
] as const;

export type BalanceTabKey = (typeof TABS)[number]["key"];

export function BalanceWorkshopView({ projectId, onBack, onOpenAnalysis }: BalanceWorkshopViewProps) {
  const overview = useBalanceOverview(projectId);
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [tab, setTab] = useState<BalanceTabKey>("scenarios");

  const activeScenarioId = scenarioId ?? overview.data?.scenarios[0]?.id ?? null;
  const scenario = useBalanceScenario(projectId, activeScenarioId);

  const noActivities = (overview.data?.readiness.activitiesActive ?? 0) === 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="کارگاه بالانس خط و نیروی کار"
        description="تخصیص فعالیت‌ها به ایستگاه‌ها با الگوریتم‌های LCR / RPW / کیلبریج–وستر، تاکت‌تایم، نمودار یامازومی، شاخص‌های راندمان و برآورد نیرو — از زمان‌های واقعی تحلیل فاز ۵."
        actions={
          <Button variant="outline" onClick={onBack} className="gap-2">
            بازگشت به پروژه
          </Button>
        }
      />

      {overview.isLoading ? (
        <LoadingBlock lines={6} />
      ) : overview.isError ? (
        <ErrorState message={(overview.error as Error)?.message ?? "خطا در بارگذاری بالانس."} onRetry={() => void overview.refetch()} />
      ) : noActivities ? (
        <EmptyState
          title="هنوز فعالیتی برای بالانس تعریف نشده است"
          description="بالانس خط از فعالیت‌های پروژه (مدل B5) و زمان‌های تحلیل‌شده تغذیه می‌شود: ابتدا در کارگاه پیکربندی فعالیت‌ها را با پیش‌نیازها تعریف کنید و در کارگاه زمان‌سنجی اندازه‌گیری کنید (یا از بازتنظیم دستی زمان در سناریو استفاده کنید)."
          action={
            <Button onClick={onOpenAnalysis} variant="outline" className="gap-2">
              <Info className="size-4" aria-hidden /> مشاهده وضعیت تحلیل زمان
            </Button>
          }
        />
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as BalanceTabKey)}>
          <TabsList className="flex-wrap">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <TabsTrigger key={t.key} value={t.key} className="gap-1.5 text-xs">
                  <Icon className="size-3.5" aria-hidden />
                  {t.labelFa}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="scenarios" className="mt-4">
            <ScenariosTab
              projectId={projectId}
              overview={overview.data}
              selectedId={activeScenarioId}
              onSelect={(id) => {
                setScenarioId(id);
                setTab("yamazumi");
              }}
            />
          </TabsContent>
          <TabsContent value="yamazumi" className="mt-4">
            <YamazumiTab projectId={projectId} scenario={scenario.data} isLoading={scenario.isLoading} isError={scenario.isError} onRetry={() => void scenario.refetch()} />
          </TabsContent>
          <TabsContent value="precedence" className="mt-4">
            <PrecedenceTab scenario={scenario.data} isLoading={scenario.isLoading} isError={scenario.isError} onRetry={() => void scenario.refetch()} />
          </TabsContent>
          <TabsContent value="matrix" className="mt-4">
            <MatrixTab projectId={projectId} scenario={scenario.data} isLoading={scenario.isLoading} isError={scenario.isError} onRetry={() => void scenario.refetch()} />
          </TabsContent>
          <TabsContent value="metrics" className="mt-4">
            <MetricsTab scenario={scenario.data} isLoading={scenario.isLoading} isError={scenario.isError} onRetry={() => void scenario.refetch()} />
          </TabsContent>
          <TabsContent value="compare" className="mt-4">
            <CompareTab scenario={scenario.data} isLoading={scenario.isLoading} isError={scenario.isError} onRetry={() => void scenario.refetch()} />
          </TabsContent>
          <TabsContent value="reports" className="mt-4">
            <ReportsTab projectId={projectId} scenarioId={activeScenarioId} scenario={scenario.data} />
          </TabsContent>
          <TabsContent value="guide" className="mt-4">
            <GuideTab overview={overview.data} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
