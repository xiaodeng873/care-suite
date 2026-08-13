/* ============================================================
   features-demo.js — 功能體驗頁互動示範
   100% 前端、無框架、無網絡請求。所有數據均為虛構。
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
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  var toastTimer = null;
  function toast(msg, type) {
    var old = $('.fd-toast');
    if (old) old.remove();
    var t = document.createElement('div');
    t.className = 'fd-toast' + (type === 'danger' ? ' fd-toast-danger' : '');
    t.textContent = msg;
    document.body.appendChild(t);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.remove(); }, 2600);
  }

  function openModal(html) {
    var overlay = document.createElement('div');
    overlay.className = 'fd-modal-overlay';
    overlay.innerHTML =
      '<div class="fd-modal" role="dialog" aria-modal="true">' +
      '<button type="button" class="fd-modal-close" aria-label="關閉">✕</button>' +
      '<div class="fd-modal-body"></div></div>';
    var body = $('.fd-modal-body', overlay);
    body.innerHTML = html;
    document.body.appendChild(overlay);
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
      '<h3>' + label + '</h3>' +
      '<div class="fd-scan-box"><div class="fd-scan-line"></div><span>掃描中，請稍候…</span></div>'
    );
    setTimeout(function () { m.close(); cb(); }, 1300);
  }

  function askSignature(title, cb) {
    var m = openModal(
      '<h3>' + title + '</h3>' +
      '<div class="fd-field"><label>簽署人姓名</label>' +
      '<input class="fd-input" id="fd-sign-name" value="陳護士" /></div>' +
      '<div class="fd-row" style="margin-top:16px;justify-content:flex-end">' +
      '<button type="button" class="btn btn-ghost btn-sm" data-act="cancel">取消</button>' +
      '<button type="button" class="btn btn-primary btn-sm" data-act="ok">確認簽署</button></div>'
    );
    var input = $('#fd-sign-name', m.body);
    input.focus();
    input.select();
    m.body.addEventListener('click', function (e) {
      var act = e.target.closest('[data-act]');
      if (!act) return;
      if (act.dataset.act === 'cancel') { m.close(); return; }
      var name = input.value.trim();
      if (!name) { toast('請輸入簽署人姓名', 'danger'); return; }
      m.close();
      cb(name);
    });
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

  /* ============================================================
     1. 主控台 · 監測任務卡片
     ============================================================ */

  var monitorTasks = [
    { id: 't1', slot: '晨早', type: '體溫', due: '08:00', overdue: true },
    { id: 't2', slot: '晨早', type: '血糖', due: '08:30', overdue: false },
    { id: 't3', slot: '午間', type: '血壓', due: '12:30', overdue: false },
    { id: 't4', slot: '午間', type: '體重', due: '13:00', overdue: false },
    { id: 't5', slot: '晚間', type: '體溫', due: '20:00', overdue: false },
    { id: 't6', slot: '晚間', type: '血糖', due: '20:30', overdue: false }
  ];
  // 每張卡的院友名單；部分已完成
  monitorTasks.forEach(function (t, i) {
    var doneCount = [5, 2, 0, 0, 0, 0][i];
    t.residents = RESIDENTS.map(function (r, j) {
      return { name: r.name, bed: r.bed, value: j < doneCount ? '已錄' : '', done: j < doneCount };
    });
  });

  function taskDone(t) { return t.residents.filter(function (r) { return r.done; }).length; }

  function renderDashboard() {
    var root = $('#demo-dashboard');
    if (!root) return;
    var html = '';
    ['晨早', '午間', '晚間'].forEach(function (slot) {
      html += '<p class="fd-slot-title">' + slot + '時段</p><div class="fd-task-grid">';
      monitorTasks.filter(function (t) { return t.slot === slot; }).forEach(function (t) {
        var done = taskDone(t);
        var total = t.residents.length;
        var complete = done === total;
        var cls = 'fd-task-card' + (t.overdue && !complete ? ' is-overdue' : '') + (complete ? ' is-done' : '');
        html += '<button type="button" class="' + cls + '" data-task="' + t.id + '">' +
          '<div class="fd-row" style="justify-content:space-between">' +
          '<span class="fd-task-type">' + t.type + '</span>' +
          (complete ? '<span class="fd-badge fd-badge-ok">完成</span>'
            : t.overdue ? '<span class="fd-badge fd-badge-danger">逾期 ' + t.due + '</span>'
            : '<span class="fd-badge">截數 ' + t.due + '</span>') +
          '</div>' +
          '<div class="fd-sub" style="margin-top:4px">完成進度 ' + done + ' / ' + total + '</div>' +
          '<div class="fd-progress"><span style="width:' + Math.round(done / total * 100) + '%"></span></div>' +
          '</button>';
      });
      html += '</div>';
    });
    root.innerHTML = html;
  }

  function initDashboard() {
    var root = $('#demo-dashboard');
    if (!root) return;
    renderDashboard();
    root.addEventListener('click', function (e) {
      var card = e.target.closest('[data-task]');
      if (!card) return;
      var t = monitorTasks.filter(function (x) { return x.id === card.dataset.task; })[0];
      var rows = t.residents.map(function (r, i) {
        return '<div class="fd-worksheet-row' + (r.done ? ' is-done' : '') + '">' +
          '<span class="fd-worksheet-name">' + r.name + ' <span class="fd-sub">' + r.bed + '</span></span>' +
          (r.done ? '<span class="fd-badge fd-badge-ok">已錄</span>'
            : '<input class="fd-input" data-idx="' + i + '" placeholder="輸入數值" inputmode="decimal" />') +
          '</div>';
      }).join('');
      var m = openModal(
        '<h3>' + t.slot + ' · ' + t.type + '工作紙</h3>' + rows +
        '<div class="fd-row" style="margin-top:16px;justify-content:flex-end">' +
        '<button type="button" class="btn btn-primary btn-sm" data-act="save">儲存工作紙</button></div>'
      );
      m.body.addEventListener('click', function (ev) {
        if (!ev.target.closest('[data-act="save"]')) return;
        var filled = 0;
        $$('input[data-idx]', m.body).forEach(function (inp) {
          if (inp.value.trim()) {
            t.residents[+inp.dataset.idx].done = true;
            t.residents[+inp.dataset.idx].value = inp.value.trim();
            filled++;
          }
        });
        if (!filled) { toast('未輸入任何數值', 'danger'); return; }
        m.close();
        renderDashboard();
        toast('已儲存 ' + filled + ' 筆' + t.type + '記錄');
      });
    });
  }

  /* ============================================================
     2. eMAR 給藥工作流程
     ============================================================ */

  var emarResidents = [
    { id: 1, name: '陳大文', bed: '101-A', batch: '早批', steps: { prep: null, check: null, give: null }, fail: null,
      meds: [{ name: 'Metformin 500mg', dose: '1粒', time: '08:00 / 20:00' }, { name: 'Amlodipine 5mg', dose: '1粒', time: '08:00' }] },
    { id: 2, name: '李笑好', bed: '101-B', batch: '早批', steps: { prep: null, check: null, give: null }, fail: null,
      meds: [{ name: 'Donepezil 5mg', dose: '1粒', time: '21:00' }] },
    { id: 3, name: '黃伯強', bed: '102-A', batch: '早批', steps: { prep: null, check: null, give: null }, fail: null,
      meds: [{ name: 'Furosemide 40mg', dose: '1粒', time: '08:00' }, { name: 'Potassium Chloride 600mg', dose: '2粒', time: '08:00' }] },
    { id: 4, name: '周桂蘭', bed: '102-B', batch: '晚批', steps: { prep: null, check: null, give: null }, fail: null,
      meds: [{ name: 'Atorvastatin 20mg', dose: '1粒', time: '21:00' }] },
    { id: 5, name: '吳美玲', bed: '103-A', batch: '晚批', steps: { prep: null, check: null, give: null }, fail: null,
      meds: [{ name: 'Levothyroxine 50mcg', dose: '1粒', time: '07:00' }, { name: 'Calcium 600mg', dose: '1粒', time: '21:00' }] }
  ];
  var emarSelected = 1;

  function emarStatus(r) {
    if (r.fail) return '<span class="fd-badge fd-badge-danger">失敗：' + r.fail + '</span>';
    if (r.steps.give) return '<span class="fd-badge fd-badge-ok">已派藥</span>';
    if (r.steps.check) return '<span class="fd-badge fd-badge-info">待派藥</span>';
    if (r.steps.prep) return '<span class="fd-badge fd-badge-warn">執藥中</span>';
    return '<span class="fd-badge">未開始</span>';
  }

  function renderEmar() {
    var root = $('#demo-emar');
    if (!root) return;
    var batches = [['早批', '18:00 前批次'], ['晚批', '18:00 後批次']];
    var list = '';
    batches.forEach(function (b) {
      var group = emarResidents.filter(function (r) { return r.batch === b[0]; });
      list += '<div class="fd-batch-header"><span>' + b[1] + ' · ' + group.length + ' 位</span>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-batch-give="' + b[0] + '">批量派藥</button></div>';
      group.forEach(function (r) {
        list += '<button type="button" class="fd-res-item' + (r.id === emarSelected ? ' is-active' : '') + '" data-res="' + r.id + '">' +
          '<span>' + r.name + ' <span class="fd-sub">' + r.bed + '</span></span>' + emarStatus(r) + '</button>';
      });
    });

    var r = emarResidents.filter(function (x) { return x.id === emarSelected; })[0];
    var meds = r.meds.map(function (med) {
      return '<tr><td>' + med.name + '</td><td>' + med.dose + '</td><td>' + med.time + '</td></tr>';
    }).join('');
    var stepDefs = [['prep', '執藥'], ['check', '核藥'], ['give', '派藥']];
    var stepsHtml = stepDefs.map(function (s, i) {
      var rec = r.steps[s[0]];
      var prevOk = i === 0 || !!r.steps[stepDefs[i - 1][0]];
      var locked = !rec && !prevOk;
      var disabled = !!rec || locked || (s[0] === 'give' && !!r.fail);
      return '<div class="fd-step' + (rec ? ' is-done' : '') + '">' +
        '<button type="button" class="btn ' + (rec ? 'btn-ghost' : 'btn-primary') + ' btn-sm" data-step="' + s[0] + '"' +
        (disabled ? ' disabled' : '') + '>' + (i + 1) + '. ' + s[1] + '</button>' +
        '<div class="fd-step-sign">' + (rec ? '✓ ' + rec.by + ' ' + rec.at : (locked ? '需先完成上一步' : '')) + '</div></div>';
    }).join('');

    root.innerHTML =
      '<div class="fd-emar">' +
      '<div class="fd-scroll-x"><div class="fd-res-list">' + list + '</div></div>' +
      '<div>' +
      '<div class="fd-row" style="justify-content:space-between">' +
      '<strong>' + r.name + ' <span class="fd-sub">' + r.bed + '</span></strong>' +
      '<span class="fd-row">' +
      '<button type="button" class="btn btn-ghost btn-sm" data-act="qr">掃 QR Code</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-act="fail"' + (r.steps.give || r.fail ? ' disabled' : '') + '>派藥失敗</button>' +
      '</span></div>' +
      '<table class="fd-table" style="margin-top:12px"><thead><tr><th>藥物</th><th>劑量</th><th>時間</th></tr></thead><tbody>' + meds + '</tbody></table>' +
      '<div class="fd-steps">' + stepsHtml + '</div>' +
      (r.fail ? '<p class="fd-note-bad">派藥失敗（' + r.fail + '），已記錄於 eMAR。</p>' : '') +
      (r.steps.give ? '<p class="fd-note-ok">三步簽署完成，派藥記錄已寫入 eMAR。</p>' : '') +
      '</div></div>';
  }

  function initEmar() {
    var root = $('#demo-emar');
    if (!root) return;
    renderEmar();
    root.addEventListener('click', function (e) {
      var resBtn = e.target.closest('[data-res]');
      if (resBtn) { emarSelected = +resBtn.dataset.res; renderEmar(); return; }

      var stepBtn = e.target.closest('[data-step]');
      if (stepBtn && !stepBtn.disabled) {
        var r = emarResidents.filter(function (x) { return x.id === emarSelected; })[0];
        var step = stepBtn.dataset.step;
        var label = { prep: '執藥', check: '核藥', give: '派藥' }[step];
        askSignature(label + '簽署 — ' + r.name, function (name) {
          r.steps[step] = { by: name, at: now() };
          renderEmar();
          toast(r.name + ' ' + label + '已簽署');
        });
        return;
      }

      var qrBtn = e.target.closest('[data-act="qr"]');
      if (qrBtn) {
        fakeScan('掃描院友 QR Code', function () {
          var next = emarResidents.filter(function (x) { return !x.steps.give && !x.fail && x.id !== emarSelected; })[0]
            || emarResidents.filter(function (x) { return x.id !== emarSelected; })[0];
          emarSelected = next.id;
          renderEmar();
          toast('已掃描：' + next.name + '（' + next.bed + '）的 QR Code');
        });
        return;
      }

      var failBtn = e.target.closest('[data-act="fail"]');
      if (failBtn && !failBtn.disabled) {
        var r2 = emarResidents.filter(function (x) { return x.id === emarSelected; })[0];
        var reasons = ['拒服', '外出', '暫停醫囑', '嘔吐', '其他'];
        var m = openModal(
          '<h3>派藥失敗 — ' + r2.name + '</h3>' +
          reasons.map(function (reason, i) {
            return '<label style="display:block;padding:6px 0;font-size:0.9375rem">' +
              '<input type="radio" name="fd-fail" value="' + reason + '"' + (i === 0 ? ' checked' : '') + ' /> ' + reason + '</label>';
          }).join('') +
          '<div class="fd-row" style="margin-top:12px;justify-content:flex-end">' +
          '<button type="button" class="btn btn-primary btn-sm" data-act="ok">記錄失敗</button></div>'
        );
        m.body.addEventListener('click', function (ev) {
          if (!ev.target.closest('[data-act="ok"]')) return;
          var sel = $('input[name="fd-fail"]:checked', m.body);
          r2.fail = sel.value;
          m.close();
          renderEmar();
          toast('已記錄派藥失敗：' + r2.fail, 'danger');
        });
        return;
      }

      var batchBtn = e.target.closest('[data-batch-give]');
      if (batchBtn) {
        var batch = batchBtn.dataset.batchGive;
        var count = 0;
        emarResidents.forEach(function (r3) {
          if (r3.batch === batch && r3.steps.prep && r3.steps.check && !r3.steps.give && !r3.fail) {
            r3.steps.give = { by: '批量 · 陳護士', at: now() };
            count++;
          }
        });
        renderEmar();
        toast(count ? '已批量派藥 ' + count + ' 位（' + batch + '）' : batch + '沒有可批量派藥的院友（需先完成執藥及核藥）', count ? 'success' : 'danger');
      }
    });
  }

  /* ============================================================
     3. 排班表（更表）
     ============================================================ */

  var ROSTER_DAYS = ['一', '二', '三', '四', '五', '六', '日'];
  var SHIFT_NAMES = { A: 'A 早班', P: 'P 夜更', N: 'N 通宵' };
  var rosterEmps = [
    { name: '陳婉儀', role: '護士' },
    { name: '李志豪', role: '護士' },
    { name: '王秀珍', role: '護理員' },
    { name: '張美蓮', role: '護理員' },
    { name: '何嘉欣', role: '護理員' }
  ];
  // roster[empIdx][dayIdx] = ['A', ...]
  var roster = [
    { 0: ['A'], 1: ['A'], 2: ['P'], 4: ['A'], 5: ['P'] },
    { 0: ['P'], 1: ['N'], 3: ['A'], 4: ['P'], 6: ['A'] },
    { 0: ['A'], 2: ['A'], 3: ['P'], 5: ['A'], 6: ['P'] },
    { 1: ['P'], 2: ['N'], 4: ['A'], 5: ['N'], 6: ['A'] },
    { 0: ['N'], 1: ['A'], 3: ['N'], 4: ['P'], 6: ['N'] }
  ];

  function rosterConflicts() {
    var issues = [];
    roster.forEach(function (days, ei) {
      Object.keys(days).forEach(function (di) {
        if (days[di].length > 1) issues.push(rosterEmps[ei].name + ' 星期' + ROSTER_DAYS[di] + ' 同一日編咗 ' + days[di].length + ' 更');
      });
    });
    ROSTER_DAYS.forEach(function (_, di) {
      var total = roster.reduce(function (sum, days) { return sum + (days[di] ? days[di].length : 0); }, 0);
      if (total < 2) issues.push('星期' + ROSTER_DAYS[di] + ' 只有 ' + total + ' 人當值，低於最少 2 人下限');
    });
    return issues;
  }

  function renderRoster() {
    var root = $('#demo-roster');
    if (!root) return;
    var issues = rosterConflicts();
    var html = '';
    if (issues.length) {
      html += '<div class="fd-banner" role="alert"><span>⚠ 排班衝突</span><marquee scrollamount="4">' + issues.join('　｜　') + '</marquee></div>';
    }
    html += '<div class="fd-scroll-x"><table class="fd-table fd-roster-table"><thead><tr><th>員工</th>' +
      ROSTER_DAYS.map(function (d) { return '<th>星期' + d + '</th>'; }).join('') + '</tr></thead><tbody>';
    rosterEmps.forEach(function (emp, ei) {
      html += '<tr><th>' + emp.name + ' <span class="fd-sub">' + emp.role + '</span></th>';
      ROSTER_DAYS.forEach(function (_, di) {
        var chips = (roster[ei][di] || []).map(function (s) {
          return '<span class="fd-chip shift-' + s.toLowerCase() + '" draggable="true" data-emp="' + ei + '" data-day="' + di + '" data-shift="' + s + '">' + SHIFT_NAMES[s] + '</span>';
        }).join('');
        html += '<td class="fd-cell" data-emp="' + ei + '" data-day="' + di + '">' + chips + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>' +
      '<div class="fd-trash" id="fd-roster-trash">拖曳班次到此處移除</div>' +
      '<p class="fd-sub" style="margin-top:8px">規則：同一員工同一日不可編兩更；每日最少 2 人當值。</p>';
    root.innerHTML = html;
  }

  function initRoster() {
    var root = $('#demo-roster');
    if (!root) return;
    renderRoster();
    var dragData = null;

    root.addEventListener('dragstart', function (e) {
      var chip = e.target.closest('.fd-chip');
      if (!chip) return;
      dragData = { emp: +chip.dataset.emp, day: +chip.dataset.day, shift: chip.dataset.shift };
      e.dataTransfer.setData('text/plain', chip.dataset.shift);
      e.dataTransfer.effectAllowed = 'move';
    });
    root.addEventListener('dragover', function (e) {
      var cell = e.target.closest('.fd-cell, .fd-trash');
      if (!cell) return;
      e.preventDefault();
      cell.classList.add('fd-dragover');
    });
    root.addEventListener('dragleave', function (e) {
      var cell = e.target.closest('.fd-cell, .fd-trash');
      if (cell) cell.classList.remove('fd-dragover');
    });
    root.addEventListener('drop', function (e) {
      var cell = e.target.closest('.fd-cell, .fd-trash');
      if (!cell || !dragData) return;
      e.preventDefault();
      // 從原格移除
      var src = roster[dragData.emp][dragData.day] || [];
      var idx = src.indexOf(dragData.shift);
      if (idx >= 0) src.splice(idx, 1);
      if (cell.classList.contains('fd-cell')) {
        var de = +cell.dataset.emp, dd = +cell.dataset.day;
        roster[de][dd] = roster[de][dd] || [];
        if (roster[de][dd].indexOf(dragData.shift) < 0) roster[de][dd].push(dragData.shift);
      }
      dragData = null;
      renderRoster();
    });
  }

  /* ============================================================
     4. 預排表（假期預排）
     ============================================================ */

  var LEAVE_TYPES = { AL: '年假', RO: '休息日', PH: '公眾假期', BH: '銀行假期' };
  var leaveEmps = [
    { name: '陳婉儀', bal: 12 },
    { name: '李志豪', bal: 8 },
    { name: '王秀珍', bal: 14 },
    { name: '張美蓮', bal: 10 }
  ];
  var leaveDays = 31; // 8 月
  // 既有更期（簡化循環）
  function leaveShift(ei, d) {
    var pat = ['A', 'A', 'P', 'P', 'N', 'N', ''];
    return pat[(ei * 2 + d - 1) % pat.length];
  }
  // leaves[ei] = { day: 'AL' }
  var leaves = [{ 6: 'AL', 7: 'AL' }, { 15: 'PH' }, {}, { 20: 'RO' }];
  var leaveHint = '';

  function leaveTaken(ei) {
    return Object.keys(leaves[ei]).filter(function (d) { return leaves[ei][d] === 'AL'; }).length;
  }

  function renderLeave() {
    var root = $('#demo-leave');
    if (!root) return;
    var html = '<div class="fd-row" style="margin-bottom:12px">';
    leaveEmps.forEach(function (emp, ei) {
      html += '<span class="fd-badge fd-badge-info">' + emp.name + '：年假餘 ' + (emp.bal - leaveTaken(ei)) + ' 日</span>';
    });
    html += '</div>';
    if (leaveHint) html += '<p class="fd-note-bad" style="margin-bottom:8px">⚠ ' + leaveHint + '</p>';
    html += '<div class="fd-scroll-x"><table class="fd-table fd-leave-table"><thead><tr><th>8 月</th>';
    for (var d = 1; d <= leaveDays; d++) html += '<th>' + d + '</th>';
    html += '</tr></thead><tbody>';
    leaveEmps.forEach(function (emp, ei) {
      html += '<tr><th>' + emp.name + '</th>';
      for (var d2 = 1; d2 <= leaveDays; d2++) {
        var shift = leaveShift(ei, d2);
        var lv = leaves[ei][d2];
        var cls = 'fd-leave-cell';
        if (lv) cls += ' has-leave leave-' + lv.toLowerCase();
        else if (shift) cls += ' has-shift';
        if (lv && shift) cls += ' is-conflict';
        html += '<td class="' + cls + '" data-emp="' + ei + '" data-day="' + d2 + '" title="' +
          (shift ? SHIFT_NAMES[shift] : '休假/無更') + '">' + (lv || shift || '') + '</td>';
      }
      html += '</tr>';
    });
    html += '</tbody></table></div>' +
      '<p class="fd-sub" style="margin-top:8px">底色字母為已編更期（A/P/N）；點空格加入假期，再點已填格可取消。紅框表示假期與更期衝突。</p>';
    root.innerHTML = html;
  }

  function initLeave() {
    var root = $('#demo-leave');
    if (!root) return;
    renderLeave();
    root.addEventListener('click', function (e) {
      var cell = e.target.closest('.fd-leave-cell');
      if (!cell) return;
      var ei = +cell.dataset.emp, d = +cell.dataset.day;
      var emp = leaveEmps[ei];
      if (leaves[ei][d]) {
        // 取消
        delete leaves[ei][d];
        leaveHint = '';
        renderLeave();
        toast('已取消 ' + emp.name + ' 8月' + d + '日 的假期');
        return;
      }
      var m = openModal(
        '<h3>' + emp.name + ' · 8月' + d + '日</h3>' +
        '<p class="fd-sub" style="margin-bottom:12px">選擇休假類型' +
        (leaveShift(ei, d) ? '（注意：當日已編 ' + SHIFT_NAMES[leaveShift(ei, d)] + '）' : '') + '</p>' +
        Object.keys(LEAVE_TYPES).map(function (k) {
          return '<button type="button" class="btn btn-ghost btn-sm" style="margin:0 8px 8px 0" data-leave="' + k + '">' + LEAVE_TYPES[k] + '（' + k + '）</button>';
        }).join('')
      );
      m.body.addEventListener('click', function (ev) {
        var btn = ev.target.closest('[data-leave]');
        if (!btn) return;
        var type = btn.dataset.leave;
        if (type === 'AL' && emp.bal - leaveTaken(ei) <= 0) {
          toast(emp.name + ' 年假餘額不足', 'danger');
          return;
        }
        leaves[ei][d] = type;
        leaveHint = leaveShift(ei, d)
          ? emp.name + ' 8月' + d + '日 已放' + LEAVE_TYPES[type] + '，但當日已編 ' + SHIFT_NAMES[leaveShift(ei, d)] + '，請先調更。'
          : '';
        m.close();
        renderLeave();
        toast('已為 ' + emp.name + ' 預排 8月' + d + '日 ' + LEAVE_TYPES[type]);
      });
    });
  }

  /* ============================================================
     5. 床位平面圖
     ============================================================ */

  function res(name) { return RESIDENTS.filter(function (r) { return r.name === name; })[0]; }

  var bedStations = [
    { name: '一樓護理站', rooms: [
      { name: '101 房', beds: [{ id: '101-A', res: res('陳大文') }, { id: '101-B', res: res('李笑好') }] },
      { name: '102 房', beds: [{ id: '102-A', res: res('黃伯強') }, { id: '102-B', res: res('周桂蘭') }] },
      { name: '103 房', beds: [{ id: '103-A', res: res('吳美玲') }, { id: '103-B', res: null }] }
    ] },
    { name: '二樓護理站', rooms: [
      { name: '201 房', beds: [{ id: '201-A', res: res('梁志偉') }, { id: '201-B', res: null }] },
      { name: '202 房', beds: [{ id: '202-A', res: res('林淑芬') }, { id: '202-B', res: null }] },
      { name: '203 房', beds: [{ id: '203-A', res: res('張金好') }, { id: '203-B', res: null }] }
    ] }
  ];
  var bedLogs = [{ time: '08:15', text: '系統示例：張金好 203-B → 203-A（常規調動）' }];
  var swapSource = null; // {station, room, bed} indexes

  function findBed(si, ri, bi) { return bedStations[si].rooms[ri].beds[bi]; }

  function renderBeds() {
    var root = $('#demo-beds');
    if (!root) return;
    var html = '';
    if (swapSource) {
      var src = findBed(swapSource.si, swapSource.ri, swapSource.bi);
      html += '<div class="fd-banner" style="background:var(--color-accent)"><span>調床模式：正移動 ' + (src.res ? src.res.name : '') + '（' + src.id + '），請點選目標床位；再點原床取消。</span></div>';
    }
    bedStations.forEach(function (st, si) {
      html += '<div class="fd-station"><p class="fd-station-title">' + st.name + '</p><div class="fd-rooms">';
      st.rooms.forEach(function (room, ri) {
        html += '<div class="fd-room"><p class="fd-room-title">' + room.name + '</p><div class="fd-beds' + (swapSource ? ' fd-beds-swapping' : '') + '">';
        room.beds.forEach(function (bed, bi) {
          var isSrc = swapSource && swapSource.si === si && swapSource.ri === ri && swapSource.bi === bi;
          if (bed.res) {
            html += '<button type="button" class="fd-bed occupied' + (isSrc ? ' swap-source' : '') + '" data-si="' + si + '" data-ri="' + ri + '" data-bi="' + bi + '">' +
              '<strong>' + bed.id + '</strong><br />' + bed.res.name + '</button>';
          } else {
            html += '<button type="button" class="fd-bed empty' + (isSrc ? ' swap-source' : '') + '" data-si="' + si + '" data-ri="' + ri + '" data-bi="' + bi + '">' +
              '<strong>' + bed.id + '</strong><br />空床</button>';
          }
        });
        html += '</div></div>';
      });
      html += '</div></div>';
    });
    html += '<hr class="fd-divider" /><p class="fd-station-title">調動日誌</p><ul class="fd-log">' +
      bedLogs.slice().reverse().map(function (l) {
        return '<li>' + l.time + ' — ' + l.text + '</li>';
      }).join('') + '</ul>';
    root.innerHTML = html;
  }

  function initBeds() {
    var root = $('#demo-beds');
    if (!root) return;
    renderBeds();
    root.addEventListener('click', function (e) {
      var bedBtn = e.target.closest('.fd-bed');
      if (!bedBtn) return;
      var si = +bedBtn.dataset.si, ri = +bedBtn.dataset.ri, bi = +bedBtn.dataset.bi;
      var bed = findBed(si, ri, bi);

      if (swapSource) {
        if (swapSource.si === si && swapSource.ri === ri && swapSource.bi === bi) {
          swapSource = null;
          renderBeds();
          return;
        }
        var srcBed = findBed(swapSource.si, swapSource.ri, swapSource.bi);
        var a = srcBed.res, b = bed.res;
        srcBed.res = b;
        bed.res = a;
        bedLogs.push({
          time: now(),
          text: (a ? a.name : '（空床）') + ' ' + srcBed.id + ' ⇄ ' + (b ? b.name : '（空床）') + ' ' + bed.id
        });
        swapSource = null;
        renderBeds();
        toast('調床完成，已寫入調動日誌');
        return;
      }

      if (!bed.res) { toast(bed.id + ' 是空床', 'danger'); return; }
      var m = openModal(
        '<h3>' + bed.res.name + ' <span class="fd-sub">' + bed.id + '</span></h3>' +
        '<table class="fd-table"><tbody>' +
        '<tr><th>年齡 / 性別</th><td>' + bed.res.age + ' 歲 / ' + bed.res.sex + '</td></tr>' +
        '<tr><th>護理級別</th><td>' + bed.res.care + '</td></tr>' +
        '<tr><th>身份證</th><td>' + bed.res.idc + '</td></tr>' +
        '</tbody></table>' +
        '<div class="fd-row" style="margin-top:16px;justify-content:flex-end">' +
        '<button type="button" class="btn btn-primary btn-sm" data-act="swap">調床</button></div>'
      );
      m.body.addEventListener('click', function (ev) {
        if (!ev.target.closest('[data-act="swap"]')) return;
        m.close();
        swapSource = { si: si, ri: ri, bi: bi };
        renderBeds();
      });
    });
  }

  /* ============================================================
     6. 生命表徵批量工作紙
     ============================================================ */

  var vitalsRows = RESIDENTS.slice(0, 6).map(function (r) {
    return { name: r.name, bed: r.bed, temp: '', sys: '', dia: '', glu: '', time: '—' };
  });

  function vitalsWarnings(row) {
    var msgs = [];
    var t = parseFloat(row.temp), s = parseFloat(row.sys), d = parseFloat(row.dia), g = parseFloat(row.glu);
    if (row.temp && (t > 37.5 || t < 36)) msgs.push('體溫異常');
    if (row.sys && (s > 140 || s < 90)) msgs.push('上壓異常');
    if (row.dia && (d > 90 || d < 60)) msgs.push('下壓異常');
    if (row.glu && (g > 10 || g < 3.9)) msgs.push('血糖異常');
    return msgs;
  }

  function vitalBad(field, val) {
    var v = parseFloat(val);
    if (!val || isNaN(v)) return false;
    if (field === 'temp') return v > 37.5 || v < 36;
    if (field === 'sys') return v > 140 || v < 90;
    if (field === 'dia') return v > 90 || v < 60;
    if (field === 'glu') return v > 10 || v < 3.9;
    return false;
  }

  function renderVitals() {
    var root = $('#demo-vitals');
    if (!root) return;
    var html = '<div class="fd-scroll-x"><table class="fd-table fd-vitals-table"><thead><tr>' +
      '<th>院友</th><th>體溫 (°C)</th><th>上壓</th><th>下壓</th><th>血糖 (mmol/L)</th><th>狀態</th><th>更新時間</th>' +
      '</tr></thead><tbody>';
    vitalsRows.forEach(function (row, i) {
      var warns = vitalsWarnings(row);
      html += '<tr><th>' + row.name + ' <span class="fd-sub">' + row.bed + '</span></th>' +
        ['temp', 'sys', 'dia', 'glu'].map(function (f) {
          return '<td><input data-row="' + i + '" data-field="' + f + '" value="' + row[f] + '" inputmode="decimal"' +
            (vitalBad(f, row[f]) ? ' class="is-bad"' : '') + ' /></td>';
        }).join('') +
        '<td>' + (warns.length ? '<span class="fd-note-bad">⚠ ' + warns.join('、') + '</span>' : '<span class="fd-note-ok">正常</span>') + '</td>' +
        '<td class="fd-sub">' + row.time + '</td></tr>';
    });
    html += '</tbody></table></div>' +
      '<div class="fd-row" style="margin-top:12px;justify-content:space-between">' +
      '<span class="fd-sub">異常範圍：體溫 &lt;36 或 &gt;37.5°C；上壓 &lt;90 或 &gt;140；下壓 &lt;60 或 &gt;90；血糖 &lt;3.9 或 &gt;10 mmol/L</span>' +
      '<button type="button" class="btn btn-primary btn-sm" data-act="save">儲存</button></div>';
    root.innerHTML = html;
  }

  function initVitals() {
    var root = $('#demo-vitals');
    if (!root) return;
    renderVitals();
    root.addEventListener('input', function (e) {
      var inp = e.target.closest('input[data-row]');
      if (!inp) return;
      vitalsRows[+inp.dataset.row][inp.dataset.field] = inp.value.trim();
      // 只更新該格樣式與狀態欄，避免重新渲染令輸入失焦
      inp.classList.toggle('is-bad', vitalBad(inp.dataset.field, inp.value.trim()));
      var tr = inp.closest('tr');
      var warns = vitalsWarnings(vitalsRows[+inp.dataset.row]);
      var statusCell = tr.children[5];
      statusCell.innerHTML = warns.length
        ? '<span class="fd-note-bad">⚠ ' + warns.join('、') + '</span>'
        : '<span class="fd-note-ok">正常</span>';
    });
    root.addEventListener('click', function (e) {
      if (!e.target.closest('[data-act="save"]')) return;
      var saved = 0;
      vitalsRows.forEach(function (row) {
        if (row.temp || row.sys || row.dia || row.glu) { row.time = now(); saved++; }
      });
      renderVitals();
      toast(saved ? '已儲存 ' + saved + ' 位院友的生命表徵記錄' : '未輸入任何數值', saved ? 'success' : 'danger');
    });
  }

  /* ============================================================
     7. 院友管理 · 身份證 OCR 建檔
     ============================================================ */

  var ocrSamples = [
    { name: '黃麗珍', idc: 'B456789(1)', dob: '1942-11-05', sex: '女' },
    { name: '陳大文', idc: 'A123456(7)', dob: '1945-03-12', sex: '男' } // 已存在 → 重複警告
  ];
  var ocrScanCount = 0;

  function initOcr() {
    var root = $('#demo-ocr');
    if (!root) return;
    root.innerHTML =
      '<div class="fd-form-grid">' +
      '<div class="fd-field"><label>姓名</label><input class="fd-input" id="ocr-name" /></div>' +
      '<div class="fd-field"><label>身份證號碼</label><input class="fd-input" id="ocr-idc" /></div>' +
      '<div class="fd-field"><label>出生日期</label><input class="fd-input" id="ocr-dob" type="date" /></div>' +
      '<div class="fd-field"><label>床號</label>' +
      '<select class="fd-select" id="ocr-bed"><option value="">請選擇</option>' +
      ['103-B', '201-B', '202-B', '203-B'].map(function (b) { return '<option>' + b + '</option>'; }).join('') +
      '</select></div>' +
      '</div>' +
      '<div id="ocr-warning" style="margin-top:12px"></div>' +
      '<div class="fd-row" style="margin-top:16px">' +
      '<button type="button" class="btn btn-secondary btn-sm" data-act="scan">掃描身份證</button>' +
      '<button type="button" class="btn btn-primary btn-sm" data-act="submit">提交建檔</button>' +
      '<span class="fd-sub">示範會循環掃描兩張身份證：一張新院友、一張現有院友。</span></div>';

    root.addEventListener('click', function (e) {
      var act = e.target.closest('[data-act]');
      if (!act) return;
      var warnBox = $('#ocr-warning', root);
      if (act.dataset.act === 'scan') {
        fakeScan('掃描身份證', function () {
          var s = ocrSamples[ocrScanCount % ocrSamples.length];
          ocrScanCount++;
          $('#ocr-name', root).value = s.name;
          $('#ocr-idc', root).value = s.idc;
          $('#ocr-dob', root).value = s.dob;
          var dup = RESIDENTS.some(function (r) { return r.idc === s.idc; });
          warnBox.innerHTML = dup
            ? '<div class="fd-banner" role="alert">⚠ 重複建檔警告：身份證 ' + s.idc + ' 與現有院友 ' + s.name + '（' + res(s.name).bed + '）相同，請核實是否同一人。</div>'
            : '<p class="fd-note-ok">✓ OCR 完成，已自動填入資料，請核對後提交。</p>';
        });
        return;
      }
      if (act.dataset.act === 'submit') {
        var idc = $('#ocr-idc', root).value.trim();
        var name = $('#ocr-name', root).value.trim();
        if (!name || !idc) { toast('請先掃描身份證或填寫資料', 'danger'); return; }
        if (RESIDENTS.some(function (r) { return r.idc === idc; })) {
          toast('身份證號碼重複，無法建檔', 'danger');
          return;
        }
        toast('已為 ' + name + ' 建立院友檔案');
        $('#ocr-name', root).value = '';
        $('#ocr-idc', root).value = '';
        $('#ocr-dob', root).value = '';
        $('#ocr-bed', root).value = '';
        warnBox.innerHTML = '';
      }
    });
  }

  /* ============================================================
     8. AI 助手
     ============================================================ */

  function aiAddMsg(log, who, html) {
    var div = document.createElement('div');
    div.className = 'fd-msg ' + who;
    div.innerHTML = html;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  }

  function aiReply(text) {
    // 意圖 1：未量體溫
    if (/體溫|未量|量咗未/.test(text)) {
      var t = monitorTasks[0]; // 晨早體溫
      var pending = t.residents.filter(function (r) { return !r.done; }).map(function (r) { return r.name; });
      if (!pending.length) return '晨早體溫監測已全部完成，辛苦晒！';
      return '晨早體溫仲有 ' + pending.length + ' 位未量：<br />' + pending.join('、') +
        '<br /><span class="fd-sub">（數據來自主控台監測任務卡，填完工作紙再問我會即時更新。）</span>';
    }
    // 意圖 2：加覆診 → 確認卡
    if (/覆診/.test(text)) {
      var target = RESIDENTS.filter(function (r) { return text.indexOf(r.name) >= 0; })[0] || RESIDENTS[0];
      return '收到，請核對以下覆診安排：' +
        '<div class="fd-confirm-card">' +
        '<strong>新增覆診</strong><br />院友：' + target.name + '（' + target.bed + '）<br />日期：2026-08-20 14:30<br />專科：眼科覆診' +
        '<div class="fd-row" style="margin-top:8px">' +
        '<button type="button" class="btn btn-primary btn-sm" data-ai-confirm="' + target.name + '">確認</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-ai-cancel>取消</button></div></div>';
    }
    // 意圖 3：尿片統計
    if (/尿片|片數|用咗幾多/.test(text)) {
      return '今日尿片使用量：<br />陳大文 4 片、黃伯強 5 片、梁志偉 3 片、張金好 4 片，其餘院友共 22 片，合計 38 片。較昨日多 2 片。';
    }
    return '唔好意思，呢個示範版本暫時只識答幾類問題，例如：「今日仲有邊個未量體溫？」「幫陳大文加個覆診」「今日尿片用咗幾多？」。正式版的 AI 助手可以查詢全院數據同辦理更多事項。';
  }

  function initAi() {
    var root = $('#demo-ai');
    if (!root) return;
    root.innerHTML =
      '<div class="fd-chat">' +
      '<div class="fd-chat-log" id="ai-log"></div>' +
      '<div class="fd-chat-input">' +
      '<button type="button" class="btn btn-ghost btn-sm" data-act="upload">上傳處方紙相片</button>' +
      '<input class="fd-input" id="ai-input" placeholder="輸入問題，例如：今日仲有邊個未量體溫？" />' +
      '<button type="button" class="btn btn-primary btn-sm" data-act="send">送出</button>' +
      '</div></div>';
    var log = $('#ai-log', root);
    var input = $('#ai-input', root);
    aiAddMsg(log, 'bot', '你好，我係 eHMS AI 助手。你可以問我院舍數據，或者叫我幫你辦事，例如「幫陳大文加個覆診」。');

    function send() {
      var text = input.value.trim();
      if (!text) return;
      input.value = '';
      aiAddMsg(log, 'user', text);
      setTimeout(function () { aiAddMsg(log, 'bot', aiReply(text)); }, 350);
    }

    root.addEventListener('click', function (e) {
      if (e.target.closest('[data-act="send"]')) { send(); return; }
      if (e.target.closest('[data-act="upload"]')) {
        aiAddMsg(log, 'user', '［已上傳處方紙相片］');
        fakeScan('AI 辨識處方紙', function () {
          aiAddMsg(log, 'bot',
            '已辨識處方紙（陳大文）：' +
            '<table class="fd-ocr-result"><thead><tr><th>藥名</th><th>劑量</th><th>比對結果</th></tr></thead><tbody>' +
            '<tr><td>Metformin 500mg</td><td>1粒 早/晚</td><td class="fd-note-ok">✓ 與現有處方一致</td></tr>' +
            '<tr><td>Amlodipine 5mg</td><td>1粒 早</td><td class="fd-note-ok">✓ 與現有處方一致</td></tr>' +
            '<tr><td>Atorvastatin 20mg</td><td>1粒 晚</td><td class="fd-note-bad">⚠ 現有處方沒有此藥，請核實</td></tr>' +
            '</tbody></table>');
        });
        return;
      }
      var confirmBtn = e.target.closest('[data-ai-confirm]');
      if (confirmBtn) {
        confirmBtn.closest('.fd-confirm-card').innerHTML = '<span class="fd-note-ok">✓ 已為 ' + confirmBtn.dataset.aiConfirm + ' 新增覆診：2026-08-20 14:30 眼科</span>';
        return;
      }
      var cancelBtn = e.target.closest('[data-ai-cancel]');
      if (cancelBtn) {
        cancelBtn.closest('.fd-confirm-card').innerHTML = '<span class="fd-sub">已取消，未有新增任何記錄。</span>';
      }
    });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });
  }

  /* ============================================================
     9. 傷口管理 / 注射部位
     ============================================================ */

  var BODY_PARTS = [
    { id: 'head', label: '頭部', cx: 100, cy: 36 },
    { id: 'torso', label: '胸腹', cx: 100, cy: 121 },
    { id: 'arm-l', label: '左手臂', cx: 41, cy: 124 },
    { id: 'arm-r', label: '右手臂', cx: 159, cy: 124 },
    { id: 'leg-l', label: '左下肢', cx: 83, cy: 256 },
    { id: 'leg-r', label: '右下肢', cx: 117, cy: 256 }
  ];
  var woundMode = 'wound'; // wound | injection
  var woundSeq = 1;
  var injSeq = 1;
  var tenDaysAgo = new Date(Date.now() - 10 * 864e5);
  var woundEntries = [{
    id: 'W-000', type: 'wound', part: '左下肢',
    date: tenDaysAgo.getFullYear() + '-' + ('0' + (tenDaysAgo.getMonth() + 1)).slice(-2) + '-' + ('0' + tenDaysAgo.getDate()).slice(-2),
    note: '骶尾延伸傷口', cx: 83, cy: 240
  }];

  function woundOverdue(dateStr) {
    return (Date.now() - new Date(dateStr + 'T00:00:00').getTime()) > 7 * 864e5;
  }

  function partByLabel(label) {
    return BODY_PARTS.filter(function (p) { return p.label === label; })[0];
  }

  function renderWound() {
    var root = $('#demo-wound');
    if (!root) return;
    var markers = woundEntries.map(function (w) {
      return '<circle class="fd-marker-dot' + (w.type === 'injection' ? ' injection' : '') + '" cx="' + w.cx + '" cy="' + w.cy + '" r="7" />' +
        '<text x="' + w.cx + '" y="' + (w.cy + 3) + '" text-anchor="middle" font-size="7" fill="#fff" pointer-events="none">' + (w.type === 'injection' ? '注' : '傷') + '</text>';
    }).join('');
    var list = woundEntries.map(function (w) {
      var status = w.type === 'injection'
        ? '<span class="fd-badge fd-badge-ok">已記錄</span>'
        : woundOverdue(w.date)
          ? '<span class="fd-badge fd-badge-danger">每週評估逾期</span>'
          : '<span class="fd-badge fd-badge-ok">評估有效</span>';
      return '<tr><td>' + w.id + '</td><td>' + (w.type === 'injection' ? '注射' : '傷口') + '</td><td>' + w.part + '</td><td>' + (w.note || '—') + '</td><td>' + w.date + '</td><td>' + status + '</td></tr>';
    }).join('');
    root.innerHTML =
      '<div class="fd-row" style="margin-bottom:12px">' +
      '<button type="button" class="btn ' + (woundMode === 'wound' ? 'btn-primary' : 'btn-ghost') + ' btn-sm" data-mode="wound">傷口記錄</button>' +
      '<button type="button" class="btn ' + (woundMode === 'injection' ? 'btn-primary' : 'btn-ghost') + ' btn-sm" data-mode="injection">注射部位</button>' +
      '<span class="fd-sub">兩個模式共用同一幅人形圖，點部位落標記。</span></div>' +
      '<div class="fd-wound-layout">' +
      '<div><svg class="fd-body-svg" viewBox="0 0 200 340" role="img" aria-label="人形圖">' +
      '<circle class="fd-body-part" data-part="頭部" cx="100" cy="36" r="24" />' +
      '<rect class="fd-body-part" data-part="胸腹" x="68" y="66" width="64" height="110" rx="12" />' +
      '<rect class="fd-body-part" data-part="左手臂" x="28" y="72" width="26" height="104" rx="12" />' +
      '<rect class="fd-body-part" data-part="右手臂" x="146" y="72" width="26" height="104" rx="12" />' +
      '<rect class="fd-body-part" data-part="左下肢" x="70" y="186" width="26" height="140" rx="10" />' +
      '<rect class="fd-body-part" data-part="右下肢" x="104" y="186" width="26" height="140" rx="10" />' +
      markers + '</svg></div>' +
      '<div class="fd-scroll-x"><table class="fd-table"><thead><tr><th>編號</th><th>類型</th><th>部位</th><th>備註</th><th>評估日期</th><th>狀態</th></tr></thead>' +
      '<tbody>' + (list || '<tr><td colspan="6" class="fd-sub">尚未有記錄，點左圖部位新增。</td></tr>') + '</tbody></table></div>' +
      '</div>';
  }

  function initWound() {
    var root = $('#demo-wound');
    if (!root) return;
    renderWound();
    root.addEventListener('click', function (e) {
      var modeBtn = e.target.closest('[data-mode]');
      if (modeBtn) { woundMode = modeBtn.dataset.mode; renderWound(); return; }

      var part = e.target.closest('.fd-body-part');
      if (!part) return;
      var label = part.dataset.part;
      var center = partByLabel(label);
      if (woundMode === 'wound') {
        var m = openModal(
          '<h3>新增傷口記錄</h3>' +
          '<div class="fd-form-grid">' +
          '<div class="fd-field"><label>傷口編號</label><input class="fd-input" id="w-id" value="W-' + ('00' + woundSeq).slice(-3) + '" /></div>' +
          '<div class="fd-field"><label>部位</label><input class="fd-input" value="' + label + '" disabled /></div>' +
          '<div class="fd-field"><label>評估日期</label><input class="fd-input" id="w-date" type="date" value="' + todayStr() + '" /></div>' +
          '<div class="fd-field"><label>備註</label><input class="fd-input" id="w-note" placeholder="例如：1cm x 1cm，無滲液" /></div>' +
          '</div>' +
          '<div class="fd-row" style="margin-top:16px;justify-content:flex-end">' +
          '<button type="button" class="btn btn-primary btn-sm" data-act="ok">儲存</button></div>'
        );
        m.body.addEventListener('click', function (ev) {
          if (!ev.target.closest('[data-act="ok"]')) return;
          woundEntries.push({
            id: $('#w-id', m.body).value.trim() || 'W-' + ('00' + woundSeq).slice(-3),
            type: 'wound', part: label,
            date: $('#w-date', m.body).value || todayStr(),
            note: $('#w-note', m.body).value.trim(),
            cx: center.cx + (woundEntries.length % 3) * 6 - 6,
            cy: center.cy + (woundEntries.length % 2) * 10 - 5
          });
          woundSeq++;
          m.close();
          renderWound();
          toast('已新增傷口記錄（' + label + '）');
        });
      } else {
        var m2 = openModal(
          '<h3>記錄注射部位</h3>' +
          '<div class="fd-form-grid">' +
          '<div class="fd-field"><label>藥物</label><input class="fd-input" id="i-med" value="Insulin Glargine 10u" /></div>' +
          '<div class="fd-field"><label>部位</label><input class="fd-input" value="' + label + '" disabled /></div>' +
          '</div>' +
          '<div class="fd-row" style="margin-top:16px;justify-content:flex-end">' +
          '<button type="button" class="btn btn-primary btn-sm" data-act="ok">確認注射部位</button></div>'
        );
        m2.body.addEventListener('click', function (ev) {
          if (!ev.target.closest('[data-act="ok"]')) return;
          woundEntries.push({
            id: 'INJ-' + injSeq, type: 'injection', part: label,
            date: todayStr(), note: $('#i-med', m2.body).value.trim(),
            cx: center.cx - (injSeq % 3) * 6 + 6,
            cy: center.cy - (injSeq % 2) * 10 + 5
          });
          injSeq++;
          m2.close();
          renderWound();
          toast('已記錄注射部位：' + label);
        });
      }
    });
  }

  /* ============================================================
     10. 列印範本
     ============================================================ */

  var printTemplates = {
    '體溫記錄表': function (r) {
      var rows = '';
      for (var i = 1; i <= 7; i++) {
        rows += '<tr><td>8月' + (10 + i) + '日</td><td>08:00</td><td></td><td></td></tr>';
      }
      return '<table class="fd-table"><thead><tr><th>日期</th><th>時間</th><th>體溫 (°C)</th><th>簽名</th></tr></thead><tbody>' + rows + '</tbody></table>';
    },
    '約束物品觀察表': function (r) {
      var rows = '';
      ['08:00', '10:00', '12:00', '14:00', '16:00'].forEach(function (t) {
        rows += '<tr><td>' + t + '</td><td>約束帶位置正確、皮膚完整</td><td></td></tr>';
      });
      return '<p style="font-size:0.8125rem">約束物品：安全背心　｜　開始日期：2026-08-10</p>' +
        '<table class="fd-table"><thead><tr><th>時間</th><th>觀察</th><th>簽名</th></tr></thead><tbody>' + rows + '</tbody></table>';
    },
    '覆診記錄表': function (r) {
      return '<table class="fd-table"><tbody>' +
        '<tr><th>覆診日期</th><td>2026-08-20 14:30</td></tr>' +
        '<tr><th>專科 / 診所</th><td>眼科 — 博愛醫院</td></tr>' +
        '<tr><th>診斷</th><td>白內障跟進</td></tr>' +
        '<tr><th>備註</th><td>需家人陪同，自備覆診紙</td></tr>' +
        '</tbody></table>';
    }
  };

  function renderPrintPreview() {
    var tplName = $('#print-tpl').value;
    var resName = $('#print-res').value;
    var r = res(resName);
    $('#print-preview').innerHTML =
      '<div class="fd-doc">' +
      '<h4>' + tplName + '</h4>' +
      '<p class="fd-doc-org">eHMS 示範護老院 — 社署認可格式</p>' +
      '<div class="fd-doc-meta"><span>姓名：' + r.name + '</span><span>床號：' + r.bed + '</span><span>列印日期：' + todayStr() + '</span></div>' +
      printTemplates[tplName](r) +
      '</div>';
  }

  function initPrint() {
    var root = $('#demo-print');
    if (!root) return;
    root.innerHTML =
      '<div class="fd-print-layout">' +
      '<div>' +
      '<div class="fd-field"><label>範本</label><select class="fd-select" id="print-tpl">' +
      Object.keys(printTemplates).map(function (t) { return '<option>' + t + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="fd-field" style="margin-top:12px"><label>院友</label><select class="fd-select" id="print-res">' +
      RESIDENTS.map(function (r) { return '<option>' + r.name + '</option>'; }).join('') +
      '</select></div>' +
      '<button type="button" class="btn btn-primary btn-sm" style="margin-top:16px" data-act="print">列印</button>' +
      '</div>' +
      '<div id="print-preview"></div>' +
      '</div>';
    renderPrintPreview();
    root.addEventListener('change', function (e) {
      if (e.target.id === 'print-tpl' || e.target.id === 'print-res') renderPrintPreview();
    });
    root.addEventListener('click', function (e) {
      if (!e.target.closest('[data-act="print"]')) return;
      var m = openModal(
        '<h3>列印</h3>' +
        '<div class="fd-field"><label>打印機</label><select class="fd-select"><option>院舍打印機（HP LaserJet）</option><option>護理站打印機</option></select></div>' +
        '<div class="fd-field" style="margin-top:12px"><label>份數</label><select class="fd-select"><option>1</option><option>2</option></select></div>' +
        '<div class="fd-row" style="margin-top:16px;justify-content:flex-end">' +
        '<button type="button" class="btn btn-primary btn-sm" data-act="ok">確認列印</button></div>'
      );
      m.body.addEventListener('click', function (ev) {
        if (!ev.target.closest('[data-act="ok"]')) return;
        m.close();
        toast('已送出列印（示範環境不會真正列印）');
      });
    });
  }

  /* ============================================================
     11. 數據報表
     ============================================================ */

  var reportState = { tab: 'daily', date: todayStr(), month: '2026-08' };

  var DAILY_A = [['體溫監測完成', '22 / 24'], ['派藥完成', '45 / 48'], ['缺席人數', '2（入院 1、渡假 1）'], ['意外事件', '0'], ['今日覆診', '3 位']];
  var DAILY_B = [['體溫監測完成', '21 / 24'], ['派藥完成', '46 / 48'], ['缺席人數', '3（入院 2、渡假 1）'], ['意外事件', '1（已交報告）'], ['今日覆診', '2 位']];
  var MONTHLY = {
    '2026-08': [['總入住日數', '682'], ['新入住', '2'], ['退住', '1'], ['平均入住率', '91.2%'], ['約束使用個案', '3']],
    '2026-07': [['總入住日數', '701'], ['新入住', '1'], ['退住', '2'], ['平均入住率', '89.5%'], ['約束使用個案', '4']]
  };

  function reportBars(rows, maxVal, alt) {
    return '<div class="fd-bars">' + rows.map(function (r) {
      return '<div class="fd-bar-row"><span>' + r[0] + '</span>' +
        '<div class="fd-bar-track"><div class="fd-bar-fill' + (alt ? ' alt' : '') + '" style="width:' + Math.round(r[1] / maxVal * 100) + '%"></div></div>' +
        '<strong>' + r[2] + '</strong></div>';
    }).join('') + '</div>';
  }

  function kvTable(rows) {
    return '<table class="fd-table"><tbody>' + rows.map(function (r) {
      return '<tr><th>' + r[0] + '</th><td>' + r[1] + '</td></tr>';
    }).join('') + '</tbody></table>';
  }

  function renderReports() {
    var root = $('#demo-reports');
    if (!root) return;
    var tabs = [['daily', '每日報表'], ['monthly', '每月報表'], ['infection', '感染控制'], ['meals', '餐膳統計'], ['diapers', '尿片統計']];
    var html = '<div class="fd-tabs">' + tabs.map(function (t) {
      return '<button type="button" class="fd-tab' + (reportState.tab === t[0] ? ' is-active' : '') + '" data-rtab="' + t[0] + '">' + t[1] + '</button>';
    }).join('') + '</div>';

    if (reportState.tab === 'daily') {
      var isToday = reportState.date === todayStr();
      html += '<div class="fd-row" style="margin-bottom:12px"><label class="fd-sub">日期 <input type="date" class="fd-input" id="report-date" value="' + reportState.date + '" /></label>' +
        '<span class="fd-sub">（換一個日期會載入另一日數據）</span></div>' + kvTable(isToday ? DAILY_A : DAILY_B);
    } else if (reportState.tab === 'monthly') {
      html += '<div class="fd-row" style="margin-bottom:12px"><label class="fd-sub">月份 <select class="fd-select" id="report-month">' +
        Object.keys(MONTHLY).map(function (mth) {
          return '<option' + (reportState.month === mth ? ' selected' : '') + '>' + mth + '</option>';
        }).join('') + '</select></label></div>' + kvTable(MONTHLY[reportState.month]);
    } else if (reportState.tab === 'infection') {
      html += kvTable([['上呼吸道感染', '2 宗（較上月 -1）'], ['皮膚感染', '1 宗（較上月 +1）'], ['尿道炎', '1 宗（無變化）'], ['疥瘡', '0 宗']]) +
        '<p class="fd-note-ok" style="margin-top:8px">✓ 本月無爆發個案，感染控制達標。</p>';
    } else if (reportState.tab === 'meals') {
      html += reportBars([['普通餐', 18, '18 位'], ['糖尿餐', 6, '6 位'], ['碎餐', 4, '4 位'], ['糊餐', 3, '3 位']], 20, false);
    } else if (reportState.tab === 'diapers') {
      html += reportBars([['陳大文', 4.2, '4.2 片/日'], ['黃伯強', 5.1, '5.1 片/日'], ['張金好', 4.0, '4.0 片/日'], ['梁志偉', 3.3, '3.3 片/日'], ['李笑好', 2.6, '2.6 片/日']], 6, true) +
        '<p class="fd-sub" style="margin-top:8px">本月平均用量，數據來自換片記錄。</p>';
    }
    root.innerHTML = html;
  }

  function initReports() {
    var root = $('#demo-reports');
    if (!root) return;
    renderReports();
    root.addEventListener('click', function (e) {
      var tab = e.target.closest('[data-rtab]');
      if (!tab) return;
      reportState.tab = tab.dataset.rtab;
      renderReports();
    });
    root.addEventListener('change', function (e) {
      if (e.target.id === 'report-date') { reportState.date = e.target.value; renderReports(); }
      if (e.target.id === 'report-month') { reportState.month = e.target.value; renderReports(); }
    });
  }

  /* ============================================================
     12. 權限管理
     ============================================================ */

  var PERM_FEATURES = ['主控台', '院友管理', 'eMAR 藥物', '排班表', '數據報表', '權限管理'];
  var perms = {
    '主管': { '主控台': true, '院友管理': true, 'eMAR 藥物': true, '排班表': true, '數據報表': true, '權限管理': true },
    '護士': { '主控台': true, '院友管理': true, 'eMAR 藥物': true, '排班表': true, '數據報表': true, '權限管理': false },
    '護理員': { '主控台': true, '院友管理': true, 'eMAR 藥物': true, '排班表': false, '數據報表': false, '權限管理': false }
  };
  var permRole = '主管';

  function renderPermissions() {
    var root = $('#demo-permissions');
    if (!root) return;
    var rows = PERM_FEATURES.map(function (f) {
      return '<tr><th>' + f + '</th><td><input type="checkbox" data-feat="' + f + '"' + (perms[permRole][f] ? ' checked' : '') + ' /></td></tr>';
    }).join('');
    var nav = PERM_FEATURES.map(function (f) {
      return '<li class="' + (perms[permRole][f] ? '' : 'is-hidden') + '" data-nav="' + f + '">' + f + '</li>';
    }).join('');
    root.innerHTML =
      '<div class="fd-row" style="margin-bottom:12px">' +
      Object.keys(perms).map(function (role) {
        return '<button type="button" class="btn ' + (permRole === role ? 'btn-primary' : 'btn-ghost') + ' btn-sm" data-role="' + role + '">' + role + '</button>';
      }).join('') +
      '<span class="fd-sub">正編輯「' + permRole + '」的權限</span></div>' +
      '<div class="fd-perm-layout">' +
      '<div><table class="fd-table"><thead><tr><th>功能</th><th>允許使用</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="fd-mininav"><p class="fd-mininav-title">「' + permRole + '」登入後見到的選單</p><ul>' + nav + '</ul></div>' +
      '</div>';
  }

  function initPermissions() {
    var root = $('#demo-permissions');
    if (!root) return;
    renderPermissions();
    root.addEventListener('click', function (e) {
      var roleBtn = e.target.closest('[data-role]');
      if (!roleBtn) return;
      permRole = roleBtn.dataset.role;
      renderPermissions();
    });
    root.addEventListener('change', function (e) {
      var cb = e.target.closest('input[data-feat]');
      if (!cb) return;
      perms[permRole][cb.dataset.feat] = cb.checked;
      var li = $('li[data-nav="' + cb.dataset.feat + '"]', root);
      if (li) li.classList.toggle('is-hidden', !cb.checked);
      toast('已更新「' + permRole + '」權限：' + cb.dataset.feat + (cb.checked ? ' 開啟' : ' 關閉'));
    });
  }

  /* ============================================================
     13. 護理員手機版
     ============================================================ */

  var mob = { tab: 'scan', resident: null, mtab: '巡房', records: [], big: false, sync: true };
  var MOB_FORMS = {
    '巡房': { label: '狀態', options: ['正常', '休息中', '外出用膳'] },
    '換片': { label: '尿量', options: ['少量', '中量', '大量'] },
    '翻身': { label: '方位', options: ['左側臥', '仰臥', '右側臥'] },
    '衛生': { label: '項目', options: ['沐浴', '口腔護理', '洗頭', '剪指甲'] },
    '出入量': { label: '類型', options: ['入量', '出量'], amount: true }
  };

  function renderMobile() {
    var root = $('#demo-mobile');
    if (!root) return;
    var screen = '';
    if (mob.tab === 'scan') {
      screen = '<div style="text-align:center;padding-top:64px">' +
        '<p style="font-size:0.875rem;color:var(--color-text-muted);margin-bottom:16px">對準床頭 QR Code，直達院友記錄</p>' +
        '<button type="button" class="btn btn-primary" data-mscan>掃描床頭 QR</button></div>';
    } else if (mob.tab === 'residents') {
      if (!mob.resident) {
        screen = '<p class="fd-sub" style="margin-bottom:8px">院友列表</p>' +
          RESIDENTS.slice(0, 5).map(function (r) {
            return '<button type="button" class="fd-mres-item" data-mres="' + r.name + '"><span>' + r.name + '</span><span class="fd-sub">' + r.bed + '</span></button>';
          }).join('');
      } else {
        var r = res(mob.resident);
        var form = MOB_FORMS[mob.mtab];
        var formHtml = '<div class="fd-field"><label>' + form.label + '</label>' +
          '<select class="fd-select" id="mob-opt">' + form.options.map(function (o) { return '<option>' + o + '</option>'; }).join('') + '</select></div>';
        if (form.amount) {
          formHtml += '<div class="fd-field" style="margin-top:8px"><label>份量 (ml)</label><input class="fd-input" id="mob-amount" type="number" value="200" style="width:100%" /></div>';
        }
        var recs = mob.records.slice().reverse().map(function (rec) {
          return '<li>' + rec + '</li>';
        }).join('');
        screen =
          '<button type="button" class="btn btn-ghost btn-sm" data-mback>‹ 返回列表</button>' +
          '<p style="font-weight:700;margin:8px 0 0">' + r.name + ' <span class="fd-sub">' + r.bed + ' · ' + r.care + '</span></p>' +
          '<div class="fd-mtabs">' + Object.keys(MOB_FORMS).map(function (t) {
            return '<button type="button" class="fd-mtab' + (mob.mtab === t ? ' is-active' : '') + '" data-mtab="' + t + '">' + t + '</button>';
          }).join('') + '</div>' +
          formHtml +
          '<button type="button" class="btn btn-primary btn-sm" style="margin-top:10px;width:100%" data-madd>記錄</button>' +
          '<ul class="fd-mrecord-list">' + (recs || '<li>尚未有記錄</li>') + '</ul>';
      }
    } else {
      screen = '<p class="fd-sub" style="margin-bottom:12px">設定</p>' +
        '<button type="button" class="fd-mres-item" data-mset="big"><span>大字體模式</span><span class="fd-badge ' + (mob.big ? 'fd-badge-ok' : '') + '">' + (mob.big ? '開' : '關') + '</span></button>' +
        '<button type="button" class="fd-mres-item" data-mset="sync"><span>自動同步記錄</span><span class="fd-badge ' + (mob.sync ? 'fd-badge-ok' : '') + '">' + (mob.sync ? '開' : '關') + '</span></button>' +
        '<p class="fd-sub" style="margin-top:12px">eHMS 護理員版（示範）v1.0</p>';
    }
    root.innerHTML =
      '<div class="fd-phone">' +
      '<div class="fd-phone-status"><span>' + now() + '</span><span>eHMS 護理員版</span><span>▮▮▮</span></div>' +
      '<div class="fd-phone-screen"' + (mob.big ? ' style="font-size:1.15em"' : '') + '>' + screen + '</div>' +
      '<div class="fd-phone-tabbar">' +
      [['scan', '掃描'], ['residents', '院友'], ['settings', '設定']].map(function (t) {
        return '<button type="button" class="fd-ptab' + (mob.tab === t[0] ? ' is-active' : '') + '" data-ptab="' + t[0] + '">' + t[1] + '</button>';
      }).join('') +
      '</div></div>';
  }

  function initMobile() {
    var root = $('#demo-mobile');
    if (!root) return;
    renderMobile();
    root.addEventListener('click', function (e) {
      var ptab = e.target.closest('[data-ptab]');
      if (ptab) { mob.tab = ptab.dataset.ptab; renderMobile(); return; }

      if (e.target.closest('[data-mscan]')) {
        fakeScan('掃描床頭 QR Code', function () {
          mob.resident = '陳大文';
          mob.tab = 'residents';
          renderMobile();
          toast('已掃描 101-A 床頭 QR：陳大文');
        });
        return;
      }

      var mres = e.target.closest('[data-mres]');
      if (mres) { mob.resident = mres.dataset.mres; renderMobile(); return; }

      if (e.target.closest('[data-mback]')) { mob.resident = null; renderMobile(); return; }

      var mtab = e.target.closest('[data-mtab]');
      if (mtab) { mob.mtab = mtab.dataset.mtab; renderMobile(); return; }

      if (e.target.closest('[data-madd]')) {
        var opt = $('#mob-opt', root);
        var amount = $('#mob-amount', root);
        var detail = opt ? opt.value : '';
        if (amount) detail += ' ' + amount.value + 'ml';
        mob.records.push(now() + ' ' + mob.mtab + ' · ' + detail + '（' + mob.resident + '）');
        renderMobile();
        toast('已記錄：' + mob.mtab + ' · ' + detail);
        return;
      }

      var mset = e.target.closest('[data-mset]');
      if (mset) {
        var key = mset.dataset.mset;
        mob[key] = !mob[key];
        renderMobile();
      }
    });
  }

  /* ---------- 啟動 ---------- */

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
})();
