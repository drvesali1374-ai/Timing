/* ═══════════════════════════════════════════════════════════
   views-charts.js — مرحلهٔ «نمودار فرایند — OPC / FPC»
   پورت وفادار از ChartsView / ChartCanvas نسخهٔ وب (فاز ۵ / FR-20):
   • گره‌های خودکار از فعالیت‌ها + گره دستی برای رویدادهای فاقد زمان‌سنجی
   • درگ گره با Pointer Events + ذخیرهٔ خودکار مختصات (saveChartLayout)
     — چیدمان دستی با بارگذاری مجدد صفحه حفظ می‌شود
   • یال‌های SVG: زنجیرهٔ توالی (ممتد/بنفش) + اتصال دستی (نقطه‌چین/فیروزه‌ای)
   • حالت اتصال مبدأ→مقصد، ترتیب بالا/پایین و چیدمان خودکار لایه‌ای
   ═══════════════════════════════════════════════════════════ */
(function (g) {
  'use strict';
  var U = g.T2U, DB = g.T2DB, UI = g.T2UI;
  g.T2VIEWS = g.T2VIEWS || {};

  /* ابعاد مرجع گره — هماهنگ با ثابت‌های db.js */
  var NW = DB.NODE_W || 200;
  var NH = DB.NODE_H_EST || 92;
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var OPC_TYPES = ['OPERATION', 'INSPECTION'];
  var FPC_TYPES = ['OPERATION', 'INSPECTION', 'TRANSPORT', 'DELAY', 'STORAGE'];

  /* نماد و رنگ هر نوع رویداد (قرارداد رایج نمودارهای فرایند) */
  var TYPE_STYLE = {
    OPERATION: { bg: 'var(--brand-soft)', fg: 'var(--brand)' },
    INSPECTION: { bg: 'var(--cyan-soft)', fg: 'var(--cyan)' },
    TRANSPORT: { bg: 'var(--amber-soft)', fg: 'var(--amber)' },
    DELAY: { bg: 'var(--red-soft)', fg: 'var(--red)' },
    STORAGE: { bg: 'var(--green-soft)', fg: 'var(--green)' },
  };

  var HELP_CHART = {
    what: 'نمودار فرایند، توالی رویدادهای تولید را نشان می‌دهد. OPC (نمودار فرایند عملیات) فقط عملیات و بازرسی را نمایش می‌دهد و FPC (نمودار فرایند جریان) هر پنج نوع رویداد: عملیات، بازرسی، حمل‌ونقل، تأخیر و انبارش.',
    input: 'گره‌های اصلی به‌صورت خودکار از فعالیت‌های تعریف‌شده در «ساختار تولید» ساخته می‌شوند و با تغییر آن‌ها به‌روز می‌مانند. برای رویدادهای فاقد فعالیت زمان‌سنجی، «گره دستی» بسازید.',
    example: 'مسیر یک قطعه: انبارش اولیه ▽ ← حمل به ایستگاه مونتاژ ⇨ ← عملیات مونتاژ ○ ← بازرسی کیفیت □ ← تأخیر در انتظار تأیید D.',
    note: 'حذف یا تغییر نمودار هیچ دادهٔ زمان‌سنجی را حذف نمی‌کند. جابه‌جایی گره‌ها با کشیدن، به‌صورت خودکار ذخیره می‌شود.',
  };

  /* وضعیت ماژول — بین رندرها و ناوبری حفظ می‌شود */
  var chartTypeByProject = {};   /* projectId -> 'OPC' | 'FPC' */
  var selectedByProject = {};    /* projectId -> nodeId انتخاب‌شده */
  var connectByProject = {};     /* projectId -> {active, sourceId} */
  var escListener = null;

  function svgTag(tag, attrs) {
    var el = document.createElementNS(SVG_NS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    return el;
  }

  g.T2VIEWS.charts = function (container, projectId) {
    U.clear(container);
    var root = U.h('div', { class: 'flex flex-col gap-4' });
    container.appendChild(root);

    if (chartTypeByProject[projectId] !== 'OPC' && chartTypeByProject[projectId] !== 'FPC') chartTypeByProject[projectId] = 'OPC';
    if (!connectByProject[projectId]) connectByProject[projectId] = { active: false, sourceId: null };

    var suppressClickUntil = 0; /* سرکوب click پس از درگ واقعی گره */

    function render() {
      U.clear(root);
      var chartType = chartTypeByProject[projectId];
      var conn = connectByProject[projectId];
      var chart;
      try { chart = DB.getChart(projectId, chartType); }
      catch (err) {
        root.appendChild(U.h('div', { class: 'banner error' }, U.icon('alertTriangle'),
          U.h('div', null, 'خطا در بارگذاری نمودار: ' + (err && err.message ? err.message : err))));
        return;
      }
      var nodes = chart.nodes;
      var nodeById = {};
      nodes.forEach(function (n) { nodeById[n.id] = n; });

      /* ── سربرگ ── */
      root.appendChild(U.h('header', { class: 'flex items-center gap-3' },
        U.h('span', { class: 'chip-icon' }, U.icon('workflow')),
        U.h('div', { class: 'flex items-center gap-2 min-w-0' },
          U.h('h1', { class: 'text-xl font-extrabold', text: 'نمودار فرایند — OPC / FPC' }),
          UI.helpDot('نمودار فرایند', HELP_CHART))));

      /* ── زبانهٔ OPC / FPC ── */
      root.appendChild(UI.tabsBar([
        { key: 'OPC', label: 'OPC — عملیات و بازرسی' },
        { key: 'FPC', label: 'FPC — جریان کامل' },
      ], chartType, function (k) {
        if (chartTypeByProject[projectId] === k) return;
        chartTypeByProject[projectId] = k;
        selectedByProject[projectId] = null;
        conn.active = false;
        conn.sourceId = null;
        render();
      }));

      /* نمودار خالی — بدون گره */
      if (nodes.length === 0) {
        root.appendChild(U.h('section', { class: 'card p-6' }, UI.emptyState({
          title: 'گره‌ای برای نمایش وجود ندارد',
          desc: 'گره‌های اصلی به‌صورت خودکار از فعالیت‌های «ساختار تولید» ساخته می‌شوند؛ فعالیتی مشمول این نوع نمودار تعریف نشده است. برای رویدادهای فاقد زمان‌سنجی می‌توانید همین‌جا گره دستی بسازید.',
          icon: 'workflow',
          actionLabel: 'ساخت گره دستی',
          onAction: function () { openManualNodeDialog(null); },
        })));
        return;
      }

      /* ── نوار ابزار ── */
      root.appendChild(U.h('div', { class: 'flex flex-wrap items-center gap-2 mb-3' },
        UI.badge(U.formatInt(chart.counts.total) + ' گره', 'brand-solid'),
        UI.badge(U.formatInt(chart.counts.auto) + ' خودکار', 'muted'),
        UI.badge(U.formatInt(chart.counts.manual) + ' دستی', 'cyan'),
        U.h('span', {
          class: 'text-xs text-muted',
          text: 'فعالیت‌های مشمول: ' + U.formatInt(chart.counts.activitiesIncluded) + ' از ' + U.formatInt(chart.counts.activitiesTotal),
        }),
        U.h('div', { class: 'spacer' }),
        U.h('button', {
          class: 'btn btn-sm ' + (conn.active ? 'btn-brand' : 'btn-outline'),
          type: 'button',
          'aria-pressed': conn.active ? 'true' : 'false',
          onclick: function () { conn.active = !conn.active; conn.sourceId = null; render(); },
        }, U.icon('workflow'), 'اتصال گره‌ها'),
        U.h('button', {
          class: 'btn btn-sm btn-outline', type: 'button',
          onclick: function () {
            try {
              var positions = DB.autoLayout(chart.nodes, chart.edges);
              DB.saveChartLayout(projectId, chartType, positions);
              UI.toast('چیدمان خودکار اعمال شد.');
              render();
            } catch (err) { UI.toastError(err); }
          },
        }, U.icon('refresh'), 'چیدمان خودکار'),
        U.h('button', {
          class: 'btn btn-sm btn-brand', type: 'button',
          onclick: function () { openManualNodeDialog(null); },
        }, U.icon('plus'), 'گره دستی')));

      /* بنر حالت اتصال */
      if (conn.active) {
        root.appendChild(U.h('div', { class: 'banner info', role: 'status' }, U.icon('workflow'),
          U.h('div', { text: 'حالت اتصال فعال است: ابتدا گره مبدأ و سپس گره مقصد را کلیک کنید.' })));
      }

      /* ── بوم ── */
      var CW = chart.canvas.width, CH = chart.canvas.height;
      var canvasWrap = U.h('div', {
        class: 'chart-canvas-wrap', dir: 'ltr', role: 'application',
        'aria-label': 'بوم نمودار ' + chartType,
        style: { width: CW + 'px', height: CH + 'px', minWidth: '100%', overflow: 'visible' },
      });

      /* یال‌های SVG */
      var svg = svgTag('svg', { class: 'chart-svg', width: CW, height: CH, 'aria-hidden': 'true' });
      var defs = svgTag('defs');
      [['t2c-arrow-brand', 'var(--brand)'], ['t2c-arrow-cyan', 'var(--cyan)']].forEach(function (m) {
        var marker = svgTag('marker', {
          id: m[0], viewBox: '0 0 10 10', refX: 9, refY: 5,
          markerWidth: 7, markerHeight: 7, orient: 'auto',
        });
        marker.appendChild(svgTag('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: m[1] }));
        defs.appendChild(marker);
      });
      svg.appendChild(defs);

      /* مسیر یک یال: جریان عمودی — پایینِ مبدأ → بالای مقصد، بزیهٔ عمودی */
      function edgeD(s, t) {
        var sx = s.positionX + NW / 2, sy = s.positionY + NH;
        var tx = t.positionX + NW / 2, ty = t.positionY;
        return 'M ' + sx + ' ' + sy + ' C ' + sx + ' ' + (sy + 40) + ', ' + tx + ' ' + (ty - 40) + ', ' + tx + ' ' + ty;
      }

      /* بازترسیم یال‌ها پس از جابه‌جایی گره (درگ/چیدمان) */
      var edgeEls = [];
      function redrawEdges() {
        edgeEls.forEach(function (p) {
          var d = edgeD(p.s, p.t);
          p.visible.setAttribute('d', d);
          p.overlay.setAttribute('d', d);
        });
      }

      chart.edges.forEach(function (e) {
        var s = nodeById[e.sourceNodeId], t = nodeById[e.targetNodeId];
        if (!s || !t) return;
        var color = e.isChain ? 'var(--brand)' : 'var(--cyan)';
        var visible = svgTag('path', {
          d: edgeD(s, t), fill: 'none', stroke: color, 'stroke-width': 2,
          'marker-end': 'url(#' + (e.isChain ? 't2c-arrow-brand' : 't2c-arrow-cyan') + ')',
        });
        if (!e.isChain) visible.setAttribute('stroke-dasharray', '6 4');
        /* مسیر نامرئی پهن برای کلیک راحت + عنوان راهنما */
        var overlay = svgTag('path', {
          d: edgeD(s, t), fill: 'none', stroke: 'transparent', 'stroke-width': 16, 'pointer-events': 'stroke',
        });
        overlay.style.cursor = 'pointer';
        edgeEls.push({ s: s, t: t, visible: visible, overlay: overlay });
        var title = svgTag('title');
        title.textContent = s.label + ' → ' + t.label + (e.isChain ? ' — زنجیرهٔ توالی' : '');
        overlay.appendChild(title);
        overlay.addEventListener('click', function () {
          if (e.isChain) {
            UI.toast('یال زنجیرهٔ توالی با تغییر ترتیب گره‌ها بازسازی می‌شود.', { type: 'info' });
            return;
          }
          UI.confirmDialog({
            title: 'حذف اتصال دستی؟',
            desc: 'اتصال بین «' + s.label + '» و «' + t.label + '» حذف می‌شود. این تغییر فقط نمودار را تغییر می‌دهد و هیچ دادهٔ زمان‌سنجی حذف نمی‌شود.',
            destructive: true,
            confirmLabel: 'حذف اتصال',
            cancelLabel: 'انصراف',
          }).then(function (ok) {
            if (!ok) return;
            try {
              DB.deleteChartEdge(e.id);
              UI.toast('اتصال حذف شد؛ مشاهدات زمان‌سنجی تغییری نکرده‌اند.');
              render();
            } catch (err) { UI.toastError(err); }
          });
        });
        svg.appendChild(visible);
        svg.appendChild(overlay);
      });
      canvasWrap.appendChild(svg);

      /* ── گره‌ها ── */
      nodes.forEach(function (n) {
        canvasWrap.appendChild(buildNodeEl(n));
      });

      /* کلیک روی پس‌زمینهٔ بوم → لغو انتخاب */
      canvasWrap.addEventListener('click', function (ev) {
        if (ev.target !== canvasWrap) return;
        if (selectedByProject[projectId]) {
          selectedByProject[projectId] = null;
          render();
        }
      });

      root.appendChild(U.h('div', { style: { overflow: 'auto', maxHeight: '70vh' } }, canvasWrap));

      /* ── پنل جزئیات گره انتخاب‌شده (زیر بوم) ── */
      var detailHost = U.h('div');
      root.appendChild(detailHost);
      renderDetail();

      /* ── ساخت یک گره ── */
      function buildNodeEl(n) {
        var st = TYPE_STYLE[n.nodeType] || TYPE_STYLE.OPERATION;
        var isSelected = selectedByProject[projectId] === n.id;
        var isSource = conn.active && conn.sourceId === n.id;
        var el = U.h('div', {
          class: 'chart-node' + (isSelected ? ' selected' : ''),
          dir: 'rtl', role: 'button', tabindex: '0',
          'aria-label': 'گره ' + U.formatInt(n.sortOrder + 1) + ': ' + n.label,
          style: {
            left: n.positionX + 'px', top: n.positionY + 'px', touchAction: 'none',
            borderColor: isSource ? 'var(--amber)' : undefined,
            boxShadow: isSource ? '0 0 0 3px color-mix(in srgb, var(--amber) 55%, transparent)' : undefined,
          },
        },
          U.h('div', { class: 'flex items-start gap-2' },
            U.h('span', {
              class: 'cn-symbol', 'aria-hidden': 'true',
              style: { background: st.bg, color: st.fg },
              text: DB.CONST.PROCESS_TYPE_SYMBOLS[n.nodeType] || '',
            }),
            U.h('div', { class: 'flex-1 min-w-0' },
              U.h('div', {
                class: 'text-sm font-semibold', title: n.label, text: n.label,
                style: {
                  display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical',
                  overflow: 'hidden', wordBreak: 'break-word', minHeight: '20px',
                },
              }),
              U.h('div', { class: 'flex items-center gap-1 mt-1' },
                U.h('span', {
                  class: 'text-xs text-faint truncate flex-1',
                  text: n.stationName || (DB.CONST.PROCESS_TYPE_LABELS[n.nodeType] || ''),
                }),
                n.isManual ? UI.badge('دستی', 'cyan') : UI.badge('خودکار', 'muted')))));

        /* درگ با Pointer Events — ذخیرهٔ خودکار مختصات در pointerup؛
           یال‌ها به‌صورت زنده دنبال گره می‌آیند و در خطا به مبدأ برمی‌گردند */
        el.addEventListener('pointerdown', function (ev) {
          if (conn.active) return;
          if (ev.button > 0) return;
          var startX = ev.clientX, startY = ev.clientY;
          var origX = n.positionX, origY = n.positionY;
          var curX = origX, curY = origY, moved = false;
          try { el.setPointerCapture(ev.pointerId); } catch (err) { /* رویداد ترکیبی بدون پوینتر فعال */ }
          el.classList.add('dragging');
          function restore() {
            n.positionX = origX;
            n.positionY = origY;
            el.style.left = origX + 'px';
            el.style.top = origY + 'px';
            redrawEdges();
          }
          function onMove(mv) {
            var dx = mv.clientX - startX, dy = mv.clientY - startY;
            if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
            curX = Math.round(origX + dx);
            curY = Math.round(origY + dy);
            n.positionX = curX;
            n.positionY = curY;
            el.style.left = curX + 'px';
            el.style.top = curY + 'px';
            redrawEdges();
          }
          function finish() {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', finish);
            window.removeEventListener('pointercancel', finish);
            el.classList.remove('dragging');
            if (!moved) { restore(); return; }
            var x = Math.max(8, curX), y = Math.max(8, curY);
            var pos = {};
            pos[n.id] = { x: x, y: y };
            try {
              DB.saveChartLayout(projectId, chartType, pos);
              n.positionX = x;
              n.positionY = y;
              el.style.left = x + 'px';
              el.style.top = y + 'px';
              redrawEdges();
            } catch (err) {
              UI.toastError(err);
              restore();
            }
            suppressClickUntil = Date.now() + 400;
          }
          window.addEventListener('pointermove', onMove);
          window.addEventListener('pointerup', finish);
          window.addEventListener('pointercancel', finish);
          if (ev.cancelable) ev.preventDefault();
        });

        function activate() {
          if (Date.now() < suppressClickUntil) return;
          if (conn.active) { connectClick(n); return; }
          selectedByProject[projectId] = n.id;
          render();
        }
        el.addEventListener('click', activate);
        el.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' || ev.key === ' ') {
            if (ev.cancelable) ev.preventDefault();
            activate();
          }
        });
        return el;
      }

      /* ── کلیک در حالت اتصال ── */
      function connectClick(n) {
        if (!conn.sourceId) {
          conn.sourceId = n.id;
          UI.toast('گره مبدأ انتخاب شد: «' + n.label + '». اکنون گره مقصد را انتخاب کنید.', { type: 'info' });
          render();
          return;
        }
        if (conn.sourceId === n.id) {
          conn.sourceId = null;
          render();
          return;
        }
        try {
          DB.createChartEdge(projectId, chartType, conn.sourceId, n.id);
          conn.sourceId = null;
          UI.toast('اتصال ثبت شد.');
          render();
        } catch (err) { UI.toastError(err); }
      }

      /* ── پنل جزئیات ── */
      function renderDetail() {
        U.clear(detailHost);
        var selId = selectedByProject[projectId];
        var n = selId ? nodeById[selId] : null;
        if (!n) return;
        var st = TYPE_STYLE[n.nodeType] || TYPE_STYLE.OPERATION;
        var idx = nodes.indexOf(n);
        detailHost.appendChild(U.h('section', { class: 'card p-4', 'aria-label': 'جزئیات گره انتخاب‌شده' },
          U.h('div', { class: 'flex flex-wrap items-center gap-2' },
            U.h('span', {
              class: 'cn-symbol', 'aria-hidden': 'true',
              style: { background: st.bg, color: st.fg, width: '26px', height: '26px', fontSize: '13px' },
              text: DB.CONST.PROCESS_TYPE_SYMBOLS[n.nodeType] || '',
            }),
            U.h('span', { class: 'font-bold', text: n.label }),
            UI.badge(DB.CONST.PROCESS_TYPE_LABELS[n.nodeType] || n.nodeType, 'outline'),
            U.h('span', { class: 'text-xs text-muted', text: n.stationName ? n.stationName : '—' }),
            U.h('span', { class: 'text-xs text-faint num', text: 'جایگاه ' + U.formatInt(n.sortOrder + 1) })),
          U.h('div', { class: 'flex flex-wrap items-center gap-2 mt-3' },
            n.isManual ? U.h('button', {
              class: 'btn btn-sm btn-outline', type: 'button',
              onclick: function () { openManualNodeDialog(n); },
            }, U.icon('pencil'), 'ویرایش گره') : null,
            U.h('button', {
              class: 'btn btn-sm btn-outline', type: 'button', disabled: idx <= 0,
              onclick: function () {
                try { DB.moveChartNodeOrder(projectId, chartType, n.id, 'up'); render(); }
                catch (err) { UI.toastError(err); }
              },
            }, U.icon('arrowUp'), 'ترتیب: بالا'),
            U.h('button', {
              class: 'btn btn-sm btn-outline', type: 'button', disabled: idx >= nodes.length - 1,
              onclick: function () {
                try { DB.moveChartNodeOrder(projectId, chartType, n.id, 'down'); render(); }
                catch (err) { UI.toastError(err); }
              },
            }, U.icon('arrowDown'), 'ترتیب: پایین'),
            conn.active ? U.h('button', {
              class: 'btn btn-sm btn-outline', type: 'button',
              onclick: function () {
                conn.sourceId = n.id;
                UI.toast('گره مبدأ انتخاب شد: «' + n.label + '». اکنون گره مقصد را انتخاب کنید.', { type: 'info' });
                render();
              },
            }, U.icon('workflow'), 'اتصال از این گره') : null,
            n.isManual ? U.h('button', {
              class: 'btn btn-sm btn-destructive-outline', type: 'button',
              onclick: function () {
                UI.confirmDialog({
                  title: 'حذف گره',
                  desc: 'گره «' + n.label + '» حذف می‌شود؛ گره‌های خودکار فعالیت‌ها دست‌نخورده می‌مانند.',
                  destructive: true,
                  confirmLabel: 'حذف گره',
                }).then(function (ok) {
                  if (!ok) return;
                  try {
                    DB.deleteChartNode(n.id);
                    selectedByProject[projectId] = null;
                    UI.toast('گره دستی حذف شد؛ گره‌های خودکار فعالیت‌ها دست‌نخورده‌اند.');
                    render();
                  } catch (err) { UI.toastError(err); }
                });
              },
            }, U.icon('trash'), 'حذف گره') : null),
          !n.isManual ? U.h('p', {
            class: 'text-xs text-muted mt-3 leading-relaxed',
            text: 'گره‌های خودکار از فعالیت‌ها ساخته می‌شوند؛ برای تغییر، فعالیت را در ساختار تولید ویرایش کنید.',
          }) : null));
      }
    }

    /* ── دیالوگ ساخت/ویرایش گره دستی ── */
    function openManualNodeDialog(existing) {
      var chartType = chartTypeByProject[projectId];
      var allowed = chartType === 'OPC' ? OPC_TYPES : FPC_TYPES;
      var label = existing ? existing.label : '';
      var nodeType = existing ? existing.nodeType : allowed[0];
      UI.dialog({
        title: existing ? 'ویرایش گره' : 'گره دستی جدید',
        desc: existing
          ? 'برچسب و نوع رویداد این گره را ویرایش کنید.'
          : 'گره دستی مستقل از فعالیت‌هاست و برای رویدادهای فاقد زمان‌سنجی (مثلاً کنترل کیفیت میانی) استفاده می‌شود.',
        bodyBuilder: function (body) {
          var input = U.h('input', {
            class: 'input', type: 'text', value: label,
            placeholder: 'مثلاً: کنترل کیفیت میانی', maxlength: '200',
            'aria-label': 'برچسب گره',
          });
          input.addEventListener('input', function () { label = input.value; });
          body.appendChild(UI.field('برچسب گره *', input));
          var typeSel = UI.selectEl(
            allowed.map(function (t) {
              return { value: t, label: (DB.CONST.PROCESS_TYPE_SYMBOLS[t] || '') + ' ' + (DB.CONST.PROCESS_TYPE_LABELS[t] || t) };
            }),
            nodeType,
            function (v) { nodeType = v; },
            'نوع رویداد');
          body.appendChild(U.h('div', { class: 'mt-3' }, UI.field('نوع رویداد', typeSel)));
        },
        footerBuilder: function (close) {
          return U.h('div', { class: 'dialog-footer' },
            U.h('button', { class: 'btn', type: 'button', text: 'انصراف', onclick: close }),
            U.h('div', { class: 'spacer' }),
            U.h('button', {
              class: 'btn btn-brand', type: 'button',
              text: existing ? 'ذخیره' : 'ثبت گره',
              onclick: function () {
                var trimmed = (label || '').trim();
                if (!trimmed) {
                  UI.toast('برچسب گره الزامی است', { type: 'error' });
                  return;
                }
                try {
                  if (existing) {
                    DB.updateChartNode(existing.id, { label: trimmed, nodeType: nodeType });
                    UI.toast('گره به‌روزرسانی شد.');
                  } else {
                    DB.createManualNode(projectId, chartType, { label: trimmed, nodeType: nodeType });
                    UI.toast('گره دستی ساخته شد.');
                  }
                  close();
                  render();
                } catch (err) { UI.toastError(err); }
              },
            }));
        },
      });
    }

    /* ESC → خروج از حالت اتصال (اگر دیالوگی باز نباشد) */
    if (escListener) document.removeEventListener('keydown', escListener);
    escListener = function (e) {
      if (e.key !== 'Escape') return;
      if (!root.isConnected) return;
      var conn = connectByProject[projectId];
      if (!conn || !conn.active) return;
      if (document.querySelector('.dialog-overlay')) return;
      conn.active = false;
      conn.sourceId = null;
      render();
    };
    document.addEventListener('keydown', escListener);

    render();
  };
})(typeof window !== 'undefined' ? window : globalThis);
