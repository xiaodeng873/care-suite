/* ============================================================
   features-demo-clinical.js — 功能體驗頁互動示範（藥物 / 診症 / 合規）
   適用頁面：medication.html、treatment.html、compliance.html
   100% 前端、無框架、無網絡請求。所有數據均為虛構。
   視覺對照 apps/web/src/ 真實頁面：
   - OCRPrescriptionBlock.tsx / MedicationWorkflow.tsx
   - PrnWorkflowModal.tsx / InjectionWorkflowModal.tsx
   - pages/DrugDatabase.tsx / pages/Cgat.tsx
   - AnnualHealthCheckupModal.tsx / HealthAssessmentModal.tsx
   - RestraintAssessmentModal.tsx
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
      orange: 'bg-orange-100 text-orange-800',
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

  /* ---------- 本檔案額外日期工具 ---------- */

  function daysFromToday(iso) {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var d = new Date(iso + 'T00:00:00');
    return Math.round((d - today) / 86400000);
  }

  function addMonths(iso, months) {
    var d = new Date(iso + 'T00:00:00');
    d.setMonth(d.getMonth() + months);
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  function tableWrap(head, rowsHtml) {
    return '<div class="card overflow-hidden"><table class="w-full text-sm">' +
      '<thead><tr class="bg-gray-50 text-left text-gray-600">' + head + '</tr></thead>' +
      '<tbody class="divide-y divide-gray-100">' + rowsHtml + '</tbody></table></div>';
  }

  function th(t) { return '<th class="px-4 py-2.5 font-medium">' + t + '</th>'; }
  function td(t, cls) { return '<td class="px-4 py-2.5 ' + (cls || 'text-gray-700') + '">' + t + '</td>'; }

  var RX_STATUS = {
    active: { label: '在服', color: 'green' },
    pending: { label: '待變更', color: 'yellow' },
    stopped: { label: '停用', color: 'gray' }
  };

  function rxBadge(status) {
    var s = RX_STATUS[status] || RX_STATUS.active;
    return badge(s.label, s.color);
  }

  /* ============================================================
     medication.html
     ============================================================ */

  /* ---------- 1. x-rx-ocr 處方三態 + AI 錄入 ----------
     對照 OCRPrescriptionBlock.tsx / MedicationWorkflow.tsx */

  var rxOcrList = [
    { name: '陳大文', drug: 'METFORMIN 500MG', dose: '每日兩次 每次1粒', status: 'active' },
    { name: '黃伯強', drug: 'METOPROLOL 50MG', dose: '每日一次 每次1粒', status: 'active' },
    { name: '李笑好', drug: 'ASPIRIN 100MG', dose: '每日一次 每次1粒', status: 'pending' },
    { name: '周桂蘭', drug: 'SIMVASTATIN 20MG', dose: '每晚一次 每次1粒', status: 'stopped' }
  ];

  function renderRxOcr() {
    var root = $('#x-rx-ocr');
    if (!root) return;
    var rows = rxOcrList.map(function (r) {
      return '<tr>' + td('<span class="font-medium text-gray-900">' + r.name + '</span>') +
        td(r.drug) + td(r.dose) + td(rxBadge(r.status)) + '</tr>';
    }).join('');
    root.innerHTML =
      '<div class="flex items-center justify-between mb-3 gap-3 flex-wrap">' +
      '<h3 class="text-md font-semibold text-gray-900 flex items-center gap-2">' +
      '<i data-lucide="pill" class="w-4 h-4 text-blue-600"></i>處方列表</h3>' +
      btnPrimary('<i data-lucide="scan-line" class="w-4 h-4"></i> 上傳處方標籤 AI 識別', 'data-act="ocr"') + '</div>' +
      tableWrap(th('院友') + th('藥名') + th('劑量') + th('狀態'), rows);
    refreshIcons(root);
  }

  function initRxOcr() {
    var root = $('#x-rx-ocr');
    if (!root) return;
    renderRxOcr();
    root.addEventListener('click', function (e) {
      if (!e.target.closest('[data-act="ocr"]')) return;
      fakeScan('AI 識別處方標籤', function () {
        rxOcrList.unshift({ name: '吳美玲', drug: 'AMLODIPINE 5MG', dose: '每日一次 每次1粒', status: 'pending' });
        renderRxOcr();
        toast('AI 已識別，請核對後確認');
      });
    });
  }

  /* ---------- 2. x-safety 派藥前安全檢測 ----------
     對照 MedicationWorkflow.tsx 安全檢查邏輯 */

  function renderSafety() {
    var root = $('#x-safety');
    if (!root) return;
    root.innerHTML =
      '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">' +

      '<div class="card p-5 border-l-4 border-red-400">' +
      '<div class="flex items-center justify-between mb-3">' +
      '<div><p class="font-semibold text-gray-900">黃伯強 <span class="text-xs text-gray-500 font-normal">102-A</span></p>' +
      '<p class="text-sm text-gray-600">METOPROLOL 50MG（血壓藥）</p></div>' +
      badge('血壓藥', 'blue') + '</div>' +
      '<div class="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 mb-3 flex items-center gap-2">' +
      '<i data-lucide="shield-check" class="w-4 h-4 text-gray-500 flex-shrink-0"></i>檢測項：血壓 &lt; 100/60 停服</div>' +
      '<p class="text-sm text-gray-700 mb-2">最近血壓：<span class="font-semibold text-red-600">92/58 mmHg</span>（今日 08:30）</p>' +
      '<div class="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-4">' +
      '<i data-lucide="alert-triangle" class="w-4 h-4 flex-shrink-0"></i>不符合安全條件，已阻止派藥</div>' +
      '<button type="button" disabled class="btn-primary inline-flex items-center gap-1.5 opacity-50 cursor-not-allowed">' +
      '<i data-lucide="ban" class="w-4 h-4"></i> 派藥</button></div>' +

      '<div class="card p-5 border-l-4 border-green-400">' +
      '<div class="flex items-center justify-between mb-3">' +
      '<div><p class="font-semibold text-gray-900">陳大文 <span class="text-xs text-gray-500 font-normal">101-A</span></p>' +
      '<p class="text-sm text-gray-600">METFORMIN 500MG</p></div>' +
      badge('糖尿藥', 'blue') + '</div>' +
      '<div class="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 mb-3 flex items-center gap-2">' +
      '<i data-lucide="shield-check" class="w-4 h-4 text-gray-500 flex-shrink-0"></i>檢測項：血糖 &lt; 4 停服</div>' +
      '<p class="text-sm text-gray-700 mb-2">最近血糖：<span class="font-semibold text-green-600">6.8 mmol/L</span>（今日 07:45）</p>' +
      '<div class="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-3 py-2 mb-4">' +
      '<i data-lucide="check-circle" class="w-4 h-4 flex-shrink-0"></i>符合安全條件</div>' +
      btnSuccess('<i data-lucide="check" class="w-4 h-4"></i> 派藥', 'data-act="dispense"') + '</div>' +

      '</div>';
    refreshIcons(root);
  }

  function initSafety() {
    var root = $('#x-safety');
    if (!root) return;
    renderSafety();
    root.addEventListener('click', function (e) {
      if (e.target.closest('[data-act="dispense"]')) toast('已派藥（示範）');
    });
  }

  /* ---------- 3. x-prn PRN / 注射藥 ----------
     對照 PrnWorkflowModal.tsx / InjectionWorkflowModal.tsx */

  var PRN_STEPS = [
    { key: 'preparation', index: '①', label: '執藥' },
    { key: 'verification', index: '②', label: '核藥' },
    { key: 'dispensing', index: '③', label: '派藥' }
  ];

  // 注射區域定義（與 InjectionWorkflowModal.tsx INJECTION_AREAS 一致）
  var INJECTION_AREAS = [
    { value: 'left_arm', label: '左上臂區', prefix: 'A' },
    { value: 'right_arm', label: '右上臂區', prefix: 'B' },
    { value: 'abdomen_left', label: '腹部左區', prefix: 'C' },
    { value: 'abdomen_right', label: '腹部右區', prefix: 'D' },
    { value: 'left_thigh', label: '左大腿區', prefix: 'E' },
    { value: 'right_thigh', label: '右大腿區', prefix: 'F' }
  ];

  var PRN_DRUG = 'TRAMADOL HCL CAP 50MG';
  var INJ_DRUG = 'INSULIN GLARGINE INJ 100IU/ML';
  var SIGNER_NAME = '陳護士 (註冊護士)';

  var prnRecords = [
    { type: 'prn', time: '09:15', drug: PRN_DRUG, dose: '每次1粒',
      preparation: '陳護士 (註冊護士)', verification: '黃保健員 (保健員)', dispensing: '陳護士 (註冊護士)', site: '' }
  ];

  function prnRecordItem(r) {
    var isInj = r.type === 'inj';
    return '<li class="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">' +
      '<div class="p-2 rounded-lg flex-shrink-0 ' + (isInj ? 'bg-blue-100' : 'bg-purple-100') + '">' +
      '<i data-lucide="' + (isInj ? 'syringe' : 'pill') + '" class="w-4 h-4 ' + (isInj ? 'text-blue-600' : 'text-purple-600') + '"></i></div>' +
      '<div class="flex-1 min-w-0">' +
      '<div class="flex items-center gap-2 flex-wrap">' +
      '<span class="text-sm font-medium text-gray-900">' + r.drug + '</span>' +
      '<span class="text-xs text-gray-500">' + r.time + '</span></div>' +
      '<div class="text-xs text-gray-600 mt-0.5">劑量：' + r.dose +
      (r.site ? '　注射位置：<span class="font-medium text-gray-800">' + r.site + '</span>' : '') + '</div>' +
      '<div class="text-[11px] text-gray-500 mt-0.5">① 執藥：' + r.preparation +
      '　② 核藥：' + r.verification + '　③ 派藥：' + r.dispensing + '</div></div>' +
      badge('已完成', 'green') + '</li>';
  }

  function renderPrn() {
    var root = $('#x-prn');
    if (!root) return;
    var prnRes = res('李笑好');
    var injRes = res('梁志偉');
    root.innerHTML =
      '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">' +

      '<div class="card p-5">' +
      '<div class="flex items-center gap-3 mb-3">' +
      '<div class="p-2 rounded-lg bg-purple-100"><i data-lucide="pill" class="h-6 w-6 text-purple-600"></i></div>' +
      '<div><h3 class="font-semibold text-gray-900">需要時給藥程序（PRN）</h3>' +
      '<p class="text-xs text-gray-500">' + prnRes.name + ' · ' + prnRes.bed + '</p></div></div>' +
      '<div class="mb-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-700 flex flex-wrap gap-x-6 gap-y-1">' +
      '<span>藥物：<span class="font-medium text-gray-900">' + PRN_DRUG + '</span></span>' +
      '<span>口服</span><span class="text-red-600 font-medium">需要時</span><span>每次1粒</span></div>' +
      btnPrimary('<i data-lucide="play" class="w-4 h-4"></i> 開始需要時給藥', 'data-act="prn"') + '</div>' +

      '<div class="card p-5">' +
      '<div class="flex items-center gap-3 mb-3">' +
      '<div class="p-2 rounded-lg bg-blue-100"><i data-lucide="syringe" class="h-6 w-6 text-blue-600"></i></div>' +
      '<div><h3 class="font-semibold text-gray-900">注射類藥物給藥程序</h3>' +
      '<p class="text-xs text-gray-500">' + injRes.name + ' · ' + injRes.bed + '</p></div></div>' +
      '<div class="mb-2 p-3 bg-gray-50 rounded-lg text-sm text-gray-700 flex flex-wrap gap-x-6 gap-y-1">' +
      '<span>藥物：<span class="font-medium text-gray-900">' + INJ_DRUG + '</span></span>' +
      '<span>皮下注射</span><span>每日1次 21:00</span><span>每次10IU</span></div>' +
      '<p class="text-xs text-amber-600 mb-4">⚠ 簽署人員須為註冊/登記護士或保健員（護理員不可）</p>' +
      btnPrimary('<i data-lucide="syringe" class="w-4 h-4"></i> 開始注射給藥', 'data-act="inj"') + '</div>' +

      '</div>' +

      '<div class="card p-5 mt-4">' +
      '<h3 class="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">' +
      '<i data-lucide="clipboard-check" class="w-4 h-4 text-green-600"></i>今日給藥記錄</h3>' +
      '<ul>' + prnRecords.map(prnRecordItem).join('') + '</ul></div>';
    refreshIcons(root);
  }

  /* 三簽署卡（對照兩個 WorkflowModal 的 grid grid-cols-3 簽署格） */
  function signCardsHtml(signs) {
    return '<div class="grid grid-cols-3 gap-3 mb-5">' +
      PRN_STEPS.map(function (s) {
        var signer = signs[s.key];
        var inner;
        if (signer) {
          inner = '<div class="flex items-center justify-center gap-1 text-green-700 text-xs mb-1">' +
            '<i data-lucide="check-circle" class="w-3.5 h-3.5"></i> 已簽</div>' +
            '<div class="text-xs text-gray-800 break-all">' + signer + '</div>' +
            '<button type="button" data-sign="' + s.key + '" class="mt-1 text-[11px] text-blue-400 hover:text-blue-600 underline">另填</button>';
        } else {
          inner = '<button type="button" data-sign="' + s.key + '" class="mt-2 inline-flex items-center gap-1 px-2 py-1.5 text-xs rounded border border-blue-300 text-blue-600 hover:bg-blue-50">' +
            '<i data-lucide="user-plus" class="w-3.5 h-3.5"></i> 點擊簽署</button>';
        }
        return '<div class="border-2 rounded-lg p-3 text-center ' + (signer ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white') + '">' +
          '<div class="text-sm font-medium text-gray-800 mb-1">' + s.index + ' ' + s.label + '</div>' + inner + '</div>';
      }).join('') + '</div>';
  }

  /* 簽署身份確認子彈窗（對照 PrnWorkflowModal 身份確認彈窗；示範用，任何帳號密碼可過） */
  function openSignConfirm(stepLabel, cb) {
    var m = openModal(
      '<div class="flex items-center gap-2 mb-3">' +
      '<i data-lucide="lock" class="w-5 h-5 text-blue-600"></i>' +
      '<h3 class="text-lg font-semibold text-gray-900">簽署身份確認</h3></div>' +
      '<div class="text-sm text-gray-700 mb-1">正在簽署：<span class="font-medium">' + stepLabel + '</span></div>' +
      '<div class="text-xs text-amber-600 mb-3">⚠️ 簽署人員須為註冊/登記護士或保健員（護理員不可）。</div>' +
      '<div class="space-y-2 mb-2">' +
      '<input type="text" id="fd-cfm-user" class="form-input w-full" placeholder="帳號" autocomplete="off" value="nurse01" />' +
      '<input type="password" id="fd-cfm-pass" class="form-input w-full" placeholder="密碼" autocomplete="new-password" />' +
      '</div>' +
      '<div id="fd-cfm-err" class="hidden mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-600"></div>' +
      '<div class="flex gap-2 mt-3">' +
      '<button type="button" class="btn-secondary flex-1" data-act="cancel">取消</button>' +
      '<button type="button" class="btn-primary flex-1" data-act="ok">確認簽署</button></div>',
      { width: 'sm' }
    );
    var pass = $('#fd-cfm-pass', m.body);
    pass.focus();
    m.body.addEventListener('click', function (e) {
      var act = e.target.closest('[data-act]');
      if (!act) return;
      if (act.dataset.act === 'cancel') { m.close(); return; }
      var user = $('#fd-cfm-user', m.body).value.trim();
      var err = $('#fd-cfm-err', m.body);
      if (!user || !pass.value) {
        err.textContent = '❌ 請輸入帳號與密碼';
        err.classList.remove('hidden');
        return;
      }
      m.close();
      cb(SIGNER_NAME);
    });
  }

  function fullInjSite(st) {
    if (!st.area || !st.pos) return '';
    var a = INJECTION_AREAS.filter(function (x) { return x.value === st.area; })[0];
    return a.prefix + st.pos;
  }

  /* 注射位置選擇（對照 InjectionWorkflowModal：近兩次位置提醒 + 區域 chips + 1-8 位置格） */
  function injSiteHtml(st) {
    var area = INJECTION_AREAS.filter(function (x) { return x.value === st.area; })[0];
    var html = '<div class="mb-4">' +
      '<div class="text-sm font-medium text-gray-800 mb-2">注射位置 <span class="text-red-500">（必填）</span></div>' +
      '<div class="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">' +
      '<div class="flex items-center gap-1 font-medium mb-1">' +
      '<i data-lucide="map-pin" class="w-4 h-4"></i> 最近2次注射位置：</div>' +
      '<ul class="space-y-0.5 ml-5 list-disc">' +
      '<li>28/08/2026 21:00 → C3（腹部左區）</li>' +
      '<li>29/08/2026 21:00 → D5（腹部右區）</li></ul></div>' +
      '<div class="flex flex-wrap gap-2 mb-2">' +
      INJECTION_AREAS.map(function (a) {
        var on = st.area === a.value;
        return '<button type="button" data-area="' + a.value + '" class="px-3 py-1.5 text-xs rounded-lg border-2 transition-all ' +
          (on ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-gray-300 text-gray-700') + '">' +
          a.label + '（' + a.prefix + '）</button>';
      }).join('') + '</div>';
    if (area) {
      html += '<div class="grid grid-cols-8 gap-1.5 mb-2">';
      for (var i = 1; i <= 8; i++) {
        var on2 = st.pos === String(i);
        html += '<button type="button" data-pos="' + i + '" class="py-2 text-sm font-bold rounded-lg border-2 transition-all ' +
          (on2 ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-gray-300 text-gray-800') + '">' +
          area.prefix + i + '</button>';
      }
      html += '</div>';
    }
    if (fullInjSite(st)) {
      html += '<div class="flex items-center gap-2 text-sm text-green-700 font-medium">' +
        '<i data-lucide="check-circle" class="w-4 h-4"></i> 已選：' + fullInjSite(st) + '</div>';
    }
    return html + '</div>';
  }

  /* Workflow modal 內容（kind: 'prn' | 'inj'），對照兩個真實 modal 的 max-w-lg 結構 */
  function workflowBodyHtml(kind, st) {
    var isInj = kind === 'inj';
    var r = isInj ? res('梁志偉') : res('李笑好');
    var html =
      '<div class="flex items-center justify-between mb-4">' +
      '<div class="flex items-center gap-3">' +
      '<div class="p-2 rounded-lg ' + (isInj ? 'bg-blue-100' : 'bg-purple-100') + '">' +
      '<i data-lucide="' + (isInj ? 'syringe' : 'pill') + '" class="h-6 w-6 ' + (isInj ? 'text-blue-600' : 'text-purple-600') + '"></i></div>' +
      '<h2 class="text-xl font-semibold text-gray-900">' + (isInj ? '注射類藥物給藥程序' : '需要時給藥程序') + '</h2></div>' +
      '<span class="text-sm text-gray-600">' + r.name + ' · ' + r.bed + '</span></div>' +

      '<div class="mb-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-700 flex flex-wrap gap-x-6 gap-y-1">' +
      '<span>藥物：<span class="font-medium text-gray-900">' + (isInj ? INJ_DRUG : PRN_DRUG) + '</span></span>' +
      '<span>日期：30/08/2026</span>' +
      (isInj ? '<span>時間點：21:00</span>' : '<span class="text-red-600 font-medium">需要時</span>') + '</div>';

    if (!isInj) {
      html += '<div class="mb-4">' +
        '<div class="text-sm font-medium text-gray-800 mb-2 flex items-center gap-1">' +
        '<i data-lucide="clock" class="w-4 h-4"></i> 給藥時間 <span class="text-red-500">（必填）</span></div>' +
        '<input type="time" id="fd-prn-time" class="form-input w-40" value="' + st.time + '" /></div>';
    }

    html += signCardsHtml(st.signs);
    if (isInj) html += injSiteHtml(st);

    var allSigned = st.signs.preparation && st.signs.verification && st.signs.dispensing;
    var canComplete = allSigned && (isInj ? !!fullInjSite(st) : !!st.time);
    html += '<div class="flex gap-2 pt-2 border-t border-gray-100">' +
      '<button type="button" class="btn-secondary flex-1" data-act="cancel">取消</button>' +
      '<button type="button" class="btn-primary flex-1' + (canComplete ? '' : ' opacity-50 cursor-not-allowed') + '" data-act="complete"' +
      (canComplete ? '' : ' disabled') + '>完成</button></div>';
    return html;
  }

  function openWorkflow(kind) {
    var isInj = kind === 'inj';
    var st = {
      signs: { preparation: null, verification: null, dispensing: null },
      time: now(),
      area: '',
      pos: ''
    };
    var m = openModal('', { width: 'lg' });
    function redraw() {
      m.body.innerHTML = workflowBodyHtml(kind, st);
      refreshIcons(m.body);
    }
    redraw();
    m.body.addEventListener('click', function (e) {
      var signBtn = e.target.closest('[data-sign]');
      if (signBtn) {
        var key = signBtn.dataset.sign;
        var label = PRN_STEPS.filter(function (s) { return s.key === key; })[0].label;
        openSignConfirm(label, function (name) {
          st.signs[key] = name;
          redraw();
        });
        return;
      }
      var areaBtn = e.target.closest('[data-area]');
      if (areaBtn) { st.area = areaBtn.dataset.area; st.pos = ''; redraw(); return; }
      var posBtn = e.target.closest('[data-pos]');
      if (posBtn) { st.pos = posBtn.dataset.pos; redraw(); return; }
      var act = e.target.closest('[data-act]');
      if (!act) return;
      if (act.dataset.act === 'cancel') { m.close(); return; }
      if (act.dataset.act === 'complete') {
        prnRecords.unshift({
          type: kind,
          time: isInj ? now() : st.time,
          drug: isInj ? INJ_DRUG : PRN_DRUG,
          dose: isInj ? '每次10IU' : '每次1粒',
          preparation: st.signs.preparation,
          verification: st.signs.verification,
          dispensing: st.signs.dispensing,
          site: isInj ? fullInjSite(st) : ''
        });
        m.close();
        renderPrn();
        toast(isInj ? '注射給藥已完成並記錄' : 'PRN 給藥已完成並記錄');
      }
    });
    m.body.addEventListener('change', function (e) {
      if (e.target.id === 'fd-prn-time') { st.time = e.target.value; redraw(); }
    });
  }

  function initPrn() {
    var root = $('#x-prn');
    if (!root) return;
    renderPrn();
    root.addEventListener('click', function (e) {
      if (e.target.closest('[data-act="prn"]')) { openWorkflow('prn'); return; }
      if (e.target.closest('[data-act="inj"]')) openWorkflow('inj');
    });
  }

  /* ---------- 4. x-nocrush 不可磨碎藥 ----------
     對照 pages/DrugDatabase.tsx cannot_crush 標記 */

  var noCrushList = [
    { drug: 'METOPROLOL SR 100MG', noCrush: true, name: '黃伯強', crush: false },
    { drug: 'ASPIRIN EC 100MG', noCrush: true, name: '李笑好', crush: false },
    { drug: 'METFORMIN 500MG', noCrush: false, name: '陳大文', crush: false },
    { drug: 'PARACETAMOL 500MG', noCrush: false, name: '周桂蘭', crush: false }
  ];

  function renderNoCrush() {
    var root = $('#x-nocrush');
    if (!root) return;
    var rows = noCrushList.map(function (r, i) {
      var html = '<tr' + (r.noCrush && r.crush ? ' class="bg-red-50"' : '') + '>' +
        td('<span class="font-medium text-gray-900">' + r.drug + '</span>') +
        td(r.noCrush ? badge('不可磨碎', 'red') : '<span class="text-gray-400">—</span>') +
        td(r.name) +
        '<td class="px-4 py-2.5"><label class="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">' +
        '<input type="checkbox" data-crush="' + i + '"' + (r.crush ? ' checked' : '') + ' class="rounded border-gray-300" />需要碎藥</label></td></tr>';
      if (r.noCrush && r.crush) {
        html += '<tr class="bg-red-50"><td colspan="4" class="px-4 py-2 text-sm text-red-700">' +
          '<span class="inline-flex items-center gap-1.5"><i data-lucide="alert-triangle" class="w-4 h-4"></i>' +
          '⚠ 緩釋藥不可磨碎：eMAR 及列印文件將顯示警示</span></td></tr>';
      }
      return html;
    }).join('');
    root.innerHTML = tableWrap(th('藥名') + th('標記') + th('院友') + th('碎藥'), rows);
    refreshIcons(root);
  }

  function initNoCrush() {
    var root = $('#x-nocrush');
    if (!root) return;
    renderNoCrush();
    root.addEventListener('change', function (e) {
      var cb = e.target.closest('[data-crush]');
      if (!cb) return;
      noCrushList[+cb.dataset.crush].crush = cb.checked;
      renderNoCrush();
    });
  }

  /* ---------- 5. x-rx-search 處方搜尋 ----------
     對照 MedicationWorkflow.tsx 處方篩選 */

  var rxSearchList = [
    { name: '陳大文', drug: 'METFORMIN 500MG', dose: '每日兩次 每次1粒', status: 'active', last: dateStr(-1) },
    { name: '黃伯強', drug: 'METOPROLOL 50MG', dose: '每日一次 每次1粒', status: 'active', last: dateStr(-1) },
    { name: '李笑好', drug: 'ASPIRIN 100MG', dose: '每日一次 每次1粒', status: 'pending', last: dateStr(-3) },
    { name: '周桂蘭', drug: 'SIMVASTATIN 20MG', dose: '每晚一次 每次1粒', status: 'stopped', last: dateStr(-14) },
    { name: '吳美玲', drug: 'AMLODIPINE 5MG', dose: '每日一次 每次1粒', status: 'active', last: dateStr(-1) },
    { name: '梁志偉', drug: 'INSULIN GLARGINE 10U', dose: '每日一次 皮下注射', status: 'active', last: dateStr(-1) }
  ];
  var rxSearchState = { q: '', status: 'all' };

  function renderRxSearch() {
    var root = $('#x-rx-search');
    if (!root) return;
    var q = rxSearchState.q.toLowerCase();
    var list = rxSearchList.filter(function (r) {
      if (rxSearchState.status !== 'all' && r.status !== rxSearchState.status) return false;
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.drug.toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var rows = list.length ? list.map(function (r) {
      return '<tr>' + td('<span class="font-medium text-gray-900">' + r.name + '</span>') +
        td(r.drug) + td(r.dose) + td(rxBadge(r.status)) + td(r.last) + '</tr>';
    }).join('') : '<tr><td colspan="5" class="px-4 py-6 text-center text-gray-400 text-sm">沒有符合條件的處方</td></tr>';
    root.innerHTML =
      '<div class="flex items-center gap-3 mb-3 flex-wrap">' +
      '<div class="relative flex-1 min-w-[200px]">' +
      '<i data-lucide="search" class="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"></i>' +
      '<input id="rx-q" class="form-input w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm" placeholder="搜尋院友或藥名…" value="' + rxSearchState.q + '" /></div>' +
      '<select id="rx-status" class="form-input rounded-lg border border-gray-300 px-3 py-2 text-sm">' +
      '<option value="all"' + (rxSearchState.status === 'all' ? ' selected' : '') + '>全部</option>' +
      '<option value="active"' + (rxSearchState.status === 'active' ? ' selected' : '') + '>在服</option>' +
      '<option value="pending"' + (rxSearchState.status === 'pending' ? ' selected' : '') + '>待變更</option>' +
      '<option value="stopped"' + (rxSearchState.status === 'stopped' ? ' selected' : '') + '>停用</option></select></div>' +
      tableWrap(th('院友') + th('藥名') + th('劑量') + th('狀態') + th('上次服用日期'), rows);
    refreshIcons(root);
    // 輸入時整區重繪會失去焦點，因此搜尋中重新聚焦並還原游標位置
    var input = $('#rx-q', root);
    if (rxSearchState.q) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }

  function initRxSearch() {
    var root = $('#x-rx-search');
    if (!root) return;
    renderRxSearch();
    root.addEventListener('input', function (e) {
      if (e.target.id === 'rx-q') { rxSearchState.q = e.target.value; renderRxSearch(); }
    });
    root.addEventListener('change', function (e) {
      if (e.target.id === 'rx-status') { rxSearchState.status = e.target.value; renderRxSearch(); }
    });
  }

  /* ============================================================
     treatment.html
     ============================================================ */

  /* ---------- 6. x-vmo VMO 醫生到診排程 ---------- */

  var vmoSchedules = [
    { id: 'v1', date: '2026-09-03', doctor: '梁醫生', open: false,
      queue: [
        { name: '陳大文', reason: '覆診', symptom: '血糖控制跟進' },
        { name: '黃伯強', reason: '新症', symptom: '氣促、輕微水腫' },
        { name: '李笑好', reason: '覆診', symptom: '血壓藥物調整' }
      ] },
    { id: 'v2', date: '2026-09-10', doctor: '陳醫生', open: false,
      queue: [
        { name: '周桂蘭', reason: '覆診', symptom: '膽固醇跟進' },
        { name: '吳美玲', reason: '新症', symptom: '頭暈、心悸' }
      ] }
  ];

  function renderVmo() {
    var root = $('#x-vmo');
    if (!root) return;
    root.innerHTML = vmoSchedules.map(function (s) {
      var html = '<div class="card overflow-hidden mb-4">' +
        '<button type="button" class="w-full flex items-center justify-between p-4 hover:bg-gray-50 text-left" data-vmo-toggle="' + s.id + '">' +
        '<div class="flex items-center gap-3">' +
        '<div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">' +
        '<i data-lucide="stethoscope" class="w-5 h-5 text-blue-600"></i></div>' +
        '<div><p class="font-semibold text-gray-900">' + s.date + ' ' + s.doctor + '</p>' +
        '<p class="text-xs text-gray-500">' + s.queue.length + ' 位院友候診</p></div></div>' +
        '<i data-lucide="chevron-' + (s.open ? 'up' : 'down') + '" class="w-5 h-5 text-gray-400"></i></button>';
      if (s.open) {
        var rows = s.queue.map(function (q) {
          return '<tr>' + td('<span class="font-medium text-gray-900">' + q.name + '</span>') +
            td(q.reason) + td(q.symptom) + '</tr>';
        }).join('');
        html += '<div class="border-t border-gray-100 p-4">' +
          tableWrap(th('院友') + th('看診原因') + th('症狀說明'), rows) +
          '<div class="flex gap-2 mt-4 justify-end">' +
          btnSecondary('<i data-lucide="printer" class="w-4 h-4"></i> 列印候診表', 'data-vmo-print="' + s.id + '"') +
          btnDanger('<i data-lucide="trash-2" class="w-4 h-4"></i> 刪除排程', 'data-vmo-del="' + s.id + '"') +
          '</div></div>';
      }
      return html + '</div>';
    }).join('');
    refreshIcons(root);
  }

  function confirmDeleteVmo(id) {
    var s = vmoSchedules.filter(function (x) { return x.id === id; })[0];
    if (!s) return;
    var m = openModal(
      '<div class="space-y-4">' +
      '<div class="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">' +
      '<i data-lucide="alert-triangle" class="w-4 h-4 flex-shrink-0"></i>此排程有 ' + s.queue.length + ' 位院友候診</div>' +
      '<p class="text-sm text-gray-700">確定刪除 <span class="font-semibold">' + s.date + ' ' + s.doctor + '</span> 的到診排程？此操作無法復原。</p>' +
      '<div class="flex justify-end gap-2 pt-2">' +
      btnSecondary('取消', 'data-act="cancel"') +
      btnDanger('確認刪除', 'data-act="ok"') + '</div></div>',
      { title: '刪除排程', width: 'sm' }
    );
    m.body.addEventListener('click', function (e) {
      var act = e.target.closest('[data-act]');
      if (!act) return;
      if (act.dataset.act === 'cancel') { m.close(); return; }
      vmoSchedules = vmoSchedules.filter(function (x) { return x.id !== id; });
      m.close(); renderVmo();
      toast('已刪除排程（示範）');
    });
  }

  function initVmo() {
    var root = $('#x-vmo');
    if (!root) return;
    renderVmo();
    root.addEventListener('click', function (e) {
      var toggle = e.target.closest('[data-vmo-toggle]');
      if (toggle) {
        var s = vmoSchedules.filter(function (x) { return x.id === toggle.dataset.vmoToggle; })[0];
        if (s) { s.open = !s.open; renderVmo(); }
        return;
      }
      var print = e.target.closest('[data-vmo-print]');
      if (print) { toast('已列印候診表（示範）'); return; }
      var del = e.target.closest('[data-vmo-del]');
      if (del) confirmDeleteVmo(del.dataset.vmoDel);
    });
  }

  /* ---------- 7. x-cgat CGAT 外展 ----------
     對照 pages/Cgat.tsx */

  var cgatList = [
    { name: '陳大文', drugEnd: dateStr(9), fee: '$150', waived: false, referral: '藥物覆診' },
    { name: '黃伯強', drugEnd: dateStr(25), fee: '$0', waived: true, referral: '新症評估' },
    { name: '吳美玲', drugEnd: dateStr(6), fee: '$150', waived: false, referral: '藥物覆診' },
    { name: '梁志偉', drugEnd: dateStr(40), fee: '$0', waived: true, referral: '糖尿跟進' }
  ];

  function renderCgat() {
    var root = $('#x-cgat');
    if (!root) return;
    var rows = cgatList.map(function (r) {
      var urgent = daysFromToday(r.drugEnd) < 14;
      return '<tr>' + td('<span class="font-medium text-gray-900">' + r.name + '</span>') +
        td(r.drugEnd, urgent ? 'text-red-600 font-semibold' : 'text-gray-700') +
        td(r.fee) +
        td(r.waived ? badge('已豁免', 'green') : badge('收費', 'yellow')) +
        td('<span class="inline-flex items-center gap-1 text-xs text-gray-600"><i data-lucide="file-text" class="w-3.5 h-3.5 text-gray-400"></i>' + r.referral + '</span>') +
        '</tr>';
    }).join('');
    root.innerHTML =
      tableWrap(th('院友') + th('藥完日期') + th('收費') + th('豁免') + th('轉介信原因'), rows) +
      '<div class="flex gap-2 mt-4 justify-end flex-wrap">' +
      btnSecondary('<i data-lucide="printer" class="w-4 h-4"></i> 列印診症名單', 'data-act="print-list"') +
      btnSecondary('<i data-lucide="printer" class="w-4 h-4"></i> 列印取藥委託書', 'data-act="print-proxy"') + '</div>';
    refreshIcons(root);
  }

  function initCgat() {
    var root = $('#x-cgat');
    if (!root) return;
    renderCgat();
    root.addEventListener('click', function (e) {
      if (e.target.closest('[data-act="print-list"]')) { toast('已列印診症名單（示範）'); return; }
      if (e.target.closest('[data-act="print-proxy"]')) toast('已列印取藥委託書（示範）');
    });
  }

  /* ============================================================
     compliance.html
     ============================================================ */

  /* ---------- 8. x-checkup 年度體檢 ----------
     對照 AnnualHealthCheckupModal.tsx */

  var checkups = [
    { name: '陳大文', signDate: addMonths(todayStr(), -13), dueDate: addMonths(todayStr(), -1) },
    { name: '黃伯強', signDate: addMonths(todayStr(), -11), dueDate: addMonths(todayStr(), 1) },
    { name: '李笑好', signDate: addMonths(todayStr(), -4), dueDate: addMonths(todayStr(), 8) },
    { name: '周桂蘭', signDate: addMonths(todayStr(), -12), dueDate: dateStr(20) }
  ];

  function checkupStatus(c) {
    var diff = daysFromToday(c.dueDate);
    if (diff < 0) return { label: '已逾期', color: 'red', renew: true };
    if (diff <= 60) return { label: '即將到期', color: 'orange', renew: true };
    return { label: '有效', color: 'green', renew: false };
  }

  function renderCheckup() {
    var root = $('#x-checkup');
    if (!root) return;
    var rows = checkups.map(function (c, i) {
      var st = checkupStatus(c);
      return '<tr>' + td('<span class="font-medium text-gray-900">' + c.name + '</span>') +
        td(c.signDate) + td(c.dueDate) + td(badge(st.label, st.color)) +
        '<td class="px-4 py-2.5"><div class="flex gap-2 flex-wrap">' +
        (st.renew
          ? btnPrimary('<i data-lucide="refresh-cw" class="w-4 h-4"></i> 一鍵續期', 'data-renew="' + i + '"')
          : '<button type="button" disabled class="btn-primary inline-flex items-center gap-1.5 opacity-50 cursor-not-allowed"><i data-lucide="refresh-cw" class="w-4 h-4"></i> 一鍵續期</button>') +
        btnSecondary('<i data-lucide="printer" class="w-4 h-4"></i> 列印', 'data-print="' + i + '"') +
        '</div></td></tr>';
    }).join('');
    root.innerHTML = tableWrap(th('院友') + th('醫生簽署日期') + th('下次到期日') + th('狀態') + th('操作'), rows);
    refreshIcons(root);
  }

  function initCheckup() {
    var root = $('#x-checkup');
    if (!root) return;
    renderCheckup();
    root.addEventListener('click', function (e) {
      var renew = e.target.closest('[data-renew]');
      if (renew) {
        var c = checkups[+renew.dataset.renew];
        c.signDate = todayStr();
        c.dueDate = addMonths(todayStr(), 12);
        renderCheckup();
        toast('已為 ' + c.name + ' 續期，下次到期日更新為一年後');
        return;
      }
      var print = e.target.closest('[data-print]');
      if (print) toast('已列印年度體檢表（示範）');
    });
  }

  /* ---------- 9. x-assess 健康評估 ----------
     對照 HealthAssessmentModal.tsx */

  var assessments = [
    { name: '陳大文', last: addMonths(todayStr(), -2), status: 'active' },
    { name: '黃伯強', last: addMonths(todayStr(), -5), status: 'active' },
    { name: '李笑好', last: addMonths(todayStr(), -7), status: 'active' },
    { name: '周桂蘭', last: addMonths(todayStr(), -9), status: 'archived' }
  ];

  function renderAssess() {
    var root = $('#x-assess');
    if (!root) return;
    root.innerHTML = '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">' +
      assessments.map(function (a, i) {
        var next = addMonths(a.last, 6);
        var overdue = daysFromToday(next) < 0;
        return '<div class="card p-5">' +
          '<div class="flex items-center justify-between mb-3">' +
          '<p class="font-semibold text-gray-900">' + a.name + ' <span class="text-xs text-gray-500 font-normal">' + res(a.name).bed + '</span></p>' +
          badge(a.status === 'active' ? '生效中' : '已封存', a.status === 'active' ? 'green' : 'gray') + '</div>' +
          '<div class="text-sm text-gray-600 space-y-1 mb-4">' +
          '<p>上次評估日期：<span class="text-gray-900">' + a.last + '</span></p>' +
          '<p>下次評估日期：<span class="' + (overdue ? 'text-red-600 font-semibold' : 'text-gray-900') + '">' + next + '</span>' +
          '<span class="text-xs text-gray-400">（系統自動推算 +6 個月）</span></p></div>' +
          '<div class="flex gap-2 flex-wrap">' +
          btnPrimary('<i data-lucide="copy" class="w-4 h-4"></i> 複製上次評估開新檔', 'data-copy="' + i + '"') +
          btnSecondary(a.status === 'active' ? '封存' : '重啟', 'data-toggle="' + i + '"') +
          '</div></div>';
      }).join('') + '</div>';
    refreshIcons(root);
  }

  function initAssess() {
    var root = $('#x-assess');
    if (!root) return;
    renderAssess();
    root.addEventListener('click', function (e) {
      var copy = e.target.closest('[data-copy]');
      if (copy) { toast('已複製上次評估，請更新後儲存'); return; }
      var toggle = e.target.closest('[data-toggle]');
      if (toggle) {
        var a = assessments[+toggle.dataset.toggle];
        a.status = a.status === 'active' ? 'archived' : 'active';
        renderAssess();
        toast(a.status === 'archived' ? '已封存 ' + a.name + ' 的評估' : '已重啟 ' + a.name + ' 的評估');
      }
    });
  }

  /* ---------- 10. x-icp ICP 問題庫 ---------- */

  var ICP_DISCIPLINES = ['護理', '醫療', '物理治療', '職業治療', '營養', '社工', '藥劑'];

  var ICP_PROBLEMS = {
    '護理': [{ p: '跌倒風險', n: 12 }, { p: '壓瘡風險', n: 6 }, { p: '吞嚥困難', n: 8 }, { p: '失禁護理', n: 10 }],
    '醫療': [{ p: '高血壓控制', n: 15 }, { p: '糖尿病管理', n: 9 }, { p: '痛症管理', n: 7 }],
    '物理治療': [{ p: '活動能力下降', n: 11 }, { p: '肌力訓練需要', n: 8 }, { p: '步態不穩', n: 5 }],
    '職業治療': [{ p: '自理能力下降', n: 9 }, { p: '認知訓練需要', n: 6 }, { p: '輔助器具評估', n: 4 }],
    '營養': [{ p: '營養不良風險', n: 7 }, { p: '體重下降', n: 5 }, { p: '特別餐需要', n: 8 }],
    '社工': [{ p: '情緒支援需要', n: 6 }, { p: '家庭關係支援', n: 4 }, { p: '院舍適應', n: 3 }],
    '藥劑': [{ p: '多重用藥', n: 13 }, { p: '藥物依從性', n: 8 }, { p: '藥物副作用監察', n: 5 }]
  };

  var icpReviewDue = [
    { name: '黃伯強', due: dateStr(-5) },
    { name: '李笑好', due: dateStr(-2) },
    { name: '陳大文', due: dateStr(12) }
  ];

  var icpSelected = '護理';

  function renderIcp() {
    var root = $('#x-icp');
    if (!root) return;
    var chips = ICP_DISCIPLINES.map(function (d) {
      var active = d === icpSelected;
      return '<button type="button" data-disc="' + d + '" class="px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ' +
        (active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50') + '">' + d + '</button>';
    }).join('');
    var problems = (ICP_PROBLEMS[icpSelected] || []).map(function (x) {
      return '<li class="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">' +
        '<span class="text-sm text-gray-800">' + x.p + '</span>' +
        badge(x.n + ' 位院友使用', 'blue') + '</li>';
    }).join('');
    var dueList = icpReviewDue.map(function (r) {
      var overdue = daysFromToday(r.due) < 0;
      return '<li class="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">' +
        '<span class="text-sm font-medium text-gray-800">' + r.name + '</span>' +
        '<span class="text-xs ' + (overdue ? 'text-red-600 font-semibold' : 'text-gray-500') + '">' + r.due + (overdue ? ' 已到期' : '') + '</span></li>';
    }).join('');
    root.innerHTML =
      '<div class="grid grid-cols-1 lg:grid-cols-3 gap-4">' +
      '<div class="lg:col-span-2 card p-5">' +
      '<div class="flex flex-wrap gap-2 mb-4">' + chips + '</div>' +
      '<h4 class="text-sm font-medium text-gray-700 mb-1">' + icpSelected + ' · 常見問題</h4>' +
      '<ul>' + problems + '</ul></div>' +
      '<div class="card p-5">' +
      '<h4 class="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">' +
      '<i data-lucide="calendar-clock" class="w-4 h-4 text-red-500"></i>復檢到期</h4>' +
      '<ul>' + dueList + '</ul></div></div>';
    refreshIcons(root);
  }

  function initIcp() {
    var root = $('#x-icp');
    if (!root) return;
    renderIcp();
    root.addEventListener('click', function (e) {
      var chip = e.target.closest('[data-disc]');
      if (!chip) return;
      icpSelected = chip.dataset.disc;
      renderIcp();
    });
  }

  /* ---------- 11. x-restraint 約束物品 ----------
     對照 RestraintAssessmentModal.tsx */

  var restraints = [
    { name: '張金好', item: '安全背心', signDate: addMonths(todayStr(), -7), dueDate: addMonths(todayStr(), -1) },
    { name: '梁志偉', item: '床欄（全欄）', signDate: addMonths(todayStr(), -8), dueDate: dateStr(-10) },
    { name: '黃伯強', item: '約束手套', signDate: addMonths(todayStr(), -3), dueDate: addMonths(todayStr(), 3) }
  ];

  function renderRestraint() {
    var root = $('#x-restraint');
    if (!root) return;
    var expiredCount = restraints.filter(function (r) { return daysFromToday(r.dueDate) < 0; }).length;
    var rows = restraints.map(function (r, i) {
      var expired = daysFromToday(r.dueDate) < 0;
      return '<tr>' + td('<span class="font-medium text-gray-900">' + r.name + '</span>') +
        td(r.item) + td(r.signDate) +
        td(r.dueDate, expired ? 'text-red-600 font-semibold' : 'text-gray-700') +
        td(expired ? badge('已到期', 'red') : badge('有效', 'green')) +
        '<td class="px-4 py-2.5">' + btnSecondary('<i data-lucide="printer" class="w-4 h-4"></i> 列印觀察記錄表', 'data-print="' + i + '"') + '</td></tr>';
    }).join('');
    root.innerHTML =
      '<div class="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm font-medium rounded-lg px-4 py-3 mb-4">' +
      '<i data-lucide="alert-triangle" class="w-4 h-4 flex-shrink-0"></i>' + expiredCount + ' 份約束同意書已到期，請盡快安排醫生重新簽署</div>' +
      tableWrap(th('院友') + th('約束物品') + th('醫生簽署日期') + th('到期日') + th('狀態') + th('操作'), rows);
    refreshIcons(root);
  }

  function initRestraint() {
    var root = $('#x-restraint');
    if (!root) return;
    renderRestraint();
    root.addEventListener('click', function (e) {
      if (e.target.closest('[data-print]')) toast('已列印約束觀察記錄表（示範）');
    });
  }

  /* ============================================================
     初始化
     ============================================================ */

  function init() {
    initRxOcr();
    initSafety();
    initPrn();
    initNoCrush();
    initRxSearch();
    initVmo();
    initCgat();
    initCheckup();
    initAssess();
    initIcp();
    initRestraint();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
