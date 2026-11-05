/* ═══════════════════════════════════════════════════════════
   برنامه اصلی — روتر و شل — نسخه آفلاین
   ═══════════════════════════════════════════════════════════ */
(function (g) {
  'use strict';
  var U = g.T2U, DB = g.T2DB, UI = g.T2UI;

  var route = { name: 'home', projectId: null, stage: null, activityId: null };

  function parseHash() {
    var h = (g.location.hash || '').replace(/^#/, '');
    var m = /^\/p\/([^/]+)\/activity\/([^/]+)$/.exec(h);
    if (m) return { name: 'activity', projectId: m[1], activityId: m[2] };
    m = /^\/p\/([^/]+)\/([a-z]+)$/.exec(h);
    if (m) return { name: 'project', projectId: m[1], stage: m[2] };
    return { name: 'home' };
  }
  function navigate(hash) { g.location.hash = hash; }

  function initTheme() {
    var saved = null;
    try { saved = g.localStorage.getItem('timing2-theme'); } catch (e) {}
    applyTheme(saved || 'light');
  }
  function applyTheme(theme) {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try { g.localStorage.setItem('timing2-theme', theme); } catch (e) {}
  }
  function toggleTheme() {
    var dark = document.documentElement.classList.contains('dark');
    applyTheme(dark ? 'light' : 'dark');
    renderChrome();
  }

  var STAGE_GUIDES = {
    info: { steps: ['نام پروژه، خط تولید، محصول و تاریخ مطالعه را کامل کنید.', 'روش اعمال مجاز را انتخاب کنید: درصدی از زمان نرمال یا سهم از زمان استاندارد.', 'روش تجمیع چند اپراتور را در تنظیمات محاسبات مشخص کنید.'], next: 'سپس به «ساختار تولید» بروید و ایستگاه‌ها را ثبت کنید.' },
    structure: { steps: ['ایستگاه‌های خط تولید را اضافه و با کشیدن‌ورها کردن مرتب کنید.', 'برای هر ایستگاه، فعالیت‌ها را با نوع فرایندی (عملیات/بازرسی/حمل‌ونقل/تأخیر/انبارش) ثبت کنید.', 'برای هر فعالیت، عناصر کاری را با نوع (دستی/ماشین/انتظار/هم‌زمان) تعریف کنید.', 'شناسه عناصر پایدار است؛ تغییر نام ارتباط تاریخی را از بین نمی‌برد.'], next: 'سپس اپراتورها را معرفی و گروه‌های مجاز را تعریف کنید.' },
    operators: { steps: ['هر اپراتور را با نام نمایشی و کد داخلی ثبت کنید.', 'اپراتور در سطح پروژه تعریف می‌شود و در چند فعالیت شرکت می‌کند.', 'برگه زمان‌سنجی هر اپراتور برای هر فعالیت مستقل خواهد بود.'], next: 'سپس «گروه‌ها و مجازها» را تنظیم کنید.' },
    allowances: { steps: ['دسته‌های مجاز پروژه را تعریف کنید (مثلاً استراحت شخصی، نیازهای طبیعی، خستگی).', 'گروه‌های فعالیت بسازید و درصد هر دسته را در سطح گروه تعیین کنید.', 'فعالیت را به گروه تخصیص دهید؛ مقادیر به‌صورت ارث‌بری اعمال می‌شوند.', 'در صورت نیاز، هر دسته را در سطح فعالیت بازنویسی (Override) کنید.'], next: 'سپس ارزیابی وستینگهاوس عناصر را انجام دهید.' },
    westinghouse: { steps: ['جدول مرجع و منبع/نسخه آن را بازبینی کنید؛ جدول Seed صرفاً نقطه شروع است.', 'برای هر عنصر کاری، چهار عامل مهارت/تلاش/شرایط/یکنواختی را ارزیابی کنید.', 'ضریب R = ۱ + مجموع عوامل؛ برای هر عنصر یک‌بار ثبت و به همه مشاهدات همان عنصر اعمال می‌شود.', 'در صورت نیاز، ارزیابی را از عنصر مشابه کپی کنید.'], next: 'سپس در «زمان‌سنجی» جلسه بسازید و چرخه‌ها را ثبت کنید.' },
    timing: { steps: ['جلسه = فعالیت × اپراتور × روش کرنومتر؛ برای هر ترکیب جلسهٔ جدا بسازید.', 'روش را انتخاب کنید: برگشت به صفر (مقدار مستقل) یا پیوسته (قرائت تجمعی؛ تفاضل خودکار محاسبه می‌شود).', 'مقادیر را دستی وارد یا از Excel چندسلولی Paste کنید؛ پیش‌نمایش تطبیق ستون‌ها را ببینید.', 'برای عناصر هم‌زمان، در جزئیات چرخه بازهٔ مستقل (شروع/پایان) ثبت کنید؛ زمان سپری‌شده از گسترهٔ بازه‌ها به دست می‌آید نه جمع مدت‌ها.', 'خطای ورودی و دادهٔ مشکوک نمایش داده می‌شود؛ دادهٔ مشکوک فقط هشدار است و حذف نمی‌شود.'], next: 'سپس «تحلیل نتایج» را بازبینی کنید و مشکوک‌ها را تصمیم‌گیری کنید.' },
    analysis: { steps: ['کارت‌های خلاصه را ببینید: پیشرفت نمونه، مشاهدات در محاسبات و نیازمند بازبینی.', 'برای هر عنصر، آمار کامل (میانگین، میانه، SD، CV و بازهٔ اطمینان) و OT/NT/ST را بازبینی کنید.', 'مشاهدات مشکوک را بررسی کنید: نگه‌داشتن (هشدار ≠ حذف) یا خروج با ثبت دلیل — دادهٔ خام همیشه حفظ می‌شود.', 'تغییر پارامتر مؤثر (ارزیابی، مجاز، روش) نتیجه را «نیازمند محاسبه مجدد» می‌کند؛ با دکمهٔ اجرای محاسبه نسخه جدید ثبت کنید.'], next: 'سپس «نمودار فرایند» را بازبینی و در پایان از «داشبورد» شاخص‌ها را ببینید.' },
    charts: { steps: ['با بازکردن این مرحله، گره‌ها خودکار از فعالیت‌ها ساخته می‌شوند (OPC: عملیات/بازرسی؛ FPC: هر پنج نوع).', 'توالی را با اتصال گره‌ها یا دکمه‌های ترتیب بالا/پایین کامل کنید.', 'گرهٔ دستی اضافی (مثلاً کنترل کیفیت) را در صورت نیاز اضافه کنید.', 'با درگ، چیدمان را شخصی کنید؛ مختصات ذخیره می‌شود و چیدمان خودکار جای آن را نمی‌گیرد.'], next: 'سپس «داشبورد» را برای شاخص‌های کلان و «گزارش‌ها» را برای خروجی باز کنید.' },
    dashboard: { steps: ['ابتدا کارت‌های خلاصه: زمان استاندارد (در صورت قابل محاسبه بودن)، میانگین چرخه، تعداد نمونه و وضعیت هدف.', 'اگر داده کافی نباشد، کارت علت را نشان می‌دهد — هرگز صفر یا مقدار ساختگی نمی‌بینید.', 'نمودارهای تخصصی را در بخش‌های بازشونده ببینید: مقایسهٔ فعالیت‌ها، توزیع وضعیت، اپراتورها و پراکندگی.', 'از «شخصی‌سازی»، کارت‌ها و نمودارها را مرتب یا مخفی کنید؛ چیدمان ذخیره می‌شود.', 'بخش «نیازهای بازبینی» موارد باقی‌مانده را با میان‌بر اقدام نشان می‌دهد.'], next: 'در پایان، گزارش رسمی را از «گزارش‌ها» تهیه و نهایی‌سازی کنید.' },
    reports: { steps: ['نوع گزارش Excel را انتخاب کنید: نگاه کل، خلاصه محاسبات، مقایسه اپراتورها یا داده‌های خام.', 'با فیلتر فعالیت/اپراتور، خروجی را محدود کنید؛ فیلتر هم روی Excel و هم گزارش رسمی اعمال می‌شود.', 'گزارش رسمی (پیش‌نمایش کاغذ A4) شامل فرمول‌ها، روش کرنومتر، وستینگهاوس، مجازها و داده‌های خارج‌شده است.', 'با «چاپ / ذخیره PDF» از پنجرهٔ چاپ مرورگر، PDF بومی و کاملاً آفلاین بسازید.', 'گزارش، نتیجهٔ نیازمند بازبینی را استاندارد قطعی معرفی نمی‌کند و موارد بازبینی را فهرست می‌کند.'], next: 'با اطمینان از داده‌ها، مطالعه را از «مشخصات پروژه» نهایی کنید (ویرایش باز می‌ماند).' },
    data: { steps: ['پشتیبان‌گیری خودکار را فعال کنید؛ نسخه‌ها در حافطهٔ همین مرورگر می‌مانند.', 'برای نگهداری بلندمدت، نسخهٔ پشتیبان را به‌صورت فایل دانلود کنید.', 'بستهٔ کامل پروژه را برای انتقال به سیستم دیگر خروجی بگیرید.', 'تاریخچهٔ تغییرات، رویدادهای مهم را با جزئیات نشان می‌دهد.'], next: 'نسخهٔ پشتیبان فایل، تنها راه انتقال داده بین مرورگرها/سیستم‌ها است.' },
  };

  var STAGE_ICONS = { info: 'settings2', structure: 'network', operators: 'users', allowances: 'percent', westinghouse: 'gauge', timing: 'timer', analysis: 'barChart', charts: 'workflow', dashboard: 'layoutDashboard', reports: 'fileText', data: 'databaseBackup' };

  var helpOpen = true;

  function renderChrome() {
    var shell = U.$('#app-root');
    U.clear(shell);
    if (route.name === 'home') {
      shell.appendChild(U.h('div', { id: 'view-container', class: 'animate-view-in' }));
      return;
    }
    var project = DB.getProject(route.projectId);
    if (!project) {
      shell.appendChild(U.h('div', { class: 'min-h-screen flex items-center justify-center p-6' },
        UI.emptyState({ title: 'پروژه یافت نشد', desc: 'این پروژه حذف شده یا شناسه آن نامعتبر است.', icon: 'package' })));
      return;
    }
    var summary = DB.getProjectSummary(project.id);

    var shellEl = U.h('div', { class: 'app-shell' });

    var topbar = U.h('header', { class: 'topbar no-print' },
      U.h('button', { class: 'icon-btn md:hidden', 'aria-label': 'بازکردن منوی مراحل', onclick: openMobileMenu }, U.icon('moreVertical')),
      U.h('button', { class: 'btn btn-ghost btn-sm', 'aria-label': 'بازگشت به فهرست پروژه‌ها', onclick: function () { navigate('/'); } }, U.icon('home'), U.h('span', { class: 'hidden sm:inline', text: 'پروژه‌ها' })),
      U.h('div', { class: 'divider-v hidden md:block', style: { height: '22px', alignSelf: 'center' } }),
      U.h('div', { class: 'min-w-0 flex-1' },
        U.h('div', { class: 'flex items-center gap-2' },
          U.h('span', { class: 'font-extrabold text-sm truncate', text: project.name }),
          UI.projectStatusBadge(project.status)),
        U.h('div', { class: 'text-xs text-faint truncate', text: project.lineName + ' · ' + project.productName })),
      !summary.finalized && route.name === 'project' ? U.h('button', { class: 'btn btn-sm btn-green-outline', onclick: showFinalizeDialog }, U.icon('flag'), 'نهایی‌سازی') : null,
      U.h('button', { class: 'icon-btn', 'aria-label': document.documentElement.classList.contains('dark') ? 'تم روشن' : 'تم تیره', onclick: toggleTheme }, U.icon(document.documentElement.classList.contains('dark') ? 'sun' : 'moon')),
      U.h('button', { class: 'icon-btn', 'aria-label': 'تنظیمات نمایش', onclick: showDisplaySettings }, U.icon('settings')),
      U.h('button', { class: 'icon-btn' + (helpOpen ? ' brand' : ''), 'aria-label': helpOpen ? 'بستن راهنمای مرحله' : 'نمایش راهنمای مرحله', onclick: function () { helpOpen = !helpOpen; renderChrome(); renderView(); } }, U.icon('circleHelp'))
    );

    var sidebar = U.h('aside', { class: 'sidebar no-print', 'aria-label': 'منوی پروژه' });
    var stages = DB.CONST.STUDY_STAGES;
    var nav = U.h('nav', { class: 'flex flex-col gap-1' });
    nav.appendChild(U.h('div', { class: 'flex items-center gap-2 px-2 py-3 mb-1' },
      U.h('span', { class: 'chip-icon' }, U.icon('timer')),
      U.h('div', { class: 'sidebar-head-text' },
        U.h('div', { class: 'font-bold text-sm', text: 'مراحل مطالعه' }),
        U.h('div', { class: 'text-xs text-faint', text: 'جابه‌جایی آزاد بین مراحل' }))));
    stages.forEach(function (st) {
      var stageState = summary.stages[st.key] || { status: 'PENDING' };
      var active = route.name === 'project' && route.stage === st.key;
      nav.appendChild(U.h('a', {
        class: 'nav-item' + (active ? ' active' : ''), href: '#/p/' + project.id + '/' + st.key,
        'aria-current': active ? 'page' : null,
      },
        U.h('span', { class: 'stage-dot ' + stageState.status, title: DB.CONST.STAGE_STATUS_LABELS[stageState.status] }),
        U.icon(STAGE_ICONS[st.key] || 'circleHelp'),
        U.h('span', { class: 'sidebar-label' },
          U.h('span', { class: 'block', text: st.label }),
          U.h('span', { class: 'sidebar-desc block text-xs text-faint font-normal', text: st.desc }))));
    });
    nav.appendChild(U.h('div', { class: 'text-xs text-faint px-2 pt-4 pb-1 sidebar-label', text: 'ابزارها' }));
    var dataActive = route.name === 'project' && route.stage === 'data';
    nav.appendChild(U.h('a', { class: 'nav-item' + (dataActive ? ' active' : ''), href: '#/p/' + project.id + '/data' },
      U.icon('databaseBackup'),
      U.h('span', { class: 'sidebar-label' },
        U.h('span', { class: 'block', text: 'داده و پشتیبان' }),
        U.h('span', { class: 'sidebar-desc block text-xs text-faint font-normal', text: 'پشتیبان‌گیری، بازیابی، بسته پروژه و تاریخچه' }))));
    sidebar.appendChild(nav);

    var helpPanel = U.h('aside', { class: 'no-print', style: { width: '288px', flexShrink: 0 } });
    if (helpOpen) {
      var stageKey = route.name === 'activity' ? 'structure' : (route.stage || 'info');
      var guide = STAGE_GUIDES[stageKey];
      var stageLabel = route.name === 'activity' ? 'ساختار تولید' : ((DB.CONST.STUDY_STAGES.find(function (s) { return s.key === stageKey; }) || {}).label);
      var stageState = summary.stages[stageKey] || { status: 'PENDING', hint: '' };
      var panelInner = U.h('div', { class: 'card p-4 sticky', style: { top: '72px' } },
        U.h('div', { class: 'flex items-center gap-2 mb-3' }, U.icon('lightbulb'), U.h('span', { class: 'font-bold text-sm', text: 'راهنمای مرحله' })),
        U.h('div', { class: 'text-xs text-muted mb-1', text: stageLabel }),
        U.h('div', { class: 'mb-3' }, U.h('div', { class: 'text-xs text-muted mb-1', text: 'وضعیت این مرحله:' }), UI.stageStatusBadge(stageState.status, DB.CONST.STAGE_STATUS_LABELS[stageState.status])),
        guide ? U.h('ol', { class: 'list-none flex flex-col gap-2 text-xs leading-relaxed' },
          guide.steps.map(function (s, i) { return U.h('li', { class: 'flex gap-2' }, U.h('span', { class: 'badge brand shrink-0', text: U.formatInt(i + 1) }), U.h('span', { text: s })); }),
          U.h('li', { class: 'flex gap-2 bg-brand-soft rounded-md p-2 mt-1', style: { color: 'var(--accent-foreground)' } }, U.icon('arrowLeft'), U.h('span', { text: 'اقدام بعدی پیشنهادی: ' + guide.next }))) : null,
        stageState.hint ? U.h('div', { class: 'text-xs text-muted mt-3 pt-3 border-t', text: stageState.hint }) : null,
        U.h('button', { class: 'btn btn-ghost btn-sm w-full mt-3', onclick: function () { helpOpen = false; renderChrome(); renderView(); } }, 'جمع‌کردن پنل راهنما'));
      helpPanel.appendChild(U.h('div', { class: 'hidden xl:block' }, panelInner));
    } else {
      helpPanel.appendChild(U.h('button', {
        class: 'btn btn-outline btn-sm', style: { writingMode: 'vertical-rl', position: 'sticky', top: '72px', padding: '14px 6px' },
        onclick: function () { helpOpen = true; renderChrome(); renderView(); },
      }, 'راهنمای مرحله'));
    }

    var footer = U.h('footer', { class: 'app-footer no-print' },
      U.h('div', { class: 'flex items-center gap-2' },
        U.h('span', { class: 'font-bold', text: 'زمان‌سنجی صنعتی' }),
        U.h('span', { text: '·' }),
        U.h('span', { text: 'نسخه اول — کامل (۷ فاز) — نسخه آفلاین ۱٫۰' })),
      U.h('div', { class: 'flex items-center gap-3' },
        U.h('span', { class: 'flex items-center gap-1', title: 'بدون هیچ درخواست خارجی در زمان اجرا' }, U.icon('wifiOff'), 'کارکرد کاملاً آفلاین'),
        U.h('span', { class: 'flex items-center gap-1', title: 'داده‌ها در حافظهٔ همین مرورگر ذخیره می‌شوند' }, U.icon('shieldCheck'), 'داده محلی و امن')));

    var body = U.h('div', { class: 'shell-body' },
      sidebar,
      U.h('main', { id: 'main-content', class: 'main-content scroll-slim' },
        U.h('div', { id: 'view-container', class: 'animate-view-in' })),
      U.h('div', { class: 'hidden lg:block' }, helpPanel));
    shellEl.appendChild(topbar);
    shellEl.appendChild(body);
    shellEl.appendChild(footer);
    shell.appendChild(shellEl);
  }

  function openMobileMenu() {
    var project = DB.getProject(route.projectId);
    if (!project) return;
    var summary = DB.getProjectSummary(project.id);
    var panel = U.h('div', { class: 'sheet-panel flex flex-col gap-1' });
    DB.CONST.STUDY_STAGES.forEach(function (st) {
      var stageState = summary.stages[st.key] || { status: 'PENDING' };
      panel.appendChild(U.h('a', {
        class: 'nav-item' + (route.stage === st.key ? ' active' : ''), href: '#/p/' + project.id + '/' + st.key,
        onclick: function () { close(); },
      }, U.h('span', { class: 'stage-dot ' + stageState.status }), U.icon(STAGE_ICONS[st.key] || 'circleHelp'), U.h('span', { text: st.label })));
    });
    panel.appendChild(U.h('div', { class: 'dd-sep' }));
    panel.appendChild(U.h('a', { class: 'nav-item' + (route.stage === 'data' ? ' active' : ''), href: '#/p/' + project.id + '/data', onclick: function () { close(); } }, U.icon('databaseBackup'), 'داده و پشتیبان'));
    var root;
    function close() { if (root.parentNode) root.parentNode.removeChild(root); }
    root = U.h('div', { class: 'mobile-menu-sheet no-print' },
      U.h('div', { class: 'sheet-backdrop', onclick: close }),
      U.h('div', { class: 'sheet-panel', role: 'dialog', 'aria-label': 'منوی مراحل' },
        U.h('div', { class: 'flex items-center justify-between mb-2' },
          U.h('span', { class: 'font-bold', text: 'مراحل مطالعه' }),
          U.h('button', { class: 'icon-btn', 'aria-label': 'بستن منو', onclick: close }, U.icon('x'))),
        panel));
    document.body.appendChild(root);
  }

  function showFinalizeDialog() {
    var project = DB.getProject(route.projectId);
    var reason = '';
    UI.dialog({
      title: 'نهایی‌سازی مطالعه',
      desc: 'وضعیت مطالعه «نهایی‌شده» می‌شود اما ویرایش قفل نمی‌شود؛ پس از هر تغییر مؤثر، نتایج «نیازمند محاسبه مجدد» خواهند شد.',
      bodyBuilder: function (body) {
        body.appendChild(U.h('div', { class: 'banner warning' }, U.icon('alertTriangle'),
          U.h('div', { text: 'اگر تعداد نمونه به هدف نرسیده، رسیدن به هدف فقط به معنای «تکمیل تعداد ثبت‌شده» است و اثبات کفایت آماری محسوب نمی‌شود. دلیل نهایی‌سازی را ثبت کنید.' })));
        var ta = U.h('textarea', { class: 'textarea', placeholder: 'مثال: به دلیل محدودیت دسترسی به خط، با ۱۲ نمونه از ۱۵ نمونه هدف نهایی شد.' });
        ta.addEventListener('input', function () { reason = ta.value; });
        body.appendChild(UI.field('دلیل نهایی‌سازی', ta));
      },
      footerBuilder: function (close) {
        return U.h('div', { class: 'dialog-footer' },
          U.h('button', { class: 'btn', text: 'انصراف', onclick: close }),
          U.h('div', { class: 'spacer' }),
          U.h('button', {
            class: 'btn btn-brand', text: 'نهایی‌سازی مطالعه',
            onclick: function () {
              try {
                DB.finalizeProject(project.id, reason);
                close();
                UI.toast('مطالعه «' + project.name + '» نهایی شد. ویرایش همچنان باز است.');
                renderChrome(); renderView();
              } catch (err) { UI.toastError(err); }
            },
          }));
      },
    });
  }

  function showDisplaySettings() {
    var prefs = DB.getDisplayPrefs();
    var calendar = prefs.calendar, digits = prefs.digits, decimals = prefs.decimals;
    UI.dialog({
      title: 'تنظیمات نمایش',
      desc: 'این تنظیمات فقط نحوه نمایش را تغییر می‌دهند؛ داده‌های ذخیره‌شده و محاسبات دست‌نخورده می‌مانند.',
      bodyBuilder: function (body) {
        function radioGroup(label, options, value, onChange) {
          var wrap = U.h('div', null, U.h('div', { class: 'field-label', text: label }));
          options.forEach(function (o) {
            var card = U.h('label', { class: 'radio-card' + (value === o.value ? ' selected' : '') },
              U.h('input', { type: 'radio', name: label, checked: value === o.value, style: { accentColor: 'var(--brand)' } }),
              U.h('span', { text: o.label }));
            card.querySelector('input').addEventListener('change', function () { onChange(o.value); body.querySelectorAll('.radio-card').forEach(function (c) { c.classList.remove('selected'); }); card.classList.add('selected'); });
            wrap.appendChild(card);
          });
          return wrap;
        }
        body.appendChild(radioGroup('تقویم', [{ value: 'jalali', label: 'شمسی (پیش‌فرض)' }, { value: 'gregorian', label: 'میلادی' }], calendar, function (v) { calendar = v; }));
        body.appendChild(radioGroup('ارقام', [{ value: 'persian', label: 'فارسی (۱۲۳)' }, { value: 'latin', label: 'لاتین (123)' }], digits, function (v) { digits = v; }));
        body.appendChild(U.h('div', null,
          U.h('label', { class: 'field-label', text: 'ارقام اعشار نمایش زمان‌ها' }),
          UI.selectEl([1, 2, 3, 4].map(function (d) { return { value: String(d), label: U.formatInt(d) + ' رقم' }; }), String(decimals), function (v) { decimals = parseInt(v, 10); })));
        body.appendChild(U.h('div', { class: 'banner info' }, U.icon('info'), U.h('div', { text: 'گردکردن فقط نمایشی است؛ مقدار خام و محاسبات با دقت کامل ذخیره می‌شوند.' })));
      },
      footerBuilder: function (close) {
        return U.h('div', { class: 'dialog-footer' },
          U.h('button', { class: 'btn', text: 'انصراف', onclick: close }),
          U.h('div', { class: 'spacer' }),
          U.h('button', {
            class: 'btn btn-brand', text: 'ذخیره',
            onclick: function () {
              DB.setDisplayPrefs({ calendar: calendar, digits: digits, decimals: decimals });
              close();
              UI.toast('تنظیمات نمایش ذخیره شد.');
              renderChrome(); renderView();
            },
          }));
      },
    });
  }

  function renderView() {
    var container = U.$('#view-container');
    if (!container) return;
    U.clear(container);
    var views = g.T2VIEWS || {};
    try {
      if (route.name === 'home') {
        if (views.home) views.home(container);
        else container.appendChild(UI.emptyState({ title: 'ماژول خانه در حال بارگذاری است', icon: 'timer' }));
      } else if (route.name === 'activity') {
        if (views.activity) views.activity(container, route.projectId, route.activityId);
        else container.appendChild(UI.emptyState({ title: 'ماژول صفحه فعالیت در حال بارگذاری است', icon: 'timer' }));
      } else {
        var fn = views[route.stage];
        if (fn) fn(container, route.projectId);
        else container.appendChild(UI.emptyState({ title: 'این بخش در این نسخه در دسترس نیست.', desc: 'ماژول «' + route.stage + '» یافت نشد.', icon: 'circleHelp' }));
      }
    } catch (err) {
      console.error(err);
      container.appendChild(U.h('div', { class: 'banner error mt-4' }, U.icon('alertTriangle'), U.h('div', null, 'خطا در نمایش این بخش: ' + (err && err.message ? err.message : err))));
    }
    var main = U.$('#main-content');
    if (main) main.scrollTop = 0;
  }

  function boot() {
    route = parseHash();
    initTheme();
    renderChrome();
    renderView();
    if (g.location.search.indexOf('demo=1') >= 0 && DB.getState().projects.length === 0) {
      DB.seedDemo();
      UI.toast('داده دمو بارگذاری شد', { description: 'پروژه نمایشی کامل برای تست همه بخش‌ها ایجاد شد.' });
      route = parseHash(); renderChrome(); renderView();
    }
    if (!DB.isStorageOk()) {
      UI.toast('ذخیره‌سازی مرورگر در دسترس نیست', { type: 'error', description: 'داده‌ها فقط تا بستن صفحه باقی می‌مانند؛ از خروجی بسته/پشتیبان استفاده کنید.' });
    }
  }

  g.addEventListener('hashchange', function () {
    route = parseHash();
    if (route.name === 'home') { renderChrome(); renderView(); return; }
    renderChrome();
    renderView();
  });

  g.setInterval(function () {
    DB.autoBackupTick().catch(function () {});
  }, 60000);

  g.T2APP = { navigate: navigate, refresh: function () { renderChrome(); renderView(); }, route: function () { return route; }, STAGE_GUIDES: STAGE_GUIDES };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
