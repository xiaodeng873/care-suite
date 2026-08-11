import React, { useMemo } from 'react';
import { usePatientData } from '../context/PatientContext';

interface CgatMedicationEndDateTableProps {
  patientId: string;
  selectedDate?: string;
  onSelect: (estimatedEndDate: string) => void;
}

/** 判斷藥物來源是否屬 CGAT / 社區老人評估小組（優先排列） */
function isCgatSource(source?: string): boolean {
  if (!source) return false;
  return source.includes('CGAT') || source.includes('社區老人評估小組');
}

/** 藥完日期小表：內嵌在 CGAT modal 內，只能從此小表選取 */
const CgatMedicationEndDateTable: React.FC<CgatMedicationEndDateTableProps> = ({ patientId, selectedDate, onSelect }) => {
  const { prescriptions } = usePatientData();

  // 在服處方（status='active'），三欄去重（處方日期+藥物來源+預計結束日期）
  const rows = useMemo(() => {
    if (!patientId) return [];
    const raw = prescriptions
      .filter((p: any) => String(p.patient_id) === String(patientId) && p.status === 'active' && p.estimated_end_date)
      .map((p: any) => ({
        prescription_date: p.prescription_date,
        medication_source: p.medication_source,
        estimated_end_date: p.estimated_end_date,
      }));
    const seen = new Set<string>();
    const deduped: typeof raw = [];
    for (const r of raw) {
      const key = `${r.prescription_date}|${r.medication_source}|${r.estimated_end_date}`;
      if (!seen.has(key)) { seen.add(key); deduped.push(r); }
    }
    // 優先排列 CGAT / 社區老人評估小組 藥物來源，其次依預計結束日期
    deduped.sort((a, b) => {
      const ca = isCgatSource(a.medication_source) ? 0 : 1;
      const cb = isCgatSource(b.medication_source) ? 0 : 1;
      if (ca !== cb) return ca - cb;
      return a.estimated_end_date < b.estimated_end_date ? -1 : a.estimated_end_date > b.estimated_end_date ? 1 : 0;
    });
    return deduped;
  }, [prescriptions, patientId]);

  if (!patientId) {
    return <div className="border rounded-lg p-3 text-sm text-gray-400">請先選擇院友</div>;
  }
  if (rows.length === 0) {
    return <div className="border rounded-lg p-3 text-sm text-gray-400">此院友無在服處方（或無預計結束日期）</div>;
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500">
          <tr>
            <th className="py-2 px-2 text-left">處方日期</th>
            <th className="py-2 px-2 text-left">藥物來源</th>
            <th className="py-2 px-2 text-left">預計結束日期</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const isSelected = selectedDate === r.estimated_end_date;
            return (
              <tr key={i}
                className={`border-t cursor-pointer ${isSelected ? 'bg-blue-100' : 'hover:bg-blue-50'}`}
                onClick={() => onSelect(r.estimated_end_date)}>
                <td className="py-2 px-2">{r.prescription_date}</td>
                <td className="py-2 px-2">
                  {r.medication_source}
                  {isCgatSource(r.medication_source) && (
                    <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">CGAT</span>
                  )}
                </td>
                <td className="py-2 px-2 font-medium text-blue-600">{r.estimated_end_date}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default CgatMedicationEndDateTable;
