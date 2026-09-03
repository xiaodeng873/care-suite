import React, { useState, useEffect } from 'react';
import { Building2, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * 開發者院舍閘門
 *
 * 開發者（Supabase Auth 登入）每次工作階段必須先選定院舍才能進入系統。
 * 顯示名稱取院舍設定（facility_settings.facility_name_zh）。
 * 可在此新增院舍（可新增多間）；不得預設行為，無法略過選擇。
 */
export const DeveloperFacilityGate: React.FC = () => {
  const { fetchFacilities, selectFacility, createFacility } = useAuth();
  const [facilities, setFacilities] = useState<{ id: number; name: string }[]>([]);
  const [listError, setListError] = useState('');
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const reload = () => {
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
        setListError('載入院舍列表失敗：' + (e?.message || String(e)));
      });
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = async (id: number) => {
    setLoadingId(id);
    setError('');
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
    try {
      const { error: err } = await createFacility(name);
      if (err) {
        setError(typeof err === 'string' ? err : '新增院舍失敗');
        return;
      }
      setNewName('');
      reload();
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white/95 backdrop-blur rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="text-center mb-6">
          <Building2 className="w-10 h-10 text-blue-600 mx-auto mb-2" />
          <h1 className="text-xl font-bold text-gray-800">選擇院舍</h1>
          <p className="text-sm text-gray-600 mt-1">請選擇要管理的院舍，登入後只會看到該院舍的資料</p>
        </div>

        {listError && (
          <div className="mb-4 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg text-sm">
            {listError}
          </div>
        )}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {facilities.map((f) => (
            <button
              key={f.id}
              type="button"
              disabled={loadingId !== null || creating}
              onClick={() => choose(f.id)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-left hover:border-blue-500 hover:bg-blue-50 disabled:opacity-50 transition-colors"
            >
              {loadingId === f.id ? '處理中...' : f.name}
            </button>
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
