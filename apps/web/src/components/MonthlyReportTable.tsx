import React from 'react';

interface MonthlyReportRow {
  patientId: number;
  bedNumber: string;
  name: string;
  半護理: number;
  全護理: number;
  導尿管: number;
  遊走: number;
  情緒問題: number;
  因情緒問題而轉介: number;
  長期卧床: number;
  長期使用輪椅: number;
  一人協助: number;
  二人協助: number;
  需餵食: number;
  鼻胃飼: number;
  腹膜血液透析: number;
  造口: number;
  氧氣治療: number;
  皮下注射: number;
  呼吸器: number;
  善終: number;
  化療: number;
  放射治療: number;
  服藥9種或以上: number;
  入住醫院: number;
  認知障礙: number;
  錯發藥物: number;
  失禁: number;
  如廁訓練: number;
  壓瘡: number;
  跌倒: number;
  體重下降5: number;
  哽塞: number;
  脫水: number;
  轉身: number;
  傳染病: number;
  尿道炎: number;
}

interface MonthlyReportTableProps {
  data: MonthlyReportRow[];
}

const MonthlyReportTable: React.FC<MonthlyReportTableProps> = ({ data }) => {
  const columns = [
    { key: '半護理', label: '半護理' },
    { key: '全護理', label: '全護理' },
    { key: '導尿管', label: '導尿管' },
    { key: '遊走', label: '遊走' },
    { key: '情緒問題', label: '情緒問題' },
    { key: '因情緒問題而轉介', label: '因情緒問題而轉介' },
    { key: '長期卧床', label: '長期卧床' },
    { key: '長期使用輪椅', label: '長期使用輪椅' },
    { key: '一人協助', label: '一人協助' },
    { key: '二人協助', label: '二人協助' },
    { key: '需餵食', label: '需餵食' },
    { key: '鼻胃飼', label: '鼻胃飼' },
    { key: '腹膜血液透析', label: '腹膜/血液透析' },
    { key: '造口', label: '造口' },
    { key: '氧氣治療', label: '氧氣治療' },
    { key: '皮下注射', label: '皮下注射' },
    { key: '呼吸器', label: '呼吸器' },
    { key: '善終', label: '善終' },
    { key: '化療', label: '化療' },
    { key: '放射治療', label: '放射治療' },
    { key: '服藥9種或以上', label: '服藥9種或以上' },
    { key: '入住醫院', label: '入住醫院' },
    { key: '認知障礙', label: '認知障礙' },
    { key: '錯發藥物', label: '錯發藥物' },
    { key: '失禁', label: '失禁' },
    { key: '如廁訓練', label: '如廁訓練' },
    { key: '壓瘡', label: '壓瘡' },
    { key: '跌倒', label: '跌倒' },
    { key: '體重下降5', label: '體重下降5%' },
    { key: '哽塞', label: '哽塞' },
    { key: '脫水', label: '脫水' },
    { key: '轉身', label: '轉身' },
    { key: '傳染病', label: '傳染病' },
    { key: '尿道炎', label: '尿道炎' },
  ];

  const calculateTotal = (key: string) => {
    return data.reduce((sum, row) => sum + (row[key as keyof MonthlyReportRow] as number || 0), 0);
  };

  return (
    <div className="overflow-auto max-h-[800px] border border-gray-300 rounded-lg shadow-lg">
      <table className="min-w-full border-collapse text-sm">
        <thead className="sticky top-0 z-30">
          <tr className="bg-blue-100">
            <th className="sticky left-0 z-40 bg-blue-100 border border-gray-300 px-3 py-2 font-semibold text-gray-700 min-w-[80px]">
              床號
            </th>
            <th className="sticky left-[80px] z-40 bg-blue-100 border border-gray-300 px-3 py-2 font-semibold text-gray-700 min-w-[100px]">
              姓名
            </th>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`border border-gray-300 px-3 py-2 font-semibold text-gray-700 min-w-[80px] ${
                  (col as any).isSpecial ? 'bg-yellow-100' : ''
                }`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => {
            const rowBgClass = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';
            const hoverBgClass = 'hover:bg-blue-50';

            return (
              <tr
                key={row.patientId}
                className={`${rowBgClass} ${hoverBgClass}`}
              >
                <td className={`sticky left-0 z-20 border border-gray-300 px-3 py-2 font-medium text-gray-900 ${rowBgClass}`}>
                  {row.bedNumber}
                </td>
                <td className={`sticky left-[80px] z-20 border border-gray-300 px-3 py-2 text-gray-900 ${rowBgClass}`}>
                  {row.name}
                </td>
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`border border-gray-300 px-3 py-2 text-center ${
                      (col as any).isSpecial ? 'bg-yellow-50' : ''
                    }`}
                  >
                    {row[col.key as keyof MonthlyReportRow] || 0}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-gray-200 font-bold sticky bottom-0 z-30">
            <td
              className="sticky left-0 z-40 bg-gray-200 border border-gray-300 px-3 py-2 text-gray-900"
              colSpan={2}
            >
              總計
            </td>
            {columns.map((col) => (
              <td
                key={col.key}
                className={`border border-gray-300 px-3 py-2 text-center text-gray-900 ${
                  (col as any).isSpecial ? 'bg-yellow-200' : ''
                }`}
              >
                {calculateTotal(col.key)}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

export default MonthlyReportTable;
