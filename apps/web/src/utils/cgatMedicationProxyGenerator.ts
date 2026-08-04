import type { CgatRecord, Patient } from '../lib/database';
import { getFeeExemptEligibility, calcAge, calcCgatFee } from './cgatFeeHelper';
import proxyTemplate from '../../../../upload/doc_html/院舍取藥委託書.html?raw';
import { getPrintBedNumber } from './bedTransferUtils';


function formatIdForProxy(idNumber?: string): string {
  return idNumber || '';
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function bedSortKey(bedNumber: string): [string, number, number] {
  const match = bedNumber.match(/^([A-Za-z]+)(\d+)(?:-(\d+))?$/);
  if (!match) return [bedNumber, 0, 0];
  return [match[1].toUpperCase(), parseInt(match[2], 10), parseInt(match[3] || '0', 10)];
}

function compareBed(a: string, b: string): number {
  const [a1, a2, a3] = bedSortKey(a);
  const [b1, b2, b3] = bedSortKey(b);
  if (a1 !== b1) return a1.localeCompare(b1, 'zh-Hant');
  if (a2 !== b2) return a2 - b2;
  return a3 - b3;
}

function getIdCode(patient: Patient | undefined, record: CgatRecord): string {
  if (!patient) return 'EP1';

  if (patient.入住類型 === '院舍卷級別0' || patient.入住類型 === '院舍卷級別1-7') return 'TPA';
  if (patient.社會福利?.type === '綜合社會保障援助') return 'TPA';

  const age = calcAge(patient.出生日期);
  if (patient.社會福利?.subtype === '長者生活津貼' && age !== null && age >= 75) {
    return 'TPA';
  }

  if (patient.公務員 === '公務員/家屬') {
    return 'GOV';
  }

  if (patient.公務員 === '醫管局員工/家屬') {
    return 'HAS';
  }

  if (record.fee_exempted) {
    return '其他有豁免';
  }

  return 'EP1';
}

interface ProxyItem {
  bedNumber: string;
  name: string;
  idNumber: string;
  idCode: string;
}

function buildProxyItems(records: CgatRecord[], patientMap: Map<number, Patient>): ProxyItem[] {
  const eligible = records.filter(r => r.medication_pickup_arrangement === '院舍代勞');
  return eligible
    .map(r => {
      const patient = patientMap.get(r.patient_id);
      return {
        bedNumber: patient ? getPrintBedNumber(patient) : '',
        name: patient ? `${patient.中文姓氏 || ''}${patient.中文名字 || ''}` : '',
        idNumber: formatIdForProxy(patient?.身份證號碼),
        idCode: getIdCode(patient, r),
      };
    })
    .sort((a, b) => compareBed(a.bedNumber, b.bedNumber));
}

function buildProxyRows(items: ProxyItem[]): string {
  const rows: string[] = [];
  for (let i = 0; i < items.length; i += 2) {
    const left = items[i];
    const right = items[i + 1];
    rows.push(`
      <tr>
        <td><textarea rows="1">${escapeHtml(left.name)}</textarea></td>
        <td><textarea rows="1">${escapeHtml(left.idNumber)}</textarea></td>
        <td><textarea rows="1">${escapeHtml(left.idCode)}</textarea></td>
        <td><textarea rows="1">${escapeHtml(right?.name ?? '')}</textarea></td>
        <td><textarea rows="1">${escapeHtml(right?.idNumber ?? '')}</textarea></td>
        <td><textarea rows="1">${escapeHtml(right?.idCode ?? '')}</textarea></td>
      </tr>
    `);
  }
  return rows.join('');
}

function parseDateParts(dateStr?: string): { year: string; month: string; day: string } {
  if (!dateStr) return { year: '', month: '', day: '' };
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { year: '', month: '', day: '' };
  return {
    year: String(d.getFullYear()),
    month: String(d.getMonth() + 1),
    day: String(d.getDate()),
  };
}

function generateProxyHtml(
  records: CgatRecord[],
  patients: Patient[],
  proxyDate: string,
  proxyPerson: string,
  prescriptionPaperCount: string,
  facilityName: string,
  facilityPhone: string,
  staffName: string
): string {
  const patientMap = new Map<number, Patient>();
  for (const p of patients) {
    patientMap.set(p.院友id, p);
  }

  const items = buildProxyItems(records, patientMap);
  const dateParts = parseDateParts(proxyDate);
  const proxyRows = buildProxyRows(items);
  const patientCount = items.length;

  const totalFee = records.reduce((sum, r) => {
    const patient = patientMap.get(r.patient_id);
    const fee = calcCgatFee({
      patient,
      feeExempted: r.fee_exempted,
      medicationPickupArrangement: r.medication_pickup_arrangement,
      consultationFee: r.consultation_fee,
      medicationFeePerItem: r.medication_fee_per_item,
      prescriptionCount: r.prescription_count,
      treatmentWeeks: r.treatment_weeks,
    });
    return sum + (fee.skipped ? 0 : fee.total);
  }, 0);

  // 取代模板中的關鍵 textarea 佔位內容
  let html = proxyTemplate;

  // 日期：於 __ 年 __ 月 __ 日
  html = html.replace(
    /<td style="width: 15%;"><textarea rows="1" style="text-align: center;"><\/textarea><\/td>\s*<td style="width: 3%;">年<\/td>\s*<td style="width: 10%;"><textarea rows="1" style="text-align: center;"><\/textarea><\/td>\s*<td style="width: 3%;">月<\/td>\s*<td style="width: 10%;"><textarea rows="1" style="text-align: center;"><\/textarea><\/td>\s*<td style="width: 20%;">日提取醫生處方之藥物。<\/td>/,
    `<td style="width: 15%;"><textarea rows="1" style="text-align: center;">${escapeHtml(dateParts.year)}</textarea></td>
            <td style="width: 3%;">年</td>
            <td style="width: 10%;"><textarea rows="1" style="text-align: center;">${escapeHtml(dateParts.month)}</textarea></td>
            <td style="width: 3%;">月</td>
            <td style="width: 10%;"><textarea rows="1" style="text-align: center;">${escapeHtml(dateParts.day)}</textarea></td>
            <td style="width: 20%;">日提取醫生處方之藥物。</td>`
  );

  // 現委託本院職員
  html = html.replace(
    /<td style="width: 25%;"><textarea rows="1"><\/textarea><\/td>\s*<td style="width: 15%;">員工證號碼（適用者）<\/td>/,
    `<td style="width: 25%;"><textarea rows="1">${escapeHtml(proxyPerson)}</textarea></td>
            <td style="width: 15%;">員工證號碼（適用者）</td>`
  );

  // 底部負責人
  html = html.replace(
    /<td style="width: 8%; text-align: right;">負責人：<\/td>\s*<td style="width: 32%;"><textarea rows="1"><\/textarea><\/td>/,
    `<td style="width: 8%; text-align: right;">負責人：</td>
            <td style="width: 32%;"><textarea rows="1">${escapeHtml(staffName)}</textarea></td>`
  );

  // 安老院／護老院名稱
  html = html.replace(
    /<td style="width: 40%;"><textarea rows="1" style="text-align: right;"><\/textarea><\/td>\s*<td style="width: 15%; text-align: right;">安老院／護老院<\/td>/,
    `<td style="width: 40%;"><textarea rows="1" style="text-align: right;">${escapeHtml(facilityName)}</textarea></td>
            <td style="width: 15%; text-align: right;">安老院／護老院</td>`
  );

  // 院舍電話：請致電 __ 與本院護士 __ 聯絡
  html = html.replace(
    /<td style="width: 22%;">\* 如需進一步有關資料，請致電<\/td>\s*<td style="width: 25%;"><textarea rows="1"><\/textarea><\/td>\s*<td style="width: 10%;">與本院護士<\/td>\s*<td style="width: 25%;"><textarea rows="1"><\/textarea><\/td>\s*<td style="width: 18%;">聯絡。<\/td>/,
    `<td style="width: 22%;">* 如需進一步有關資料，請致電</td>
            <td style="width: 25%;"><textarea rows="1">${escapeHtml(facilityPhone)}</textarea></td>
            <td style="width: 10%;">與本院護士</td>
            <td style="width: 25%;"><textarea rows="1">${escapeHtml(staffName)}</textarea></td>
            <td style="width: 18%;">聯絡。</td>`
  );

  // 負責人下方日期：同樣使用 proxyDate
  html = html.replace(
    /<td style="width: 45%;"><\/td>\s*<td style="width: 15%; border-bottom: 0\.5px solid black;"><\/td>\s*<td style="width: 5%; text-align: center;">年<\/td>\s*<td style="width: 10%; border-bottom: 0\.5px solid black;"><\/td>\s*<td style="width: 5%; text-align: center;">月<\/td>\s*<td style="width: 10%; border-bottom: 0\.5px solid black;"><\/td>\s*<td style="width: 10%; text-align: center;">日<\/td>/,
    `<td style="width: 45%;"></td>
            <td style="width: 15%; border-bottom: 0.5px solid black; text-align: center;">${escapeHtml(dateParts.year)}</td>
            <td style="width: 5%; text-align: center;">年</td>
            <td style="width: 10%; border-bottom: 0.5px solid black; text-align: center;">${escapeHtml(dateParts.month)}</td>
            <td style="width: 5%; text-align: center;">月</td>
            <td style="width: 10%; border-bottom: 0.5px solid black; text-align: center;">${escapeHtml(dateParts.day)}</td>
            <td style="width: 10%; text-align: center;">日</td>`
  );

  // 取消頁碼 + 避免從身份代號說明區到結尾跨頁切斷
  html = html.replace(
    /<\/head>/,
    `<style>
      .page-num, .doc-code { display: none !important; }
      .avoid-break-to-end { break-inside: avoid; page-break-inside: avoid; }
    </style></head>`
  );

  html = html.replace(
    /<td style="width: 15%;"><textarea rows="1" style="text-align: center;"><\/textarea><\/td>\s*<td style="width: 12%;">份\/病人，<\/td>\s*<td style="width: 15%;"><textarea rows="1" style="text-align: center;"><\/textarea><\/td>\s*<td style="width: 43%;">張藥單紙<\/td>/,
    `<td style="width: 15%;"><textarea rows="1" style="text-align: center;">${patientCount}</textarea></td>
            <td style="width: 12%;">份/病人，</td>
            <td style="width: 15%;"><textarea rows="1" style="text-align: center;">${escapeHtml(prescriptionPaperCount)}</textarea></td>
            <td style="width: 43%;">張藥單紙</td>`
  );

  // 乙部表格替換
  html = html.replace(
    /<tbody>\s*<tr><td><textarea rows="1"><\/textarea><\/td><td><textarea rows="1"><\/textarea><\/td><td><textarea rows="1"><\/textarea><\/td><td><textarea rows="1"><\/textarea><\/td><td><textarea rows="1"><\/textarea><\/td><td><textarea rows="1"><\/textarea><\/td><\/tr>\s*(?:<tr><td><textarea rows="1"><\/textarea><\/td><td><textarea rows="1"><\/textarea><\/td><td><textarea rows="1"><\/textarea><\/td><td><textarea rows="1"><\/textarea><\/td><td><textarea rows="1"><\/textarea><\/td><td><textarea rows="1"><\/textarea><\/td><\/tr>\s*){4,}<\/tbody>/,
    `<tbody>${proxyRows}</tbody>`
  );

  // 注意事項：補上總繳費金額
  html = html.replace(
    /<div class="footer-note">\s*\* 注意：如病人在取藥前已經入院或死亡，則請及早通知社區老人評估組護士或藥劑部職員跟進藥單，否則已配發藥物，不能退款\s*<\/div>/,
    `<div class="footer-note">* 注意：如病人在取藥前已經入院或死亡，則請及早通知社區老人評估組護士或藥劑部職員跟進藥單，否則已配發藥物，不能退款; 請帶備足夠本次繳費的金額(不少於HKD$${totalFee})。</div>`
  );

  return html;
}

function printViaIframe(html: string): void {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.left = '-10000px';
  iframe.style.top = '0';
  iframe.style.width = '794px';
  iframe.style.height = '1123px';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const cleanup = (): void => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  };

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    cleanup();
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const win = iframe.contentWindow!;
  win.addEventListener('afterprint', () => setTimeout(cleanup, 200));

  const triggerPrint = (): void => {
    window.setTimeout(() => {
      win.focus();
      win.print();
    }, 400);
  };

  if (doc.readyState === 'complete') {
    triggerPrint();
  } else {
    win.addEventListener('load', triggerPrint);
  }

  window.setTimeout(cleanup, 60_000);
}

export async function printCgatMedicationProxy(
  records: CgatRecord[],
  patients: Patient[],
  selectedRecordIds: string[],
  proxyDate: string,
  proxyPerson: string,
  prescriptionPaperCount: string,
  staffName: string
): Promise<void> {
  if (selectedRecordIds.length === 0) {
    alert('請先選擇要列印的 CGAT 記錄');
    return;
  }

  const selectedRecords = records.filter(r => selectedRecordIds.includes(r.id));
  const eligibleRecords = selectedRecords.filter(r => r.medication_pickup_arrangement === '院舍代勞');

  if (eligibleRecords.length === 0) {
    alert('選擇的記錄中沒有「院舍代勞」的取藥安排');
    return;
  }

  const { getFacilitySettings, DEFAULT_FACILITY_SETTINGS } = await import('./facilitySettings');
  const settings = await getFacilitySettings();
  const facilityName = settings.facilityNameZh || DEFAULT_FACILITY_SETTINGS.facilityNameZh;
  const facilityPhone = settings.facilityPhone || DEFAULT_FACILITY_SETTINGS.facilityPhone;

  const html = generateProxyHtml(eligibleRecords, patients, proxyDate, proxyPerson, prescriptionPaperCount, facilityName, facilityPhone, staffName);
  printViaIframe(html);
}
