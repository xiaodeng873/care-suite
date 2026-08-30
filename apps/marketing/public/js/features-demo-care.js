/* ============================================================
   features-demo-care.js — 院友 / 床位 / 記錄功能頁互動示範
   100% 前端、無框架、無網絡請求。所有數據均為虛構。
   視覺對照 apps/web/src/ 真實頁面（DischargeModal、
   PatientQRCodeModal、PatientContactsSection、
   StationBedManagement、BedTransferLogModal、
   HealthRecordModal、VaccinationRecordModal），
   使用 Tailwind CSS class 與 Lucide icons 重建 webapp 介面。
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

  /* ============================================================
     residents.html
     ============================================================ */

  /* ---------- 1. 退住管理（對照 DischargeModal.tsx） ---------- */

  var dischargeRows = [
    { name: '陳大文', bed: '101-A', admit: '2023-11-02', discharged: false },
    { name: '李笑好', bed: '101-B', admit: '2024-02-14', discharged: false },
    { name: '黃伯強', bed: '102-A', admit: '2022-06-30', discharged: false },
    { name: '周桂蘭', bed: '102-B', admit: '2025-01-09', discharged: false },
    { name: '吳美玲', bed: '103-A', admit: '2024-09-21', discharged: false }
  ];

  function daysBetween(iso) {
    var from = new Date(iso + 'T00:00:00');
    var to = new Date(todayStr() + 'T00:00:00');
    return Math.max(0, Math.round((to - from) / 86400000));
  }

  function renderDischarge() {
    var root = $('#x-discharge');
    if (!root) return;
    var rows = dischargeRows.map(function (r, i) {
      var avatar = '<span class="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold flex-shrink-0">' + r.name.charAt(0) + '</span>';
      return '<tr class="border-b border-gray-100 ' + (r.discharged ? 'opacity-60' : '') + '">' +
        '<td class="py-2.5 pr-3"><div class="flex items-center gap-2.5">' + avatar +
        '<span class="font-medium text-gray-900">' + r.name + '</span></div></td>' +
        '<td class="py-2.5 pr-3 text-sm text-gray-600">' + r.bed + '</td>' +
        '<td class="py-2.5 pr-3 text-sm text-gray-600">' + r.admit + '</td>' +
        '<td class="py-2.5 pr-3 text-sm text-gray-600">' + daysBetween(r.admit) + ' 天</td>' +
        '<td class="py-2.5 pr-3">' + (r.discharged ? badge('已退住', 'gray') : badge('在住', 'green')) + '</td>' +
        '<td class="py-2.5 text-right">' + (r.discharged ? '' : btnDanger('<i data-lucide="log-out" class="w-4 h-4"></i> 退住', 'data-row="' + i + '"')) + '</td></tr>';
    }).join('');
    root.innerHTML =
      '<div class="card overflow-x-auto"><table class="w-full min-w-[640px] text-left">' +
      '<thead><tr class="border-b border-gray-200 text-xs text-gray-500 uppercase">' +
      '<th class="py-2 pr-3 font-medium">院友</th><th class="py-2 pr-3 font-medium">床號</th>' +
      '<th class="py-2 pr-3 font-medium">入住日期</th><th class="py-2 pr-3 font-medium">在住天數</th>' +
      '<th class="py-2 pr-3 font-medium">狀態</th><th class="py-2 font-medium text-right">操作</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>';
    refreshIcons(root);
    root.onclick = function (e) {
      var btn = e.target.closest('[data-row]');
      if (!btn) return;
      openDischargeModal(dischargeRows[Number(btn.dataset.row)]);
    };
  }

  function openDischargeModal(row) {
    var m = openModal(
      '<div class="space-y-4">' +
      '<div class="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">' +
      '<span class="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold">' + row.name.charAt(0) + '</span>' +
      '<div><p class="font-medium text-gray-900">' + row.name + '</p><p class="text-xs text-gray-500">床號 ' + row.bed + ' · 入住 ' + row.admit + '</p></div></div>' +
      '<div><label class="form-label block text-sm font-medium text-gray-700 mb-1">退住原因</label>' +
      '<select id="dc-reason" class="form-input w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">' +
      '<option>死亡</option><option>遷出</option><option>轉院</option><option>其他</option></select></div>' +
      '<div><label class="form-label block text-sm font-medium text-gray-700 mb-1">退住日期</label>' +
      '<input type="date" id="dc-date" class="form-input w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value="' + todayStr() + '"/></div>' +
      '<p class="text-xs text-gray-500 flex items-start gap-1.5"><i data-lucide="info" class="w-4 h-4 flex-shrink-0 mt-0.5"></i>' +
      '退住後系統會自動取消日後醫生到診排程，並閉合未完成的住院事件。</p>' +
      '<div class="flex justify-end gap-2 pt-2">' + btnSecondary('取消', 'data-act="cancel"') +
      btnDanger('<i data-lucide="log-out" class="w-4 h-4"></i> 確認退住', 'data-act="ok"') + '</div></div>',
      { title: '辦理退住 — ' + row.name, width: 'md' }
    );
    m.body.addEventListener('click', function (e) {
      var act = e.target.closest('[data-act]');
      if (!act) return;
      if (act.dataset.act === 'cancel') { m.close(); return; }
      row.discharged = true;
      m.close();
      renderDischarge();
      toast('已退住：已自動取消日後醫生到診排程並閉合住院事件');
    });
  }

  function initDischarge() { renderDischarge(); }

  /* ---------- 2. 院友 QR Code（對照 PatientQRCodeModal.tsx） ---------- */

  function fakeQrGrid() {
    var cells = '';
    for (var i = 0; i < 441; i++) {
      cells += '<span style="display:block;width:100%;padding-bottom:100%;background:' + (Math.random() < 0.45 ? '#111827' : '#ffffff') + '"></span>';
    }
    return '<div style="display:grid;grid-template-columns:repeat(21,1fr);gap:0;width:210px;height:210px;border:8px solid #fff;box-shadow:0 0 0 1px #e5e7eb" class="rounded">' + cells + '</div>';
  }

  function renderResidentQr() {
    var root = $('#x-resident-qr');
    if (!root) return;
    var r = res('陳大文');
    root.innerHTML =
      '<div class="card flex flex-col sm:flex-row sm:items-center gap-4">' +
      '<div class="flex items-center gap-3 flex-1">' +
      '<span class="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-lg font-semibold">' + r.name.charAt(0) + '</span>' +
      '<div><p class="font-semibold text-gray-900">' + r.name + '</p>' +
      '<p class="text-sm text-gray-500">床號 ' + r.bed + ' · ' + r.idc + '</p></div></div>' +
      '<div class="flex flex-wrap gap-2">' +
      btnPrimary('<i data-lucide="qr-code" class="w-4 h-4"></i> 生成 QR Code', 'data-act="qr"') +
      btnSecondary('<i data-lucide="scan-line" class="w-4 h-4"></i> 掃描院友 QR 確認身份', 'data-act="scan"') +
      '</div></div>';
    refreshIcons(root);
    root.onclick = function (e) {
      var act = e.target.closest('[data-act]');
      if (!act) return;
      if (act.dataset.act === 'scan') {
        fakeScan('掃描院友 QR Code', function () { toast('已確認身份：陳大文（101-A）'); });
        return;
      }
      var m = openModal(
        '<div class="flex flex-col items-center gap-4 py-2">' + fakeQrGrid() +
        '<div class="text-center"><p class="font-semibold text-gray-900">' + r.name + '</p>' +
        '<p class="text-sm text-gray-500">床號 ' + r.bed + '</p></div>' +
        '<div class="flex gap-2">' + btnSecondary('<i data-lucide="download" class="w-4 h-4"></i> 下載 PNG', 'data-act="dl"') + '</div></div>',
        { title: '院友 QR Code', width: 'sm' }
      );
      m.body.addEventListener('click', function (ev) {
        if (ev.target.closest('[data-act="dl"]')) { m.close(); toast('已下載 QR Code（示範）'); }
      });
    };
  }

  function initResidentQr() { renderResidentQr(); }

  /* ---------- 3. 聯絡人 + WhatsApp（對照 PatientContactsSection.tsx） ---------- */

  var CONTACTS = [
    { resident: '陳大文', name: '陳小明', relation: '兒子', phone: '9123 4567' },
    { resident: '李笑好', name: '李婉婷', relation: '女兒', phone: '9234 5678' },
    { resident: '黃伯強', name: '黃志豪', relation: '孫兒', phone: '9345 6789' },
    { resident: '周桂蘭', name: '周太', relation: '弟婦', phone: '9456 7890' },
    { resident: '吳美玲', name: '吳國樑', relation: '弟弟', phone: '9567 8901' }
  ];

  function renderContacts() {
    var root = $('#x-contacts');
    if (!root) return;
    var rows = CONTACTS.map(function (c, i) {
      return '<tr class="border-b border-gray-100">' +
        '<td class="py-2.5 pr-3 font-medium text-gray-900">' + c.resident + '</td>' +
        '<td class="py-2.5 pr-3 text-sm text-gray-700">' + c.name + '</td>' +
        '<td class="py-2.5 pr-3 text-sm text-gray-600">' + c.relation + '</td>' +
        '<td class="py-2.5 pr-3 text-sm text-gray-600">' + c.phone + '</td>' +
        '<td class="py-2.5 text-right">' + btnSuccess('<i data-lucide="message-circle" class="w-4 h-4"></i> WhatsApp', 'data-row="' + i + '"') + '</td></tr>';
    }).join('');
    root.innerHTML =
      '<div class="card overflow-x-auto"><table class="w-full min-w-[560px] text-left">' +
      '<thead><tr class="border-b border-gray-200 text-xs text-gray-500 uppercase">' +
      '<th class="py-2 pr-3 font-medium">院友</th><th class="py-2 pr-3 font-medium">聯絡人</th>' +
      '<th class="py-2 pr-3 font-medium">關係</th><th class="py-2 pr-3 font-medium">電話</th>' +
      '<th class="py-2 font-medium text-right">操作</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>';
    refreshIcons(root);
    root.onclick = function (e) {
      var btn = e.target.closest('[data-row]');
      if (!btn) return;
      openWhatsAppModal(CONTACTS[Number(btn.dataset.row)]);
    };
  }

  function openWhatsAppModal(c) {
    var msg = c.resident + '家屬您好，這裡是安心護老院。' + c.resident + '近日身體狀況穩定，如有查詢歡迎致電本院。謝謝！';
    var m = openModal(
      '<div class="space-y-4">' +
      '<p class="text-sm text-gray-600">預填訊息將發送給 <span class="font-medium text-gray-900">' + c.name + '</span>（' + c.relation + ' · ' + c.phone + '）：</p>' +
      '<textarea id="wa-msg" rows="4" class="form-input w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">' + msg + '</textarea>' +
      '<div class="flex justify-end gap-2 pt-1">' + btnSecondary('取消', 'data-act="cancel"') +
      btnPrimary('<i data-lucide="copy" class="w-4 h-4"></i> 複製訊息', 'data-act="copy"') + '</div></div>',
      { title: 'WhatsApp 聯絡家屬', width: 'md' }
    );
    m.body.addEventListener('click', function (e) {
      var act = e.target.closest('[data-act]');
      if (!act) return;
      if (act.dataset.act === 'cancel') { m.close(); return; }
      var text = $('#wa-msg', m.body).value;
      function done() { m.close(); toast('已複製，可貼到 WhatsApp'); }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
      } else {
        fallbackCopy(text); done();
      }
    });
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (err) { /* 示範環境忽略 */ }
    ta.remove();
  }

  function initContacts() { renderContacts(); }

  /* ---------- 4. 藥物敏感篩選 + CSV ---------- */

  var ALLERGIES = [
    { name: '陳大文', bed: '101-A', drugs: ['青霉素', '磺胺類'] },
    { name: '李笑好', bed: '101-B', drugs: ['阿司匹林'] },
    { name: '黃伯強', bed: '102-A', drugs: ['青霉素'] },
    { name: '周桂蘭', bed: '102-B', drugs: ['布洛芬', '青霉素'] },
    { name: '吳美玲', bed: '103-A', drugs: ['四環素'] },
    { name: '梁志偉', bed: '201-A', drugs: ['青霉素', '造影劑'] }
  ];

  function renderAllergy() {
    var root = $('#x-allergy');
    if (!root) return;
    var q = ($('#allergy-q', root) ? $('#allergy-q', root).value : '').trim();
    var list = ALLERGIES.filter(function (a) {
      if (!q) return true;
      return a.drugs.some(function (d) { return d.indexOf(q) !== -1; });
    });
    var rows = list.map(function (a) {
      var drugs = a.drugs.map(function (d) { return badge(d, 'red'); }).join(' ');
      return '<tr class="border-b border-gray-100">' +
        '<td class="py-2.5 pr-3"><input type="checkbox" class="allergy-check w-4 h-4 rounded border-gray-300 text-blue-600" checked /></td>' +
        '<td class="py-2.5 pr-3 font-medium text-gray-900">' + a.name + '</td>' +
        '<td class="py-2.5 pr-3 text-sm text-gray-600">' + a.bed + '</td>' +
        '<td class="py-2.5"><div class="flex flex-wrap gap-1">' + drugs + '</div></td></tr>';
    }).join('');
    if (!list.length) rows = '<tr><td colspan="4" class="py-6 text-center text-sm text-gray-400">沒有院友對「' + q + '」有敏感記錄。</td></tr>';
    root.innerHTML =
      '<div class="card space-y-4">' +
      '<div class="flex flex-col sm:flex-row gap-3 sm:items-center">' +
      '<div class="relative flex-1"><i data-lucide="search" class="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"></i>' +
      '<input id="allergy-q" class="form-input w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm" placeholder="輸入敏感藥名，例如：青霉素" value="' + q.replace(/"/g, '&quot;') + '"/></div>' +
      btnPrimary('<i data-lucide="file-spreadsheet" class="w-4 h-4"></i> 匯出 CSV', 'data-act="csv"') + '</div>' +
      '<div class="overflow-x-auto"><table class="w-full min-w-[480px] text-left">' +
      '<thead><tr class="border-b border-gray-200 text-xs text-gray-500 uppercase">' +
      '<th class="py-2 pr-3 font-medium w-10"></th><th class="py-2 pr-3 font-medium">院友</th>' +
      '<th class="py-2 pr-3 font-medium">床號</th><th class="py-2 font-medium">敏感藥物</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div></div>';
    refreshIcons(root);
    var input = $('#allergy-q', root);
    input.addEventListener('input', function () {
      var pos = input.selectionStart;
      renderAllergy();
      var ni = $('#allergy-q', root);
      ni.focus();
      try { ni.setSelectionRange(pos, pos); } catch (err) { /* ignore */ }
    });
    root.onclick = function (e) {
      if (!e.target.closest('[data-act="csv"]')) return;
      var n = $$('.allergy-check', root).filter(function (c) { return c.checked; }).length;
      toast('已匯出 ' + n + ' 位院友（示範）');
    };
  }

  function initAllergy() { renderAllergy(); }

  /* ============================================================
     beds.html
     ============================================================ */

  /* ---------- 5. 全局過濾（對照 StationBedManagement.tsx） ---------- */

  var STATION_BEDS = [
    { station: 'A站', bed: '101-A', room: '101', name: '陳大文', status: '佔用' },
    { station: 'A站', bed: '101-B', room: '101', name: '李笑好', status: '佔用' },
    { station: 'A站', bed: '102-A', room: '102', name: '黃伯強', status: '佔用' },
    { station: 'A站', bed: '102-B', room: '102', name: '', status: '空置' },
    { station: 'B站', bed: '201-A', room: '201', name: '梁志偉', status: '佔用' },
    { station: 'B站', bed: '201-B', room: '201', name: '', status: '預留' },
    { station: 'B站', bed: '202-A', room: '202', name: '林淑芬', status: '佔用' },
    { station: 'C站', bed: '301-A', room: '301', name: '張金好', status: '佔用' },
    { station: 'C站', bed: '301-B', room: '301', name: '', status: '空置' },
    { station: 'C站', bed: '302-A', room: '302', name: '吳美玲', status: '佔用' }
  ];

  var BED_STATUS_COLOR = { '佔用': 'green', '空置': 'gray', '預留': 'yellow' };

  function renderStationFilter() {
    var root = $('#x-station-filter');
    if (!root) return;
    var sel = $('#station-sel', root);
    var val = sel ? sel.value : '全部';
    var list = STATION_BEDS.filter(function (b) { return val === '全部' || b.station === val; });
    var items = list.map(function (b) {
      return '<div class="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50">' +
        '<span class="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0"><i data-lucide="bed" class="w-4 h-4"></i></span>' +
        '<div class="flex-1 min-w-0"><p class="font-medium text-gray-900 text-sm">' + b.bed +
        (b.name ? ' · ' + b.name : '') + '</p><p class="text-xs text-gray-500">房間 ' + b.room + '</p></div>' +
        badge(b.status, BED_STATUS_COLOR[b.status] || 'gray') + '</div>';
    }).join('');
    root.innerHTML =
      '<div class="card space-y-4">' +
      '<div class="flex flex-col sm:flex-row sm:items-center gap-3">' +
      '<div class="flex items-center gap-2"><i data-lucide="filter" class="w-4 h-4 text-gray-500"></i>' +
      '<label class="form-label text-sm font-medium text-gray-700">居住區</label></div>' +
      '<select id="station-sel" class="form-input rounded-lg border border-gray-300 px-3 py-2 text-sm w-full sm:w-48">' +
      ['全部', 'A站', 'B站', 'C站'].map(function (s) {
        return '<option' + (s === val ? ' selected' : '') + '>' + s + '</option>';
      }).join('') + '</select>' +
      '<p class="text-sm text-gray-500 sm:ml-auto">已過濾：' + val + '（' + list.length + ' 張床）</p></div>' +
      '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' + items + '</div></div>';
    refreshIcons(root);
    $('#station-sel', root).addEventListener('change', renderStationFilter);
  }

  function initStationFilter() { renderStationFilter(); }

  /* ---------- 6. 床位調動日誌（對照 BedTransferLogModal.tsx） ---------- */

  var BED_LOG_TYPES = [
    ['all', '全部'], ['入住', '入住'], ['退住', '退住'], ['常規調動', '常規調動'], ['暫時調動', '暫時調動']
  ];
  var BED_LOG_COLOR = { '入住': 'green', '退住': 'gray', '常規調動': 'blue', '暫時調動': 'orange' };

  var BED_LOGS = [
    { dt: '2025-06-18 10:24', name: '陳大文', from: '101-A', to: '102-B', type: '常規調動', op: '陳護士' },
    { dt: '2025-06-15 14:02', name: '梁志偉', from: '—', to: '201-A', type: '入住', op: '黃姑娘' },
    { dt: '2025-06-12 09:47', name: '張金好', from: '203-A', to: '301-A', type: '暫時調動', op: '陳護士' },
    { dt: '2025-06-10 16:30', name: '趙永康', from: '102-B', to: '—', type: '退住', op: '黃姑娘' },
    { dt: '2025-06-08 11:15', name: '林淑芬', from: '202-B', to: '202-A', type: '常規調動', op: '陳護士' },
    { dt: '2025-06-05 15:40', name: '周桂蘭', from: '102-B', to: '103-B', type: '暫時調動', op: '李護士' }
  ];

  var bedLogFilter = 'all';

  function renderBedLog() {
    var root = $('#x-bed-log');
    if (!root) return;
    var chips = BED_LOG_TYPES.map(function (t) {
      var on = bedLogFilter === t[0];
      return '<button type="button" data-chip="' + t[0] + '" class="px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ' +
        (on ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50') + '">' + t[1] + '</button>';
    }).join('');
    var list = BED_LOGS.filter(function (l) { return bedLogFilter === 'all' || l.type === bedLogFilter; });
    var rows = list.map(function (l) {
      return '<tr class="border-b border-gray-100">' +
        '<td class="py-2.5 pr-3 text-sm text-gray-600 whitespace-nowrap">' + l.dt + '</td>' +
        '<td class="py-2.5 pr-3 font-medium text-gray-900">' + l.name + '</td>' +
        '<td class="py-2.5 pr-3 text-sm text-gray-700 whitespace-nowrap">' + l.from +
        ' <i data-lucide="arrow-right" class="w-3.5 h-3.5 inline text-gray-400"></i> ' + l.to + '</td>' +
        '<td class="py-2.5 pr-3">' + badge(l.type, BED_LOG_COLOR[l.type]) + '</td>' +
        '<td class="py-2.5 text-sm text-gray-600">' + l.op + '</td></tr>';
    }).join('');
    if (!list.length) rows = '<tr><td colspan="5" class="py-6 text-center text-sm text-gray-400">沒有相關記錄。</td></tr>';
    root.innerHTML =
      '<div class="card space-y-4">' +
      '<div class="flex flex-wrap gap-2">' + chips + '</div>' +
      '<div class="overflow-x-auto"><table class="w-full min-w-[600px] text-left">' +
      '<thead><tr class="border-b border-gray-200 text-xs text-gray-500 uppercase">' +
      '<th class="py-2 pr-3 font-medium">日期時間</th><th class="py-2 pr-3 font-medium">院友</th>' +
      '<th class="py-2 pr-3 font-medium">床位調動</th><th class="py-2 pr-3 font-medium">性質</th>' +
      '<th class="py-2 font-medium">操作者</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div></div>';
    refreshIcons(root);
    root.onclick = function (e) {
      var chip = e.target.closest('[data-chip]');
      if (!chip) return;
      bedLogFilter = chip.dataset.chip;
      renderBedLog();
    };
  }

  function initBedLog() { renderBedLog(); }

  /* ---------- 7. 出院院友最後站點 ---------- */

  var LAST_BEDS = [
    { name: '趙永康', station: 'A站', bed: '102-B', date: '2025-06-10', reason: '遷出' },
    { name: '孫麗珍', station: 'B站', bed: '201-B', date: '2025-05-28', reason: '轉院' },
    { name: '馬建成', station: 'C站', bed: '301-B', date: '2025-05-15', reason: '死亡' },
    { name: '鄧秀雲', station: 'A站', bed: '103-B', date: '2025-04-30', reason: '其他' }
  ];

  function renderLastBed() {
    var root = $('#x-last-bed');
    if (!root) return;
    var rows = LAST_BEDS.map(function (l) {
      return '<tr class="border-b border-gray-100">' +
        '<td class="py-2.5 pr-3 font-medium text-gray-900">' + l.name + '</td>' +
        '<td class="py-2.5 pr-3 text-sm text-gray-600">' + l.station + '</td>' +
        '<td class="py-2.5 pr-3 text-sm text-gray-600">' + l.bed + '</td>' +
        '<td class="py-2.5 pr-3 text-sm text-gray-600">' + l.date + '</td>' +
        '<td class="py-2.5">' + badge(l.reason, l.reason === '死亡' ? 'gray' : (l.reason === '轉院' ? 'blue' : 'yellow')) + '</td></tr>';
    }).join('');
    root.innerHTML =
      '<div class="card overflow-x-auto"><table class="w-full min-w-[520px] text-left">' +
      '<thead><tr class="border-b border-gray-200 text-xs text-gray-500 uppercase">' +
      '<th class="py-2 pr-3 font-medium">姓名</th><th class="py-2 pr-3 font-medium">最後居住區</th>' +
      '<th class="py-2 pr-3 font-medium">最後床位</th><th class="py-2 pr-3 font-medium">退住日期</th>' +
      '<th class="py-2 font-medium">退住原因</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>';
    refreshIcons(root);
  }

  function initLastBed() { renderLastBed(); }

  /* ============================================================
     records.html
     ============================================================ */

  /* ---------- 8. 體重變化（對照 HealthRecordModal.tsx） ---------- */

  var WEIGHTS = {
    '陳大文': [
      { date: '2025-04-15', kg: 62.4 },
      { date: '2025-05-15', kg: 61.8 },
      { date: '2025-06-15', kg: 58.5 }
    ],
    '李笑好': [
      { date: '2025-04-15', kg: 55.2 },
      { date: '2025-05-15', kg: 55.6 },
      { date: '2025-06-15', kg: 55.1 }
    ],
    '黃伯強': [
      { date: '2025-04-15', kg: 68.0 },
      { date: '2025-05-15', kg: 67.2 },
      { date: '2025-06-15', kg: 66.9 }
    ]
  };

  function renderWeight() {
    var root = $('#x-weight');
    if (!root) return;
    var sel = $('#weight-res', root);
    var name = sel ? sel.value : '陳大文';
    var entries = WEIGHTS[name] || [];
    var rows = entries.map(function (w, i) {
      var prev = i > 0 ? entries[i - 1].kg : null;
      var pct = prev ? ((w.kg - prev) / prev) * 100 : null;
      var danger = pct !== null && pct <= -5;
      return '<tr class="border-b border-gray-100 ' + (danger ? 'bg-red-50' : '') + '">' +
        '<td class="py-2.5 pr-3 text-sm text-gray-600">' + w.date + '</td>' +
        '<td class="py-2.5 pr-3 font-medium text-gray-900">' + w.kg.toFixed(1) + ' kg</td>' +
        '<td class="py-2.5 pr-3 text-sm ' + (pct === null ? 'text-gray-400' : (pct < 0 ? 'text-red-600 font-medium' : 'text-green-600')) + '">' +
        (pct === null ? '—' : (pct > 0 ? '+' : '') + pct.toFixed(1) + '%') + '</td>' +
        '<td class="py-2.5">' + (danger ? '<span class="status-badge bg-red-100 text-red-800">跌逾 5%，需徵詢醫護意見</span>' : '') + '</td></tr>';
    }).join('');
    root.innerHTML =
      '<div class="card space-y-4">' +
      '<div class="flex items-center gap-3 flex-wrap">' +
      '<label class="form-label text-sm font-medium text-gray-700">院友</label>' +
      '<select id="weight-res" class="form-input rounded-lg border border-gray-300 px-3 py-2 text-sm w-40">' +
      Object.keys(WEIGHTS).map(function (n) {
        return '<option' + (n === name ? ' selected' : '') + '>' + n + '</option>';
      }).join('') + '</select></div>' +
      '<div class="overflow-x-auto"><table class="w-full min-w-[560px] text-left">' +
      '<thead><tr class="border-b border-gray-200 text-xs text-gray-500 uppercase">' +
      '<th class="py-2 pr-3 font-medium">日期</th><th class="py-2 pr-3 font-medium">體重</th>' +
      '<th class="py-2 pr-3 font-medium">與上次比較</th><th class="py-2 font-medium">提示</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div></div>';
    refreshIcons(root);
    $('#weight-res', root).addEventListener('change', renderWeight);
  }

  function initWeight() { renderWeight(); }

  /* ---------- 9. 床頭記錄六大類 ---------- */

  var BEDSIDE_TABS = [
    ['巡房', '巡房觀察，一切正常'],
    ['換片', '背部敷料更換，傷口無滲液'],
    ['出入量', '早餐進食全份，飲水 200ml'],
    ['約束觀察', '約束帶固定妥當，皮膚完整'],
    ['轉身', '協助左側臥位轉身'],
    ['衛生', '床上浴及口腔清潔完成']
  ];

  var bedsideRecords = {
    '巡房': [{ time: '08:15', name: '陳大文', note: '晨早巡房，精神良好', by: '陳護士' }],
    '換片': [{ time: '09:30', name: '黃伯強', note: '背部敷料更換，傷口無滲液', by: '李護士' }],
    '出入量': [{ time: '08:45', name: '李笑好', note: '早餐進食全份，飲水 200ml', by: '陳護士' }],
    '約束觀察': [{ time: '10:00', name: '梁志偉', note: '約束帶固定妥當，皮膚完整', by: '黃姑娘' }],
    '轉身': [{ time: '10:30', name: '張金好', note: '協助左側臥位轉身', by: '陳護士' }],
    '衛生': [{ time: '07:50', name: '吳美玲', note: '床上浴及口腔清潔完成', by: '李護士' }]
  };

  var bedsideTab = '巡房';

  function renderBedside() {
    var root = $('#x-bedside');
    if (!root) return;
    var tabs = BEDSIDE_TABS.map(function (t) {
      var on = bedsideTab === t[0];
      return '<button type="button" data-tab="' + t[0] + '" class="px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ' +
        (on ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50') + '">' + t[0] + '</button>';
    }).join('');
    var list = bedsideRecords[bedsideTab] || [];
    var rows = list.map(function (r) {
      return '<tr class="border-b border-gray-100">' +
        '<td class="py-2.5 pr-3 text-sm text-gray-600 whitespace-nowrap">' + r.time + '</td>' +
        '<td class="py-2.5 pr-3 font-medium text-gray-900">' + r.name + '</td>' +
        '<td class="py-2.5 pr-3 text-sm text-gray-700">' + r.note + '</td>' +
        '<td class="py-2.5 text-sm text-gray-600">' + r.by + '</td></tr>';
    }).join('');
    root.innerHTML =
      '<div class="card space-y-4">' +
      '<div class="flex flex-wrap items-center gap-2">' + tabs +
      '<span class="flex-1"></span>' +
      btnPrimary('<i data-lucide="plus" class="w-4 h-4"></i> 新增記錄', 'data-act="add"') + '</div>' +
      '<div class="overflow-x-auto"><table class="w-full min-w-[560px] text-left">' +
      '<thead><tr class="border-b border-gray-200 text-xs text-gray-500 uppercase">' +
      '<th class="py-2 pr-3 font-medium">時間</th><th class="py-2 pr-3 font-medium">院友</th>' +
      '<th class="py-2 pr-3 font-medium">內容</th><th class="py-2 font-medium">記錄人</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div></div>';
    refreshIcons(root);
    root.onclick = function (e) {
      var tab = e.target.closest('[data-tab]');
      if (tab) { bedsideTab = tab.dataset.tab; renderBedside(); return; }
      if (!e.target.closest('[data-act="add"]')) return;
      var def = BEDSIDE_TABS.filter(function (t) { return t[0] === bedsideTab; })[0];
      bedsideRecords[bedsideTab].push({ time: now(), name: '陳大文', note: def[1], by: '陳護士' });
      renderBedside();
      toast('已新增' + bedsideTab + '記錄');
    };
  }

  function initBedside() { renderBedside(); }

  /* ---------- 10. 院友日誌 ---------- */

  var LOG_CATS = [
    ['all', '全部'], ['健康轉變', '健康轉變'], ['覆診', '覆診'], ['家屬來電', '家屬來電'], ['其他', '其他']
  ];
  var LOG_CAT_COLOR = { '健康轉變': 'red', '覆診': 'blue', '家屬來電': 'green', '其他': 'gray' };

  var PATIENT_LOGS = [
    { cat: '健康轉變', name: '陳大文', note: '下午體溫 37.8°C，已通知醫生並加倍監測。', by: '陳護士', time: '今天 14:20' },
    { cat: '覆診', name: '李笑好', note: '普通科門診覆診，醫生調整血壓藥劑量。', by: '黃姑娘', time: '今天 11:05' },
    { cat: '家屬來電', name: '黃伯強', note: '孫兒來電查詢近況，已告知精神良好。', by: '李護士', time: '昨天 16:40' },
    { cat: '其他', name: '周桂蘭', note: '要求更換床單，已安排並完成。', by: '陳護士', time: '昨天 10:12' },
    { cat: '健康轉變', name: '梁志偉', note: '晚間咳嗽較頻，已按醫囑給予止咳藥。', by: '黃姑娘', time: '前天 21:30' }
  ];

  var logFilter = 'all';

  function renderPatientLog() {
    var root = $('#x-patient-log');
    if (!root) return;
    var chips = LOG_CATS.map(function (c) {
      var on = logFilter === c[0];
      return '<button type="button" data-chip="' + c[0] + '" class="px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ' +
        (on ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50') + '">' + c[1] + '</button>';
    }).join('');
    var list = PATIENT_LOGS.filter(function (l) { return logFilter === 'all' || l.cat === logFilter; });
    var items = list.map(function (l) {
      return '<div class="flex items-start gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50">' +
        '<div class="flex-1 min-w-0"><div class="flex flex-wrap items-center gap-2 mb-1">' +
        badge(l.cat, LOG_CAT_COLOR[l.cat]) +
        '<span class="font-medium text-gray-900 text-sm">' + l.name + '</span></div>' +
        '<p class="text-sm text-gray-700">' + l.note + '</p></div>' +
        '<div class="text-right flex-shrink-0"><p class="text-xs text-gray-500">' + l.by + '</p>' +
        '<p class="text-xs text-gray-400 mt-0.5">' + l.time + '</p></div></div>';
    }).join('');
    if (!list.length) items = '<p class="py-6 text-center text-sm text-gray-400">沒有相關日誌。</p>';
    root.innerHTML =
      '<div class="card space-y-4">' +
      '<div class="flex flex-wrap gap-2">' + chips + '</div>' +
      '<div class="space-y-3">' + items + '</div></div>';
    refreshIcons(root);
    root.onclick = function (e) {
      var chip = e.target.closest('[data-chip]');
      if (!chip) return;
      logFilter = chip.dataset.chip;
      renderPatientLog();
    };
  }

  function initPatientLog() { renderPatientLog(); }

  /* ---------- 11. 疫苗 / 診斷 OCR（對照 VaccinationRecordModal.tsx） ---------- */

  var VAX_OCR_RESIDENTS = ['陳大文', '李笑好', '黃伯強', '周桂蘭'];
  var vaxRows = [
    { name: '吳美玲', vaccine: '季節性流感疫苗', date: '2025-01-12', batch: 'FLU2025-041' }
  ];
  var vaxScanCount = 0;

  function renderVaxOcr() {
    var root = $('#x-vax-ocr');
    if (!root) return;
    var rows = vaxRows.map(function (v) {
      return '<tr class="border-b border-gray-100">' +
        '<td class="py-2.5 pr-3 font-medium text-gray-900">' + v.name + '</td>' +
        '<td class="py-2.5 pr-3 text-sm text-gray-700">' + v.vaccine + '</td>' +
        '<td class="py-2.5 pr-3 text-sm text-gray-600">' + v.date + '</td>' +
        '<td class="py-2.5 text-sm text-gray-600">' + v.batch + '</td></tr>';
    }).join('');
    root.innerHTML =
      '<div class="card space-y-4">' +
      '<div class="flex items-center justify-between gap-3 flex-wrap">' +
      '<p class="text-sm text-gray-600 flex items-center gap-1.5"><i data-lucide="scan-line" class="w-4 h-4 text-blue-500"></i>' +
      '以 OCR 掃描針卡，自動錄入疫苗接種記錄。</p>' +
      btnPrimary('<i data-lucide="camera" class="w-4 h-4"></i> 掃描針卡', 'data-act="scan"') + '</div>' +
      '<div class="overflow-x-auto"><table class="w-full min-w-[520px] text-left">' +
      '<thead><tr class="border-b border-gray-200 text-xs text-gray-500 uppercase">' +
      '<th class="py-2 pr-3 font-medium">院友</th><th class="py-2 pr-3 font-medium">疫苗</th>' +
      '<th class="py-2 pr-3 font-medium">日期</th><th class="py-2 font-medium">批次</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div></div>';
    refreshIcons(root);
    root.onclick = function (e) {
      if (!e.target.closest('[data-act="scan"]')) return;
      fakeScan('OCR 掃描針卡', function () {
        var name = VAX_OCR_RESIDENTS[vaxScanCount % VAX_OCR_RESIDENTS.length];
        vaxScanCount++;
        vaxRows.push({
          name: name,
          vaccine: '季節性流感疫苗',
          date: todayStr(),
          batch: 'FLU2025-' + (100 + vaxScanCount)
        });
        renderVaxOcr();
        toast('OCR 已錄入，請核對');
      });
    };
  }

  function initVaxOcr() { renderVaxOcr(); }

  /* ============================================================
     初始化
     ============================================================ */

  function init() {
    initDischarge();
    initResidentQr();
    initContacts();
    initAllergy();
    initStationFilter();
    initBedLog();
    initLastBed();
    initWeight();
    initBedside();
    initPatientLog();
    initVaxOcr();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
