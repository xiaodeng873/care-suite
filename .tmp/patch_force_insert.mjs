// 一鍵排班：有未滿足預排要求時不即時插入，按「仍要職員上班」才落庫
// v2：處理 CRLF；已套用的步驟自動跳過
import fs from 'fs';

const apply = (file, oldS, newS, name) => {
  let src = fs.readFileSync(file, 'utf8');
  const oldCrlf = oldS.replace(/\n/g, '\r\n');
  const newCrlf = newS.replace(/\n/g, '\r\n');
  if (src.includes(newCrlf) || src.includes(newS)) { console.log(file + ' / ' + name + ' 已存在，跳過'); return; }
  let target = null, replacement = null;
  if (src.includes(oldCrlf)) { target = oldCrlf; replacement = newCrlf; }
  else if (src.includes(oldS)) { target = oldS; replacement = newS; }
  if (!target) { console.error(file + ' / ' + name + ' 找不到'); process.exit(1); }
  if (src.indexOf(target) !== src.lastIndexOf(target)) { console.error(file + ' / ' + name + ' 不唯一'); process.exit(1); }
  fs.writeFileSync(file, src.replace(target, replacement));
  console.log(file + ' / ' + name + ' OK');
};

const GRID = 'apps/web/src/components/RosterScheduleGrid.tsx';
const MODAL = 'apps/web/src/components/RosterConflictModal.tsx';

apply(GRID,
  "import type { AutoRosterConflict } from '../utils/autoRoster';",
  "import type { AutoRosterCandidate, AutoRosterConflict } from '../utils/autoRoster';",
  'import');

apply(GRID,
  "  const [conflicts, setConflicts] = useState<AutoRosterConflict[]>([]);\n" +
  "  const [conflictModalOpen, setConflictModalOpen] = useState(false);",
  "  const [conflicts, setConflicts] = useState<AutoRosterConflict[]>([]);\n" +
  "  const [conflictModalOpen, setConflictModalOpen] = useState(false);\n" +
  "  // 有未滿足預排要求時暫存的自動排班結果，按「仍要職員上班」才落庫\n" +
  "  const [pendingAutoRosterInserts, setPendingAutoRosterInserts] = useState<AutoRosterCandidate[]>([]);",
  'state');

apply(GRID,
  "  const handleAutoRoster = async (date: string) => {\n" +
  "    if (!selectedPosition) return;\n" +
  "    setAutoRosterLoading(date);",
  "  const insertAutoRosterShifts = async (insertions: AutoRosterCandidate[]) => {\n" +
  "    const inserts = insertions.map((ins) => ({\n" +
  "      user_id: ins.user_id,\n" +
  "      work_date: ins.work_date,\n" +
  "      station_id: ins.station_id,\n" +
  "      position: ins.position,\n" +
  "      shift_name: ins.shift_name,\n" +
  "      start_time: ins.start_time,\n" +
  "      end_time: getShiftEndTime(\n" +
  "        ins.start_time,\n" +
  "        getDailyContractHours(employmentDetails[ins.user_id]),\n" +
  "      ),\n" +
  "      created_by: userProfile?.id ?? null,\n" +
  "      is_auto: true,\n" +
  "    }));\n" +
  "\n" +
  "    let insertResult = await withEndTimeFallback(\n" +
  "      async () => await supabase.from('user_shift_assignments').insert(inserts),\n" +
  "      async () =>\n" +
  "        await supabase.from('user_shift_assignments').insert(\n" +
  "          inserts.map((ins) => withoutEndTime(ins)),\n" +
  "        ),\n" +
  "    );\n" +
  "    // 舊資料庫未加 is_auto 欄位時降級重試（降級插入的班次不支援一鍵排空）\n" +
  "    if (insertResult.error && isMissingColumnError(insertResult.error, 'is_auto')) {\n" +
  "      insertResult = await withEndTimeFallback(\n" +
  "        async () =>\n" +
  "          await supabase.from('user_shift_assignments').insert(\n" +
  "            inserts.map((ins) => withoutIsAuto(ins)),\n" +
  "          ),\n" +
  "        async () =>\n" +
  "          await supabase.from('user_shift_assignments').insert(\n" +
  "            inserts.map((ins) => withoutEndTime(withoutIsAuto(ins))),\n" +
  "          ),\n" +
  "      );\n" +
  "    }\n" +
  "    if (insertResult.error) throw insertResult.error;\n" +
  "\n" +
  "    await onAssignmentChange();\n" +
  "  };\n" +
  "\n" +
  "  const handleAutoRoster = async (date: string) => {\n" +
  "    if (!selectedPosition) return;\n" +
  "    setAutoRosterLoading(date);",
  'helper');

apply(GRID,
  "      if (result.insertions.length > 0) {\n" +
  "        const inserts = result.insertions.map((ins) => ({\n" +
  "          user_id: ins.user_id,\n" +
  "          work_date: ins.work_date,\n" +
  "          station_id: ins.station_id,\n" +
  "          position: ins.position,\n" +
  "          shift_name: ins.shift_name,\n" +
  "          start_time: ins.start_time,\n" +
  "          end_time: getShiftEndTime(\n" +
  "            ins.start_time,\n" +
  "            getDailyContractHours(employmentDetails[ins.user_id]),\n" +
  "          ),\n" +
  "          created_by: userProfile?.id ?? null,\n" +
  "          is_auto: true,\n" +
  "        }));\n" +
  "\n" +
  "        let insertResult = await withEndTimeFallback(\n" +
  "          async () => await supabase.from('user_shift_assignments').insert(inserts),\n" +
  "          async () =>\n" +
  "            await supabase.from('user_shift_assignments').insert(\n" +
  "              inserts.map((ins) => withoutEndTime(ins)),\n" +
  "            ),\n" +
  "        );\n" +
  "        // 舊資料庫未加 is_auto 欄位時降級重試（降級插入的班次不支援一鍵排空）\n" +
  "        if (insertResult.error && isMissingColumnError(insertResult.error, 'is_auto')) {\n" +
  "          insertResult = await withEndTimeFallback(\n" +
  "            async () =>\n" +
  "              await supabase.from('user_shift_assignments').insert(\n" +
  "                inserts.map((ins) => withoutIsAuto(ins)),\n" +
  "              ),\n" +
  "            async () =>\n" +
  "              await supabase.from('user_shift_assignments').insert(\n" +
  "                inserts.map((ins) => withoutEndTime(withoutIsAuto(ins))),\n" +
  "              ),\n" +
  "          );\n" +
  "        }\n" +
  "        if (insertResult.error) throw insertResult.error;\n" +
  "\n" +
  "        await onAssignmentChange();\n" +
  "      }\n" +
  "\n" +
  "      if (result.conflicts.length > 0) {\n" +
  "        setConflicts(result.conflicts);\n" +
  "        setConflictModalOpen(true);\n" +
  "      }",
  "      // 有未滿足的預排要求：不即時插入，暫存結果，按「仍要職員上班」才落庫\n" +
  "      if (result.conflicts.length > 0) {\n" +
  "        setPendingAutoRosterInserts(result.insertions);\n" +
  "        setConflicts(result.conflicts);\n" +
  "        setConflictModalOpen(true);\n" +
  "        return;\n" +
  "      }\n" +
  "\n" +
  "      if (result.insertions.length > 0) {\n" +
  "        await insertAutoRosterShifts(result.insertions);\n" +
  "      }",
  'flow');

apply(GRID,
  "  const handleOverrideConflict = async (userId: string, date: string) => {",
  "  // 「仍要職員上班」：確認後才把暫存的自動排班結果插入排班表\n" +
  "  const handleForceAutoRosterInsert = async () => {\n" +
  "    if (pendingAutoRosterInserts.length === 0) return;\n" +
  "    try {\n" +
  "      await insertAutoRosterShifts(pendingAutoRosterInserts);\n" +
  "      setPendingAutoRosterInserts([]);\n" +
  "      setConflictModalOpen(false);\n" +
  "    } catch (err) {\n" +
  "      console.error('一鍵排班失敗:', err);\n" +
  "      alert(getSupabaseErrorMessage(err, '一鍵排班失敗'));\n" +
  "    }\n" +
  "  };\n" +
  "\n" +
  "  const handleOverrideConflict = async (userId: string, date: string) => {",
  'handler');

apply(GRID,
  "      <RosterConflictModal\n" +
  "        isOpen={conflictModalOpen}\n" +
  "        conflicts={conflicts}\n" +
  "        users={users}\n" +
  "        onClose={() => setConflictModalOpen(false)}\n" +
  "        onOverride={canEdit ? handleOverrideConflict : undefined}\n" +
  "      />",
  "      <RosterConflictModal\n" +
  "        isOpen={conflictModalOpen}\n" +
  "        conflicts={conflicts}\n" +
  "        users={users}\n" +
  "        onClose={() => {\n" +
  "          setConflictModalOpen(false);\n" +
  "          setPendingAutoRosterInserts([]);\n" +
  "        }}\n" +
  "        onOverride={canEdit ? handleOverrideConflict : undefined}\n" +
  "        onForceInsert={canEdit && pendingAutoRosterInserts.length > 0 ? handleForceAutoRosterInsert : undefined}\n" +
  "      />",
  'wiring');

apply(MODAL,
  "  onClose: () => void;\n" +
  "  onOverride?: (userId: string, date: string) => void;\n" +
  "}",
  "  onClose: () => void;\n" +
  "  onOverride?: (userId: string, date: string) => void;\n" +
  "  /** 有暫存的自動排班結果時提供：按「仍要職員上班」才把班次插入排班表 */\n" +
  "  onForceInsert?: () => void;\n" +
  "}",
  'props');

apply(MODAL,
  "  onClose,\n" +
  "  onOverride,\n" +
  "}) => {",
  "  onClose,\n" +
  "  onOverride,\n" +
  "  onForceInsert,\n" +
  "}) => {",
  'destructure');

apply(MODAL,
  "        <div className=\"px-5 py-3 border-t flex justify-end\">\n" +
  "          <button\n" +
  "            type=\"button\"\n" +
  "            onClick={onClose}\n" +
  "            className=\"px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200\"\n" +
  "          >\n" +
  "            關閉\n" +
  "          </button>\n" +
  "        </div>",
  "        <div className=\"px-5 py-3 border-t flex justify-end gap-2\">\n" +
  "          {onForceInsert && (\n" +
  "            <button\n" +
  "              type=\"button\"\n" +
  "              onClick={onForceInsert}\n" +
  "              className=\"px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700\"\n" +
  "            >\n" +
  "              仍要職員上班\n" +
  "            </button>\n" +
  "          )}\n" +
  "          <button\n" +
  "            type=\"button\"\n" +
  "            onClick={onClose}\n" +
  "            className=\"px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200\"\n" +
  "          >\n" +
  "            關閉\n" +
  "          </button>\n" +
  "        </div>",
  'footer');

console.log('全部 patch 完成');
