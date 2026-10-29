"use client";

import { useState } from "react";

import { PrototypeShell } from "@/components/prototype/shell";
import { DashboardView } from "@/components/prototype/views/dashboard";
import { NewProjectView } from "@/components/prototype/views/new-project";
import { ConfigView } from "@/components/prototype/views/config";
import { TimingView } from "@/components/prototype/views/timing";
import { DiagramsView } from "@/components/prototype/views/diagrams";
import { AnalysisView } from "@/components/prototype/views/analysis";
import { BalanceView } from "@/components/prototype/views/balance";
import { ReportsView } from "@/components/prototype/views/reports";
import type { ViewId } from "@/components/prototype/data";

export default function Home() {
  const [view, setView] = useState<ViewId>("dashboard");

  return (
    <PrototypeShell current={view} onNavigate={setView}>
      {view === "dashboard" ? <DashboardView onNavigate={setView} /> : null}
      {view === "new-project" ? <NewProjectView onNavigate={setView} /> : null}
      {view === "config" ? <ConfigView /> : null}
      {view === "timing" ? <TimingView /> : null}
      {view === "diagrams" ? <DiagramsView /> : null}
      {view === "analysis" ? <AnalysisView /> : null}
      {view === "balance" ? <BalanceView /> : null}
      {view === "reports" ? <ReportsView /> : null}
    </PrototypeShell>
  );
}
