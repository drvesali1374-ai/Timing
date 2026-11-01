"use client";

/**
 * تب کیفیت نمونه — CV، فاصله اطمینان و کفایت حجم نمونه (ST-010) هر عنصر (B9).
 * فرض‌های آماری صریح نمایش داده می‌شوند — ادعای قطعیت بدون فرض نمی‌شود.
 */

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AnalysisDto } from "@/shared/contracts/analysis";
import { faDigits, fmtSec, HonestyWarnings, MethodNotes } from "./analysis-bits";

export function QualityTab({ analysis }: { analysis: AnalysisDto | undefined }) {
  if (!analysis) return null;

  const cvData = analysis.elements
    .filter((e) => e.quality.cv !== null)
    .map((e) => ({ key: e.elementName.slice(0, 18), cvPct: Number(((e.quality.cv as number) * 100).toFixed(1)), elementKey: e.elementKey }))
    .sort((a, b) => b.cvPct - a.cvPct);

  return (
    <div className="space-y-4">
      <Card className="py-0">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">ضریب تغییرات عناصر (CV٪) — s ÷ x̄</CardTitle>
          <p className="text-[11px] text-muted-foreground">
            CV بالاتر = پراکندگی نسبی بیشتر = نیازمند مشاهده بیشتر برای همان دقت (ST-010). مقادیر بر مشاهدات قابل استفاده هستند.
          </p>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {cvData.length > 0 ? (
            <div className="h-56" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cvData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="key" tick={{ fontSize: 10 }} interval={0} angle={-20} height={50} textAnchor="end" />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ direction: "rtl", fontSize: 12 }}
                    formatter={(value: number) => [`${value.toFixed(1)}%`, "CV"]}
                  />
                  <Bar dataKey="cvPct" radius={[4, 4, 0, 0]}>
                    {cvData.map((d, i) => (
                      <Cell key={i} fill={d.cvPct > 30 ? "hsl(var(--chart-5))" : d.cvPct > 15 ? "hsl(var(--chart-3))" : "hsl(var(--chart-2))"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-8 text-center text-xs text-muted-foreground">CV برای هیچ عنصری تعریف نشده است (n &lt; ۲ یا میانگین صفر).</p>
          )}
        </CardContent>
      </Card>

      <Card className="py-0">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">فاصله اطمینان و کفایت نمونه — سطح {faDigits(analysis.settings.confidencePct)}٪، دقت هدف {faDigits(analysis.settings.targetPrecisionPct)}٪</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">عنصر</TableHead>
                  <TableHead className="text-right">n مؤثر</TableHead>
                  <TableHead className="text-right">CV</TableHead>
                  <TableHead className="text-right">CI نیم‌عرض (s)</TableHead>
                  <TableHead className="text-right">n لازم (ST-010)</TableHead>
                  <TableHead className="text-right">قضاوت</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analysis.elements.map((e) => (
                  <TableRow key={e.elementKey}>
                    <TableCell className="max-w-40 truncate py-2 text-xs" title={e.elementKey}>{e.elementName}</TableCell>
                    <TableCell className="py-2 font-mono text-xs tabular-nums">{faDigits(e.counts.effective)}</TableCell>
                    <TableCell className="py-2 font-mono text-xs tabular-nums" dir="ltr">
                      {e.quality.cv !== null ? `${(e.quality.cv * 100).toFixed(1)}%` : "—"}
                    </TableCell>
                    <TableCell className="py-2 font-mono text-xs tabular-nums" dir="ltr">{fmtSec(e.quality.ci?.halfWidth ?? null)}</TableCell>
                    <TableCell className="py-2 font-mono text-xs tabular-nums">
                      {e.quality.adequacy?.requiredN !== null && e.quality.adequacy?.requiredN !== undefined ? faDigits(e.quality.adequacy.requiredN) : "—"}
                    </TableCell>
                    <TableCell className="py-2 text-xs">
                      {e.quality.adequacy?.sufficient === true ? (
                        <Badge variant="outline" className="text-[10px] text-emerald-700">کافی</Badge>
                      ) : e.quality.adequacy?.sufficient === false ? (
                        <Badge variant="outline" className="text-[10px] text-amber-700">نیازمند مشاهده بیشتر</Badge>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">نامتعین</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <MethodNotes
            notes={[
              `CI: x̄ ± z·s/√n با z=${analysis.settings.confidencePct === 90 ? "۱٫۶۴۵" : analysis.settings.confidencePct === 95 ? "۱٫۹۶" : "۲٫۵۷۶"} — تقریب نرمال؛ برای n<۳۰ تقریب خشن است و فرض نمونه تصادفی/مستقل لازم است.`,
              "کفایت نمونه: n_req = (z·CV ÷ e)² — «جهت قضاوت» است، نه سقف قطعی؛ CV واقعی نامعلوم است (ST-010).",
            ]}
            className="mt-3"
          />
          <HonestyWarnings warnings={analysis.elements.flatMap((e) => e.quality.warningsFa).slice(0, 5)} className="mt-2" />
        </CardContent>
      </Card>
    </div>
  );
}
