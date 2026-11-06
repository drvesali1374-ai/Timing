// ═══════════════════════════════════════════════════════════
// اسکریپت تأیید فاز ۷ — سخت‌سازی، پشتیبان/بازیابی، بسته پروژه، حذف دائمی، آفلاین
// اجرا:  bun scripts/verify-phase7.ts
// پوشش FR-24 (Backup/Restore)، FR-25 (بسته کامل پروژه)، FR-26 (حذف دائمی)
// + آزمون‌های اجباری #۸ و #۱۰ بخش ۸ PRD + رگرسیون فرمول‌ها:
//   ▸ پشتیبان دستی/خودکار/حفاظتی + manifest با checksum + چرخش نگهداری
//   ▸ بازیابی با تأیید صریح + بازگشت واقعی داده + آپلود فایل
//   ▸ فایل خراب → خطای checksum (نه بازیابی خاموش)
//   ▸ DeletionMarker: دادهٔ حذف‌شدهٔ دائمی با Restore برنمی‌گردد (FR-26)
//   ▸ بسته خروجی: manifest/نسخه/checksum + وستینگهاوس + ورود همیشه پروژهٔ جدید
//   ▸ ورود بستهٔ خراب/نسخهٔ جدیدتر → خطای ساختاریافته
//   ▸ حذف دائمی ایستگاه: شمار وابستگی + حذف واقعی + رویداد حداقلی Audit
//   ▸ آفلاین: صفحه بدون هیچ منبع خارجی (آزمون اجباری #۱۰)
//   ▸ رگرسیون: موتور محاسبات پس از Restore همچنان درست (ST = NT × 1.08)
// توجه: این اسکریپت برای محیط آزمون است؛ در بخش B5 سابقهٔ نسخه‌های
// پشتیبان را پاک می‌کند تا وضعیت «سررسیدن پشتیبان خودکار» قطعی شود.
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
  return { status: res.status, data, text }
}

/** فراخوانی خام (برای بستهٔ خروجی که فایل JSON خالص است نه پوشش استاندارد) */
async function raw(path: string) {
  const res = await fetch(BASE + path)
  return { status: res.status, text: await res.text() }
}

/** حذف همهٔ رکوردهای پشتیبان (محیط آزمون) برای قطعی‌کردن وضعیت سررسیدن */
async function purgeAllBackups() {
  const list = await api('GET', '/api/backups')
  for (const b of list.data?.items ?? []) {
    await api('DELETE', `/api/backups/${b.id}`)
  }
}

async function main() {
  console.log('\n═══════ فاز ۷: سخت‌سازی، پشتیبان/بازیابی، بسته پروژه، حذف دائمی و آفلاین ═══════')

  // ═══════════════════════════════════════════
  console.log('\nS0) آماده‌سازی پروژهٔ آزمون با دادهٔ کامل')
  // ═══════════════════════════════════════════
  const pr = await api('POST', '/api/projects', {
    name: 'پروژه آزمون فاز ۷ (خودکار)',
    lineName: 'خط مونتاژ گیربکس',
    productName: 'گیربکس مدل G2',
    studyDate: '2026-11-20',
  })
  check('ایجاد پروژه', pr.status === 201, pr.status, 201)
  const PID = pr.data?.project?.id
  check('شناسهٔ پروژه', Boolean(PID))

  const st = await api('POST', `/api/projects/${PID}/stations`, { name: 'ایستگاه مونتاژ' })
  const SID = st.data?.station?.id
  const act = await api('POST', `/api/stations/${SID}/activities`, {
    name: 'مونتاژ پوسته',
    processType: 'OPERATION',
    targetSampleCount: 4,
  })
  const AID = act.data?.activity?.id
  const el1 = await api('POST', `/api/activities/${AID}/elements`, { name: 'قراردادن در فیکسچر', elementType: 'MANUAL' })
  const el2 = await api('POST', `/api/activities/${AID}/elements`, { name: 'بستن پیچ‌ها', elementType: 'MANUAL' })
  const E1 = el1.data?.element?.id
  const E2 = el2.data?.element?.id
  check('ایستگاه + فعالیت + ۲ عنصر', Boolean(SID && AID && E1 && E2))

  const op1 = await api('POST', `/api/projects/${PID}/operators`, { displayName: 'رضا محمدی' })
  const O1 = op1.data?.operator?.id

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
  check('وستینگهاوس R = 1.09 برای هر دو عنصر', r1.status === 200 && r2.status === 200 && Math.abs((r1.data?.assessment?.totalFactor ?? 0) - 1.09) < 1e-9, { s1: r1.status, s2: r2.status, R: r1.data?.assessment?.totalFactor }, 'R = 1.09')

  const cat = await api('POST', `/api/projects/${PID}/allowance-categories`, { name: 'استراحت شخصی' })
  const CAT1 = cat.data?.category?.id
  const grp = await api('POST', `/api/projects/${PID}/groups`, { name: 'مونتاژ عمومی' })
  const GID = grp.data?.group?.id
  const ga = await api('PUT', `/api/groups/${GID}/allowances`, { values: [{ categoryId: CAT1, percentValue: 0.08 }] })
  check('گروه + دستهٔ مجاز A = ۸٪', Math.abs((ga.data?.totalA ?? -1) - 0.08) < 1e-9, ga.data?.totalA, 0.08)
  await api('PUT', `/api/activities/${AID}`, { groupId: GID })

  const s1 = await api('POST', `/api/activities/${AID}/sessions`, { operatorId: O1, timingMethod: 'SNAPBACK' })
  const S1 = s1.data?.session?.id
  const cyc = await api('POST', `/api/sessions/${S1}/cycles`, { count: 4 })
  const cy = cyc.data?.created as { id: string }[]
  const e1v = [3.0, 3.4, 3.2, 3.6]
  const e2v = [2.0, 2.4, 2.2, 2.3]
  check('جلسه + ۴ چرخه ساخته شد', Boolean(S1 && cy?.length === 4))
  for (let i = 0; i < 4; i++) {
    await api('PUT', `/api/cycles/${cy[i].id}/cells`, {
      cells: [
        { workElementId: E1, rawDuration: e1v[i] },
        { workElementId: E2, rawDuration: e2v[i] },
      ],
    })
  }
  await api('POST', `/api/activities/${AID}/refresh-outliers`)
  const run = await api('POST', `/api/projects/${PID}/calculations/run`)
  check('اجرای محاسبات → 201', run.status === 201, run.status, 201)

  /** جمع ST فعالیت‌ها از snapshot محاسبات */
  const sumSt = (runData: any): number | null => {
    const acts = runData?.run?.result?.activities ?? []
    if (!acts.length) return null
    let total = 0
    let ok = true
    for (const a of acts) {
      const v = a?.activityTotal?.st
      if (typeof v !== 'number') {
        ok = false
        break
      }
      total += v
    }
    return ok ? total : null
  }
  /*
   * مقادیر مرجع (رگرسیون فرمول‌ها):
   *  E1: OT = 13.2/4 = 3.3 → NT = ×1.09 = 3.597 → ST = ×1.08 = 3.88476
   *  E2: OT = 8.9/4 = 2.225 → NT = 2.42525 → ST = 2.61927
   *  ST کل فعالیت = 6.50403
   */
  const stTotal = sumSt(run.data)
  check('رگرسیون: ST کل فعالیت = 6.50403 (NT × 1.08)', stTotal !== null && Math.abs(stTotal - 6.50403) < 1e-5, stTotal, 6.50403)

  // ═══════════════════════════════════════════
  console.log('\nB1) پشتیبان دستی — FR-24')
  // ═══════════════════════════════════════════
  const mk = await api('POST', '/api/backups')
  check('ایجاد پشتیبان دستی → 201', mk.status === 201, mk.status, 201)
  const BK1 = mk.data?.id
  check('شناسنامهٔ پشتیبان: checksum + تعداد پروژه', Boolean(mk.data?.checksum) && (mk.data?.projectCount ?? 0) >= 1, {
    checksum: mk.data?.checksum?.slice(0, 12),
    projectCount: mk.data?.projectCount,
  })

  const list1 = await api('GET', '/api/backups')
  check('فهرست پشتیبان‌ها + شناسنامهٔ جدید', (list1.data?.items ?? []).some((b: any) => b.id === BK1), true)
  check('سلامت فایل‌ها: هیچ فایل گمشده‌ای نیست', (list1.data?.health?.missing?.length ?? 1) === 0, list1.data?.health)

  const rec1 = list1.data?.items?.find((b: any) => b.id === BK1)
  check('رکورد: نوع MANUAL + اندازه + نسخهٔ ساختار', rec1?.kind === 'MANUAL' && (rec1?.sizeBytes ?? 0) > 0 && rec1?.schemaVersion === '1', {
    kind: rec1?.kind,
    sizeBytes: rec1?.sizeBytes,
    schemaVersion: rec1?.schemaVersion,
  })

  // ═══════════════════════════════════════════
  console.log('\nB2) محتوای فایل پشتیبان — manifest با checksum')
  // ═══════════════════════════════════════════
  const dl = await raw(`/api/backups/${BK1}/download`)
  check('دانلود فایل پشتیبان → 200', dl.status === 200, dl.status, 200)
  let backupJson: any = null
  try {
    backupJson = JSON.parse(dl.text)
  } catch {
    /* خرابی در ادامه گزارش می‌شود */
  }
  check('JSON معتبر با format = timing-backup', backupJson?.format === 'timing-backup', backupJson?.format)
  check('manifest: نسخهٔ ساختار ۱', backupJson?.schemaVersion === 1, backupJson?.schemaVersion, 1)
  check('دادهٔ پروژهٔ آزمون در پشتیبان هست', (backupJson?.data?.project ?? []).some((p: any) => p.id === PID))
  check('مشاهدات خام در پشتیبان هست (≥ ۸ مشاهده)', (backupJson?.data?.elementObservation ?? []).length >= 8, (backupJson?.data?.elementObservation ?? []).length, '>= 8')
  check('ارزیابی‌های وستینگهاوس در پشتیبان هست (≥ ۲ — پشتیبان سراسری است)', (backupJson?.data?.ratingAssessment ?? []).length >= 2, (backupJson?.data?.ratingAssessment ?? []).length, '>= 2')
  check('تنظیمات سراسری در پشتیبان هست (FR-24)', Array.isArray(backupJson?.data?.appSetting))

  // ═══════════════════════════════════════════
  console.log('\nB3) بازیابی — تأیید صریح + پشتیبان حفاظتی + بازگشت واقعی داده')
  // ═══════════════════════════════════════════
  const noConfirm = await api('POST', `/api/backups/${BK1}/restore`, { confirmReplace: false })
  const noConfirmCode = noConfirm.data?.error?.code
  check('بدون تأیید صریح → 422 (بازیابی ممنوع)', noConfirm.status === 422 && (noConfirmCode === 'CONFIRM_REQUIRED' || noConfirmCode === 'VALIDATION_ERROR'), { status: noConfirm.status, code: noConfirmCode }, '422 + CONFIRM_REQUIRED/VALIDATION_ERROR')

  // دادهٔ جدید بعد از پشتیبان: پروژه‌ای که نباید بعد از بازیابی بماند
  const junk = await api('POST', '/api/projects', { name: 'پروژه زائد — باید با Restore حذف شود', lineName: 'خط X', productName: 'محصول X' })
  const JUNK = junk.data?.project?.id
  check('ایجاد پروژهٔ زائد پس از پشتیبان', Boolean(JUNK))

  const restore = await api('POST', `/api/backups/${BK1}/restore`, { confirmReplace: true })
  check('بازیابی با تأیید → موفق', restore.status === 200, restore.status, 200)
  check('پشتیبان حفاظتی PRE_RESTORE خودکار گرفته شد', Boolean(restore.data?.protectiveBackupId), restore.data?.protectiveBackupId?.slice(0, 8))
  check('گزارش بازگشت داده: جدول‌ها > ۰', Object.keys(restore.data?.restored ?? {}).length > 5, Object.keys(restore.data?.restored ?? {}).length)

  const projectsAfter = await api('GET', '/api/projects?sort=createdAt&dir=desc')
  const idsAfter = (projectsAfter.data?.items ?? projectsAfter.data ?? []).map((p: any) => p.id)
  check('بازگشت واقعی: پروژهٔ زائد حذف شد', !idsAfter.includes(JUNK))
  check('بازگشت واقعی: پروژهٔ آزمون باقی است', idsAfter.includes(PID))
  check('حفاظتی در فهرست با نوع PRE_RESTORE', (await api('GET', '/api/backups')).data?.items?.some((b: any) => b.kind === 'PRE_RESTORE'), true)

  // پس از Restore موتور محاسبات باید همان نتیجهٔ قبلی را بدهد (سلامت داده)
  const latest2 = await api('GET', `/api/projects/${PID}/calculations/latest`)
  const stTotal2 = sumSt(latest2.data)
  check('رگرسیون پس از Restore: ST کل همچنان 6.50403', stTotal2 !== null && Math.abs(stTotal2 - 6.50403) < 1e-5, stTotal2, 6.50403)
  check('ارزیابی وستینگهاوس پس از Restore باقی است (۲)', (latest2.data?.run?.result?.activities?.[0]?.elements ?? []).every((e: any) => Math.abs((e?.ratingFactor ?? 0) - 1.09) < 1e-9), (latest2.data?.run?.result?.activities?.[0]?.elements ?? []).map((e: any) => e?.ratingFactor), [1.09, 1.09])

  // ═══════════════════════════════════════════
  console.log('\nB4) بازیابی از فایل آپلودی + فایل خراب')
  // ═══════════════════════════════════════════
  const uploadOk = await fetch(`${BASE}/api/backups/restore-upload`, {
    method: 'POST',
    // FormData با File — شبیه‌سازی واقعی مرورگر
    body: (() => {
      const fd = new FormData()
      fd.append('file', new File([dl.text], 'backup-test.json', { type: 'application/json' }))
      fd.append('confirmReplace', 'true')
      return fd
    })(),
  })
  check('بازیابی از فایل آپلودی → موفق', uploadOk.status === 200, uploadOk.status, 200)
  await uploadOk.json().catch(() => null)

  // فایل خراب: checksum دستکاری‌شده
  const tampered = JSON.parse(dl.text)
  tampered.checksum = '0'.repeat(64)
  const uploadBad = await fetch(`${BASE}/api/backups/restore-upload`, {
    method: 'POST',
    body: (() => {
      const fd = new FormData()
      fd.append('file', new File([JSON.stringify(tampered)], 'bad.json', { type: 'application/json' }))
      fd.append('confirmReplace', 'true')
      return fd
    })(),
  })
  const badRes = await uploadBad.json().catch(() => null)
  check('فایل خراب → 422 BACKUP_CHECKSUM_MISMATCH (نه بازیابی خاموش)', uploadBad.status === 422 && badRes?.error?.code === 'BACKUP_CHECKSUM_MISMATCH', { status: uploadBad.status, code: badRes?.error?.code }, { status: 422, code: 'BACKUP_CHECKSUM_MISMATCH' })

  // ═══════════════════════════════════════════
  console.log('\nB5) پشتیبان خودکار — زمان‌بندی و چرخش (محیط آزمون: سابقه پاک می‌شود)')
  // ═══════════════════════════════════════════
  // غیرفعال → skip
  await api('PUT', '/api/settings', { 'backup.autoEnabled': 'false' })
  const tickOff = await api('POST', '/api/backups?auto=1')
  check('خاموش: تیک خودکار skip می‌شود', tickOff.status === 200 && tickOff.data?.skipped === true, tickOff.data)

  // پاک‌سازی سابقه (محیط آزمون) → وضعیت «سررسیدن» قطعی می‌شود
  await purgeAllBackups()

  // فعال + سررسیده → ایجاد واقعی AUTO
  await api('PUT', '/api/settings', { 'backup.autoEnabled': 'true', 'backup.intervalMinutes': '5', 'backup.retention': '10' })
  const tick1 = await api('POST', '/api/backups?auto=1')
  check('روشن + سررسیده: تیک خودکار پشتیبان AUTO می‌سازد (201)', tick1.status === 201, tick1.status, 201)

  // تیک مجدد قبل از فاصلهٔ ۵ دقیقه → skip
  const tick2 = await api('POST', '/api/backups?auto=1')
  check('تیک زودهنگام (قبل از فاصلهٔ تنظیم‌شده) skip می‌شود', tick2.status === 200 && tick2.data?.skipped === true, tick2.data?.reason, 'NOT_DUE_YET')

  // کاشت مستقیم ۳ رکورد AUTO قدیمی‌تر (فاصلهٔ ۵ دقیقه‌ای از API قابل دور زدن نیست؛
  // اینجا فقط رکورد شناسنامه کاشته می‌شود — فایل نداشتنش برای چرخش بی‌خطر است)
  const { db } = await import('../src/lib/db')
  const now = Date.now()
  for (let i = 1; i <= 3; i++) {
    await db.backupRecord.create({
      data: {
        fileName: `backup-seeded-auto-${i}.json`,
        kind: 'AUTO',
        sizeBytes: 1000,
        checksum: `seed-${i}`,
        schemaVersion: '1',
        projectCount: 1,
        createdAt: new Date(now - i * 10 * 60 * 1000),
      },
    })
  }
  await db.$disconnect()
  const autosNow = ((await api('GET', '/api/backups')).data?.items ?? []).filter((b: any) => b.kind === 'AUTO').length
  check('۴ نسخهٔ AUTO موجود است (۱ واقعی + ۳ کاشته‌شده)', autosNow === 4, autosNow, 4)

  // چرخش: نگهداری = ۳ → ساخت دستی، چرخش اجرا و AUTO به ۳ محدود می‌شود
  await api('PUT', '/api/settings', { 'backup.retention': '3' })
  await api('POST', '/api/backups')
  const autosList = ((await api('GET', '/api/backups')).data?.items ?? []).filter((b: any) => b.kind === 'AUTO')
  check('چرخش: با نگهداری ۳، AUTOها به ۳ محدود شدند', autosList.length === 3, autosList.length, 3)
  check('چرخش: قدیمی‌ترین AUTO حذف شد (seed-3 دیگر نیست)', !autosList.some((b: any) => b.checksum === 'seed-3'), autosList.map((b: any) => b.checksum), 'بدون seed-3')

  // بازگرداندن تنظیم پیش‌فرض
  await api('PUT', '/api/settings', { 'backup.intervalMinutes': '30', 'backup.retention': '10' })

  // ═══════════════════════════════════════════
  console.log('\nP1) بستهٔ کامل پروژه — خروجی (FR-25)')
  // ═══════════════════════════════════════════
  const exp = await raw(`/api/projects/${PID}/export`)
  check('خروجی بسته → 200', exp.status === 200, exp.status, 200)
  let pkg: any = null
  try {
    pkg = JSON.parse(exp.text)
  } catch {
    /* خرابی در ادامه گزارش می‌شود */
  }
  check('manifest: format = timing-project-package', pkg?.manifest?.format === 'timing-project-package', pkg?.manifest?.format)
  check('manifest: نام پروژه + تاریخ + نسخهٔ ساختار', pkg?.manifest?.projectName === 'پروژه آزمون فاز ۷ (خودکار)' && pkg?.manifest?.schemaVersion === 1 && Boolean(pkg?.manifest?.createdAt), {
    projectName: pkg?.manifest?.projectName,
    schemaVersion: pkg?.manifest?.schemaVersion,
    createdAt: pkg?.manifest?.createdAt,
  })
  check('checksum بسته موجود است', typeof pkg?.checksum === 'string' && pkg.checksum.length >= 32, pkg?.checksum?.slice(0, 12))
  check('بخش داده: ساختار + تنظیمات + وستینگهاوس + نمودار', Boolean(pkg?.data?.station?.length) && Array.isArray(pkg?.data?.chartNode) && (pkg?.data?.ratingTable?.length ?? 0) >= 1, {
    stations: pkg?.data?.station?.length,
    ratingTables: pkg?.data?.ratingTable?.length,
    chartNodes: pkg?.data?.chartNode?.length,
  })
  check('ارزیابی‌های وستینگهاوس در بسته (FR-25 — ۲ ارزیابی)', pkg?.data?.ratingAssessment?.length === 2, pkg?.data?.ratingAssessment?.length, 2)
  check('دادهٔ خام مشاهدات در بسته (۸ مشاهده)', pkg?.data?.elementObservation?.length === 8, pkg?.data?.elementObservation?.length, 8)

  // ═══════════════════════════════════════════
  console.log('\nP2) ورود بسته — همیشه پروژهٔ جدید + یکپارچگی داده')
  // ═══════════════════════════════════════════
  const imp = await api('POST', '/api/projects/import', JSON.parse(exp.text))
  check('ورود بسته → 201', imp.status === 201, imp.status, 201)
  const NEWPID = imp.data?.projectId
  check('پروژهٔ جدید با شناسهٔ متفاوت ایجاد شد', Boolean(NEWPID) && NEWPID !== PID, NEWPID?.slice(0, 8))
  check('نام پروژهٔ ورودی پسوند «(ورودی)» دارد', imp.data?.name?.endsWith('(ورودی)'), imp.data?.name)

  const origSum = await api('GET', `/api/projects/${PID}/summary`)
  const newSum = await api('GET', `/api/projects/${NEWPID}/summary`)
  const oc = origSum.data?.counts ?? origSum.data
  const nc = newSum.data?.counts ?? newSum.data
  check('ساختار کپی شد: ایستگاه/فعالیت/عنصر برابر', oc?.stations === nc?.stations && oc?.activities === nc?.activities && oc?.elements === nc?.elements, {
    orig: { s: oc?.stations, a: oc?.activities, e: oc?.elements },
    copy: { s: nc?.stations, a: nc?.activities, e: nc?.elements },
  })
  check('مشاهدات خام کپی شد (sessions برابر)', (nc?.sessions ?? 0) === (oc?.sessions ?? 0), { orig: oc?.sessions, copy: nc?.sessions })
  check('پروژهٔ اصلی دست‌نخورده ماند', origSum.status === 200 && (oc?.stations ?? 0) >= 1)

  // وستینگهاوسِ ورودی: محاسبهٔ پروژهٔ ورودی باید همان ST را بدهد (ارزیابی‌ها منتقل شده‌اند)
  const runCopy = await api('POST', `/api/projects/${NEWPID}/calculations/run`)
  const stCopy = sumSt(runCopy.data)
  check('پروژهٔ ورودی: ST = 6.50403 (ارزیابی وستینگهاوس منتقل شد)', stCopy !== null && Math.abs(stCopy - 6.50403) < 1e-5, stCopy, 6.50403)

  // ورود بستهٔ خراب
  const pkgBad = JSON.parse(exp.text)
  pkgBad.checksum = 'ff'.repeat(32)
  const impBad = await api('POST', '/api/projects/import', pkgBad)
  check('بستهٔ خراب → 422 PACKAGE_CHECKSUM_MISMATCH', impBad.status === 422 && impBad.data?.error?.code === 'PACKAGE_CHECKSUM_MISMATCH', impBad.data?.error?.code, 'PACKAGE_CHECKSUM_MISMATCH')

  const impJson = await fetch(`${BASE}/api/projects/import`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: 'not-json{{' })
  const impJsonRes = await impJson.json().catch(() => null)
  check('JSON نامعتبر → 422 PACKAGE_INVALID_JSON', impJson.status === 422 && impJsonRes?.error?.code === 'PACKAGE_INVALID_JSON', impJsonRes?.error?.code, 'PACKAGE_INVALID_JSON')

  const pkgNew = JSON.parse(exp.text)
  pkgNew.manifest.schemaVersion = 99
  // checksum با نسخهٔ جدید بازتولید نمی‌شود تا خطای نسخه پیش از checksum بیاید
  const impNew = await api('POST', '/api/projects/import', pkgNew)
  check('نسخهٔ ساختار جدیدتر → 422 PACKAGE_NEWER_SCHEMA', impNew.status === 422 && impNew.data?.error?.code === 'PACKAGE_NEWER_SCHEMA', impNew.data?.error?.code, 'PACKAGE_NEWER_SCHEMA')

  // ═══════════════════════════════════════════
  console.log('\nD1) حذف دائمی ایستگاه — FR-26 (آزمون اجباری #۸)')
  // ═══════════════════════════════════════════
  // پیش‌نمایش وابستگی‌ها پیش از حذف
  const dep = await api('GET', `/api/stations/${SID}`)
  check('پیش‌نمایش: ۱ فعالیت + ۲ عنصر + ۱ جلسه + ۸ مشاهده', dep.data?.counts?.activities === 1 && dep.data?.counts?.elements === 2 && dep.data?.counts?.sessions === 1 && dep.data?.counts?.observations === 8, dep.data?.counts, { activities: 1, elements: 2, sessions: 1, observations: 8 })

  // پشتیبانِ حاوی ایستگاه برای آزمون نشانگر حذف
  const bkWithStation = await api('POST', '/api/backups')
  const BK2 = bkWithStation.data?.id
  check('پشتیبان حاوی ایستگاه گرفته شد (برای آزمون نشانگر)', Boolean(BK2))

  // حذف دائمی
  const del = await api('DELETE', `/api/stations/${SID}`)
  check('حذف دائمی → 200 با شمار وابستگی‌ها', del.status === 200 && del.data?.deleted === true && del.data?.removedCounts?.observations === 8, del.data?.removedCounts)

  // حذف واقعی در DB عملیاتی
  const sumAfter = await api('GET', `/api/projects/${PID}/summary`)
  check('پس از حذف: ایستگاه/فعالیت/عنصر = ۰', sumAfter.data?.counts?.stations === 0 && sumAfter.data?.counts?.activities === 0 && sumAfter.data?.counts?.elements === 0, sumAfter.data?.counts)
  const proj404 = await api('GET', `/api/stations/${SID}`)
  check('رکورد ایستگاه واقعاً از DB حذف شد (404)', proj404.status === 404, proj404.status, 404)

  // رویداد حداقلی Audit (بدون کپی محتوا)
  const auditDel = await api('GET', `/api/audit?projectId=${PID}&action=DELETE&limit=50`)
  const delEvents = auditDel.data?.items ?? auditDel.data ?? []
  const stationDelEvent = (Array.isArray(delEvents) ? delEvents : []).find((e: any) => e.entityType === 'Station' && e.entityId === SID)
  check('رویداد حداقلی حذف ثبت شد (نوع + شناسه، بدون محتوای حذف‌شده)', Boolean(stationDelEvent) && !stationDelEvent?.beforeJson, {
    found: Boolean(stationDelEvent),
    hasContentCopy: Boolean(stationDelEvent?.beforeJson),
  })

  // ═══════════════════════════════════════════
  console.log('\nD2) نشانگر حذف — Restore نباید دادهٔ حذف‌شدهٔ دائمی را برگرداند')
  // ═══════════════════════════════════════════
  const restore2 = await api('POST', `/api/backups/${BK2}/restore`, { confirmReplace: true })
  check('بازیابی پشتیبانِ حاوی ایستگاهِ حذف‌شده → موفق', restore2.status === 200, restore2.status, 200)
  check('نشانگرها ردیف حذف‌شده را از بازیابی خارج کردند (removedByMarkers > 0)', (restore2.data?.removedByMarkers ?? 0) > 0, restore2.data?.removedByMarkers)
  const stationAfterRestore = await api('GET', `/api/stations/${SID}`)
  check('ایستگاهِ حذف‌شدهٔ دائمی با Restore برنگشت (FR-26)', stationAfterRestore.status === 404, stationAfterRestore.status, 404)
  const sumFinal = await api('GET', `/api/projects/${PID}/summary`)
  check('پروژهٔ آزمون پس از بازیابی موجود و خالی از ایستگاه حذف‌شده', sumFinal.status === 200 && sumFinal.data?.counts?.stations === 0, sumFinal.data?.counts)

  // ═══════════════════════════════════════════
  console.log('\nO1) آفلاین — آزمون اجباری #۱۰ (بدون هیچ منبع خارجی)')
  // ═══════════════════════════════════════════
  const home = await raw('/')
  check('صفحهٔ اصلی → 200', home.status === 200, home.status, 200)
  const externalRefs = home.text.match(/(?:src|href)="https?:\/\/(?!localhost|127\.0\.0\.1)[^"]+"/g) ?? []
  check('HTML بدون هیچ منبع خارجی (src/href)', externalRefs.length === 0, externalRefs.slice(0, 3), [])
  const extLinks = home.text.match(/<link[^>]+href="https?:\/\//g) ?? []
  check('بدون لینک CSS/فونت خارجی', extLinks.length === 0, extLinks.length, 0)
  const settingsOk = await api('GET', '/api/settings')
  check('API تنظیمات پاسخ‌گو (بدون وابستگی بیرونی)', settingsOk.status === 200 && settingsOk.data?.settings?.['ui.language'] === 'fa', settingsOk.data?.settings?.['ui.language'], 'fa')

  // ═══════════════════════════════════════════
  console.log('\nC1) پاک‌سازی پروژه‌های آزمون')
  // ═══════════════════════════════════════════
  const delOrig = await api('DELETE', `/api/projects/${PID}`)
  check('حذف پروژهٔ آزمون اصلی', delOrig.status === 200, delOrig.status, 200)
  const delCopy = await api('DELETE', `/api/projects/${NEWPID}`)
  check('حذف پروژهٔ ورودی بسته', delCopy.status === 200, delCopy.status, 200)

  // حذف رکوردهای AUTO کاشته‌شدهٔ آزمون چرخش (وضعیت تمیز برای محیط)
  const dbMod = await import('../src/lib/db')
  const removedSeeds = await dbMod.db.backupRecord.deleteMany({ where: { fileName: { startsWith: 'backup-seeded-auto-' } } })
  await dbMod.db.$disconnect()
  check('پاک‌سازی رکوردهای کاشته‌شدهٔ آزمون چرخش', removedSeeds.count >= 0, removedSeeds.count)

  // ═══════════════════════════════════════════
  console.log('\n══════════════════════════════════════')
  console.log(`نتیجهٔ فاز ۷: ${passed} موفق / ${failed} ناموفق`)
  if (failed > 0) {
    console.log('❌ موارد ناموفق:')
    for (const f of failures) console.log(`   • ${f}`)
    process.exit(1)
  } else {
    console.log('✅ همهٔ آزمون‌های فاز ۷ موفق بودند.')
  }
}

main().catch((err) => {
  console.error('خطای اجرای اسکریپت:', err)
  process.exit(1)
})
