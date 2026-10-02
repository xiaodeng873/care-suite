import { generateMealGuidanceCardHtml } from '../apps/web/src/utils/mealGuidanceCardPrintGenerator';
import { writeFileSync } from 'node:fs';

const stations = [
  { id: 's1', color: '#e86a6a' },
  { id: 's2', color: '#e8c96a' },
  { id: 's3', color: '#6a9fe8' },
];
const patients = [
  { 院友id: 1, 中文姓名: '陳大文', 床號: 'C101-1', station_id: 's1' },
  { 院友id: 2, 中文姓名: '李小明', 床號: 'C102-2', station_id: 's2' },
  { 院友id: 3, 中文姓名: '王美玲', 床號: 'C103-1', station_id: 's3' },
  { 院友id: 4, 中文姓名: '黃志強', 床號: 'C104-3', station_id: 's1' },
  { 院友id: 5, 中文姓名: '周麗娟', 床號: 'C105-1', station_id: 's2' },
  { 院友id: 6, 中文姓名: '吳國榮', 床號: 'C106-2', station_id: 's3' },
];
const mealGuidances = [
  { patient_id: 1, meal_combination: '2飯+2餸', special_diets: ['低鹽'], guidance_date: '2026-10-01' },
  { patient_id: 2, meal_combination: '全糊', needs_thickener: true, thickener_amount: '3平茶匙', guidance_date: '2026-10-01' },
  { patient_id: 3, meal_combination: '1飯+1餸', special_diets: ['糖尿病餐'], egg_quantity: 1, guidance_date: '2026-10-01' },
  { patient_id: 4, meal_combination: '3飯+3餸', special_diets: ['低糖'], needs_water_restriction: true, water_restriction_amount_ml: 1200, guidance_date: '2026-10-01' },
  { patient_id: 5, meal_combination: '2飯+2餸', guidance_date: '2026-10-01' },
  { patient_id: 6, meal_combination: '1飯+2餸', special_diets: ['切細'], guidance_date: '2026-10-01' },
];

writeFileSync('.tmp/meal_card.html', generateMealGuidanceCardHtml({ patients, mealGuidances, stations }));
console.log('written');
