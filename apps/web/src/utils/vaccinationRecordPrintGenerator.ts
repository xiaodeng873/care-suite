import { formatDisplayDate } from './dateFormat';
import { getPrintBedNumber } from './bedTransferUtils';
import type { VaccinationRecord } from '../lib/database';
import { getFacilitySettings } from './facilitySettings';

// 疫苗接種記錄（A4 直印，每位院友獨立一張）
// 表頭樣式參考生命表徵觀察記錄表／入住文件；頁尾只有頁碼，無文件編碼。
// 內容分 4 個區塊（流感／肺炎鏈球菌／新冠／其他），區塊內按接種日期小至大排序，
// 整個區塊 break-inside: avoid，超頁時成塊搬到下一頁，唔會喺表格中間斷開。

interface VaccPrintPatient {
  床號?: string;
  original_bed_number?: string;
  中文姓名?: string;
  中文姓氏?: string;
  中文名字?: string;
  身份證號碼?: string;
  性別?: string;
  出生日期?: string;
}

const escapeHtml = (str: string | undefined | null): string => {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const calculateAge = (birthDate?: string | null): string => {
  if (!birthDate) return '';
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return '';
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age >= 0 ? String(age) : '';
};

const BLOCK_TITLES = ['一、流感疫苗', '二、肺炎鏈球菌疫苗', '三、新冠疫苗', '四、其他疫苗'] as const;

/** 新增疫苗記錄時強制選擇嘅疫苗類別（同 BLOCK_TITLES 次序一致） */
export const VACCINE_CATEGORIES: readonly string[] = ['流感疫苗', '肺炎鏈球菌疫苗', '新冠疫苗', '其他疫苗'];

/** 每個 avoid-break 區塊最多嘅資料列數：超過就拆成多塊（每塊都帶表頭），
 *  保證單塊一定細過一頁，唔會出現成頁空白嘅病態分頁 */
const CHUNK_SIZE = 15;

/** 優先用記錄上嘅疫苗類別；舊記錄冇類別就用疫苗名稱關鍵字推斷 */
const classifyVaccine = (record: VaccinationRecord): number => {
  const byCategory = VACCINE_CATEGORIES.indexOf(record.vaccine_category || '');
  if (byCategory >= 0) return byCategory;
  const item = (record.vaccine_item || '').toLowerCase();
  if (item.includes('流感')) return 0;
  if (item.includes('肺炎')) return 1;
  if (
    item.includes('新冠') ||
    item.includes('covid') ||
    item.includes('復必泰') ||
    item.includes('科興') ||
    item.includes('coronavac') ||
    item.includes('biontech')
  ) {
    return 2;
  }
  return 3;
};

/** 用疫苗名稱關鍵字推斷類別（新增記錄時自動填入；舊記錄打印分類都會用） */
export const guessVaccineCategory = (item: string): string => {
  const idx = classifyVaccine({ vaccine_item: item } as VaccinationRecord);
  return VACCINE_CATEGORIES[idx];
};

export const generateVaccinationRecordHtml = (
  patient: VaccPrintPatient,
  records: VaccinationRecord[],
  facilityName: string
): string => {
  const blocks: VaccinationRecord[][] = [[], [], [], []];
  for (const r of records) {
    blocks[classifyVaccine(r)].push(r);
  }
  blocks.forEach(list =>
    list.sort((a, b) => (a.vaccination_date || '').localeCompare(b.vaccination_date || ''))
  );

  const patientName = patient.中文姓名 || `${patient.中文姓氏 || ''}${patient.中文名字 || ''}`;

  const sections = blocks.map((list, i) => {
    const rowsHtml = (rows: VaccinationRecord[]) => rows.length === 0
      ? '<tr><td></td><td></td></tr>'
      : rows.map(r => `<tr><td>${escapeHtml(formatDisplayDate(r.vaccination_date))}</td><td>${escapeHtml(r.vaccine_item)}</td></tr>`).join('');
    const tableHtml = (rows: VaccinationRecord[]) => `
      <table>
        <colgroup><col style="width: 38mm;"><col></colgroup>
        <thead>
          <tr><th>接種日期</th><th>疫苗名稱</th></tr>
        </thead>
        <tbody>${rowsHtml(rows)}</tbody>
      </table>`;
    if (list.length === 0) {
      return `
    <div class="vacc-section">
      <h3>${BLOCK_TITLES[i]}</h3>
      ${tableHtml([])}
    </div>`;
    }
    const chunks: VaccinationRecord[][] = [];
    for (let c = 0; c < list.length; c += CHUNK_SIZE) {
      chunks.push(list.slice(c, c + CHUNK_SIZE));
    }
    return chunks.map((chunk, ci) => `
    <div class="vacc-section">
      ${ci === 0 ? `<h3>${BLOCK_TITLES[i]}</h3>` : ''}
      ${tableHtml(chunk)}
    </div>`).join('');
  }).join('');

  return `<!DOCTYPE html>
<html lang="zh-HK">
<head>
  <meta charset="UTF-8">
  <title>疫苗接種記錄 - ${escapeHtml(patientName)}</title>
  <style>
    @page {
      size: A4;
      margin: 10mm 0.25in 12mm 0.25in;
      @bottom-center { content: "第 " counter(page) " 頁"; font-family: "DFKai-SB", "BiauKai", "標楷體", serif; font-size: 12px; }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: "DFKai-SB", "BiauKai", "標楷體", serif;
      background-color: #fff;
      width: 100%;
      color: #000;
      font-size: 13px;
    }
    .sheet {
      display: flex;
      flex-direction: column;
      min-height: 271mm; /* 297 - 10 - 12 - 4(頁尾空位) */
    }
    .title-section { text-align: center; margin-bottom: 10px; }
    .title-section h1 { margin: 0; font-size: 26px; font-weight: bold; letter-spacing: 2px; }
    .title-section h2 { margin: 4px 0 0 0; font-size: 22px; font-weight: bold; display: inline-block; border-bottom: 1.5px solid black; padding-bottom: 2px; }
    .info-row { display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 8px; }
    .db-line-input { border: none; border-bottom: 1px solid black; background: transparent; font-family: inherit; font-size: 13px; text-align: center; }
    .vacc-section { break-inside: avoid; page-break-inside: avoid; margin-bottom: 6mm; }
    .vacc-section h3 { font-size: 16px; font-weight: bold; margin-bottom: 2mm; }
    .vacc-section table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .vacc-section th, .vacc-section td { border: 1px solid black; text-align: center; vertical-align: middle; height: 26px; font-size: 13px; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="title-section">
      <h1>${escapeHtml(facilityName)}</h1>
      <h2>疫苗接種記錄</h2>
    </div>
    <div class="info-row">
      <span>院友姓名：<input type="text" class="db-line-input" style="width: 70px;" value="${escapeHtml(patientName)}" readonly></span>
      <span>身份証號碼：<input type="text" class="db-line-input" style="width: 105px;" value="${escapeHtml(patient.身份證號碼 || '')}" readonly></span>
      <span>床號：<input type="text" class="db-line-input" style="width: 55px;" value="${escapeHtml(getPrintBedNumber({ original_bed_number: patient.original_bed_number ?? null, 床號: patient.床號 ?? null }))}" readonly></span>
      <span>性別：<input type="text" class="db-line-input" style="width: 35px;" value="${escapeHtml(patient.性別 || '')}" readonly></span>
      <span>年齡：<input type="text" class="db-line-input" style="width: 40px;" value="${escapeHtml(calculateAge(patient.出生日期))}" readonly></span>
    </div>
    ${sections}
  </div>
</body>
</html>`;
};

/** 個別列印：主表格操作列嘅列印圖標用 */
export const printVaccinationRecord = async (
  patient: VaccPrintPatient,
  records: VaccinationRecord[]
): Promise<void> => {
  const settings = await getFacilitySettings();
  const html = generateVaccinationRecordHtml(patient, records, settings.facilityNameZh);

  const existingIframe = document.getElementById('vaccination-record-print-iframe');
  if (existingIframe) {
    document.body.removeChild(existingIframe);
  }

  const iframe = document.createElement('iframe');
  iframe.id = 'vaccination-record-print-iframe';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentWindow?.document;
  if (!iframeDoc) {
    alert('無法建立列印預覽，請重試');
    document.body.removeChild(iframe);
    return;
  }

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 250);
  };
};
