"use client";

/**
 * پنل دستیار آفلاین (B7) — لایه الف: قواعد قطعی + کتابخانه دانش محلی.
 *  - تب «متن به نمودار»: پارسر + فرم هدایت‌شده (پاسخ پرسش‌ها) → پیش‌نویس گام‌ها (اعمال فقط با دکمه کاربر)
 *  - تب «پیشنهادها»: تحلیل قواعد؛ هیچ پیشنهادی خودکار اعمال نمی‌شود — قبول/رد/ویرایش با کاربر
 *  - تب «کتابخانه دانش»: جست‌وجوی محلی + وضعیت صادقانه لایه ب (مدل زبانی محلی)
 */

import { useMemo, useState } from "react";
import { BookOpen, BrainCircuit, Check, Lightbulb, Sparkles, Wand2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useEditorStore } from "./editor-store";
import { draftFromText, type AssistantQuestion, type DraftStep } from "@/shared/assistant/parser";
import {
  analyzeDiagram,
  proposeVariantSuggestion,
  ASSISTANT_ENGINE_VERSION,
  type AssistantSuggestion,
} from "@/shared/assistant/rules";
import { KNOWLEDGE_VERSION, searchKnowledge } from "@/shared/assistant/knowledge";
import { detectLocalModelCapability, type LocalModelStatus } from "@/lib/local-model";
import {
  FPC_SYMBOLS,
  OPC_SYMBOLS,
  FPC_SYMBOL_LABELS_FA,
  OPC_SYMBOL_LABELS_FA,
  symbolLabelFa,
  type DiagramSymbol,
  type FpcSubject,
} from "@/shared/diagrams/types";

export interface AssistantPanelProps {
  kind: "opc" | "fpc";
  knownActivityKeys: string[];
  onCreateProposedVariant: () => void;
}

export function AssistantPanel({ kind, knownActivityKeys, onCreateProposedVariant }: AssistantPanelProps) {
  return (
    <Tabs defaultValue="draft" className="h-full">
      <TabsList className="mx-4 mt-3 grid w-auto grid-cols-3">
        <TabsTrigger value="draft" className="gap-1 text-xs">
          <Wand2 className="size-3.5" aria-hidden /> متن به نمودار
        </TabsTrigger>
        <TabsTrigger value="suggest" className="gap-1 text-xs">
          <Lightbulb className="size-3.5" aria-hidden /> پیشنهادها
        </TabsTrigger>
        <TabsTrigger value="knowledge" className="gap-1 text-xs">
          <BookOpen className="size-3.5" aria-hidden /> دانش
        </TabsTrigger>
      </TabsList>

      <TabsContent value="draft" className="mt-0">
        <DraftTab kind={kind} />
      </TabsContent>
      <TabsContent value="suggest" className="mt-0">
        <SuggestTab kind={kind} knownActivityKeys={knownActivityKeys} onCreateProposedVariant={onCreateProposedVariant} />
      </TabsContent>
      <TabsContent value="knowledge" className="mt-0">
        <KnowledgeTab />
      </TabsContent>
    </Tabs>
  );
}

// ─────────────────────── تب ۱: متن به نمودار ───────────────────────

function DraftTab({ kind }: { kind: "opc" | "fpc" }) {
  const [text, setText] = useState("");
  const [subject, setSubject] = useState<FpcSubject | "">("");
  const [draft, setDraft] = useState<{ steps: DraftStep[]; questions: AssistantQuestion[]; notes: string[] } | null>(null);
  const [editedSteps, setEditedSteps] = useState<DraftStep[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const addNode = useEditorStore((s) => s.addNode);

  const symbols = kind === "opc" ? OPC_SYMBOLS : FPC_SYMBOLS;
  const labels = kind === "opc" ? OPC_SYMBOL_LABELS_FA : FPC_SYMBOL_LABELS_FA;

  const parse = () => {
    const result = draftFromText({ kind, text, subject: subject || null });
    setDraft(result);
    setEditedSteps(result.steps);
    setAnswers({});
  };

  const applySteps = () => {
    if (editedSteps.length === 0) return;
    // اعمال پاسخ‌های پرسش‌های هدایت‌شده روی گام‌ها (زمان/مسافت/نوع) — تصمیم صریح کاربر
    const answeredList = editedSteps.map((s, i) => {
      const withAnswers = { ...s };
      const timeAns = answers[`q.time-${s.sourceLine}`];
      const distAns = answers[`q.dist-${s.sourceLine}`];
      const typeAns = answers[`q.type-${s.sourceLine}`];
      if (timeAns !== undefined && timeAns !== "" && (s.timeSec === null || s.timeSec === undefined)) {
        const v = Number(timeAns);
        if (Number.isFinite(v)) withAnswers.timeSec = v;
      }
      if (distAns !== undefined && distAns !== "" && (s.distanceM === null || s.distanceM === undefined)) {
        const v = Number(distAns);
        if (Number.isFinite(v)) withAnswers.distanceM = v;
      }
      if (typeAns !== undefined && typeAns !== "") withAnswers.symbol = typeAns as DiagramSymbol;
      if (i === 0) {
        const subj = answers["q.subject"];
        if (subj && subject === "" && kind === "fpc") {
          void subj; // موضوع در سطح سند (doc.subject) توسط ایجاد/ویرایش سند تعیین می‌شود
        }
      }
      return withAnswers;
    });
    let added = 0;
    for (const step of answeredList) {
      const id = addNode(step.symbol, step.title);
      if (id) {
        added += 1;
        // مقدارهای استخراج‌شده/پاسخ‌ها را روی گره تازه اعمال می‌کنیم
        const store = useEditorStore.getState();
        store.updateNode(id, {
          timeSec: step.timeSec,
          distanceM: step.distanceM,
          origin: step.origin,
          destination: step.destination,
          note: step.note,
        });
      }
    }
    toast.success(`${added} گام به نمودار اضافه شد — پیش‌نویس؛ بازبینی و ویرایش کنید.`);
    setDraft(null);
    setText("");
    setAnswers({});
  };

  return (
    <div className="space-y-4 p-4">
      <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-[11px] leading-relaxed text-muted-foreground">
        فرایند را خط‌به‌خط بنویسید (هر خط = یک گام). زمان/مسافت با عدد و واحد تشخیص داده می‌شود؛ مثال:
        <span className="mx-1 font-mono" dir="rtl">
          «حمل از انبار به دستگاه — ۱۵ متر»
        </span>
        این تبدیل قطعیِ قاعده‌محور است (بدون مدل زبانی) و هیچ چیزی بدون تأیید شما اعمال نمی‌شود.
      </div>

      <Textarea
        rows={6}
        placeholder={"برش ورق — ۱۲ ثانیه\nحمل به دستگاه جوش — ۱۰ متر\nکنترل ابعادی — ۸ ثانیه\nانتظار برای crane — ۲ دقیقه"}
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="متن توضیح فرایند"
      />

      {kind === "fpc" ? (
        <div className="space-y-1.5">
          <Label>موضوع مطالعه (اگر معلوم است)</Label>
          <Select value={subject || "unknown"} onValueChange={(v) => setSubject(v === "unknown" ? "" : (v as FpcSubject))}>
            <SelectTrigger>
              <SelectValue placeholder="نامشخص — از من بپرس" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unknown">نامشخص — از من بپرس</SelectItem>
              <SelectItem value="material">ماده</SelectItem>
              <SelectItem value="person">فرد</SelectItem>
              <SelectItem value="equipment">تجهیزات</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <Button onClick={parse} disabled={!text.trim()} className="w-full gap-2">
        <Wand2 className="size-4" aria-hidden /> تبدیل به پیش‌نویس گام‌ها
      </Button>

      {draft ? (
        <div className="space-y-4">
          {/* پرسش‌های هدایت‌شده */}
          {draft.questions.length > 0 ? (
            <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/40">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                پرسش‌های تکمیلی ({draft.questions.length}) — پاسخ اختیاری است؛ پیش‌نویس بدون پاسخ هم ساخته می‌شود:
              </p>
              {draft.questions.map((q) => (
                <div key={q.id} className="space-y-1">
                  <p className="text-[11px] leading-relaxed text-amber-900 dark:text-amber-200">{q.messageFa}</p>
                  {q.kind === "subject" ? (
                    <Select value={answers[q.id] ?? "unknown"} onValueChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}>
                      <SelectTrigger className="h-8 text-xs" aria-label={q.messageFa}>
                        <SelectValue placeholder="پاسخ…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="material">ماده</SelectItem>
                        <SelectItem value="person">فرد</SelectItem>
                        <SelectItem value="equipment">تجهیزات</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : q.kind === "step-type" ? (
                    <Select value={answers[q.id] ?? ""} onValueChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}>
                      <SelectTrigger className="h-8 text-xs" aria-label={q.messageFa}>
                        <SelectValue placeholder="نوع درست این گام…" />
                      </SelectTrigger>
                      <SelectContent>
                        {symbols.map((s) => (
                          <SelectItem key={s} value={s}>
                            {labels[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : q.kind === "distance" || q.kind === "time" ? (
                    <Input
                      className="h-8 text-xs"
                      type="number"
                      placeholder={q.kind === "distance" ? "مسافت (متر)…" : "زمان (ثانیه)…"}
                      value={answers[q.id] ?? ""}
                      onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                      aria-label={q.messageFa}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {/* یادداشت‌های پارسر */}
          {draft.notes.map((n) => (
            <p key={n} className="text-[11px] leading-relaxed text-muted-foreground">
              • {n}
            </p>
          ))}

          {/* پیش‌نویس گام‌ها — ویرایش‌پذیر */}
          <div className="space-y-2">
            <p className="text-xs font-semibold">پیش‌نویس گام‌ها ({editedSteps.length}) — قابل ویرایش پیش از اعمال:</p>
            <ScrollArea className="max-h-72">
              <div className="space-y-1.5">
                {editedSteps.map((s, i) => (
                  <div key={s.sourceLine} className="flex items-center gap-2 rounded-md border p-2">
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{i + 1}</span>
                    <Select
                      value={s.symbol}
                      onValueChange={(v) =>
                        setEditedSteps((steps) => steps.map((st) => (st.sourceLine === s.sourceLine ? { ...st, symbol: v as DiagramSymbol } : st)))
                      }
                    >
                      <SelectTrigger className="h-8 w-28 shrink-0 text-[11px]" aria-label={`نوع گام ${i + 1}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {symbols.map((sym) => (
                          <SelectItem key={sym} value={sym}>
                            {labels[sym]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      className="h-8 flex-1 text-xs"
                      value={s.title}
                      onChange={(e) =>
                        setEditedSteps((steps) => steps.map((st) => (st.sourceLine === s.sourceLine ? { ...st, title: e.target.value } : st)))
                      }
                      aria-label={`عنوان گام ${i + 1}`}
                    />
                    <div className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
                      {s.timeSec !== null ? <Badge variant="secondary" className="text-[10px]">{s.timeSec}s</Badge> : null}
                      {s.distanceM !== null ? <Badge variant="secondary" className="text-[10px]">{s.distanceM}m</Badge> : null}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className="flex gap-2">
            <Button onClick={applySteps} disabled={editedSteps.length === 0} className="flex-1 gap-2">
              <Check className="size-4" aria-hidden /> افزودن {editedSteps.length} گام به نمودار
            </Button>
            <Button variant="outline" onClick={() => setDraft(null)}>
              <X className="size-4" aria-hidden /> انصراف
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─────────────────────── تب ۲: پیشنهادها ───────────────────────

interface SuggestionDecision {
  status: "accepted" | "rejected" | "edited";
}

function SuggestTab({
  kind,
  knownActivityKeys,
  onCreateProposedVariant,
}: {
  kind: "opc" | "fpc";
  knownActivityKeys: string[];
  onCreateProposedVariant: () => void;
}) {
  const doc = useEditorStore((s) => s.doc);
  const acceptSuggestion = useEditorStore((s) => s.acceptSuggestion);
  const rejectSuggestion = useEditorStore((s) => s.rejectSuggestion);
  const acceptedList = useEditorStore((s) => s.acceptedSuggestions);
  const [decisions, setDecisions] = useState<Record<string, SuggestionDecision>>({});

  const suggestions = useMemo(() => {
    if (!doc) return [];
    const base = analyzeDiagram(doc, { knownActivityKeys });
    const variantSug = proposeVariantSuggestion(doc);
    return variantSug ? [variantSug, ...base] : base;
  }, [doc, knownActivityKeys]);

  const decide = (s: AssistantSuggestion, status: SuggestionDecision["status"]) => {
    setDecisions((d) => ({ ...d, [s.id]: { status } }));
    if (status === "accepted") {
      acceptSuggestion({ id: s.id, version: s.engineVersion, title: s.messageFa.slice(0, 160) });
    } else {
      rejectSuggestion(s.id);
    }
  };

  if (!doc) return <p className="p-4 text-sm text-muted-foreground">نموداری برای تحلیل نیست.</p>;

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed bg-muted/30 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
        <span>
          موتور قواعد v{ASSISTANT_ENGINE_VERSION} — {suggestions.length} پیشنهاد. هیچ پیشنهادی خودکار اعمال نمی‌شود؛ تصمیم با شماست و در
          نسخه بعدی ثبت می‌شود.
        </span>
        <Badge variant="secondary" className="shrink-0">
          پذیرفته: {acceptedList.length}
        </Badge>
      </div>

      {suggestions.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border bg-emerald-50 p-3 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          <Check className="size-4 shrink-0" aria-hidden />
          پیشنهادی نیست — نمودار از نظر قواعد فعلی پاک است.
        </div>
      ) : null}

      <ScrollArea className="max-h-[420px]">
        <div className="space-y-2">
          {suggestions.map((s) => {
            const decision = decisions[s.id]?.status;
            const kindBadge =
              s.kind === "hypothesis"
                ? { label: "فرضیه قابل آزمون", cls: "border-violet-300 text-violet-700 dark:text-violet-300" }
                : s.kind === "fix"
                  ? { label: "اصلاح", cls: "border-amber-400 text-amber-700 dark:text-amber-300" }
                  : s.kind === "question"
                    ? { label: "پرسش", cls: "border-stone-300 text-stone-700 dark:text-stone-300" }
                    : { label: "بهبود", cls: "border-teal-300 text-teal-700 dark:text-teal-300" };
            return (
              <div
                key={s.id}
                className={`space-y-2 rounded-lg border p-3 ${
                  decision === "accepted"
                    ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/30"
                    : decision === "rejected"
                      ? "border-stone-200 bg-muted/40 opacity-60 dark:border-stone-800"
                      : ""
                }`}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className={`text-[10px] ${kindBadge.cls}`}>
                    {s.kind === "hypothesis" ? <Sparkles className="me-1 size-3" aria-hidden /> : null}
                    {kindBadge.label}
                  </Badge>
                  <span className="font-mono text-[9px] text-muted-foreground" dir="ltr">
                    {s.ruleId}
                  </span>
                </div>
                <p className="text-xs font-medium leading-relaxed">{s.messageFa}</p>
                <p className="rounded bg-muted/50 p-2 text-[11px] leading-relaxed text-muted-foreground">
                  <strong className="text-foreground/80">دلیل: </strong>
                  {s.reasonFa}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  <strong>منبع: </strong>
                  {s.sourceRef}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {decision === undefined ? (
                    <>
                      <Button size="sm" className="h-7 gap-1 text-[11px]" onClick={() => decide(s, "accepted")}>
                        <Check className="size-3" aria-hidden /> پذیرش
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]" onClick={() => decide(s, "rejected")}>
                        <X className="size-3" aria-hidden /> رد
                      </Button>
                      {s.ruleId === "R-HYP-VARIANT" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-7 gap-1 text-[11px]"
                          onClick={() => {
                            decide(s, "accepted");
                            onCreateProposedVariant();
                          }}
                        >
                          <Sparkles className="size-3" aria-hidden /> ایجاد نسخه پیشنهادی
                        </Button>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {decision === "accepted" ? "پذیرفته شد — در نسخه بعدی ثبت می‌شود" : "رد شد"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {kind === "fpc" ? (
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          پیشنهادهای «فرضیه» فقط برای بررسی‌اند؛ حذف تأخیر/کاهش مسافت تا با مشاهده و اندازه‌گیری واقعی آزموده نشود، نتیجه قطعی نیست
          (منشور محصول A2).
        </p>
      ) : null}
    </div>
  );
}

// ─────────────────────── تب ۳: کتابخانه دانش ───────────────────────

function KnowledgeTab() {
  const [query, setQuery] = useState("");
  const [status] = useState<LocalModelStatus>(() =>
    typeof window === "undefined" ? { available: false, reasonFa: "در حال بارگذاری…" } : detectLocalModelCapability(),
  );

  const results = useMemo(() => (query.trim() ? searchKnowledge(query) : []), [query]);

  return (
    <div className="space-y-3 p-4">
      {/* وضعیت صادقانه لایه‌ها */}
      <div className="space-y-1.5 rounded-lg border border-dashed p-3">
        <div className="flex items-center gap-2 text-xs font-medium">
          <BrainCircuit className="size-4 text-teal-600" aria-hidden />
          قواعد آفلاین فعال
          <Badge variant="secondary" className="ms-auto font-mono text-[9px]">
            v{KNOWLEDGE_VERSION}
          </Badge>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {status.available
            ? `${status.adapterFa} — ${status.noteFa}`
            : `${status.reasonFa} وضعیت: «قواعد آفلاین فعال، مدل زبانی محلی غیرفعال».`}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="kq">جست‌وجو در دانش محلی (آفلاین)</Label>
        <Input id="kq" placeholder="مثلاً: تأخیر، نماد حمل، OPC…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <ScrollArea className="max-h-[380px]">
        <div className="space-y-2">
          {query.trim() && results.length === 0 ? (
            <p className="p-2 text-xs text-muted-foreground">موردی یافت نشد — دستیار در نبود منبع معتبر، عدم قطعیت را اعلام می‌کند.</p>
          ) : null}
          {results.map((e) => (
            <div key={e.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold">{e.titleFa}</p>
                <Badge variant="outline" className="shrink-0 text-[9px]">
                  {e.category === "symbol"
                    ? "نماد"
                    : e.category === "glossary"
                      ? "واژه‌نامه"
                      : e.category === "guide"
                        ? "راهنما"
                        : e.category === "method"
                          ? "روش"
                          : "نمونه"}
                </Badge>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{e.bodyFa}</p>
              <Separator className="my-2" />
              <p className="text-[10px] text-muted-foreground">منبع: {e.sourceRef}</p>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export { symbolLabelFa };
