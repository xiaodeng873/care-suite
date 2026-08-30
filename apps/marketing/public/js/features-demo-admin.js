/* ============================================================
   features-demo-admin.js — 功能體驗頁互動示範（營運管理篇）
   覆蓋 operations / printing / ai-tools / analytics /
   permissions / platform 六個功能頁。
   100% 前端、無框架、無網絡請求。所有數據均為虛構。
   視覺對照 apps/web/src/ 真實頁面（HospitalEpisodeModal、
   TaskModal、MealGuidanceModal、IncidentReportModal、
   InfectionControlModal、PrintForms、Settings、QRScannerModal），
   使用 Tailwind CSS class 與 Lucide icons 重建 webapp 介面。
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 共用工具（與 features-demo.js 相同） ---------- */

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
    t.className = 'fd-toast fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-lg shadow-lg text-white text-sm font-semibold z-[1100] ' +
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
      purple: 'bg-purple-100 text-purple-800',
      orange: 'bg-orange-100 text-orange-800',
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

  function residentOptions(selected) {
    return RESIDENTS.map(function (r) {
      return '<option value="' + r.name + '"' + (r.name === selected ? ' selected' : '') + '>' + r.name + '（' + r.bed + '）</option>';
    }).join('');
  }

  var INPUT_CLS = 'form-input w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  var SELECT_CLS = 'form-input rounded-lg border border-gray-300 px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';

  /* ============================================================
     1. operations.html · 缺席管理（x-absence）
     對照 HospitalEpisodeModal.tsx：住院期間記錄醫院與病房，
     體溫記錄生成時缺席院友自動留白加備註。
     ============================================================ */

  var absenceState = [
    { name: '陳大文', bed: '101-A', status: '在住', hospital: '', ward: '' },
    { name: '李笑好', bed: '101-B', status: '住院中', hospital: '瑪麗醫院', ward: '內科 3B' },
    { name: '黃伯強', bed: '102-A', status: '在住', hospital: '', ward: '' },
    { name: '周桂蘭', bed: '102-B', status: '渡假中', hospital: '', ward: '' },
    { name: '吳美玲', bed: '103-A', status: '在住', hospital: '', ward: '' }
  ];
  var ABSENCE_COLORS = { '在住': 'green', '住院中': 'red', '渡假中': 'blue' };

  function renderAbsence(root) {
    var html =
      '<div class="overflow-x-auto card bg-white rounded-lg border border-gray-200">' +
      '<table class="w-full text-sm">' +
      '<thead class="bg-gray-50"><tr>' +
      '<th class="px-3 py-2 text-left font-medium text-gray-700">姓名</th>' +
      '<th class="px-3 py-2 text-left font-medium text-gray-700">床號</th>' +
      '<th class="px-3 py-2 text-left font-medium text-gray-700">狀態</th>' +
      '</tr></thead><tbody class="divide-y divide-gray-200 bg-white">';
    absenceState.forEach(function (a, i) {
      html += '<tr>' +
        '<td class="px-3 py-2 font-medium text-gray-900">' + a.name + '</td>' +
        '<td class="px-3 py-2 text-gray-600">' + a.bed + '</td>' +
        '<td class="px-3 py-2">' +
        '<div class="flex items-center gap-2 flex-wrap">' +
        '<select class="' + SELECT_CLS + '" data-abs-row="' + i + '">' +
        ['在住', '住院中', '渡假中'].map(function (s) {
          return '<option value="' + s + '"' + (a.status === s ? ' selected' : '') + '>' + s + '</option>';
        }).join('') + '</select>' + badge(a.status, ABSENCE_COLORS[a.status]) + '</div>' +
        (a.status === '住院中'
          ? '<div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">' +
            '<input class="form-input rounded-lg border border-gray-300 px-2 py-1.5 text-sm" placeholder="醫院（例如：瑪麗醫院）" data-abs-hosp="' + i + '" value="' + a.hospital + '"/>' +
            '<input class="form-input rounded-lg border border-gray-300 px-2 py-1.5 text-sm" placeholder="病房（例如：內科 3B）" data-abs-ward="' + i + '" value="' + a.ward + '"/></div>'
          : '') +
        '</td></tr>';
    });
    html += '</tbody></table></div>' +
      '<div class="flex items-start gap-2 mt-3 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">' +
      '<i data-lucide="info" class="w-4 h-4 mt-0.5 flex-shrink-0"></i>' +
      '<span>生成體溫記錄時，缺席院友（住院中 / 渡假中）將自動留白並加備註。</span></div>';
    root.innerHTML = html;
    refreshIcons(root);
  }

  function initAbsence() {
    var root = $('#x-absence');
    if (!root) return;
    renderAbsence(root);
    root.addEventListener('change', function (e) {
      var sel = e.target.closest('[data-abs-row]');
      if (!sel) return;
      absenceState[Number(sel.dataset.absRow)].status = sel.value;
      renderAbsence(root);
    });
    root.addEventListener('input', function (e) {
      var hosp = e.target.closest('[data-abs-hosp]');
      var ward = e.target.closest('[data-abs-ward]');
      if (hosp) absenceState[Number(hosp.dataset.absHosp)].hospital = hosp.value;
      if (ward) absenceState[Number(ward.dataset.absWard)].ward = ward.value;
    });
  }

  /* ============================================================
     2. operations.html · 自訂監測任務（x-tasks）
     對照 TaskModal.tsx：項目、頻率、星期、時間。
     ============================================================ */

  var WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
  var customTasks = [
    { item: '體重', freq: '每週', day: '二', time: '09:00', overdue: 2 },
    { item: '血糖', freq: '每週', day: '五', time: '08:00', overdue: 0 },
    { item: '血壓', freq: '每月', day: '一', time: '10:00', overdue: 0 }
  ];

  function taskDesc(t) {
    return t.item + ' · ' + (t.freq === '每週' ? '每週' + t.day : '每月') + ' ' + t.time;
  }

  function renderTaskList(root) {
    var box = $('#xt-list', root);
    var html = '';
    if (!customTasks.length) {
      html = '<p class="text-sm text-gray-500">尚未設定自訂任務。</p>';
    } else {
      html = '<ul class="divide-y divide-gray-200 bg-white card rounded-lg border border-gray-200">';
      customTasks.forEach(function (t) {
        html += '<li class="flex items-center justify-between gap-2 px-3 py-2">' +
          '<div class="flex items-center gap-2 text-sm text-gray-800">' +
          '<i data-lucide="clipboard-check" class="w-4 h-4 text-blue-600"></i>' +
          '<span>' + taskDesc(t) + '</span></div>' +
          (t.overdue > 0 ? badge('逾期 ' + t.overdue + ' 次', 'red') : badge('正常', 'green')) + '</li>';
      });
      html += '</ul>';
    }
    box.innerHTML = html;
    refreshIcons(box);
  }

  function initTasks() {
    var root = $('#x-tasks');
    if (!root) return;
    root.innerHTML =
      '<div class="card bg-white rounded-lg border border-gray-200 p-4 mb-4">' +
      '<div class="grid grid-cols-2 md:grid-cols-4 gap-3">' +
      '<div><label class="form-label block text-sm font-medium text-gray-700 mb-1">項目</label>' +
      '<select class="' + INPUT_CLS + '" id="xt-item">' +
      '<option>體重</option><option>血糖</option><option>血壓</option></select></div>' +
      '<div><label class="form-label block text-sm font-medium text-gray-700 mb-1">頻率</label>' +
      '<select class="' + INPUT_CLS + '" id="xt-freq"><option>每週</option><option>每月</option></select></div>' +
      '<div><label class="form-label block text-sm font-medium text-gray-700 mb-1">星期幾</label>' +
      '<select class="' + INPUT_CLS + '" id="xt-day">' +
      WEEKDAYS.map(function (d) { return '<option>' + d + '</option>'; }).join('') + '</select></div>' +
      '<div><label class="form-label block text-sm font-medium text-gray-700 mb-1">時間</label>' +
      '<input type="time" class="' + INPUT_CLS + '" id="xt-time" value="09:00"/></div></div>' +
      '<div class="mt-3 flex justify-end">' + btnPrimary('<i data-lucide="plus" class="w-4 h-4"></i> 新增任務', 'data-act="add"') + '</div></div>' +
      '<div id="xt-list"></div>';
    refreshIcons(root);
    renderTaskList(root);

    root.addEventListener('change', function (e) {
      if (e.target.id === 'xt-freq') $('#xt-day', root).disabled = e.target.value === '每月';
    });
    root.addEventListener('click', function (e) {
      if (!e.target.closest('[data-act="add"]')) return;
      customTasks.push({
        item: $('#xt-item', root).value,
        freq: $('#xt-freq', root).value,
        day: $('#xt-day', root).value,
        time: $('#xt-time', root).value || '09:00',
        overdue: 0
      });
      renderTaskList(root);
      toast('已新增自訂監測任務');
    });
  }

  /* ============================================================
     3. operations.html · 餐膳指引（x-meal）
     對照 MealGuidanceModal.tsx：餐類、凝固粉、雞蛋，
     底部廚房統計即時重算。
     ============================================================ */

  var MEAL_TYPES = ['正常', '糖尿餐', '碎餐', '糊餐'];
  var FORMULAS = ['普遍配方', '清透配方'];
  var mealState = [
    { name: '陳大文', bed: '101-A', meal: '糖尿餐', thick: '', formula: '普遍配方', eggs: 1 },
    { name: '李笑好', bed: '101-B', meal: '碎餐', thick: '', formula: '普遍配方', eggs: 1 },
    { name: '黃伯強', bed: '102-A', meal: '糊餐', thick: '2 匙', formula: '清透配方', eggs: 0 },
    { name: '周桂蘭', bed: '102-B', meal: '正常', thick: '', formula: '普遍配方', eggs: 1 },
    { name: '吳美玲', bed: '103-A', meal: '糖尿餐', thick: '1 匙', formula: '普遍配方', eggs: 0 },
    { name: '梁志偉', bed: '201-A', meal: '正常', thick: '', formula: '普遍配方', eggs: 2 }
  ];

  function renderMealStats(root) {
    var diabetic = 0, thickNormal = 0, thickClear = 0, eggs = 0, minced = 0;
    mealState.forEach(function (m) {
      if (m.meal === '糖尿餐') diabetic++;
      if (m.thick.trim()) {
        if (m.formula === '清透配方') thickClear++; else thickNormal++;
      }
      eggs += Number(m.eggs) || 0;
      if (m.meal === '碎餐' || m.meal === '糊餐') minced++;
    });
    $('#xm-stats', root).innerHTML =
      '<div class="flex items-center gap-2 text-sm font-medium text-gray-700"><i data-lucide="chef-hat" class="w-4 h-4 text-amber-600"></i>廚房統計</div>' +
      '<div class="flex flex-wrap gap-2">' +
      badge('糖尿餐 ' + diabetic + ' 人', 'blue') +
      badge('凝固粉·普遍配方 ' + thickNormal + ' 人', 'purple') +
      badge('凝固粉·清透配方 ' + thickClear + ' 人', 'orange') +
      badge('雞蛋 ' + eggs + ' 隻', 'yellow') +
      badge('碎餐/糊餐 ' + minced + ' 人', 'gray') + '</div>';
    refreshIcons(root);
  }

  function initMeal() {
    var root = $('#x-meal');
    if (!root) return;
    var html =
      '<div class="overflow-x-auto card bg-white rounded-lg border border-gray-200">' +
      '<table class="w-full text-sm">' +
      '<thead class="bg-gray-50"><tr>' +
      '<th class="px-3 py-2 text-left font-medium text-gray-700">院友</th>' +
      '<th class="px-3 py-2 text-left font-medium text-gray-700">餐類</th>' +
      '<th class="px-3 py-2 text-left font-medium text-gray-700">凝固粉配方</th>' +
      '<th class="px-3 py-2 text-left font-medium text-gray-700">凝固粉用量</th>' +
      '<th class="px-3 py-2 text-left font-medium text-gray-700">雞蛋數</th>' +
      '</tr></thead><tbody class="divide-y divide-gray-200 bg-white">';
    mealState.forEach(function (m, i) {
      html += '<tr>' +
        '<td class="px-3 py-2"><span class="font-medium text-gray-900">' + m.name + '</span> <span class="text-xs text-gray-500">' + m.bed + '</span></td>' +
        '<td class="px-3 py-2"><select class="' + SELECT_CLS + '" data-meal="' + i + '">' +
        MEAL_TYPES.map(function (t) { return '<option' + (m.meal === t ? ' selected' : '') + '>' + t + '</option>'; }).join('') +
        '</select></td>' +
        '<td class="px-3 py-2"><select class="' + SELECT_CLS + '" data-formula="' + i + '"' + (m.thick.trim() ? '' : ' disabled') + '>' +
        FORMULAS.map(function (f) { return '<option' + (m.formula === f ? ' selected' : '') + '>' + f + '</option>'; }).join('') +
        '</select></td>' +
        '<td class="px-3 py-2"><input class="form-input w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-sm" placeholder="例如 1 匙" data-thick="' + i + '" value="' + m.thick + '"/></td>' +
        '<td class="px-3 py-2"><input type="number" min="0" class="form-input w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-sm" data-eggs="' + i + '" value="' + m.eggs + '"/></td></tr>';
    });
    html += '</tbody></table></div>' +
      '<div id="xm-stats" class="flex items-center justify-between gap-3 flex-wrap mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200"></div>';
    root.innerHTML = html;
    renderMealStats(root);

    root.addEventListener('change', function (e) {
      var sel = e.target.closest('[data-meal]');
      if (sel) {
        mealState[Number(sel.dataset.meal)].meal = sel.value;
        renderMealStats(root);
        return;
      }
      var fsel = e.target.closest('[data-formula]');
      if (fsel) {
        mealState[Number(fsel.dataset.formula)].formula = fsel.value;
        renderMealStats(root);
      }
    });
    root.addEventListener('input', function (e) {
      var thick = e.target.closest('[data-thick]');
      var eggs = e.target.closest('[data-eggs]');
      if (thick) {
        var i = Number(thick.dataset.thick);
        mealState[i].thick = thick.value;
        var fsel = root.querySelector('[data-formula="' + i + '"]');
        if (fsel) fsel.disabled = !thick.value.trim();
        renderMealStats(root);
      }
      if (eggs) { mealState[Number(eggs.dataset.eggs)].eggs = eggs.value; renderMealStats(root); }
    });
  }

  /* ============================================================
     4. operations.html · 意外事件報告（x-incident）
     對照 IncidentReportModal.tsx 與「個人意外事件記錄表」。
     ============================================================ */

  var INCIDENT_TYPES = ['跌倒', '撞傷', '哽噎', '其他'];
  var INCIDENT_COLORS = { '跌倒': 'red', '撞傷': 'orange', '哽噎': 'purple', '其他': 'gray' };
  var incidentReports = [
    { time: todayStr() + ' 08:40', name: '黃伯強', type: '跌倒' },
    { time: dateStr(-2) + ' 15:20', name: '張金好', type: '撞傷' }
  ];

  function renderIncidentList(root) {
    var box = $('#xi-list', root);
    var html = '<ul class="divide-y divide-gray-200 bg-white card rounded-lg border border-gray-200">';
    incidentReports.forEach(function (r, i) {
      html += '<li class="flex items-center justify-between gap-2 px-3 py-2 flex-wrap">' +
        '<div class="flex items-center gap-3 text-sm flex-wrap">' +
        '<span class="text-gray-500">' + r.time + '</span>' +
        '<span class="font-medium text-gray-900">' + r.name + '</span>' +
        badge(r.type, INCIDENT_COLORS[r.type] || 'gray') + '</div>' +
        btnSecondary('<i data-lucide="printer" class="w-4 h-4"></i> 列印記錄表', 'data-print="' + i + '"') + '</li>';
    });
    html += '</ul>';
    box.innerHTML = html;
    refreshIcons(box);
  }

  function initIncident() {
    var root = $('#x-incident');
    if (!root) return;
    root.innerHTML =
      '<div class="card bg-white rounded-lg border border-gray-200 p-4 mb-4">' +
      '<div class="grid grid-cols-1 md:grid-cols-2 gap-3">' +
      '<div><label class="form-label block text-sm font-medium text-gray-700 mb-1">院友</label>' +
      '<select class="' + INPUT_CLS + '" id="xi-name">' + residentOptions('陳大文') + '</select></div>' +
      '<div><label class="form-label block text-sm font-medium text-gray-700 mb-1">日期時間</label>' +
      '<input type="datetime-local" class="' + INPUT_CLS + '" id="xi-dt" value="' + todayStr() + 'T' + now() + '"/></div>' +
      '<div><label class="form-label block text-sm font-medium text-gray-700 mb-1">地點</label>' +
      '<input class="' + INPUT_CLS + '" id="xi-place" value="一樓活動室"/></div>' +
      '<div><label class="form-label block text-sm font-medium text-gray-700 mb-1">類型</label>' +
      '<select class="' + INPUT_CLS + '" id="xi-type">' +
      INCIDENT_TYPES.map(function (t) { return '<option>' + t + '</option>'; }).join('') + '</select></div>' +
      '<div class="md:col-span-2"><label class="form-label block text-sm font-medium text-gray-700 mb-1">經過</label>' +
      '<textarea class="' + INPUT_CLS + '" id="xi-detail" rows="3" placeholder="請描述事件經過…">院友於活動室起身時失足跌倒，當時有職員在場協助。</textarea></div></div>' +
      '<div class="mt-3 flex justify-end">' + btnPrimary('<i data-lucide="save" class="w-4 h-4"></i> 儲存報告', 'data-act="save"') + '</div></div>' +
      '<div id="xi-list"></div>';
    refreshIcons(root);
    renderIncidentList(root);

    root.addEventListener('click', function (e) {
      var prn = e.target.closest('[data-print]');
      if (prn) { toast('已列印個人意外事件記錄表（示範）'); return; }
      if (!e.target.closest('[data-act="save"]')) return;
      var dt = ($('#xi-dt', root).value || (todayStr() + 'T' + now())).replace('T', ' ');
      incidentReports.unshift({
        time: dt,
        name: $('#xi-name', root).value,
        type: $('#xi-type', root).value
      });
      renderIncidentList(root);
      toast('已儲存意外事件報告');
    });
  }

  /* ============================================================
     5. operations.html · 感染控制（x-infection）
     對照 InfectionControlModal.tsx：按感染類型分組追蹤。
     ============================================================ */

  var infections = [
    { key: 'flu', name: '甲型流感', color: 'red', cardCls: 'bg-red-50 border-red-200 text-red-700', ringCls: 'ring-2 ring-red-400',
      cases: [{ name: '陳大文', bed: '101-A', since: dateStr(-3) }, { name: '梁志偉', bed: '201-A', since: dateStr(-1) }] },
    { key: 'noro', name: '諾如病毒', color: 'orange', cardCls: 'bg-orange-50 border-orange-200 text-orange-700', ringCls: 'ring-2 ring-orange-400',
      cases: [{ name: '周桂蘭', bed: '102-B', since: dateStr(-2) }] },
    { key: 'scabies', name: '疥瘡', color: 'purple', cardCls: 'bg-purple-50 border-purple-200 text-purple-700', ringCls: 'ring-2 ring-purple-400',
      cases: [{ name: '黃伯強', bed: '102-A', since: dateStr(-7) }, { name: '吳美玲', bed: '103-A', since: dateStr(-4) }] }
  ];
  var infectionSel = 'flu';

  function renderInfection(root) {
    var html = '<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">';
    infections.forEach(function (inf) {
      html += '<button type="button" class="card rounded-lg border p-4 text-left transition-shadow ' + inf.cardCls +
        (infectionSel === inf.key ? ' ' + inf.ringCls : '') + '" data-inf="' + inf.key + '">' +
        '<div class="flex items-center justify-between">' +
        '<span class="font-semibold">' + inf.name + '</span>' +
        '<i data-lucide="biohazard" class="w-5 h-5"></i></div>' +
        '<p class="text-sm mt-1">活躍 ' + inf.cases.length + ' 人</p></button>';
    });
    html += '</div>';
    var sel = infections.filter(function (i) { return i.key === infectionSel; })[0];
    html += '<div class="card bg-white rounded-lg border border-gray-200">' +
      '<div class="px-4 py-3 border-b border-gray-200 flex items-center gap-2">' +
      '<i data-lucide="users" class="w-4 h-4 text-gray-500"></i>' +
      '<h4 class="font-medium text-gray-900">' + sel.name + '個案名單</h4></div>' +
      '<table class="w-full text-sm"><thead class="bg-gray-50"><tr>' +
      '<th class="px-3 py-2 text-left font-medium text-gray-700">院友</th>' +
      '<th class="px-3 py-2 text-left font-medium text-gray-700">床號</th>' +
      '<th class="px-3 py-2 text-left font-medium text-gray-700">開始日期</th>' +
      '</tr></thead><tbody class="divide-y divide-gray-200 bg-white">';
    sel.cases.forEach(function (c) {
      html += '<tr><td class="px-3 py-2 font-medium text-gray-900">' + c.name + '</td>' +
        '<td class="px-3 py-2 text-gray-600">' + c.bed + '</td>' +
        '<td class="px-3 py-2 text-gray-600">' + c.since + '</td></tr>';
    });
    html += '</tbody></table></div>';
    root.innerHTML = html;
    refreshIcons(root);
  }

  function initInfection() {
    var root = $('#x-infection');
    if (!root) return;
    renderInfection(root);
    root.addEventListener('click', function (e) {
      var card = e.target.closest('[data-inf]');
      if (!card) return;
      infectionSel = card.dataset.inf;
      renderInfection(root);
    });
  }

  /* ============================================================
     6. printing.html · 自訂範本引擎（x-template）
     對照 PrintForms.tsx：上傳 Excel 範本後批量生成工作表。
     ============================================================ */

  var templateUploaded = false;
  var templateGenerated = false;

  function renderTemplate(root) {
    var html = '<div class="card bg-white rounded-lg border border-gray-200 p-4">';
    if (!templateUploaded) {
      html += '<div class="flex flex-col items-center justify-center py-8 gap-3 border-2 border-dashed border-gray-300 rounded-lg">' +
        '<i data-lucide="file-spreadsheet" class="w-10 h-10 text-gray-400"></i>' +
        '<p class="text-sm text-gray-500">上傳 Excel 範本，系統自動按院友拆分工作表</p>' +
        btnPrimary('<i data-lucide="upload" class="w-4 h-4"></i> 上傳 Excel 範本', 'data-act="upload"') + '</div>';
    } else {
      html += '<div class="flex items-center justify-between gap-3 flex-wrap">' +
        '<div class="flex items-center gap-2 text-sm text-gray-800">' +
        '<i data-lucide="file-check" class="w-5 h-5 text-green-600"></i>' +
        '<span>已上傳：<span class="font-medium">體溫記錄表.xlsx</span></span></div>' +
        btnSuccess('<i data-lucide="layers" class="w-4 h-4"></i> 批量生成', 'data-act="gen"') + '</div>';
      if (templateGenerated) {
        html += '<ul class="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">';
        RESIDENTS.forEach(function (r) {
          html += '<li class="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">' +
            '<i data-lucide="file-spreadsheet" class="w-4 h-4"></i>' + r.name + '.xlsx</li>';
        });
        html += '</ul>';
      }
    }
    html += '</div>';
    root.innerHTML = html;
    refreshIcons(root);
  }

  function initTemplate() {
    var root = $('#x-template');
    if (!root) return;
    renderTemplate(root);
    root.addEventListener('click', function (e) {
      if (e.target.closest('[data-act="upload"]')) {
        templateUploaded = true;
        renderTemplate(root);
        return;
      }
      if (e.target.closest('[data-act="gen"]')) {
        templateGenerated = true;
        renderTemplate(root);
        toast('已生成 8 個工作表（示範）');
      }
    });
  }

  /* ============================================================
     7. printing.html · 院舍自訂頁首（x-letterhead）
     對照 Settings.tsx 院舍資料與 PrintForms 頁首。
     ============================================================ */

  function initLetterhead() {
    var root = $('#x-letterhead');
    if (!root) return;
    root.innerHTML =
      '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">' +
      '<div class="card bg-white rounded-lg border border-gray-200 p-4 space-y-3">' +
      '<div><label class="form-label block text-sm font-medium text-gray-700 mb-1">院舍中文名</label>' +
      '<input class="' + INPUT_CLS + '" id="lh-zh" value="康寧護老院"/></div>' +
      '<div><label class="form-label block text-sm font-medium text-gray-700 mb-1">院舍英文名</label>' +
      '<input class="' + INPUT_CLS + '" id="lh-en" value="Hong Ning Care Home"/></div>' +
      '<div><label class="form-label block text-sm font-medium text-gray-700 mb-1">地址</label>' +
      '<input class="' + INPUT_CLS + '" id="lh-addr" value="新界沙田安心街12號"/></div>' +
      '<div><label class="form-label block text-sm font-medium text-gray-700 mb-1">電話</label>' +
      '<input class="' + INPUT_CLS + '" id="lh-tel" value="2345 6789"/></div></div>' +
      '<div class="card bg-white rounded-lg border border-gray-200 p-6 shadow-sm">' +
      '<p class="text-xs text-gray-400 mb-3">文件頁首預覽</p>' +
      '<div class="flex items-start gap-4 border-b-2 border-gray-800 pb-4">' +
      '<div class="w-14 h-14 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center flex-shrink-0">' +
      '<i data-lucide="image" class="w-6 h-6 text-gray-300"></i></div>' +
      '<div class="min-w-0">' +
      '<h4 id="lh-p-zh" class="text-lg font-bold text-gray-900 leading-tight">康寧護老院</h4>' +
      '<p id="lh-p-en" class="text-sm text-gray-600">Hong Ning Care Home</p>' +
      '<p id="lh-p-addr" class="text-xs text-gray-500 mt-1">新界沙田安心街12號</p>' +
      '<p id="lh-p-tel" class="text-xs text-gray-500">電話：2345 6789</p></div></div>' +
      '<div class="h-24 flex items-center justify-center text-sm text-gray-300">（文件內容）</div></div></div>';
    refreshIcons(root);

    root.addEventListener('input', function (e) {
      var map = { 'lh-zh': 'lh-p-zh', 'lh-en': 'lh-p-en', 'lh-addr': 'lh-p-addr' };
      if (map[e.target.id]) { $('#' + map[e.target.id], root).textContent = e.target.value; return; }
      if (e.target.id === 'lh-tel') $('#lh-p-tel', root).textContent = '電話：' + e.target.value;
    });
  }

  /* ============================================================
     8. ai-tools.html · 文件 OCR 中心（x-doc-ocr）
     對照 QRScannerModal.tsx 掃描流程：識別 → 核對 → 入庫。
     ============================================================ */

  var OCR_TYPES = ['身份證', '處方箋', '覆診紙', '針卡', '診斷書', '儀器屏幕'];
  var OCR_FIELDS = {
    '身份證': [['姓名', '陳大文'], ['身份證號碼', 'A123456(7)'], ['出生日期', '1945-03-12']],
    '處方箋': [['藥物', 'Metformin 500mg'], ['劑量', '每日兩次，每次一粒'], ['醫生', '黃志明醫生']],
    '覆診紙': [['醫院', '瑪麗醫院'], ['專科', '內科'], ['覆診日期', dateStr(14)]],
    '針卡': [['疫苗', '季節性流感疫苗'], ['接種日期', dateStr(-7)], ['批號', 'FLU-2025-018']],
    '診斷書': [['診斷', '二型糖尿病'], ['醫生', '黃志明醫生'], ['簽發日期', todayStr()]],
    '儀器屏幕': [['收縮壓 (mmHg)', '128'], ['舒張壓 (mmHg)', '76'], ['脈搏 (次/分)', '72']]
  };
  var ocrType = '身份證';
  var ocrScanned = false;

  function renderDocOcr(root) {
    var html = '<div class="flex flex-wrap gap-2 mb-4">';
    OCR_TYPES.forEach(function (t) {
      html += '<button type="button" class="px-3 py-1.5 rounded-full text-sm border transition-colors ' +
        (ocrType === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50') +
        '" data-ocr-type="' + t + '">' + t + '</button>';
    });
    html += '</div>';
    if (!ocrScanned) {
      html += '<div class="card bg-white rounded-lg border border-gray-200 p-6 flex flex-col items-center gap-3">' +
        '<i data-lucide="scan-text" class="w-10 h-10 text-gray-400"></i>' +
        '<p class="text-sm text-gray-500">已選文件類型：<span class="font-medium text-gray-800">' + ocrType + '</span></p>' +
        btnPrimary('<i data-lucide="camera" class="w-4 h-4"></i> 掃描', 'data-act="scan"') + '</div>';
    } else {
      html += '<div class="card bg-white rounded-lg border border-gray-200 p-4">' +
        '<div class="flex items-center gap-2 mb-3 text-sm text-green-700"><i data-lucide="check-circle" class="w-4 h-4"></i>識別完成（' + ocrType + '），請核對以下資料：</div>' +
        '<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">';
      OCR_FIELDS[ocrType].forEach(function (f) {
        html += '<div><label class="form-label block text-sm font-medium text-gray-700 mb-1">' + f[0] + '</label>' +
          '<input class="' + INPUT_CLS + '" value="' + f[1] + '"/></div>';
      });
      html += '</div><div class="mt-3 flex justify-end">' +
        btnSuccess('<i data-lucide="check" class="w-4 h-4"></i> 核對入庫', 'data-act="confirm"') + '</div></div>';
    }
    root.innerHTML = html;
    refreshIcons(root);
  }

  function initDocOcr() {
    var root = $('#x-doc-ocr');
    if (!root) return;
    renderDocOcr(root);
    root.addEventListener('click', function (e) {
      var chip = e.target.closest('[data-ocr-type]');
      if (chip) {
        ocrType = chip.dataset.ocrType;
        ocrScanned = false;
        renderDocOcr(root);
        return;
      }
      if (e.target.closest('[data-act="scan"]')) {
        fakeScan('掃描' + ocrType, function () { ocrScanned = true; renderDocOcr(root); });
        return;
      }
      if (e.target.closest('[data-act="confirm"]')) {
        ocrScanned = false;
        renderDocOcr(root);
        toast('已核對並入庫');
      }
    });
  }

  /* ============================================================
     9. analytics.html · 費用記錄（x-fees）
     ============================================================ */

  var feeRecords = [
    { date: dateStr(-1), name: '陳大文', item: '尿片（一包）', amount: 180 },
    { date: dateStr(-2), name: '李笑好', item: '陪診交通費', amount: 250 },
    { date: dateStr(-3), name: '黃伯強', item: '營養奶粉', amount: 320 }
  ];

  function renderFeeTable(root) {
    var html = '<div class="overflow-x-auto card bg-white rounded-lg border border-gray-200">' +
      '<table class="w-full text-sm"><thead class="bg-gray-50"><tr>' +
      '<th class="px-3 py-2 text-left font-medium text-gray-700">日期</th>' +
      '<th class="px-3 py-2 text-left font-medium text-gray-700">院友</th>' +
      '<th class="px-3 py-2 text-left font-medium text-gray-700">項目</th>' +
      '<th class="px-3 py-2 text-right font-medium text-gray-700">金額</th>' +
      '</tr></thead><tbody class="divide-y divide-gray-200 bg-white">';
    var total = 0;
    feeRecords.forEach(function (f) {
      total += Number(f.amount) || 0;
      html += '<tr><td class="px-3 py-2 text-gray-600">' + f.date + '</td>' +
        '<td class="px-3 py-2 font-medium text-gray-900">' + f.name + '</td>' +
        '<td class="px-3 py-2 text-gray-700">' + f.item + '</td>' +
        '<td class="px-3 py-2 text-right text-gray-900">$' + f.amount + '</td></tr>';
    });
    html += '</tbody></table></div>' +
      '<div class="flex items-center justify-between gap-3 flex-wrap mt-3">' +
      '<p class="text-sm font-semibold text-gray-900">本月總計：<span class="text-blue-700">$' + total + '</span></p>' +
      btnSecondary('<i data-lucide="file-spreadsheet" class="w-4 h-4"></i> 匯出 Excel', 'data-act="export"') + '</div>';
    $('#xf-table', root).innerHTML = html;
    refreshIcons(root);
  }

  function initFees() {
    var root = $('#x-fees');
    if (!root) return;
    root.innerHTML =
      '<div class="card bg-white rounded-lg border border-gray-200 p-4 mb-4">' +
      '<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">' +
      '<div><label class="form-label block text-sm font-medium text-gray-700 mb-1">院友</label>' +
      '<select class="' + INPUT_CLS + '" id="xf-name">' + residentOptions('陳大文') + '</select></div>' +
      '<div><label class="form-label block text-sm font-medium text-gray-700 mb-1">項目</label>' +
      '<input class="' + INPUT_CLS + '" id="xf-item" placeholder="例如：尿片（一包）"/></div>' +
      '<div><label class="form-label block text-sm font-medium text-gray-700 mb-1">金額</label>' +
      '<input type="number" min="0" class="' + INPUT_CLS + '" id="xf-amount" placeholder="0"/></div></div>' +
      '<div class="mt-3 flex justify-end">' + btnPrimary('<i data-lucide="plus" class="w-4 h-4"></i> 新增', 'data-act="add"') + '</div></div>' +
      '<div id="xf-table"></div>';
    refreshIcons(root);
    renderFeeTable(root);

    root.addEventListener('click', function (e) {
      if (e.target.closest('[data-act="export"]')) { toast('已匯出費用記錄 Excel（示範）'); return; }
      if (!e.target.closest('[data-act="add"]')) return;
      var item = $('#xf-item', root).value.trim();
      var amount = Number($('#xf-amount', root).value);
      if (!item || !amount) { toast('請輸入項目及金額', 'danger'); return; }
      feeRecords.unshift({ date: todayStr(), name: $('#xf-name', root).value, item: item, amount: amount });
      $('#xf-item', root).value = '';
      $('#xf-amount', root).value = '';
      renderFeeTable(root);
      toast('已新增費用記錄');
    });
  }

  /* ============================================================
     10. permissions.html · 硬性安全規則（x-rules）
     注射藥簽署僅限註冊/登記護士及保健員。
     ============================================================ */

  var ruleRole = '護理員';

  function renderRules(root) {
    var allowed = ruleRole !== '護理員';
    var html =
      '<div class="mb-4 max-w-xs"><label class="form-label block text-sm font-medium text-gray-700 mb-1">模擬登入角色</label>' +
      '<select class="' + INPUT_CLS + '" id="xr-role">' +
      ['註冊護士', '保健員', '護理員'].map(function (r) {
        return '<option' + (ruleRole === r ? ' selected' : '') + '>' + r + '</option>';
      }).join('') + '</select></div>' +
      '<div class="card bg-white rounded-lg border border-gray-200 p-4">' +
      '<div class="flex items-center gap-2 mb-3"><i data-lucide="syringe" class="w-5 h-5 text-blue-600"></i>' +
      '<h4 class="font-medium text-gray-900">注射藥簽署</h4>' + badge(ruleRole, allowed ? 'green' : 'gray') + '</div>' +
      '<p class="text-sm text-gray-600 mb-3">黃伯強（102-A）— 胰島素 10 units，皮下注射</p>' +
      (allowed
        ? btnPrimary('<i data-lucide="pen-line" class="w-4 h-4"></i> 簽署注射藥', 'data-act="sign"')
        : '<button type="button" disabled class="btn-primary inline-flex items-center gap-1.5 opacity-50 cursor-not-allowed"><i data-lucide="lock" class="w-4 h-4"></i> 簽署注射藥</button>' +
          '<p class="text-sm text-red-600 mt-2 flex items-center gap-1"><i data-lucide="shield-alert" class="w-4 h-4"></i>僅註冊/登記護士及保健員可簽署</p>') +
      '</div>' +
      '<div class="flex items-start gap-2 mt-3 p-3 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-600">' +
      '<i data-lucide="bot" class="w-4 h-4 mt-0.5 flex-shrink-0"></i>' +
      '<span>AI 助手操作同樣受權限約束：越權指令會被系統直接拒絕，與人手操作一致。</span></div>';
    root.innerHTML = html;
    refreshIcons(root);
  }

  function initRules() {
    var root = $('#x-rules');
    if (!root) return;
    renderRules(root);
    root.addEventListener('change', function (e) {
      if (e.target.id !== 'xr-role') return;
      ruleRole = e.target.value;
      renderRules(root);
    });
    root.addEventListener('click', function (e) {
      if (!e.target.closest('[data-act="sign"]')) return;
      askSignature('注射藥簽署', function (name) { toast('' + name + '已簽署注射藥（示範）'); });
    });
  }

  /* ============================================================
     11. permissions.html · 用戶 QR 登入（x-qr-login）
     對照 QRScannerModal.tsx：掃碼取代密碼，全程留痕。
     ============================================================ */

  var loginLog = [
    { time: todayStr() + ' 07:58', user: '陳護士', method: 'QR' },
    { time: todayStr() + ' 07:45', user: '黃姑娘', method: '密碼' }
  ];
  var qrLoggedIn = false;

  function renderQrLogin(root) {
    var html = '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">' +
      '<div class="card bg-white rounded-lg border border-gray-200 p-4">' +
      (qrLoggedIn
        ? '<div class="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">' +
          '<i data-lucide="check-circle" class="w-5 h-5"></i>已登入：陳護士（護理部）</div>'
        : '<div class="space-y-3">' +
          '<div><label class="form-label block text-sm font-medium text-gray-700 mb-1">帳號</label>' +
          '<input class="' + INPUT_CLS + '" id="xq-user" value="nurse.chan"/></div>' +
          '<div><label class="form-label block text-sm font-medium text-gray-700 mb-1">密碼</label>' +
          '<input type="password" class="' + INPUT_CLS + '" id="xq-pass" value="demo1234"/></div>' +
          '<div class="flex items-center gap-2 flex-wrap">' +
          btnPrimary('<i data-lucide="log-in" class="w-4 h-4"></i> 登入', 'data-act="pwd"') +
          btnSecondary('<i data-lucide="qr-code" class="w-4 h-4"></i> 掃描用戶 QR 登入', 'data-act="qr"') + '</div></div>') +
      '</div>' +
      '<div class="card bg-white rounded-lg border border-gray-200">' +
      '<div class="px-4 py-3 border-b border-gray-200 flex items-center gap-2">' +
      '<i data-lucide="history" class="w-4 h-4 text-gray-500"></i>' +
      '<h4 class="font-medium text-gray-900">登入留痕</h4></div>' +
      '<table class="w-full text-sm"><thead class="bg-gray-50"><tr>' +
      '<th class="px-3 py-2 text-left font-medium text-gray-700">時間</th>' +
      '<th class="px-3 py-2 text-left font-medium text-gray-700">用戶</th>' +
      '<th class="px-3 py-2 text-left font-medium text-gray-700">方式</th>' +
      '</tr></thead><tbody class="divide-y divide-gray-200 bg-white">';
    loginLog.forEach(function (l) {
      html += '<tr><td class="px-3 py-2 text-gray-600">' + l.time + '</td>' +
        '<td class="px-3 py-2 font-medium text-gray-900">' + l.user + '</td>' +
        '<td class="px-3 py-2">' + badge(l.method, l.method === 'QR' ? 'blue' : 'gray') + '</td></tr>';
    });
    html += '</tbody></table></div></div>';
    root.innerHTML = html;
    refreshIcons(root);
  }

  function initQrLogin() {
    var root = $('#x-qr-login');
    if (!root) return;
    renderQrLogin(root);
    root.addEventListener('click', function (e) {
      if (e.target.closest('[data-act="pwd"]')) {
        if (!$('#xq-user', root).value.trim() || !$('#xq-pass', root).value.trim()) {
          toast('請輸入帳號及密碼', 'danger');
          return;
        }
        qrLoggedIn = true;
        loginLog.unshift({ time: todayStr() + ' ' + now(), user: '陳護士', method: '密碼' });
        renderQrLogin(root);
        return;
      }
      if (e.target.closest('[data-act="qr"]')) {
        fakeScan('掃描用戶 QR', function () {
          qrLoggedIn = true;
          loginLog.unshift({ time: todayStr() + ' ' + now(), user: '陳護士', method: 'QR' });
          renderQrLogin(root);
        });
      }
    });
  }

  /* ============================================================
     12. permissions.html · 數據匯出（x-backup）
     ============================================================ */

  var BACKUP_TYPES = ['院友名單', '處方記錄', '護理記錄', '月報表'];

  function initBackup() {
    var root = $('#x-backup');
    if (!root) return;
    var html =
      '<div class="overflow-x-auto card bg-white rounded-lg border border-gray-200">' +
      '<table class="w-full text-sm"><thead class="bg-gray-50"><tr>' +
      '<th class="px-3 py-2 text-left font-medium text-gray-700">數據類型</th>' +
      '<th class="px-3 py-2 text-right font-medium text-gray-700">匯出</th>' +
      '</tr></thead><tbody class="divide-y divide-gray-200 bg-white">';
    BACKUP_TYPES.forEach(function (t) {
      html += '<tr><td class="px-3 py-2"><div class="flex items-center gap-2 text-gray-800">' +
        '<i data-lucide="database" class="w-4 h-4 text-gray-400"></i>' + t + '</div></td>' +
        '<td class="px-3 py-2"><div class="flex justify-end gap-2">' +
        btnSecondary('CSV', 'data-export="' + t + '|CSV"') +
        btnSecondary('Excel', 'data-export="' + t + '|Excel"') + '</div></td></tr>';
    });
    html += '</tbody></table></div>' +
      '<div class="card bg-white rounded-lg border border-gray-200 p-4 mt-4">' +
      '<div class="flex items-center gap-2 flex-wrap">' +
      '<i data-lucide="archive" class="w-5 h-5 text-gray-500"></i>' +
      '<h4 class="font-medium text-gray-900">全量備份</h4>' + badge('開發中', 'yellow') + '</div>' +
      '<p class="text-sm text-gray-500 mt-2">一鍵下載全院完整數據快照（含附件）功能正在開發中，現階段請使用上方分類匯出。</p></div>';
    root.innerHTML = html;
    refreshIcons(root);

    root.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-export]');
      if (!btn) return;
      var p = btn.dataset.export.split('|');
      toast('已匯出 ' + p[0] + '（' + p[1] + '）（示範）');
    });
  }

  /* ============================================================
     13. platform.html · 響應式預覽（x-responsive）
     ============================================================ */

  var DEVICES = [
    { key: '手機', width: '375px', icon: 'smartphone' },
    { key: 'iPad', width: '768px', icon: 'tablet' },
    { key: '電腦', width: '100%', icon: 'monitor' }
  ];
  var respDevice = '電腦';
  var respDark = false;

  function renderResponsive(root) {
    var dev = DEVICES.filter(function (d) { return d.key === respDevice; })[0];
    var html = '<div class="flex items-center justify-between gap-3 flex-wrap mb-4">' +
      '<div class="flex flex-wrap gap-2">';
    DEVICES.forEach(function (d) {
      html += '<button type="button" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors ' +
        (respDevice === d.key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50') +
        '" data-dev="' + d.key + '"><i data-lucide="' + d.icon + '" class="w-4 h-4"></i>' + d.key + '</button>';
    });
    html += '</div>' +
      '<label class="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">' +
      '<input type="checkbox" id="xp-dark" class="rounded border-gray-300"' + (respDark ? ' checked' : '') + '/>深色模式</label></div>' +
      '<div class="rounded-xl bg-gray-200 p-3 overflow-x-auto">' +
      '<div class="mx-auto rounded-lg border shadow-sm overflow-hidden transition-all duration-300 ' +
      (respDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300') + '" style="width:' + dev.width + ';max-width:100%;">' +
      '<div class="flex items-center justify-between px-4 py-3 border-b ' + (respDark ? 'border-gray-700' : 'border-gray-200') + '">' +
      '<span class="font-semibold text-sm ' + (respDark ? 'text-gray-100' : 'text-gray-900') + '">院友列表</span>' +
      '<i data-lucide="search" class="w-4 h-4 ' + (respDark ? 'text-gray-400' : 'text-gray-500') + '"></i></div>';
    RESIDENTS.slice(0, 3).forEach(function (r) {
      html += '<div class="flex items-center gap-3 px-4 py-3 border-b last:border-b-0 ' + (respDark ? 'border-gray-700' : 'border-gray-100') + '">' +
        '<div class="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ' + (respDark ? 'bg-blue-900' : 'bg-blue-100') + '">' +
        '<i data-lucide="user" class="w-4 h-4 ' + (respDark ? 'text-blue-300' : 'text-blue-600') + '"></i></div>' +
        '<div class="flex-1 min-w-0">' +
        '<p class="text-sm font-medium truncate ' + (respDark ? 'text-gray-100' : 'text-gray-900') + '">' + r.name + '</p>' +
        '<p class="text-xs ' + (respDark ? 'text-gray-400' : 'text-gray-500') + '">' + r.bed + ' · ' + r.care + '</p></div>' +
        badge('在住', 'green') + '</div>';
    });
    html += '</div></div>' +
      '<p class="text-xs text-gray-400 mt-2">預覽寬度：' + dev.width + ' — 介面隨裝置自動調整排版</p>';
    root.innerHTML = html;
    refreshIcons(root);
  }

  function initResponsive() {
    var root = $('#x-responsive');
    if (!root) return;
    renderResponsive(root);
    root.addEventListener('click', function (e) {
      var chip = e.target.closest('[data-dev]');
      if (!chip) return;
      respDevice = chip.dataset.dev;
      renderResponsive(root);
    });
    root.addEventListener('change', function (e) {
      if (e.target.id !== 'xp-dark') return;
      respDark = e.target.checked;
      renderResponsive(root);
    });
  }

  /* ============================================================
     初始化
     ============================================================ */

  function init() {
    initAbsence();
    initTasks();
    initMeal();
    initIncident();
    initInfection();
    initTemplate();
    initLetterhead();
    initDocOcr();
    initFees();
    initRules();
    initQrLogin();
    initBackup();
    initResponsive();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
