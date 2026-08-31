import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { LeaveType, UserProfile } from '@care-suite/shared';
import { LEAVE_TYPES, LEAVE_TYPE_LABELS } from '@care-suite/shared';
import { processImageWithGeminiVision, validateImageFile } from '../utils/ocrProcessor';

export interface OcrEntry {
  userId: string;
  date: string; // YYYY-MM-DD
  leaveType: LeaveType;
}

interface PreviewEntry {
  day: number;
  leaveType: LeaveType;
}

interface PreviewRow {
  rawName: string;
  userId: string | null;
  matched: boolean;
  entries: PreviewEntry[];
}

interface PreScheduleOcrModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserProfile[];
  year: number;
  month: number;
  onApply: (entries: OcrEntry[]) => Promise<void>;
}

const VALID_TYPES = new Set<string>(LEAVE_TYPES);

function buildPrompt(year: number, month: number): string {
  return `這是一張香港院舍的「手寫假期預排表」矩陣相片（${year} 年 ${month} 月）。
表格每一列代表一名員工：第一欄是員工中文姓名，之後的欄位是該月 1 至 31 日。
格內可能手寫有假期代碼，只接受以下代碼：DO、PRD、PH、SH、AL、SL、SLN。
空白格或無法辨認的格請略過，不要猜測。
請只回傳純 JSON（不可包含 markdown 或任何其他文字），格式如下：
{ "rows": [ { "name": "員工姓名", "entries": [ { "day": 3, "type": "DO" } ] } ] }`;
}

/** 容錯解析 OCR 結果：entries 可能是陣列 [{day,type}] 或物件映射 {"3":"DO"} */
function parseRows(data: unknown, daysInMonth: number): { rawName: string; entries: PreviewEntry[] }[] {
  const container = data as { rows?: unknown } | null | undefined;
  const rows: unknown[] = Array.isArray(container?.rows) ? container.rows : [];
  return rows
    .map((row) => {
      const r = row as { name?: unknown; entries?: unknown } | null | undefined;
      const rawName = String(r?.name ?? '').trim();
      const entries: PreviewEntry[] = [];
      const push = (dayRaw: unknown, typeRaw: unknown) => {
        const day = Number(dayRaw);
        const type = String(typeRaw ?? '').trim().toUpperCase();
        if (!Number.isInteger(day) || day < 1 || day > daysInMonth) return;
        if (!VALID_TYPES.has(type)) return;
        if (entries.some((e) => e.day === day)) return;
        entries.push({ day, leaveType: type as LeaveType });
      };
      const raw = r?.entries;
      if (Array.isArray(raw)) {
        for (const e of raw) {
          const item = e as { day?: unknown; type?: unknown } | null | undefined;
          push(item?.day, item?.type);
        }
      } else if (raw && typeof raw === 'object') {
        for (const [k, v] of Object.entries(raw)) push(k, v);
      }
      entries.sort((a, b) => a.day - b.day);
      return { rawName, entries };
    })
    .filter((r) => r.rawName);
}

export const PreScheduleOcrModal: React.FC<PreScheduleOcrModalProps> = ({
  isOpen,
  onClose,
  users,
  year,
  month,
  onApply,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const daysInMonth = useMemo(() => new Date(year, month, 0).getDate(), [year, month]);

  // 開關時重置狀態
  useEffect(() => {
    if (isOpen) {
      setFile(null);
      setProcessing(false);
      setApplying(false);
      setRows(null);
      setError(null);
    }
  }, [isOpen]);

  // 圖片預覽 URL
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!isOpen) return null;

  const matchUser = (name: string): UserProfile | undefined => {
    const exact = users.find((u) => u.name_zh === name);
    if (exact) return exact;
    const stripped = name.replace(/\s+/g, '');
    return users.find((u) => (u.name_zh ?? '').replace(/\s+/g, '') === stripped);
  };

  const handleFile = (f: File | null | undefined) => {
    if (!f) return;
    const v = validateImageFile(f);
    if (!v.valid) {
      setError(v.error ?? '圖片無效');
      return;
    }
    setFile(f);
    setError(null);
    setRows(null);
  };

  const handleRecognize = async () => {
    if (!file) return;
    setProcessing(true);
    setError(null);
    try {
      const result = await processImageWithGeminiVision(file, buildPrompt(year, month));
      if (!result.success) {
        setError(result.error ?? '識別失敗，請重試');
        return;
      }
      const parsed = parseRows(result.extractedData, daysInMonth);
      if (parsed.length === 0) {
        setError('未能從圖片識別任何預排資料，請重拍更清晰的相片或改用手動輸入。');
        return;
      }
      setRows(
        parsed.map((r) => {
          const m = matchUser(r.rawName);
          return { ...r, userId: m?.id ?? null, matched: !!m };
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '識別失敗');
    } finally {
      setProcessing(false);
    }
  };

  const updateRow = (index: number, patch: Partial<PreviewRow>) => {
    setRows((prev) => prev && prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const removeRow = (index: number) => {
    setRows((prev) => prev && prev.filter((_, i) => i !== index));
  };

  const updateEntry = (rowIndex: number, entryIndex: number, leaveType: LeaveType) => {
    setRows(
      (prev) =>
        prev &&
        prev.map((r, i) =>
          i === rowIndex
            ? { ...r, entries: r.entries.map((e, j) => (j === entryIndex ? { ...e, leaveType } : e)) }
            : r,
        ),
    );
  };

  const removeEntry = (rowIndex: number, entryIndex: number) => {
    setRows(
      (prev) =>
        prev &&
        prev.map((r, i) =>
          i === rowIndex ? { ...r, entries: r.entries.filter((_, j) => j !== entryIndex) } : r,
        ),
    );
  };

  const handleApply = async () => {
    if (!rows) return;
    const entries: OcrEntry[] = [];
    for (const row of rows) {
      if (!row.userId) continue;
      for (const e of row.entries) {
        entries.push({
          userId: row.userId,
          date: `${year}-${String(month).padStart(2, '0')}-${String(e.day).padStart(2, '0')}`,
          leaveType: e.leaveType,
        });
      }
    }
    if (entries.length === 0) {
      setError('沒有可寫入的預排項目');
      return;
    }
    setApplying(true);
    setError(null);
    try {
      await onApply(entries);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '寫入失敗');
    } finally {
      setApplying(false);
    }
  };

  const applicableCount = rows
    ? rows.reduce((s, r) => s + (r.userId ? r.entries.length : 0), 0)
    : 0;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
      onPaste={(e) => {
        const f = e.clipboardData?.files?.[0];
        if (f) handleFile(f);
      }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h3 className="text-lg font-semibold text-gray-900">
            識別預排表（{year}年{month}月）
          </h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              手寫預排表相片
            </label>
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={(e) => handleFile(e.target.files?.[0])}
              className="block w-full text-sm text-gray-600 file:mr-3 file:px-3 file:py-1.5 file:border file:border-gray-300 file:rounded-lg file:bg-gray-50 file:text-sm file:text-gray-700 hover:file:bg-gray-100"
            />
            <p className="text-xs text-gray-500 mt-1">
              支援 JPG / PNG / WEBP（最大 5MB），亦可直接在此視窗貼上剪貼簿圖片。
            </p>
          </div>

          {previewUrl && (
            <div className="border border-gray-200 rounded-lg p-2 bg-gray-50">
              <img src={previewUrl} alt="預排表預覽" className="max-h-56 mx-auto rounded" />
            </div>
          )}

          <div>
            <button
              type="button"
              onClick={handleRecognize}
              disabled={!file || processing || applying}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50"
            >
              {processing ? '識別中，請稍候...' : '開始識別'}
            </button>
          </div>

          {rows && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">
                識別結果預覽（寫入前可修改或刪除）：
              </p>
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
                {rows.map((row, ri) => (
                  <div key={ri} className="px-3 py-2 space-y-2">
                    <div className="flex items-center gap-2">
                      {row.matched ? (
                        <span className="text-sm font-medium text-gray-900">
                          {users.find((u) => u.id === row.userId)?.name_zh ?? row.rawName}
                        </span>
                      ) : (
                        <select
                          value={row.userId ?? ''}
                          onChange={(e) =>
                            updateRow(ri, { userId: e.target.value || null, matched: !!e.target.value })
                          }
                          className="px-2 py-1 text-sm border border-amber-400 bg-amber-50 rounded-lg focus:ring-2 focus:ring-amber-500"
                        >
                          <option value="">略過此列（{row.rawName || '未知名稱'}）</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name_zh}
                            </option>
                          ))}
                        </select>
                      )}
                      {!row.matched && row.rawName && (
                        <span className="text-xs text-amber-600">未能自動匹配姓名</span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeRow(ri)}
                        className="ml-auto text-xs text-red-600 hover:text-red-800"
                      >
                        刪除此列
                      </button>
                    </div>
                    {row.entries.length === 0 ? (
                      <p className="text-xs text-gray-400">（無有效假期項目）</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {row.entries.map((entry, ei) => (
                          <span
                            key={ei}
                            className="inline-flex items-center gap-1 border border-gray-300 rounded-lg px-2 py-1 text-xs bg-white"
                          >
                            <span className="font-medium text-gray-700">{entry.day}日</span>
                            <select
                              value={entry.leaveType}
                              onChange={(e) => updateEntry(ri, ei, e.target.value as LeaveType)}
                              className="text-xs border border-gray-200 rounded px-1 py-0.5 focus:ring-1 focus:ring-blue-500"
                            >
                              {LEAVE_TYPES.map((t) => (
                                <option key={t} value={t} title={LEAVE_TYPE_LABELS[t]}>
                                  {t}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => removeEntry(ri, ei)}
                              className="text-gray-400 hover:text-red-600"
                              title="刪除此項目"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t">
          <button
            type="button"
            onClick={onClose}
            disabled={processing || applying}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!rows || applicableCount === 0 || processing || applying}
            className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {applying ? '寫入中...' : `確認寫入（${applicableCount} 筆）`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PreScheduleOcrModal;
