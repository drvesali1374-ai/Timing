// ═══════════════════════════════════════════════════════════
// اسکریپت تأیید فاز ۶ — داشبورد، گزارش و تجربه نهایی
// اجرا:  bun scripts/verify-phase6.ts
// پوشش FR-21 (داشبورد)، FR-22 (گزارش/خروجی) + چک‌لیست فاز ۶:
//   ▸ کارت‌های خلاصه: ST/میانگین/نمونه/هدف — علت به‌جای صفر (FR-21)
//   ▸ شاخص‌ها و نمودارهای تخصصی: فعالیت‌ها/وضعیت/اپراتورها/CV/بازبینی
//   ▸ شخصی‌سازی: فعال-غیرفعال + مرتب‌سازی + ذخیرهٔ چیدمان (FR-21)
//   ▸ وضعیت واقعی مراحل dashboard/reports + ورود به پیشرفت
//   ▸ گزارش مطالعه: پارامترها/فرض‌ها، روش کرنومتر، نمونه، خارج‌شده‌ها،
//     وستینگهاوس، دسته‌های مجاز، فرمول ST (FR-22)
//   ▸ گزارش تک‌اپراتوره: OT = میانگین همان اپراتور + یادداشت شفاف
//   ▸ Excel: فایل معتبر (PK)، شیت RTL، سربرگ فارسی، اعداد واقعی، ۴ نوع
//   ▸ صداقت: گزارش نتیجهٔ نیازمند بازبینی را قطعی معرفی نمی‌کند
//   ▸ خروجی سریع: آدرس Excel فعالیت‌محور از تحلیل
// ═══════════════════════════════════════════════════════════
export {}

const BASE = process.env.API_BASE ?? 'http://localhost:3000'
let passed = 0
let failed = 0
const failures: string[] = []

function check(name: string, condition: boolean, actual?: unknown, expected?: unknown) {
  if (condition) {
    passed++
    console.log(`  ✅ ${name}${actual !== undefined ? `  → ${JSON.stringify(actual)}` : ''}`)
  } else {
    failed++
    failures.push(name)
    console.log(`  ❌ ${name}`)
    console.log(`     انتظار: ${JSON.stringify(expected)}`)
    console.log(`     واقعی:   ${JSON.stringify(actual)}`)
  }
}

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data: any = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }
  return { status: res.status, data }
}

/** سازندهٔ عدد فارسی-پذیر — همان قالب ورودی برگه */
function num(v: number | string): number | string {
  return v
}

async function main() {
  console.log('\n═══════ فاز ۶: آزمون‌های داشبورد، گزارش و تجربه نهایی ═══════')

  // ── D0) آماده‌سازی پروژه کامل با داده ──
  console.log('\nD0) آماده‌سازی پروژه آزمون')
  const pr = await api('POST', '/api/projects', {
    name: 'پروژه آزمون فاز ۶ (خودکار)',
    lineName: 'خط مونتاژ پمپ',
    productName: 'پمپ صنعتی مدل A',
    studyDate: '2026-11-20',
  })
  check('ایجاد پروژه', pr.status === 201, pr.status, 201)
  const PID = pr.data?.project?.id
  check('شناسهٔ پروژه', Boolean(PID))

  const st = await api('POST', `/api/projects/${PID}/stations`, { name: 'ایستگاه مونتاژ' })
  const SID = st.data?.station?.id
  const act = await api('POST', `/api/stations/${SID}/activities`, {
    name: 'مونتاژ بدنه',
    processType: 'OPERATION',
    targetSampleCount: 6,
  })
  const AID = act.data?.activity?.id

  // عناصر: دستی + ماشینی (ترتیبی؛ بدون هم‌پوشانی تا ST کل قابل محاسبه باشد)
  const el1 = await api('POST', `/api/activities/${AID}/elements`, { name: 'قراردادن در فیکسچر', elementType: 'MANUAL' })
  const el2 = await api('POST', `/api/activities/${AID}/elements`, { name: 'پرس اتوماتیک', elementType: 'MACHINE' })
  const E1 = el1.data?.element?.id
  const E2 = el2.data?.element?.id
  check('ایجاد دو عنصر ترتیبی', Boolean(E1 && E2))

  const op1 = await api('POST', `/api/projects/${PID}/operators`, { displayName: 'رضا محمدی' })
  const op2 = await api('POST', `/api/projects/${PID}/operators`, { displayName: 'سمیه کریمی' })
  const op3 = await api('POST', `/api/projects/${PID}/operators`, { displayName: 'اپراتور تازه‌وارد' })
  const O1 = op1.data?.operator?.id
  const O2 = op2.data?.operator?.id
  const O3 = op3.data?.operator?.id // بدون هیچ داده‌ای — برای آزمون صداقت گزارش

  // گروه + دستهٔ مجاز
  const cat = await api('POST', `/api/projects/${PID}/allowance-categories`, { name: 'استراحت شخصی' })
  const cat2 = await api('POST', `/api/projects/${PID}/allowance-categories`, { name: 'نیازهای طبیعی' })
  const CAT1 = cat.data?.category?.id
  const CAT2 = cat2.data?.category?.id
  const grp = await api('POST', `/api/projects/${PID}/groups`, { name: 'مونتاژ عمومی' })
  const GID = grp.data?.group?.id
  // درصد مجاز: مقدار اعشاری محاسباتی — ۵٪ = 0.05 — FR-15
  const ga = await api('PUT', `/api/groups/${GID}/allowances`, {
    values: [
      { categoryId: CAT1, percentValue: 0.05 },
      { categoryId: CAT2, percentValue: 0.03 },
    ],
  })
  check('ثبت مقادیر گروه (A = ۸٪)', Math.abs((ga.data?.totalA ?? -1) - 0.08) < 1e-9, ga.data?.totalA, 0.08)
  const patchAct = await api('PUT', `/api/activities/${AID}`, { groupId: GID })
  check('تخصیص فعالیت به گروه', patchAct.status === 200, patchAct.status, 200)

  // ارزیابی وستینگهاوس برای هر دو عنصر — R = 1.09 (تست مرجع بخش ۸)
  // Skill=C1(+0.06) Effort=C2(+0.02) Conditions=D(0) Consistency=C(+0.01)
  const tables = await api('GET', `/api/projects/${PID}/rating-tables`)
  const TID = tables.data?.items?.[0]?.id
  const putRating = async (eid: string) =>
    api('PUT', `/api/elements/${eid}/rating`, {
      ratingTableId: TID,
      skillGrade: 'C1',
      effortGrade: 'C2',
      conditionsGrade: 'D',
      consistencyGrade: 'C',
    })
  const r1 = await putRating(E1)
  const r2 = await putRating(E2)
  check('ارزیابی وستینگهاوس R = 1.09 برای هر دو عنصر', r1.status === 200 && r2.status === 200 && Math.abs((r1.data?.assessment?.totalFactor ?? 0) - 1.09) < 1e-9, { s1: r1.status, s2: r2.status, R: r1.data?.assessment?.totalFactor }, 'R = 1.09')

  // جلسات Snapback: ۴ چرخهٔ اپراتور ۱ + ۴ چرخهٔ اپراتور ۲ (هدف ۶ → رسیده)
  const mkSession = async (operatorId: string) => {
    const r = await api('POST', `/api/activities/${AID}/sessions`, { operatorId, timingMethod: 'SNAPBACK' })
    return r.data?.session?.id
  }
  const S1 = await mkSession(O1)
  const S2 = await mkSession(O2)

  // ایجاد چرخه‌ها از طریق API رسمی جلسه
  const mkCycles = async (sessionId: string, count: number) => {
    const r = await api('POST', `/api/sessions/${sessionId}/cycles`, { count })
    return (r.data?.created ?? []) as { id: string }[]
  }
  const putCell = (cycleId: string, cells: { workElementId: string; rawDuration: number | null }[]) =>
    api('PUT', `/api/cycles/${cycleId}/cells`, { cells })

  // اپراتور ۱ (رضا): ۵ چرخه — چرخهٔ ۵ دارای مقدار مشکوک ۳۰٫۵ در E1
  // مقادیر با پراکندگی طبیعی (MAD > 0) تا فقط پرت واقعی علامت بخورد؛
  // قبل و بعد از خروج پرت، هیچ مقدار مرزی دیگری علامت نمی‌گیرد.
  const e1op1 = [3.0, 3.4, 3.2, 3.6, 30.5]
  const e1op2 = [3.1, 3.3, 3.2, 3.4]
  const e2op1 = [2.0, 2.4, 2.2, 2.3, 2.1]
  const e2op2 = [2.1, 2.3, 2.2, 2.4]
  const cy1 = await mkCycles(S1, 5)
  const cy2 = await mkCycles(S2, 4)
  for (let i = 0; i < 4; i++) {
    await putCell(cy1[i].id, [
      { workElementId: E1, rawDuration: e1op1[i] },
      { workElementId: E2, rawDuration: e2op1[i] },
    ])
    await putCell(cy2[i].id, [
      { workElementId: E1, rawDuration: e1op2[i] },
      { workElementId: E2, rawDuration: e2op2[i] },
    ])
  }
  await putCell(cy1[4].id, [
    { workElementId: E1, rawDuration: e1op1[4] },
    { workElementId: E2, rawDuration: e2op1[4] },
  ])
  // بازمحاسبهٔ پرچم‌های مشکوک
  await api('POST', `/api/activities/${AID}/refresh-outliers`)

  /*
   * مقادیر مورد انتظار (SUSPECT طبق FR-11 در محاسبات می‌ماند):
   *  E1: OT = (3.0+3.4+3.2+3.6+30.5+3.1+3.3+3.2+3.4)/9 = 56.7/9 = 6.3
   *      NT = ×1.09 = 6.867 → ST = ×1.08 = 7.41636
   *  E2: OT = 20/9 ≈ 2.22222 → NT ≈ 2.42222 → ST = 2.616
   *  ST کل = 10.03236 | ۹ چرخهٔ کامل معتبر | میانگین چرخه = 76.7/9 ≈ 8.52222
   */

  console.log('\nD1) داشبورد — FR-21')

  // ── D1) داشبورد: کارت‌های خلاصه ──
  const dash = await api('GET', `/api/projects/${PID}/dashboard`)
  check('GET /dashboard موفق', dash.status === 200, dash.status, 200)
  const D = dash.data
  check('چهار کارت خلاصه موجود است', D?.cards?.length === 4, D?.cards?.length, 4)
  const stCard = D?.cards?.find((c: any) => c.key === 'st')
  const meanCard = D?.cards?.find((c: any) => c.key === 'meanCycle')
  const samplesCard = D?.cards?.find((c: any) => c.key === 'samples')
  const targetCard = D?.cards?.find((c: any) => c.key === 'target')

  // محاسبهٔ مورد انتظار:
  // E1 (اپراتور۱: 3.1,3.2,3.3,3.4 → میانگین 3.25؛ اپراتور۲: 3.2×4 → 3.2) → OT وزنی = (3.25×4+3.2×4)/8 = 3.225
  // R = 1.09 → NT1 = 3.51525
  // E2 (اپراتور۱: 2.1×4 → 2.1؛ اپراتور۲: 2.05,2.1,2.15,2.2 → 2.125) → OT = (2.1×4+2.125×4)/8 = 2.1125 → NT2 = 2.302625
  // A = 8٪ (5+3) → روش ۱: ST = NT × 1.08 → ST1 = 3.79647، ST2 = 2.486835 → جمع ≈ 6.283305
  check('کارت ST مقدار عددی دارد (فعالیت ترتیبی کامل)', stCard?.value !== null && stCard?.value !== undefined, stCard?.value)
  if (stCard?.value != null) {
    check('کارت ST ≈ 10.0324 (فرمول مرجع + SUSPECT در محاسبات — FR-11)', Math.abs(stCard.value - 10.03236) < 0.001, stCard.value, '≈10.03236')
  }
  check('کارت میانگین مقدار دارد', meanCard?.value !== null && meanCard?.value !== undefined, meanCard?.value)
  check('کارت تعداد نمونه = ۹ چرخهٔ معتبر', samplesCard?.value === 9, samplesCard?.value, 9)
  check('کارت هدف: تک‌فعالیتِ رسیده (value=1, unit=فعالیت)', targetCard?.value === 1 && String(targetCard?.unit ?? '').includes('فعالیت'), { value: targetCard?.value, unit: targetCard?.unit })

  // زمان سپری‌شدهٔ ۹ چرخهٔ کامل (شامل چرخهٔ مشکوک) = 75.4/9
  if (meanCard?.value != null) {
    check('میانگین چرخه ≈ 8.5222 ثانیه (وزنی بر تعداد)', Math.abs(meanCard.value - 8.522222) < 0.01, meanCard.value, '≈8.52222')
  }

  // ── D2) شاخص‌ها و داده‌های نمودار ──
  check('ردیف فعالیت با ST موجود', D?.activities?.[0]?.st !== null && D?.activities?.[0]?.stStatus === 'OK', D?.activities?.[0]?.stStatus)
  check('وضعیت هدف در ردیف فعالیت رسیده', D?.activities?.[0]?.targetReached === true, D?.activities?.[0]?.targetReached)
  const os = D?.observationStatus
  check('توزیع وضعیت: ۱۸ مشاهدهٔ کل (۱۷ معتبر + ۱ مشکوک)', os?.valid + os?.suspect + os?.excluded + os?.invalid === 18, os, 'valid=17, suspect=1')
  check('یک مشاهدهٔ مشکوک علامت‌خورده', os?.suspect === 1, os?.suspect, 1)
  check('دو اپراتور در مقایسه', D?.operators?.length === 2, D?.operators?.length, 2)
  check('شاخص نسبی اپراتورها محاسبه شده', D?.operators?.every((o: any) => o.relativeIndex !== null), D?.operators?.map((o: any) => o.relativeIndex))
  check('عناصر CV٪ دارند (پراکندگی)', D?.elementCv?.length >= 2, D?.elementCv?.length)

  // ── D3) نیازهای بازبینی ──
  check('نیازهای بازبینی: ۱ مشکوک بازبینی‌نشده', D?.reviewNeeds?.suspectsPending === 1, D?.reviewNeeds?.suspectsPending, 1)
  check('نیازمند محاسبهٔ مجدد (Snapshot هنوز اجرا نشده)', D?.reviewNeeds?.needsRecalc === true, D?.reviewNeeds?.needsRecalc, true)

  // اجرای محاسبه → نیاز باید رفع شود
  await api('POST', `/api/projects/${PID}/calculations/run`)
  const dash2 = await api('GET', `/api/projects/${PID}/dashboard`)
  check('پس از اجرای محاسبه: needsRecalc = false', dash2.data?.reviewNeeds?.needsRecalc === false, dash2.data?.reviewNeeds?.needsRecalc, false)
  check('تاریخ آخرین محاسبه ثبت شد', typeof dash2.data?.reviewNeeds?.lastCalculationAt === 'string', dash2.data?.reviewNeeds?.lastCalculationAt)

  // ── D4) شخصی‌سازی چیدمان — FR-21 ──
  const putLayout = await api('PUT', `/api/projects/${PID}/dashboard-layout`, {
    cardOrder: ['samples', 'st', 'target', 'meanCycle'],
    hiddenCards: ['meanCycle'],
    widgetOrder: ['reviewNeeds', 'activities', 'statusDonut', 'operators', 'elementCv'],
    hiddenWidgets: ['elementCv'],
  })
  check('ذخیرهٔ چیدمان شخصی‌سازی‌شده', putLayout.status === 200, putLayout.status, 200)
  const getLayout = await api('GET', `/api/projects/${PID}/dashboard-layout`)
  check('بازیابی چیدمان ذخیره‌شده', getLayout.data?.layout?.cardOrder?.[0] === 'samples' && getLayout.data?.layout?.hiddenWidgets?.[0] === 'elementCv', getLayout.data?.layout)
  // چیدمان نمایشی نباید محاسبات را STALE کند
  const dash3 = await api('GET', `/api/projects/${PID}/dashboard`)
  check('چیدمان محاسبات را نیازمند مجدد نمی‌کند', dash3.data?.reviewNeeds?.needsRecalc === false, dash3.data?.reviewNeeds?.needsRecalc, false)

  // ── D5) صداقت داشبورد در دادهٔ ناقص ──
  const prEmpty = await api('POST', '/api/projects', { name: 'پروژه خالی فاز ۶', lineName: 'خط خالی', productName: 'محصول' })
  const PID2 = prEmpty.data?.project?.id
  const dashEmpty = await api('GET', `/api/projects/${PID2}/dashboard`)
  const eCards = dashEmpty.data?.cards ?? []
  check('پروژهٔ خالی: هر چهار کارت null با علت', eCards.length === 4 && eCards.every((c: any) => c.value === null && typeof c.reason === 'string' && c.reason.length > 3), eCards.map((c: any) => ({ k: c.key, v: c.value, r: c.reason?.slice(0, 20) })))
  check('پروژهٔ خالی: کارت ST علت «فعالیتی تعریف نشده» دارد', /فعالیتی/.test(eCards.find((c: any) => c.key === 'st')?.reason ?? ''), eCards.find((c: any) => c.key === 'st')?.reason)

  console.log('\nD2) گزارش مطالعه — FR-22')

  // ── R1) گزارش کامل ──
  const rep = await api('GET', `/api/projects/${PID}/reports/study`)
  check('GET /reports/study موفق', rep.status === 200, rep.status, 200)
  const R = rep.data
  check('عنوان گزارش', R?.reportMeta?.title === 'گزارش مطالعهٔ زمان', R?.reportMeta?.title)
  check('اطلاعات پروژه در گزارش', R?.project?.name === 'پروژه آزمون فاز ۶ (خودکار)' && R?.project?.lineName === 'خط مونتاژ پمپ', R?.project?.name)

  // پارامترها و فرض‌ها — FR-22 الزامی
  check('فرمول ST در گزارش', R?.assumptions?.stFormula === 'ST = NT × (1 + A)', R?.assumptions?.stFormula)
  check('روش اعمال مجاز', typeof R?.assumptions?.allowanceMethodLabel === 'string' && R?.assumptions?.allowanceMethodLabel.length > 3, R?.assumptions?.allowanceMethodLabel)
  check('روش تجمیع چند اپراتور', typeof R?.assumptions?.aggregationMethodLabel === 'string', R?.assumptions?.aggregationMethodLabel)
  check('روش تشخیص غیرعادی', typeof R?.assumptions?.outlierMethodLabel === 'string', R?.assumptions?.outlierMethodLabel)
  check('نسخهٔ فرمول', R?.assumptions?.formulaVersion === '1.0.0', R?.assumptions?.formulaVersion)
  check('قاعدهٔ وستینگهاوس ذکر شده', /R = 1 \+ Skill/.test(R?.assumptions?.westinghouseNote ?? ''), R?.assumptions?.westinghouseNote)

  const sec = R?.activities?.[0]
  check('یک بخش فعالیت', R?.activities?.length === 1, R?.activities?.length)
  check('روش کرنومتر جلسات ذکر شده (Snapback)', sec?.methods?.some((m: any) => m.methodKey === 'SNAPBACK' && m.sessionsCount === 2), sec?.methods)
  check('اپراتورهای هر روش فهرست شده', sec?.methods?.[0]?.operators?.length === 2, sec?.methods?.[0]?.operators)
  check('تعداد نمونه: ۹ معتبر از ۹ چرخه', sec?.sampleProgress?.validCycles === 9 && sec?.sampleProgress?.totalCycles === 9, { v: sec?.sampleProgress?.validCycles, t: sec?.sampleProgress?.totalCycles })
  check('دسته‌های مجاز مؤثر (۲ دسته)', sec?.allowances?.categories?.length === 2, sec?.allowances?.categories?.length)
  check('جمع A = ۸٪', Math.abs((sec?.allowances?.totalA ?? 0) - 0.08) < 1e-9, sec?.allowances?.totalA)

  const elRows = sec?.elements ?? []
  check('جدول عناصر با وستینگهاوس کامل', elRows.length === 2 && elRows.every((e: any) => e.rating && e.rating.skill && e.rating.tableName), elRows.map((e: any) => e.rating?.tableName))
  check('R عنصر = 1.09', Math.abs((elRows[0]?.rating?.totalFactor ?? 0) - 1.09) < 1e-9, elRows[0]?.rating?.totalFactor)
  check('ST عناصر محاسبه شده', elRows.every((e: any) => e.st !== null), elRows.map((e: any) => e.st))
  check('استاندارد کل فعالیت OK', sec?.activityTotal?.status === 'OK' && sec?.activityTotal?.st !== null, sec?.activityTotal?.status)
  check('مشاهدهٔ مشکوک در گزارش فهرست شده', sec?.suspects?.length === 1 && sec?.suspects?.[0]?.validityStatus === 'SUSPECT', sec?.suspects?.length)

  // پرچم‌های بازبینی — صداقت
  check('پرچم: ۱ مشکوک بازبینی‌نشده', R?.flags?.pendingSuspects === 1, R?.flags?.pendingSuspects, 1)
  check('سلب مسئولیت شامل «استاندارد قطعی» نیست', /نیازمند بازبینی/.test(R?.disclaimer ?? '') && /قطعی/.test(R?.disclaimer ?? ''), R?.disclaimer?.slice(0, 80))

  // ── R2) فیلتر فعالیت ──
  const repA = await api('GET', `/api/projects/${PID}/reports/study?activityId=${AID}`)
  check('فیلتر فعالیت: همان فعالیت', repA.data?.activities?.length === 1 && repA.data?.reportMeta?.activityFilter?.id === AID, repA.data?.reportMeta?.activityFilter)

  // ── R3) گزارش تک‌اپراتوره ──
  const repOp = await api('GET', `/api/projects/${PID}/reports/study?operatorId=${O1}`)
  const secOp = repOp.data?.activities?.[0]
  check('گزارش تک‌اپراتوره: یادداشت شفاف', typeof repOp.data?.reportMeta?.operatorNote === 'string' && /رضا محمدی/.test(repOp.data?.reportMeta?.operatorNote), repOp.data?.reportMeta?.operatorNote?.slice(0, 60))
  // OT اپراتور ۱ برای E1 = میانگین 3.25 (نه تجمیع 3.225)
  const e1Op = secOp?.elements?.find((e: any) => e.name === 'قراردادن در فیکسچر')
  check('OT تک‌اپراتوره = میانگین همان اپراتور (8.74 با پرت)', Math.abs((e1Op?.ot ?? 0) - 8.74) < 1e-9, e1Op?.ot, 8.74)
  check('برچسب مبنای OT تک‌اپراتوره', /همین اپراتور/.test(e1Op?.otNote ?? ''), e1Op?.otNote)
  // صداقت حالت تک‌اپراتوره — FR-22: آمار کل فعالیت به‌عنوان آمار اپراتور نمایش داده نمی‌شود
  check('آمار عنصر در حالت تک‌اپراتوره از همان اپراتور است (n=5, mean=8.74)', e1Op?.stats?.count === 5 && Math.abs((e1Op?.stats?.mean ?? 0) - 8.74) < 1e-9, { n: e1Op?.stats?.count, mean: e1Op?.stats?.mean }, { n: 5, mean: 8.74 })
  check('روش کرنومتر تک‌اپراتوره فقط جلسه‌های همان اپراتور (۱ جلسه)', secOp?.methods?.length === 1 && secOp?.methods?.[0]?.sessionsCount === 1, secOp?.methods)
  check('شمارش چرخهٔ کامل در حالت تک‌اپراتوره null است (نه صفر ساختگی)', secOp?.sampleProgress?.validCycles === null && secOp?.sampleProgress?.totalCycles === null, { v: secOp?.sampleProgress?.validCycles, t: secOp?.sampleProgress?.totalCycles })
  check('زمان سپری‌شدهٔ چرخه در حالت تک‌اپراتوره null است', secOp?.cycleStats?.count === null && secOp?.cycleStats?.mean === null, secOp?.cycleStats?.count)
  check('استاندارد کل در حالت تک‌اپراتوره برچسب تجمیع کل فعالیت دارد', /تجمیع کل فعالیت/.test(secOp?.activityTotal?.reason ?? ''), secOp?.activityTotal?.reason?.slice(-90))

  // اپراتور بدون داده در فعالیت: همهٔ ستون‌ها خالی/— نه مقدار ساختگی
  const repOpNoData = await api('GET', `/api/projects/${PID}/reports/study?operatorId=${O3}`)
  const secNoData = repOpNoData.data?.activities?.[0]
  const e1NoData = secNoData?.elements?.find((e: any) => e.name === 'قراردادن در فیکسچر')
  check('اپراتور بدون داده: آمار عنصر خالی (n=0, mean=null)', e1NoData?.stats?.count === 0 && e1NoData?.stats?.mean === null && e1NoData?.ot === null, { n: e1NoData?.stats?.count, mean: e1NoData?.stats?.mean, ot: e1NoData?.ot })
  check('اپراتور بدون داده: جلسه‌ای فهرست نمی‌شود', secNoData?.methods?.length === 0 && secNoData?.sampleProgress?.sessionsCount === 0, { m: secNoData?.methods?.length, s: secNoData?.sampleProgress?.sessionsCount })

  // ── R4) فهرست انتخاب ──
  const sel = await api('GET', `/api/projects/${PID}/reports/study?mode=selection`)
  check('فهرست انتخاب: ایستگاه/فعالیت', sel.data?.stations?.length === 1 && sel.data?.stations?.[0]?.activities?.[0]?.hasData === true, sel.data?.stations?.[0]?.activities?.[0])
  check('فهرست انتخاب: اپراتورها (۳ نفر — شامل بدون‌داده)', sel.data?.operators?.length === 3, sel.data?.operators?.length)
  check('فهرست انتخاب: ۲ جلسه', sel.data?.sessionsCount === 2, sel.data?.sessionsCount)

  console.log('\nD3) خروجی Excel — FR-22')

  // ── X1) هر چهار نوع ──
  const types: Array<'overview' | 'summary' | 'operators' | 'raw'> = ['overview', 'summary', 'operators', 'raw']
  const buffers: Record<string, Buffer> = {}
  for (const t of types) {
    const res = await fetch(`${BASE}/api/projects/${PID}/reports/excel?type=${t}`)
    const buf = Buffer.from(await res.arrayBuffer())
    buffers[t] = buf
    check(
      `Excel «${t}»: 200 + content-type xlsx + امضای ZIP (PK)`,
      res.status === 200 &&
        (res.headers.get('content-type') ?? '').includes('spreadsheetml') &&
        buf.length > 1000 &&
        buf[0] === 0x50 && buf[1] === 0x4b,
      { status: res.status, ct: res.headers.get('content-type'), size: buf.length, magic: buf.subarray(0, 2).toString('latin1') }
    )
    const cd = res.headers.get('content-disposition') ?? ''
    check(`Excel «${t}»: نام فایل فارسی در content-disposition`, /filename\*=UTF-8''/.test(cd), cd.slice(0, 90))
  }

  // ── X2) اعتبارسنجی محتوای فایل با exceljs ──
  const ExcelJS = (await import('exceljs')).default
  const readWb = async (buf: Buffer) => {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf as unknown as ArrayBuffer)
    return wb
  }

  const wbOverview = await readWb(buffers.overview)
  const wsOverview = wbOverview.worksheets[0]
  check('Excel overview: شیت راست‌به‌چپ', (wsOverview?.views?.[0] as any)?.rightToLeft === true, (wsOverview?.views?.[0] as any)?.rightToLeft)
  check('Excel overview: نام شیت فارسی', wsOverview?.name === 'نگاه کل', wsOverview?.name)
  const titleCell = wsOverview?.getCell('A1').value
  check('Excel overview: عنوان پروژه', String(titleCell).includes('گزارش نگاه کل پروژه'), titleCell)
  // ردیف داده: ST ≈ 6.283305 عدد واقعی
  let foundSt = false
  let foundCycle = false
  wsOverview?.eachRow((row) => {
    const vals = (row.values as any[]).map((v) => (v && typeof v === 'object' && (v as any).result !== undefined ? (v as any).result : v))
    const stVal = vals[8]
    const cycVal = vals[5]
    if (typeof stVal === 'number' && Math.abs(stVal - 10.03236) < 0.001) foundSt = true
    if (cycVal === 9) foundCycle = true
  })
  check('Excel overview: ST عدد واقعی ≈ 10.0324', foundSt)
  check('Excel overview: چرخهٔ معتبر = ۹ (عدد)', foundCycle)

  const wbSummary = await readWb(buffers.summary)
  check('Excel summary: سه شیت (محاسبات + وستینگهاوس + مجازها)', wbSummary.worksheets.length === 3, wbSummary.worksheets.map((w) => w.name))
  const wsWest = wbSummary.worksheets.find((w) => w.name === 'وستینگهاوس')
  check('Excel summary: شیت وستینگهاوس موجود', Boolean(wsWest), wsWest?.name)
  let westFound = false
  wsWest?.eachRow((row) => {
    const vals = (row.values as any[]).map((v) => (v && typeof v === 'object' && (v as any).result !== undefined ? (v as any).result : v))
    if (vals.includes('قراردادن در فیکسچر')) westFound = true
  })
  check('Excel summary: عنصر در جدول وستینگهاوس', westFound)

  const wbRaw = await readWb(buffers.raw)
  const wsRaw = wbRaw.worksheets[0]
  check('Excel raw: شیت راست‌به‌چپ', (wsRaw?.views?.[0] as any)?.rightToLeft === true)
  let rawRows = 0
  let suspectSeen = false
  wsRaw?.eachRow((row) => {
    const vals = (row.values as any[]).map((v) => (v && typeof v === 'object' && (v as any).result !== undefined ? (v as any).result : v))
    // ردیف داده = ستون «چرخه» (ستون ۶) عدد است؛ سربرگ/فراداده شمارش نمی‌شوند
    if (typeof vals[6] === 'number') rawRows++
    if (vals.some((v) => typeof v === 'string' && v.includes('مشکوک'))) suspectSeen = true
  })
  check('Excel raw: ۱۸ ردیف مشاهده', rawRows === 18, rawRows, 18)
  check('Excel raw: وضعیت مشکوک دیده می‌شود', suspectSeen)

  // ── X3) فیلتر روی Excel ──
  const resRawOp = await fetch(`${BASE}/api/projects/${PID}/reports/excel?type=raw&operatorId=${O1}`)
  const wbRawOp = await readWb(Buffer.from(await resRawOp.arrayBuffer()))
  const wsRawOp = wbRawOp.worksheets[0]
  let opRows = 0
  wsRawOp?.eachRow((row) => {
    const vals = (row.values as any[]).map((v) => (v && typeof v === 'object' && (v as any).result !== undefined ? (v as any).result : v))
    if (typeof vals[6] === 'number') opRows++
  })
  check('Excel raw با فیلتر اپراتور: ۱۰ ردیف (۵ چرخه × ۲ عنصر)', opRows === 10, opRows, 10)

  // ── X4) نوع نامعتبر ──
  const resBad = await fetch(`${BASE}/api/projects/${PID}/reports/excel?type=wrong`)
  check('نوع نامعتبر → ۴۲۲', resBad.status === 422, resBad.status, 422)

  // ── X5) پروژهٔ خالی → خطای صادقانه یا خروجی خالی، نه فایل خراب ──
  const resEmpty = await fetch(`${BASE}/api/projects/${PID2}/reports/excel?type=overview`)
  check('پروژهٔ خالی: خروجی Excel معتبر (بدون فایل خراب)', resEmpty.status === 200 && (Buffer.from(await resEmpty.arrayBuffer()))[0] === 0x50, resEmpty.status)

  console.log('\nD4) وضعیت مراحل و پیشرفت — ۷.۲')

  // ── S1) وضعیت واقعی مراحل جدید ──
  const sum2 = await api('GET', `/api/projects/${PID}/summary`)
  const stages2 = sum2.data?.stages ?? {}
  check('مرحلهٔ داشبورد: چهارگانه (نه فاز بعدی)', ['PENDING', 'IN_PROGRESS', 'DONE', 'NEEDS_REVIEW'].includes(stages2.dashboard?.status), stages2.dashboard?.status)
  check('مرحلهٔ داشبورد: نیازمند بررسی (۱ مشکوک)', stages2.dashboard?.status === 'NEEDS_REVIEW', stages2.dashboard?.status)
  check('مرحلهٔ گزارش‌ها: نیازمند بررسی (مشکوک بازبینی‌نشده)', stages2.reports?.status === 'NEEDS_REVIEW', stages2.reports?.status)
  check('پیشرفت شامل مراحل جدید (۱۰ مرحله)', sum2.data?.progress > 0 && sum2.data?.progress <= 1, sum2.data?.progress)

  // پس از خروج مشاهدهٔ مشکوک از محاسبات، مراحل باید به DONE بروند
  const an = await api('GET', `/api/activities/${AID}/analysis`)
  const suspectItem = an.data?.analysis?.suspects?.find((s: any) => s.validityStatus === 'SUSPECT')
  check('یافتن مشاهدهٔ مشکوک برای خروج', Boolean(suspectItem), suspectItem?.observationId)
  if (suspectItem) {
    await api('PUT', `/api/observations/${suspectItem.observationId}/validity`, {
      validityStatus: 'EXCLUDED',
      exclusionReason: 'خطای ثبت کرنومتر',
    })
    const sum3 = await api('GET', `/api/projects/${PID}/summary`)
    check('پس از خروج مشکوک: داشبورد DONE', sum3.data?.stages?.dashboard?.status === 'DONE', sum3.data?.stages?.dashboard?.status)
    check('پس از خروج مشکوک: گزارش‌ها DONE', sum3.data?.stages?.reports?.status === 'DONE', sum3.data?.stages?.reports?.status)
    // گزارش باید دادهٔ خارج‌شده را با دلیل فهرست کند
    const rep2 = await api('GET', `/api/projects/${PID}/reports/study`)
    const exc = rep2.data?.activities?.[0]?.suspects?.find((s: any) => s.validityStatus === 'EXCLUDED')
    check('گزارش: دادهٔ خارج‌شده با دلیل «خطای ثبت کرنومتر»', exc?.exclusionReason === 'خطای ثبت کرنومتر', exc?.exclusionReason)
    // داشبورد: توزیع وضعیت به‌روز
    const dash4 = await api('GET', `/api/projects/${PID}/dashboard`)
    check('داشبورد: توزیع وضعیت پس از خروج (۱۷ معتبر + ۱ خارج‌شده)', dash4.data?.observationStatus?.valid === 17 && dash4.data?.observationStatus?.excluded === 1, dash4.data?.observationStatus)
    check('داشبورد: مشکوک بازبینی‌نشده = ۰', dash4.data?.reviewNeeds?.suspectsPending === 0, dash4.data?.reviewNeeds?.suspectsPending)
  }

  // ── S2) رگرسیون سبک: مسیرهای فازهای قبل همچنان پاسخ‌گو ──
  const regChecks = await Promise.all([
    fetch(`${BASE}/api/projects/${PID}/structure`).then((r) => r.status),
    fetch(`${BASE}/api/activities/${AID}/analysis`).then((r) => r.status),
    fetch(`${BASE}/api/projects/${PID}/charts/OPC`).then((r) => r.status),
    fetch(`${BASE}/api/projects/${PID}/calculations/latest`).then((r) => r.status),
  ])
  check('رگرسیون: ساختار/تحلیل/نمودار/محاسبات پاسخ‌گو', regChecks.every((s) => s === 200), regChecks, [200, 200, 200, 200])

  // ── پاک‌سازی پروژه‌های آزمون ──
  await api('DELETE', `/api/projects/${PID}`)
  await api('DELETE', `/api/projects/${PID2}`)
  console.log('\n🧹 پروژه‌های آزمون حذف شدند.')

  // ── نتیجه ──
  console.log('\n════════════════════════════════════════')
  console.log(`نتیجهٔ فاز ۶: ${passed} موفق / ${failed} ناموفق`)
  if (failed > 0) {
    console.log('موارد ناموفق:')
    for (const f of failures) console.log(`  • ${f}`)
    process.exit(1)
  } else {
    console.log('✅ همهٔ آزمون‌های فاز ۶ موفق بودند.')
  }
}

void num
main().catch((err) => {
  console.error('خطای اجرای اسکریپت:', err)
  process.exit(1)
})
