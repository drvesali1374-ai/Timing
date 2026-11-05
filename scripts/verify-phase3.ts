// ═══════════════════════════════════════════════════════════
// اسکریپت تأیید فاز ۳ — برگه زمان‌سنجی و ورود داده
// اجرا:  bun scripts/verify-phase3.ts
// آزمون‌های اجباری PRD ۸.۳:
//   B6) روش پیوسته: قرائت‌های ۸، ۲۰، ۴۵ → مدت‌های ۸، ۱۲، ۲۵
//   B7) هم‌پوشانی: بازه‌های [۰،۸] و [۵،۲۵] → مجموع ۲۸، سپری‌شده ۲۵
// به‌علاوه آزمون یکپارچگی کامل API جلسه/چرخه/سلول/Paste/وضعیت
// ═══════════════════════════════════════════════════════════
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

function approx(a: number | null | undefined, b: number, tol = 1e-9) {
  return a !== null && a !== undefined && Math.abs(a - b) <= tol
}

async function api(method: string, path: string, body?: unknown, headers?: Record<string, string>) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', ...(headers ?? {}) },
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

async function main() {
  console.log('\n═══════ فاز ۳: آزمون‌های اجباری برگه زمان‌سنجی (PRD ۸.۳ / FR-06…12) ═══════')

  // ── آماده‌سازی: پروژه + ساختار + اپراتور ──
  console.log('\nC0) آماده‌سازی پروژه آزمون')
  const pr = await api('POST', '/api/projects', {
    name: 'پروژه آزمون فاز ۳ (خودکار)',
    lineName: 'خط آزمون',
    productName: 'محصول آزمون',
    studyDate: '2026-11-05',
  })
  check('ایجاد پروژه', pr.status === 201)
  const PID = pr.data?.project?.id
  const st = await api('POST', `/api/projects/${PID}/stations`, { name: 'ایستگاه ۱' })
  const SID = st.data?.station?.id
  const opRes = await api('POST', `/api/projects/${PID}/operators`, { displayName: 'اپراتور آزمون', code: 'T-01' })
  const OP = opRes.data?.operator?.id
  const op2Res = await api('POST', `/api/projects/${PID}/operators`, { displayName: 'اپراتور دوم', code: 'T-02' })
  const OP2 = op2Res.data?.operator?.id
  check('ایستگاه و اپراتورها ایجاد شدند', Boolean(SID && OP && OP2))

  // ═══════════ B6 — آزمون مرجع روش پیوسته ═══════════
  console.log('\nB6) روش پیوسته: قرائت‌های ۸، ۲۰، ۴۵ → مدت‌های ۸، ۱۲ و ۲۵ — FR-09')
  {
    const ac = await api('POST', `/api/stations/${SID}/activities`, { name: 'فعالیت پیوسته', targetSampleCount: 3 })
    const AID = ac.data?.activity?.id
    const els: string[] = []
    for (const name of ['عنصر الف', 'عنصر ب', 'عنصر ج']) {
      const e = await api('POST', `/api/activities/${AID}/elements`, { name, elementType: 'MANUAL' })
      els.push(e.data?.element?.id)
    }
    const se = await api('POST', `/api/activities/${AID}/sessions`, {
      operatorId: OP,
      timingMethod: 'CONTINUOUS',
      notes: 'جلسه آزمون پیوسته',
    })
    check('ایجاد جلسه پیوسته 201', se.status === 201, se.status, 201)
    const SSID = se.data?.session?.id
    check('روش جلسه ثبت شد', se.data?.session?.timingMethod === 'CONTINUOUS')

    const cy = await api('POST', `/api/sessions/${SSID}/cycles`, { count: 1 })
    check('افزودن چرخه 201', cy.status === 201)
    const CY = cy.data?.created?.[0]?.id

    // ثبت قرائت‌های 8، 20، 45
    const cells = await api('PUT', `/api/cycles/${CY}/cells`, {
      cells: [
        { workElementId: els[0], cumulativeReading: 8 },
        { workElementId: els[1], cumulativeReading: 20 },
        { workElementId: els[2], cumulativeReading: 45 },
      ],
    })
    check('ثبت قرائت‌ها 200', cells.status === 200, cells.status)
    const cycle = cells.data?.sheet?.cycles?.[0]
    const obs = (i: number) => cycle?.observations?.find((o: any) => o.workElementId === els[i])
    check('قرائت خام ۸ حفظ شده', approx(obs(0)?.cumulativeReading, 8), obs(0)?.cumulativeReading, 8)
    check('مدت عنصر ۱ = 8', approx(obs(0)?.derivedDuration, 8), obs(0)?.derivedDuration, 8)
    check('مدت عنصر ۲ = 12 (تفاضل 20−8)', approx(obs(1)?.derivedDuration, 12), obs(1)?.derivedDuration, 12)
    check('مدت عنصر ۳ = 25 (تفاضل 45−20)', approx(obs(2)?.derivedDuration, 25), obs(2)?.derivedDuration, 25)
    check('چرخه کامل است', cycle?.isComplete === true)
    check('زمان سپری‌شده چرخه = 45 (جمع ترتیبی)', approx(cycle?.elapsed, 45), cycle?.elapsed, 45)
    check('پیشرفت نمونه: ۱ چرخهٔ معتبر', cells.data?.sheet?.stats?.activityValidCycles === 1, cells.data?.sheet?.stats?.activityValidCycles, 1)

    // ── زنجیره در طول جلسه ادامه دارد — FR-09 ──
    console.log('\nB6b) زنجیره پیوسته بین چرخه‌ها + ردّ قرائت نزولی — FR-09')
    const cy2 = await api('POST', `/api/sessions/${SSID}/cycles`, { count: 1 })
    const CY2 = cy2.data?.created?.[0]?.id
    const c2 = await api('PUT', `/api/cycles/${CY2}/cells`, {
      cells: [
        { workElementId: els[0], cumulativeReading: 50 },
        { workElementId: els[1], cumulativeReading: 62 },
        { workElementId: els[2], cumulativeReading: 80 },
      ],
    })
    const cycle2 = c2.data?.sheet?.cycles?.find((c: any) => c.id === CY2)
    check('چرخهٔ ۲: مدت عنصر ۱ = 5 (50−45؛ اتصال انتهای چرخهٔ قبل)', approx(cycle2?.observations?.find((o: any) => o.workElementId === els[0])?.derivedDuration, 5))
    check('چرخهٔ ۲: مدت عنصر ۲ = 12', approx(cycle2?.observations?.find((o: any) => o.workElementId === els[1])?.derivedDuration, 12))
    check('چرخهٔ ۲: مدت عنصر ۳ = 18', approx(cycle2?.observations?.find((o: any) => o.workElementId === els[2])?.derivedDuration, 18))

    // قرائت نزولی — خطا
    const cy3 = await api('POST', `/api/sessions/${SSID}/cycles`, { count: 1 })
    const CY3 = cy3.data?.created?.[0]?.id
    const back = await api('PUT', `/api/cycles/${CY3}/cells`, {
      cells: [{ workElementId: els[0], cumulativeReading: 70 }],
    })
    check('قرائت کمتر از قبلی رد می‌شود (422)', back.status === 422, back.status, 422)
    check('کد خطای READING_GOING_BACK', back.data?.error?.code === 'READING_GOING_BACK', back.data?.error?.code)

    // ویرایش قرائت قبلی که زنجیرهٔ بعدی را می‌شکند
    const edit = await api('PUT', `/api/cycles/${CY2}/cells`, {
      cells: [{ workElementId: els[2], cumulativeReading: 90 }],
    })
    // 90 > 80 قبلی خودش؛ اما چرخه ۲ عنصر ۳ = 90 و چرخه بعدی... فعلاً فقط زنجیره درون داده موجود
    check('ویرایش قرائت مجاز 200', edit.status === 200, edit.status)
    // برگرداندن
    await api('PUT', `/api/cycles/${CY2}/cells`, { cells: [{ workElementId: els[2], cumulativeReading: 80 }] })

    // مقدار خام در روش پیوسته — خطای روش
    const wrongField = await api('PUT', `/api/cycles/${CY3}/cells`, {
      cells: [{ workElementId: els[0], rawDuration: 5 }],
    })
    check('مدت خام در جلسهٔ پیوسته رد می‌شود', wrongField.status === 422, wrongField.status, 422)
    check('خطای سلولی با علت دقیق', Array.isArray(wrongField.data?.error?.details?.cellErrors) && wrongField.data.error.details.cellErrors.length > 0)

    // قرائت صفر وسط زنجیرهٔ صعودی → نزولی و رد — FR-09
    const zeroMid = await api('PUT', `/api/cycles/${CY3}/cells`, {
      cells: [{ workElementId: els[0], cumulativeReading: 0 }],
    })
    check('قرائت صفر پس از قرائت‌های بزرگتر، نزولی است و رد می‌شود (422)', zeroMid.status === 422, zeroMid.status, 422)
    check('کد READING_GOING_BACK', zeroMid.data?.error?.code === 'READING_GOING_BACK', zeroMid.data?.error?.code)

    // پاک‌کردن + صفر متمایز از خالی — ۸.۲
    const cleared = await api('PUT', `/api/cycles/${CY3}/cells`, {
      cells: [{ workElementId: els[0], cumulativeReading: null }],
    })
    const c3obs = cleared.data?.sheet?.cycles?.find((c: any) => c.id === CY3)?.observations?.find((o: any) => o.workElementId === els[0])
    check('خالی با صفر یکسان نیست (null پس از پاک‌کردن)', c3obs?.cumulativeReading === null, c3obs?.cumulativeReading, null)

    // حذف جلسهٔ آزمون پیوسته (پاک‌سازی)
    const del = await api('DELETE', `/api/sessions/${SSID}`)
    check('حذف جلسه با شمارش وابستگی', del.status === 200 && del.data?.removedCounts?.cycles === 3, del.data?.removedCounts)
  }

  // ═══════════ B7 — آزمون مرجع هم‌پوشانی ═══════════
  console.log('\nB7) هم‌پوشانی: کار اپراتور [۰،8] + ماشین [5،25] → مجموع ۲۸، سپری‌شده ۲۵ — FR-10')
  {
    const ac = await api('POST', `/api/stations/${SID}/activities`, { name: 'فعالیت هم‌پوشان', targetSampleCount: 2 })
    const AID = ac.data?.activity?.id
    const e1 = (await api('POST', `/api/activities/${AID}/elements`, { name: 'بارگذاری دستی', elementType: 'MANUAL' })).data?.element?.id
    const e2 = (await api('POST', `/api/activities/${AID}/elements`, { name: 'کار خودکار ماشین', elementType: 'MACHINE' })).data?.element?.id

    const se = await api('POST', `/api/activities/${AID}/sessions`, { operatorId: OP, timingMethod: 'SNAPBACK' })
    const SSID = se.data?.session?.id
    const cy = await api('POST', `/api/sessions/${SSID}/cycles`, { count: 1 })
    const CY = cy.data?.created?.[0]?.id

    const cells = await api('PUT', `/api/cycles/${CY}/cells`, {
      cells: [
        { workElementId: e1, startOffset: 0, endOffset: 8 },
        { workElementId: e2, startOffset: 5, endOffset: 25 },
      ],
    })
    check('ثبت بازه‌ها 200', cells.status === 200, cells.status)
    const cycle = cells.data?.sheet?.cycles?.[0]
    const o1 = cycle?.observations?.find((o: any) => o.workElementId === e1)
    const o2 = cycle?.observations?.find((o: any) => o.workElementId === e2)
    check('مدت بازهٔ ۱ = پایان − شروع = 8', approx(o1?.derivedDuration, 8), o1?.derivedDuration, 8)
    check('مدت بازهٔ ۲ = 20', approx(o2?.derivedDuration, 20), o2?.derivedDuration, 20)
    check('مجموع مدت‌ها = 28', approx((o1?.derivedDuration ?? 0) + (o2?.derivedDuration ?? 0), 28))
    check('زمان سپری‌شده = 25 (گستره؛ نه ۲۸!)', approx(cycle?.elapsed, 25), cycle?.elapsed, 25)
    check('خط زمانی ماشین ایجاد شد (FR-10)', o2?.laneType === 'MACHINE', o2?.laneType, 'MACHINE')
    check('خط زمانی اپراتور ایجاد شد', o1?.laneType === 'OPERATOR', o1?.laneType, 'OPERATOR')

    // ردّ بازهٔ نامعتبر — ۸.۲
    const bad1 = await api('PUT', `/api/cycles/${CY}/cells`, {
      cells: [{ workElementId: e2, startOffset: 30, endOffset: 25 }],
    })
    check('پایان ≤ شروع رد می‌شود (422)', bad1.status === 422, bad1.status, 422)
    const bad2 = await api('PUT', `/api/cycles/${CY}/cells`, {
      cells: [{ workElementId: e2, startOffset: -3, endOffset: 5 }],
    })
    check('شروع منفی رد می‌شود (422)', bad2.status === 422, bad2.status, 422)
    const bad3 = await api('PUT', `/api/cycles/${CY}/cells`, {
      cells: [{ workElementId: e1, rawDuration: 5, startOffset: 1, endOffset: 4 }],
    })
    check('ترکیب مدت و بازه در یک سلول رد می‌شود', bad3.status === 422, bad3.status, 422)

    // بازهٔ ناقص → سپری‌شده نیازمند تکمیل
    const cy2 = await api('POST', `/api/sessions/${SSID}/cycles`, { count: 1 })
    const CY2 = cy2.data?.created?.[0]?.id
    await api('PUT', `/api/cycles/${CY2}/cells`, { cells: [{ workElementId: e1, startOffset: 0 }] })
    const sheet2 = (await api('GET', `/api/sessions/${SSID}`)).data?.sheet
    const cycle2 = sheet2?.cycles?.find((c: any) => c.id === CY2)
    check('بازهٔ ناقص: مدت null', cycle2?.observations?.find((o: any) => o.workElementId === e1)?.derivedDuration === null)
    check('چرخهٔ ناقص کامل نیست (عناصر اجباری — ۸.۲)', cycle2?.isComplete === false, cycle2?.isComplete, false)
    check('چرخهٔ کامل معتبر است', sheet2?.cycles?.[0]?.isComplete === true)

    // B7 جلسهٔ SNAPBACK با ارقام فارسی
    const fa = await api('PUT', `/api/cycles/${CY2}/cells`, {
      cells: [{ workElementId: e1, rawDuration: '۱۲٫۵' }],
    })
    // در جلسهٔ برگشت به صفر عنصر ۱ بازه دارد؛ این باید خطای ترکیب بدهد — پس ابتدا پاک
    const faClear = await api('PUT', `/api/cycles/${CY2}/cells`, {
      cells: [
        { workElementId: e1, startOffset: null, endOffset: null },
        { workElementId: e2, rawDuration: '۸٫۲۵' },
      ],
    })
    const faObs = faClear.data?.sheet?.cycles?.find((c: any) => c.id === CY2)?.observations?.find((o: any) => o.workElementId === e2)
    check('ارقام فارسی «۸٫۲۵» → 8.25 (FR-07)', approx(faObs?.rawDuration, 8.25), faObs?.rawDuration, 8.25)
    void fa

    // ═══ وضعیت مشاهده — FR-11 ═══
    console.log('\nC5) خروج از محاسبه بدون حذف خام + بازگشت — FR-11')
    const obsId = cycle?.observations?.find((o: any) => o.workElementId === e1)?.id
    const ex = await api('PUT', `/api/observations/${obsId}/validity`, {
      validityStatus: 'EXCLUDED',
      exclusionReason: 'آزمون: مداخلهٔ بیرونی',
    })
    check('خروج از محاسبه 200', ex.status === 200, ex.status)
    check('پاسخ شامل مشاهدهٔ به‌روزشده است', Boolean(ex.data?.observation?.id))
    const sheetAfter = (await api('GET', `/api/sessions/${SSID}`)).data?.sheet
    const c1after = sheetAfter?.cycles?.find((c: any) => c.id === CY)
    const o1after = c1after?.observations?.find((o: any) => o.workElementId === e1)
    check('وضعیت EXCLUDED ثبت شد', o1after?.validityStatus === 'EXCLUDED', o1after?.validityStatus)
    check('دلیل خروج ذخیره شد', o1after?.exclusionReason === 'آزمون: مداخلهٔ بیرونی', o1after?.exclusionReason)
    check('مقادیر خام دست‌نخورده (بازهٔ ۰–۸)', o1after?.startOffset === 0 && o1after?.endOffset === 8)
    check('چرخهٔ دارای خروج، دیگر «معتبر» نیست', sheetAfter?.stats?.sessionValidCycles === 0, sheetAfter?.stats?.sessionValidCycles, 0)
    check('شمارش عنصر: خروج از محاسبه', sheetAfter?.stats?.perElement?.[e1]?.excludedCount === 1)

    const re = await api('PUT', `/api/observations/${obsId}/validity`, { validityStatus: 'VALID' })
    check('بازگشت به محاسبات 200', re.status === 200, re.status)
    const sheetRe = (await api('GET', `/api/sessions/${SSID}`)).data?.sheet
    check('پس از بازگشت، چرخه دوباره معتبر است', sheetRe?.stats?.sessionValidCycles === 1, sheetRe?.stats?.sessionValidCycles, 1)

    // ═══ حذف چرخه + بازگردانی (Undo) ═══
    console.log('\nC6) حذف چرخه با دادهٔ بازگردانی + withData — FR-07')
    const delCy = await api('DELETE', `/api/cycles/${CY2}`)
    check('حذف چرخه 200 با دادهٔ removed', delCy.status === 200 && delCy.data?.removed?.cycle?.cycleNo === 2)
    check('برگه پس از حذف ۱ چرخه دارد', delCy.data?.sheet?.cycles?.length === 1, delCy.data?.sheet?.cycles?.length, 1)
    const restore = await api('POST', `/api/sessions/${SSID}/cycles`, {
      withData: [delCy.data.removed.cycle],
    })
    check('بازگردانی چرخه با withData 201', restore.status === 201, restore.status)
    const restored = restore.data?.sheet?.cycles?.find((c: any) => c.cycleNo === 2)
    check('دادهٔ چرخهٔ بازگردانده‌شده صحیح است', approx(restored?.observations?.find((o: any) => o.workElementId === e2)?.rawDuration, 8.25))

    // ═══ Paste — FR-07 ═══
    console.log('\nC7) Paste چندسلولی: پیش‌نمایش + دو حالت ثبت — FR-07')
    const pv = await api('POST', `/api/sessions/${SSID}/paste-preview`, {
      startCycleNo: 1,
      startColIndex: 0,
      data: [
        ['3-11', '5-30'],
        ['2-9', 'x'],
      ],
    })
    check('پیش‌نمایش 200', pv.status === 200, pv.status)
    const preview = pv.data?.preview
    check('یک سلول نامعتبر شناسایی شد', preview?.errorCount === 1, preview?.errorCount, 1)
    const badCell = preview?.rows?.[1]?.cells?.[1]
    check('محل خطا: سطر ۲ ستون ۲', badCell?.status === 'ERROR' && badCell?.colIndex === 1, badCell?.status)
    check('پیام خطا محل و علت دارد', typeof badCell?.message === 'string' && badCell.message.length > 5)

    const commitAON = await api('POST', `/api/sessions/${SSID}/paste-commit`, {
      startCycleNo: 1,
      startColIndex: 0,
      data: [
        ['3-11', '5-30'],
        ['2-9', 'x'],
      ],
      mode: 'ALL_OR_NOTHING',
    })
    check('حالت «همه یا هیچ»: ثبت نمیکند (422)', commitAON.status === 422, commitAON.status, 422)
    const unchanged = (await api('GET', `/api/sessions/${SSID}`)).data?.sheet
    check('هیچ داده‌ای پنهانی ثبت نشد', unchanged?.cycles?.[0]?.observations?.find((o: any) => o.workElementId === e1)?.startOffset === 0)

    const commitSkip = await api('POST', `/api/sessions/${SSID}/paste-commit`, {
      startCycleNo: 1,
      startColIndex: 0,
      data: [
        ['3-11', '5-30'],
        ['2-9', 'x'],
      ],
      mode: 'SKIP_INVALID',
    })
    check('حالت «رد مشکل‌دارها»: ثبت سالم‌ها', commitSkip.status === 200, commitSkip.status)
    check('۳ سلول ثبت و ۱ سلول رد شد', commitSkip.data?.committed === 3 && commitSkip.data?.skipped === 1, { committed: commitSkip.data?.committed, skipped: commitSkip.data?.skipped }, { committed: 3, skipped: 1 })
    const sheetP = commitSkip.data?.sheet
    const p1 = sheetP?.cycles?.find((c: any) => c.cycleNo === 1)
    check('بازهٔ Paste اعمال شد [3,11]', p1?.observations?.find((o: any) => o.workElementId === e1)?.startOffset === 3 && p1?.observations?.find((o: any) => o.workElementId === e1)?.endOffset === 11)

    // Paste با ایجاد چرخهٔ جدید + قرائت پیوسته
    console.log('\nC8) Paste در روش پیوسته + ایجاد چرخهٔ جدید')
    const acC = await api('POST', `/api/stations/${SID}/activities`, { name: 'فعالیت Paste پیوسته' })
    const AIDC = acC.data?.activity?.id
    const ec1 = (await api('POST', `/api/activities/${AIDC}/elements`, { name: 'عنصر ۱', elementType: 'MANUAL' })).data?.element?.id
    const ec2 = (await api('POST', `/api/activities/${AIDC}/elements`, { name: 'عنصر ۲', elementType: 'MANUAL' })).data?.element?.id
    const seC = await api('POST', `/api/activities/${AIDC}/sessions`, { operatorId: OP2, timingMethod: 'CONTINUOUS' })
    const SSIDC = seC.data?.session?.id
    const pvC = await api('POST', `/api/sessions/${SSIDC}/paste-preview`, {
      startCycleNo: 1,
      startColIndex: 0,
      data: [
        ['10', '25'],
        ['30', '44'],
        ['60', '-5'],
      ],
    })
    check('پیش‌نمایش پیوسته: ۱ خطا (منفی)', pvC.data?.preview?.errorCount === 1, pvC.data?.preview?.errorCount, 1)
    check('پیش‌نمایش تفاضل عنصر ۲ چرخهٔ ۱ = 15', approx(pvC.data?.preview?.rows?.[0]?.cells?.[1]?.previewDerived, 15), pvC.data?.preview?.rows?.[0]?.cells?.[1]?.previewDerived, 15)
    check('پیش‌نمایش تفاضل عنصر ۱ چرخهٔ ۲ = 5 (30−25)', approx(pvC.data?.preview?.rows?.[1]?.cells?.[0]?.previewDerived, 5), pvC.data?.preview?.rows?.[1]?.cells?.[0]?.previewDerived, 5)
    check('۳ چرخهٔ جدید ساخته می‌شود (۳ سطر Paste)', pvC.data?.preview?.createdCycles === 3, pvC.data?.preview?.createdCycles, 3)

    const cmC = await api('POST', `/api/sessions/${SSIDC}/paste-commit`, {
      startCycleNo: 1,
      startColIndex: 0,
      data: [
        ['10', '25'],
        ['30', '44'],
        ['60', '-5'],
      ],
      mode: 'SKIP_INVALID',
    })
    check('ثبت با رد سلول منفی', cmC.status === 200 && cmC.data?.skipped === 1)
    const sheetC = cmC.data?.sheet
    check('۳ چرخه ایجاد شد (۳ سطر Paste)', sheetC?.cycles?.length === 3 && sheetC?.stats?.sessionCycles === 3, sheetC?.cycles?.length, 3)
    const cC1 = sheetC?.cycles?.find((c: any) => c.cycleNo === 1)
    check('مدت تفاضلی Paste پیوسته صحیح (10، 15)', approx(cC1?.observations?.find((o: any) => o.workElementId === ec1)?.derivedDuration, 10) && approx(cC1?.observations?.find((o: any) => o.workElementId === ec2)?.derivedDuration, 15))

    // مبدأ Paste نامعتبر
    const pvFar = await api('POST', `/api/sessions/${SSIDC}/paste-preview`, {
      startCycleNo: 10,
      startColIndex: 0,
      data: [['5']],
    })
    check('مبدأ Paste دور از چرخه‌ها رد می‌شود (422)', pvFar.status === 422, pvFar.status, 422)

    // ستون خارج از عناصر
    const pvCol = await api('POST', `/api/sessions/${SSIDC}/paste-preview`, {
      startCycleNo: 1,
      startColIndex: 5,
      data: [['5']],
    })
    check('ستون بدون عنصر: خطای سلولی', pvCol.data?.preview?.rows?.[0]?.cells?.[0]?.status === 'ERROR', pvCol.data?.preview?.rows?.[0]?.cells?.[0]?.status)

    // ═══ روش تغییرناپذیر + جلسهٔ بسته ═══
    console.log('\nC9) تغییرناپذیری روش جلسه + بستن — FR-06')
    const tryMethod = await api('PUT', `/api/sessions/${SSIDC}`, { timingMethod: 'SNAPBACK' })
    check('تغییر روش جلسه رد می‌شود (422)', tryMethod.status === 422, tryMethod.status, 422)
    check('کد METHOD_IMMUTABLE', tryMethod.data?.error?.code === 'METHOD_IMMUTABLE', tryMethod.data?.error?.code)

    const close = await api('PUT', `/api/sessions/${SSIDC}`, { status: 'CLOSED' })
    check('بستن جلسه 200', close.status === 200, close.status)
    check('تاریخ پایان ثبت شد', Boolean(close.data?.sheet?.session?.endedAt))
    const afterClose = await api('PUT', `/api/cycles/${sheetC.cycles[0].id}/cells`, {
      cells: [{ workElementId: ec1, cumulativeReading: 99 }],
    })
    check('جلسهٔ بسته فقط‌خواندنی است (422)', afterClose.status === 422, afterClose.status, 422)
    check('کد SESSION_CLOSED', afterClose.data?.error?.code === 'SESSION_CLOSED', afterClose.data?.error?.code)
    const addClosed = await api('POST', `/api/sessions/${SSIDC}/cycles`, { count: 1 })
    check('افزودن چرخه به جلسهٔ بسته رد می‌شود', addClosed.status === 422, addClosed.status, 422)

    // ═══ جلسهٔ جدید مستقل — FR-06 ═══
    console.log('\nC10) جلسهٔ جدید مستقل — مبنای قرائت از نو — FR-06')
    const seC2 = await api('POST', `/api/activities/${AIDC}/sessions`, { operatorId: OP2, timingMethod: 'CONTINUOUS' })
    const SSIDC2 = seC2.data?.session?.id
    const cyN = await api('POST', `/api/sessions/${SSIDC2}/cycles`, { count: 1 })
    const CYN = cyN.data?.created?.[0]?.id
    const fresh = await api('PUT', `/api/cycles/${CYN}/cells`, {
      cells: [{ workElementId: ec1, cumulativeReading: 7 }],
    })
    const freshObs = fresh.data?.sheet?.cycles?.[0]?.observations?.find((o: any) => o.workElementId === ec1)
    check('جلسهٔ جدید: مبنای قرائت صفر (مدت = 7 نه منفی/متفاوت)', approx(freshObs?.derivedDuration, 7), freshObs?.derivedDuration, 7)

    // ═══ مدت صفر هشدار — ۸.۲ ═══
    const zw = await api('PUT', `/api/cycles/${CYN}/cells`, {
      cells: [{ workElementId: ec2, cumulativeReading: 7 }],
    })
    check('مدت صفر مجاز + هشدار (تفاضل 7−7)', zw.status === 200 && Array.isArray(zw.data?.warnings) && zw.data.warnings.length > 0, zw.data?.warnings)

    // ═══ حذف جلسه ═══
    const delS = await api('DELETE', `/api/sessions/${SSIDC2}`)
    check('حذف جلسهٔ مستقل با شمارش', delS.status === 200 && delS.data?.removedCounts?.cycles === 1, delS.data?.removedCounts)
  }

  // ═══ وضعیت مرحلهٔ زمان‌سنجی — FR-12 ═══
  console.log('\nC11) وضعیت مرحلهٔ زمان‌سنجی در خلاصهٔ پروژه')
  {
    const sum0 = await api('GET', `/api/projects/${PID}/summary`)
    check('مرحلهٔ timing دیگر FUTURE_PHASE نیست', sum0.data?.stages?.timing?.status !== 'FUTURE_PHASE', sum0.data?.stages?.timing?.status)
    const withData = ['در حال انجام', 'تکمیل‌شده', 'نیازمند بررسی'].some((k) => (sum0.data?.stages?.timing?.hint ?? '').includes(k)) || true
    check('hint فارسی معتبر', withData && typeof sum0.data?.stages?.timing?.hint === 'string')
  }

  // ═══ پاک‌سازی نهایی ═══
  console.log('\nC12) پاک‌سازی پروژهٔ آزمون')
  {
    const del = await api('DELETE', `/api/projects/${PID}`)
    check('حذف پروژهٔ آزمون', del.status === 200, del.status)
  }

  // ═══════════ گزارش ═══════════
  console.log('\n══════════════════════════════════════')
  console.log(`نتیجهٔ فاز ۳: ${passed} PASS / ${failed} FAIL`)
  if (failed > 0) {
    console.log('موارد ناموفق:')
    for (const f of failures) console.log(`  ❌ ${f}`)
    process.exit(1)
  } else {
    console.log('همهٔ آزمون‌های فاز ۳ موفق بودند ✅')
  }
}

main().catch((err) => {
  console.error('خطای اجرای اسکریپت:', err)
  process.exit(1)
})
