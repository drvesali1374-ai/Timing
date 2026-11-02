"use client";

/**
 * کارگاه تحلیل مهندسی زمان — فاز ۵ (B9/B4).
 * ۷ تب: خلاصه · مشاهدات · تحلیل عنصر · کیفیت نمونه · زنجیره زمان · گزارش‌ها · راهنما.
 * داده: فقط جلسات نهایی‌شده (قفل فاز ۴) — هیچ داده نمایشی جعلی نیست.
 */

import { useState } from "react";
import { BarChart3, BookOpen, ClipboardList, FileDown, Gauge, GitBranch, LineChart } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState, LoadingBlock, PageHeader } from "@/components/app/ui-bits";
import { AdvancedTabsMenu } from "@/components/app/advanced-tabs-menu";
import { Button } from "@/components/ui/button";
import { useAnalysis } from "@/hooks/use-analysis";
import { useSession } from "@/hooks/use-api";
import { faDigits } from "./analysis-bits";
import { SummaryTab } from "./summary-tab";
import { ObservationsTab } from "./observations-tab";
import { ElementsTab } from "./elements-tab";
import { QualityTab } from "./quality-tab";
import { ChainTab } from "./chain-tab";
import { ReportsTab } from "./reports-tab";
import { GuideTab } from "./guide-tab";

interface AnalysisWorkshopViewProps {
  projectId: string;
  onBack: () => void;
  onTitle?: (title: string) => void;
  onOpenTiming: () => void;
}

const TABS = [
  { key: "summary", labelFa: "خلاصه", icon: Gauge },
  { key: "observations", labelFa: "مشاهدات", icon: ClipboardList },
  { key: "elements", labelFa: "تحلیل عنصر", icon: BarChart3 },
  { key: "chain", labelFa: "زنجیره زمان", icon: GitBranch },
  { key: "reports", labelFa: "گزارش‌ها", icon: FileDown },
] as const;

/** تب‌های تخصصی — در منوی «جزئیات پیشرفته» (بند ۱۰؛ بدون حذف قابلیت) */
const ADVANCED_TABS = [
  { key: "quality", labelFa: "کیفیت نمونه", icon: LineChart },
  { key: "guide", labelFa: "راهنمای تحلیل", icon: BookOpen },
] as const;

export type AnalysisTabKey = (typeof TABS)[number]["key"] | (typeof ADVANCED_TABS)[number]["key"];

export function AnalysisWorkshopView({ projectId, onBack, onTitle, onOpenTiming }: AnalysisWorkshopViewProps) {
  const session = useSession();
  const analysis = useAnalysis(projectId);
  const [tab, setTab] = useState<AnalysisTabKey>("summary");

  const canWrite = false; // سطح نقش از API جزئیات پروژه — با بررسی سرور قفل شده (403)؛ UI فقط راهنمای صادقانه

  return (
    <div className="space-y-5">
      <PageHeader
        title="کارگاه تحلیل مهندسی زمان"
        description="آمار B9، زنجیره زمان B4 (نماینده ← نرمال ← استاندارد) با ردیابی نسخه فرمول، مدیریت داده ناقص/پرت و گزارش‌های قابل اتکا — فقط از جلسات نهایی‌شده."
        actions={
          <Button variant="outline" onClick={onBack} className="gap-2">
            بازگشت به پروژه
          </Button>
        }
      />

      {analysis.isLoading ? (
        <LoadingBlock lines={6} />
      ) : analysis.isError ? (
        <ErrorState message={(analysis.error as Error)?.message ?? "خطا در بارگذاری تحلیل."} onRetry={() => void analysis.refetch()} />
      ) : (analysis.data?.sessions.length ?? 0) === 0 ? (
        <EmptyState
          title="هنوز جلسه نهایی‌شده‌ای برای تحلیل وجود ندارد"
          description="تحلیل از داده‌های نهایی‌شده تغذیه می‌شود: برگه ثبت زمان را «ارسال به تحلیل» کنید یا جلسه کرنومتری را نهایی کنید تا به‌عنوان ورودی پایدار ذخیره شود."
          action={
            <Button onClick={onOpenTiming} className="gap-2">
              <ClipboardList className="size-4" aria-hidden /> رفتن به کارگاه زمان‌سنجی
            </Button>
          }
        />
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as AnalysisTabKey)}>
          <TabsList className="flex-wrap">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <TabsTrigger key={t.key} value={t.key} className="gap-1.5 text-xs">
                  <Icon className="size-3.5" aria-hidden />
                  {t.labelFa}
                  {t.key === "observations" && analysis.data ? (
                    <span className="ms-1 rounded bg-muted px-1 font-mono text-[9px]">
                      {faDigits(analysis.data.elements.reduce((a, e) => a + e.counts.total, 0))}
                    </span>
                  ) : null}
                </TabsTrigger>
              );
            })}
            <AdvancedTabsMenu tabs={ADVANCED_TABS} activeKey={tab} onSelect={(k) => setTab(k as AnalysisTabKey)} />
          </TabsList>

          <TabsContent value="summary" className="mt-4">
            <SummaryTab analysis={analysis.data} />
          </TabsContent>
          <TabsContent value="observations" className="mt-4">
            <ObservationsTab projectId={projectId} analysis={analysis.data} signedIn={!!session.data} />
          </TabsContent>
          <TabsContent value="elements" className="mt-4">
            <ElementsTab analysis={analysis.data} />
          </TabsContent>
          <TabsContent value="quality" className="mt-4">
            <QualityTab analysis={analysis.data} />
          </TabsContent>
          <TabsContent value="chain" className="mt-4">
            <ChainTab analysis={analysis.data} />
          </TabsContent>
          <TabsContent value="reports" className="mt-4">
            <ReportsTab projectId={projectId} analysis={analysis.data} canWrite={canWrite} />
          </TabsContent>
          <TabsContent value="guide" className="mt-4">
            <GuideTab analysis={analysis.data} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
