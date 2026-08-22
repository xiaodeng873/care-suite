import { createClient } from '@supabase/supabase-js';
import { buildMedicationRecordHtml } from '../apps/web/src/utils/medicationRecordHtmlExporter';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: patients, error: pe } = await supabase
    .from('院友主表')
    .select('*')
    .ilike('中文姓名', '%麥錦蓮%')
    .limit(1);
  if (pe || !patients || patients.length === 0) throw pe || new Error('patient not found');
  const patientRow = patients[0];

  const { data: prescriptions, error: re } = await supabase
    .from('new_medication_prescriptions')
    .select('*')
    .eq('patient_id', patientRow.院友id);
  if (re) throw re;

  const patient = { ...patientRow, prescriptions: prescriptions! };
  const selectedMonth = '2026-08';

  const htmlWithBlank = await buildMedicationRecordHtml([patient], selectedMonth, false, true);
  const htmlWithoutBlank = await buildMedicationRecordHtml([patient], selectedMonth, false, false);

  // Extract oral pages and list prescription names per page
  function extractPageNames(html: string) {
    const pages = html.split('<!-- page-end -->'); // no such marker, use page section class
    // Use a regex to find each page's prescription names
    const pageBlocks = html.split('<section class="mr-page">').slice(1);
    return pageBlocks.map((pageHtml, idx) => {
      const names: string[] = [];
      const nameRegex = /<div class="mr-med-name">([^<]+)/g;
      let m;
      while ((m = nameRegex.exec(pageHtml)) !== null) {
        names.push(m[1].trim());
      }
      return { page: idx + 1, names };
    });
  }

  console.log('=== WITH blank rows ===');
  console.log(JSON.stringify(extractPageNames(htmlWithBlank), null, 2));
  console.log('\n=== WITHOUT blank rows ===');
  console.log(JSON.stringify(extractPageNames(htmlWithoutBlank), null, 2));
}

main().catch((err) => { console.error(err); process.exit(1); });
