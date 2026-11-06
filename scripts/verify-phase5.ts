// ═══════════════════════════════════════════════════════════
// اسکریپت تأیید فاز ۵ — نمودار فرایند OPC/FPC
// اجرا:  bun scripts/verify-phase5.ts
// پوشش FR-20 (ده بند) + چک‌لیست فاز ۵ (بخش ۱۱):
//   ▸ تولید خودکار گره‌ها از فعالیت‌ها (OPC: فقط عملیات/بازرسی؛ FPC: هر ۵ نوع)
//   ▸ چیدمان خودکار اولیه
//   ▸ شناسهٔ پایدار گره (تغییر نام فعالیت → برچسب به‌روز، شناسه ثابت)
//   ▸ گره دستی: ایجاد/ویرایش/حذف + محدودیت نوع در OPC
//   ▸ جابه‌جایی دستی و حفظ چیدمان (PATCH مختصات)
//   ▸ اتصال و ترتیب: زنجیرهٔ خودکار، اتصال دستی، اعتبارسنجی تکراری/خود-اتصال
//   ▸ ترتیب بالا/پایین + بازسازی زنجیره
//   ▸ حذف فعالیت → پاک‌سازی گره خودکار + حفظ گره دستی
//   ▸ حذف/تغییر نمودار هرگز مشاهدات را حذف نمی‌کند
//   ▸ وضعیت مرحلهٔ نمودار (چهارگانه)
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

async function main() {
  console.log('\n═══════ فاز ۵: آزمون‌های نمودار فرایند OPC/FPC (FR-20) ═══════')

  // ── C0) آماده‌سازی ──
  console.log('\nC0) آماده‌سازی پروژه آزمون')
  const pr = await api('POST', '/api/projects', {
    name: 'پروژه آزمون فاز ۵ (خودکار)',
    lineName: 'خط آزمون فاز ۵',
    productName: 'محصول آزمون',
    studyDate: '2026-11-12',
  })
  check('ایجاد پروژه', pr.status === 201, pr.status, 201)
  const PID = pr.data?.project?.id
  const st = await api('POST', `/api/projects/${PID}/stations`, { name: 'ایستگاه اصلی' })
  const SID = st.data?.station?.id
  check('ایجاد ایستگاه', Boolean(SID))

  // پنج فعالیت با هر پنج نوع فرایندی
  const mk = async (name: string, processType: string) => {
    const r = await api('POST', `/api/stations/${SID}/activities`, { name, processType })
    return r.data?.activity?.id as string | undefined
  }
  const A_OP = await mk('عملیات مونتاژ', 'OPERATION')
  const A_INSP = await mk('بازرسی کیفیت', 'INSPECTION')
  const A_TRN = await mk('حمل به ایستگاه بعد', 'TRANSPORT')
  const A_DLY = await mk('انتظار تأیید', 'DELAY')
  const A_STG = await mk('انبارش موقت', 'STORAGE')
  check('ایجاد پنج فعالیت با انواع متفاوت', Boolean(A_OP && A_INSP && A_TRN && A_DLY && A_STG))

  // ── T1) وضعیت مرحله پیش از ساخت نمودار ──
  console.log('\nT1) وضعیت مرحله پیش از بازکردن نمودار — FR-20/۷.۲')
  const sum0 = await api('GET', `/api/projects/${PID}`)
  check('charts = IN_PROGRESS (فعالیت هست، نمودار ساخته نشده)', sum0.data?.stageSummary?.stages?.charts?.status === 'IN_PROGRESS', sum0.data?.stageSummary?.stages?.charts?.status, 'IN_PROGRESS')

  // ── T2) تولید خودکار گره‌ها — FPC هر ۵ نوع ──
  console.log('\nT2) تولید خودکار — FPC هر پنج نوع + زنجیره — FR-20.2/4')
  const fpc1 = await api('GET', `/api/projects/${PID}/charts/FPC`)
  check('GET FPC = 200', fpc1.status === 200, fpc1.status)
  const fpcNodes1: any[] = fpc1.data?.nodes ?? []
  const fpcEdges1: any[] = fpc1.data?.edges ?? []
  check('FPC: ۵ گره خودکار', fpcNodes1.length === 5 && fpc1.data.counts.auto === 5, { nodes: fpcNodes1.length, auto: fpc1.data?.counts?.auto }, { nodes: 5, auto: 5 })
  check('FPC: انواع گره منطبق بر فعالیت‌ها', ['OPERATION', 'INSPECTION', 'TRANSPORT', 'DELAY', 'STORAGE'].every((t) => fpcNodes1.some((n) => n.nodeType === t)))
  check('FPC: زنجیرهٔ توالی ۴ یال سیستمی', fpcEdges1.length === 4 && fpcEdges1.every((e) => e.isChain), { edges: fpcEdges1.length }, 4)
  const orderedFpc = [...fpcNodes1].sort((a, b) => a.sortOrder - b.sortOrder)
  const chainOk =
    fpcEdges1.some((e) => e.sourceNodeId === orderedFpc[0].id && e.targetNodeId === orderedFpc[1].id) &&
    fpcEdges1.some((e) => e.sourceNodeId === orderedFpc[3].id && e.targetNodeId === orderedFpc[4].id)
  check('FPC: زنجیره بین گره‌های متوالی', chainOk)
  // چیدمان خودکار اولیه: ستون عمودی (x برابر برای زنجیرهٔ خطی)
  const layoutVertical = orderedFpc.length >= 2 && orderedFpc.every((n) => Math.abs(n.positionX - orderedFpc[0].positionX) < 1)
  const layoutSorted = orderedFpc.length >= 2 && orderedFpc.every((n, i) => i === 0 || n.positionY > orderedFpc[i - 1].positionY)
  check('چیدمان خودکار اولیه: ستون عمودی صعودی — FR-20.6', layoutVertical && layoutSorted, { vertical: layoutVertical, sorted: layoutSorted })

  // ── T3) فیلتر OPC ──
  console.log('\nT3) فیلتر OPC — فقط عملیات و بازرسی — FR-20.3')
  const opc1 = await api('GET', `/api/projects/${PID}/charts/OPC`)
  const opcNodes1: any[] = opc1.data?.nodes ?? []
  const opcEdges1: any[] = opc1.data?.edges ?? []
  check('OPC: فقط ۲ گره (عملیات/بازرسی)', opcNodes1.length === 2 && opcNodes1.every((n) => n.nodeType === 'OPERATION' || n.nodeType === 'INSPECTION'), opcNodes1.map((n) => n.nodeType))
  check('OPC: ۱ یال زنجیره', opcEdges1.length === 1 && opcEdges1[0]?.isChain === true, opcEdges1.length, 1)
  check('OPC: شمارش فعالیت مشمول = ۲ از ۵', opc1.data?.counts?.activitiesIncluded === 2 && opc1.data?.counts?.activitiesTotal === 5, opc1.data?.counts, { included: 2, total: 5 })

  // ── T4) وضعیت مرحله پس از ساخت ──
  console.log('\nT4) وضعیت مرحله پس از ساخت نمودار — ۷.۲')
  const sum1 = await api('GET', `/api/projects/${PID}`)
  check('charts = DONE (گره‌ها متصل)', sum1.data?.stageSummary?.stages?.charts?.status === 'DONE', sum1.data?.stageSummary?.stages?.charts?.status, 'DONE')

  // ── T5) شناسهٔ پایدار — تغییر نام فعالیت ──
  console.log('\nT5) شناسهٔ پایدار گره — FR-20.8')
  const fpcNodeOpBefore = fpcNodes1.find((n) => n.activityId === A_OP)
  const ren = await api('PUT', `/api/activities/${A_OP}`, { name: 'عملیات مونتاژ به‌روزشده' })
  check('تغییر نام فعالیت 200', ren.status === 200, ren.status)
  const fpc2 = await api('GET', `/api/projects/${PID}/charts/FPC`)
  const fpcNodeOpAfter = (fpc2.data?.nodes ?? []).find((n: any) => n.activityId === A_OP)
  check('شناسهٔ گره پس از تغییر نام ثابت ماند', fpcNodeOpAfter?.id === fpcNodeOpBefore?.id, { before: fpcNodeOpBefore?.id, after: fpcNodeOpAfter?.id })
  check('برچسب گره با نام جدید فعالیت همگام شد', fpcNodeOpAfter?.label === 'عملیات مونتاژ به‌روزشده', fpcNodeOpAfter?.label)

  // ── T6) تغییر نوع فرایند → خروج از OPC ──
  console.log('\nT6) تغییر نوع فرایند فعالیت → حذف از OPC — FR-20.10')
  const chg = await api('PUT', `/api/activities/${A_OP}`, { processType: 'TRANSPORT' })
  check('تغییر نوع فرایند 200', chg.status === 200, chg.status)
  const opc2 = await api('GET', `/api/projects/${PID}/charts/OPC`)
  const opcNodes2: any[] = opc2.data?.nodes ?? []
  check('OPC: گره فعالیت تبدیل‌شده حذف شد (۲→۱)', opcNodes2.length === 1 && opcNodes2[0]?.activityId === A_INSP, opcNodes2.map((n: any) => n.label))
  const fpc3 = await api('GET', `/api/projects/${PID}/charts/FPC`)
  const fpcNodeOp3 = (fpc3.data?.nodes ?? []).find((n: any) => n.activityId === A_OP)
  check('FPC: گره همان فعالیت باقی است و نوعش به‌روز شد', fpcNodeOp3?.nodeType === 'TRANSPORT' && fpcNodeOp3?.id === fpcNodeOpBefore?.id, fpcNodeOp3?.nodeType)
  // بازگردانی برای ادامهٔ آزمون‌ها
  await api('PUT', `/api/activities/${A_OP}`, { processType: 'OPERATION' })
  const opc2b = await api('GET', `/api/projects/${PID}/charts/OPC`)
  check('OPC: بازگردانی نوع → گره دوباره ساخته شد', (opc2b.data?.nodes ?? []).length === 2, (opc2b.data?.nodes ?? []).length, 2)

  // ── T7) گره دستی — ایجاد/محدودیت/ویرایش/حذف ──
  console.log('\nT7) گره دستی — FR-20.5')
  const badOpc = await api('POST', `/api/projects/${PID}/charts/OPC/nodes`, { label: 'حمل غیرمجاز', nodeType: 'TRANSPORT' })
  check('OPC: گره دستی حمل‌ونقل رد شد (۴۲۲)', badOpc.status === 422, badOpc.status, 422)
  const badLabel = await api('POST', `/api/projects/${PID}/charts/FPC/nodes`, { label: '   ', nodeType: 'DELAY' })
  check('برچسب خالی رد شد (۴۲۲)', badLabel.status === 422, badLabel.status, 422)
  const mn1 = await api('POST', `/api/projects/${PID}/charts/FPC/nodes`, { label: 'بازبینی بصری نهایی', nodeType: 'INSPECTION' })
  check('ایجاد گره دستی FPC = ۲۰۱', mn1.status === 201, mn1.status, 201)
  const MN1 = mn1.data?.node?.id
  const fpc4 = await api('GET', `/api/projects/${PID}/charts/FPC`)
  const fpcNodes4: any[] = fpc4.data?.nodes ?? []
  const fpcEdges4: any[] = fpc4.data?.edges ?? []
  check('FPC: گره دستی در انتهای توالی', fpcNodes4.find((n: any) => n.id === MN1)?.sortOrder === 5 && fpcNodes4.find((n: any) => n.id === MN1)?.isManual === true, fpcNodes4.find((n: any) => n.id === MN1)?.sortOrder)
  check('FPC: زنجیره تا گره دستی امتداد یافت (۵ یال)', fpcEdges4.length === 5, fpcEdges4.length, 5)
  const ed1 = await api('PATCH', `/api/chart-nodes/${MN1}`, { label: 'بازبینی بصری نهایی (ویرایش‌شده)', nodeType: 'DELAY' })
  check('ویرایش گره دستی 200', ed1.status === 200 && ed1.data?.node?.nodeType === 'DELAY', ed1.status)
  const autoNode = fpcNodes4.find((n: any) => !n.isManual)
  const lockTry = await api('PATCH', `/api/chart-nodes/${autoNode.id}`, { label: 'تغییر غیرمجاز' })
  check('ویرایش محتوای گره خودکار رد شد (۴۲۲)', lockTry.status === 422, lockTry.status, 422)
  const delAuto = await api('DELETE', `/api/chart-nodes/${autoNode.id}`)
  check('حذف گره خودکار رد شد (۴۲۲)', delAuto.status === 422, delAuto.status, 422)

  // ── T8) درگ و حفظ چیدمان ──
  console.log('\nT8) جابه‌جایی دستی + حفظ چیدمان — FR-20.7')
  const drag = await api('PATCH', `/api/chart-nodes/${MN1}`, { positionX: 777, positionY: 555 })
  check('ذخیرهٔ مختصات 200', drag.status === 200, drag.status)
  const fpc5 = await api('GET', `/api/projects/${PID}/charts/FPC`)
  const mn1After = (fpc5.data?.nodes ?? []).find((n: any) => n.id === MN1)
  check('مختصات پس از GET حفظ شد', mn1After?.positionX === 777 && mn1After?.positionY === 555, { x: mn1After?.positionX, y: mn1After?.positionY }, { x: 777, y: 555 })

  // ── T9) چیدمان خودکار (بازنشانی) ──
  console.log('\nT9) چیدمان خودکار — FR-20.6')
  const layout = await api('POST', `/api/projects/${PID}/charts/FPC/layout`)
  check('اعمال چیدمان خودکار 200', layout.status === 200, layout.status)
  const mn1Layout = (layout.data?.nodes ?? []).find((n: any) => n.id === MN1)
  check('مختصات دستی با چیدمان خودکار بازنشانی شد', mn1Layout?.positionX !== 777 || mn1Layout?.positionY !== 555, { x: mn1Layout?.positionX, y: mn1Layout?.positionY })

  // ── T10) اتصال دستی + اعتبارسنجی ──
  console.log('\nT10) اتصال گره‌ها — فاز ۵ «اتصال»')
  const fpc6 = await api('GET', `/api/projects/${PID}/charts/FPC`)
  const fpcNodes6: any[][] = fpc6.data?.nodes ?? []
  const byOrder = [...(fpcNodes6 as any[])].sort((a, b) => a.sortOrder - b.sortOrder)
  const selfEdge = await api('POST', `/api/chart-edges?projectId=${PID}`, { sourceNodeId: byOrder[0].id, targetNodeId: byOrder[0].id })
  check('خود-اتصال رد شد (۴۲۲)', selfEdge.status === 422, selfEdge.status, 422)
  const branch = await api('POST', `/api/chart-edges?projectId=${PID}`, { sourceNodeId: byOrder[0].id, targetNodeId: byOrder[4].id })
  check('ایجاد اتصال دستی (انشعاب) = ۲۰۱', branch.status === 201, branch.status, 201)
  const EDGE_BRANCH = branch.data?.edge?.id
  const dup = await api('POST', `/api/chart-edges?projectId=${PID}`, { sourceNodeId: byOrder[0].id, targetNodeId: byOrder[4].id })
  check('اتصال تکراری رد شد (۴۲۲)', dup.status === 422, dup.status, 422)
  const rev = await api('POST', `/api/chart-edges?projectId=${PID}`, { sourceNodeId: byOrder[4].id, targetNodeId: byOrder[0].id })
  check('اتصال معکوس تکراری رد شد (۴۲۲)', rev.status === 422, rev.status, 422)
  const delEdge = await api('DELETE', `/api/chart-edges/${EDGE_BRANCH}`)
  check('حذف اتصال 200', delEdge.status === 200, delEdge.status)

  // ── T11) ترتیب توالی ──
  console.log('\nT11) ترتیب گره‌ها — جابه‌جایی بالا/پایین — فاز ۵ «ترتیب»')
  const firstNode = byOrder[0]
  const secondNode = byOrder[1]
  const mvUp = await api('POST', `/api/projects/${PID}/charts/FPC/order`, { nodeId: firstNode.id, direction: 'up' })
  check('جابه‌جایی اولین گره به بالا رد شد (۴۲۲)', mvUp.status === 422, mvUp.status, 422)
  const mvDown = await api('POST', `/api/projects/${PID}/charts/FPC/order`, { nodeId: firstNode.id, direction: 'down' })
  check('جابه‌جایی به پایین 200', mvDown.status === 200, mvDown.status)
  const fpc7 = await api('GET', `/api/projects/${PID}/charts/FPC`)
  const fpcNodes7: any[] = fpc7.data?.nodes ?? []
  const fpcEdges7: any[] = fpc7.data?.edges ?? []
  const firstAfter = fpcNodes7.find((n: any) => n.id === firstNode.id)
  const secondAfter = fpcNodes7.find((n: any) => n.id === secondNode.id)
  check('ترتیب دو گره جابه‌جا شد', firstAfter?.sortOrder === 1 && secondAfter?.sortOrder === 0, { first: firstAfter?.sortOrder, second: secondAfter?.sortOrder })
  const chainPair =
    fpcEdges7.some((e: any) => e.sourceNodeId === secondNode.id && e.targetNodeId === firstNode.id && e.isChain) &&
    fpcEdges7.some((e: any) => e.sourceNodeId === firstNode.id && e.targetNodeId === byOrder[2].id && e.isChain)
  check('زنجیره پس از جابه‌جایی بازسازی شد', chainPair)
  // بازگردانی ترتیب
  await api('POST', `/api/projects/${PID}/charts/FPC/order`, { nodeId: firstNode.id, direction: 'up' })

  // ── T12) حذف/تغییر نمودار مشاهدات را حذف نمی‌کند + حذف فعالیت ──
  console.log('\nT12) جدایی نمودار از مشاهدات — FR-20.9/10')
  // فعالیت با دادهٔ زمان‌سنجی
  const st3 = await api('POST', `/api/projects/${PID}/stations`, { name: 'ایستگاه حذف‌شونده' })
  const SID3 = st3.data?.station?.id
  const act3 = await api('POST', `/api/stations/${SID3}/activities`, { name: 'فعالیت قابل حذف', processType: 'OPERATION' })
  const A3 = act3.data?.activity?.id
  const el3 = (await api('POST', `/api/activities/${A3}/elements`, { name: 'عنصر آزمون', elementType: 'MANUAL' })).data?.element?.id
  const op3 = (await api('POST', `/api/projects/${PID}/operators`, { displayName: 'اپراتور فاز ۵' })).data?.operator?.id
  const se3 = await api('POST', `/api/activities/${A3}/sessions`, { operatorId: op3, timingMethod: 'SNAPBACK' })
  const SS3 = se3.data?.session?.id
  const cy3 = await api('POST', `/api/sessions/${SS3}/cycles`, { count: 2 })
  for (const c of cy3.data?.created ?? []) {
    await api('PUT', `/api/cycles/${c.id}/cells`, { cells: [{ workElementId: el3, rawDuration: 5.2 }] })
  }
  const fpc8 = await api('GET', `/api/projects/${PID}/charts/FPC`)
  const nodeA3 = (fpc8.data?.nodes ?? []).find((n: any) => n.activityId === A3)
  check('گره فعالیت جدید با دادهٔ زمان‌سنجی ساخته شد', Boolean(nodeA3))
  const projMid = await api('GET', `/api/projects/${PID}`)
  const obsBefore = projMid.data?.dependencyCounts?.observations
  check('مشاهدات ثبت شد (۲ چرخه)', obsBefore === 2, obsBefore, 2)

  // حذف/تغییر نمودار → مشاهدات دست‌نخورده
  await api('PATCH', `/api/chart-nodes/${nodeA3.id}`, { positionX: 100, positionY: 100 })
  await api('POST', `/api/chart-edges?projectId=${PID}`, { sourceNodeId: nodeA3.id, targetNodeId: byOrder[0].id })
  const projAfterOps = await api('GET', `/api/projects/${PID}`)
  check('تغییر نمودار مشاهدات را حذف نکرد — FR-20.9', projAfterOps.data?.dependencyCounts?.observations === 2, projAfterOps.data?.dependencyCounts?.observations, 2)

  // حذف فعالیت → گره خودکار حذف + گره دستی محفوظ + مشاهدات حذف (تصمیم حذف دائمی)
  const delAct = await api('DELETE', `/api/activities/${A3}`)
  check('حذف فعالیت 200', delAct.status === 200, delAct.status)
  const fpc9 = await api('GET', `/api/projects/${PID}/charts/FPC`)
  const fpcNodes9: any[] = fpc9.data?.nodes ?? []
  check('گره خودکار فعالیت حذف‌شده پاک شد', !fpcNodes9.some((n: any) => n.activityId === A3))
  check('گره دستی بی‌دلیل حذف نشد — FR-20.10', fpcNodes9.some((n: any) => n.id === MN1))
  const projAfterDel = await api('GET', `/api/projects/${PID}`)
  check('مشاهدات فعالیت حذف‌شده طبق حذف دائمی پاک شد', projAfterDel.data?.dependencyCounts?.observations === 0, projAfterDel.data?.dependencyCounts?.observations, 0)

  // حذف ایستگاه → پاک‌سازی گره‌های فعالیت‌هایش
  const st4 = await api('POST', `/api/projects/${PID}/stations`, { name: 'ایستگاه موقت' })
  const SID4 = st4.data?.station?.id
  const act4 = (await api('POST', `/api/stations/${SID4}/activities`, { name: 'فعالیت ایستگاه موقت', processType: 'TRANSPORT' })).data?.activity?.id
  const fpc10 = await api('GET', `/api/projects/${PID}/charts/FPC`)
  check('گره فعالیت ایستگاه موقت ساخته شد', (fpc10.data?.nodes ?? []).some((n: any) => n.activityId === act4))
  await api('DELETE', `/api/stations/${SID4}`)
  const fpc11 = await api('GET', `/api/projects/${PID}/charts/FPC`)
  check('حذف ایستگاه → گره فعالیتش پاک شد و گره دستی محفوظ ماند', !(fpc11.data?.nodes ?? []).some((n: any) => n.activityId === act4) && (fpc11.data?.nodes ?? []).some((n: any) => n.id === MN1))

  // ── T13) وضعیت مرحله — نیازمند بررسی ──
  console.log('\nT13) وضعیت NEEDS_REVIEW با گره بی‌اتصال — ۷.۲')
  // حذف یک یال زنجیرهٔ OPC → گره بی‌اتصال
  const opc3 = await api('GET', `/api/projects/${PID}/charts/OPC`)
  const opcEdges3: any[] = opc3.data?.edges ?? []
  if (opcEdges3.length > 0) {
    await api('DELETE', `/api/chart-edges/${opcEdges3[0].id}`)
    const sumBroken = await api('GET', `/api/projects/${PID}`)
    check('charts = NEEDS_REVIEW پس از شکستن زنجیره', sumBroken.data?.stageSummary?.stages?.charts?.status === 'NEEDS_REVIEW', sumBroken.data?.stageSummary?.stages?.charts?.status, 'NEEDS_REVIEW')
    // جابه‌جایی ترتیب زنجیره را بازمی‌سازد → DONE
    const opcNodes3: any[] = opc3.data?.nodes ?? []
    const firstOpc = [...opcNodes3].sort((a, b) => a.sortOrder - b.sortOrder)[0]
    await api('POST', `/api/projects/${PID}/charts/OPC/order`, { nodeId: firstOpc.id, direction: 'down' })
    await api('POST', `/api/projects/${PID}/charts/OPC/order`, { nodeId: firstOpc.id, direction: 'up' })
    const sumFixed = await api('GET', `/api/projects/${PID}`)
    check('بازسازی زنجیره با ترتیب → charts = DONE', sumFixed.data?.stageSummary?.stages?.charts?.status === 'DONE', sumFixed.data?.stageSummary?.stages?.charts?.status, 'DONE')
  } else {
    check('OPC دارای یال برای آزمون', false, opcEdges3.length, '>0')
  }

  // ── T14) اعتبارسنجی‌های پایانی ──
  console.log('\nT14) اعتبارسنجی‌ها')
  const badChart = await api('GET', `/api/projects/${PID}/charts/XYZ`)
  check('نوع نمودار نامعتبر رد شد (۴۲۲)', badChart.status === 422, badChart.status, 422)
  const badNode = await api('PATCH', `/api/chart-nodes/${MN1}`, {})
  check('PATCH بدون فیلد رد شد (۴۲۲)', badNode.status === 422, badNode.status, 422)
  const notFound = await api('GET', `/api/projects/${PID}/charts/FPC`) // یک GET سالم برای پایان
  check('GET پایانی FPC سالم', notFound.status === 200, notFound.status)
  const manualCount = (notFound.data?.counts?.manual ?? 0)
  check('گره دستی همچنان موجود است', manualCount >= 1, manualCount, '>=1')

  // حذف گره دستی — آخرین عملیات
  const delMn = await api('DELETE', `/api/chart-nodes/${MN1}`)
  check('حذف گره دستی 200', delMn.status === 200, delMn.status)
  const fpcFinal = await api('GET', `/api/projects/${PID}/charts/FPC`)
  check('گره دستی حذف‌شده دیگر وجود ندارد', !(fpcFinal.data?.nodes ?? []).some((n: any) => n.id === MN1))

  // ── پاک‌سازی ──
  const cleanup = await api('DELETE', `/api/projects/${PID}`)
  check('پاک‌سازی پروژهٔ آزمون', cleanup.status === 200, cleanup.status, 200)

  // ── نتیجه ──
  console.log('\n════════════════════════════════════════════')
  console.log(`نتیجه فاز ۵: ${passed} موفق / ${failed} ناموفق`)
  if (failed > 0) {
    console.log('موارد ناموفق:')
    for (const f of failures) console.log(`  ✗ ${f}`)
    process.exit(1)
  } else {
    console.log('همهٔ آزمون‌های FR-20 موفق بودند ✅')
  }
}

main().catch((e) => {
  console.error('خطای اجرای اسکریپت:', e)
  process.exit(1)
})
