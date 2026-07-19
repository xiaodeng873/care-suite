/** 根據 CGAT 到診日期 + 療程周數計算預計藥完日期 */
export function calcEstimatedMedicationEndDate(
  cgatVisitDate: string | undefined,
  treatmentWeeks: number | undefined,
  visitUnknown: boolean
): string | undefined {
  if (visitUnknown || !cgatVisitDate || !treatmentWeeks || treatmentWeeks <= 0) return undefined;
  const [y, m, d] = cgatVisitDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + treatmentWeeks * 7);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}
