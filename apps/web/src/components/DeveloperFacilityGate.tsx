import React, { useState, useEffect } from 'react';
import { Building2, Plus, Ban, Play, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface FacilityRow {
  id: number;
  name: string;
  is_active: boolean;
}

/**
 * 開發者院舍閘門
 *
 * 開發者（Supabase Auth 登入）每次工作階段必須先選定院舍才能進入系統。
 * 顯示名稱取院舍設定（facility_settings.facility_name_zh）。
 * 可在此新增院舍（可新增多間）、中止/恢復某院舍的所有用戶登入、刪除空院舍。
 * 不得預設行為，無法略過選擇。
 */
export const DeveloperFacilityGate: React.FC = () => {
  const { fetchFacilities, selectFacility, createFacility, suspendFacility, resumeFacility, deleteFacility, dbTokenReady } = useAuth();
  const [facilities, setFacilities] = useState<FacilityRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const reload = () => {
    setListLoading(true);
    setListError('');
    fetchFacilities()
      .then((list) => {
        setFacilities(list);
        if (list.length === 0) {
          setListError('尚未有任何院舍，請先新增院舍');
        } else {
          setListError('');
        }
      })
      .catch((e) => {
        setFacilities([]);
        setListError('載入院舍列表失敗：' + (e?.message || String(e)));
      })
      .finally(() => {
        setListLoading(false);
      });
  };

  useEffect(() => {
    // dbToken 未簽發完成前唔好發 RPC：無 token 會以 anon 身份被拒（42501）
    if (!dbTokenReady) return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbTokenReady]);

  const choose = async (id: number) => {
    setLoadingId(id);
    setError('');
    setNotice('');
    try {
      const { error: err } = await selectFacility(id);
      if (err) {
        setError(typeof err === 'string' ? err : '切換院舍失敗');
      }
      // 成功時 selectFacility 會設置 devFacilityChosen，閘門自動放行
    } finally {
      setLoadingId(null);
    }
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) {
      setError('請輸入院舍名稱');
      return;
    }
    setCreating(true);
    setError('');
    setNotice('');
    try {
      const { error: err } = await createFacility(name);
      if (err) {
        setError(typeof err === 'string' ? err : '新增院舍失敗');
        return;
      }
      setNewName('');
      setNotice('已新增院舍「' + name + '」');
      reload();
    } finally {
      setCreating(false);
    }
  };

  const handleSuspend = async (f: FacilityRow) => {
    if (!window.confirm(`確定中止「${f.name}」的所有用戶登入？\n該院舍所有用戶會立即被登出，且無法再登入。`)) return;
    setBusyId(f.id);
    setError('');
    setNotice('');
    try {
      const { error: err } = await suspendFacility(f.id);
      if (err) {
        setError(typeof err === 'string' ? err : '停用院舍失敗');
      } else {
        setNotice(`已中止「${f.name}」的所有用戶登入`);
        reload();
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleResume = async (f: FacilityRow) => {
    setBusyId(f.id);
    setError('');
    setNotice('');
    try {
      const { error: err } = await resumeFacility(f.id);
      if (err) {
        setError(typeof err === 'string' ? err : '恢復院舍失敗');
      } else {
        setNotice(`已恢復「${f.name}」登入（用戶需重新登入）`);
        reload();
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (f: FacilityRow) => {
    if (!window.confirm(`確定刪除院舍「${f.name}」？\n該院舍的所有院友、用戶及全部記錄都會被永久刪除，此操作不可復原。`)) return;
    setBusyId(f.id);
    setError('');
    setNotice('');
    try {
      const { error: err } = await deleteFacility(f.id);
      if (err) {
        setError(typeof err === 'string' ? err : '刪除院舍失敗');
      } else {
        setNotice(`已刪除院舍「${f.name}」`);
        reload();
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white/95 backdrop-blur rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="text-center mb-6">
          <Building2 className="w-10 h-10 text-blue-600 mx-auto mb-2" />
          <h1 className="text-xl font-bold text-gray-800">選擇院舍</h1>
        </div>

        {listLoading ? (
          <div className="mb-4 text-center text-gray-500 text-sm py-6">載入院舍列表中...</div>
        ) : (
        <>
        {listError && (
          <div className="mb-4 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg text-sm flex items-center justify-between gap-2">
            <span>{listError}</span>
            <button
              type="button"
              onClick={reload}
              className="px-3 py-1 bg-yellow-100 hover:bg-yellow-200 rounded text-xs whitespace-nowrap"
            >
              重試
            </button>
          </div>
        )}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}
        {notice && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
            {notice}
          </div>
        )}
        </>
        )}

        <div className="space-y-3">
          {facilities.map((f) => (
            <div
              key={f.id}
              className={`w-full px-4 py-3 border rounded-lg flex items-center gap-2 transition-colors ${
                f.is_active
                  ? 'border-gray-300'
                  : 'border-red-200 bg-red-50 opacity-90'
              }`}
            >
              {f.is_active ? (
                <button
                  type="button"
                  disabled={loadingId !== null || busyId !== null || creating}
                  onClick={() => choose(f.id)}
                  className="flex-1 text-left hover:text-blue-600 disabled:opacity-50 font-medium"
                >
                  {loadingId === f.id ? '處理中...' : f.name}
                </button>
              ) : (
                <span className="flex-1 text-gray-500 font-medium">
                  {f.name}
                  <span className="ml-2 inline-block px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">已停用</span>
                </span>
              )}
              {f.is_active ? (
                <button
                  type="button"
                  title="中止所有用戶登入"
                  disabled={busyId !== null}
                  onClick={() => handleSuspend(f)}
                  className="p-1.5 text-orange-600 hover:bg-orange-50 rounded disabled:opacity-50"
                >
                  <Ban className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  title="恢復登入"
                  disabled={busyId !== null}
                  onClick={() => handleResume(f)}
                  className="p-1.5 text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                >
                  <Play className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                title="刪除院舍（僅空院舍）"
                disabled={busyId !== null}
                onClick={() => handleDelete(f)}
                className="p-1.5 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          {/* 新增院舍 */}
          <div className="flex gap-2 pt-2 border-t border-gray-200 mt-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !creating) handleCreate();
              }}
              placeholder="新院舍名稱"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="button"
              disabled={creating || loadingId !== null}
              onClick={handleCreate}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              {creating ? '新增中...' : '新增院舍'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
