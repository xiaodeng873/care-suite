// 重構 handleSave：主檔 upsert 與後續明細同步分成兩段，錯誤顯示實際訊息
import fs from 'fs';

const path = 'apps/web/src/components/EmploymentDetailsSection.tsx';
let src = fs.readFileSync(path, 'utf8');

const anchor1Old =
  "      if (error) throw error;\r\n" +
  "\r\n" +
  "      // 按（可能已更改的）起始日補齊系統獲得行";
const anchor1New =
  "      if (error) throw error;\r\n" +
  "    } catch (err) {\r\n" +
  "      console.error('儲存僱傭詳情失敗:', err);\r\n" +
  "      setMessage({ type: 'error', text: `儲存僱傭詳情失敗：${formatError(err)}` });\r\n" +
  "      setSaving(false);\r\n" +
  "      return;\r\n" +
  "    }\r\n" +
  "\r\n" +
  "    // 主檔已落庫；以下明細同步／重新載入失敗不影響主檔\r\n" +
  "    try {\r\n" +
  "      // 按（可能已更改的）起始日補齊系統獲得行";

const anchor2Old =
  "      setMessage({ type: 'success', text: '僱傭詳情已儲存' });\r\n" +
  "      await loadData();\r\n" +
  "    } catch (err) {\r\n" +
  "      console.error('儲存僱傭詳情失敗:', err);\r\n" +
  "      setMessage({ type: 'error', text: '儲存僱傭詳情失敗' });\r\n" +
  "    } finally {";
const anchor2New =
  "      await loadData();\r\n" +
  "      setMessage({ type: 'success', text: '僱傭詳情已儲存' });\r\n" +
  "    } catch (err) {\r\n" +
  "      console.error('儲存後同步明細失敗:', err);\r\n" +
  "      setMessage({ type: 'error', text: `僱傭詳情主檔已儲存，但明細同步失敗：${formatError(err)}` });\r\n" +
  "    } finally {";

if (!src.includes(anchor1Old)) { console.error('anchor1 找不到'); process.exit(1); }
if (!src.includes(anchor2Old)) { console.error('anchor2 找不到'); process.exit(1); }
if (src.indexOf(anchor1Old) !== src.lastIndexOf(anchor1Old)) { console.error('anchor1 不唯一'); process.exit(1); }
if (src.indexOf(anchor2Old) !== src.lastIndexOf(anchor2Old)) { console.error('anchor2 不唯一'); process.exit(1); }

src = src.replace(anchor1Old, anchor1New).replace(anchor2Old, anchor2New);
fs.writeFileSync(path, src);
console.log('patch 完成');
