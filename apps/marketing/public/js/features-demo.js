/* ============================================================
   features-demo.js — 功能體驗頁互動示範
   100% 前端、無框架、無網絡請求。所有數據均為虛構。
   視覺對照 apps/web/src/ 真實頁面，使用 Tailwind CSS class
   與 Lucide icons 重建 webapp 介面。
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 共用工具 ---------- */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  function now() {
    var d = new Date();
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }

  function todayStr() {
    return dateStr(0);
  }

  function dateStr(offsetDays) {
    var d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  function dateLabel(iso) {
    var p = iso.split('-');
    return Number(p[1]) + '月' + Number(p[2]) + '日';
  }

  function refreshIcons(root) {
    if (typeof lucide !== 'undefined') lucide.createIcons({ attrs: { 'stroke-width': 2 }, nameAttr: 'data-lucide' });
  }

  var toastTimer = null;
  function toast(msg, type) {
    var old = $('.fd-toast');
    if (old) old.remove();
    var t = document.createElement('div');
    t.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-lg shadow-lg text-white text-sm font-semibold z-[1100] ' +
      (type === 'danger' ? 'bg-red-600' : 'bg-green-600');
    t.textContent = msg;
    document.body.appendChild(t);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.remove(); }, 2600);
  }

  function openModal(html, opts) {
    opts = opts || {};
    var overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[1000]';
    overlay.innerHTML =
      '<div class="bg-white rounded-lg shadow-xl w-full max-w-' + (opts.width || '2xl') + ' max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true">' +
      '<div class="flex items-center justify-between p-5 border-b border-gray-200">' +
      (opts.title ? '<h3 class="text-lg font-semibold text-gray-900">' + opts.title + '</h3>' : '') +
      '<button type="button" class="fd-modal-close ml-auto w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100" aria-label="關閉">' +
      '<i data-lucide="x" class="w-5 h-5"></i></button></div>' +
      '<div class="fd-modal-body p-5"></div></div>';
    var body = $('.fd-modal-body', overlay);
    body.innerHTML = html;
    document.body.appendChild(overlay);
    refreshIcons(overlay);
    function close() {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay || e.target.closest('.fd-modal-close')) close();
    });
    return { overlay: overlay, body: body, close: close };
  }

  function fakeScan(label, cb) {
    var m = openModal(
      '<div class="flex flex-col items-center justify-center py-8 gap-4">' +
      '<div class="relative w-48 h-48 border-2 border-dashed border-blue-500 rounded-lg bg-blue-50 flex items-center justify-center overflow-hidden">' +
      '<div class="absolute left-0 right-0 h-0.5 bg-blue-600 shadow-[0_0_12px_#2563eb] animate-[scan_1.1s_linear_infinite]"></div>' +
      '<i data-lucide="scan-line" class="w-10 h-10 text-blue-500"></i></div>' +
      '<p class="text-sm text-gray-600">掃描中，請稍候…</p></div>',
      { title: label, width: 'sm' }
    );
    setTimeout(function () { m.close(); cb(); }, 1300);
  }

  function askSignature(title, cb) {
    var m = openModal(
      '<div class="space-y-4"><div><label class="form-label block text-sm font-medium text-gray-700 mb-1">簽署人姓名</label>' +
      '<input class="form-input w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" id="fd-sign-name" value="陳護士" /></div>' +
      '<div class="flex justify-end gap-2 pt-2">' +
      '<button type="button" class="btn-secondary px-4 py-2" data-act="cancel">取消</button>' +
      '<button type="button" class="btn-primary px-4 py-2" data-act="ok">確認簽署</button></div></div>',
      { title: title, width: 'sm' }
    );
    var input = $('#fd-sign-name', m.body);
    input.focus(); input.select();
    m.body.addEventListener('click', function (e) {
      var act = e.target.closest('[data-act]');
      if (!act) return;
      if (act.dataset.act === 'cancel') { m.close(); return; }
      var name = input.value.trim();
      if (!name) { toast('請輸入簽署人姓名', 'danger'); return; }
      m.close(); cb(name);
    });
  }

  function btnPrimary(text, attrs) {
    return '<button type="button" ' + (attrs || '') + ' class="btn-primary inline-flex items-center gap-1.5">' + text + '</button>';
  }
  function btnSecondary(text, attrs) {
    return '<button type="button" ' + (attrs || '') + ' class="btn-secondary inline-flex items-center gap-1.5">' + text + '</button>';
  }
  function btnDanger(text, attrs) {
    return '<button type="button" ' + (attrs || '') + ' class="btn-danger inline-flex items-center gap-1.5">' + text + '</button>';
  }
  function btnSuccess(text, attrs) {
    return '<button type="button" ' + (attrs || '') + ' class="btn-success inline-flex items-center gap-1.5">' + text + '</button>';
  }
  function badge(text, color) {
    var map = {
      green: 'bg-green-100 text-green-800',
      red: 'bg-red-100 text-red-800',
      yellow: 'bg-amber-100 text-amber-800',
      blue: 'bg-blue-100 text-blue-800',
      gray: 'bg-gray-100 text-gray-700'
    };
    return '<span class="status-badge ' + (map[color] || map.gray) + '">' + text + '</span>';
  }

  /* ---------- 共用虛構院友資料 ---------- */

  var RESIDENTS = [
    { name: '陳大文', bed: '101-A', idc: 'A123456(7)', dob: '1945-03-12', age: 81, sex: '男', care: '高度照顧' },
    { name: '李笑好', bed: '101-B', idc: 'C234567(8)', dob: '1940-06-22', age: 86, sex: '女', care: '中度照顧' },
    { name: '黃伯強', bed: '102-A', idc: 'D345678(9)', dob: '1938-01-30', age: 88, sex: '男', care: '高度照顧' },
    { name: '周桂蘭', bed: '102-B', idc: 'E456789(0)', dob: '1947-09-14', age: 78, sex: '女', care: '低度照顧' },
    { name: '吳美玲', bed: '103-A', idc: 'F567890(1)', dob: '1950-12-03', age: 75, sex: '女', care: '中度照顧' },
    { name: '梁志偉', bed: '201-A', idc: 'G678901(2)', dob: '1943-04-18', age: 83, sex: '男', care: '高度照顧' },
    { name: '林淑芬', bed: '202-A', idc: 'H789012(3)', dob: '1949-07-25', age: 77, sex: '女', care: '中度照顧' },
    { name: '張金好', bed: '203-A', idc: 'K890123(4)', dob: '1936-02-08', age: 90, sex: '女', care: '高度照顧' }
  ];

  function res(name) { return RESIDENTS.filter(function (r) { return r.name === name; })[0]; }

  /* ============================================================
     1. 主控台 · 監測任務
     對照 Dashboard.tsx 1111-1247 與 HealthRecordModal
     ============================================================ */

  var MONITOR_SECTIONS = [
    ['breakfast', '早餐 (07:00 - 09:59)'],
    ['lunch', '午餐 (10:00 - 12:59)'],
    ['dinner', '晚餐 (13:00 - 17:59)'],
    ['snack', '夜宵 (18:00 - 20:00)'],
    ['temp', '體溫'],
    ['weight', '體重']
  ];

  var monitorCards = [
    { id: 'm1', section: 'breakfast', name: '陳大文', bed: '101-A', time: '08:00', overdue: true,
      items: [{ type: '血糖', note: '注射前' }, { type: '血壓' }, { type: '脈搏' }] },
    { id: 'm2', section: 'breakfast', name: '黃伯強', bed: '102-A', time: '08:30', overdue: false,
      items: [{ type: '血壓' }, { type: '脈搏' }] },
    { id: 'm3', section: 'lunch', name: '李笑好', bed: '101-B', time: '12:00', overdue: false,
      items: [{ type: '血糖', note: '服藥前' }] },
    { id: 'm4', section: 'dinner', name: '吳美玲', bed: '103-A', time: '17:00', overdue: false,
      items: [{ type: '血壓' }] },
    { id: 'm5', section: 'snack', name: '梁志偉', bed: '201-A', time: '20:00', overdue: false,
      items: [{ type: '血糖' }] },
    { id: 'm6', section: 'temp', name: '周桂蘭', bed: '102-B', time: '', overdue: true,
      items: [{ type: '體溫' }] },
    { id: 'm7', section: 'temp', name: '林淑芬', bed: '202-A', time: '', overdue: false,
      items: [{ type: '體溫' }] },
    { id: 'm8', section: 'weight', name: '張金好', bed: '203-A', time: '', overdue: false,
      items: [{ type: '體重', freq: '每週一次' }] }
  ];

  var MONITOR_INPUT_DEFS = {
    '血糖': { unit: 'mmol/L', placeholder: '例如 6.5' },
    '血壓': { dual: true },
    '脈搏': { unit: '次/分', placeholder: '例如 72' },
    '體溫': { unit: '°C', placeholder: '例如 36.5' },
    '體重': { unit: 'kg', placeholder: '例如 58.2' }
  };

  function renderDashboard() {
    var root = $('#demo-dashboard');
    if (!root) return;
    var html =
      '<div class="flex items-center justify-between mb-4 gap-3 flex-wrap">' +
      '<div class="flex items-center gap-2 text-sm text-gray-500">' +
      '<i data-lucide="calendar" class="w-4 h-4"></i><span>' + todayStr() + '</span></div>' +
      '<div class="flex items-center gap-2">' + btnPrimary('<i data-lucide="file-spreadsheet" class="w-4 h-4"></i> 匯出監測記錄工作紙', 'data-act="worksheet"') +
      btnSecondary('<i data-lucide="camera" class="w-4 h-4"></i> 識別工作紙', 'data-act="ocr"') + '</div></div>';
    var anyCard = false;
    MONITOR_SECTIONS.forEach(function (sec) {
      var cards = monitorCards.filter(function (c) { return c.section === sec[0]; });
      if (!cards.length) return;
      anyCard = true;
      html += '<h3 class="time-slot-title text-md font-medium text-gray-700 mb-2">' + sec[1] + '</h3>' +
        '<div class="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-5">';
      cards.forEach(function (c) {
        var note = c.items[0].note || '';
        var freq = c.items[0].freq || '';
        html += '<button type="button" class="dashboard-task-card flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer text-left w-full ' +
          (c.overdue ? 'bg-red-50 border-red-200 hover:bg-red-100' : 'bg-gray-50 border-gray-200 hover:bg-gray-100') + '" data-card="' + c.id + '">' +
          '<div class="task-avatar w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">' +
          '<i data-lucide="user" class="w-5 h-5 text-blue-600"></i></div>' +
          '<div class="flex-1 min-w-0">' +
          '<div class="flex flex-wrap items-center gap-2"><p class="font-medium text-gray-900">' + c.name + '</p>' +
          '<span class="text-xs text-gray-500">' + c.bed + '</span></div>' +
          (c.time ? '<p class="text-xs text-gray-500 mt-0.5">' + c.time + '</p>' : '') +
          '<div class="flex flex-wrap gap-1 mt-1.5"><span class="inline-flex items-center gap-1 px-2 py-1 bg-white/70 rounded-lg border border-white/60 text-xs text-gray-700">' +
          '<span class="font-medium">' + c.items.length + '個項目</span>' + (note ? '<span class="task-note-badge bg-amber-100 text-amber-800">' + note + '</span>' : '') + (freq ? '<span class="text-gray-500">' + freq + '</span>' : '') + '</span></div></div>' +
          badge(c.overdue ? '逾期' : '未完成', c.overdue ? 'red' : 'green') + '</button>';
      });
      html += '</div>';
    });
    if (!anyCard) html += '<p class="text-green-600 text-sm">✓ 今日監測任務全部完成。</p>';
    root.innerHTML = html;
    refreshIcons(root);
  }

  function openHealthRecordModal(card) {
    var rows = card.items.map(function (item, i) {
      var def = MONITOR_INPUT_DEFS[item.type] || { unit: '' };
      var input = def.dual
        ? '<div class="flex items-center gap-2"><input class="w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-sm" data-item="' + i + '" data-part="sys" placeholder="收縮壓" inputmode="decimal" />' +
          '<span class="text-gray-400">/</span><input class="w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-sm" data-item="' + i + '" data-part="dia" placeholder="舒張壓" inputmode="decimal" /></div>'
        : '<div class="flex items-center gap-2"><input class="w-32 rounded-lg border border-gray-300 px-2 py-1.5 text-sm" data-item="' + i + '" placeholder="' + (def.placeholder || '輸入數值') + '" inputmode="decimal" />' +
          (def.unit ? '<span class="text-sm text-gray-500">' + def.unit + '</span>' : '') + '</div>';
      return '<div class="flex items-center gap-3 py-2 border-b border-gray-100"><span class="flex-1 text-sm font-medium text-gray-700">' + item.type + (item.note ? ' ' + badge(item.note, 'yellow') : '') + '</span>' + input + '</div>';
    }).join('');
    var m = openModal(
      '<form class="space-y-4">' +
      '<div class="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label class="form-label block text-sm font-medium text-gray-700 mb-1">院友</label>' +
      '<input type="text" disabled value="' + card.name + '" class="form-input w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700"/></div>' +
      '<div class="grid grid-cols-2 gap-2"><div><label class="form-label block text-sm font-medium text-gray-700 mb-1">日期</label>' +
      '<input type="date" class="form-input w-full rounded-lg border border-gray-300 px-2 py-2 text-sm" value="' + todayStr() + '"/></div>' +
      '<div><label class="form-label block text-sm font-medium text-gray-700 mb-1">時間</label>' +
      '<input type="time" class="form-input w-full rounded-lg border border-gray-300 px-2 py-2 text-sm" id="hr-time" value="' + now() + '"/></div></div></div>' +
      '<div class="space-y-1">' + rows + '</div>' +
      '<div><label class="form-label block text-sm font-medium text-gray-700 mb-1">備註</label><input class="form-input w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="選填"/></div>' +
      '<div class="flex gap-2 pt-2 justify-end">' + btnSecondary('取消', 'data-act="cancel"') + btnPrimary('<i data-lucide="save" class="w-4 h-4"></i> 儲存記錄', 'data-act="save"') + '</div></form>',
      { title: '健康記錄 — ' + card.name + ' <span class="text-gray-500 text-base font-normal">' + card.bed + '</span>', width: '2xl' }
    );
    m.body.addEventListener('click', function (ev) {
      var act = ev.target.closest('[data-act]');
      if (!act) return;
      if (act.dataset.act === 'cancel') { m.close(); return; }
      var filled = 0;
      $$('input[data-item]', m.body).forEach(function (inp) { if (inp.value.trim()) filled++; });
      if (!filled) { toast('未輸入任何數值', 'danger'); return; }
      var recTime = $('#hr-time', m.body).value || now();
      monitorCards = monitorCards.filter(function (c) { return c.id !== card.id; });
      m.close(); renderDashboard();
      toast('已儲存 ' + card.name + ' 的健康記錄（' + recTime + '）');
    });
  }

  function initDashboard() {
    var root = $('#demo-dashboard');
    if (!root) return;
    renderDashboard();
    root.addEventListener('click', function (e) {
      var cardBtn = e.target.closest('[data-card]');
      if (cardBtn) {
        var card = monitorCards.filter(function (c) { return c.id === cardBtn.dataset.card; })[0];
        if (card) openHealthRecordModal(card);
        return;
      }
      if (e.target.closest('[data-act="worksheet"]')) {
        openModal(
          '<div class="space-y-4"><p class="text-sm text-gray-600">系統按今日未完成的監測任務產生工作紙 PDF，列印後供床頭手寫記錄。</p>' +
          '<div><label class="form-label block text-sm font-medium text-gray-700 mb-1">工作紙日期</label><input type="date" class="form-input w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value="' + todayStr() + '"/></div>' +
          '<div class="flex justify-end">' + btnPrimary('下載工作紙 PDF', 'data-act="dl"') + '</div></div>',
          { title: '匯出監測記錄工作紙', width: 'md' }
        ).body.addEventListener('click', function (ev) {
          if (ev.target.closest('[data-act="dl"]')) { toast('已下載監測記錄工作紙（示範環境不會真正下載）'); }
        });
        return;
      }
      if (e.target.closest('[data-act="ocr"]')) {
        toast('「識別工作紙」示範請見下方「生命表徵批量工作紙」');
        var target = document.getElementById('vitals');
        if (target) target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  /* ============================================================
     2. eMAR 給藥工作流程
     對照 MedicationWorkflow.tsx（步驟 Tab + 矩陣表）
     ============================================================ */

  var EMAR_STEPS = [
    { key: 'preparation', label: '執藥', icon: 'fast-forward', active: 'border-blue-500 text-blue-600 bg-blue-50' },
    { key: 'verification', label: '核藥', icon: 'check-square', active: 'border-green-500 text-green-600 bg-green-50' },
    { key: 'dispensing', label: '派藥', icon: 'users', active: 'border-purple-500 text-purple-600 bg-purple-50' }
  ];
  var EMAR_WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
  var EMAR_RESIDENT = { name: '陳大文', bed: '101-A' };

  function emarDate(offset) { var d = new Date(); d.setDate(d.getDate() + offset); return d; }
  function emarKey(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function emarFmt(d) { return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear(); }

  var emarRx = [
    { id: 1, name: 'METFORMIN 500MG TAB', form: '藥片', route: '口服', freq: '每日2次', meal: '進餐時', dose: '每次1粒',
      start: '2026-07-15', rxDate: '2026-07-14', source: '葵涌醫院', cannotCrush: false, shortTerm: false, instant: false, prn: false,
      preCheck: null, note: null, slots: ['08:00', '18:00'] },
    { id: 2, name: 'METOPROLOL 50MG TAB', form: '藥片', route: '口服', freq: '每日1次', meal: null, dose: '每次1粒',
      start: '2026-06-01', rxDate: '2026-05-30', source: '葵涌醫院', cannotCrush: true, shortTerm: false, instant: false, prn: false,
      preCheck: '血壓<100/60 停服', note: null, slots: ['08:00'] },
    { id: 3, name: 'INSULIN GLARGINE 100IU/ML', form: '注射液', route: '皮下注射', freq: '每日1次', meal: null, dose: '每次10IU',
      start: '2026-08-01', rxDate: '2026-07-31', source: '葵涌醫院', cannotCrush: false, shortTerm: false, instant: true, prn: false,
      preCheck: null, note: null, injectionSite: '腹部（輪換）', slots: ['21:00'] },
    { id: 4, name: 'TRAMADOL 50MG CAP', form: '膠囊', route: '口服', freq: '需要時', meal: null, dose: '每次1粒',
      start: '2026-08-20', rxDate: '2026-08-19', source: '葵涌醫院', cannotCrush: false, shortTerm: true, instant: false, prn: true,
      preCheck: null, note: '痛楚時服用，每日最多4次', slots: ['按需要'] }
  ];

  var emarRecords = {};
  function emarStep(status, staff, detail) { return { status: status, staff: staff || null, detail: detail || null }; }
  function emarRec(rxId, slot, dateKey) {
    if (!emarRecords[rxId]) emarRecords[rxId] = {};
    if (!emarRecords[rxId][slot]) emarRecords[rxId][slot] = {};
    if (!emarRecords[rxId][slot][dateKey]) {
      emarRecords[rxId][slot][dateKey] = { preparation: emarStep('pending'), verification: emarStep('pending'), dispensing: emarStep('pending') };
    }
    return emarRecords[rxId][slot][dateKey];
  }
  (function () {
    var t = emarKey(new Date());
    var a = emarRec(1, '08:00', t);
    a.preparation = emarStep('completed', '陳護士');
    a.verification = emarStep('completed', '陳護士');
    a.dispensing = emarStep('completed', '陳護士');
    var b = emarRec(2, '08:00', t);
    b.preparation = emarStep('completed', '陳護士');
    b.verification = emarStep('completed', '陳護士');
    b.dispensing = emarStep('failed', '陳護士', '血壓: 92/58');
  })();

  var emarTab = 'preparation';
  var emarSel = 0; // 被選日期（0 = 今天，顯示今天起 5 日）

  function emarStepDef() { return EMAR_STEPS.filter(function (s) { return s.key === emarTab; })[0]; }

  function emarCell(rx, slot, dateKey, step) {
    if (rx.prn) {
      return '<button type="button" class="w-full text-center text-xs text-gray-400 py-2 hover:text-blue-600" data-prn="1">無記錄</button>';
    }
    if (rx.instant && step.key !== 'dispensing') {
      return '<div class="px-2 py-2 border rounded text-center text-xs bg-gray-200 text-gray-500 border-gray-200">即時備藥</div>';
    }
    var rec = emarRec(rx.id, slot, dateKey)[step.key];
    var attrs = 'data-cell="1" data-rx="' + rx.id + '" data-slot="' + slot + '" data-date="' + dateKey + '"';
    if (rec.status === 'completed') {
      return '<button type="button" class="w-full px-2 py-2 border rounded text-center text-xs transition-all bg-green-100 text-green-800 border-green-200 hover:opacity-80" ' + attrs + '>' +
        '<i data-lucide="check-circle" class="w-3.5 h-3.5 inline-block"></i> ' + step.label +
        '<div class="text-xs text-gray-500 mt-0.5">' + rec.staff + '</div></button>';
    }
    if (rec.status === 'failed') {
      return '<button type="button" class="w-full px-2 py-2 border rounded text-center text-xs transition-all bg-red-100 text-red-800 border-red-200 hover:opacity-80" ' + attrs + '>' +
        '<i data-lucide="x-circle" class="w-3.5 h-3.5 inline-block"></i> 停服' +
        (rec.detail ? '<div class="text-red-600 font-medium mt-0.5">' + rec.detail + '</div>' : '') + '</button>';
    }
    return '<button type="button" class="w-full px-2 py-2 border rounded text-center text-xs transition-all bg-gray-100 text-gray-600 border-gray-200 hover:bg-blue-50 hover:border-blue-300" ' + attrs + '>' +
      '<i data-lucide="clock" class="w-3.5 h-3.5 inline-block"></i> ' + step.label + '</button>';
  }

  function renderEmar() {
    var root = $('#demo-emar');
    if (!root) return;
    var step = emarStepDef();
    var dates = [];
    for (var i = 0; i < 5; i++) dates.push(emarDate(i));

    var html =
      '<div class="flex flex-wrap items-center justify-between gap-3 mb-4">' +
      '<div class="flex items-center gap-2">' +
      '<button type="button" class="btn-secondary" data-act="res-prev" title="上一位院友"><i data-lucide="chevron-left" class="w-4 h-4"></i></button>' +
      '<div class="form-input px-3 py-2 text-sm font-medium text-gray-900 text-center min-w-[140px]">' + EMAR_RESIDENT.name + ' ' + EMAR_RESIDENT.bed + '</div>' +
      '<button type="button" class="btn-secondary" data-act="res-next" title="下一位院友"><i data-lucide="chevron-right" class="w-4 h-4"></i></button>' +
      '<button type="button" class="btn-secondary p-2" data-act="qr" title="掃描院友二維碼"><i data-lucide="camera" class="w-4 h-4"></i></button></div>' +
      '<div class="flex items-center gap-2">' +
      '<button type="button" class="btn-secondary p-1.5" data-act="date-prev"><i data-lucide="chevron-left" class="w-4 h-4"></i></button>' +
      '<div class="form-input px-3 py-2 text-sm text-gray-900 text-center">' + emarFmt(dates[emarSel]) + '</div>' +
      '<button type="button" class="btn-secondary p-1.5" data-act="date-next"><i data-lucide="chevron-right" class="w-4 h-4"></i></button>' +
      '<button type="button" class="btn-secondary" data-act="date-today">今天</button></div></div>' +

      '<div class="bg-white border border-gray-200 rounded-lg overflow-hidden">' +
      '<div class="flex border-b-2 border-gray-200">' +
      EMAR_STEPS.map(function (s) {
        return '<button type="button" class="flex items-center gap-2 px-6 py-3 text-sm font-semibold border-b-2 transition-colors -mb-0.5 ' +
          (emarTab === s.key ? s.active : 'border-transparent text-gray-500 hover:text-gray-700') + '" data-etab="' + s.key + '">' +
          '<i data-lucide="' + s.icon + '" class="w-4 h-4"></i>' + s.label + '</button>';
      }).join('') + '</div>' +

      '<div class="overflow-x-auto"><table class="w-full min-w-[768px] mw-table">' +
      '<thead class="bg-gray-50 sticky top-0 z-10 shadow-sm"><tr>' +
      '<th class="w-10 px-2 py-2 text-center text-xs font-semibold text-gray-600 border-b border-gray-200">行號</th>' +
      '<th class="px-2 py-2 text-center text-xs font-semibold text-gray-600 border-b border-gray-200" style="width:70px">藥物日期</th>' +
      '<th class="px-2 py-2 text-left text-xs font-semibold text-gray-600 border-b border-gray-200" style="width:235px">藥物名稱及劑型</th>' +
      '<th class="px-2 py-2 text-left text-xs font-semibold text-gray-600 border-b border-gray-200">途徑/次數</th>' +
      '<th class="px-2 py-2 text-center text-xs font-semibold text-gray-600 border-b border-gray-200" style="width:50px">服用時間</th>' +
      dates.map(function (d, di) {
        return '<th class="px-2 py-1 text-center text-xs font-semibold border-b border-gray-200 ' + (di === emarSel ? 'bg-blue-100 text-blue-800' : 'text-gray-600') + '">' +
          emarFmt(d) + '<br><span class="text-[10px] font-normal">(' + EMAR_WEEKDAYS[d.getDay()] + ')</span></th>';
      }).join('') + '</tr></thead><tbody>';

    var rowNo = 0;
    emarRx.forEach(function (rx) {
      rx.slots.forEach(function (slot, si) {
        rowNo++;
        var last = si === rx.slots.length - 1;
        var tdStyle = last ? ' style="border-bottom:2px solid #d1d5db"' : '';
        html += '<tr class="' + (rowNo % 2 === 1 ? 'bg-white' : 'bg-[#eaf0f7]') + '">';
        html += '<td class="px-2 py-2 text-center text-xs text-gray-500"' + tdStyle + '>' + rowNo + '</td>';
        if (si === 0) {
          html += '<td rowspan="' + rx.slots.length + '" class="px-1 py-2 text-center text-[10px] text-gray-500 leading-relaxed border-r border-gray-100"' + tdStyle + '>' +
            '開始日期<br>' + rx.start + '<br>處方日期<br>' + rx.rxDate + '</td>';
          html += '<td rowspan="' + rx.slots.length + '" class="px-2 py-2 border-r border-gray-100"' + tdStyle + '>' +
            '<div class="font-medium text-gray-900">' + rx.name + '</div>' +
            '<div class="flex flex-wrap gap-1 my-0.5">' +
            (rx.cannotCrush ? '<span class="inline-block text-xs font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-800 border border-red-300">不可碎藥</span>' : '') +
            (rx.shortTerm ? '<span class="inline-block text-xs font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">短期藥物</span>' : '') +
            '</div>' +
            '<div class="text-xs text-gray-500">' + rx.form + '</div>' +
            '<div class="border-t border-gray-200 mt-1 pt-1 text-xs space-y-0.5">' +
            (rx.preCheck ? '<div class="text-orange-600 font-medium">服藥前檢測：' + rx.preCheck + '</div>' : '') +
            '<div class="text-gray-500">藥物來源：' + rx.source + '</div>' +
            (rx.instant ? '<div class="text-blue-600 font-medium">⚡ 即時備藥</div>' : '') +
            (rx.note ? '<div class="text-gray-500">' + rx.note + '</div>' : '') +
            '</div></td>';
          html += '<td rowspan="' + rx.slots.length + '" class="px-2 py-2 text-xs text-gray-700 border-r border-gray-100"' + tdStyle + '>' +
            '<div>' + rx.route + '</div><div>' + rx.freq + '</div>' +
            (rx.meal ? '<div>' + rx.meal + '</div>' : '') +
            '<div>' + rx.dose + '</div>' +
            (rx.prn ? '<div class="text-red-600 font-medium">需要時</div>' : '') + '</td>';
        }
        html += '<td class="px-2 py-2 text-center text-xs text-gray-700"' + tdStyle + '>' + slot +
          (rx.injectionSite ? '<div class="text-[10px] text-orange-700 mt-0.5">注射位置<br>' + rx.injectionSite + '</div>' : '') + '</td>';
        dates.forEach(function (d) {
          html += '<td class="px-1 py-1"' + tdStyle + '>' + emarCell(rx, slot, emarKey(d), step) + '</td>';
        });
        html += '</tr>';
      });
    });
    html += '</tbody></table></div></div>';
    root.innerHTML = html;
    refreshIcons(root);
  }

  function emarUndo(rx, slot, dateKey) {
    var step = emarStepDef();
    var rec = emarRec(rx.id, slot, dateKey)[step.key];
    var m = openModal(
      '<div class="space-y-4"><p class="text-sm text-gray-600">' + EMAR_RESIDENT.name + ' — ' + rx.name + '（' + dateLabel(dateKey) + ' ' + slot + '）</p>' +
      '<p class="text-sm text-gray-600">此格' + step.label + '已由 <strong>' + (rec.staff || '—') + '</strong> 記錄' + (rec.status === 'failed' ? '（停服' + (rec.detail ? '：' + rec.detail : '') + '）' : '') + '。確定要撤銷，回復為待處理？</p>' +
      '<div class="flex justify-end gap-2 pt-2">' + btnSecondary('取消', 'data-act="cancel"') + btnDanger('確認撤銷', 'data-act="ok"') + '</div></div>',
      { title: '撤銷' + step.label, width: 'sm' }
    );
    m.body.addEventListener('click', function (ev) {
      var act = ev.target.closest('[data-act]');
      if (!act) return;
      if (act.dataset.act === 'cancel') { m.close(); return; }
      emarRec(rx.id, slot, dateKey)[step.key] = emarStep('pending');
      m.close(); renderEmar(); toast('已撤銷' + step.label + '記錄', 'danger');
    });
  }

  function emarDispense(rx, slot, dateKey) {
    var m = openModal(
      '<div class="space-y-4"><table class="min-w-full text-sm border border-gray-200 rounded-lg overflow-hidden"><tbody class="divide-y divide-gray-200">' +
      '<tr><td class="px-3 py-2 bg-gray-50 font-medium text-gray-700">院友</td><td class="px-3 py-2">' + EMAR_RESIDENT.name + '（' + EMAR_RESIDENT.bed + '）</td></tr>' +
      '<tr><td class="px-3 py-2 bg-gray-50 font-medium text-gray-700">藥物</td><td class="px-3 py-2">' + rx.name + ' ' + rx.dose + '</td></tr>' +
      '<tr><td class="px-3 py-2 bg-gray-50 font-medium text-gray-700">日期 / 時間</td><td class="px-3 py-2">' + dateLabel(dateKey) + ' ' + slot + '</td></tr>' +
      (rx.preCheck ? '<tr><td class="px-3 py-2 bg-gray-50 font-medium text-gray-700">服藥前檢測</td><td class="px-3 py-2 text-orange-600 font-medium">' + rx.preCheck + '</td></tr>' : '') +
      '</tbody></table>' +
      '<div class="flex justify-end gap-2 pt-2">' + btnDanger('停服', 'data-act="fail"') + btnPrimary('成功', 'data-act="ok"') + '</div></div>',
      { title: '確認派藥？', width: 'md' }
    );
    m.body.addEventListener('click', function (ev) {
      var act = ev.target.closest('[data-act]');
      if (!act) return;
      if (act.dataset.act === 'ok') {
        m.close();
        askSignature('派藥簽署 — ' + EMAR_RESIDENT.name + ' ' + rx.name, function (name) {
          emarRec(rx.id, slot, dateKey).dispensing = emarStep('completed', name);
          renderEmar(); toast(rx.name + ' 已派藥（' + name + '）');
        });
      } else if (act.dataset.act === 'fail') {
        emarRec(rx.id, slot, dateKey).dispensing = emarStep('failed', '陳護士', rx.preCheck ? '血壓: 92/58' : '停服');
        m.close(); renderEmar(); toast('已記錄停服', 'danger');
      }
    });
  }

  function initEmar() {
    var root = $('#demo-emar');
    if (!root) return;
    renderEmar();
    root.addEventListener('click', function (e) {
      var tab = e.target.closest('[data-etab]');
      if (tab) { emarTab = tab.dataset.etab; renderEmar(); return; }

      var actEl = e.target.closest('[data-act]');
      if (actEl) {
        var act = actEl.dataset.act;
        if (act === 'qr') { fakeScan('掃描院友二維碼', function () { toast('已掃描院友 QR：' + EMAR_RESIDENT.name); }); return; }
        if (act === 'res-prev' || act === 'res-next') { toast('示範數據只有一位院友：' + EMAR_RESIDENT.name + '（' + EMAR_RESIDENT.bed + '）'); return; }
        if (act === 'date-prev') { if (emarSel > 0) { emarSel--; renderEmar(); } return; }
        if (act === 'date-next') { if (emarSel < 4) { emarSel++; renderEmar(); } return; }
        if (act === 'date-today') { emarSel = 0; renderEmar(); return; }
      }

      if (e.target.closest('[data-prn]')) { toast('需要時給藥程序見下方 PRN 示範'); return; }

      var cell = e.target.closest('[data-cell]');
      if (!cell) return;
      var rx = emarRx.filter(function (x) { return x.id === +cell.dataset.rx; })[0];
      var slot = cell.dataset.slot;
      var dateKey = cell.dataset.date;
      var rec = emarRec(rx.id, slot, dateKey)[emarTab];
      if (rec.status !== 'pending') { emarUndo(rx, slot, dateKey); return; }
      if (emarTab === 'dispensing') { emarDispense(rx, slot, dateKey); return; }
      var step = emarStepDef();
      askSignature(step.label + '簽署 — ' + EMAR_RESIDENT.name + ' ' + rx.name, function (name) {
        emarRec(rx.id, slot, dateKey)[emarTab] = emarStep('completed', name);
        renderEmar(); toast(rx.name + ' ' + step.label + '已簽署（' + name + '）');
      });
    });
  }

  /* ============================================================
     3. 排班表（更表）
     對照 RosterScheduleGrid / ConflictTicker
     ============================================================ */

  var DAYS = ['一', '二', '三', '四', '五', '六', '日'];
  var SHIFT_COLORS = { A: 'bg-blue-600 text-white', P: 'bg-amber-500 text-white', N: 'bg-slate-600 text-white' };
  var ROSTER_STAFF = ['陳護士', '李護士', '黃護士', '王護理員', '張護理員', '周護理員'];
  var rosterAssignments = {};
  (function () {
    var seed = {
      '陳護士': { 0: 'A', 1: 'A', 3: 'P', 4: 'P' },
      '李護士': { 1: 'A', 2: 'A', 4: 'N', 5: 'N' },
      '黃護士': { 0: 'P', 2: 'P', 5: 'A', 6: 'A' },
      '王護理員': { 0: 'A', 1: 'A', 2: 'A', 5: 'P' },
      '張護理員': { 3: 'A', 4: 'A', 6: 'N' },
      '周護理員': { 2: 'N', 3: 'N', 6: 'A' }
    };
    ROSTER_STAFF.forEach(function (s) { rosterAssignments[s] = Object.assign({}, seed[s] || {}); });
  })();
  var conflicts = [{ id: 'c1', text: '陳護士 星期一同日編排 A 與 P 班次（衝突）' }];
  var draggedShift = null;

  function renderRoster() {
    var root = $('#demo-roster');
    if (!root) return;
    var html =
      '<div class="flex items-center justify-between mb-3 gap-2 flex-wrap">' +
      '<div class="flex items-center gap-2 text-sm text-gray-500">' +
      '<i data-lucide="calendar" class="w-4 h-4"></i><span>本週 8月25日 – 8月31日</span></div>' +
      '<div class="flex items-center gap-2 text-xs">' +
      '<span class="inline-flex items-center gap-1"><span class="w-3 h-3 rounded-full bg-blue-600"></span>早班 A</span>' +
      '<span class="inline-flex items-center gap-1"><span class="w-3 h-3 rounded-full bg-amber-500"></span>夜更 P</span>' +
      '<span class="inline-flex items-center gap-1"><span class="w-3 h-3 rounded-full bg-slate-600"></span>通宵 N</span></div></div>';
    if (conflicts.length) {
      html += '<div class="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3 overflow-hidden">' +
        '<i data-lucide="alert-triangle" class="w-4 h-4 text-red-600 flex-shrink-0"></i>' +
        '<div class="flex-1 overflow-hidden"><div class="flex gap-6 whitespace-nowrap animate-[marquee_20s_linear_infinite]">' +
        conflicts.map(function (c) { return '<button type="button" class="text-sm text-red-700 hover:underline">' + c.text + '</button>'; }).join('') +
        '</div></div></div>';
    }
    html += '<div class="overflow-x-auto"><table class="min-w-full text-sm border border-gray-200 rounded-lg overflow-hidden">' +
      '<thead class="bg-gray-50"><tr><th class="px-2 py-2 text-left font-medium text-gray-700">員工</th>' +
      DAYS.map(function (d, i) { return '<th class="px-2 py-2 text-center font-medium text-gray-700">' + d + '<br/><span class="text-xs font-normal text-gray-500">' + (i + 25) + '日</span></th>'; }).join('') +
      '</tr></thead><tbody class="divide-y divide-gray-200 bg-white">';
    ROSTER_STAFF.forEach(function (s) {
      html += '<tr><td class="px-2 py-2 font-medium text-gray-900">' + s + '</td>';
      for (var i = 0; i < 7; i++) {
        var sh = rosterAssignments[s][i];
        html += '<td class="px-1 py-1 text-center align-middle h-12">' +
          '<div class="fd-roster-cell min-h-[36px] flex items-center justify-center rounded-md border border-dashed border-transparent ' + (sh ? '' : 'hover:bg-gray-50') + '" data-day="' + i + '" data-staff="' + s + '">' +
          (sh ? '<span class="inline-block px-2 py-1 rounded-md text-xs font-semibold cursor-grab ' + (SHIFT_COLORS[sh] || 'bg-gray-200 text-gray-800') + '" draggable="true" data-shift="' + sh + '">' + sh + '</span>' : '') +
          '</div></td>';
      }
      html += '</tr>';
    });
    html += '</tbody></table></div>' +
      '<div class="mt-3 p-3 border-2 border-dashed border-gray-300 rounded-lg text-center text-sm text-gray-500 fd-trash" data-trash>' +
      '<i data-lucide="trash-2" class="w-4 h-4 inline mr-1"></i>拖曳班次到此移除</div>';
    root.innerHTML = html;
    refreshIcons(root);
    attachRosterDnd();
  }

  function attachRosterDnd() {
    var root = $('#demo-roster');
    $$('[draggable="true"]', root).forEach(function (el) {
      el.addEventListener('dragstart', function (e) {
        draggedShift = { staff: el.closest('td').querySelector('[data-staff]').dataset.staff, day: +el.closest('td').querySelector('[data-staff]').dataset.day, shift: el.dataset.shift };
        e.dataTransfer.effectAllowed = 'move';
      });
    });
    $$('.fd-roster-cell', root).forEach(function (cell) {
      cell.addEventListener('dragover', function (e) { e.preventDefault(); cell.classList.add('bg-blue-50', 'border-blue-300'); });
      cell.addEventListener('dragleave', function () { cell.classList.remove('bg-blue-50', 'border-blue-300'); });
      cell.addEventListener('drop', function (e) {
        e.preventDefault();
        cell.classList.remove('bg-blue-50', 'border-blue-300');
        if (!draggedShift) return;
        var tStaff = cell.dataset.staff, tDay = +cell.dataset.day;
        if (tStaff === draggedShift.staff && tDay === draggedShift.day) return;
        if (rosterAssignments[tStaff][tDay]) { toast('該格已有班次，請先移除', 'danger'); return; }
        delete rosterAssignments[draggedShift.staff][draggedShift.day];
        rosterAssignments[tStaff][tDay] = draggedShift.shift;
        checkRosterConflicts();
        renderRoster();
        toast('已調動 ' + draggedShift.shift + ' 班到 ' + tStaff + ' 星期' + DAYS[tDay]);
      });
    });
    var trash = $('[data-trash]', root);
    if (trash) {
      trash.addEventListener('dragover', function (e) { e.preventDefault(); trash.classList.add('border-red-400', 'text-red-500', 'bg-red-50'); });
      trash.addEventListener('dragleave', function () { trash.classList.remove('border-red-400', 'text-red-500', 'bg-red-50'); });
      trash.addEventListener('drop', function (e) {
        e.preventDefault(); trash.classList.remove('border-red-400', 'text-red-500', 'bg-red-50');
        if (!draggedShift) return;
        delete rosterAssignments[draggedShift.staff][draggedShift.day];
        checkRosterConflicts(); renderRoster();
        toast('已移除 ' + draggedShift.staff + ' 的 ' + draggedShift.shift + ' 班');
      });
    }
  }

  function checkRosterConflicts() {
    conflicts = [];
    ROSTER_STAFF.forEach(function (s) {
      var days = Object.keys(rosterAssignments[s]);
      days.forEach(function (d) {
        if (Object.keys(rosterAssignments[s]).filter(function (k) { return k === d; }).length > 1) {
          conflicts.push({ id: s + d, text: s + ' 星期' + DAYS[d] + ' 同日編排多個班次' });
        }
      });
    });
  }

  function initRoster() { renderRoster(); }

  /* ============================================================
     4. 預排假期（預排表）
     對照 RosterManagement.tsx leave tab
     ============================================================ */

  var LEAVE_TYPES = [
    { key: 'AL', label: '年假', color: 'bg-blue-600' },
    { key: 'RO', label: '休息日', color: 'bg-green-600' },
    { key: 'PH', label: '公眾假', color: 'bg-amber-500' },
    { key: 'BH', label: '銀行假', color: 'bg-red-600' }
  ];
  var LEAVE_DAYS = Array.from({ length: 14 }, function (_, i) { return i + 1; });
  var leaveData = {};
  ROSTER_STAFF.forEach(function (s) { leaveData[s] = {}; });
  leaveData['陳護士'][5] = 'AL';
  leaveData['李護士'][12] = 'RO';
  leaveData['黃護士'][8] = 'PH';

  function renderLeave() {
    var root = $('#demo-leave');
    if (!root) return;
    var html =
      '<div class="flex items-center justify-between mb-3 gap-2 flex-wrap">' +
      '<div class="flex items-center gap-2 text-sm text-gray-500">' +
      '<i data-lucide="calendar" class="w-4 h-4"></i><span>2026年8月</span></div>' +
      '<div class="flex items-center gap-2 text-xs">' + LEAVE_TYPES.map(function (t) {
        return '<span class="inline-flex items-center gap-1"><span class="w-3 h-3 rounded-full ' + t.color + '"></span>' + t.label + '</span>';
      }).join('') + '</div></div>' +
      '<div class="overflow-x-auto"><table class="min-w-full text-xs border border-gray-200 rounded-lg overflow-hidden">' +
      '<thead class="bg-gray-50"><tr><th class="px-2 py-2 text-left font-medium text-gray-700 sticky left-0 bg-gray-50">員工</th>' +
      LEAVE_DAYS.map(function (d) { return '<th class="px-1 py-1 text-center font-medium text-gray-700 w-8">' + d + '</th>'; }).join('') +
      '</tr></thead><tbody class="divide-y divide-gray-200 bg-white">';
    ROSTER_STAFF.forEach(function (s) {
      html += '<tr><td class="px-2 py-2 font-medium text-gray-900 sticky left-0 bg-white">' + s + '</td>';
      LEAVE_DAYS.forEach(function (d) {
        var type = leaveData[s][d];
        var label = type ? LEAVE_TYPES.filter(function (t) { return t.key === type; })[0] : null;
        html += '<td class="p-1"><button type="button" class="w-7 h-7 rounded text-xs font-medium flex items-center justify-center ' +
          (label ? label.color + ' text-white' : 'text-gray-400 hover:bg-gray-100') + '" data-staff="' + s + '" data-day="' + d + '">' + (type || '') + '</button></td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>' +
      '<p class="mt-3 text-xs text-gray-500">點空格選擇假期類型；再點已填的格可取消。</p>';
    root.innerHTML = html;
    root.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-staff]');
      if (!btn) return;
      var s = btn.dataset.staff, d = +btn.dataset.day;
      var current = leaveData[s][d];
      if (current) {
        delete leaveData[s][d]; renderLeave();
        toast('已取消 ' + s + ' ' + d + '日假期');
        return;
      }
      var next = LEAVE_TYPES[(LEAVE_TYPES.findIndex(function (t) { return leaveData[s][d - 1] === t.key; }) + 1) % LEAVE_TYPES.length];
      leaveData[s][d] = next.key; renderLeave();
      toast(s + ' ' + d + '日已放 ' + next.label);
    });
  }

  function initLeave() { renderLeave(); }

  /* ============================================================
     5. 床位調床
     對照 StationBedManagement / BedSwapModal
     ============================================================ */

  var STATIONS = [
    { id: 's1', name: 'A 站', rooms: [
      { name: '101', beds: ['101-A', '101-B', '101-C'] },
      { name: '102', beds: ['102-A', '102-B'] }
    ]},
    { id: 's2', name: 'B 站', rooms: [
      { name: '201', beds: ['201-A', '201-B'] },
      { name: '202', beds: ['202-A'] }
    ]}
  ];
  var bedPatient = {
    '101-A': '陳大文', '101-B': '李笑好', '102-A': '黃伯強',
    '201-A': '梁志偉', '202-A': '林淑芬'
  };
  var swapSource = null;
  var bedLogs = [];

  function renderBeds() {
    var root = $('#demo-beds');
    if (!root) return;
    var html =
      '<div class="flex items-center justify-between mb-4 gap-2 flex-wrap">' +
      '<div class="flex items-center gap-2 text-sm text-gray-500">' +
      '<i data-lucide="building-2" class="w-4 h-4"></i><span>床位平面圖</span></div>' +
      '<div class="flex items-center gap-2 text-xs">' +
      '<span class="inline-flex items-center gap-1"><span class="w-3 h-3 rounded bg-blue-100 border border-blue-300"></span>已入住</span>' +
      '<span class="inline-flex items-center gap-1"><span class="w-3 h-3 rounded bg-gray-100 border border-gray-200"></span>空床</span></div></div>';
    STATIONS.forEach(function (st) {
      html += '<div class="mb-5"><h3 class="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">' +
        '<i data-lucide="building" class="w-4 h-4 text-gray-500"></i>' + st.name + '</h3>' +
        '<div class="flex flex-wrap gap-4">';
      st.rooms.forEach(function (room) {
        html += '<div class="card border border-gray-200 rounded-lg p-3 bg-white min-w-[180px]">' +
          '<div class="text-xs text-gray-500 mb-2 flex items-center gap-1"><i data-lucide="door-open" class="w-3 h-3"></i>' + room.name + ' 房</div>' +
          '<div class="flex flex-wrap gap-2">';
        room.beds.forEach(function (b) {
          var p = bedPatient[b];
          var isSource = swapSource === b;
          html += '<button type="button" class="relative w-20 min-h-[56px] rounded-lg border text-xs flex flex-col items-center justify-center p-1 transition-colors ' +
            (isSource ? 'ring-2 ring-amber-500 bg-amber-50 border-amber-300' : p ? 'bg-blue-50 border-blue-300 text-gray-900 hover:bg-blue-100' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100') + '" data-bed="' + b + '">' +
            '<span class="font-semibold">' + b + '</span>' +
            (p ? '<span class="mt-0.5 text-[10px] text-gray-600 truncate w-full text-center">' + p + '</span>' : '<span class="mt-0.5 text-[10px] text-gray-400">空床</span>') +
            '</button>';
        });
        html += '</div></div>';
      });
      html += '</div></div>';
    });
    if (bedLogs.length) {
      html += '<div class="mt-4 border-t border-gray-200 pt-3"><h4 class="text-xs font-semibold text-gray-700 mb-2">最近調動記錄</h4><ul class="text-xs text-gray-500 space-y-1">' +
        bedLogs.slice(-3).map(function (l) { return '<li class="flex items-center gap-1"><i data-lucide="history" class="w-3 h-3"></i>' + l + '</li>'; }).join('') + '</ul></div>';
    }
    root.innerHTML = html;
    refreshIcons(root);
  }

  function initBeds() {
    var root = $('#demo-beds');
    if (!root) return;
    renderBeds();
    root.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-bed]');
      if (!btn) return;
      var bed = btn.dataset.bed;
      if (!swapSource) {
        if (!bedPatient[bed]) { toast('空床不能作為調床起點', 'danger'); return; }
        swapSource = bed; renderBeds();
        toast('已選擇 ' + bed + '，請點選目標床位');
        return;
      }
      if (swapSource === bed) { swapSource = null; renderBeds(); return; }
      var sourceName = bedPatient[swapSource];
      var targetName = bedPatient[bed];
      var m = openModal(
        '<div class="space-y-4"><p class="text-sm text-gray-700">確定把 <strong>' + sourceName + '</strong> 由 <strong>' + swapSource + '</strong> 調到 <strong>' + bed + '</strong>？</p>' +
        (targetName ? '<p class="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">目標床位已有院友：' + targetName + '，確認將會互換床位。</p>' : '') +
        '<div class="flex justify-end gap-2">' + btnSecondary('取消', 'data-act="cancel"') + btnPrimary('確認調床', 'data-act="ok"') + '</div></div>',
        { title: '調床確認', width: 'sm' }
      );
      m.body.addEventListener('click', function (ev) {
        var act = ev.target.closest('[data-act]');
        if (!act) return;
        if (act.dataset.act === 'cancel') { swapSource = null; m.close(); renderBeds(); return; }
        var oldTarget = bedPatient[bed];
        bedPatient[bed] = sourceName;
        if (oldTarget) bedPatient[swapSource] = oldTarget;
        else delete bedPatient[swapSource];
        bedLogs.push(sourceName + ' ' + swapSource + ' → ' + bed + '（' + now() + '）');
        swapSource = null; m.close(); renderBeds();
        toast('已完成調床');
      });
    });
  }

  /* ============================================================
     6. 生命表徵批量工作紙 / 拍照識別
     對照 BatchHealthRecordOCRModal / VitalSignScanner / HealthRecordModal
     ============================================================ */

  var vitalsRows = [
    { name: '陳大文', bed: '101-A', bpSys: '120', bpDia: '80', pulse: '72', glucose: '', temp: '36.5', weight: '' },
    { name: '李笑好', bed: '101-B', bpSys: '', bpDia: '', pulse: '68', glucose: '6.2', temp: '36.8', weight: '' },
    { name: '黃伯強', bed: '102-A', bpSys: '145', bpDia: '92', pulse: '78', glucose: '', temp: '37.2', weight: '' },
    { name: '周桂蘭', bed: '102-B', bpSys: '118', bpDia: '76', pulse: '70', glucose: '5.8', temp: '', weight: '' },
    { name: '吳美玲', bed: '103-A', bpSys: '', bpDia: '', pulse: '', glucose: '', temp: '36.4', weight: '52.0' }
  ];

  function isAbnormal(row) {
    var sys = parseFloat(row.bpSys), dia = parseFloat(row.bpDia), pulse = parseFloat(row.pulse), temp = parseFloat(row.temp), glucose = parseFloat(row.glucose);
    return (sys && sys > 140) || (dia && dia > 90) || (pulse && pulse > 100) || (temp && temp >= 37.5) || (glucose && glucose > 11.1);
  }

  function renderVitals() {
    var root = $('#demo-vitals');
    if (!root) return;
    var html =
      '<div class="flex items-center justify-between mb-4 gap-2 flex-wrap">' +
      '<div class="flex items-center gap-2 text-sm text-gray-500"><i data-lucide="calendar" class="w-4 h-4"></i><span>' + todayStr() + ' 生命表徵批量工作紙</span></div>' +
      '<div class="flex items-center gap-2">' + btnSecondary('<i data-lucide="camera" class="w-4 h-4"></i> 拍照識別工作紙', 'data-act="ocr"') +
      btnPrimary('<i data-lucide="save" class="w-4 h-4"></i> 儲存工作紙', 'data-act="save"') + '</div></div>' +
      '<div class="overflow-x-auto"><table class="min-w-full text-sm border border-gray-200 rounded-lg overflow-hidden">' +
      '<thead class="bg-gray-50"><tr>' +
      '<th class="px-3 py-2 text-left font-medium text-gray-700">院友 / 床號</th>' +
      '<th class="px-2 py-2 text-center font-medium text-gray-700">收縮壓</th>' +
      '<th class="px-2 py-2 text-center font-medium text-gray-700">舒張壓</th>' +
      '<th class="px-2 py-2 text-center font-medium text-gray-700">脈搏</th>' +
      '<th class="px-2 py-2 text-center font-medium text-gray-700">血糖<br/><span class="text-xs font-normal">mmol/L</span></th>' +
      '<th class="px-2 py-2 text-center font-medium text-gray-700">體溫<br/><span class="text-xs font-normal">°C</span></th>' +
      '<th class="px-2 py-2 text-center font-medium text-gray-700">體重<br/><span class="text-xs font-normal">kg</span></th>' +
      '</tr></thead><tbody class="divide-y divide-gray-200 bg-white">';
    vitalsRows.forEach(function (r, i) {
      var abnormal = isAbnormal(r);
      html += '<tr class="' + (abnormal ? 'bg-red-50' : '') + '"><td class="px-3 py-2"><div class="font-medium text-gray-900">' + r.name + '</div><div class="text-xs text-gray-500">' + r.bed + '</div></td>' +
        '<td class="px-2 py-1"><input class="form-input w-16 rounded border ' + (r.bpSys > 140 ? 'border-red-400 bg-red-50 text-red-700 font-semibold' : 'border-gray-300') + ' px-1 py-1 text-center text-sm" data-row="' + i + '" data-field="bpSys" value="' + r.bpSys + '"/></td>' +
        '<td class="px-2 py-1"><input class="form-input w-16 rounded border ' + (r.bpDia > 90 ? 'border-red-400 bg-red-50 text-red-700 font-semibold' : 'border-gray-300') + ' px-1 py-1 text-center text-sm" data-row="' + i + '" data-field="bpDia" value="' + r.bpDia + '"/></td>' +
        '<td class="px-2 py-1"><input class="form-input w-16 rounded border ' + (r.pulse > 100 ? 'border-red-400 bg-red-50 text-red-700 font-semibold' : 'border-gray-300') + ' px-1 py-1 text-center text-sm" data-row="' + i + '" data-field="pulse" value="' + r.pulse + '"/></td>' +
        '<td class="px-2 py-1"><input class="form-input w-16 rounded border ' + (r.glucose > 11.1 ? 'border-red-400 bg-red-50 text-red-700 font-semibold' : 'border-gray-300') + ' px-1 py-1 text-center text-sm" data-row="' + i + '" data-field="glucose" value="' + r.glucose + '"/></td>' +
        '<td class="px-2 py-1"><input class="form-input w-16 rounded border ' + (r.temp >= 37.5 ? 'border-red-400 bg-red-50 text-red-700 font-semibold' : 'border-gray-300') + ' px-1 py-1 text-center text-sm" data-row="' + i + '" data-field="temp" value="' + r.temp + '"/></td>' +
        '<td class="px-2 py-1"><input class="form-input w-16 rounded border border-gray-300 px-1 py-1 text-center text-sm" data-row="' + i + '" data-field="weight" value="' + r.weight + '"/></td></tr>';
    });
    html += '</tbody></table></div>';
    root.innerHTML = html;
    root.addEventListener('input', function (e) {
      var inp = e.target.closest('input[data-row]');
      if (!inp) return;
      var row = +inp.dataset.row, field = inp.dataset.field;
      vitalsRows[row][field] = inp.value;
      renderVitals();
    });
    root.addEventListener('click', function (e) {
      if (e.target.closest('[data-act="save"]')) {
        toast('已儲存生命表徵工作紙');
        return;
      }
      if (e.target.closest('[data-act="ocr"]')) {
        openModal(
          '<div class="space-y-4"><div class="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center text-center">' +
          '<i data-lucide="camera" class="w-10 h-10 text-gray-400 mb-2"></i>' +
          '<p class="text-sm text-gray-600">點擊拍照或選擇相簿圖片</p><p class="text-xs text-gray-500 mt-1">支援 JPG、PNG、WEBP</p></div>' +
          '<div class="flex justify-end gap-2">' + btnSecondary('取消', 'data-act="cancel"') + btnPrimary('<i data-lucide="scan-line" class="w-4 h-4"></i> 開始識別', 'data-act="start"') + '</div></div>',
          { title: '拍照識別監測工作紙', width: 'md' }
        ).body.addEventListener('click', function (ev) {
          var act = ev.target.closest('[data-act]');
          if (!act) return;
          if (act.dataset.act === 'start') {
            toast('已識別工作紙：5 位院友，異常值已標紅');
            vitalsRows[2].bpSys = '148'; vitalsRows[2].bpDia = '95';
            renderVitals();
          }
        });
      }
    });
  }

  function initVitals() { renderVitals(); }

  /* ============================================================
     7. 身份證 OCR 建檔
     對照 OCRIDCardBlock
     ============================================================ */

  var ocrPatient = { name: '', idc: '', dob: '' };
  var ocrConflict = false;

  function renderOcr() {
    var root = $('#demo-ocr');
    if (!root) return;
    root.innerHTML =
      '<div class="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border-2 border-purple-200 mb-4">' +
      '<button type="button" class="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 hover:bg-white/50 transition-colors rounded-lg" data-act="toggle">' +
      '<div class="flex items-center gap-3"><div class="p-2 bg-purple-100 rounded-lg"><i data-lucide="credit-card" class="w-5 h-5 text-purple-600"></i></div>' +
      '<div class="text-left"><h3 class="font-semibold text-gray-900">智能識別身份證</h3><p class="text-sm text-gray-600">上傳身份證圖片，自動識別並填入資料</p></div></div>' +
      '<i data-lucide="chevron-down" class="w-5 h-5 text-gray-500"></i></button>' +
      '<div class="px-4 pb-4 space-y-4" id="ocr-body">' +
      '<div class="bg-purple-50 border border-purple-200 rounded-lg p-3"><div class="flex items-start gap-2">' +
      '<i data-lucide="file-text" class="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0"></i>' +
      '<div class="text-sm text-gray-700"><p class="font-medium mb-1">使用提示：</p><ul class="list-disc list-inside space-y-1 text-xs"><li>請確保圖片清晰，文字可辨識</li><li>識別後資料會自動填入對應欄位</li><li>支援香港身份證正反面</li></ul></div></div></div>' +
      '<div class="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors" data-act="scan">' +
      '<i data-lucide="upload" class="w-10 h-10 text-gray-400 mb-2"></i>' +
      '<p class="text-sm text-gray-600">點擊拍照或選擇相簿圖片</p><p class="text-xs text-gray-500 mt-1">支援 JPG、PNG、WEBP</p></div>' +
      '<div class="grid grid-cols-1 md:grid-cols-3 gap-3">' +
      '<div><label class="form-label block text-sm font-medium text-gray-700 mb-1">姓名</label><input id="ocr-name" class="form-input w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value="' + ocrPatient.name + '"/></div>' +
      '<div><label class="form-label block text-sm font-medium text-gray-700 mb-1">身份證號碼</label><input id="ocr-idc" class="form-input w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value="' + ocrPatient.idc + '"/></div>' +
      '<div><label class="form-label block text-sm font-medium text-gray-700 mb-1">出生日期</label><input id="ocr-dob" type="date" class="form-input w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value="' + ocrPatient.dob + '"/></div></div>' +
      (ocrConflict ? '<div class="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2"><i data-lucide="alert-triangle" class="w-5 h-5 text-red-600 flex-shrink-0"></i><p class="text-sm text-red-700">此身份證號碼與現有院友重複，請檢查是否重複建檔。</p></div>' : '') +
      '<div class="flex justify-end">' + btnPrimary('<i data-lucide="save" class="w-4 h-4"></i> 儲存院友資料', 'data-act="save"') + '</div></div></div>';
    refreshIcons(root);
    root.addEventListener('click', function (e) {
      var act = e.target.closest('[data-act]');
      if (!act) return;
      if (act.dataset.act === 'toggle') {
        var body = $('#ocr-body', root);
        body.style.display = body.style.display === 'none' ? 'block' : 'none';
        return;
      }
      if (act.dataset.act === 'scan') {
        fakeScan('掃描身份證', function () {
          if (!ocrPatient.name) {
            ocrPatient = { name: '陳大文', idc: 'A123456(7)', dob: '1945-03-12' };
            ocrConflict = true;
          } else {
            ocrPatient = { name: '王小明', idc: 'Z987654(3)', dob: '1952-11-08' };
            ocrConflict = false;
          }
          renderOcr();
          toast(ocrConflict ? '識別完成：身份證號碼與現有院友重複' : '識別完成');
        });
      }
      if (act.dataset.act === 'save') {
        toast('已儲存院友資料（示範）');
      }
    });
  }

  function initOcr() { renderOcr(); }

  /* ============================================================
     8. AI 助手
     對照 AiAssistantChat
     ============================================================ */

  var aiMessages = [
    { who: 'bot', text: '你好，我是 eHMS AI 助手。可以幫你查數據、辦事情。請問有咩可以幫到你？' }
  ];
  var aiSuggestions = ['今日仲有邊個未量體溫？', '幫陳大文加個覆診', '顯示本週到期傷口'];

  function renderAi() {
    var root = $('#demo-ai');
    if (!root) return;
    var html =
      '<div class="card border border-gray-200 rounded-lg bg-white flex flex-col h-[380px]">' +
      '<div class="flex-1 overflow-y-auto p-4 space-y-3" id="ai-log">';
    aiMessages.forEach(function (msg) {
      if (msg.who === 'user') {
        html += '<div class="flex justify-end"><div class="max-w-[85%] bg-blue-600 text-white text-sm px-4 py-2 rounded-2xl rounded-tr-md">' + msg.text + '</div></div>';
      } else {
        html += '<div class="flex justify-start gap-2"><div class="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0"><i data-lucide="bot" class="w-4 h-4 text-green-600"></i></div>' +
          '<div class="max-w-[85%] bg-gray-100 text-gray-800 text-sm px-4 py-2 rounded-2xl rounded-tl-md border border-gray-200">' + msg.text + '</div></div>';
      }
    });
    html += '</div>' +
      '<div class="border-t border-gray-200 p-3"><div class="flex flex-wrap gap-2 mb-2">' + aiSuggestions.map(function (s) {
        return '<button type="button" class="text-xs px-2 py-1 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50" data-suggest>' + s + '</button>';
      }).join('') + '</div>' +
      '<div class="flex gap-2"><input id="ai-input" class="form-input flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="輸入問題或指示…"/>' +
      '<button type="button" class="btn-primary inline-flex items-center gap-1.5 px-4 py-2" data-act="send"><i data-lucide="send" class="w-4 h-4"></i></button></div></div></div>';
    root.innerHTML = html;
    refreshIcons(root);
    var log = $('#ai-log', root); log.scrollTop = log.scrollHeight;
  }

  function aiReply(text) {
    var reply;
    if (/體溫/.test(text)) {
      reply = '今日尚有 2 位院友未量體溫：周桂蘭（102-B）、林淑芬（202-A）。<br><button type="button" class="btn-primary mt-2 px-3 py-1 text-xs" data-open-vitals>開啟工作紙</button>';
    } else if (/覆診/.test(text)) {
      reply = '請確認以下覆診資料：<div class="mt-2 p-2 bg-white rounded-lg border border-gray-200 text-xs space-y-1"><div>院友：陳大文（101-A）</div><div>項目：覆診</div><div>日期：' + dateStr(7) + '</div></div><div class="mt-2 flex gap-2"><button class="btn-success px-3 py-1 text-xs" data-confirm>確認</button><button class="btn-secondary px-3 py-1 text-xs" data-cancel>取消</button></div>';
    } else {
      reply = '收到，我會為你處理「' + text + '」。在正式環境中，我會先確認細節再執行。';
    }
    aiMessages.push({ who: 'bot', text: reply });
    renderAi();
  }

  function initAi() {
    var root = $('#demo-ai');
    if (!root) return;
    renderAi();
    root.addEventListener('click', function (e) {
      var suggest = e.target.closest('[data-suggest]');
      var send = e.target.closest('[data-act="send"]');
      var input = $('#ai-input', root);
      var text = '';
      if (suggest) text = suggest.textContent;
      else if (send) text = input.value.trim();
      else if (e.target.closest('[data-confirm]')) { toast('已確認並建立覆診記錄'); return; }
      else if (e.target.closest('[data-cancel]')) { toast('已取消'); return; }
      else if (e.target.closest('[data-open-vitals]')) { var t = document.getElementById('vitals'); if (t) t.scrollIntoView({ behavior: 'smooth' }); return; }
      else return;
      if (!text) return;
      aiMessages.push({ who: 'user', text: text });
      input.value = '';
      renderAi();
      setTimeout(function () { aiReply(text); }, 600);
    });
    root.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { var input = $('#ai-input', root); if (input.value.trim()) { aiMessages.push({ who: 'user', text: input.value.trim() }); input.value = ''; renderAi(); setTimeout(function () { aiReply(input.value.trim()); }, 600); } }
    });
  }

  /* ============================================================
     9. 傷口管理
     對照 WoundManagement.tsx（搜尋列 + 傷口評估 table）
     ============================================================ */

  var WOUND_STAGE_COLORS = {
    '階段1': 'bg-green-100 text-green-800',
    '階段2': 'bg-yellow-100 text-yellow-800',
    '階段3': 'bg-orange-100 text-orange-800',
    '階段4': 'bg-red-100 text-red-800',
    '無法評估': 'bg-purple-100 text-purple-800'
  };
  var WOUND_STATUS_COLORS = {
    '未處理': 'bg-gray-100 text-gray-800',
    '治療中': 'bg-yellow-100 text-yellow-800',
    '已痊癒': 'bg-green-100 text-green-800'
  };
  var WOUND_PARTS = ['頭', '頸', '胸', '腹', '背', '骶尾骨', '左上臂', '右上臂', '左手肘', '右手肘', '左大腿', '右大腿', '左小腿', '右小腿', '左足跟', '右足跟'];

  function woundFmt(iso) { var p = iso.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function woundAddDays(iso, n) {
    var d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function woundNextClass(iso) {
    if (iso < todayStr()) return 'text-red-600 font-medium';
    if (iso <= woundAddDays(todayStr(), 3)) return 'text-orange-600 font-medium';
    return 'text-gray-700';
  }

  var woundNextId = 5;
  var woundRows = [
    { id: 1, name: '陳大文', bed: '101-A', site: '骶尾骨', assessor: '陳護士', assessDate: dateStr(-7), nextDate: dateStr(-3), wounds: 1, photos: 1, woundStatus: '治療中', recordStatus: '生效中', stage: '階段2', infection: '無感染', note: '' },
    { id: 2, name: '李笑好', bed: '101-B', site: '左足跟', assessor: '李護士', assessDate: dateStr(-5), nextDate: dateStr(2), wounds: 1, photos: 0, woundStatus: '治療中', recordStatus: '生效中', stage: '階段1', infection: '無感染', note: '' },
    { id: 3, name: '黃伯強', bed: '102-A', site: '右髋', assessor: '陳護士', assessDate: dateStr(-4), nextDate: dateStr(10), wounds: 2, photos: 2, woundStatus: '治療中', recordStatus: '生效中', stage: '階段3', infection: '懷疑感染', note: '' },
    { id: 4, name: '周桂蘭', bed: '102-B', site: '左手肘', assessor: '黃護士', assessDate: dateStr(-20), nextDate: dateStr(5), wounds: 1, photos: 1, woundStatus: '已痊癒', recordStatus: '已歸檔', stage: '階段1', infection: '無感染', note: '' }
  ];
  var woundSearch = '';
  var woundStage = '';
  var woundInfection = '';
  var woundShowFilter = false;

  function woundFiltered() {
    var q = woundSearch.trim().toLowerCase();
    return woundRows.filter(function (r) {
      if (woundStage && r.stage !== woundStage) return false;
      if (woundInfection && r.infection !== woundInfection) return false;
      if (!q) return true;
      var hay = (r.name + ' ' + r.bed + ' ' + r.assessor + ' ' + r.stage + ' ' + r.site + ' ' + r.note).toLowerCase();
      return hay.indexOf(q) !== -1;
    });
  }

  function woundRowsHtml() {
    var rows = woundFiltered();
    if (!rows.length) return '<tr><td colspan="9" class="px-4 py-8 text-center text-sm text-gray-400">無符合篩選條件的記錄</td></tr>';
    return rows.map(function (r) {
      return '<tr class="hover:bg-gray-50">' +
        '<td class="px-4 py-3"><div class="flex items-center gap-3">' +
        '<div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center"><i data-lucide="user" class="w-5 h-5 text-blue-600"></i></div>' +
        '<div><div class="text-sm font-medium text-gray-900">' + r.name + '</div>' +
        '<div class="text-sm text-gray-500">' + r.bed + ' · ' + r.site + '</div></div></div></td>' +
        '<td class="px-4 py-3"><div class="flex items-center gap-1.5 text-sm text-gray-700"><i data-lucide="calendar" class="w-4 h-4 text-gray-400"></i>' + woundFmt(r.assessDate) + '</div></td>' +
        '<td class="px-4 py-3"><div class="flex items-center gap-1.5 text-sm ' + woundNextClass(r.nextDate) + '"><i data-lucide="calendar" class="w-4 h-4 text-gray-400"></i>' + woundFmt(r.nextDate) + '</div></td>' +
        '<td class="px-4 py-3"><span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">' + r.wounds + ' 個</span></td>' +
        '<td class="px-4 py-3"><span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">' + r.photos + ' 張</span></td>' +
        '<td class="px-4 py-3"><span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ' + WOUND_STATUS_COLORS[r.woundStatus] + '">' + r.woundStatus + '</span></td>' +
        '<td class="px-4 py-3"><span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ' + (r.recordStatus === '生效中' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600') + '">' + r.recordStatus + '</span></td>' +
        '<td class="px-4 py-3"><span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ' + WOUND_STAGE_COLORS[r.stage] + '">' + r.stage + '</span></td>' +
        '<td class="px-4 py-3"><div class="flex items-center gap-1">' +
        '<button type="button" class="p-1.5 rounded hover:bg-gray-100 text-green-600" data-act="copy" data-id="' + r.id + '" title="另存新檔"><i data-lucide="copy" class="w-4 h-4"></i></button>' +
        '<button type="button" class="p-1.5 rounded hover:bg-gray-100 text-blue-600" data-act="edit" data-id="' + r.id + '" title="編輯"><i data-lucide="edit-3" class="w-4 h-4"></i></button>' +
        '<button type="button" class="p-1.5 rounded hover:bg-gray-100 text-red-600" data-act="del" data-id="' + r.id + '" title="刪除"><i data-lucide="trash-2" class="w-4 h-4"></i></button>' +
        '</div></td></tr>';
    }).join('');
  }

  function updateWoundRows() {
    var root = $('#demo-wound');
    if (!root) return;
    var tbody = $('#wound-tbody', root);
    if (!tbody) return;
    tbody.innerHTML = woundRowsHtml();
    var n = woundFiltered().length;
    $('#wound-count', root).textContent = '顯示 ' + (n ? '1-' + n : '0') + ' / ' + woundRows.length + ' 筆傷口評估';
    refreshIcons(root);
  }

  function renderWound() {
    var root = $('#demo-wound');
    if (!root) return;
    var html =
      '<div class="flex flex-wrap items-center gap-3 mb-3">' +
      btnPrimary('<i data-lucide="plus" class="w-4 h-4"></i> 新增傷口評估', 'data-act="add"') +
      '<div class="flex items-center gap-2 flex-1 justify-end min-w-[280px]">' +
      '<div class="relative flex-1 max-w-md">' +
      '<i data-lucide="search" class="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"></i>' +
      '<input class="form-input pl-10" id="wound-search" placeholder="搜索院友姓名、床號、評估者、階段或備註..." value="' + woundSearch.replace(/"/g, '&quot;') + '" /></div>' +
      '<button type="button" class="btn-secondary inline-flex items-center gap-1.5" data-act="toggle-filter"><i data-lucide="filter" class="w-4 h-4"></i> 進階篩選</button></div></div>' +
      '<div id="wound-filter" class="border border-gray-200 rounded-lg p-4 bg-gray-50 mb-3 grid grid-cols-1 sm:grid-cols-2 gap-3"' + (woundShowFilter ? '' : ' style="display:none"') + '>' +
      '<div><label class="block text-sm font-medium text-gray-700 mb-1">階段</label>' +
      '<select class="form-input w-full" id="wound-f-stage">' +
      ['', '階段1', '階段2', '階段3', '階段4', '無法評估'].map(function (s) {
        return '<option value="' + s + '"' + (woundStage === s ? ' selected' : '') + '>' + (s || '所有階段') + '</option>';
      }).join('') + '</select></div>' +
      '<div><label class="block text-sm font-medium text-gray-700 mb-1">感染狀態</label>' +
      '<select class="form-input w-full" id="wound-f-infection">' +
      ['', '無感染', '懷疑感染', '有感染'].map(function (s) {
        return '<option value="' + s + '"' + (woundInfection === s ? ' selected' : '') + '>' + (s || '所有狀態') + '</option>';
      }).join('') + '</select></div></div>' +
      '<p class="text-sm text-gray-600 mb-2" id="wound-count"></p>' +
      '<div class="overflow-x-auto border border-gray-200 rounded-lg bg-white">' +
      '<table class="min-w-full divide-y divide-gray-200">' +
      '<thead class="bg-gray-50"><tr>' +
      ['院友', '評估日期', '下次評估日期', '傷口數量', '照片數量', '傷口狀態', '記錄狀態', '階段', '操作'].map(function (h) {
        return '<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">' + h + '</th>';
      }).join('') + '</tr></thead>' +
      '<tbody class="bg-white divide-y divide-gray-200" id="wound-tbody"></tbody></table></div>';
    root.innerHTML = html;
    updateWoundRows();
    refreshIcons(root);
  }

  function openWoundAdd() {
    var selPart = null;
    var m = openModal(
      '<div class="space-y-4">' +
      '<div><label class="block text-sm font-medium text-gray-700 mb-2">傷口位置（人形圖選擇）</label>' +
      '<div class="grid grid-cols-4 gap-2">' +
      WOUND_PARTS.map(function (p) {
        return '<button type="button" class="px-2 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:border-blue-400 transition-colors" data-part="' + p + '">' + p + '</button>';
      }).join('') + '</div></div>' +
      '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
      '<div><label class="block text-sm font-medium text-gray-700 mb-1">階段</label>' +
      '<select class="form-input w-full" id="wound-a-stage">' +
      ['階段1', '階段2', '階段3', '階段4', '無法評估'].map(function (s) { return '<option>' + s + '</option>'; }).join('') + '</select></div>' +
      '<div><label class="block text-sm font-medium text-gray-700 mb-1">評估日期</label>' +
      '<input type="date" class="form-input w-full" id="wound-a-date" value="' + todayStr() + '" /></div></div>' +
      '<div><label class="block text-sm font-medium text-gray-700 mb-1">評估者</label>' +
      '<input class="form-input w-full" id="wound-a-assessor" value="陳護士" /></div>' +
      '<div class="flex justify-end gap-2 pt-2">' + btnSecondary('取消', 'data-act="cancel"') + btnPrimary('<i data-lucide="save" class="w-4 h-4"></i> 儲存', 'data-act="save"') + '</div></div>',
      { title: '新增傷口評估', width: 'lg' }
    );
    m.body.addEventListener('click', function (ev) {
      var chip = ev.target.closest('[data-part]');
      if (chip) {
        selPart = chip.dataset.part;
        $$('[data-part]', m.body).forEach(function (c) {
          var on = c.dataset.part === selPart;
          c.className = 'px-2 py-2 text-sm border rounded-lg transition-colors ' +
            (on ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-gray-300 text-gray-700 hover:border-blue-400');
        });
        return;
      }
      var act = ev.target.closest('[data-act]');
      if (!act) return;
      if (act.dataset.act === 'cancel') { m.close(); return; }
      if (!selPart) { toast('請選擇身體部位', 'danger'); return; }
      var date = $('#wound-a-date', m.body).value || todayStr();
      woundRows.push({
        id: woundNextId++, name: '陳大文', bed: '101-A', site: selPart,
        assessor: $('#wound-a-assessor', m.body).value.trim() || '陳護士',
        assessDate: date, nextDate: woundAddDays(date, 7), wounds: 1, photos: 0,
        woundStatus: '未處理', recordStatus: '生效中', stage: $('#wound-a-stage', m.body).value, infection: '無感染', note: ''
      });
      m.close(); updateWoundRows(); toast('已新增傷口評估');
    });
  }

  function openWoundDelete(row) {
    var m = openModal(
      '<div class="space-y-4"><p class="text-sm text-gray-600">確定要刪除 <strong>' + row.name + '</strong>（' + row.site + '，' + row.stage + '）的傷口評估記錄？此操作無法復原。</p>' +
      '<div class="flex justify-end gap-2 pt-2">' + btnSecondary('取消', 'data-act="cancel"') + btnDanger('確認刪除', 'data-act="ok"') + '</div></div>',
      { title: '刪除傷口評估', width: 'sm' }
    );
    m.body.addEventListener('click', function (ev) {
      var act = ev.target.closest('[data-act]');
      if (!act) return;
      if (act.dataset.act === 'cancel') { m.close(); return; }
      woundRows = woundRows.filter(function (r) { return r.id !== row.id; });
      m.close(); updateWoundRows(); toast('已刪除傷口評估', 'danger');
    });
  }

  function initWound() {
    var root = $('#demo-wound');
    if (!root) return;
    renderWound();
    root.addEventListener('click', function (e) {
      var act = e.target.closest('[data-act]');
      if (!act) return;
      var a = act.dataset.act;
      if (a === 'add') { openWoundAdd(); return; }
      if (a === 'toggle-filter') {
        woundShowFilter = !woundShowFilter;
        var panel = $('#wound-filter', root);
        if (panel) panel.style.display = woundShowFilter ? '' : 'none';
        return;
      }
      if (a === 'copy') { toast('已另存新檔（示範）'); return; }
      if (a === 'edit') { toast('編輯評估（示範）'); return; }
      if (a === 'del') {
        var row = woundRows.filter(function (r) { return r.id === +act.dataset.id; })[0];
        if (row) openWoundDelete(row);
      }
    });
    root.addEventListener('input', function (e) {
      if (e.target.id === 'wound-search') { woundSearch = e.target.value; updateWoundRows(); }
    });
    root.addEventListener('change', function (e) {
      if (e.target.id === 'wound-f-stage') { woundStage = e.target.value; updateWoundRows(); }
      if (e.target.id === 'wound-f-infection') { woundInfection = e.target.value; updateWoundRows(); }
    });
  }

  /* ============================================================
     10. 列印範本
     對照 PrintForms / PatientPrintModal
     ============================================================ */

  var printTemplates = [
    { id: 'diaper', name: '尿片更換記錄表', icon: 'file-text' },
    { id: 'hygiene', name: '個人衛生記錄表', icon: 'droplets' },
    { id: 'restraint', name: '約束物品觀察表', icon: 'alert-circle' },
    { id: 'admission', name: '入院床位分佈表', icon: 'bed' }
  ];
  var selectedTemplate = printTemplates[0].id;
  var selectedPrintPatient = '陳大文';

  function renderPrint() {
    var root = $('#demo-print');
    if (!root) return;
    var p = res(selectedPrintPatient);
    var html =
      '<div class="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-5">' +
      '<div class="space-y-4"><div><label class="block text-sm font-medium text-gray-700 mb-2">選擇範本</label><div class="space-y-1">' + printTemplates.map(function (t) {
        return '<button type="button" class="w-full text-left px-3 py-2 rounded-lg text-sm ' + (selectedTemplate === t.id ? 'bg-blue-50 text-blue-700 border border-blue-200 font-medium' : 'text-gray-700 hover:bg-gray-50 border border-transparent') + '" data-template="' + t.id + '">' +
          '<i data-lucide="' + t.icon + '" class="w-4 h-4 inline mr-2"></i>' + t.name + '</button>';
      }).join('') + '</div></div>' +
      '<div><label class="form-label block text-sm font-medium text-gray-700 mb-2">選擇院友</label><select id="print-patient" class="form-input w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">' +
      RESIDENTS.map(function (r) { return '<option value="' + r.name + '"' + (r.name === selectedPrintPatient ? ' selected' : '') + '>' + r.name + ' (' + r.bed + ')</option>'; }).join('') + '</select></div>' +
      '<div class="flex gap-2">' + btnSecondary('<i data-lucide="printer" class="w-4 h-4"></i> 列印', 'data-act="print"') + btnPrimary('<i data-lucide="download" class="w-4 h-4"></i> 下載 PDF', 'data-act="dl"') + '</div></div>' +
      '<div class="card bg-white border border-gray-200 rounded-lg shadow-sm p-6 min-h-[320px]">' +
      '<h4 class="text-center text-base font-bold text-gray-900 mb-1">' + printTemplates.filter(function (t) { return t.id === selectedTemplate; })[0].name + '</h4>' +
      '<div class="text-center text-xs text-gray-500 mb-6">示範院舍</div>' +
      '<div class="grid grid-cols-2 gap-4 text-sm mb-6"><div><span class="text-gray-500">姓名：</span><span class="font-medium">' + p.name + '</span></div>' +
      '<div><span class="text-gray-500">床號：</span><span class="font-medium">' + p.bed + '</span></div>' +
      '<div><span class="text-gray-500">身份證號：</span><span class="font-medium">' + p.idc + '</span></div>' +
      '<div><span class="text-gray-500">日期：</span><span class="font-medium">' + todayStr() + '</span></div></div>' +
      '<div class="border-t border-gray-200 pt-4 text-sm text-gray-600"><p>此為預覽範本，實際列印會按院舍格式輸出。</p></div></div></div>';
    root.innerHTML = html;
    refreshIcons(root);
    root.addEventListener('click', function (e) {
      var tpl = e.target.closest('[data-template]');
      if (tpl) { selectedTemplate = tpl.dataset.template; renderPrint(); return; }
      if (e.target.closest('[data-act="print"]')) { window.print(); return; }
      if (e.target.closest('[data-act="dl"]')) { toast('已產生 PDF（示範）'); return; }
    });
    $('#print-patient', root).addEventListener('change', function (e) { selectedPrintPatient = e.target.value; renderPrint(); });
  }

  function initPrint() { renderPrint(); }

  /* ============================================================
     11. 數據報表
     對照 Reports.tsx
     ============================================================ */

  var reportTab = 'daily';
  var REPORT_TABS = [
    { id: 'daily', label: '每日報表', icon: 'calendar' },
    { id: 'monthly', label: '每月報表', icon: 'bar-chart-3' },
    { id: 'meal', label: '餐膳統計', icon: 'utensils' },
    { id: 'diaper', label: '尿片統計', icon: 'droplets' },
    { id: 'infection', label: '感染控制', icon: 'stethoscope' }
  ];

  function renderReports() {
    var root = $('#demo-reports');
    if (!root) return;
    var stats = [
      { title: '總院友', value: 8, color: 'bg-blue-100 text-blue-800' },
      { title: '待量體溫', value: 2, color: 'bg-amber-100 text-amber-800' },
      { title: '逾期監測', value: 2, color: 'bg-red-100 text-red-800' },
      { title: '待派藥', value: 5, color: 'bg-green-100 text-green-800' }
    ];
    var html =
      '<div class="flex flex-wrap items-center gap-1 border-b border-gray-200 mb-4">' + REPORT_TABS.map(function (t) {
        return '<button type="button" class="flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ' +
          (reportTab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700') + '" data-rtab="' + t.id + '">' +
          '<i data-lucide="' + t.icon + '" class="w-4 h-4"></i>' + t.label + '</button>';
      }).join('') + '</div>' +
      '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">' + stats.map(function (s) {
        return '<div class="stats-card p-4 rounded-lg cursor-pointer ' + s.color.split(' ')[0] + '"><p class="stat-title text-sm text-gray-600">' + s.title + '</p><p class="stat-value text-2xl font-bold ' + s.color.split(' ')[1] + '">' + s.value + '</p></div>';
      }).join('') + '</div>' +
      '<div class="card bg-white border border-gray-200 rounded-lg p-4"><h4 class="text-sm font-semibold text-gray-900 mb-3">按居住區分佈</h4>' +
      '<div class="space-y-3"><div class="flex items-center gap-3 text-sm"><div class="w-24 text-gray-600">A 站</div>' +
      '<div class="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden border border-gray-200"><div class="h-full bg-blue-600 rounded-full" style="width:62%"></div></div><div class="w-8 text-right font-medium">5</div></div>' +
      '<div class="flex items-center gap-3 text-sm"><div class="w-24 text-gray-600">B 站</div>' +
      '<div class="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden border border-gray-200"><div class="h-full bg-emerald-500 rounded-full" style="width:38%"></div></div><div class="w-8 text-right font-medium">3</div></div></div></div>';
    root.innerHTML = html;
    refreshIcons(root);
    root.addEventListener('click', function (e) {
      var tab = e.target.closest('[data-rtab]');
      if (tab) { reportTab = tab.dataset.rtab; renderReports(); toast('已切換至 ' + REPORT_TABS.filter(function (t) { return t.id === reportTab; })[0].label); }
    });
  }

  function initReports() { renderReports(); }

  /* ============================================================
     12. 權限管理
     對照 Settings.tsx 權限部分
     ============================================================ */

  var permRole = 'nurse';
  var PERM_ROLES = { admin: '主管', nurse: '護士', carer: '護理員' };
  var PERMS = [
    { key: 'dashboard', label: '主控台', admin: true, nurse: true, carer: true },
    { key: 'emar', label: 'eMAR 給藥', admin: true, nurse: true, carer: false },
    { key: 'roster', label: '排班表', admin: true, nurse: false, carer: false },
    { key: 'beds', label: '床位管理', admin: true, nurse: true, carer: false },
    { key: 'reports', label: '數據報表', admin: true, nurse: true, carer: false },
    { key: 'settings', label: '系統設定', admin: true, nurse: false, carer: false },
    { key: 'mobile', label: '手機快速記錄', admin: true, nurse: true, carer: true }
  ];

  function renderPermissions() {
    var root = $('#demo-permissions');
    if (!root) return;
    var html =
      '<div class="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-5">' +
      '<div><div class="flex items-center gap-1 border-b border-gray-200 mb-4">' + Object.keys(PERM_ROLES).map(function (r) {
        return '<button type="button" class="px-4 py-2 text-sm font-medium border-b-2 transition-colors ' + (permRole === r ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700') + '" data-role="' + r + '">' + PERM_ROLES[r] + '</button>';
      }).join('') + '</div>' +
      '<div class="space-y-2">' + PERMS.map(function (p) {
        var checked = p[permRole] ? 'checked' : '';
        return '<label class="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 cursor-pointer">' +
          '<span class="text-sm font-medium text-gray-900">' + p.label + '</span>' +
          '<input type="checkbox" class="w-4 h-4 text-blue-600 rounded border-gray-300" data-perm="' + p.key + '" ' + checked + '/></label>';
      }).join('') + '</div></div>' +
      '<div><label class="block text-xs font-medium text-gray-500 mb-2">選單預覽</label>' +
      '<div class="card border border-gray-200 rounded-lg bg-white p-3 space-y-1">' +
      '<div class="text-xs text-gray-500 px-2 py-1">eHMS</div>' +
      PERMS.filter(function (p) { return p[permRole]; }).map(function (p) {
        return '<div class="px-2 py-1.5 rounded-md text-sm text-gray-700 hover:bg-gray-50">' + p.label + '</div>';
      }).join('') + '</div></div></div>';
    root.innerHTML = html;
    root.addEventListener('click', function (e) {
      var role = e.target.closest('[data-role]');
      if (role) { permRole = role.dataset.role; renderPermissions(); return; }
      var chk = e.target.closest('input[data-perm]');
      if (chk) {
        var key = chk.dataset.perm;
        var p = PERMS.filter(function (x) { return x.key === key; })[0];
        p[permRole] = chk.checked;
        renderPermissions();
        toast('已更新 ' + PERM_ROLES[permRole] + ' 的 ' + p.label + ' 權限');
      }
    });
  }

  function initPermissions() { renderPermissions(); }

  /* ============================================================
     13. 護理員手機版
     對照 nurse/pages/ScanPage.tsx / PatientListPage.tsx / BottomTabBar.tsx
     ============================================================ */

  var mobileTab = 'scan';
  var quickRecords = [
    { name: '陳大文', bed: '101-A', time: '08:12', item: '巡房' },
    { name: '李笑好', bed: '101-B', time: '08:35', item: '換片' },
    { name: '黃伯強', bed: '102-A', time: '09:00', item: '量體溫' }
  ];

  function renderMobile() {
    var root = $('#demo-mobile');
    if (!root) return;
    var screen = '';
    if (mobileTab === 'scan') {
      screen =
        '<div class="flex-1 flex flex-col items-center justify-center p-6 gap-4">' +
        '<div class="w-full rounded-xl overflow-hidden bg-black max-w-[200px]" style="aspect-ratio:9/16">' +
        '<div class="w-full h-full bg-gray-900 flex items-center justify-center relative"><div class="absolute inset-0 border-2 border-blue-500/50 m-4 rounded-lg"></div>' +
        '<div class="absolute left-4 right-4 h-0.5 bg-blue-500 shadow-[0_0_12px_#3b82f6] animate-[scan_1.4s_linear_infinite]"></div>' +
        '<i data-lucide="scan-line" class="w-10 h-10 text-white/70"></i></div></div>' +
        '<button type="button" class="btn-primary rounded-full px-5 py-2.5 text-sm" data-act="scanqr">掃描床頭 QR</button>' +
        '<p class="text-xs text-gray-500 text-center">對準床頭 QR Code 即可開啟院友記錄</p></div>';
    } else if (mobileTab === 'patients') {
      screen = '<div class="flex-1 p-3 overflow-y-auto"><div class="space-y-2">' + RESIDENTS.slice(0, 5).map(function (r) {
        return '<button type="button" class="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg bg-white text-left">' +
          '<div class="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center"><i data-lucide="user" class="w-4 h-4 text-blue-600"></i></div>' +
          '<div class="flex-1 min-w-0"><div class="font-medium text-sm text-gray-900">' + r.name + '</div><div class="text-xs text-gray-500">' + r.bed + ' · ' + r.care + '</div></div>' +
          '<i data-lucide="chevron-right" class="w-4 h-4 text-gray-400"></i></button>';
      }).join('') + '</div></div>';
    } else {
      screen = '<div class="flex-1 p-3 overflow-y-auto"><h4 class="text-sm font-semibold text-gray-900 mb-2">快速記錄</h4><div class="space-y-2">' + quickRecords.map(function (r) {
        return '<div class="p-3 border border-gray-200 rounded-lg bg-white text-sm"><div class="flex items-center justify-between"><span class="font-medium text-gray-900">' + r.name + '</span><span class="text-xs text-gray-500">' + r.time + '</span></div><div class="text-xs text-gray-500">' + r.bed + ' · ' + r.item + '</div></div>';
      }).join('') + '</div></div>';
    }
    var html =
      '<div class="w-[320px] max-w-full border-[10px] border-gray-800 rounded-[36px] bg-white overflow-hidden shadow-xl flex flex-col h-[520px]">' +
      '<div class="flex items-center justify-between px-4 py-1.5 border-b border-gray-200 text-[10px] text-gray-500"><span>09:41</span><span class="flex items-center gap-1"><i data-lucide="signal" class="w-3 h-3"></i><i data-lucide="battery" class="w-3 h-3"></i></span></div>' +
      '<div class="flex-1 flex flex-col overflow-hidden">' + screen + '</div>' +
      '<div class="flex border-t border-gray-200 bg-white">' +
      [['scan', '掃描', 'scan-line'], ['patients', '院友', 'users'], ['records', '記錄', 'clipboard-list'], ['more', '更多', 'menu']].map(function (t) {
        return '<button type="button" class="flex-1 flex flex-col items-center py-2 text-[10px] ' + (mobileTab === t[0] ? 'text-blue-600 font-semibold' : 'text-gray-500') + '" data-ptab="' + t[0] + '"><i data-lucide="' + t[2] + '" class="w-5 h-5 mb-0.5"></i>' + t[1] + '</button>';
      }).join('') + '</div></div>';
    root.innerHTML = html;
    refreshIcons(root);
    root.addEventListener('click', function (e) {
      var tab = e.target.closest('[data-ptab]');
      if (tab) { mobileTab = tab.dataset.ptab; renderMobile(); return; }
      if (e.target.closest('[data-act="scanqr"]')) {
        mobileTab = 'records';
        quickRecords.unshift({ name: '陳大文', bed: '101-A', time: now(), item: '床頭 QR 掃描成功' });
        renderMobile();
        toast('已掃描 101-A 床頭 QR');
      }
    });
  }

  function initMobile() { renderMobile(); }

  /* ============================================================
     14. 覆診管理（覆診紙 OCR + 家屬 WhatsApp 通知）
     對照 FollowUpManagement.tsx / FollowUpModal.tsx
     ============================================================ */

  var followUps = [
    { name: '陳大文', bed: '101-A', date: dateStr(2), time: '09:30', location: '瑪麗醫院', specialty: '內科', transport: '復康巴士', escort: '陪診員', status: '已安排' },
    { name: '李笑好', bed: '101-B', date: dateStr(4), time: '14:00', location: '東區尤德夫人那打素醫院', specialty: '眼科', transport: '輪椅的士', escort: '家屬', status: '已安排' },
    { name: '黃伯強', bed: '102-A', date: dateStr(7), time: '10:15', location: '瑪嘉烈醫院', specialty: '心臟科', transport: '', escort: '', status: '待確認' },
    { name: '周桂蘭', bed: '102-B', date: dateStr(9), time: '11:00', location: '基督教聯合醫院', specialty: '骨科', transport: '復康巴士', escort: '陪診員', status: '已安排' }
  ];

  function followUpMessage(f) {
    return '您好！這是善頤福群護老院C站的信息：' + f.name + '將於' + dateLabel(f.date) + '的' + f.time +
      '，於' + f.location + '有' + f.specialty + '的醫療安排。請問需要輪椅的士代步/陪診員嗎？請盡快告知您的安排，謝謝！';
  }

  function copyText(text, cb) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(cb, function () { legacyCopy(text); cb(); });
    } else {
      legacyCopy(text); cb();
    }
  }
  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* 示範環境忽略 */ }
    ta.remove();
  }

  function renderTreatment() {
    var root = $('#demo-treatment');
    if (!root) return;
    var html =
      '<div class="flex items-center justify-between mb-4 gap-2 flex-wrap">' +
      '<div class="flex items-center gap-2 text-sm text-gray-500"><i data-lucide="calendar-clock" class="w-4 h-4"></i><span>覆診安排（' + followUps.length + ' 筆）</span></div>' +
      btnPrimary('<i data-lucide="scan-line" class="w-4 h-4"></i> 掃描覆診紙 OCR', 'data-act="ocr"') + '</div>' +
      '<div class="overflow-x-auto"><table class="min-w-full text-sm border border-gray-200 rounded-lg overflow-hidden">' +
      '<thead class="bg-gray-50"><tr>' +
      '<th class="px-3 py-2 text-left font-medium text-gray-700">院友</th>' +
      '<th class="px-3 py-2 text-left font-medium text-gray-700">覆診日期 / 時間</th>' +
      '<th class="px-3 py-2 text-left font-medium text-gray-700">地點</th>' +
      '<th class="px-3 py-2 text-left font-medium text-gray-700">專科</th>' +
      '<th class="px-3 py-2 text-left font-medium text-gray-700">交通</th>' +
      '<th class="px-3 py-2 text-left font-medium text-gray-700">陪診</th>' +
      '<th class="px-3 py-2 text-left font-medium text-gray-700">狀態</th>' +
      '<th class="px-3 py-2 text-right font-medium text-gray-700">操作</th>' +
      '</tr></thead><tbody class="divide-y divide-gray-200 bg-white">';
    followUps.forEach(function (f, i) {
      html += '<tr>' +
        '<td class="px-3 py-2"><div class="flex items-center gap-2">' +
        '<div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-semibold text-blue-700 flex-shrink-0">' + f.name.charAt(0) + '</div>' +
        '<div><div class="font-medium text-gray-900">' + f.name + '</div><div class="text-xs text-gray-500">' + f.bed + '</div></div></div></td>' +
        '<td class="px-3 py-2 whitespace-nowrap"><div class="text-gray-900">' + dateLabel(f.date) + '</div><div class="text-xs text-gray-500">' + f.time + '</div></td>' +
        '<td class="px-3 py-2 text-gray-700">' + f.location + '</td>' +
        '<td class="px-3 py-2 text-gray-700">' + f.specialty + '</td>' +
        '<td class="px-3 py-2 text-gray-700">' + (f.transport || '—') + '</td>' +
        '<td class="px-3 py-2 text-gray-700">' + (f.escort || '—') + '</td>' +
        '<td class="px-3 py-2">' + badge(f.status, f.status === '已安排' ? 'green' : 'yellow') + '</td>' +
        '<td class="px-3 py-2 text-right whitespace-nowrap">' + btnSecondary('<i data-lucide="message-circle" class="w-4 h-4"></i> 通知家屬', 'data-notify="' + i + '"') + '</td></tr>';
    });
    html += '</tbody></table></div>';
    root.innerHTML = html;
    refreshIcons(root);
    root.onclick = function (e) {
      var notify = e.target.closest('[data-notify]');
      if (notify) {
        var f = followUps[+notify.dataset.notify];
        var msg = followUpMessage(f);
        var m = openModal(
          '<div class="space-y-4">' +
          '<div class="flex items-center gap-2 text-sm text-gray-500"><i data-lucide="message-circle" class="w-4 h-4 text-green-600"></i><span>WhatsApp 覆診通知（自動生成）</span></div>' +
          '<div class="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-gray-800 leading-relaxed">' + msg + '</div>' +
          '<div class="flex justify-end gap-2">' + btnSecondary('關閉', 'data-act="close"') +
          btnPrimary('<i data-lucide="copy" class="w-4 h-4"></i> 複製訊息', 'data-act="copy"') + '</div></div>',
          { title: '通知家屬 — ' + f.name, width: 'md' }
        );
        m.body.addEventListener('click', function (ev) {
          var act = ev.target.closest('[data-act]');
          if (!act) return;
          if (act.dataset.act === 'close') { m.close(); return; }
          if (act.dataset.act === 'copy') {
            copyText(msg, function () { m.close(); toast('已複製覆診通知'); });
          }
        });
        return;
      }
      if (e.target.closest('[data-act="ocr"]')) {
        fakeScan('掃描覆診紙', function () {
          followUps.unshift({ name: '吳美玲', bed: '103-A', date: dateStr(12), time: '15:30', location: '威爾斯親王醫院', specialty: '腎科', transport: '', escort: '', status: '待確認' });
          renderTreatment();
          toast('OCR 已錄入覆診');
        });
      }
    };
  }

  function initTreatment() { renderTreatment(); }

  /* ============================================================
     15. 感染控制 + 餐膳統計（廚房用）
     對照 InfectionControlModal.tsx / MealGuidanceModal.tsx
     ============================================================ */

  var INFECTIONS = [
    { type: '甲型流感', icon: 'thermometer', card: 'bg-red-50 border-red-200', text: 'text-red-700', chip: 'bg-red-100 text-red-700',
      cases: [{ name: '陳大文', bed: '101-A', start: dateStr(-3) }, { name: '黃伯強', bed: '102-A', start: dateStr(-1) }] },
    { type: '諾如病毒', icon: 'alert-triangle', card: 'bg-orange-50 border-orange-200', text: 'text-orange-700', chip: 'bg-orange-100 text-orange-700',
      cases: [{ name: '李笑好', bed: '101-B', start: dateStr(-2) }] },
    { type: '疥瘡', icon: 'bug', card: 'bg-purple-50 border-purple-200', text: 'text-purple-700', chip: 'bg-purple-100 text-purple-700',
      cases: [{ name: '周桂蘭', bed: '102-B', start: dateStr(-6) }, { name: '張金好', bed: '203-A', start: dateStr(-4) }] }
  ];
  var selectedInfection = 0;

  var MEAL_STATS = [
    { label: '糖尿餐', value: '3 人', note: '低糖飯餐', icon: 'salad', color: 'bg-green-100 text-green-800' },
    { label: '凝固粉', value: '2 人', note: '普遍配方 1 人 · 清透配方 1 人', icon: 'glass-water', color: 'bg-amber-100 text-amber-800' },
    { label: '雞蛋', value: '5 隻', note: '早餐供應', icon: 'egg', color: 'bg-yellow-100 text-yellow-800' },
    { label: '碎餐 / 糊餐', value: '4 人', note: '碎餐 3 人 · 糊餐 1 人', icon: 'utensils', color: 'bg-blue-100 text-blue-800' }
  ];

  function renderOperations() {
    var root = $('#demo-operations');
    if (!root) return;
    var inf = INFECTIONS[selectedInfection];
    var html =
      '<h4 class="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2"><i data-lucide="shield-alert" class="w-4 h-4 text-red-600"></i>感染控制</h4>' +
      '<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">' + INFECTIONS.map(function (t, i) {
        return '<button type="button" class="text-left border rounded-lg p-4 transition-shadow hover:shadow-md ' + t.card + (i === selectedInfection ? ' ring-2 ring-offset-1 ring-blue-500' : '') + '" data-inf="' + i + '">' +
          '<div class="flex items-center justify-between"><span class="text-sm font-semibold ' + t.text + '">' + t.type + '</span>' +
          '<i data-lucide="' + t.icon + '" class="w-4 h-4 ' + t.text + '"></i></div>' +
          '<p class="text-2xl font-bold mt-1 ' + t.text + '">' + t.cases.length + ' <span class="text-sm font-normal">位活躍院友</span></p></button>';
      }).join('') + '</div>' +
      '<div class="card bg-white border border-gray-200 rounded-lg p-4 mb-6">' +
      '<h5 class="text-sm font-semibold text-gray-900 mb-2">' + inf.type + ' · 活躍院友名單</h5>' +
      '<div class="divide-y divide-gray-100">' + inf.cases.map(function (c) {
        return '<div class="flex items-center gap-3 py-2">' +
          '<div class="w-8 h-8 ' + inf.chip + ' rounded-full flex items-center justify-center text-sm font-semibold">' + c.name.charAt(0) + '</div>' +
          '<div class="flex-1"><span class="font-medium text-gray-900 text-sm">' + c.name + '</span> <span class="text-xs text-gray-500">' + c.bed + '</span></div>' +
          '<span class="text-xs text-gray-500">開始日期 ' + dateLabel(c.start) + '</span></div>';
      }).join('') + '</div></div>' +
      '<h4 class="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2"><i data-lucide="chef-hat" class="w-4 h-4 text-amber-600"></i>餐膳統計（廚房用）— ' + dateLabel(todayStr()) + '</h4>' +
      '<div class="grid grid-cols-2 lg:grid-cols-4 gap-3">' + MEAL_STATS.map(function (s) {
        return '<div class="stats-card p-4 rounded-lg ' + s.color.split(' ')[0] + '">' +
          '<div class="flex items-center gap-1.5"><i data-lucide="' + s.icon + '" class="w-4 h-4 ' + s.color.split(' ')[1] + '"></i><p class="stat-title text-sm text-gray-600">' + s.label + '</p></div>' +
          '<p class="stat-value text-2xl font-bold mt-1 ' + s.color.split(' ')[1] + '">' + s.value + '</p>' +
          '<p class="text-xs text-gray-500 mt-0.5">' + s.note + '</p></div>';
      }).join('') + '</div>';
    root.innerHTML = html;
    refreshIcons(root);
    root.onclick = function (e) {
      var btn = e.target.closest('[data-inf]');
      if (btn) { selectedInfection = +btn.dataset.inf; renderOperations(); }
    };
  }

  function initOperations() { renderOperations(); }

  /* ============================================================
     初始化
     ============================================================ */

  function init() {
    initDashboard();
    initEmar();
    initRoster();
    initLeave();
    initBeds();
    initVitals();
    initOcr();
    initAi();
    initWound();
    initPrint();
    initReports();
    initPermissions();
    initMobile();
    initTreatment();
    initOperations();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
