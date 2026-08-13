import type { Patient } from '../../lib/database';
import type { DocumentGeneratorContext } from '../patientPrintBundleGenerator';
import { scopeCssText, scopeInlineScripts } from '../cssScope';
import { getPrintBedNumber } from '../bedTransferUtils';



const escapeHtml = (text: string | number | undefined | null): string => {
  if (text == null) return '';
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return String(text).replace(/[&<>"']/g, (m) => map[m]);
};

const setTagValue = (tag: string, value: string): string => {
  if (/value="[^"]*"/i.test(tag)) return tag.replace(/value="[^"]*"/i, `value="${escapeHtml(value)}"`);
  return tag.replace(/\/?>$/, ` value="${escapeHtml(value)}">`);
};

/**
 * 在指定標籤文字後的第一個 text input 填入值（容許標籤與 input 之間夾雜其他標籤，只取第一個匹配）。
 * 供個別 generator 做範本專屬填入。
 */
export function fillInputAfterLabel(html: string, labelPattern: string, value: string): string {
  if (!value) return html;
  const re = new RegExp(`(${labelPattern}[^<]{0,40}(?:<[^>]+>[^<]{0,40}){0,8}?)(<input(?![^>]*checkbox)[^>]*>)`, 'i');
  return html.replace(re, (_m, prefix: string, tag: string) => prefix + setTagValue(tag, value));
}

/** 直接把值寫入 input 標籤（供個別 generator 做範本專屬填入） */
export function setInputTagValue(tag: string, value: string): string {
  return setTagValue(tag, value);
}

/**
 * 通用 doc_html 範本處理器：
 * 1. 替換硬編碼院舍名稱
 * 2. 填入基本資料
 */
export function processDocHtmlTemplate(
  template: string,
  ctx: DocumentGeneratorContext,
  options: {
    /** 依 input/textarea 的 name 精準填入值（空白文件模式會被跳過） */
    fieldValues?: Record<string, string>;
    /** 依 checkbox 的 name 勾選（空白文件模式會被跳過） */
    checkedBoxes?: string[];
  } = {}
): string {
  const { facilityName } = ctx;

  let html = template;

  // 1. 替換院舍名稱（常見寫法，含舊範本遺留的 'SeniorCare' 佔位字）
  // 這裡的 'SeniorCare' 是用來清掃舊 HTML 範本的硬編碼文字，不是當成院舍名稱顯示
  const hardcodedNames = [
    '善頤(福群)護老院',
    '善頤（福群）護老院',
    '善頤護老院',
    '善頤護老',
    'SeniorCare',
  ];
  hardcodedNames.forEach(name => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(new RegExp(escaped, 'g'), escapeHtml(facilityName));
  });

  // 2. 範本預留的院舍名稱 placeholder（所有模式都填，屬表格身份一部分）
  html = html.replace(
    /<input[^>]*placeholder="安老院名稱"[^>]*>/gi,
    (tag) => setTagValue(tag, facilityName)
  );

  // 3. 填入基本資料（空白文件模式則完全留空）
  if (ctx.contentMode !== 'blank') {
  const { patient } = ctx;
  const name = patient.中文姓名 || `${patient.中文姓氏 || ''}${patient.中文名字 || ''}`;
  const englishName = patient.英文姓名 || `${patient.英文姓氏 || ''}${patient.英文名字 || ''}`;
  const hkid = patient.身份證號碼 || '';
  const bedNumber = getPrintBedNumber(patient);
  const gender = patient.性別 || '';
  const birthDate = patient.出生日期 || '';
  const admissionDate = patient.入住日期 || '';
  const age = birthDate ? calculateAge(birthDate) : '';

  // 在指定標籤文字後的第一個 text input 填入值（容許標籤與 input 之間夾雜其他標籤/&nbsp;，只取第一個匹配）
  const fillAfterLabel = (labelPattern: string, value: string) => {
    if (!value) return;
    const re = new RegExp(`(${labelPattern}[^<]{0,40}(?:<[^>]+>[^<]{0,40}){0,8}?)(<input(?![^>]*checkbox)[^>]*>)`, 'i');
    html = html.replace(re, (_m, prefix: string, tag: string) => prefix + setTagValue(tag, value));
  };

  fillAfterLabel('院友姓名', name);
  fillAfterLabel('[（(]英文[）)]', englishName);
  fillAfterLabel('房\\s*/\\s*床號|房床號', bedNumber);
  fillAfterLabel('床號', bedNumber);
  fillAfterLabel('性別\\s*/\\s*年齡', gender + (age !== '' ? `/${age}歲` : ''));
  fillAfterLabel('出生日期', birthDate);
  fillAfterLabel('入住\\s*本院\\s*日期|入住日期', admissionDate);

  // 依 input name 填入值
  const fillByName = (fieldName: string, value: string) => {
    if (!value) return;
    const escapedName = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(
      new RegExp(`<input[^>]*name="${escapedName}"[^>]*>`, 'gi'),
      (tag) => setTagValue(tag, value)
    );
  };

  // 通用 name 屬性寫法
  fillByName('name_ch', name);
  fillByName('name_en', englishName);
  fillByName('id_card', hkid);

  // 依 name 精準填入（template 專屬欄位）
  if (options.fieldValues) {
    Object.entries(options.fieldValues).forEach(([fieldName, value]) => {
      if (!value) return;
      fillByName(fieldName, value);
      const escapedName = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // <textarea name="...">...</textarea>
      html = html.replace(
        new RegExp(`(<textarea[^>]*name="${escapedName}"[^>]*>)[\\s\\S]*?(<\\/textarea>)`, 'gi'),
        `$1${escapeHtml(value)}$2`
      );
    });
  }

  // 依 name 勾選 checkbox
  if (options.checkedBoxes) {
    options.checkedBoxes.forEach((boxName) => {
      const escapedName = boxName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      html = html.replace(
        new RegExp(`<input([^>]*type="checkbox"[^>]*name="${escapedName}"[^>]*|[^>]*name="${escapedName}"[^>]*type="checkbox"[^>]*)>`, 'gi'),
        (tag) => (/\schecked/i.test(tag) ? tag : tag.replace(/\/?>$/, ' checked>'))
      );
    });
  }
  }

  // 4. 範本若沒有 @page 規則，注入 margin:0（這類範本以 .a4-page 全幅設計，自帶內距當邊界）
  if (!/@page/.test(html)) {
    html = html.replace(/<\/head>/i, '<style>@page { size: A4; margin: 0; }</style></head>');
  }

  // 5. 回傳完整 HTML 文件（保留 <head> 內的 <style>，否則合併列印時會遺失範本樣式）
  return html;
}

/**
 * 合併多份完整 HTML 文件為一份：
 * - 各文件的 <style> 選擇器全部加上各自的容器 class 前綴（避免全域樣式互相污染）
 * - 各 <body> 內容包進對應容器 div，頁與頁之間自動分頁
 * 供多頁範本（如 個人及健康記錄 P1+P2）使用。
 */
export function combineDocHtmlDocuments(docs: string[]): string {
  const styles: string[] = [];
  const bodies: string[] = [];

  docs.forEach((doc, i) => {
    const scopeClass = `doc-page-${i}`;
    const styleMatches = doc.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];
    styles.push(
      ...styleMatches.map((styleTag) =>
        styleTag.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/i, (_m, open: string, inner: string, close: string) =>
          open + scopeCssText(inner, scopeClass) + close
        )
      )
    );
    const bodyMatch = doc.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const rawBody = bodyMatch ? bodyMatch[1].trim() : doc.trim();
    bodies.push(`<div class="${scopeClass}">${scopeInlineScripts(rawBody, scopeClass)}</div>`);
  });

  return `<!DOCTYPE html>
<html lang="zh-HK">
<head>
<meta charset="UTF-8">
<style>
  html, body { margin: 0; padding: 0; }
  [class*="doc-page-"] + [class*="doc-page-"] { page-break-before: always; break-before: page; }
</style>
${styles.join('\n')}
</head>
<body>
${bodies.join('\n')}
</body>
</html>`;
}

function calculateAge(birthDate: string): number | '' {
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}
