// 只供 test-worksheet-2day 用：回 N 個每日 07:30 血糖任務（N 由 globalThis.__WK_TASK_COUNT__ 控制，預設 1），其餘表空
const makeQuery = (table: string) => {
  const q: any = {};
  q.select = () => q;
  q.eq = () => q; q.neq = () => q; q.gte = () => q; q.lte = () => q;
  q.in = () => q; q.order = () => q; q.range = () => q;
  q.then = (resolve: any) => {
    let data: any[] = [];
    if (table === 'patient_health_tasks') {
      const count = (globalThis as any).__WK_TASK_COUNT__ ?? 1;
      data = Array.from({ length: count }, (_, i) => ({
        id: `wkst-test-${i}`,
        patient_id: 999,
        health_record_type: '血糖值',
        frequency_unit: 'daily',
        frequency_value: 1,
        is_recurring: true,
        start_date: '2026-01-01T00:00:00Z',
        created_at: '2026-01-01T00:00:00Z',
        specific_times: ['07:30'],
        next_due_at: '2026-09-17T07:30:00Z',
        notes: null,
        院友主表: { 床號: `A${100 + i}-1`, 中文姓名: `測試院友${i}`, 在住狀態: '在住' },
      }));
    }
    return Promise.resolve({ data, error: null }).then(resolve);
  };
  return q;
};
export const supabase: any = { from: (t: string) => makeQuery(t) };
