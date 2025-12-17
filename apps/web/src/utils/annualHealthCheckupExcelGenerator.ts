import ExcelJS from '@zurmokeeper/exceljs';
import { saveAs } from 'file-saver';
import {
  applyPersonalMedicationListTemplate,
  extractPersonalMedicationListTemplateFormat
} from './personalMedicationListExcelGenerator';

interface ExtractedTemplate {
  columnWidths: number[];
  rowHeights: number[];
  mergedCells: string[];
  printSettings?: Partial<ExcelJS.PageSetup>;
  headerFooter?: {
    oddHeader?: string;
    oddFooter?: string;
    evenHeader?: string;
    evenFooter?: string;
    firstHeader?: string;
    firstFooter?: string;
  };
  cellData: {
    [address: string]: {
      value?: any;
      font?: Partial<ExcelJS.Font>;
      alignment?: Partial<ExcelJS.Alignment>;
      border?: Partial<ExcelJS.Borders>;
      fill?: Partial<ExcelJS.Fill>;
      numFmt?: string;
    };
  };
  pageBreaks?: {
    rowBreaks?: number[];
    colBreaks?: number[];
  };
}

interface AnnualHealthCheckupTemplateFormat {
  p1: ExtractedTemplate;
  p2: ExtractedTemplate;
  p3: ExtractedTemplate;
  p4: ExtractedTemplate;
  p5: ExtractedTemplate;
}

interface AnnualHealthCheckupExportData {
  checkup: any;
  patient: any;
  prescriptions?: any[];
}

const extractSheetFormat = async (worksheet: ExcelJS.Worksheet): Promise<ExtractedTemplate> => {
  console.log('提取工作表格式:', worksheet.name);

  const extractedTemplate: ExtractedTemplate = {
    columnWidths: [],
    rowHeights: [],
    mergedCells: [],
    cellData: {},
    pageBreaks: {
      rowBreaks: [],
      colBreaks: []
    }
  };

  const actualMaxCol = worksheet.columnCount || 20;
  const actualMaxRow = worksheet.rowCount || 50;

  console.log(`提取範圍: ${actualMaxCol} 欄 x ${actualMaxRow} 行`);

  for (let col = 1; col <= actualMaxCol; col++) {
    let width = worksheet.getColumn(col).width;
    if (width === null || width === undefined) width = 8.43;
    extractedTemplate.columnWidths.push(Math.round(width * 100) / 100);
  }

  for (let row = 1; row <= actualMaxRow; row++) {
    let height = worksheet.getRow(row).height;
    if (height === null || height === undefined) height = 15;
    extractedTemplate.rowHeights.push(Math.round(height * 100) / 100);
  }

  if (worksheet.model && worksheet.model.merges) {
    worksheet.model.merges.forEach(merge => {
      extractedTemplate.mergedCells.push(merge);
    });
  }

  if (worksheet.pageSetup) {
    extractedTemplate.printSettings = { ...worksheet.pageSetup };
  }

  if (worksheet.headerFooter) {
    extractedTemplate.headerFooter = {
      oddHeader: worksheet.headerFooter.oddHeader,
      oddFooter: worksheet.headerFooter.oddFooter,
      evenHeader: worksheet.headerFooter.evenHeader,
      evenFooter: worksheet.headerFooter.evenFooter,
      firstHeader: worksheet.headerFooter.firstHeader,
      firstFooter: worksheet.headerFooter.firstFooter
    };
  }

  try {
    const rowBreaks: number[] = [];
    const colBreaks: number[] = [];

    if (worksheet.rowBreaks && Array.isArray(worksheet.rowBreaks)) {
      rowBreaks.push(...worksheet.rowBreaks);
    }

    if (worksheet.colBreaks && Array.isArray(worksheet.colBreaks)) {
      colBreaks.push(...worksheet.colBreaks);
    }

    if ((worksheet as any).model?.rowBreaks) {
      const modelRowBreaks = (worksheet as any).model.rowBreaks;
      if (Array.isArray(modelRowBreaks)) {
        rowBreaks.push(...modelRowBreaks);
      }
    }

    if ((worksheet as any).model?.colBreaks) {
      const modelColBreaks = (worksheet as any).model.colBreaks;
      if (Array.isArray(modelColBreaks)) {
        colBreaks.push(...modelColBreaks);
      }
    }

    extractedTemplate.pageBreaks!.rowBreaks = [...new Set(rowBreaks)];
    extractedTemplate.pageBreaks!.colBreaks = [...new Set(colBreaks)];

  } catch (error) {
    console.error('提取分頁符失敗:', error);
    extractedTemplate.pageBreaks = { rowBreaks: [], colBreaks: [] };
  }

  let extractedCellCount = 0;

  for (let row = 1; row <= actualMaxRow; row++) {
    for (let col = 1; col <= actualMaxCol; col++) {
      const cell = worksheet.getCell(row, col);
      const address = cell.address;

      const cellData: any = {};

      if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
        cellData.value = cell.value;
      }

      if (cell.font) {
        cellData.font = { ...cell.font };
      }

      if (cell.alignment) {
        cellData.alignment = { ...cell.alignment };
      }

      if (cell.border) {
        cellData.border = {
          top: cell.border.top ? { ...cell.border.top } : undefined,
          left: cell.border.left ? { ...cell.border.left } : undefined,
          bottom: cell.border.bottom ? { ...cell.border.bottom } : undefined,
          right: cell.border.right ? { ...cell.border.right } : undefined,
          diagonal: cell.border.diagonal ? { ...cell.border.diagonal } : undefined,
          diagonalUp: cell.border.diagonalUp,
          diagonalDown: cell.border.diagonalDown
        };
      }

      if (cell.fill) {
        cellData.fill = { ...cell.fill };
      }

      if (cell.numFmt) {
        cellData.numFmt = cell.numFmt;
      }

      if (Object.keys(cellData).length > 0) {
        extractedTemplate.cellData[address] = cellData;
        extractedCellCount++;
      }
    }
  }
  console.log('提取了', extractedCellCount, '個儲存格的格式');

  return extractedTemplate;
};

export const extractAnnualHealthCheckupTemplateFormat = async (templateFile: File): Promise<AnnualHealthCheckupTemplateFormat> => {
  console.log('開始提取年度體檢報告書範本格式...');

  const workbook = new ExcelJS.Workbook();
  const arrayBuffer = await templateFile.arrayBuffer();
  await workbook.xlsx.load(arrayBuffer);

  console.log('工作簿包含', workbook.worksheets.length, '個工作表');

  if (workbook.worksheets.length < 5) {
    throw new Error('範本格式錯誤：需要至少5個工作表（P1-P5），但只找到 ' + workbook.worksheets.length + ' 個');
  }

  const p1Sheet = workbook.worksheets[0];
  const p2Sheet = workbook.worksheets[1];
  const p3Sheet = workbook.worksheets[2];
  const p4Sheet = workbook.worksheets[3];
  const p5Sheet = workbook.worksheets[4];

  console.log('工作表名稱:');
  console.log('  1.', p1Sheet.name, '(P1)');
  console.log('  2.', p2Sheet.name, '(P2)');
  console.log('  3.', p3Sheet.name, '(P3)');
  console.log('  4.', p4Sheet.name, '(P4)');
  console.log('  5.', p5Sheet.name, '(P5)');

  const p1Format = await extractSheetFormat(p1Sheet);
  const p2Format = await extractSheetFormat(p2Sheet);
  const p3Format = await extractSheetFormat(p3Sheet);
  const p4Format = await extractSheetFormat(p4Sheet);
  const p5Format = await extractSheetFormat(p5Sheet);

  console.log('年度體檢報告書範本格式提取完成！');

  return {
    p1: p1Format,
    p2: p2Format,
    p3: p3Format,
    p4: p4Format,
    p5: p5Format
  };
};

const calculateAge = (birthDate: string): number => {
  if (!birthDate) return 0;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

const formatCheckboxValue = (value: boolean): { yes: string; no: string } => {
  return {
    yes: value ? 'Yes  ☑' : 'Yes  ☐',
    no: value ? 'No  ☐' : 'No  ☑'
  };
};

const applyTemplateFormat = (
  worksheet: ExcelJS.Worksheet,
  template: ExtractedTemplate
): void => {
  template.columnWidths.forEach((width, idx) => {
    worksheet.getColumn(idx + 1).width = width;
  });

  template.rowHeights.forEach((height, idx) => {
    worksheet.getRow(idx + 1).height = height;
  });

  Object.entries(template.cellData).forEach(([address, cellData]) => {
    const cell = worksheet.getCell(address);

    if (cellData.value !== undefined) {
      cell.value = cellData.value;
    }
    if (cellData.font) {
      cell.font = cellData.font;
    }
    if (cellData.alignment) {
      cell.alignment = cellData.alignment;
    }
    if (cellData.border) {
      cell.border = cellData.border;
    }
    if (cellData.fill) {
      cell.fill = cellData.fill;
    }
    if (cellData.numFmt) {
      cell.numFmt = cellData.numFmt;
    }
  });

  template.mergedCells.forEach(merge => {
    try {
      worksheet.mergeCells(merge);
    } catch (e) {
      console.warn('合併儲存格失敗:', merge);
    }
  });

  if (template.printSettings) {
    worksheet.pageSetup = { ...template.printSettings };
  }

  if (template.headerFooter) {
    worksheet.headerFooter = {
      oddHeader: template.headerFooter.oddHeader,
      oddFooter: template.headerFooter.oddFooter,
      evenHeader: template.headerFooter.evenHeader,
      evenFooter: template.headerFooter.evenFooter,
      firstHeader: template.headerFooter.firstHeader,
      firstFooter: template.headerFooter.firstFooter
    };
  }

  if (template.pageBreaks) {
    if (template.pageBreaks.rowBreaks && template.pageBreaks.rowBreaks.length > 0) {
      worksheet.rowBreaks = template.pageBreaks.rowBreaks.map(br => ({ id: br, max: 16383, man: true }));
    }
    if (template.pageBreaks.colBreaks && template.pageBreaks.colBreaks.length > 0) {
      worksheet.colBreaks = template.pageBreaks.colBreaks.map(br => ({ id: br, max: 1048575, man: true }));
    }
  }
};

const applyP1Template = (
  worksheet: ExcelJS.Worksheet,
  template: ExtractedTemplate,
  checkup: any,
  patient: any
): void => {
  console.log('應用 P1 工作表範本...');

  applyTemplateFormat(worksheet, template);

  const chineseName = `${patient.中文姓氏 || ''}${patient.中文名字 || ''}`;
  const englishName = patient.英文姓氏 && patient.英文名字
    ? `${patient.英文姓氏} ${patient.英文名字}`
    : patient.英文姓名 || '';

  worksheet.getCell('B3').value = `${chineseName} ${englishName}`.trim();
  worksheet.getCell('F3').value = patient.性別 || '';
  worksheet.getCell('H3').value = calculateAge(patient.出生日期);
  worksheet.getCell('C4').value = patient.身份證號碼 || '';

  const seriousIllness = formatCheckboxValue(checkup.has_serious_illness);
  worksheet.getCell('G8').value = seriousIllness.yes;
  worksheet.getCell('H8').value = seriousIllness.no;
  worksheet.getCell('D11').value = checkup.serious_illness_details || '';

  const allergy = formatCheckboxValue(checkup.has_allergy);
  worksheet.getCell('G12').value = allergy.yes;
  worksheet.getCell('H12').value = allergy.no;
  worksheet.getCell('C15').value = checkup.allergy_details || '';

  const infectiousDisease = formatCheckboxValue(checkup.has_infectious_disease);
  worksheet.getCell('G16').value = infectiousDisease.yes;
  worksheet.getCell('H16').value = infectiousDisease.no;
  worksheet.getCell('C19').value = checkup.infectious_disease_details || '';

  const followupTreatment = formatCheckboxValue(checkup.needs_followup_treatment);
  worksheet.getCell('G20').value = followupTreatment.yes;
  worksheet.getCell('H20').value = followupTreatment.no;
  worksheet.getCell('B24').value = checkup.followup_treatment_details || '';

  const swallowingDifficulty = formatCheckboxValue(checkup.has_swallowing_difficulty);
  worksheet.getCell('G25').value = swallowingDifficulty.yes;
  worksheet.getCell('H25').value = swallowingDifficulty.no;
  worksheet.getCell('C28').value = checkup.swallowing_difficulty_details || '';

  const specialDiet = formatCheckboxValue(checkup.has_special_diet);
  worksheet.getCell('G29').value = specialDiet.yes;
  worksheet.getCell('H29').value = specialDiet.no;
  worksheet.getCell('C32').value = checkup.special_diet_details || '';

  worksheet.getCell('B35').value = checkup.mental_illness_record || '';

  console.log('P1 工作表範本應用完成');
};

const applyP2Template = (
  worksheet: ExcelJS.Worksheet,
  template: ExtractedTemplate,
  checkup: any
): void => {
  console.log('應用 P2 工作表範本...');

  applyTemplateFormat(worksheet, template);

  const bloodPressure = (checkup.blood_pressure_systolic && checkup.blood_pressure_diastolic)
    ? `${checkup.blood_pressure_systolic}/${checkup.blood_pressure_diastolic}`
    : '';
  worksheet.getCell('A3').value = bloodPressure;
  worksheet.getCell('C3').value = checkup.pulse || '';
  worksheet.getCell('E3').value = checkup.body_weight || '';

  worksheet.getCell('C5').value = checkup.cardiovascular_notes || '';
  worksheet.getCell('C6').value = checkup.respiratory_notes || '';
  worksheet.getCell('C7').value = checkup.central_nervous_notes || '';
  worksheet.getCell('C8').value = checkup.musculo_skeletal_notes || '';
  worksheet.getCell('C9').value = checkup.abdomen_urogenital_notes || '';
  worksheet.getCell('C10').value = checkup.lymphatic_notes || '';
  worksheet.getCell('C11').value = checkup.thyroid_notes || '';
  worksheet.getCell('C12').value = checkup.skin_condition_notes || '';
  worksheet.getCell('C13').value = checkup.foot_notes || '';
  worksheet.getCell('C14').value = checkup.eye_ear_nose_throat_notes || '';
  worksheet.getCell('C15').value = checkup.oral_dental_notes || '';
  worksheet.getCell('C16').value = checkup.physical_exam_others || '';

  console.log('P2 工作表範本應用完成');
};

const applyStrikethroughToText = (
  cell: ExcelJS.Cell,
  fullText: string,
  strikethroughPart: string
): void => {
  const parts = fullText.split(strikethroughPart);
  if (parts.length === 2) {
    const richText: ExcelJS.RichText[] = [];

    if (parts[0]) {
      richText.push({ text: parts[0] });
    }

    richText.push({
      font: { strike: true },
      text: strikethroughPart
    });

    if (parts[1]) {
      richText.push({ text: parts[1] });
    }

    cell.value = { richText };
  }
};

const applyP3Template = (
  worksheet: ExcelJS.Worksheet,
  template: ExtractedTemplate,
  checkup: any
): void => {
  console.log('應用 P3 工作表範本...');

  applyTemplateFormat(worksheet, template);

  const visionOptions = ['正常', '不能閱讀報紙字體', '不能觀看電視', '只能見光影'];
  const visionCells = ['B2', 'D2', 'F2', 'H2'];

  const visionText = 'Vision視力(with/without*visual corrective devices有／沒有*配戴視力矯正器)';
  const visionCell = worksheet.getCell('A2');

  if (checkup.with_visual_corrective_devices === true) {
    applyStrikethroughToText(visionCell, visionText, '沒有');
  } else if (checkup.with_visual_corrective_devices === false) {
    applyStrikethroughToText(visionCell, visionText, '有');
  } else {
    visionCell.value = visionText;
  }

  visionCell.font = { ...visionCell.font, bold: true };

  visionOptions.forEach((option, idx) => {
    if (checkup.vision_assessment === option) {
      worksheet.getCell(visionCells[idx]).value = '☑';
    }
  });

  const hearingOptions = ['正常', '難以正常聲浪溝通', '難以話語的情況下也難以溝通', '大聲話語情況下也不能溝通'];
  const hearingCells = ['B3', 'D3', 'F3', 'H3'];

  const hearingText = 'Hearing聽覺 (with/without* hearing aids有／沒有*配戴助聽器)';
  const hearingCell = worksheet.getCell('A3');

  if (checkup.with_hearing_aids === true) {
    applyStrikethroughToText(hearingCell, hearingText, '沒有');
  } else if (checkup.with_hearing_aids === false) {
    applyStrikethroughToText(hearingCell, hearingText, '有');
  } else {
    hearingCell.value = hearingText;
  }

  hearingCell.font = { ...hearingCell.font, bold: true };

  hearingOptions.forEach((option, idx) => {
    if (checkup.hearing_assessment === option) {
      worksheet.getCell(hearingCells[idx]).value = '☑';
    }
  });

  const speechOptions = ['能正常表達', '需慢慢表達', '需靠提示表達', '不能以語言表達'];
  const speechCells = ['B4', 'D4', 'F4', 'H4'];
  speechOptions.forEach((option, idx) => {
    if (checkup.speech_assessment === option) {
      worksheet.getCell(speechCells[idx]).value = '☑';
    }
  });

  let mentalStateData: { mental_state: string; dementia_stage: string } = { mental_state: '', dementia_stage: '' };
  if (checkup.mental_state_assessment) {
    try {
      mentalStateData = JSON.parse(checkup.mental_state_assessment);
    } catch (e) {
      console.warn('解析精神狀況資料失敗，使用預設值');
    }
  }

  const mentalStateGroupA = ['正常警覺穩定', '輕度受困擾', '中度受困擾', '嚴重受困擾'];
  const mentalStateCellsA = ['B5', 'D5', 'F5', 'H5'];
  mentalStateGroupA.forEach((option, idx) => {
    if (mentalStateData.mental_state === option) {
      worksheet.getCell(mentalStateCellsA[idx]).value = '☑';
    }
  });

  const mentalStateGroupB = ['早期認知障礙症', '中期認知障礙症', '後期認知障礙症'];
  const mentalStateCellsB = ['D6', 'F6', 'H6'];
  mentalStateGroupB.forEach((option, idx) => {
    if (mentalStateData.dementia_stage === option) {
      worksheet.getCell(mentalStateCellsB[idx]).value = '☑';
    }
  });

  const mobilityOptions = ['獨立行動', '可自行用助行器或輪椅移動', '經常需要別人幫助', '長期臥床'];
  const mobilityCells = ['B7', 'D7', 'F7', 'H7'];
  mobilityOptions.forEach((option, idx) => {
    if (checkup.mobility_assessment === option) {
      worksheet.getCell(mobilityCells[idx]).value = '☑';
    }
  });

  const continenceOptions = ['正常', '偶然大小便失禁', '頻繁大小便失禁', '大小便完全失禁'];
  const continenceCells = ['B8', 'D8', 'F8', 'H8'];
  continenceOptions.forEach((option, idx) => {
    if (checkup.continence_assessment === option) {
      worksheet.getCell(continenceCells[idx]).value = '☑';
    }
  });

  const adlOptions = ['完全獨立', '偶爾需要協助', '經常需要協助', '完全需要協助'];
  const adlCells = ['B9', 'B10', 'B11', 'B12'];
  adlOptions.forEach((option, idx) => {
    if (checkup.adl_assessment === option) {
      worksheet.getCell(adlCells[idx]).value = '☑';
    }
  });

  console.log('P3 工作表範本應用完成');
};

const applyP4Template = (
  worksheet: ExcelJS.Worksheet,
  template: ExtractedTemplate,
  checkup: any
): void => {
  console.log('應用 P4 工作表範本...');

  applyTemplateFormat(worksheet, template);

  if (checkup.recommendation === '低度照顧安老院') {
    worksheet.getCell('A3').value = '☑';
  }
  if (checkup.recommendation === '中度照顧安老院') {
    worksheet.getCell('A5').value = '☑';
  }
  if (checkup.recommendation === '高度照顧安老院') {
    worksheet.getCell('A7').value = '☑';
  }
  if (checkup.recommendation === '護養院') {
    worksheet.getCell('A9').value = '☑';
  }

  const a2Cell = worksheet.getCell('A2');
  a2Cell.border = {
    ...a2Cell.border,
    right: { style: 'thin' }
  };

  console.log('P4 工作表範本應用完成');
};

const applyP5Template = (
  worksheet: ExcelJS.Worksheet,
  template: ExtractedTemplate
): void => {
  console.log('應用 P5 工作表範本（深層複製）...');

  applyTemplateFormat(worksheet, template);

  console.log('P5 工作表範本應用完成');
};

export const exportAnnualHealthCheckupsToExcel = async (
  exportData: AnnualHealthCheckupExportData[],
  annualHealthCheckupTemplate: any,
  personalMedicationListTemplate?: any,
  includePersonalMedicationList: boolean = true
): Promise<void> => {
  try {
    console.log('開始匯出年度體檢報告書...');
    console.log('匯出院友數量:', exportData.length);
    console.log('是否包含個人藥物記錄:', includePersonalMedicationList);

    if (!annualHealthCheckupTemplate.extracted_format) {
      throw new Error('年度體檢範本格式無效');
    }

    const templateFormat = annualHealthCheckupTemplate.extracted_format as AnnualHealthCheckupTemplateFormat;

    if (!templateFormat.p1 || !templateFormat.p2 || !templateFormat.p3 || !templateFormat.p4 || !templateFormat.p5) {
      const missingSheets = [];
      if (!templateFormat.p1) missingSheets.push('P1');
      if (!templateFormat.p2) missingSheets.push('P2');
      if (!templateFormat.p3) missingSheets.push('P3');
      if (!templateFormat.p4) missingSheets.push('P4');
      if (!templateFormat.p5) missingSheets.push('P5');
      throw new Error(`範本格式不完整：缺少工作表 ${missingSheets.join(', ')}。\n\n請到「範本管理」頁面重新上傳「安老院住客體格檢驗報告書」範本。\n範本檔案必須包含 P1-P5 共5個工作表。`);
    }

    let personalMedFormat: any = null;
    if (includePersonalMedicationList && personalMedicationListTemplate?.extracted_format) {
      personalMedFormat = personalMedicationListTemplate.extracted_format;
    }

    const today = new Date().toISOString().split('T')[0];

    for (const data of exportData) {
      const { checkup, patient, prescriptions } = data;
      const patientName = `${patient.中文姓氏 || ''}${patient.中文名字 || ''}`;

      console.log(`\n處理院友: ${patient.床號} ${patientName}`);

      const workbook = new ExcelJS.Workbook();

      const p1Sheet = workbook.addWorksheet('P1');
      applyP1Template(p1Sheet, templateFormat.p1, checkup, patient);

      if (includePersonalMedicationList && personalMedFormat && prescriptions && prescriptions.length > 0) {
        console.log('  建立個人藥物記錄工作表');
        const medListSheet = workbook.addWorksheet('個人藥物記錄');
        await applyPersonalMedicationListTemplate(medListSheet, personalMedFormat, patient, prescriptions, 'medication_name');
      }

      const p2Sheet = workbook.addWorksheet('P2');
      applyP2Template(p2Sheet, templateFormat.p2, checkup);

      const p3Sheet = workbook.addWorksheet('P3');
      applyP3Template(p3Sheet, templateFormat.p3, checkup);

      const p4Sheet = workbook.addWorksheet('P4');
      applyP4Template(p4Sheet, templateFormat.p4, checkup);

      const p5Sheet = workbook.addWorksheet('P5');
      applyP5Template(p5Sheet, templateFormat.p5);

      const filename = `${patient.床號}_${patient.中文姓氏}${patient.中文名字}_年度體檢報告書_${today}.xlsx`;

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      saveAs(blob, filename);

      console.log(`  匯出完成: ${filename}`);
    }

    console.log(`\n全部匯出完成，共 ${exportData.length} 個檔案`);

  } catch (error: any) {
    console.error('匯出年度體檢報告書失敗:', error);
    throw error;
  }
};
