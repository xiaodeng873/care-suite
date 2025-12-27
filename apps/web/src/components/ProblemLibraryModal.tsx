import React, { useState, useMemo } from 'react';
import { X, Plus, Search, Edit3, Trash2, Check, FileText } from 'lucide-react';
import { usePatients, type ProblemLibrary, type ProblemCategory } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';

const PROBLEM_CATEGORIES: ProblemCategory[] = ['護理', '社工', '物理治療', '職業治療', '言語治療', '營養師', '醫生'];

interface ProblemLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ProblemLibraryModal: React.FC<ProblemLibraryModalProps> = ({ isOpen, onClose }) => {
  const { problemLibrary, addProblemToLibrary, updateProblemLibrary, deleteProblemLibrary } = usePatients();
  const { displayName } = useAuth();
  
  const [selectedCategory, setSelectedCategory] = useState<ProblemCategory>('護理');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: '護理' as ProblemCategory,
    description: '',
    expected_goals: [''],
    interventions: ['']
  });

  const filteredProblems = useMemo(() => {
    return problemLibrary
      .filter(p => p.category === selectedCategory && p.is_active)
      .filter(p => 
        !searchTerm || 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [problemLibrary, selectedCategory, searchTerm]);

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      category: selectedCategory,
      description: '',
      expected_goals: [''],
      interventions: ['']
    });
    setShowAddForm(false);
    setEditingId(null);
  };

  const handleEdit = (problem: ProblemLibrary) => {
    setFormData({
      code: problem.code,
      name: problem.name,
      category: problem.category,
      description: problem.description || '',
      expected_goals: problem.expected_goals?.length ? problem.expected_goals : [''],
      interventions: problem.interventions?.length ? problem.interventions : ['']
    });
    setEditingId(problem.id);
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除此問題項目嗎？')) return;
    setDeletingId(id);
    try {
      await deleteProblemLibrary(id);
    } catch (error) {
      console.error('刪除失敗:', error);
      alert('刪除失敗');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('請填寫問題名稱');
      return;
    }

    try {
      if (editingId) {
        await updateProblemLibrary({
          id: editingId,
          code: formData.code, // 保留現有代碼
          name: formData.name,
          category: formData.category,
          description: formData.description,
          expected_goals: formData.expected_goals.filter(g => g.trim()),
          interventions: formData.interventions.filter(i => i.trim())
        });
        alert('已更新');
      } else {
        // 自動生成問題代碼
        const categoryPrefix = {
          '護理': 'N',
          '社工': 'SW',
          '物理治療': 'PT',
          '職業治療': 'OT',
          '言語治療': 'ST',
          '營養師': 'D',
          '醫生': 'MD'
        }[formData.category];
        
        // 獲取同類別問題數量來生成編號
        const sameCategory = problemLibrary.filter((p: ProblemLibrary) => p.category === formData.category);
        const nextNumber = String(sameCategory.length + 1).padStart(3, '0');
        const autoCode = `${categoryPrefix}${nextNumber}`;
        
        await addProblemToLibrary({
          code: autoCode,
          name: formData.name,
          category: formData.category,
          description: formData.description,
          expected_goals: formData.expected_goals.filter(g => g.trim()),
          interventions: formData.interventions.filter(i => i.trim()),
          is_active: true,
          created_by: displayName || ''
        });
        alert('已新增至問題庫');
      }
      resetForm();
    } catch (error) {
      console.error('儲存失敗:', error);
      alert('儲存失敗');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center space-x-3">
            <FileText className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">問題庫管理</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="px-6 py-3 border-b bg-gray-50">
          <div className="flex flex-wrap gap-2">
            {PROBLEM_CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => { setSelectedCategory(cat); setSearchTerm(''); }}
                className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Search and Add */}
        <div className="px-6 py-3 border-b flex items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索問題代碼、名稱..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input pl-10 w-full"
            />
          </div>
          <button
            onClick={() => { resetForm(); setFormData(prev => ({ ...prev, category: selectedCategory })); setShowAddForm(true); }}
            className="btn-primary flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>新增問題</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {showAddForm ? (
            /* Add/Edit Form */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">{editingId ? '編輯問題' : '新增問題'}</h3>
                <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">問題代碼</label>
                  <input
                    type="text"
                    value={formData.code}
                    disabled
                    className="form-input bg-gray-50 text-gray-500 cursor-not-allowed"
                    placeholder="自動產生"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">專業類別 *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as ProblemCategory }))}
                    className="form-input"
                  >
                    {PROBLEM_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">問題名稱 *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="form-input"
                  placeholder="輸入問題名稱..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">說明</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="form-input"
                  rows={2}
                  placeholder="輸入問題說明..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  期待目標模板
                  <button
                    onClick={() => setFormData(prev => ({ ...prev, expected_goals: [...prev.expected_goals, ''] }))}
                    className="ml-2 text-blue-600"
                  >
                    <Plus className="h-4 w-4 inline" />
                  </button>
                </label>
                {formData.expected_goals.map((goal, i) => (
                  <div key={i} className="flex items-center space-x-2 mt-2">
                    <input
                      type="text"
                      value={goal}
                      onChange={(e) => {
                        const newGoals = [...formData.expected_goals];
                        newGoals[i] = e.target.value;
                        setFormData(prev => ({ ...prev, expected_goals: newGoals }));
                      }}
                      className="form-input flex-1"
                      placeholder="輸入期待目標..."
                    />
                    {formData.expected_goals.length > 1 && (
                      <button
                        onClick={() => {
                          const newGoals = formData.expected_goals.filter((_, gi) => gi !== i);
                          setFormData(prev => ({ ...prev, expected_goals: newGoals }));
                        }}
                        className="text-red-500"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  介入方式模板
                  <button
                    onClick={() => setFormData(prev => ({ ...prev, interventions: [...prev.interventions, ''] }))}
                    className="ml-2 text-blue-600"
                  >
                    <Plus className="h-4 w-4 inline" />
                  </button>
                </label>
                {formData.interventions.map((int, i) => (
                  <div key={i} className="flex items-center space-x-2 mt-2">
                    <input
                      type="text"
                      value={int}
                      onChange={(e) => {
                        const newInts = [...formData.interventions];
                        newInts[i] = e.target.value;
                        setFormData(prev => ({ ...prev, interventions: newInts }));
                      }}
                      className="form-input flex-1"
                      placeholder="輸入介入方式..."
                    />
                    {formData.interventions.length > 1 && (
                      <button
                        onClick={() => {
                          const newInts = formData.interventions.filter((_, ii) => ii !== i);
                          setFormData(prev => ({ ...prev, interventions: newInts }));
                        }}
                        className="text-red-500"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button onClick={resetForm} className="btn-secondary">取消</button>
                <button onClick={handleSave} className="btn-primary">
                  {editingId ? '更新' : '儲存'}
                </button>
              </div>
            </div>
          ) : (
            /* Problem List */
            <div className="space-y-3">
              {filteredProblems.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>此類別暫無問題項目</p>
                  <p className="text-sm mt-1">點擊「新增問題」開始建立</p>
                </div>
              ) : (
                filteredProblems.map(problem => (
                  <div
                    key={problem.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                            {problem.code}
                          </span>
                          <span className="font-medium text-gray-900">{problem.name}</span>
                        </div>
                        {problem.description && (
                          <p className="text-sm text-gray-500 mt-1">{problem.description}</p>
                        )}
                        {problem.expected_goals && problem.expected_goals.length > 0 && (
                          <div className="mt-2">
                            <span className="text-xs text-gray-500">期待目標：</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {problem.expected_goals.map((g, i) => (
                                <span key={i} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded">
                                  {g}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {problem.interventions && problem.interventions.length > 0 && (
                          <div className="mt-2">
                            <span className="text-xs text-gray-500">介入方式：</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {problem.interventions.map((int, i) => (
                                <span key={i} className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded">
                                  {int}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => handleEdit(problem)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                          title="編輯"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(problem.id)}
                          disabled={deletingId === problem.id}
                          className="p-1.5 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                          title="刪除"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-between items-center">
          <span className="text-sm text-gray-500">
            共 {filteredProblems.length} 個問題項目
          </span>
          <button onClick={onClose} className="btn-secondary">關閉</button>
        </div>
      </div>
    </div>
  );
};

export default ProblemLibraryModal;
