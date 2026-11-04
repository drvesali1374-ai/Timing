# F3 — GroupsView + WestinghouseView (React Views)

**Task ID:** F3
**Agent:** View Developer (F3)
**Scope:** ONLY the two view files below — no commands run, no packages installed, no other files touched.

## Deliverables

| File | ~Lines | Content |
|---|---|---|
| `src/views/project/GroupsView.tsx` | ~1163 | FR-04 + FR-15 (groups & allowance categories) |
| `src/views/project/WestinghouseView.tsx` | ~1493 | FR-13 complete (element rating + reference tables) |

`/agent-ctx` at filesystem root was **not writable** in this sandbox (permission denied); this
record is therefore stored in `.agent-ctx/` at project root as a fallback.

## GroupsView.tsx — key decisions

- Tabs: «گروه‌های فعالیت» (default) / «دسته‌های مجاز».
- Groups tab: selectable card grid (`ring-2 ring-brand` when selected; auto-selects first group,
  self-heals when the selected group is deleted). Card shows name, truncated description,
  `جمع A: formatPercent(totalA)`, `N فعالیت`.
- Group detail panel (keyed by group id → fresh state on switch):
  - name/description autosave via `useAutosave` + `allowancesApi.updateGroup` with
    `expectedUpdatedAt` tracked in a ref (updated from each PUT response); SaveIndicator.
  - `AllowancesEditor`: `PercentInput` per category (user sees %, API gets decimal),
    `useAutosave({ delayMs: 600, isEqual: percentValuesEqual })` → `putGroupAllowances`
    with **all** values from state; clamps to 0.9999 (server requires < 1). Last bold row
    «جمع A». Conservative sync effect keeps in-flight user edits when server data refetches.
    HelpDot example verbatim: «استراحت شخصی ۵٪ + نیازهای طبیعی ۳٪ ⇒ A=۸٪ — صرفاً مثال؛ نرخ
    مصوب شرکت شما جایگزین شود».
  - Activities list with «مشاهده» → `navigate({ name: 'activity', projectId, activityId })`.
  - Delete: ConfirmDeleteDialog with values/activities dependency counts; toast uses
    `removedCounts` from the response.
- Categories tab: desktop table / mobile cards; Switch isActive = optimistic setQueryData +
  `updateCategory` (rollback via invalidate on error); edit dialog autosaves
  name/code/sortOrder (empty name skips save until valid); create dialog (name required,
  code optional, isActive default true); delete with groupValues/overrides counts.
- Bottom note (categories tab): allowance method chosen in project info; current method from
  `projectsApi.calcSettings` rendered as label + mono Badge formula (SHARE_OF_ST warning included).
- Autosave guards: empty `name` is skipped (server `trimmed(200)` requires min 1) instead of
  erroring while the user is mid-edit.

## WestinghouseView.tsx — key decisions

- Tabs: «ارزیابی عناصر» (default) / «جدول‌های مرجع».
- Assess tab (`ratingApi.matrix`):
  - No elements → EmptyState + button → `navigate({ name: 'project', projectId, stage: 'structure' })`.
  - Summary card «N از M عنصر ارزیابی شده» + narrow gradient progress bar
    (`bg-gradient-to-l from-brand to-brand-2`, role=progressbar) + whole-section HelpDot
    (R formula + one-rating-per-element policy, product-owner decision).
  - Station = Collapsible (open by default) → per-activity header + element table (desktop) /
    cards (mobile). Type badges: MANUAL=brand (violet), MACHINE=cyan, WAITING=muted,
    OVERLAP=amber. Rated → green `R = …` badge with title `«{ratingTableName} — نسخه {version}»`
    + «ویرایش ارزیابی»; unrated → gray «ارزیابی نشده» + btn-brand «ارزیابی».
- Rating dialog (FR-13 core):
  - Prefills from `ratingApi.elementRating(elementId)` (dependent query, enabled when open);
    re-init only while not dirty (dirtyRef), reset on close.
  - Table select (initial = assessment.ratingTableId ?? defaultTableId ?? first); grades come
    from `ratingApi.table(tableId)` dependent query.
  - Four factor selects with per-factor filtered grades, option text
    `{gradeCode} — {label} ({+/-value})` (formatSigned, 2 decimals), empty option
    «— انتخاب نشده (صفر)». Per-factor HelpDot with the required texts + Seed note.
  - Live R preview card (aria-live) using `computeRatingFactor` — client-side preview only,
    server response is authoritative.
  - «کپی از عنصر مشابه»: options = rated elements of the project (label
    `{activityName} ← {elementName}`); selecting it sends `copyFromElementId` (manual selects
    disabled + cyan info note); live preview resolves source grades against the selected table
    (mirrors server logic).
  - `missingFactors` warning + submit disabled when a selected grade code doesn't exist in the
    current table (server would 422 GRADE_NOT_FOUND).
  - Save → `putElementRating` → invalidate `qk.ratingMatrix` + `qk.structure`
    (+ elementRating & projectSummary for counters) → toast «ارزیابی ثبت شد — R = …» from response.
- Reference tables tab (`ratingApi.tables`):
  - Selectable list (name, version badge, پیش‌فرض badge, truncated source with title,
    «N درجه / M ارزیابی», date). Details panel keyed by table id.
  - Header: live name + full source (small) + counts; ⚠️ Seed warning with registered source.
  - Metadata (name/source/notes) autosave → `updateTable` with expectedUpdatedAt ref;
    Switch «پیش‌فرض پروژه» → `updateTable({ isDefault })` (bidirectional, server-authoritative).
  - Grades edited in a **local draft** (label/value/hint editable; code mono-bold display per
    spec); conservative merge on refetch; dirty-count banner + «بازگردانی تغییرات».
  - Sticky bottom action bar: «ذخیره به‌عنوان نسخه جدید» → `createTable({ name: `${state name}
    — نسخه ${max+1}`, source, notes, baseOnTableId, grades, makeDefault: true })` → invalidate +
    toast «نسخه جدید ساخته شد؛ ارزیابی‌های قبلی به نسخه پیشین ارجاع دارند» + help text
    «به‌جای تغییر جدول جاری، نسخه جدید بسازید تا محاسبات تاریخی بی‌صدا تغییر نکند».
  - Delete: ConfirmDeleteDialog; on `ApiError.code === 'RATING_TABLE_IN_USE'` (409) the server's
    Persian message is shown verbatim via toast.error.

## Cross-checks done

- All API payloads verified against `src/domain/validation.ts` and `src/application/*` services
  (percent 0–0.9999, grade value −0.5..0.5, sortOrder 0–9999, expectedUpdatedAt datetime,
  copyFromElementId semantics, RATING_TABLE_IN_USE 409).
- UI patterns mirror `OperatorsView.tsx` (header chip, card-premium tables, mobile cards,
  dialogs dir=rtl, ConfirmDeleteDialog dependency counts, SaveIndicator + retry).
- No empty catch, no mock data, aria-labels everywhere, real loading/empty/error states,
  `animate-view-in`, `scroll-slim` on long lists.
