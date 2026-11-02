"use client";

/**
 * دیالوگ ایجاد/ویرایش فعالیت/عنصر کاری (مدل B5).
 * رفع باگ مقداردهی اولیه ویرایش (دستورالعمل ۳٫۱ — بحرانی): در ویرایش همه فیلدها
 * با آخرین مقدار ذخیره‌شده پر می‌شوند؛ تغییر یک فیلد دیگران را بازنویسی نمی‌کند.
 * شناسه داخلی هنگام ایجاد اختیاری است — خالی = تولید خودکار (تجربه ساده ۶٫۴).
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ActivityDto, ConfigWorkType } from "@/shared/contracts/config";
import { WORK_TYPE_LABELS_FA_UI } from "@/shared/contracts/config";
import { useCreateActivity, useUpdateActivity } from "@/hooks/use-config";
import { Spinner } from "@/components/app/ui-bits";
import { FieldHelp } from "@/components/app/field-help";
import type { StationDto } from "@/shared/contracts/stations";

const ACTIVITY_KEY_RE = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*$/;
const NO_VALUE = "__none__";
const NO_STATION = "__none__";

const VA_ITEMS: Array<{ value: string; label: string }> = [
  { value: "valueAdded", label: "ارزش‌افزا" },
  { value: "nonValueAdded", label: "غیرارزش‌افزا" },
  { value: "essentialNonVA", label: "غیرارزش‌افزای ضروری" },
];

const SOURCE_OF_TIME_ITEMS: Array<{ value: string; label: string }> = [
  { value: "measured", label: "اندازه‌گیری‌شده (کرنومتر/ابزار)" },
  { value: "estimated", label: "برآوردی" },
  { value: "referenced", label: "ارجاعی (استاندارد مرجع)" },
];

export function ActivityDialog({
  projectId,
  activity,
  workTypes,
  stations,
  open,
  onOpenChange,
}: {
  projectId: string;
  activity?: ActivityDto;
  workTypes: ConfigWorkType[];
  stations: StationDto[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateActivity(projectId);
  const update = useUpdateActivity(projectId);
  const isEdit = !!activity;
  const pending = create.isPending || update.isPending;

  // مقداردهی اولیه lazy از خود رکورد — همه فیلدها در ویرایش پر می‌شوند (۳٫۱)
  const [stableKey, setStableKey] = useState("");
  const [name, setName] = useState(() => activity?.name ?? "");
  const [description, setDescription] = useState(() => activity?.description ?? "");
  const [workType, setWorkType] = useState<string>(() => activity?.workType ?? workTypes[0] ?? "operatorManual");
  const [vaClassification, setVaClassification] = useState<string>(() => activity?.vaClassification ?? NO_VALUE);
  const [sourceOfTime, setSourceOfTime] = useState<string>(() => activity?.sourceOfTime ?? "measured");
  const [stationId, setStationId] = useState<string>(() => activity?.stationId ?? NO_STATION);

  const keyValid = isEdit || stableKey.trim() === "" || ACTIVITY_KEY_RE.test(stableKey.trim());
  const nameValid = name.trim().length > 0;
  const canSubmit = keyValid && nameValid && !!workType;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const va = vaClassification === NO_VALUE ? null : vaClassification;
    const st = stationId === NO_STATION ? null : stationId;
    if (isEdit) {
      update.mutate(
        {
          activityId: activity.id,
          name: name.trim(),
          description: description.trim() || null,
          workType,
          vaClassification: va,
          sourceOfTime,
          stationId: st,
        },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      create.mutate(
        {
          ...(stableKey.trim() ? { stableKey: stableKey.trim() } : {}),
          name: name.trim(),
          ...(description.trim() ? { description: description.trim() } : {}),
          workType,
          vaClassification: va,
          sourceOfTime,
          stationId: st,
        },
        { onSuccess: () => onOpenChange(false) },
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? `ویرایش فعالیت «${activity.name}»` : "فعالیت جدید"}</DialogTitle>
          <DialogDescription>
            فعالیت کاری قابل‌اندازه‌گیری است که در یک ایستگاه انجام می‌شود؛ زمان‌های ثبت‌شده و نمودار فرایندی به آن متصل می‌شوند.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5">
              <Label htmlFor="activity-key">شناسه داخلی</Label>
              <FieldHelp
                label="شناسه داخلی فعالیت"
                content={{
                  meaning: "نام فنی کوتاه فعالیت در سیستم — برای اتصال نمودار و تحلیل استفاده می‌شود.",
                  input: "می‌توانید خالی بگذارید تا خودکار ساخته شود؛ یا یک شناسه لاتین کوتاه بنویسید.",
                  format: "حروف کوچک لاتین با خط تیره/نقطه — مثل el.install-door",
                  example: "برای فعالیت «نصب درب پنل»: el.install-door (یا خالی بگذارید).",
                  usage: "گام‌های نمودار و برگه‌های ثبت زمان با همین شناسه به این فعالیت ارجاع می‌دهند.",
                  effect: "این شناسه پس از ایجاد ثابت می‌ماند و قابل تغییر نیست.",
                  required: false,
                }}
              />
            </span>
            <Input
              id="activity-key"
              dir="ltr"
              className="font-mono"
              placeholder="خالی = تولید خودکار"
              value={isEdit ? activity.stableKey : stableKey}
              onChange={(e) => setStableKey(e.target.value)}
              disabled={isEdit}
              required={!isEdit && false}
              aria-invalid={!keyValid}
            />
            {!keyValid ? (
              <p className="text-xs text-red-600 dark:text-red-400">
                حروف کوچک لاتین با خط تیره/نقطه (مثل el.install-door)
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">این شناسه پس از ایجاد ثابت می‌ماند و قابل تغییر نیست.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5">
              <Label htmlFor="activity-name">نام فعالیت *</Label>
              <FieldHelp
                label="نام فعالیت"
                content={{
                  meaning: "کار قابل‌شناسایی و قابل‌اندازه‌گیری که در ایستگاه انجام می‌شود.",
                  input: "نامی که مرز شروع و پایان آن از روی نام قابل تشخیص باشد.",
                  example: "«برداشتن قطعه از جعبه» یا «نصب پیچ با پیچ‌گوشتی بادی»",
                  usage: "در فهرست فعالیت‌ها، جدول ثبت زمان، نمودار فرایندی و بالانس خط دیده می‌شود.",
                  required: true,
                }}
              />
            </span>
            <Input
              id="activity-name"
              placeholder="مثال: نصب درب پنل"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5">
              <Label>ایستگاه کاری</Label>
              <FieldHelp
                label="ایستگاه کاری"
                content={{
                  meaning: "محل انجام این فعالیت روی خط تولید — برای بالانس خط و گروه‌بندی فعالیت‌ها.",
                  input: "ایستگاه تعریف‌شده این پروژه را انتخاب کنید یا «بدون ایستگاه» بگذارید.",
                  example: "فعالیت «نصب پیچ» در ایستگاه «مونتاژ».",
                  usage: "در نمای ایستگاه‌ها، جدول ثبت زمان (گروه‌بندی) و قید تخصیص بالانس خط.",
                  effect: "با تغییر ایستگاه، جایگاه این فعالیت در بالانس خط عوض می‌شود.",
                  required: false,
                }}
              />
            </span>
            <Select value={stationId} onValueChange={setStationId}>
              <SelectTrigger aria-label="ایستگاه کاری">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_STATION}>— بدون ایستگاه —</SelectItem>
                {stations.map((st) => (
                  <SelectItem key={st.id} value={st.id}>
                    {st.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5">
              <Label>نوع کار *</Label>
              <FieldHelp
                label="نوع کار"
                content={{
                  meaning: "جنس فعالیت از نظر انجام‌دهنده — دستی، خودکار ماشین، انتظار و…",
                  input: "نزدیک‌ترین گزینه به واقعیت ایستگاه را انتخاب کنید.",
                  example: "«نصب پیچ با پیچ‌گوشتی» = دستی اپراتور؛ «پرس هیدرولیک» = خودکار ماشین.",
                  usage: "در محاسبه چرخه دستی–ماشین و تحلیل ترکیب زمان‌ها استفاده می‌شود.",
                  required: true,
                }}
              />
            </span>
            <Select value={workType} onValueChange={setWorkType}>
              <SelectTrigger aria-label="نوع کار">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {workTypes.map((wt) => (
                  <SelectItem key={wt} value={wt}>
                    {WORK_TYPE_LABELS_FA_UI[wt] ?? wt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5">
              <Label>طبقه‌بندی ارزش</Label>
              <FieldHelp
                label="طبقه‌بندی ارزش"
                content={{
                  meaning: "برچسب ارزش‌افزایی فعالیت — فقط با تأیید صریح شما ثبت می‌شود.",
                  input: "اگر مطمئن نیستید «بدون طبقه‌بندی» بگذارید؛ بعداً قابل افزودن است.",
                  example: "«نصب پیچ» = ارزش‌افزا؛ «انتظار رسیدن قطعه» = غیرارزش‌افزا.",
                  usage: "در گزارش تحلیل ارزش‌افزایی و بهبود فرایند استفاده می‌شود.",
                  required: false,
                }}
              />
            </span>
            <Select value={vaClassification} onValueChange={setVaClassification}>
              <SelectTrigger aria-label="طبقه‌بندی ارزش">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_VALUE}>— بدون طبقه‌بندی —</SelectItem>
                {VA_ITEMS.map((it) => (
                  <SelectItem key={it.value} value={it.value}>
                    {it.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5">
              <Label>منبع زمان</Label>
              <FieldHelp
                label="منبع زمان"
                content={{
                  meaning: "این زمان چگونه به دست آمده — اندازه‌گیری واقعی، برآورد یا استاندارد مرجع.",
                  input: "معمولاً «اندازه‌گیری‌شده» درست است (زمان‌ها را با ابزار گرفته‌اید).",
                  example: "زمان‌های ثبت‌شده در برگه ثبت = اندازه‌گیری‌شده؛ زمان پرسش از سرپرست = برآوردی.",
                  usage: "در گزارش‌های تحلیل، منبع زمان‌ها شفاف نمایش داده می‌شود.",
                  required: false,
                }}
              />
            </span>
            <Select value={sourceOfTime} onValueChange={setSourceOfTime}>
              <SelectTrigger aria-label="منبع زمان">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_OF_TIME_ITEMS.map((it) => (
                  <SelectItem key={it.value} value={it.value}>
                    {it.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5">
              <Label htmlFor="activity-desc">توضیحات</Label>
              <FieldHelp
                label="توضیحات"
                content={{
                  meaning: "شرح مرز شروع و پایان فعالیت — برای یکدستی اندازه‌گیری‌های مختلف.",
                  input: "بنویسید فعالیت دقیقاً کی شروع و کی تمام می‌شود.",
                  example: "شروع: لمس پیچ؛ پایان: رهاشدن پیچ‌گوشتی.",
                  required: false,
                }}
              />
            </span>
            <Textarea
              id="activity-desc"
              rows={2}
              placeholder="شرح کوتاه مرز شروع/پایان فعالیت"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              انصراف
            </Button>
            <Button type="submit" disabled={pending || !canSubmit}>
              {pending && <Spinner />} {isEdit ? "ذخیره تغییرات" : "ایجاد فعالیت"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
