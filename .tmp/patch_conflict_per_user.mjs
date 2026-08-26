// 修正一鍵排班衝突處理：
// - 能排的班次照樣即時插入
// - 只有衝突（希望放假但被排班）員工的班次暫存不插入
// - 每項衝突的「仍要職員上班」按鈕：override 預排 + 插入該員工的班次
// - 移除上一版全域「仍要職員上班」按鈕與暫存全部班次的邏輯
import fs from 'fs';

const apply = (file, oldS, newS, name) => {
  let src = fs.readFileSync(file, 'utf8');
  const oldCrlf = oldS.replace(/\n/g, '\r\n');
  const newCrlf = newS.replace(/\n/g, '\r\n');
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

// 1) 流程：非衝突班次照樣插入，只暫存衝突員工的班次
apply(GRID,
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
  "      // 衝突（希望放假但被排班）員工的班次暫存不插入，按「仍要職員上班」才落庫；其餘班次照樣即時插入\n" +
  "      const conflictKeys = new Set(result.conflicts.map((c) => `${c.user_id}|${c.date}`));\n" +
  "      const heldInsertions = result.insertions.filter((ins) => conflictKeys.has(`${ins.user_id}|${ins.work_date}`));\n" +
  "      const okInsertions = result.insertions.filter((ins) => !conflictKeys.has(`${ins.user_id}|${ins.work_date}`));\n" +
  "\n" +
  "      if (okInsertions.length > 0) {\n" +
  "        await insertAutoRosterShifts(okInsertions);\n" +
  "      }\n" +
  "\n" +
  "      if (result.conflicts.length > 0) {\n" +
  "        setPendingAutoRosterInserts(heldInsertions);\n" +
  "        setConflicts(result.conflicts);\n" +
  "        setConflictModalOpen(true);\n" +
  "      }",
  'flow');

// 2) 每項衝突按鈕：override 預排後，把該員工暫存的班次插入
apply(GRID,
  "        .eq('is_overridden', false);\n" +
  "      if (error) throw error;\n" +
  "\n" +
  "      setConflicts((prev) =>\n" +
  "        prev.filter((c) => !(c.user_id === userId && c.date === date && c.urgency === 'preferred')),\n" +
  "      );",
  "        .eq('is_overridden', false);\n" +
  "      if (error) throw error;\n" +
  "\n" +
  "      // 把該員工被暫存的班次插入排班表\n" +
  "      const toInsert = pendingAutoRosterInserts.filter(\n" +
  "        (ins) => ins.user_id === userId && ins.work_date === date,\n" +
  "      );\n" +
  "      if (toInsert.length > 0) {\n" +
  "        await insertAutoRosterShifts(toInsert);\n" +
  "        setPendingAutoRosterInserts((prev) =>\n" +
  "          prev.filter((ins) => !(ins.user_id === userId && ins.work_date === date)),\n" +
  "        );\n" +
  "      }\n" +
  "\n" +
  "      setConflicts((prev) =>\n" +
  "        prev.filter((c) => !(c.user_id === userId && c.date === date && c.urgency === 'preferred')),\n" +
  "      );",
  'override-insert');

// 3) 移除全域強制插入 handler
apply(GRID,
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
  "  const handleOverrideConflict = async (userId: string, date: string) => {",
  'remove-global-handler');

// 4) modal 接線：移除 onForceInsert（保留關閉時清暫存）
apply(GRID,
  "        onOverride={canEdit ? handleOverrideConflict : undefined}\n" +
  "        onForceInsert={canEdit && pendingAutoRosterInserts.length > 0 ? handleForceAutoRosterInsert : undefined}\n" +
  "      />",
  "        onOverride={canEdit ? handleOverrideConflict : undefined}\n" +
  "      />",
  'wiring');

// 5) RosterConflictModal：還原 footer（移除全域按鈕與 prop），每項衝突按鈕改名「仍要職員上班」
apply(MODAL,
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
  "        <div className=\"px-5 py-3 border-t flex justify-end\">\n" +
  "          <button\n" +
  "            type=\"button\"\n" +
  "            onClick={onClose}\n" +
  "            className=\"px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200\"\n" +
  "          >\n" +
  "            關閉\n" +
  "          </button>\n" +
  "        </div>",
  'footer');

apply(MODAL,
  "  onClose: () => void;\n" +
  "  onOverride?: (userId: string, date: string) => void;\n" +
  "  /** 有暫存的自動排班結果時提供：按「仍要職員上班」才把班次插入排班表 */\n" +
  "  onForceInsert?: () => void;\n" +
  "}",
  "  onClose: () => void;\n" +
  "  onOverride?: (userId: string, date: string) => void;\n" +
  "}",
  'props');

apply(MODAL,
  "  onClose,\n" +
  "  onOverride,\n" +
  "  onForceInsert,\n" +
  "}) => {",
  "  onClose,\n" +
  "  onOverride,\n" +
  "}) => {",
  'destructure');

apply(MODAL,
  "                    要求職員上班\n" +
  "                  </button>",
  "                    仍要職員上班\n" +
  "                  </button>",
  'button-label');

console.log('全部 patch 完成');
