/* ═══════════════════════════════════════════════════════════
   views-allowances.js — «گروه‌ها و مجازها» (مرحله ۴ مطالعه)
   گروه‌های فعالیت + دسته‌های مجاز — FR-04 / FR-15 / FR-23 / FR-26
   • زبانه گروه‌ها: فهرست انتخابی ستون چپ (w-72 در lg) + پنل
     جزئیات راست با ذخیره خودکار نام/شرح (debounce ۸۰۰ms) و
     مقادیر مجاز هر دسته (debounce ۶۰۰ms) + جمع A دسته‌های فعال
   • زبانه دسته‌ها: جدول وضعیت/شمارش وابستگی + ایجاد/ویرایش/حذف
   • درصدها: کاربر عدد درصد می‌بیند؛ ذخیره به‌صورت مقدار اعشاری
   ═══════════════════════════════════════════════════════════ */
(function (g) {
  'use strict';
  var U = g.T2U, DB = g.T2DB, UI = g.T2UI;
  g.T2VIEWS = g.T2VIEWS || {};

  function appNavigate(hash) { if (g.T2APP) g.T2APP.navigate(hash); }

  // انتخاب زبانه/گروه بین رندرها حفظ می‌شود (closure سطح ماژول)
  var activeTab = 'groups';
  var selectedGroupId = null;

  // کلاس lg:w-72 در app.css موجود نیست؛ معادل آن یک‌بار تزریق می‌شود
  function ensureStyles() {
    if (document.getElementById('t2a-styles')) return;
    var st = document.createElement('style');
    st.id = 't2a-styles';
    st.textContent =
      '.t2a-split{display:flex;flex-direction:column;gap:16px;align-items:flex-start;}' +
      '.t2a-side{width:100%;min-width:0;}' +
      '.t2a-main{flex:1 1 0%;min-width:0;width:100%;}' +
      '@media (min-width:1024px){.t2a-split{flex-direction:row;}' +
      '.t2a-side{width:288px;flex:0 0 288px;}}';
    document.head.appendChild(st);
  }

  // ── محتوای راهنمای آیکونی (عیناً از مشخصات) ──
  var GROUP_HELP = {
    what: 'گروه فعالیت، بسته‌ای از مقادیر مجاز است که هر فعالیت می‌تواند به آن تخصیص یابد و مقادیر را از آن به ارث ببرد؛ در سطح فعالیت هر دسته قابل بازنویسی است.',
    input: 'گروه بسازید، دسته‌های مجاز را درصدگذاری کنید و فعالیت‌ها را از مرحله «ساختار تولید» به گروه تخصیص دهید.',
    example: 'گروه «کار دستی» یا «کار ماشینی» — یا گروه‌های اختصاصی شرکت شما.',
    note: 'مجموع A فقط از دسته‌های فعال ساخته می‌شود؛ منبع هر مقدار (ارث‌رسیده از گروه یا اختصاصی فعالیت) در صفحه فعالیت مشخص می‌شود.',
  };
  var GROUP_NAME_HELP = {
    what: 'نامی گویا برای بسته مجازهای فعالیت؛ فعالیت‌ها در ساختار تولید به این گروه تخصیص می‌یابند.',
    input: 'نام کوتاه و معنادار.',
    example: '«کار دستی»، «کار ماشینی» یا گروه اختصاصی شرکت.',
  };
  var GROUP_ALLOW_HELP = {
    what: 'مقدار درصدی هر دسته مجاز برای این گروه؛ فعالیت‌های این گروه این مقادیر را به ارث می‌برند و می‌توانند هر دسته را بازنویسی کنند.',
    input: 'عدد درصد وارد کنید (۰ تا ۹۹٫۹۹)؛ خالی بگذارید تا آن دسته مقداری نداشته باشد.',
    example: 'استراحت شخصی ۵٪ + نیازهای طبیعی ۳٪ ⇒ A=۸٪ — صرفاً مثال؛ نرخ مصوب شرکت شما جایگزین شود',
    note: 'فقط دسته‌های فعال در مجموع A لحاظ می‌شوند؛ درصدها به‌صورت مقدار اعشاری (۰٫۱۵ برای ۱۵٪) ذخیره می‌شوند.',
  };
  var CATEGORY_HELP = {
    what: 'دسته مجاز، جزء تشکیل‌دهنده مجموع A است که در سطح گروه درصدگذاری می‌شود و فعالیت می‌تواند مقدار آن را بازنویسی کند.',
    input: 'نام و کد اختیاری وارد کنید؛ ترتیب نمایش با فیلد «ترتیب» تنظیم می‌شود.',
    example: 'دسته‌هایی مانند استراحت شخصی یا نیازهای طبیعی — درصد نمونه صرفاً مثال است و نرخ مصوب شرکت نیست.',
    note: 'حذف دسته، مقدار آن در گروه‌ها و بازنویسی‌های فعالیت را نیز حذف می‌کند؛ دسته غیرفعال در مجموع A لحاظ نمی‌شود.',
  };
  var SORT_HELP = {
    what: 'ترتیب نمایش دسته در جدول‌های گروه و گزارش‌ها؛ عدد کوچک‌تر بالاتر.',
    input: 'عدد صحیح بین ۰ تا ۹۹۹۹.',
  };

  g.T2VIEWS.allowances = function (container, projectId) {
    ensureStyles();

    // ═══════════ رندر کل نما ═══════════
    function renderAll() {
      U.clear(container);
      var groups = DB.listGroups(projectId);
      var categories = DB.listCategories(projectId);

      container.appendChild(U.h('div', { class: 'flex flex-wrap items-center justify-between gap-3' },
        U.h('div', { class: 'flex items-center gap-3' },
          U.h('span', { class: 'chip-icon' }, U.icon('layers')),
          U.h('div', null,
            U.h('h1', { class: 'text-xl font-extrabold', text: 'گروه‌ها و مجازها' }),
            U.h('p', { class: 'text-sm text-muted' },
              U.formatInt(groups.length) + ' گروه · ' + U.formatInt(categories.length) + ' دسته مجاز')))));

      container.appendChild(U.h('div', { class: 'mt-4' }, UI.tabsBar([
        { key: 'groups', label: 'گروه‌های فعالیت' },
        { key: 'categories', label: 'دسته‌های مجاز' },
      ], activeTab, function (k) { activeTab = k; renderAll(); })));

      var wrap = U.h('div', { class: 'mt-4 flex flex-col gap-4' });
      container.appendChild(wrap);
      if (activeTab === 'groups') renderGroupsTab(wrap, groups, categories);
      else renderCategoriesTab(wrap, categories);
    }

    // ═══════════ زبانه گروه‌های فعالیت — FR-04 ═══════════
    function renderGroupsTab(wrap, groups, categories) {
      var split = U.h('div', { class: 't2a-split' });
      var side = U.h('div', { class: 't2a-side flex flex-col gap-2', 'aria-label': 'فهرست گروه‌های فعالیت' });
      var main = U.h('div', { class: 't2a-main' });
      split.appendChild(side);
      split.appendChild(main);
      wrap.appendChild(split);

      // ردیف بالای ستون چپ
      side.appendChild(U.h('div', { class: 'flex items-center gap-2' },
        U.h('h3', { class: 'font-bold', text: 'گروه‌ها' }),
        U.h('div', { class: 'spacer' }),
        U.h('button', {
          class: 'btn btn-brand btn-sm', type: 'button',
          onclick: function () { openCreateGroup(); },
        }, U.icon('plus'), 'گروه جدید')));

      if (groups.length === 0) {
        side.appendChild(UI.emptyState({
          icon: 'layers',
          title: 'گروهی تعریف نشده',
          desc: 'گروه‌های دلخواه مانند کار دستی یا کار ماشینی بسازید؛ فعالیت‌ها مجازهای گروه را به ارث می‌برند و امکان بازنویسی دارند.',
          actionLabel: 'ثبت اولین گروه',
          onAction: function () { openCreateGroup(); },
        }));
        side.appendChild(U.h('div', { class: 'flex justify-center' },
          UI.helpDot('گروه فعالیت', GROUP_HELP)));
        main.appendChild(U.h('div', { class: 'banner info' }, U.icon('info'),
          U.h('div', { text: 'گروهی را از فهرست انتخاب کنید' })));
        return;
      }

      // گروه انتخاب‌شده (بدون انتخاب خودکار — تا رندر نشان «گروهی را انتخاب کنید» بدهد)
      var sel = null;
      groups.forEach(function (x) { if (x.group.id === selectedGroupId) sel = x; });

      var nameEls = {};   // به‌روزرسانی هدفمند نام گروه در فهرست پس از ذخیره خودکار
      var badgeEls = {};  // به‌روزرسانی نشان «جمع A» پس از ذخیره مقدار مجاز
      groups.forEach(function (gr) {
        var isSel = gr.group.id === selectedGroupId;
        var nameDiv = U.h('div', { class: 'font-semibold text-sm truncate' });
        nameDiv.textContent = gr.group.name;
        var badgeEl = UI.badge('جمع A: ' + U.formatPercent(gr.totalA), 'brand');
        nameEls[gr.group.id] = nameDiv;
        badgeEls[gr.group.id] = badgeEl;
        side.appendChild(U.h('div', {
          class: 'list-row cursor-pointer', role: 'button', tabindex: '0',
          'aria-pressed': isSel ? 'true' : 'false',
          'aria-label': 'انتخاب گروه ' + gr.group.name,
          style: isSel ? { outline: '2px solid var(--brand)' } : null,
          onclick: function () { selectedGroupId = gr.group.id; renderAll(); },
          onkeydown: function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectedGroupId = gr.group.id; renderAll(); }
          },
        },
          U.h('div', { class: 'flex-1 min-w-0' },
            nameDiv,
            U.h('div', { class: 'text-xs text-muted truncate', title: gr.group.description || '' },
              gr.group.description || 'بدون توضیح')),
          U.h('div', { class: 'flex flex-col items-end gap-1 shrink-0' },
            badgeEl,
            U.h('span', { class: 'text-xs text-faint' }, U.formatInt(gr.activitiesCount) + ' فعالیت'))));
      });

      if (!sel) {
        main.appendChild(U.h('div', { class: 'banner info' }, U.icon('info'),
          U.h('div', { text: 'گروهی را از فهرست انتخاب کنید' })));
      } else {
        main.appendChild(buildGroupDetail(sel, categories, nameEls, badgeEls));
      }
    }

    // ═══════════ پنل جزئیات گروه انتخاب‌شده ═══════════
    function buildGroupDetail(gr, categories, nameEls, badgeEls) {
      var groupId = gr.group.id;
      var panel = U.h('div', { class: 'flex flex-col gap-4' });

      // ── ۱) جزئیات گروه — ذخیره خودکار نام/شرح (debounce ۸۰۰ms) ──
      var allowTitleSpan = U.h('span', { text: 'مجازهای گروه «' + gr.group.name + '»' });
      var metaIndHost = U.h('span');
      function setMetaInd(state) {
        U.clear(metaIndHost);
        var el = UI.saveIndicator(state);
        if (el) metaIndHost.appendChild(el);
      }

      var nameVal = gr.group.name;
      var descVal = gr.group.description || '';
      var nameInput = U.h('input', { class: 'input', value: nameVal, 'aria-label': 'نام گروه' });
      var descTa = U.h('textarea', { class: 'textarea', 'aria-label': 'شرح گروه' });
      descTa.value = descVal;

      var saveMeta = U.debounce(function () {
        if (!String(nameVal).trim()) return; // نام خالی معتبر نیست؛ تا تکمیل نام ذخیره نمی‌شود
        setMetaInd('saving');
        try {
          var nm = String(nameVal).trim();
          DB.updateGroup(groupId, { name: nm, description: String(descVal).trim() || null });
          setMetaInd('saved');
          allowTitleSpan.textContent = 'مجازهای گروه «' + nm + '»';
          if (nameEls[groupId]) nameEls[groupId].textContent = nm;
          setTimeout(function () { setMetaInd(null); }, 2400);
        } catch (err) { setMetaInd('error'); UI.toastError(err); }
      }, 800);

      nameInput.addEventListener('input', function () { nameVal = nameInput.value; setMetaInd('dirty'); saveMeta(); });
      descTa.addEventListener('input', function () { descVal = descTa.value; setMetaInd('dirty'); saveMeta(); });

      panel.appendChild(U.h('div', { class: 'card p-4' },
        U.h('div', { class: 'flex flex-wrap items-center justify-between gap-2' },
          U.h('h3', { class: 'font-bold', text: 'جزئیات گروه' }),
          metaIndHost),
        U.h('div', { class: 'mt-4 flex flex-col gap-3' },
          UI.field('نام گروه', nameInput, GROUP_NAME_HELP),
          UI.field('شرح', descTa)),
        U.h('div', { class: 'mt-4 pt-3 border-t flex items-center justify-end' },
          U.h('button', {
            class: 'btn btn-destructive-outline btn-sm', type: 'button',
            'aria-label': 'حذف گروه ' + gr.group.name,
            onclick: function () { deleteGroupFlow(gr); },
          }, U.icon('trash'), 'حذف گروه'))));

      // ── ۲) مجازهای گروه — ذخیره خودکار مقدار هر دسته (debounce ۶۰۰ms) ──
      var allowIndHost = U.h('span');
      function setAllowInd(state) {
        U.clear(allowIndHost);
        var el = UI.saveIndicator(state);
        if (el) allowIndHost.appendChild(el);
      }

      var card2 = U.h('div', { class: 'card p-4' },
        U.h('div', { class: 'flex flex-wrap items-center justify-between gap-2' },
          U.h('h3', { class: 'font-bold flex items-center gap-1' }, allowTitleSpan,
            UI.helpDot('مجازهای گروه', GROUP_ALLOW_HELP)),
          allowIndHost));

      var totalCell = null;
      if (categories.length === 0) {
        card2.appendChild(U.h('div', { class: 'banner info' }, U.icon('info'),
          U.h('div', { class: 'flex flex-col items-start gap-2' },
            U.h('span', { text: 'هنوز دسته مجازی برای این پروژه تعریف نشده است؛ ابتدا از زبانه «دسته‌های مجاز» دسته بسازید تا بتوانید برای این گروه مقدار تعیین کنید.' }),
            U.h('button', {
              class: 'btn btn-ghost btn-sm', type: 'button',
              onclick: function () { activeTab = 'categories'; renderAll(); },
            }, 'رفتن به دسته‌های مجاز'))));
      } else {
        var tbl = UI.table(['دسته مجاز', 'وضعیت', 'مقدار (درصد)'], function (tbody) {
          categories.forEach(function (cat) {
            var ga = null;
            gr.allowances.forEach(function (x) { if (x.categoryId === cat.id) ga = x; });
            var saveIt = U.debounce(function (v) {
              setAllowInd('saving');
              try {
                DB.setGroupAllowance(groupId, cat.id, v);
                setAllowInd('saved');
                refreshTotals();
                setTimeout(function () { setAllowInd(null); }, 2400);
              } catch (err) { setAllowInd('error'); UI.toastError(err); }
            }, 600);
            var pInput = UI.percentInput({
              value: ga ? ga.percentValue : null,
              onChange: function (v) {
                if (typeof v === 'number' && isNaN(v)) return; // ورودی نامعتبر — ذخیره نمی‌شود
                setAllowInd('dirty');
                saveIt(v);
              },
            });
            pInput.setAttribute('aria-label', 'درصد مجاز دسته ' + cat.name);
            tbody.appendChild(U.h('tr', null,
              U.h('td', null,
                U.h('span', { class: 'font-medium' }, cat.name),
                cat.code ? U.h('span', { class: 'ms-2' }, UI.badge(cat.code, 'muted')) : null),
              U.h('td', null, cat.isActive ? UI.badge('فعال', 'green') : UI.badge('غیرفعال', 'muted')),
              U.h('td', null, pInput)));
          });
        });
        totalCell = U.h('td', { class: 'font-bold' });
        totalCell.textContent = U.formatPercent(gr.totalA);
        tbl.querySelector('table').appendChild(U.h('tfoot', null,
          U.h('tr', { style: { background: 'var(--surface-2)' } },
            U.h('td', { colspan: '2', class: 'font-bold' }, 'جمع A (دسته‌های فعال)'),
            totalCell)));
        card2.appendChild(tbl);
      }
      panel.appendChild(card2);

      // به‌روزرسانی هدفمند جمع A (بدون رندر مجدد برای از دست نرفتن فوکوس ورودی‌ها)
      function refreshTotals() {
        var g2 = null;
        DB.listGroups(projectId).forEach(function (x) { if (x.group.id === groupId) g2 = x; });
        if (!g2) return;
        if (totalCell) totalCell.textContent = U.formatPercent(g2.totalA);
        if (badgeEls[groupId]) badgeEls[groupId].textContent = 'جمع A: ' + U.formatPercent(g2.totalA);
      }

      // ── ۳) فعالیت‌های این گروه ──
      var acts = [];
      DB.sortStations(projectId).forEach(function (st) {
        DB.sortActivities(st.id).forEach(function (a) { if (a.groupId === groupId) acts.push({ a: a, st: st }); });
      });
      var card3 = U.h('div', { class: 'card' },
        U.h('div', { class: 'px-4 pt-4' }, U.h('h3', { class: 'font-bold', text: 'فعالیت‌های این گروه' })));
      if (acts.length === 0) {
        card3.appendChild(U.h('p', {
          class: 'p-4 text-sm text-muted leading-relaxed',
          text: 'فعالیتی به این گروه تخصیص داده نشده است؛ تخصیص گروه از مرحله «ساختار تولید» و در جزئیات فعالیت انجام می‌شود.',
        }));
      } else {
        var list = U.h('div', { class: 'flex flex-col gap-2 p-4' });
        acts.forEach(function (x) {
          list.appendChild(U.h('div', { class: 'list-row' },
            U.h('div', { class: 'flex-1 min-w-0' },
              U.h('div', { class: 'text-sm font-medium truncate' }, x.a.name),
              U.h('div', { class: 'text-xs text-muted truncate' }, x.st.name)),
            U.h('div', { class: 'spacer' }),
            U.h('button', {
              class: 'btn btn-ghost btn-sm shrink-0', type: 'button',
              'aria-label': 'مشاهده فعالیت ' + x.a.name,
              onclick: function () { appNavigate('/p/' + projectId + '/activity/' + x.a.id); },
            }, U.icon('arrowLeft'), 'مشاهده')));
        });
        card3.appendChild(list);
      }
      panel.appendChild(card3);

      return panel;
    }

    // ═══════════ دیالوگ گروه جدید ═══════════
    function openCreateGroup() {
      var nameVal = '', descVal = '';
      var nameInput = U.h('input', { class: 'input', placeholder: 'مثلاً: کار دستی سبک', 'aria-label': 'نام گروه' });
      nameInput.addEventListener('input', function () { nameVal = nameInput.value; });
      var descTa = U.h('textarea', { class: 'textarea', 'aria-label': 'شرح گروه (اختیاری)' });
      descTa.addEventListener('input', function () { descVal = descTa.value; });
      UI.dialog({
        title: 'گروه جدید',
        bodyBuilder: function (body) {
          body.appendChild(UI.field('نام گروه', nameInput));
          body.appendChild(UI.field('شرح (اختیاری)', descTa));
        },
        footerBuilder: function (close) {
          return U.h('div', { class: 'dialog-footer' },
            U.h('button', { class: 'btn', type: 'button', text: 'انصراف', onclick: close }),
            U.h('div', { class: 'spacer' }),
            U.h('button', {
              class: 'btn btn-brand', type: 'button',
              onclick: function () {
                if (!nameVal.trim()) { UI.toast('نام گروه الزامی است', { type: 'error' }); return; }
                var grp = DB.createGroup(projectId, { name: nameVal.trim(), description: descVal.trim() || null });
                close();
                selectedGroupId = grp.id;
                UI.toast('گروه ایجاد شد');
                renderAll();
              },
            }, U.icon('plus'), 'ثبت گروه'));
        },
      });
    }

    // ═══════════ حذف گروه — FR-26 ═══════════
    function deleteGroupFlow(gr) {
      // پیش‌نمایش وابستگی‌ها پیش از حذف (ساختار خروجی DB.deleteGroup)
      UI.confirmDelete({
        title: 'حذف گروه فعالیت',
        name: gr.group.name,
        deps: {
          'مقدار مجاز ثبت‌شده در این گروه (حذف می‌شود)': gr.allowances.length,
          'فعالیت — فقط بدون گروه می‌شوند؛ داده آن‌ها حذف نمی‌شود': gr.activitiesCount,
        },
      }).then(function (ok) {
        if (!ok) return;
        try { DB.deleteGroup(gr.group.id); } catch (err) { UI.toastError(err); return; }
        UI.toast('گروه حذف شد');
        if (selectedGroupId === gr.group.id) selectedGroupId = null;
        renderAll();
      });
    }

    // ═══════════ زبانه دسته‌های مجاز — FR-04 ═══════════
    function renderCategoriesTab(wrap, categories) {
      wrap.appendChild(U.h('div', { class: 'flex flex-wrap items-center gap-2' },
        U.h('h3', { class: 'font-bold', text: 'دسته‌های مجاز' }),
        U.h('div', { class: 'spacer' }),
        U.h('button', {
          class: 'btn btn-brand btn-sm', type: 'button',
          onclick: function () { openCreateCategory(); },
        }, U.icon('plus'), 'دسته مجاز جدید'),
        UI.helpDot('دسته مجاز', CATEGORY_HELP)));

      if (categories.length === 0) {
        wrap.appendChild(UI.emptyState({
          icon: 'percent',
          title: 'دسته مجازی تعریف نشده',
          desc: 'دسته‌های مجاز اجزای مجموع A هستند؛ مانند استراحت شخصی یا نیازهای طبیعی. برای درصدگذاری گروه‌ها ابتدا باید دسته بسازید.',
          actionLabel: 'ثبت اولین دسته',
          onAction: function () { openCreateCategory(); },
        }));
      } else {
        var st = DB.getState();
        wrap.appendChild(UI.table(
          ['دسته مجاز', 'وضعیت', 'مقادیر گروه', 'بازنویسی فعالیت', 'آخرین تغییر', ''],
          function (tbody) {
            categories.forEach(function (cat) {
              var gv = st.groupAllowances.filter(function (r) { return r.categoryId === cat.id; }).length;
              var ov = st.activityAllowanceOverrides.filter(function (r) { return r.categoryId === cat.id; }).length;
              tbody.appendChild(U.h('tr', null,
                U.h('td', null,
                  U.h('span', { class: 'font-semibold' }, cat.name),
                  cat.code ? U.h('span', { class: 'ms-2' }, UI.badge(cat.code, 'muted')) : null),
                U.h('td', null, UI.switchEl(cat.isActive, function (v) { toggleCategory(cat, v); },
                  (cat.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی') + ' دسته ' + cat.name)),
                U.h('td', { class: 'text-muted' }, U.formatInt(gv)),
                U.h('td', { class: 'text-muted' }, U.formatInt(ov)),
                U.h('td', { class: 'text-xs text-muted' }, U.formatDateTime(cat.updatedAt)),
                U.h('td', null, U.h('div', { class: 'flex', style: { justifyContent: 'flex-end', gap: '4px' } },
                  U.h('button', {
                    class: 'icon-btn sm', type: 'button', 'aria-label': 'ویرایش دسته ' + cat.name,
                    onclick: function () { openEditCategory(cat); },
                  }, U.icon('pencil')),
                  U.h('button', {
                    class: 'icon-btn sm danger', type: 'button', 'aria-label': 'حذف دسته ' + cat.name,
                    onclick: function () { deleteCategoryFlow(cat); },
                  }, U.icon('trash'))))));
            });
          }));
      }

      // نکته پایین — روش اعمال مجاز — FR-15
      var calc = DB.getCalcSettings(projectId);
      var methodLabel = DB.CONST.ALLOWANCE_METHOD_LABELS[calc.allowanceMethod] || calc.allowanceMethod;
      var formula = DB.CONST.ALLOWANCE_METHOD_FORMULAS[calc.allowanceMethod] || '';
      wrap.appendChild(U.h('div', { class: 'banner plain' }, U.icon('info'),
        U.h('div', null,
          'روش اعمال مجاز: «' + methodLabel + '» با فرمول ',
          U.h('code', { class: 'inline', dir: 'ltr' }, formula),
          calc.allowanceMethod === 'SHARE_OF_ST'
            ? ' — در این روش مجموع A باید کمتر از ۱۰۰٪ باشد؛ در غیر این صورت محاسبه ممنوع است.'
            : '')));
    }

    // ═══════════ فعال/غیرفعال‌سازی دسته ═══════════
    function toggleCategory(cat, v) {
      try {
        DB.updateCategory(cat.id, { isActive: v });
        if (v) UI.toast('دسته «' + cat.name + '» فعال شد');
        else UI.toast('دسته «' + cat.name + '» غیرفعال شد — از مجموع A کنار گذاشته می‌شود', { type: 'warning' });
      } catch (err) { UI.toastError(err); }
      renderAll();
    }

    // ═══════════ دیالوگ دسته مجاز جدید ═══════════
    function openCreateCategory() {
      var nameVal = '', codeVal = '', isActive = true;
      var nameInput = U.h('input', { class: 'input', placeholder: 'مثلاً: استراحت شخصی', 'aria-label': 'نام دسته' });
      nameInput.addEventListener('input', function () { nameVal = nameInput.value; });
      var codeInput = U.h('input', { class: 'input ltr', placeholder: 'مثلاً: PF', 'aria-label': 'کد دسته' });
      codeInput.addEventListener('input', function () { codeVal = codeInput.value; });
      UI.dialog({
        title: 'دسته مجاز جدید',
        bodyBuilder: function (body) {
          body.appendChild(UI.field('نام دسته (الزامی)', nameInput));
          body.appendChild(UI.field('کد (اختیاری)', codeInput));
          body.appendChild(U.h('div', { class: 'flex items-center justify-between rounded p-3 bg-surface-2' },
            U.h('div', null,
              U.h('span', { class: 'field-label', text: 'دسته فعال باشد' }),
              U.h('p', { class: 'hint', text: 'دسته غیرفعال در مجموع A لحاظ نمی‌شود.' })),
            UI.switchEl(isActive, function (v) { isActive = v; }, 'دسته فعال باشد')));
        },
        footerBuilder: function (close) {
          return U.h('div', { class: 'dialog-footer' },
            U.h('button', { class: 'btn', type: 'button', text: 'انصراف', onclick: close }),
            U.h('div', { class: 'spacer' }),
            U.h('button', {
              class: 'btn btn-brand', type: 'button',
              onclick: function () {
                if (!nameVal.trim()) { UI.toast('نام دسته الزامی است', { type: 'error' }); return; }
                DB.createCategory(projectId, {
                  name: nameVal.trim(), code: codeVal.trim() || null, isActive: isActive,
                });
                close();
                UI.toast('دسته ایجاد شد');
                renderAll();
              },
            }, U.icon('plus'), 'ثبت دسته'));
        },
      });
    }

    // ═══════════ دیالوگ ویرایش دسته مجاز ═══════════
    function openEditCategory(cat) {
      var nameVal = cat.name, codeVal = cat.code || '', sortVal = cat.sortOrder;
      var nameInput = U.h('input', { class: 'input', value: nameVal, 'aria-label': 'نام دسته' });
      nameInput.addEventListener('input', function () { nameVal = nameInput.value; });
      var codeInput = U.h('input', { class: 'input ltr', value: codeVal, 'aria-label': 'کد دسته' });
      codeInput.addEventListener('input', function () { codeVal = codeInput.value; });
      var sortInput = UI.persianNumberInput({
        value: cat.sortOrder, decimals: false, min: 0, max: 9999,
        onChange: function (v) { sortVal = v; },
        ariaLabel: 'ترتیب نمایش دسته',
      });
      UI.dialog({
        title: 'ویرایش دسته مجاز',
        bodyBuilder: function (body) {
          body.appendChild(UI.field('نام دسته', nameInput));
          body.appendChild(UI.field('کد', codeInput));
          body.appendChild(UI.field('ترتیب نمایش', sortInput, SORT_HELP));
        },
        footerBuilder: function (close) {
          return U.h('div', { class: 'dialog-footer' },
            U.h('button', { class: 'btn', type: 'button', text: 'انصراف', onclick: close }),
            U.h('div', { class: 'spacer' }),
            U.h('button', {
              class: 'btn btn-brand', type: 'button',
              onclick: function () {
                if (!String(nameVal).trim()) { UI.toast('نام دسته الزامی است', { type: 'error' }); return; }
                try {
                  DB.updateCategory(cat.id, {
                    name: String(nameVal).trim(),
                    code: String(codeVal).trim() || null,
                    sortOrder: (sortVal === null || (typeof sortVal === 'number' && isNaN(sortVal))) ? 0 : sortVal,
                  });
                } catch (err) { UI.toastError(err); return; }
                close();
                UI.toast('دسته به‌روزرسانی شد');
                renderAll();
              },
            }, 'ذخیره'));
        },
      });
    }

    // ═══════════ حذف دسته — FR-26 ═══════════
    function deleteCategoryFlow(cat) {
      var st = DB.getState();
      var gv = st.groupAllowances.filter(function (r) { return r.categoryId === cat.id; }).length;
      var ov = st.activityAllowanceOverrides.filter(function (r) { return r.categoryId === cat.id; }).length;
      UI.confirmDelete({
        title: 'حذف دسته مجاز',
        name: cat.name,
        deps: { 'مقدار ثبت‌شده در گروه‌ها': gv, 'بازنویسی اختصاصی فعالیت‌ها': ov },
      }).then(function (ok) {
        if (!ok) return;
        try { DB.deleteCategory(cat.id); } catch (err) { UI.toastError(err); return; }
        UI.toast('دسته «' + cat.name + '» به‌طور دائمی حذف شد');
        renderAll();
      });
    }

    renderAll();
  };
})(typeof window !== 'undefined' ? window : globalThis);
