import { DEFAULT_FACILITY_SETTINGS } from './facilitySettings';

import { formatDisplayDate } from './dateFormat';
export interface CaseConferenceProfessionalInput {
  category: string;
  assessor: string;
  assessmentDate: string;
}

export interface CaseConferencePlanInput {
  bedNumber: string;
  patientName: string;
  planType: string;
  reviewDueDate: string;
  professionals?: CaseConferenceProfessionalInput[];
}

export interface CaseConferenceRoomInput {
  roomNumber: string;
  plans: CaseConferencePlanInput[];
}

export interface CaseConferenceGroupInput {
  stationName: string;
  rooms: CaseConferenceRoomInput[];
}

export interface CaseConferenceListInput {
  meetingDate: string;
  facilityName?: string;
  groups: CaseConferenceGroupInput[];
}

function formatDate(isoDate: string): string {
  if (!isoDate) return '-';
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return formatDisplayDate(d);
}

function renderProfessionals(professionals?: CaseConferenceProfessionalInput[]): string {
  if (!professionals || professionals.length === 0) {
    return '<span class="text-gray-500">-</span>';
  }
  return professionals
    .map(
      p => `<span class="prof">${p.category}：${p.assessor || '-'}<br><small>${formatDate(p.assessmentDate)}</small></span>`
    )
    .join('');
}

export function generateCaseConferenceListHtml(input: CaseConferenceListInput): string {
  const { meetingDate, facilityName = DEFAULT_FACILITY_SETTINGS.facilityNameZh, groups } = input;
  const printDate = formatDisplayDate(new Date());

  const renderRoomRows = (room: CaseConferenceRoomInput): string => {
    return room.plans
      .map((plan, index) => {
        const roomCell =
          index === 0
            ? `<td class="room-cell" rowspan="${room.plans.length}">${room.roomNumber}</td>`
            : '';
        return `<tr>
  ${roomCell}
  <td>${plan.bedNumber}</td>
  <td>${plan.patientName}</td>
  <td>${plan.planType}</td>
  <td>${formatDate(plan.reviewDueDate)}</td>
  <td class="professionals-cell">${renderProfessionals(plan.professionals)}</td>
</tr>`;
      })
      .join('\n');
  };

  const groupsHtml = groups
    .map(
      group => `<div class="station-section">
  <div class="station-title">${group.stationName}</div>
  <table>
    <thead>
      <tr>
        <th class="col-room">房號</th>
        <th class="col-bed">床號</th>
        <th class="col-name">院友姓名</th>
        <th class="col-type">計劃類型</th>
        <th class="col-due">複檢到期日</th>
        <th class="col-professionals">參與專業</th>
      </tr>
    </thead>
    <tbody>
      ${group.rooms.map(renderRoomRows).join('\n')}
    </tbody>
  </table>
</div>`
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${facilityName} 個案會議名單</title>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'Microsoft JhengHei', '微軟正黑體', 'PingFang TC', 'Heiti TC', sans-serif;
  font-size: 10pt;
  color: #111;
  line-height: 1.4;
}
@page {
  size: A4 landscape;
  margin: 8mm;
  @bottom-center {
    content: "第 " counter(page) " 頁";
    font-size: 9px;
    color: #6b7280;
  }
}
.page {
  width: 100%;
  padding: 8mm;
}
.header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  border-bottom: 2px solid #1f2937;
  padding-bottom: 4mm;
  margin-bottom: 5mm;
}
.header-left {
  flex: 1;
}
.facility-name {
  font-size: 14pt;
  font-weight: bold;
  color: #1f2937;
}
.title {
  font-size: 12pt;
  font-weight: bold;
  color: #374151;
  margin-top: 2mm;
}
.header-right {
  text-align: right;
  font-size: 9pt;
  color: #6b7280;
  line-height: 1.6;
}
.station-section {
  margin-bottom: 6mm;
  page-break-inside: auto;
}
.station-title {
  font-size: 11pt;
  font-weight: bold;
  color: #1f2937;
  border-bottom: 1px solid #374151;
  padding-bottom: 1.5mm;
  margin-bottom: 2mm;
}
table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}
 thead { display: table-header-group; }
tr {
  page-break-inside: avoid;
}
th, td {
  border: 1px solid #9ca3af;
  padding: 3mm 2mm;
  text-align: left;
  vertical-align: top;
  font-size: 9pt;
}
th {
  background: #e5e7eb;
  font-weight: 700;
  color: #374151;
}
.room-cell {
  background: #f9fafb;
  font-weight: 600;
  text-align: center;
  vertical-align: middle;
}
.col-room { width: 8%; }
.col-bed { width: 10%; }
.col-name { width: 14%; }
.col-type { width: 14%; }
.col-due { width: 14%; }
.col-professionals { width: 40%; }
.professionals-cell {
  padding: 2mm 2mm;
}
.prof {
  display: inline-block;
  margin: 1px 4px 2px 0;
  padding: 1px 4px;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 3px;
  font-size: 8pt;
  white-space: nowrap;
  line-height: 1.2;
}
.prof small {
  color: #6b7280;
}
.print-btn {
  position: fixed;
  top: 12px;
  right: 12px;
  background: #2563eb;
  color: #fff;
  border: none;
  padding: 8px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
  font-weight: 600;
  z-index: 9999;
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.4);
}
.print-btn:hover { background: #1d4ed8; }
@media screen {
  html { min-height: 100%; background: #c8ccd0; }
  body { background: #c8ccd0; padding: 0; }
  .page {
    background: #fff;
    max-width: 287mm;
    min-height: 197mm;
    margin: 10mm auto;
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.22);
  }
}
@media print {
  .no-print { display: none; }
  html, body { background: white; }
  .page { padding: 0; box-shadow: none; margin: 0; max-width: none; }
}
</style>
</head>
<body>
<button class="print-btn no-print" onclick="window.print()">列印</button>
<div class="page">
  <div class="header">
    <div class="header-left">
      <div class="facility-name">${facilityName}</div>
      <div class="title">個案會議名單</div>
    </div>
    <div class="header-right">
      會議日期：${formatDate(meetingDate)}<br>
      列印日期：${printDate}
    </div>
  </div>
  ${groupsHtml}
</div>
</body>
</html>`;
}
