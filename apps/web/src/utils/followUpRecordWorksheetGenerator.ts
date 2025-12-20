export interface FollowUpRecordData {
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
  };
}

interface FollowUpRecord {
  日期: string;
  床號: string;
  院友姓名: string;
  出發時間: string;
  覆診時間: string;
  覆診地點: string;
  覆診專科: string;
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

const prepareRecords = (appointments: FollowUpRecordData[]): FollowUpRecord[] => {
  const records: FollowUpRecord[] = appointments.map(appointment => ({
    日期: formatDate(appointment.覆診日期),
    床號: appointment.院友.床號,
    院友姓名: `${appointment.院友.中文姓氏}${appointment.院友.中文名字}`,
    出發時間: formatTimeToHHMM(appointment.出發時間 || ''),
    覆診時間: formatTimeToHHMM(appointment.覆診時間 || ''),
    覆診地點: appointment.覆診地點 || '',
    覆診專科: appointment.覆診專科 || '',
    陪診: appointment.陪診人員 || '',
    交通: appointment.交通安排 || '',
    備註: appointment.備註 || ''
  }));

  // 按日期排序，由近到遠
  records.sort((a, b) => {
    return new Date(a.日期).getTime() - new Date(b.日期).getTime();
  });

  return records;
};

export const generateFollowUpRecordWorksheet = (appointments: FollowUpRecordData[]) => {
  console.log('開始生成覆診記錄工作紙，記錄數量:', appointments.length);
  
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

const generateHTML = (records: FollowUpRecord[]): string => {
  // 計算每頁顯示的記錄數（假設每行約20px高度，A4橫向約600px可用高度）
  const recordsPerPage = 25; // 每頁約25條記錄
  const totalPages = Math.ceil(records.length / recordsPerPage);

  const generateRecordTable = (pageRecords: FollowUpRecord[]) => {
    return `
      <table class="record-table">
        <thead>
          <tr>
            <th style="width: 10%">日期</th>
            <th style="width: 6%">床號</th>
            <th style="width: 10%">院友姓名</th>
            <th style="width: 7%">出發時間</th>
            <th style="width: 7%">覆診時間</th>
            <th style="width: 18%">覆診地點</th>
            <th style="width: 10%">覆診專科</th>
            <th style="width: 10%">陪診</th>
            <th style="width: 8%">交通</th>
            <th style="width: 14%">備註</th>
          </tr>
        </thead>
        <tbody>
          ${pageRecords.map(record => `
            <tr>
              <td>${record.日期}</td>
              <td>${record.床號}</td>
              <td>${record.院友姓名}</td>
              <td>${record.出發時間}</td>
              <td>${record.覆診時間}</td>
              <td>${record.覆診地點}</td>
              <td>${record.覆診專科}</td>
              <td>${record.陪診}</td>
              <td>${record.交通}</td>
              <td>${record.備註}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
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
          <div class="page-header">
            <h1>善頤福群護老院 覆診記錄</h1>
            <div class="page-info">
              <span>生成日期: ${new Date().toLocaleDateString('zh-TW')}</span>
              <span>第 ${i + 1} 頁，共 ${totalPages} 頁</span>
            </div>
          </div>
          <div class="page-content">
            ${generateRecordTable(pageRecords)}
          </div>
          <div class="page-footer">
            <span>總記錄數: ${records.length} 筆</span>
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
      <title>覆診記錄工作紙</title>
      <style>
        @page {
          size: A4 landscape;
          margin: 15mm 10mm;
        }

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Microsoft JhengHei', 'Arial', sans-serif;
          font-size: 9pt;
          line-height: 1.3;
        }

        .page {
          width: 100%;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          position: relative;
        }

        .page-break {
          page-break-after: always;
        }

        .page-header {
          margin-bottom: 10px;
          border-bottom: 2px solid #333;
          padding-bottom: 8px;
        }

        .page-header h1 {
          font-size: 12pt;
          font-weight: bold;
          text-align: center;
          margin-bottom: 5px;
        }

        .page-info {
          display: flex;
          justify-content: space-between;
          font-size: 8pt;
          color: #666;
        }

        .page-content {
          flex: 1;
        }

        .page-footer {
          margin-top: 10px;
          padding-top: 5px;
          border-top: 1px solid #999;
          font-size: 8pt;
          text-align: right;
          color: #666;
        }

        .record-table {
          width: 100%;
          border-collapse: collapse;
        }

        .record-table th,
        .record-table td {
          border: 1px solid #666;
          padding: 4px 6px;
          text-align: center;
          font-size: 9pt;
        }

        .record-table th {
          background-color: #d0d0d0;
          font-weight: bold;
          font-size: 9pt;
        }

        .record-table td {
          background-color: #f9f9f9;
          min-height: 20px;
        }

        .record-table tbody tr:nth-child(even) td {
          background-color: #f0f0f0;
        }

        .record-table tbody tr:hover td {
          background-color: #e8e8e8;
        }

        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .page {
            min-height: auto;
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
