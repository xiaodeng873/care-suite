import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Save, Receipt } from 'lucide-react';
import {
  type FeeItem,
  type FeeItemCategory,
  type FeeItemUnit,
  getFeeItems,
  createFeeItem,
  updateFeeItem,
  deleteFeeItem,
  generateFeeItemCode,
} from '../lib/database';

interface FeeItemsModalProps {
  onClose: () => void;
}

interface DraftRow extends FeeItem {
  isNew?: boolean;
  saving?: boolean;
  error?: string;
}

const CATEGORIES: FeeItemCategory[] = ['服務', '用品'];

const UNITS: FeeItemUnit[] = ['次', '個', '日', '月', '項', '小時', '療程', '程'];

const createBlankRow = async (): Promise<DraftRow> => ({
  id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  code: await generateFeeItemCode('服務'),
  name_zh: '',
  category: '服務',
  unit: '次',
  unit_price: 0,
  is_reimbursement: false,
  description: '',
  is_active: true,
  display_order: 0,
  created_at: '',
  updated_at: '',
  isNew: true,
});

const FeeItemsModal: React.FC<FeeItemsModalProps> = ({ onClose }) => {
  const [items, setItems] = useState<FeeItem[]>([]);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadItems = async () => {
    setLoading(true);
    try {
      const data = await getFeeItems();
      setItems(data);
      setDrafts(data.map(item => ({ ...item })));
    } catch (error) {
      console.error('載入收費項目失敗:', error);
      alert('載入收費項目失敗，請重試');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const findDuplicateCode = (code: string, excludeId: string): boolean => {
    const normalized = code.trim().toLowerCase();
    if (!normalized) return false;
    return drafts.some(d => d.id !== excludeId && d.code.trim().toLowerCase() === normalized);
  };

  const updateDraft = (id: string, field: keyof FeeItem, value: string | number | boolean) => {
    setDrafts(prev =>
      prev.map(d => {
        if (d.id !== id) return d;
        const next = { ...d, [field]: value };
        if (field === 'code') {
          const dup = findDuplicateCode(String(value), id);
          next.error = dup ? '編號與其他項目重複' : undefined;
        }
        return next;
      })
    );
  };

  const handleAddRow = async () => {
    const newRow = await createBlankRow();
    setDrafts(prev => [...prev, newRow]);
  };

  const handleDelete = async (row: DraftRow) => {
    if (row.isNew) {
      setDrafts(prev => prev.filter(d => d.id !== row.id));
      return;
    }

    if (!window.confirm(`確定要刪除「${row.name_zh || row.code}」嗎？此操作無法復原。`)) {
      return;
    }

    setDrafts(prev => prev.map(d => (d.id === row.id ? { ...d, saving: true } : d)));
    try {
      await deleteFeeItem(row.id);
      await loadItems();
    } catch (error) {
      console.error('刪除收費項目失敗:', error);
      alert('刪除收費項目失敗，請重試');
      setDrafts(prev => prev.map(d => (d.id === row.id ? { ...d, saving: false } : d)));
    }
  };

  const validateRow = (row: DraftRow): string | null => {
    if (!row.code.trim()) return '請輸入編號';
    if (!row.name_zh.trim()) return '請輸入名稱';
    if (!row.is_reimbursement && Number.isNaN(Number(row.unit_price))) return '請輸入有效單價';
    if (findDuplicateCode(row.code, row.id)) return '編號與其他項目重複';
    return null;
  };

  const handleSave = async (row: DraftRow) => {
    const error = validateRow(row);
    if (error) {
      setDrafts(prev => prev.map(d => (d.id === row.id ? { ...d, error } : d)));
      return;
    }

    setDrafts(prev => prev.map(d => (d.id === row.id ? { ...d, saving: true, error: undefined } : d)));

    try {
      const payload = {
        code: row.code.trim(),
        name_zh: row.name_zh.trim(),
        category: row.category,
        unit: row.unit,
        unit_price: row.is_reimbursement ? 0 : Number(row.unit_price),
        is_reimbursement: row.is_reimbursement || false,
        description: row.description?.trim() || null,
        is_active: row.is_active,
        display_order: Number(row.display_order) || 0,
      };

      if (row.isNew) {
        await createFeeItem(payload);
      } else {
        await updateFeeItem({
          ...row,
          ...payload,
        } as FeeItem);
      }

      await loadItems();
    } catch (error: any) {
      console.error('儲存收費項目失敗:', error);
      const message = error?.message || error?.error_description || '儲存收費項目失敗，請重試';
      alert(message);
      setDrafts(prev => prev.map(d => (d.id === row.id ? { ...d, saving: false } : d)));
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Receipt className="h-6 w-6 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">管理雜費項目</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddRow}
                className="btn-primary flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                <span>新增項目</span>
              </button>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-12 text-gray-500">載入中...</div>
          ) : drafts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">暫無雜費項目</p>
              <button
                type="button"
                onClick={handleAddRow}
                className="btn-primary mt-4 inline-flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                <span>新增項目</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] divide-y divide-gray-200 border border-gray-200 rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">排序</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">編號</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">名稱</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">分類</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">單位</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">預設單價</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">啟用</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">備註</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {drafts.map((row) => (
                    <tr key={row.id} className={`${row.error ? 'bg-red-50' : ''} ${row.saving ? 'opacity-60' : ''}`}>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="number"
                          step="1"
                          value={row.display_order}
                          onChange={(e) => updateDraft(row.id, 'display_order', e.target.value)}
                          className="form-input text-sm py-1"
                          disabled={row.saving}
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="text"
                          value={row.code}
                          onChange={(e) => updateDraft(row.id, 'code', e.target.value)}
                          className="form-input text-sm py-1"
                          placeholder="編號"
                          disabled={row.saving}
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="text"
                          value={row.name_zh}
                          onChange={(e) => updateDraft(row.id, 'name_zh', e.target.value)}
                          className="form-input text-sm py-1"
                          placeholder="名稱"
                          disabled={row.saving}
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <select
                          value={row.category}
                          onChange={(e) => updateDraft(row.id, 'category', e.target.value as FeeItemCategory)}
                          className="form-input text-sm py-1"
                          disabled={row.saving}
                        >
                          {CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <select
                          value={row.unit}
                          onChange={(e) => updateDraft(row.id, 'unit', e.target.value as FeeItemUnit)}
                          className="form-input text-sm py-1"
                          disabled={row.saving}
                        >
                          {UNITS.map(u => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex flex-col gap-1">
                          <select
                            value={row.is_reimbursement ? 'reimbursement' : 'fixed'}
                            onChange={(e) => {
                              const mode = e.target.value;
                              setDrafts(prev => prev.map(d => {
                                if (d.id !== row.id) return d;
                                return {
                                  ...d,
                                  is_reimbursement: mode === 'reimbursement',
                                  unit_price: mode === 'reimbursement' ? 0 : d.unit_price,
                                };
                              }));
                            }}
                            className="form-input text-sm py-1"
                            disabled={row.saving}
                          >
                            <option value="fixed">固定單價</option>
                            <option value="reimbursement">實報實銷</option>
                          </select>
                          {!row.is_reimbursement ? (
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={row.unit_price}
                              onChange={(e) => updateDraft(row.id, 'unit_price', e.target.value)}
                              className="form-input text-sm py-1"
                              disabled={row.saving}
                            />
                          ) : (
                            <span className="text-sm text-gray-500 py-1">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="checkbox"
                          checked={row.is_active}
                          onChange={(e) => updateDraft(row.id, 'is_active', e.target.checked)}
                          className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          disabled={row.saving}
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="text"
                          value={row.description || ''}
                          onChange={(e) => updateDraft(row.id, 'description', e.target.value)}
                          className="form-input text-sm py-1"
                          placeholder="備註"
                          disabled={row.saving}
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex flex-col gap-1">
                          {row.error && (
                            <span className="text-xs text-red-600">{row.error}</span>
                          )}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleSave(row)}
                              disabled={row.saving || !!row.error}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50"
                              title="儲存"
                            >
                              <Save className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(row)}
                              disabled={row.saving}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                              title="刪除"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default FeeItemsModal;
