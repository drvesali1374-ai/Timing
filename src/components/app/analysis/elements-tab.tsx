"use client";

/**
 * تب تحلیل عنصر — آمار تفصیلی هر عنصر + هیستوگرام/روند (B9 بند ۱/۶).
 * نمودارها با recharts؛ فیلتر عنصر + تفکیک جلسه/زمینه سفارشی.
 */

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AnalysisDto } from "@/shared/contracts/analysis";
import { faDigits, fmtSec, HonestyWarnings, MethodNotes, OutlierRuleBadge, StepStatusBadge } from "./analysis-bits";

export function ElementsTab({ analysis }: { analysis: AnalysisDto | undefined }) {
  const [selected, setSelected] = useState<string>("first");
  const [groupDim, setGroupDim] = useState<string>("none");

  const element = useMemo(() => {
    if (!analysis || analysis.elements.length === 0) return null;
    if (selected === "first") return analysis.elements[0];
    return analysis.elements.find((e) => e.elementKey === selected) ?? analysis.elements[0];
  }, [analysis, selected]);

  const histogramData = useMemo(() => {
    if (!element?.histogram) return [];
    return element.histogram.bins.map((b, i) => ({
      bin: `${b.from.toFixed(1)}–${b.to.toFixed(1)}`,
      count: b.count,
      idx: i,
    }));
  }, [element]);

  const trendData = useMemo(() => {
    if (!element) return [];
    return element.observations
      .filter((o) => o.cycleStatus !== "incomplete" && !o.mark?.excluded)
      .map((o, i) => ({
        idx: i + 1,
        cycle: o.cycleSeq,
        sec: Number((o.durationMs / 1000).toFixed(3)),
        session: o.sessionId.slice(0, 6),
        outlier: !!o.mark?.outlierMarked,
      }));
  }, [element]);

  const groupingData = useMemo(() => {
    if (!element || groupDim === "none") return [];
    const groups = new Map<string, number[]>();
    for (const o of element.observations) {
      if (o.cycleStatus === "incomplete" || o.mark?.excluded) continue;
      const key =
        groupDim === "session"
          ? o.sessionId.slice(0, 6)
          : groupDim === "observer"
            ? o.observer
            : groupDim === "method"
              ? o.sessionMethod
              : (o.sessionContext[groupDim] ?? "—");
      const arr = groups.get(key) ?? [];
      arr.push(o.durationMs / 1000);
      groups.set(key, arr);
    }
    return [...groups.entries()]
      .map(([key, xs]) => ({ key, mean: Number((xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(3)), n: xs.length }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [element, groupDim]);

  const contextDims = useMemo(() => {
    if (!analysis) return [] as string[];
    const keys = new Set<string>();
    for (const s of analysis.sessions) for (const k of Object.keys(s.sessionContext)) keys.add(k);
    return [...keys];
  }, [analysis]);

  if (!analysis || !element) return null;

  return (
    <div className="space-y-4">
      {/* انتخاب عنصر */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-[11px]">عنصر</Label>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              {analysis.elements.map((e) => (
                <SelectItem key={e.elementKey} value={e.elementKey}>
                  {e.elementName} ({faDigits(e.counts.effective)}/{faDigits(e.counts.total)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Badge variant="secondary" className="text-[10px]">کلید: {element.elementKey}</Badge>
        {element.nameVariants.length > 1 ? (
          <Badge variant="outline" className="text-[10px]" title={element.nameVariants.join(" | ")}>
            {faDigits(element.nameVariants.length)} نام در جلسات
          </Badge>
        ) : null}
        {element.outlierDetection ? (
          <OutlierRuleBadge rule={element.outlierDetection.rule} sourceFa={element.outlierDetection.sourceFa} />
        ) : null}
      </div>

      {/* شمارش‌های شفافیت */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { k: "کل", v: element.counts.total },
          { k: "قابل استفاده", v: element.counts.usable },
          { k: "n مؤثر", v: element.counts.effective },
          { k: "حذف کاربر", v: element.counts.userExcluded },
          { k: "چرخه ناتمام", v: element.counts.incompleteCycle },
          { k: "مشکوک قاعده", v: element.counts.ruleSuspect },
        ].map((c) => (
          <div key={c.k} className="rounded-lg border bg-card p-2 text-center">
            <p className="text-[10px] text-muted-foreground">{c.k}</p>
            <p className="font-mono text-base font-bold tabular-nums">{faDigits(c.v)}</p>
          </div>
        ))}
      </div>

      {/* آمار توصیفی */}
      <Card className="py-0">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">آمار توصیفی (B9) — روی مشاهدات قابل استفاده</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">n</TableHead>
                <TableHead className="text-right">میانگین (s)</TableHead>
                <TableHead className="text-right">میانه (s)</TableHead>
                <TableHead className="text-right">کمینه (s)</TableHead>
                <TableHead className="text-right">بیشینه (s)</TableHead>
                <TableHead className="text-right">انحراف معیار (s)</TableHead>
                <TableHead className="text-right">CV</TableHead>
                <TableHead className="text-right">Q1 / Q3 (s)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="py-2 font-mono text-xs tabular-nums">{faDigits(element.stats.n)}</TableCell>
                <TableCell className="py-2 font-mono text-xs tabular-nums" dir="ltr">{fmtSec(element.stats.mean)}</TableCell>
                <TableCell className="py-2 font-mono text-xs tabular-nums" dir="ltr">{fmtSec(element.stats.median)}</TableCell>
                <TableCell className="py-2 font-mono text-xs tabular-nums" dir="ltr">{fmtSec(element.stats.min)}</TableCell>
                <TableCell className="py-2 font-mono text-xs tabular-nums" dir="ltr">{fmtSec(element.stats.max)}</TableCell>
                <TableCell className="py-2 font-mono text-xs tabular-nums" dir="ltr">{fmtSec(element.stats.stddev)}</TableCell>
                <TableCell className="py-2 font-mono text-xs tabular-nums" dir="ltr">
                  {element.stats.cv !== null ? `${(element.stats.cv * 100).toFixed(1)}%` : "—"}
                </TableCell>
                <TableCell className="py-2 font-mono text-xs tabular-nums" dir="ltr">
                  {fmtSec(element.stats.q1)} / {fmtSec(element.stats.q3)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          {element.outlierDetection ? (
            <p className="mt-2 text-[11px] text-muted-foreground">
              تشخیص پرت: {element.outlierDetection.boundsFa} — {faDigits(element.counts.ruleSuspect)} مورد مشکوک (شناسایی، نه حذف).
            </p>
          ) : (
            <p className="mt-2 text-[11px] text-muted-foreground">مشاهدات برای حصار قاعده پرت کافی نیست (n &lt; ۴).</p>
          )}
          <HonestyWarnings warnings={element.quality.warningsFa} className="mt-3" />
        </CardContent>
      </Card>

      {/* نمودارها */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="py-0">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">هیستوگرام توزیع (ثانیه)</CardTitle>
            {element.histogram ? <p className="text-[11px] text-muted-foreground">{element.histogram.methodFa}</p> : null}
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {histogramData.length > 0 ? (
              <div className="h-56" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={histogramData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="bin" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ direction: "rtl", fontSize: 12 }}
                      formatter={(value: number) => [`${faDigits(value)} مشاهده`, "فراوانی"]}
                    />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-8 text-center text-xs text-muted-foreground">برای هیستوگرام حداقل ۲ مشاهده لازم است.</p>
            )}
          </CardContent>
        </Card>

        <Card className="py-0">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">روند به ترتیب ثبت (چرخه‌ها)</CardTitle>
            <p className="text-[11px] text-muted-foreground">مشاهدات مشکوک/حذف‌شده رنگ متفاوت دارند — کورکورانه پنهان نمی‌شوند.</p>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {trendData.length > 0 ? (
              <div className="h-56" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="idx" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
                    <Tooltip
                      contentStyle={{ direction: "rtl", fontSize: 12 }}
                      formatter={(value: number) => [`${value.toFixed(3)} s`, "مدت"]}
                    />
                    <Line type="monotone" dataKey="sec" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-8 text-center text-xs text-muted-foreground">مشاهده قابل نمایشی وجود ندارد.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* تفکیک بر اساس پارامتر — بند ۶ */}
      <Card className="py-0">
        <CardHeader className="flex flex-wrap items-center justify-between gap-2 p-4 pb-2">
          <CardTitle className="text-sm">تفکیک آماری (گروه‌بندی)</CardTitle>
          <div className="w-56 space-y-1">
            <Label className="text-[11px]">بُعد تفکیک</Label>
            <Select value={groupDim} onValueChange={setGroupDim}>
              <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون تفکیک</SelectItem>
                <SelectItem value="session">جلسه</SelectItem>
                <SelectItem value="observer">ناظر</SelectItem>
                <SelectItem value="method">روش ثبت</SelectItem>
                {contextDims.map((k) => (
                  <SelectItem key={k} value={k}>{k}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {groupDim === "none" ? (
            <p className="text-xs text-muted-foreground">
              بُعد تفکیک انتخاب کنید (جلسه/ناظر/روش/پارامتر زمینه سفارشی) — مقایسه دوره/روش/ایستگاه (B9).
            </p>
          ) : groupingData.length > 0 ? (
            <div className="space-y-3">
              <div className="h-40" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={groupingData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="key" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ direction: "rtl", fontSize: 12 }}
                      formatter={(value: number, _name, item) => [`${value.toFixed(3)} s (n=${(item?.payload as { n: number }).n})`, "میانگین"]}
                    />
                    <Bar dataKey="mean" radius={[4, 4, 0, 0]}>
                      {groupingData.map((g, i) => (
                        <Cell key={i} fill={`hsl(var(--chart-${(i % 5) + 1}))`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">گروه</TableHead>
                    <TableHead className="text-right">n</TableHead>
                    <TableHead className="text-right">میانگین (s)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupingData.map((g) => (
                    <TableRow key={g.key}>
                      <TableCell className="py-2 text-xs">{g.key}</TableCell>
                      <TableCell className="py-2 font-mono text-xs tabular-nums">{faDigits(g.n)}</TableCell>
                      <TableCell className="py-2 font-mono text-xs tabular-nums" dir="ltr">{g.mean.toFixed(3)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">داده‌ای برای این بُعد ثبت نشده — زمینه جلسه را از تب «مشاهدات» ثبت کنید.</p>
          )}
        </CardContent>
      </Card>

      {/* وضعیت زنجیره این عنصر + فرمول‌ها */}
      <Card className="py-0">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">زنجیره و فرمول‌های این عنصر (نسخه‌دار)</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">گام</TableHead>
                <TableHead className="text-right">مقدار (s)</TableHead>
                <TableHead className="text-right">وضعیت</TableHead>
                <TableHead className="text-right">برچسب/فرمول</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="py-2 text-xs">نماینده</TableCell>
                <TableCell className="py-2 font-mono text-xs tabular-nums" dir="ltr">{fmtSec(element.chain.representative.value)}</TableCell>
                <TableCell className="py-2"><StepStatusBadge status={element.chain.representative.status} /></TableCell>
                <TableCell className="py-2 text-[11px] text-muted-foreground">{element.chain.representative.labelFa}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="py-2 text-xs">نرمال</TableCell>
                <TableCell className="py-2 font-mono text-xs tabular-nums" dir="ltr">{fmtSec(element.chain.normal.value)}</TableCell>
                <TableCell className="py-2"><StepStatusBadge status={element.chain.normal.status} /></TableCell>
                <TableCell className="py-2 text-[11px] text-muted-foreground">{element.chain.normal.labelFa}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="py-2 text-xs">استاندارد</TableCell>
                <TableCell className="py-2 font-mono text-xs tabular-nums" dir="ltr">{fmtSec(element.chain.standard.value)}</TableCell>
                <TableCell className="py-2"><StepStatusBadge status={element.chain.standard.status} /></TableCell>
                <TableCell className="py-2 text-[11px] text-muted-foreground">{element.chain.standard.labelFa}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <MethodNotes
            notes={element.formulaTrace.map(
              (f) => `${f.formulaKey}@${f.formulaSemver} → ${f.status === "valid" ? `${(f.value ?? 0).toFixed(6)} ${f.unit}` : f.errorsFa.join("؛") || "تکمیل‌نشده"}`,
            )}
            className="mt-3"
          />
        </CardContent>
      </Card>
    </div>
  );
}
