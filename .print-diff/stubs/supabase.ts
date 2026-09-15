
const makeQuery = (table: string) => {
  const q: any = {};
  q.select = () => q;
  q.eq = () => q; q.neq = () => q; q.gte = () => q; q.lte = () => q;
  q.in = () => q; q.order = () => q; q.range = () => q;
  q.then = (resolve: any) => {
    let data: any[] = [];
    if (table === '院友主表') {
      data = [{ 院友id: 999, 中文姓名: '測試院友', 床號: 'A101-1', 性別: '女', 出生日期: '1929-01-01', original_bed_id: null }];
    }
    return Promise.resolve({ data, error: null }).then(resolve);
  };
  return q;
};
export const supabase: any = { from: (t: string) => makeQuery(t) };
