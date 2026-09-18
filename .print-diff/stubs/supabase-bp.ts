// 生命表徵觀察記錄表預覽用 supabase stub：兩位院友 + 少量五類監測記錄
const patients = [
  { 院友id: 1, 中文姓名: '李玉嬋', 床號: 'A101-2', 性別: '女', 出生日期: '1932-03-15', original_bed_id: null },
  { 院友id: 2, 中文姓名: '關春杏', 床號: 'A101-1', 性別: '女', 出生日期: '1940-07-01', original_bed_id: null },
];
const vitalData: Record<string, any[]> = {
  '體溫': [
    { 院友id: 1, 記錄日期: '2026-09-16', 記錄時間: '08:00', 數值: 36.5, 備註: null },
    { 院友id: 1, 記錄日期: '2026-09-17', 記錄時間: '08:00', 數值: 37.1, 備註: '發燒' },
  ],
  '血壓': [
    { 院友id: 1, 記錄日期: '2026-09-16', 記錄時間: '08:00', 數值: 132, 數值_副: 78, 備註: null },
    { 院友id: 1, 記錄日期: '2026-09-17', 記錄時間: '08:00', 數值: 145, 數值_副: 85, 備註: null },
    { 院友id: 2, 記錄日期: '2026-09-17', 記錄時間: '09:00', 數值: 120, 數值_副: 70, 備註: null },
  ],
  '脈搏': [
    { 院友id: 1, 記錄日期: '2026-09-16', 記錄時間: '08:00', 數值: 72, 備註: null },
    { 院友id: 1, 記錄日期: '2026-09-17', 記錄時間: '08:00', 數值: 88, 備註: null },
  ],
  '呼吸': [
    { 院友id: 1, 記錄日期: '2026-09-16', 記錄時間: '08:00', 數值: 18, 備註: null },
  ],
  '血含氧量': [
    { 院友id: 1, 記錄日期: '2026-09-16', 記錄時間: '08:00', 數值: 98, 備註: null },
  ],
};

const makeQuery = (table: string, type?: string): any => {
  const q: any = {};
  q.select = () => q;
  q.eq = (col: string, val: string) => (col === '監測類型' ? makeQuery(table, val) : q);
  q.gte = () => q; q.lte = () => q;
  q.in = () => q; q.order = () => q; q.range = () => q;
  q.then = (resolve: any) => {
    let data: any[] = [];
    if (table === '院友主表') data = patients;
    else if (table === '健康監測記錄' && type) data = vitalData[type] || [];
    return Promise.resolve({ data, error: null }).then(resolve);
  };
  return q;
};

export const supabase: any = { from: (t: string) => makeQuery(t) };
