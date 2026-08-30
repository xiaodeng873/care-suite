/* ============================================================
   feature-dashboard.js — 主控台功能頁示範互動
   對照真實 webapp Dashboard.tsx 及其元件的結構與行為。
   ============================================================ */

(function () {
  'use strict';

  // ---------- 示範資料 ----------
  const patients = [
    { 院友id: 1, 中文姓氏: '黃', 中文名字: '伯強', 中文姓名: '黃伯強', 床號: '101' },
    { 院友id: 2, 中文姓氏: '陳', 中文名字: '大文', 中文姓名: '陳大文', 床號: '102' },
    { 院友id: 3, 中文姓氏: '李', 中文名字: '美玲', 中文姓名: '李美玲', 床號: '103' },
    { 院友id: 4, 中文姓氏: '王', 中文名字: '伯', 中文姓名: '王伯', 床號: '104' },
    { 院友id: 5, 中文姓氏: '張', 中文名字: '婆婆', 中文姓名: '張婆婆', 床號: '105' },
  ];

  const slots = [
    { key: 'breakfast', title: '早餐 (07:00 - 09:59)', bgClass: 'bg-red-100 hover:bg-red-200' },
    { key: 'lunch', title: '午餐 (10:00 - 12:59)', bgClass: 'bg-yellow-100 hover:bg-yellow-200' },
    { key: 'dinner', title: '晚餐 (13:00 - 17:59)', bgClass: 'bg-green-100 hover:bg-green-200' },
    { key: 'snack', title: '夜宵 (18:00 - 20:00)', bgClass: 'bg-purple-100 hover:bg-purple-200' },
  ];

  let monitoringGroups = [
    // 早餐
    { slot: 'breakfast', patientId: 1, isOverdue: true, tasks: [
      { count: 2, note: '服藥前', freq: '每天' }
    ]},
    { slot: 'breakfast', patientId: 2, isOverdue: false, tasks: [
      { count: 1, note: '', freq: '每天' }
    ]},
    // 午餐
    { slot: 'lunch', patientId: 3, isOverdue: false, tasks: [
      { count: 1, note: '定期', freq: '每天' }
    ]},
    // 晚餐
    { slot: 'dinner', patientId: 4, isOverdue: false, tasks: [
      { count: 3, note: '注射前', freq: '每天' }
    ]},
    // 夜宵
    { slot: 'snack', patientId: 5, isOverdue: false, tasks: [
      { count: 1, note: '', freq: '每天' }
    ]},
  ];

  let temperatureGroups = [
    { patientId: 1, isOverdue: true, tasks: [{ count: 1, note: '', freq: '每天' }] }
  ];

  let weightGroups = [
    { patientId: 2, isOverdue: false, tasks: [{ count: 1, note: '', freq: '每週' }] }
  ];

  const medication = {
    overdueWorkflows: [
      { patientId: 2, overdueCount: 3, dates: { '2026-07-28': 2, '2026-07-27': 1 } },
      { patientId: 3, overdueCount: 1, dates: { '2026-07-28': 1 } },
    ],
    pendingPrescriptions: [
      { patientId: 4, count: 2 },
    ],
    lowStockGroups: [
      { patientId: 5, source: '社康', specialty: '', remainingDays: 12, estimatedEndDate: '2026-08-10' },
    ],
  };

  let carePlans = [
    { id: 'cp1', patientId: 1, review_due_date: '2026-07-31', plan_type: '個人照顧計劃' },
    { id: 'cp2', patientId: 2, review_due_date: '2026-07-30', plan_type: '個人照顧計劃' },
  ];

  let activityRecords = [
    { patientId: 3, previousMonthCount: 1 },
    { patientId: 4, previousMonthCount: 0 },
  ];

  let notes = [
    { id: 'n1', patient_id: 1, content: '明天覆診記得帶身份證', note_date: '2026-07-29', is_completed: false, completed_at: null },
    { id: 'n2', patient_id: null, content: '交更時檢查冰箱溫度', note_date: '2026-07-29', is_completed: false, completed_at: null },
    { id: 'n3', patient_id: 2, content: '已預約足病診療', note_date: '2026-07-28', is_completed: true, completed_at: '2026-07-29' },
  ];

  const notesBadgeClass = (note) => {
    switch (note) {
      case '服藥前': return 'bg-blue-500 text-white';
      case '注射前': return 'bg-red-500 text-white';
      case '定期': return 'bg-green-500 text-white';
      case '特別關顧': return 'bg-orange-500 text-white';
      case '社康': return 'bg-purple-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const dateOnly = date.toDateString();
    const todayOnly = today.toDateString();
    const yesterdayOnly = yesterday.toDateString();
    if (dateOnly === todayOnly) return '今天';
    if (dateOnly === yesterdayOnly) return '昨天';
    const diff = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diff > 0 && diff < 7) return `${diff}天前`;
    return dateString;
  };

  const getPatient = (id) => patients.find(p => p.院友id === id);

  const refreshIcons = () => { if (typeof lucide !== 'undefined') lucide.createIcons(); };

  // ---------- Modal 共用 ----------
  const modalRoot = document.getElementById('modal-root');
  const modalBody = document.getElementById('modal-body');
  const modalPanel = document.getElementById('modal-panel');
  const modalClose = document.getElementById('modal-close');

  function openModal(html, maxWidth = 'max-w-2xl') {
    modalPanel.className = `card w-full my-6 shadow-xl relative ${maxWidth}`;
    modalBody.innerHTML = html;
    modalRoot.classList.remove('hidden');
    modalRoot.classList.add('flex');
    modalRoot.setAttribute('aria-hidden', 'false');
    refreshIcons();
    // 聚焦關閉按鈕以提升無障礙
    setTimeout(() => modalClose.focus(), 10);
  }

  function closeModal() {
    modalRoot.classList.add('hidden');
    modalRoot.classList.remove('flex');
    modalRoot.setAttribute('aria-hidden', 'true');
    modalBody.innerHTML = '';
  }

  modalClose.addEventListener('click', closeModal);
  modalRoot.addEventListener('click', (e) => {
    if (e.target === modalRoot) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modalRoot.classList.contains('hidden')) closeModal();
  });

  // ---------- 監測任務 ----------
  const monitoringContainer = document.getElementById('monitoring-tasks');

  function renderMonitoringTasks() {
    let html = '';

    slots.forEach(slot => {
      const groups = monitoringGroups.filter(g => g.slot === slot.key);
      if (!groups.length) return;
      html += `
        <div>
          <h3 class="text-base font-medium text-gray-700 mb-2 time-slot-title">${slot.title}</h3>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-2 w-full min-w-0">
            ${groups.map(g => monitoringCardHtml(g, slot.bgClass)).join('')}
          </div>
        </div>
      `;
    });

    // 體溫
    if (temperatureGroups.length) {
      html += `
        <div>
          <h3 class="text-base font-medium text-gray-700 mb-2 time-slot-title">體溫</h3>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-2 w-full min-w-0">
            ${temperatureGroups.map(g => monitoringCardHtml(g, 'bg-orange-100 hover:bg-orange-200')).join('')}
          </div>
        </div>
      `;
    }

    // 體重
    if (weightGroups.length) {
      html += `
        <div>
          <h3 class="text-base font-medium text-gray-700 mb-2 time-slot-title">體重</h3>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-2 w-full min-w-0">
            ${weightGroups.map(g => monitoringCardHtml(g, 'bg-teal-100 hover:bg-teal-200')).join('')}
          </div>
        </div>
      `;
    }

    if (!html) {
      html = `
        <div class="text-center py-8 text-gray-500">
          <i data-lucide="square-check" class="h-12 w-12 mx-auto mb-2 text-gray-300"></i>
          <p>無待處理任務</p>
        </div>
      `;
    }

    monitoringContainer.innerHTML = html;
    refreshIcons();
    bindMonitoringCards();
  }

  function monitoringCardHtml(group, bgClass) {
    const patient = getPatient(group.patientId);
    const statusClass = group.isOverdue ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800';
    const statusText = group.isOverdue ? '逾期' : '未完成';
    const chips = group.tasks.map(t => {
      const badge = t.note ? `<span class="task-note-badge text-xs ${notesBadgeClass(t.note)}">${t.note}</span>` : '';
      return `
        <span class="inline-flex flex-col px-2 py-1 bg-white/70 rounded-lg border border-white/60 text-xs text-gray-700">
          <span class="flex items-center gap-1">
            <span class="font-medium">${t.count}個項目</span>
            ${badge}
          </span>
          <span class="flex items-center gap-0.5 text-gray-500 mt-0.5">
            <i data-lucide="repeat" class="h-2.5 w-2.5 flex-shrink-0"></i>
            <span>${t.freq}</span>
          </span>
        </span>
      `;
    }).join('');
    return `
      <div
        class="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 ${bgClass} rounded-lg cursor-pointer transition-colors dashboard-task-card w-full min-w-0"
        data-patient-id="${group.patientId}"
        data-overdue="${group.isOverdue ? '1' : '0'}"
      >
        <div class="flex flex-wrap items-center gap-3 flex-1 min-w-0">
          <div class="w-10 h-10 bg-blue-100 rounded-full overflow-hidden flex items-center justify-center task-avatar flex-shrink-0">
            <i data-lucide="user" class="h-5 w-5 text-blue-600"></i>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <p class="font-medium text-gray-900">${patient ? patient.中文姓氏 + patient.中文名字 : ''}</p>
              <span class="text-xs text-gray-500">${patient ? patient.床號 : '—'}</span>
            </div>
            <div class="flex flex-wrap gap-1.5 mt-1">${chips}</div>
          </div>
          <span class="status-badge flex-shrink-0 ${statusClass}">${statusText}</span>
        </div>
      </div>
    `;
  }

  function bindMonitoringCards() {
    monitoringContainer.querySelectorAll('.dashboard-task-card').forEach(card => {
      card.addEventListener('click', () => {
        const patientId = parseInt(card.dataset.patientId, 10);
        const isOverdue = card.dataset.overdue === '1';
        if (isOverdue) {
          openCalendarModal(patientId);
        } else {
          openHealthRecordModal(patientId);
        }
      });
    });
  }

  // 月曆選逾期日期（簡化版：過去 7 天）
  function openCalendarModal(patientId) {
    const patient = getPatient(patientId);
    const today = new Date();
    const days = [];
    for (let i = 1; i <= 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push(d);
    }
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    const calendarHtml = `
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <i data-lucide="calendar" class="h-5 w-5 text-blue-600"></i>
          <h2 class="text-xl font-semibold text-gray-900">選擇補錄日期：${patient ? patient.中文姓名 : ''}</h2>
        </div>
      </div>
      <p class="text-sm text-gray-600 mb-3">紅框日期表示尚有記錄未補，點選後會開啟監測記錄視窗。</p>
      <div class="grid grid-cols-7 gap-1 mb-2">
        ${weekDays.map(d => `<div class="text-center text-xs text-gray-500 py-1">${d}</div>`).join('')}
      </div>
      <div class="grid grid-cols-7 gap-2">
        ${days.map(d => {
          const dateStr = d.toISOString().split('T')[0];
          const isMissing = true;
          return `
            <button type="button"
              class="aspect-square rounded-lg border text-sm font-medium ${isMissing ? 'border-red-300 bg-red-50 text-red-800 hover:bg-red-100' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}"
              data-date="${dateStr}"
            >${d.getDate()}</button>
          `;
        }).join('')}
      </div>
      <div class="flex gap-3 mt-5">
        <button type="button" class="btn-cancel btn-secondary flex-1">取消</button>
      </div>
    `;
    openModal(calendarHtml, 'max-w-md');
    modalBody.querySelectorAll('button[data-date]').forEach(btn => {
      btn.addEventListener('click', () => {
        const date = btn.dataset.date;
        closeModal();
        openHealthRecordModal(patientId, date);
      });
    });
    modalBody.querySelector('.btn-cancel').addEventListener('click', closeModal);
  }

  // 監測記錄 Modal（簡化版 HealthRecordModal）
  function openHealthRecordModal(patientId, presetDate) {
    const patient = getPatient(patientId);
    const today = new Date().toISOString().split('T')[0];
    const time = '08:00';
    const date = presetDate || today;

    const vitalTypes = [
      { type: '血壓', label: '血壓', unit: 'mmHg', color: 'bg-red-500' },
      { type: '脈搏', label: '脈搏', unit: '/min', color: 'bg-pink-500' },
      { type: '體溫', label: '體溫', unit: '°C', color: 'bg-orange-500' },
      { type: '血含氧量', label: '血含氧量', unit: '%', color: 'bg-blue-500' },
      { type: '呼吸', label: '呼吸', unit: '/min', color: 'bg-teal-500' },
      { type: '血糖值', label: '血糖', unit: 'mmol/L', color: 'bg-purple-500' },
      { type: '體重', label: '體重', unit: 'kg', color: 'bg-green-500' },
    ];

    const patientOptions = patients.map(p => `<option value="${p.院友id}" ${p.院友id === patientId ? 'selected' : ''}>${p.中文姓名} (${p.床號})</option>`).join('');
    const vitalButtons = vitalTypes.map(v => `
      <button type="button" data-type="${v.type}" class="vital-toggle px-3 py-1.5 rounded-full border text-sm font-medium transition-colors border-gray-300 text-gray-700 hover:bg-gray-50">
        ${v.label}
      </button>
    `).join('');

    const formHtml = `
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <i data-lucide="activity" class="h-5 w-5 text-blue-600"></i>
          <h2 class="text-xl font-semibold text-gray-900">新增監測記錄</h2>
        </div>
      </div>
      <form id="health-record-form" class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="form-label"><i data-lucide="user" class="h-4 w-4 inline mr-1"></i>院友 *</label>
            <select id="hr-patient" class="form-input w-full">${patientOptions}</select>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="form-label"><i data-lucide="calendar" class="h-4 w-4 inline mr-1"></i>日期 *</label>
              <input type="date" id="hr-date" value="${date}" required class="form-input w-full">
            </div>
            <div>
              <label class="form-label"><i data-lucide="clock" class="h-4 w-4 inline mr-1"></i>時間</label>
              <input type="time" id="hr-time" value="${time}" class="form-input w-full">
            </div>
          </div>
        </div>
        <div>
          <p class="text-sm text-gray-500 mb-2">監測項目 *（可多選）</p>
          <div class="flex flex-wrap gap-2">${vitalButtons}</div>
        </div>
        <div id="vital-inputs" class="grid grid-cols-1 md:grid-cols-2 gap-4"></div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="form-label">備註</label>
            <textarea id="hr-notes" rows="2" class="form-input w-full" placeholder="其他備註…"></textarea>
          </div>
          <div>
            <label class="form-label">記錄人員</label>
            <input type="text" id="hr-staff" value="示範用戶" class="form-input w-full">
          </div>
        </div>
        <div class="flex gap-2 pt-2">
          <button type="submit" class="btn-primary flex-1">儲存記錄</button>
          <button type="button" class="btn-cancel btn-secondary flex-1">取消</button>
        </div>
      </form>
    `;
    openModal(formHtml);

    const selectedTypes = new Set();
    const vitalInputContainer = document.getElementById('vital-inputs');

    function updateVitalInputs() {
      vitalInputContainer.innerHTML = Array.from(selectedTypes).map(type => {
        const info = vitalTypes.find(v => v.type === type);
        if (type === '血壓') {
          return `
            <div>
              <label class="form-label">血壓 (收縮壓 / 舒張壓) mmHg</label>
              <div class="flex items-center gap-2">
                <input type="text" data-type="血壓-primary" inputmode="numeric" class="form-input flex-1" placeholder="120">
                <span class="text-gray-400 flex-shrink-0">/</span>
                <input type="text" data-type="血壓-secondary" inputmode="numeric" class="form-input flex-1" placeholder="80">
              </div>
            </div>
          `;
        }
        return `
          <div>
            <label class="form-label">${info.label} (${info.unit})</label>
            <input type="text" data-type="${type}" class="form-input w-full" placeholder="">
          </div>
        `;
      }).join('');
    }

    modalBody.querySelectorAll('.vital-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        if (selectedTypes.has(type)) {
          selectedTypes.delete(type);
          btn.className = 'vital-toggle px-3 py-1.5 rounded-full border text-sm font-medium transition-colors border-gray-300 text-gray-700 hover:bg-gray-50';
        } else {
          selectedTypes.add(type);
          btn.className = 'vital-toggle px-3 py-1.5 rounded-full border text-sm font-medium transition-colors bg-blue-500 text-white border-transparent';
        }
        updateVitalInputs();
      });
    });

    document.getElementById('health-record-form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (selectedTypes.size === 0) {
        alert('請至少選擇一種監測項目');
        return;
      }
      showToast('已儲存監測記錄（示範）');
      closeModal();
      // 示範：移除同一位院友的任務卡
      removeMonitoringGroup(parseInt(document.getElementById('hr-patient').value, 10));
    });
    modalBody.querySelector('.btn-cancel').addEventListener('click', closeModal);
  }

  function removeMonitoringGroup(patientId) {
    monitoringGroups = monitoringGroups.filter(g => g.patientId !== patientId);
    temperatureGroups = temperatureGroups.filter(g => g.patientId !== patientId);
    weightGroups = weightGroups.filter(g => g.patientId !== patientId);
    renderMonitoringTasks();
  }

  // ---------- 藥物管理提醒 ----------
  const medicationContainer = document.getElementById('medication-list');
  const expandedOverdue = new Set();
  let showAllOverdue = false;
  let showAllPending = false;
  let showAllLowStock = false;

  function renderMedication() {
    const { overdueWorkflows, pendingPrescriptions, lowStockGroups } = medication;
    if (!overdueWorkflows.length && !pendingPrescriptions.length && !lowStockGroups.length) {
      medicationContainer.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">目前沒有藥物提醒</p>';
      return;
    }
    let html = '';

    // 執核派藥逾期
    if (overdueWorkflows.length) {
      const displayOverdue = showAllOverdue ? overdueWorkflows : overdueWorkflows.slice(0, 2);
      html += `
        <div>
          <div class="flex items-center gap-2 mb-2">
            <i data-lucide="clock" class="h-4 w-4 text-amber-600"></i>
            <span class="text-sm font-medium text-amber-800">執核派藥逾期</span>
          </div>
          <div class="space-y-2">
            ${displayOverdue.map(item => {
              const patient = getPatient(item.patientId);
              const dateEntries = Object.entries(item.dates).sort();
              const isExpanded = expandedOverdue.has(item.patientId);
              return `
                <div class="bg-amber-50 border border-amber-200 rounded-lg">
                  <div class="p-3 hover:bg-amber-100 cursor-pointer med-patient-row" data-patient-id="${item.patientId}">
                    <div class="flex items-center justify-between gap-3">
                      <div class="flex items-center gap-3 flex-1">
                        <div class="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                          <i data-lucide="user" class="h-5 w-5 text-amber-600"></i>
                        </div>
                        <div class="flex-1">
                          <div class="font-medium text-amber-900">${patient.中文姓氏}${patient.中文名字} <span class="text-xs text-amber-600">(${patient.床號})</span></div>
                          <div class="text-sm text-amber-700">${item.overdueCount} 個逾期流程 · ${dateEntries.length} 個日期</div>
                        </div>
                      </div>
                      <div class="flex items-center gap-1">
                        <button type="button" class="med-expand-btn p-1 hover:bg-amber-200 rounded" data-patient-id="${item.patientId}">
                          <i data-lucide="${isExpanded ? 'chevron-up' : 'chevron-down'}" class="h-4 w-4 text-amber-600"></i>
                        </button>
                        <i data-lucide="arrow-right" class="h-4 w-4 text-amber-600"></i>
                      </div>
                    </div>
                  </div>
                  ${isExpanded ? `
                    <div class="px-3 pb-3">
                      <div class="text-xs text-amber-600 font-medium mb-2">逾期日期列表：</div>
                      <div class="grid grid-cols-2 gap-2">
                        ${dateEntries.map(([date, count]) => `
                          <button type="button" class="text-left px-3 py-2 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded text-sm text-amber-900 med-date-btn" data-date="${date}">
                            <div class="font-medium">${date}</div>
                            <div class="text-xs text-amber-700">${count} 個流程</div>
                          </button>
                        `).join('')}
                      </div>
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('')}
            ${overdueWorkflows.length > 2 ? `
              <button type="button" id="med-expand-overdue" class="w-full p-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-gray-400 hover:bg-gray-50 flex items-center justify-center gap-2">
                <i data-lucide="${showAllOverdue ? 'chevron-up' : 'chevron-down'}" class="h-4 w-4"></i>
                <span>${showAllOverdue ? '收起' : `展開另外 ${overdueWorkflows.length - 2} 位`}</span>
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }

    // 待變更處方
    if (pendingPrescriptions.length) {
      const displayPending = showAllPending ? pendingPrescriptions : pendingPrescriptions.slice(0, 2);
      html += `
        <div>
          <div class="flex items-center gap-2 mb-2">
            <i data-lucide="pill" class="h-4 w-4 text-blue-600"></i>
            <span class="text-sm font-medium text-blue-800">待變更處方</span>
          </div>
          <div class="space-y-2">
            ${displayPending.map(item => {
              const patient = getPatient(item.patientId);
              return `
                <div class="p-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 cursor-pointer">
                  <div class="flex items-center justify-between gap-3">
                    <div class="flex items-center gap-3 flex-1">
                      <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                        <i data-lucide="user" class="h-5 w-5 text-blue-600"></i>
                      </div>
                      <div class="flex-1">
                        <div class="font-medium text-blue-900">${patient.中文姓氏}${patient.中文名字} <span class="text-xs text-blue-600">(${patient.床號})</span></div>
                        <div class="text-sm text-blue-700">${item.count} 個待變更處方</div>
                      </div>
                    </div>
                    <i data-lucide="arrow-right" class="h-4 w-4 text-blue-600"></i>
                  </div>
                </div>
              `;
            }).join('')}
            ${pendingPrescriptions.length > 2 ? `
              <button type="button" id="med-expand-pending" class="w-full p-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-gray-400 hover:bg-gray-50 flex items-center justify-center gap-2">
                <i data-lucide="${showAllPending ? 'chevron-up' : 'chevron-down'}" class="h-4 w-4"></i>
                <span>${showAllPending ? '收起' : `展開另外 ${pendingPrescriptions.length - 2} 位`}</span>
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }

    // 藥物庫存見底
    if (lowStockGroups.length) {
      const displayLowStock = showAllLowStock ? lowStockGroups : lowStockGroups.slice(0, 3);
      html += `
        <div>
          <div class="flex items-center gap-2 mb-2">
            <i data-lucide="package-x" class="h-4 w-4 text-rose-600"></i>
            <span class="text-sm font-medium text-rose-800">藥物庫存見底</span>
          </div>
          <div class="space-y-2">
            ${displayLowStock.map((g, idx) => {
              const patient = getPatient(g.patientId);
              return `
                <div class="p-3 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 cursor-pointer">
                  <div class="flex items-center justify-between gap-3">
                    <div class="flex items-center gap-3 flex-1">
                      <div class="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                        <i data-lucide="user" class="h-5 w-5 text-rose-600"></i>
                      </div>
                      <div class="flex-1">
                        <div class="font-medium text-rose-900">${patient.中文姓氏}${patient.中文名字} <span class="text-xs text-rose-600">(${patient.床號})</span></div>
                        <div class="text-sm text-rose-700">${g.source}${g.specialty}的藥物尚餘 ${g.remainingDays} 天服完</div>
                        <div class="text-xs text-rose-500 mt-0.5">預計結束：${g.estimatedEndDate}</div>
                      </div>
                    </div>
                    <i data-lucide="arrow-right" class="h-4 w-4 text-rose-600"></i>
                  </div>
                </div>
              `;
            }).join('')}
            ${lowStockGroups.length > 3 ? `
              <button type="button" id="med-expand-lowstock" class="w-full p-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-gray-400 hover:bg-gray-50 flex items-center justify-center gap-2">
                <i data-lucide="${showAllLowStock ? 'chevron-up' : 'chevron-down'}" class="h-4 w-4"></i>
                <span>${showAllLowStock ? '收起' : `展開另外 ${lowStockGroups.length - 3} 組`}</span>
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }

    medicationContainer.innerHTML = html;
    refreshIcons();
    bindMedicationEvents();
  }

  function bindMedicationEvents() {
    medicationContainer.querySelectorAll('.med-expand-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.patientId, 10);
        if (expandedOverdue.has(id)) expandedOverdue.delete(id);
        else expandedOverdue.add(id);
        renderMedication();
      });
    });

    const overdueBtn = document.getElementById('med-expand-overdue');
    if (overdueBtn) overdueBtn.addEventListener('click', () => { showAllOverdue = !showAllOverdue; renderMedication(); });

    const pendingBtn = document.getElementById('med-expand-pending');
    if (pendingBtn) pendingBtn.addEventListener('click', () => { showAllPending = !showAllPending; renderMedication(); });

    const lowStockBtn = document.getElementById('med-expand-lowstock');
    if (lowStockBtn) lowStockBtn.addEventListener('click', () => { showAllLowStock = !showAllLowStock; renderMedication(); });

    medicationContainer.querySelectorAll('.med-date-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        showToast(`已前往 ${btn.dataset.date} 的執核派藥頁（示範）`);
      });
    });
  }

  // ---------- 個人照顧計劃 ----------
  const careplanContainer = document.getElementById('careplan-list');

  function renderCarePlans() {
    document.getElementById('careplan-count').textContent = carePlans.length;
    if (!carePlans.length) {
      careplanContainer.innerHTML = '<p class="text-sm text-green-700 text-center py-4">本月沒有到期的計劃</p>';
      return;
    }
    careplanContainer.innerHTML = carePlans.slice(0, 5).map(plan => {
      const patient = getPatient(plan.patientId);
      return `
        <div class="p-3 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 cursor-pointer flex items-center justify-between gap-3 careplan-row" data-id="${plan.id}">
          <div>
            <div class="font-medium text-green-900">
              ${patient ? `<span class="text-sm text-gray-500">${patient.床號}</span> ${patient.中文姓氏}${patient.中文名字}` : `院友 #${plan.patientId}`}
            </div>
            <div class="text-sm text-green-700">到期：${plan.review_due_date}${plan.plan_type ? ` · ${plan.plan_type}` : ''}</div>
          </div>
          <i data-lucide="arrow-right" class="h-4 w-4 text-green-600 flex-shrink-0"></i>
        </div>
      `;
    }).join('') + (carePlans.length > 5 ? `
      <div class="p-3 text-center text-sm text-green-700 cursor-pointer hover:underline" id="careplan-view-all">
        另有 ${carePlans.length - 5} 份，點擊查看全部
      </div>
    ` : '');
    refreshIcons();
    careplanContainer.querySelectorAll('.careplan-row').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.dataset.id;
        carePlans = carePlans.filter(p => p.id !== id);
        renderCarePlans();
        showToast('已標記為處理（示範）');
      });
    });
    const viewAll = document.getElementById('careplan-view-all');
    if (viewAll) viewAll.addEventListener('click', () => showToast('已前往個人照顧計劃頁（示範）'));
  }

  // ---------- 活動記錄提醒 ----------
  const activityContainer = document.getElementById('activity-list');
  const now = new Date();
  document.getElementById('activity-month').textContent = String(now.getFullYear());
  document.getElementById('activity-month-num').textContent = String(now.getMonth() + 1);

  function renderActivity() {
    document.getElementById('activity-count').textContent = activityRecords.length;
    if (!activityRecords.length) {
      activityContainer.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">全部院友上個月活動達標</p>';
      return;
    }
    activityContainer.innerHTML = activityRecords.map(({ patientId, previousMonthCount }) => {
      const patient = getPatient(patientId);
      return `
        <button type="button" class="w-full flex items-center justify-between py-2 text-left hover:bg-gray-50 rounded-lg px-2 -mx-2 activity-row" data-patient-id="${patientId}">
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-500 w-12 shrink-0">${patient.床號}</span>
            <span class="text-sm text-gray-800">${patient.中文姓名}</span>
            <span class="status-badge bg-red-100 text-red-800">僅 ${previousMonthCount} 次</span>
          </div>
          <i data-lucide="arrow-right" class="h-4 w-4 text-gray-400"></i>
        </button>
      `;
    }).join('');
    refreshIcons();
    activityContainer.querySelectorAll('.activity-row').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.patientId, 10);
        const rec = activityRecords.find(r => r.patientId === id);
        if (rec) {
          rec.previousMonthCount += 1;
          if (rec.previousMonthCount >= 2) {
            activityRecords = activityRecords.filter(r => r.patientId !== id);
          }
          renderActivity();
          showToast('已補錄活動記錄（示範）');
        }
      });
    });
  }

  // ---------- 便條 ----------
  const notesUncompleted = document.getElementById('notes-uncompleted');
  const notesCompletedWrap = document.getElementById('notes-completed-wrap');
  const notesCompleted = document.getElementById('notes-completed');
  const notesCompletedToggle = document.getElementById('notes-completed-toggle');
  let showCompleted = false;

  function renderNotes() {
    const uncompleted = notes.filter(n => !n.is_completed).sort((a, b) => new Date(b.note_date) - new Date(a.note_date));
    const completed = notes.filter(n => n.is_completed).sort((a, b) => new Date(b.completed_at || b.note_date) - new Date(a.completed_at || a.note_date));

    document.querySelectorAll('.notes-uncompleted-count, #notes-uncompleted-count').forEach(el => el.textContent = uncompleted.length);
    document.querySelectorAll('.notes-completed-count, #notes-completed-count').forEach(el => el.textContent = completed.length);

    if (uncompleted.length) {
      notesUncompleted.innerHTML = `
        <div class="flex flex-wrap items-center gap-2 text-sm font-medium text-gray-700 mb-2">
          <i data-lucide="sticky-note" class="h-4 w-4"></i>
          <span>未完成 (${uncompleted.length})</span>
        </div>
        ${uncompleted.map(note => noteCardHtml(note)).join('')}
      `;
    } else {
      notesUncompleted.innerHTML = `
        <div class="p-8 text-center text-gray-500">
          <i data-lucide="sticky-note" class="h-12 w-12 mx-auto mb-3 text-gray-300"></i>
          <p>目前沒有未完成的便條</p>
        </div>
      `;
    }

    if (completed.length) {
      notesCompletedWrap.classList.remove('hidden');
      notesCompleted.innerHTML = completed.map(note => completedNoteHtml(note)).join('');
      notesCompleted.classList.toggle('hidden', !showCompleted);
      const icon = notesCompletedToggle.querySelector('.toggle-icon');
      if (icon) icon.setAttribute('data-lucide', showCompleted ? 'chevron-up' : 'chevron-down');
    } else {
      notesCompletedWrap.classList.add('hidden');
    }
    refreshIcons();
    bindNotesEvents();
  }

  function noteCardHtml(note) {
    const patient = note.patient_id ? getPatient(note.patient_id) : null;
    return `
      <div class="p-3 bg-yellow-50 border border-yellow-200 rounded-lg note-card" data-id="${note.id}">
        <div class="flex items-start justify-between mb-2">
          <div class="flex flex-wrap items-center gap-2">
            ${patient ? `
              <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <i data-lucide="user" class="h-4 w-4 text-blue-600"></i>
              </div>
              <span class="font-medium text-gray-900"><span class="text-sm text-gray-500">${patient.床號}</span> - ${patient.中文姓氏}${patient.中文名字}</span>
            ` : `
              <span class="font-medium text-gray-600 flex items-center">
                <i data-lucide="sticky-note" class="h-4 w-4 mr-1"></i>(無指定院友)
              </span>
            `}
          </div>
          <div class="flex items-center gap-1 text-sm text-gray-600">
            <i data-lucide="calendar" class="h-3 w-3"></i>
            <span>${formatDate(note.note_date)}</span>
          </div>
        </div>
        <p class="text-sm text-gray-700 mb-3 whitespace-pre-wrap">${note.content}</p>
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="note-edit-btn btn-primary text-sm flex items-center gap-1">
            <i data-lucide="edit" class="h-3 w-3"></i>編輯
          </button>
          <button type="button" class="note-done-btn btn-success text-sm flex items-center gap-1">
            <i data-lucide="check" class="h-3 w-3"></i>完成
          </button>
          <button type="button" class="note-del-btn btn-danger text-sm flex items-center gap-1">
            <i data-lucide="trash-2" class="h-3 w-3"></i>刪除
          </button>
        </div>
      </div>
    `;
  }

  function completedNoteHtml(note) {
    const patient = note.patient_id ? getPatient(note.patient_id) : null;
    return `
      <div class="p-2 bg-gray-50 border border-gray-200 rounded text-sm note-done-row" data-id="${note.id}">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1">
          <span class="text-gray-700">${patient ? `<span class="text-sm text-gray-500">${patient.床號}</span> ${patient.中文姓氏}${patient.中文名字}` : '(無院友)'}</span>
          <span class="text-gray-500 text-xs">${formatDate(note.note_date)}${note.completed_at ? ` (${formatDate(note.completed_at)}完成)` : ''}</span>
        </div>
        <p class="text-gray-600 line-clamp-2 mb-1">${note.content}</p>
        <button type="button" class="note-del-done text-xs text-red-600 hover:text-red-700">刪除</button>
      </div>
    `;
  }

  function bindNotesEvents() {
    notesUncompleted.querySelectorAll('.note-done-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.note-card');
        const id = card.dataset.id;
        const note = notes.find(n => n.id === id);
        if (note && confirm('確定要標記為已完成嗎？')) {
          note.is_completed = true;
          note.completed_at = new Date().toISOString().split('T')[0];
          renderNotes();
          showToast('便條已標記完成');
        }
      });
    });

    notesUncompleted.querySelectorAll('.note-del-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.note-card');
        const id = card.dataset.id;
        if (confirm('確定要刪除這個便條嗎？')) {
          notes = notes.filter(n => n.id !== id);
          renderNotes();
          showToast('便條已刪除');
        }
      });
    });

    notesUncompleted.querySelectorAll('.note-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.note-card');
        const id = card.dataset.id;
        const note = notes.find(n => n.id === id);
        openNoteModal(note);
      });
    });

    notesCompleted.querySelectorAll('.note-del-done').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = btn.closest('.note-done-row');
        const id = row.dataset.id;
        if (confirm('確定要刪除這個便條嗎？')) {
          notes = notes.filter(n => n.id !== id);
          renderNotes();
          showToast('便條已刪除');
        }
      });
    });
  }

  notesCompletedToggle.addEventListener('click', () => {
    showCompleted = !showCompleted;
    renderNotes();
  });

  document.getElementById('note-add-btn').addEventListener('click', () => openNoteModal(null));

  function openNoteModal(note) {
    const patientOptions = `<option value="">(無指定院友)</option>` + patients.map(p => `<option value="${p.院友id}" ${note && note.patient_id === p.院友id ? 'selected' : ''}>${p.中文姓名} (${p.床號})</option>`).join('');
    const html = `
      <div class="flex items-center gap-3 mb-4">
        <i data-lucide="sticky-note" class="h-5 w-5 text-blue-600"></i>
        <h2 class="text-xl font-semibold text-gray-900">${note ? '編輯便條' : '新增便條'}</h2>
      </div>
      <form id="note-form" class="space-y-4">
        <div>
          <label class="form-label">院友（選填）</label>
          <select id="note-patient" class="form-input w-full">${patientOptions}</select>
        </div>
        <div>
          <label class="form-label">日期</label>
          <input type="date" id="note-date" value="${note ? note.note_date : new Date().toISOString().split('T')[0]}" required class="form-input w-full">
        </div>
        <div>
          <label class="form-label">內容</label>
          <textarea id="note-content" rows="3" maxlength="500" required class="form-input w-full" placeholder="輸入便條內容…">${note ? note.content : ''}</textarea>
        </div>
        <div class="flex gap-2 pt-2">
          <button type="submit" class="btn-primary flex-1">${note ? '更新' : '新增'}</button>
          <button type="button" class="btn-cancel btn-secondary flex-1">取消</button>
        </div>
      </form>
    `;
    openModal(html, 'max-w-md');
    document.getElementById('note-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const patientId = document.getElementById('note-patient').value;
      const content = document.getElementById('note-content').value.trim();
      const date = document.getElementById('note-date').value;
      if (!content) return;
      if (note) {
        note.patient_id = patientId ? parseInt(patientId, 10) : null;
        note.content = content;
        note.note_date = date;
      } else {
        notes.push({
          id: 'n' + Date.now(),
          patient_id: patientId ? parseInt(patientId, 10) : null,
          content,
          note_date: date,
          is_completed: false,
          completed_at: null,
        });
      }
      closeModal();
      renderNotes();
      showToast(note ? '便條已更新' : '便條已新增');
    });
    modalBody.querySelector('.btn-cancel').addEventListener('click', closeModal);
  }

  // ---------- 拍照識別 OCR ----------
  let ocrParsedRecords = [];
  let ocrPhase = 'idle'; // idle | processing | review
  let ocrImageCount = 0;

  const ocrPreviewArea = document.getElementById('ocr-preview-area');
  const ocrUploadZone = document.getElementById('ocr-upload-zone');
  const ocrThumbs = document.getElementById('ocr-thumbs');
  const ocrRecognizeBtn = document.getElementById('ocr-recognize-btn');
  const ocrAddRowBtn = document.getElementById('ocr-add-row-btn');
  const ocrSaveAllBtn = document.getElementById('ocr-save-all-btn');
  const ocrProcessing = document.getElementById('ocr-processing');
  const ocrResultMsg = document.getElementById('ocr-result-msg');
  const ocrReviewTable = document.getElementById('ocr-review-table');
  const ocrReviewBody = document.getElementById('ocr-review-body');

  document.getElementById('ocr-open-btn').addEventListener('click', () => {
    ocrPreviewArea.classList.remove('hidden');
    document.getElementById('ocr-open-btn').classList.add('hidden');
    resetOcr();
  });

  function resetOcr() {
    ocrParsedRecords = [];
    ocrPhase = 'idle';
    ocrImageCount = 0;
    ocrThumbs.classList.add('hidden');
    ocrThumbs.innerHTML = '';
    ocrRecognizeBtn.disabled = true;
    ocrRecognizeBtn.classList.add('opacity-50');
    ocrAddRowBtn.classList.add('hidden');
    ocrSaveAllBtn.classList.add('hidden');
    ocrProcessing.classList.add('hidden');
    ocrResultMsg.classList.add('hidden');
    ocrReviewTable.classList.add('hidden');
    ocrReviewBody.innerHTML = '';
  }

  ocrUploadZone.addEventListener('click', simulateFileSelect);
  ocrUploadZone.addEventListener('dragover', e => e.preventDefault());
  ocrUploadZone.addEventListener('drop', e => {
    e.preventDefault();
    simulateFileSelect();
  });

  function simulateFileSelect() {
    if (ocrImageCount >= 2) return;
    ocrImageCount += 1;
    ocrThumbs.classList.remove('hidden');
    const thumb = document.createElement('div');
    thumb.className = 'relative w-20 h-20';
    thumb.innerHTML = `
      <div class="w-full h-full object-cover rounded-lg border border-gray-200 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-xs text-gray-500">工作紙 ${ocrImageCount}</div>
      <button type="button" class="ocr-remove-thumb absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600">
        <i data-lucide="x" class="h-3 w-3"></i>
      </button>
    `;
    ocrThumbs.appendChild(thumb);
    refreshIcons();
    thumb.querySelector('.ocr-remove-thumb').addEventListener('click', () => {
      thumb.remove();
      ocrImageCount -= 1;
      if (ocrImageCount <= 0) {
        ocrThumbs.classList.add('hidden');
        ocrRecognizeBtn.disabled = true;
        ocrRecognizeBtn.classList.add('opacity-50');
      }
    });
    ocrRecognizeBtn.disabled = false;
    ocrRecognizeBtn.classList.remove('opacity-50');
  }

  ocrRecognizeBtn.addEventListener('click', () => {
    if (!ocrImageCount) return;
    ocrPhase = 'processing';
    ocrProcessing.classList.remove('hidden');
    ocrRecognizeBtn.disabled = true;
    ocrRecognizeBtn.classList.add('opacity-50');
    setTimeout(() => {
      ocrParsedRecords = [
        { tempId: 'r1', patientId: 1, 記錄日期: '2026-07-29', 記錄時間: '08:00', sbp: 128, dbp: 82, pulse: 72, bg: 5.6, 備註: '' },
        { tempId: 'r2', patientId: 2, 記錄日期: '2026-07-29', 記錄時間: '08:00', sbp: 135, dbp: 88, pulse: 76, bg: null, 備註: '' },
        { tempId: 'r3', patientId: 3, 記錄日期: '2026-07-29', 記錄時間: '08:00', sbp: null, dbp: null, pulse: 68, bg: 6.2, 備註: '' },
      ];
      ocrPhase = 'review';
      ocrProcessing.classList.add('hidden');
      ocrAddRowBtn.classList.remove('hidden');
      ocrSaveAllBtn.classList.remove('hidden');
      showOcrResult('辨識完成，共 3 筆，請核對後儲存。', false);
      renderOcrReview();
    }, 1200);
  });

  function showOcrResult(text, isError) {
    ocrResultMsg.classList.remove('hidden', 'bg-red-50', 'border-red-200', 'text-red-700', 'bg-green-50', 'border-green-200', 'text-green-700');
    if (isError) {
      ocrResultMsg.classList.add('flex', 'bg-red-50', 'border-red-200', 'text-red-700');
      ocrResultMsg.innerHTML = `<i data-lucide="alert-triangle" class="h-4 w-4 flex-shrink-0"></i><span>${text}</span>`;
    } else {
      ocrResultMsg.classList.add('flex', 'bg-green-50', 'border-green-200', 'text-green-700');
      ocrResultMsg.innerHTML = `<i data-lucide="check-circle" class="h-4 w-4 flex-shrink-0"></i><span>${text}</span>`;
    }
    refreshIcons();
  }

  function renderOcrReview() {
    if (!ocrParsedRecords.length) {
      ocrReviewTable.classList.add('hidden');
      ocrSaveAllBtn.disabled = true;
      ocrSaveAllBtn.classList.add('opacity-50');
      showOcrResult('所有記錄已儲存完成', false);
      return;
    }
    ocrReviewTable.classList.remove('hidden');
    ocrReviewBody.innerHTML = ocrParsedRecords.map(rec => {
      const patient = getPatient(rec.patientId);
      const patientOptions = patients.map(p => `<option value="${p.院友id}" ${p.院友id === rec.patientId ? 'selected' : ''}>${p.中文姓名} (${p.床號})</option>`).join('');
      return `
        <tr class="hover:bg-gray-50 ocr-row" data-temp-id="${rec.tempId}">
          <td class="px-3 py-2">
            <select class="ocr-patient form-input text-sm w-full">${patientOptions}</select>
          </td>
          <td class="px-2 py-2"><input type="date" class="ocr-date form-input text-sm w-full" value="${rec.記錄日期}"></td>
          <td class="px-2 py-2"><input type="time" class="ocr-time form-input text-sm w-full" value="${rec.記錄時間}"></td>
          <td class="px-2 py-2"><input type="number" class="ocr-sbp form-input text-sm w-full text-right" value="${rec.sbp ?? ''}" placeholder="—"></td>
          <td class="px-2 py-2"><input type="number" class="ocr-dbp form-input text-sm w-full text-right" value="${rec.dbp ?? ''}" placeholder="—"></td>
          <td class="px-2 py-2"><input type="number" class="ocr-pulse form-input text-sm w-full text-right" value="${rec.pulse ?? ''}" placeholder="—"></td>
          <td class="px-2 py-2"><input type="number" step="0.1" class="ocr-bg form-input text-sm w-full text-right" value="${rec.bg ?? ''}" placeholder="—"></td>
          <td class="px-2 py-2"><input type="text" class="ocr-note form-input text-sm w-full" value="${rec.備註}" placeholder="備註"></td>
          <td class="px-2 py-2 text-center">
            <div class="flex items-center justify-center gap-1.5">
              <button type="button" class="ocr-save-row p-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200" title="儲存此列"><i data-lucide="save" class="h-4 w-4"></i></button>
              <button type="button" class="ocr-delete-row p-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200" title="刪除此列"><i data-lucide="trash-2" class="h-4 w-4"></i></button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
    refreshIcons();
    bindOcrRowEvents();
  }

  function bindOcrRowEvents() {
    ocrReviewBody.querySelectorAll('.ocr-save-row').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = btn.closest('.ocr-row');
        const tempId = row.dataset.tempId;
        updateRecordFromRow(row, tempId);
        if (validateRecord(ocrParsedRecords.find(r => r.tempId === tempId))) {
          ocrParsedRecords = ocrParsedRecords.filter(r => r.tempId !== tempId);
          renderOcrReview();
          showToast('已儲存 1 筆記錄（示範）');
        }
      });
    });
    ocrReviewBody.querySelectorAll('.ocr-delete-row').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = btn.closest('.ocr-row');
        ocrParsedRecords = ocrParsedRecords.filter(r => r.tempId !== row.dataset.tempId);
        renderOcrReview();
      });
    });
    ocrReviewBody.querySelectorAll('input, select').forEach(input => {
      input.addEventListener('change', () => {
        const row = input.closest('.ocr-row');
        updateRecordFromRow(row, row.dataset.tempId);
      });
    });
  }

  function updateRecordFromRow(row, tempId) {
    const rec = ocrParsedRecords.find(r => r.tempId === tempId);
    if (!rec) return;
    rec.patientId = parseInt(row.querySelector('.ocr-patient').value, 10);
    rec.記錄日期 = row.querySelector('.ocr-date').value;
    rec.記錄時間 = row.querySelector('.ocr-time').value;
    rec.sbp = row.querySelector('.ocr-sbp').value ? parseInt(row.querySelector('.ocr-sbp').value, 10) : null;
    rec.dbp = row.querySelector('.ocr-dbp').value ? parseInt(row.querySelector('.ocr-dbp').value, 10) : null;
    rec.pulse = row.querySelector('.ocr-pulse').value ? parseInt(row.querySelector('.ocr-pulse').value, 10) : null;
    rec.bg = row.querySelector('.ocr-bg').value ? parseFloat(row.querySelector('.ocr-bg').value) : null;
    rec.備註 = row.querySelector('.ocr-note').value;
  }

  function validateRecord(rec) {
    if (!rec.patientId) return false;
    if (!rec.記錄日期) return false;
    if (!rec.記錄時間) return false;
    const hasBP = rec.sbp != null && rec.dbp != null;
    const hasPulse = rec.pulse != null;
    const hasBG = rec.bg != null;
    return hasBP || hasPulse || hasBG;
  }

  ocrAddRowBtn.addEventListener('click', () => {
    const now = new Date();
    ocrParsedRecords.push({
      tempId: 'r' + Date.now(),
      patientId: '',
      記錄日期: now.toISOString().split('T')[0],
      記錄時間: now.toTimeString().slice(0, 5),
      sbp: null, dbp: null, pulse: null, bg: null, 備註: '',
    });
    renderOcrReview();
  });

  ocrSaveAllBtn.addEventListener('click', () => {
    // 先同步所有行資料
    ocrReviewBody.querySelectorAll('.ocr-row').forEach(row => updateRecordFromRow(row, row.dataset.tempId));
    const valid = ocrParsedRecords.filter(validateRecord);
    const invalid = ocrParsedRecords.length - valid.length;
    ocrParsedRecords = ocrParsedRecords.filter(r => !validateRecord(r));
    renderOcrReview();
    if (valid.length) {
      showToast(`已批量儲存 ${valid.length} 筆記錄（示範）${invalid ? `，${invalid} 筆資料不完整` : ''}`);
    } else {
      showOcrResult('沒有可儲存的完整記錄，請至少填寫一項監測數值。', true);
    }
  });

  // ---------- 匯出工作紙示範 ----------
  document.getElementById('export-worksheet-btn').addEventListener('click', () => {
    openModal(`
      <div class="flex items-center gap-3 mb-4">
        <i data-lucide="file-text" class="h-5 w-5 text-blue-600"></i>
        <h2 class="text-xl font-semibold text-gray-900">匯出監測記錄工作紙</h2>
      </div>
      <p class="text-sm text-gray-600 mb-4">真實系統會按時段、床號產生可列印的工作紙；示範只顯示選項。</p>
      <div class="space-y-3 mb-4">
        <label class="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked class="rounded border-gray-300"> 早餐時段 (07:00–09:59)</label>
        <label class="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked class="rounded border-gray-300"> 午餐時段 (10:00–12:59)</label>
        <label class="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked class="rounded border-gray-300"> 晚餐時段 (13:00–17:59)</label>
        <label class="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" class="rounded border-gray-300"> 夜宵時段 (18:00–20:00)</label>
        <label class="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" class="rounded border-gray-300"> 包含體溫 / 體重</label>
      </div>
      <div class="flex gap-2">
        <button type="button" class="btn-primary flex-1 btn-close-modal">匯出 PDF</button>
        <button type="button" class="btn-secondary flex-1 btn-close-modal">取消</button>
      </div>
    `, 'max-w-md');
    modalBody.querySelectorAll('.btn-close-modal').forEach(btn => btn.addEventListener('click', closeModal));
  });

  // 頂部「識別工作紙」按鈕直接跳到 OCR 區
  document.getElementById('scan-worksheet-btn').addEventListener('click', () => {
    document.getElementById('tour-ocr').scrollIntoView({ behavior: 'smooth' });
    document.getElementById('ocr-open-btn').click();
  });

  // ---------- Toast ----------
  function showToast(message) {
    const existing = document.querySelector('.fd-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'fd-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2200);
  }

  // ---------- 初始化 ----------
  renderMonitoringTasks();
  renderMedication();
  renderCarePlans();
  renderActivity();
  renderNotes();
})();
