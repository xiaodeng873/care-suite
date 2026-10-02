import { generateBedListHtml } from '../apps/web/src/utils/bedListHtmlGenerator';
import { writeFileSync } from 'node:fs';

// 仿真實福群 C 站：30 房、每房 2-5 床，含 MRSA、已佔床、暫調原床
const names = ['許渠蘭','周美雲','梁細妹','鄧凝意','伍妙玲','陳佩卿','徐鳳兒','梁梅桂','雷燕優','李瑞紅','郭順賢','吳麗姝','周恩求','蕭陽燦','麥錦蓮','馮亞根','詹金花','馬偉亮','黃碧霞','呂鋒','鄧慧珠','周秀貞','陳周三','冼好','鄭華','戴鳳蓮','胡甜妹','黃桂琴','毛小翠','梁寶燕','何志廉','尹照東','蔡仁忠','周擺櫻','許秀琼','何甜菘','林允一','劉永堤','黃國揆','何玉卿','林宗世','吳榮廣','黃漢良','關永安','布志','鍾焰貞','朱秋喜','林存諒','李偉鋒','杜維氣','梁信宜','陳娥笑','沈勇','黃榮偉','左文江','盧渠煥','陳振常','冼桂森','黃碧嫦','麥如琴','梁寶','葉慧卿','黃逸綺','丘麗明','莫南','沈葵'];
const types = ['私位','買位','院舍券級別0','暫住'];
const beds = [];
let ni = 0;
for (let r = 202; r <= 237; r++) {
  if ([203,204,207,214,224,234].includes(r)) continue; // 跳過的房號
  const nBeds = [206,216,218,219,220,221,226,231,233,235,236,237].includes(r) ? 3 + (r % 2) : 2;
  for (let i = 1; i <= nBeds; i++) {
    const bedNum = `C${r}-${i}`;
    if (ni % 11 === 5) { beds.push({ bed_number: bedNum, reserved: true }); ni++; continue; }
    if (ni % 13 === 7) { beds.push({ bed_number: bedNum }); ni++; continue; }
    const p = {
      name: names[ni % names.length],
      gender: ni % 2 ? '女' : '男',
      admissionType: types[ni % 4],
      careLevel: ['全護理','半護理','自理'][ni % 3],
      infectionControl: ni % 7 === 3 ? ['MRSA'] : null,
    };
    const bed = { bed_number: bedNum, patient: p };
    if (ni % 17 === 9) bed.original_bed_number = `${r - 100}-${i}`;
    beds.push(bed);
    ni++;
  }
}

// 統計欄樣本數據
const statsSample = {
  specialCare: { 男: 3, 女: 2 },
  hospitalized: { 男: 1, 女: 2 },
  vacation: { 男: 0, 女: 1 },
  over24h: { 新收: 1, 退住: 0, 死亡: 0, 當月累積死亡: 2 },
  medical: { 鼻胃飼: 4, 尿管: 2, 傷口: 5, 壓瘡: 2, 腹膜透析: 0, 吸氧: 3, 造口: 1, 傳染病隔離: 6, 使用約束物品: 4 },
  incidents: { 藥物: 0, 跌倒: 1, 死亡: 0 },
};

writeFileSync('.tmp/bed_list_dense.html', generateBedListHtml({
  stationName: '福群C站',
  facilityName: '善頤(福群)護老院',
  printDate: '02/10/2026',
  beds,
  ...statsSample,
}));

// 稀疏樣本：3 房
writeFileSync('scripts/previews/bed_list_preview.html', generateBedListHtml({
  stationName: '甲區',
  facilityName: '善頤(福群)護老院',
  printDate: '05/07/2026',
  beds: [
    { bed_number: 'C101-1', patient: { name: '陳大文', gender: '男', admissionType: '買位', careLevel: '全護理' } },
    { bed_number: 'C101-2', patient: { name: '李小明', gender: '男', admissionType: '私位', careLevel: '半護理' } },
    { bed_number: 'C101-3' },
    { bed_number: 'C102-1', patient: { name: '王美玲', gender: '女', admissionType: '院舍券級別0', careLevel: '自理' } },
    { bed_number: 'C102-2' },
    { bed_number: 'C103-1', patient: { name: '黃志強', gender: '男', admissionType: '暫住', careLevel: '全護理', infectionControl: ['傳染病隔離'] } },
  ],
  ...statsSample,
}));
console.log('written, dense beds =', beds.length);
