export interface FollowUpBagCoverData {
  覆診id: string;
  院友id: number;
  覆診日期: string;
  出發時間?: string;
  覆診時間?: string;
  覆診地點?: string;
  覆診專科?: string;
  交通安排?: string;
  陪診人員?: string;
  備註?: string;
  院友: {
    床號: string;
    中文姓氏: string;
    中文名字: string;
    英文名字?: string;
  };
}

interface CoverRecord {
  姓名: string;
  覆診日期: string;
  地點: string;
  覆診時間: string;
  專科: string;
  出發時間: string;
  陪診: string;
  交通: string;
  備註: string;
}

const formatTimeToHHMM = (timeStr: string): string => {
  if (!timeStr) return '';
  
  // 如果已經是 HH:MM 格式，直接返回
  if (timeStr.match(/^\d{2}:\d{2}$/)) {
    return timeStr;
  }
  
  // 如果是 HH:MM:SS 格式，截取前5位
  if (timeStr.match(/^\d{2}:\d{2}:\d{2}$/)) {
    return timeStr.slice(0, 5);
  }
  
  // 其他格式嘗試解析
  try {
    const date = new Date(`2000-01-01T${timeStr}`);
    if (!isNaN(date.getTime())) {
      return date.toTimeString().slice(0, 5);
    }
  } catch (error) {
    console.warn('無法解析時間格式:', timeStr);
  }
  
  return timeStr;
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });
};

const formatChineseNameWithEnglishInitial = (
  中文姓氏: string,
  中文名字: string,
  英文名字?: string
): string => {
  if (!中文名字) return 中文姓氏;
  
  // 如果有英文名字且中文名字長度至少為1
  if (英文名字 && 中文名字.length >= 1) {
    // 取英文名字的第一個字母（大寫）
    const englishInitial = 英文名字.charAt(0).toUpperCase();
    // 如果中文名字只有一個字，直接替換
    if (中文名字.length === 1) {
      return `${中文姓氏}${englishInitial}`;
    }
    // 如果中文名字有多個字，替換第一個字，保留其餘部分
    const remainingName = 中文名字.substring(1);
    return `${中文姓氏}${englishInitial}${remainingName}`;
  }
  
  // 沒有英文名字時，返回完整中文姓名
  return `${中文姓氏}${中文名字}`;
};

const prepareRecords = (appointments: FollowUpBagCoverData[]): CoverRecord[] => {
  const records: CoverRecord[] = appointments.map(appointment => ({
    姓名: formatChineseNameWithEnglishInitial(
      appointment.院友.中文姓氏,
      appointment.院友.中文名字,
      appointment.院友.英文名字
    ),
    覆診日期: formatDate(appointment.覆診日期),
    地點: appointment.覆診地點 || '',
    覆診時間: formatTimeToHHMM(appointment.覆診時間 || ''),
    專科: appointment.覆診專科 || '',
    出發時間: formatTimeToHHMM(appointment.出發時間 || ''),
    陪診: appointment.陪診人員 || '',
    交通: appointment.交通安排 || '',
    備註: appointment.備註 || ''
  }));

  // 按日期排序，由近到遠
  records.sort((a, b) => {
    return new Date(a.覆診日期).getTime() - new Date(b.覆診日期).getTime();
  });

  return records;
};

export const generateFollowUpBagCover = (appointments: FollowUpBagCoverData[]) => {
  console.log('開始生成覆診袋封面，記錄數量:', appointments.length);
  
  if (appointments.length === 0) {
    alert('沒有選擇任何覆診記錄');
    return;
  }

  const records = prepareRecords(appointments);
  console.log('生成 HTML...');
  const html = generateHTML(records);
  console.log('HTML 長度:', html.length);
  console.log('開啟打印窗口...');
  openPrintWindow(html);
};

const generateHTML = (records: CoverRecord[]): string => {
  // 每頁4筆記錄
  const recordsPerPage = 4;
  const totalPages = Math.ceil(records.length / recordsPerPage);

  const generateCoverCard = (record: CoverRecord) => {
    return `
      <div class="cover-card">
        <div class="cover-header">
          <h2>善頤(福群)護老院</h2>
          <h3>院友覆診資料</h3>
        </div>
        <div class="cover-content">
          <div class="cover-row">
            <div class="cover-label">姓名：</div>
            <div class="cover-value">${record.姓名}</div>
            <div class="cover-label">覆診日期：</div>
            <div class="cover-value">${record.覆診日期}</div>
          </div>
          <div class="cover-row">
            <div class="cover-label">地點：</div>
            <div class="cover-value cover-value-wide">${record.地點}</div>
            <div class="cover-label">覆診時間：</div>
            <div class="cover-value">${record.覆診時間}</div>
          </div>
          <div class="cover-row">
            <div class="cover-label">專科：</div>
            <div class="cover-value">${record.專科}</div>
            <div class="cover-label">出發時間：</div>
            <div class="cover-value">${record.出發時間}</div>
          </div>
          <div class="cover-row">
            <div class="cover-label">陪診：</div>
            <div class="cover-value">${record.陪診}</div>
            <div class="cover-label">交通：</div>
            <div class="cover-value">${record.交通}</div>
          </div>
          <div class="cover-row-full">
            <div class="cover-label">備註：</div>
            <div class="cover-value-full">${record.備註}</div>
          </div>
        </div>
      </div>
    `;
  };

  const generatePages = () => {
    const pages: string[] = [];
    
    for (let i = 0; i < totalPages; i++) {
      const startIndex = i * recordsPerPage;
      const endIndex = Math.min(startIndex + recordsPerPage, records.length);
      const pageRecords = records.slice(startIndex, endIndex);
      
      const isLastPage = i === totalPages - 1;
      
      pages.push(`
        <div class="page${!isLastPage ? ' page-break' : ''}">
          <div class="grid">
            ${pageRecords.map(record => generateCoverCard(record)).join('')}
          </div>
          <div class="page-footer">
            <span>第 ${i + 1} 頁，共 ${totalPages} 頁 | 生成日期: ${new Date().toLocaleDateString('zh-TW')}</span>
          </div>
        </div>
      `);
    }
    
    return pages.join('');
  };

  return `
    <!DOCTYPE html>
    <html lang="zh-TW">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>覆診袋封面</title>
      <style>
        @page {
          size: A4 landscape;
          margin: 10mm;
        }

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Microsoft JhengHei', 'Arial', sans-serif;
          font-size: 11pt;
          line-height: 1.4;
        }

        .page {
          width: 100%;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          position: relative;
          padding: 5mm;
        }

        .page-break {
          page-break-after: always;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1fr 1fr;
          gap: 8mm;
          flex: 1;
          width: 100%;
          height: calc(100vh - 15mm);
        }

        .cover-card {
          border: 2px solid #333;
          padding: 6mm;
          display: flex;
          flex-direction: column;
          background-color: white;
        }

        .cover-header {
          text-align: center;
          margin-bottom: 5mm;
          padding-bottom: 3mm;
          border-bottom: 2px solid #333;
        }

        .cover-header h2 {
          font-size: 14pt;
          font-weight: bold;
          margin-bottom: 2mm;
        }

        .cover-header h3 {
          font-size: 12pt;
          font-weight: bold;
        }

        .cover-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4mm;
        }

        .cover-row {
          display: grid;
          grid-template-columns: auto 1fr auto 1fr;
          gap: 3mm;
          align-items: center;
        }

        .cover-row-full {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 3mm;
          align-items: start;
        }

        .cover-label {
          font-weight: bold;
          font-size: 11pt;
          white-space: nowrap;
        }

        .cover-value {
          border-bottom: 1px solid #666;
          min-height: 24px;
          padding: 2px 4px;
          font-size: 11pt;
        }

        .cover-value-wide {
          grid-column: span 1;
        }

        .cover-value-full {
          border-bottom: 1px solid #666;
          min-height: 50px;
          padding: 2px 4px;
          font-size: 11pt;
        }

        .page-footer {
          margin-top: 3mm;
          padding-top: 2mm;
          border-top: 1px solid #999;
          font-size: 9pt;
          text-align: center;
          color: #666;
        }

        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .page {
            min-height: auto;
          }

          .grid {
            height: auto;
          }
        }
      </style>
    </head>
    <body>
      ${generatePages()}
    </body>
    </html>
  `;
};

const openPrintWindow = (html: string) => {
  // 創建隱藏的 iframe
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  
  document.body.appendChild(iframe);
  
  const iframeDoc = iframe.contentWindow?.document;
  if (!iframeDoc) {
    alert('無法創建列印預覽，請重試');
    document.body.removeChild(iframe);
    return;
  }

  // 寫入 HTML 內容
  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  // 等待內容加載完成後觸發列印
  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      
      // 列印完成後移除 iframe
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 250);
  };
};
