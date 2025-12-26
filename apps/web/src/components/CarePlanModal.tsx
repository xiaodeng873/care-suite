import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Save, 
  User, 
  Calendar, 
  FileText, 
  Activity, 
  Plus, 
  Trash2, 
  ChevronDown, 
  ChevronUp,
  History,
  CheckCircle,
  AlertCircle,
  Clock
} from 'lucide-react';
import { 
  usePatients, 
  type CarePlan, 
  type CarePlanProblem, 
  type CarePlanNursingNeed,
  type CarePlanWithDetails,
  type PlanType,
  type ProblemCategory,
  type OutcomeReview,
  type ProblemLibrary,
  type NursingNeedItem
} from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import PatientAutocomplete from './PatientAutocomplete';

interface CarePlanModalProps {
  plan?: CarePlan | null;
  onClose: () => void;
  defaultPatientId?: number;
}

type TabType = 'basic' | 'nursing' | 'problems' | 'history';

const PLAN_TYPES: PlanType[] = ['首月計劃', '半年計劃', '年度計劃'];
const PROBLEM_CATEGORIES: ProblemCategory[] = ['護理', '物理治療', '職業治療', '言語治療', '營養師', '醫生'];
const OUTCOME_REVIEWS: OutcomeReview[] = ['保持現狀', '滿意', '部分滿意', '需要持續改善'];

const CarePlanModal: React.FC<CarePlanModalProps> = ({
  plan,
  onClose,
  defaultPatientId
}) => {
  const { 
    patients, 
    addCarePlan, 
    updateCarePlan, 
    carePlans,
    problemLibrary,
    nursingNeedItems,
    getCarePlanWithDetails,
    getCarePlanHistory,
    addProblemToLibrary,
    addNursingNeedItem
  } = usePatients();
  const { displayName } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('basic');
  
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(
    plan?.patient_id || defaultPatientId || null
  );
  
  // 基本資訊
  const [formData, setFormData] = useState({
    plan_date: plan?.plan_date || new Date().toISOString().split('T')[0],
    plan_type: (plan?.plan_type || '首月計劃') as PlanType,
    remarks: plan?.remarks || ''
  });
  
  // 護理需要
  const [nursingNeeds, setNursingNeeds] = useState<Map<string, { has_need: boolean; remarks: string }>>(new Map());
  const [newNursingNeedName, setNewNursingNeedName] = useState('');
  
  // 計劃問題
  const [problems, setProblems] = useState<Array<{
    id?: string;
    problem_library_id?: string;
    problem_category: ProblemCategory;
    problem_description: string;
    expected_goals: string[];
    interventions: string[];
    outcome_review?: OutcomeReview;
    problem_assessor: string;
    outcome_assessor: string;
  }>>([]);
  
  // 歷史版本
  const [historyPlans, setHistoryPlans] = useState<CarePlan[]>([]);
  const [selectedHistoryPlan, setSelectedHistoryPlan] = useState<CarePlanWithDetails | null>(null);
  
  // 問題庫選擇
  const [selectedCategory, setSelectedCategory] = useState<ProblemCategory>('護理');
  const [showProblemLibrary, setShowProblemLibrary] = useState(false);
  
  // 新增問題庫項目
  const [showAddProblem, setShowAddProblem] = useState(false);
  const [newProblem, setNewProblem] = useState({
    code: '',
    name: '',
    category: '護理' as ProblemCategory,
    description: '',
    expected_goals: [''],
    interventions: ['']
  });

  // 載入現有計劃詳情
  useEffect(() => {
    const loadPlanDetails = async () => {
      if (plan?.id) {
        setLoadingDetails(true);
        try {
          const details = await getCarePlanWithDetails(plan.id);
          if (details) {
            // 設定護理需要
            const needsMap = new Map<string, { has_need: boolean; remarks: string }>();
            details.nursing_needs.forEach(nn => {
              needsMap.set(nn.nursing_need_item_id, {
                has_need: nn.has_need,
                remarks: nn.remarks || ''
              });
            });
            setNursingNeeds(needsMap);
            
            // 設定問題
            setProblems(details.problems.map(p => ({
              id: p.id,
              problem_library_id: p.problem_library_id,
              problem_category: p.problem_category,
              problem_description: p.problem_description,
              expected_goals: p.expected_goals || [],
              interventions: p.interventions || [],
              outcome_review: p.outcome_review,
              problem_assessor: p.problem_assessor || '',
              outcome_assessor: p.outcome_assessor || ''
            })));
          }
          
          // 載入歷史版本
          const history = await getCarePlanHistory(plan.id);
          setHistoryPlans(history);
        } catch (error) {
          console.error('載入計劃詳情失敗:', error);
        } finally {
          setLoadingDetails(false);
        }
      } else {
        // 新增模式：初始化護理需要
        const needsMap = new Map<string, { has_need: boolean; remarks: string }>();
        nursingNeedItems.forEach(item => {
          needsMap.set(item.id, { has_need: false, remarks: '' });
        });
        setNursingNeeds(needsMap);
      }
    };
    
    loadPlanDetails();
  }, [plan, getCarePlanWithDetails, getCarePlanHistory, nursingNeedItems]);
  
  // 計算「整體」護理需要（自動計算）
  const overallNursingNeed = useMemo(() => {
    const overallItem = nursingNeedItems.find(item => item.name === '整體');
    if (!overallItem) return false;
    
    // 檢查除了「整體」之外是否有任何「有」的需要
    let hasAnyNeed = false;
    nursingNeeds.forEach((value, key) => {
      const item = nursingNeedItems.find(i => i.id === key);
      if (item && item.name !== '整體' && value.has_need) {
        hasAnyNeed = true;
      }
    });
    
    return hasAnyNeed;
  }, [nursingNeeds, nursingNeedItems]);
  
  // 獲取選定專業的問題庫
  const filteredProblemLibrary = useMemo(() => {
    return problemLibrary.filter(p => p.category === selectedCategory && p.is_active);
  }, [problemLibrary, selectedCategory]);
  
  // 判斷是否為首月計劃（入住30天內）
  const shouldBeFirstMonthPlan = useMemo(() => {
    if (!selectedPatientId) return false;
    const patient = patients.find(p => p.院友id === selectedPatientId);
    if (!patient?.入住日期) return false;
    
    const admissionDate = new Date(patient.入住日期);
    const deadline = new Date(admissionDate);
    deadline.setDate(deadline.getDate() + 30);
    
    // 檢查是否已有首月計劃
    const hasFirstMonthPlan = carePlans.some(
      p => p.patient_id === selectedPatientId && p.plan_type === '首月計劃' && p.id !== plan?.id
    );
    
    return !hasFirstMonthPlan && new Date() <= deadline;
  }, [selectedPatientId, patients, carePlans, plan]);
  
  const handleNursingNeedChange = (itemId: string, field: 'has_need' | 'remarks', value: boolean | string) => {
    setNursingNeeds(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(itemId) || { has_need: false, remarks: '' };
      newMap.set(itemId, { ...current, [field]: value });
      return newMap;
    });
  };
  
  const handleAddProblem = () => {
    setProblems(prev => [...prev, {
      problem_category: selectedCategory,
      problem_description: '',
      expected_goals: [''],
      interventions: [''],
      problem_assessor: displayName || '',
      outcome_assessor: ''
    }]);
  };
  
  const handleRemoveProblem = (index: number) => {
    setProblems(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleProblemChange = (index: number, field: string, value: any) => {
    setProblems(prev => prev.map((p, i) => 
      i === index ? { ...p, [field]: value } : p
    ));
  };
  
  const handleSelectFromLibrary = (libraryItem: ProblemLibrary) => {
    setProblems(prev => [...prev, {
      problem_library_id: libraryItem.id,
      problem_category: libraryItem.category,
      problem_description: libraryItem.name,
      expected_goals: [...libraryItem.expected_goals],
      interventions: [...libraryItem.interventions],
      problem_assessor: displayName || '',
      outcome_assessor: ''
    }]);
    setShowProblemLibrary(false);
  };
  
  const handleAddGoal = (problemIndex: number) => {
    setProblems(prev => prev.map((p, i) => 
      i === problemIndex ? { ...p, expected_goals: [...p.expected_goals, ''] } : p
    ));
  };
  
  const handleRemoveGoal = (problemIndex: number, goalIndex: number) => {
    setProblems(prev => prev.map((p, i) => 
      i === problemIndex ? { ...p, expected_goals: p.expected_goals.filter((_, gi) => gi !== goalIndex) } : p
    ));
  };
  
  const handleGoalChange = (problemIndex: number, goalIndex: number, value: string) => {
    setProblems(prev => prev.map((p, i) => 
      i === problemIndex ? { 
        ...p, 
        expected_goals: p.expected_goals.map((g, gi) => gi === goalIndex ? value : g) 
      } : p
    ));
  };
  
  const handleAddIntervention = (problemIndex: number) => {
    setProblems(prev => prev.map((p, i) => 
      i === problemIndex ? { ...p, interventions: [...p.interventions, ''] } : p
    ));
  };
  
  const handleRemoveIntervention = (problemIndex: number, interventionIndex: number) => {
    setProblems(prev => prev.map((p, i) => 
      i === problemIndex ? { ...p, interventions: p.interventions.filter((_, ii) => ii !== interventionIndex) } : p
    ));
  };
  
  const handleInterventionChange = (problemIndex: number, interventionIndex: number, value: string) => {
    setProblems(prev => prev.map((p, i) => 
      i === problemIndex ? { 
        ...p, 
        interventions: p.interventions.map((int, ii) => ii === interventionIndex ? value : int) 
      } : p
    ));
  };
  
  const handleAddNursingNeedItem = async () => {
    if (!newNursingNeedName.trim()) return;
    
    try {
      const newItem = await addNursingNeedItem({
        name: newNursingNeedName.trim(),
        is_default: false,
        display_order: nursingNeedItems.length,
        is_active: true
      });
      
      // 添加到當前護理需要
      setNursingNeeds(prev => {
        const newMap = new Map(prev);
        newMap.set(newItem.id, { has_need: false, remarks: '' });
        return newMap;
      });
      
      setNewNursingNeedName('');
    } catch (error) {
      console.error('新增護理需要項目失敗:', error);
      alert('新增護理需要項目失敗');
    }
  };
  
  const handleSaveNewProblemToLibrary = async () => {
    if (!newProblem.code || !newProblem.name) {
      alert('請填寫問題代碼和名稱');
      return;
    }
    
    try {
      await addProblemToLibrary({
        code: newProblem.code,
        name: newProblem.name,
        category: newProblem.category,
        description: newProblem.description,
        expected_goals: newProblem.expected_goals.filter(g => g.trim()),
        interventions: newProblem.interventions.filter(i => i.trim()),
        is_active: true,
        created_by: displayName || ''
      });
      
      setShowAddProblem(false);
      setNewProblem({
        code: '',
        name: '',
        category: '護理',
        description: '',
        expected_goals: [''],
        interventions: ['']
      });
      alert('已新增至問題庫');
    } catch (error) {
      console.error('新增問題庫失敗:', error);
      alert('新增問題庫失敗');
    }
  };
  
  const handleViewHistoryPlan = async (historyPlan: CarePlan) => {
    try {
      const details = await getCarePlanWithDetails(historyPlan.id);
      setSelectedHistoryPlan(details);
    } catch (error) {
      console.error('載入歷史計劃失敗:', error);
    }
  };
  
  const handleSubmit = async () => {
    if (!selectedPatientId) {
      alert('請選擇院友');
      return;
    }
    
    if (!formData.plan_date) {
      alert('請選擇計劃日期');
      return;
    }
    
    setLoading(true);
    
    try {
      // 準備護理需要資料（包含自動計算的整體）
      const overallItem = nursingNeedItems.find(item => item.name === '整體');
      const nursingNeedsData = Array.from(nursingNeeds.entries()).map(([itemId, value]) => {
        // 如果是整體項目，使用自動計算的值
        if (overallItem && itemId === overallItem.id) {
          return {
            nursing_need_item_id: itemId,
            has_need: overallNursingNeed,
            remarks: value.remarks
          };
        }
        return {
          nursing_need_item_id: itemId,
          has_need: value.has_need,
          remarks: value.remarks
        };
      });
      
      // 準備問題資料
      const problemsData = problems.map(p => ({
        problem_library_id: p.problem_library_id,
        problem_category: p.problem_category,
        problem_description: p.problem_description,
        expected_goals: p.expected_goals.filter(g => g.trim()),
        interventions: p.interventions.filter(i => i.trim()),
        outcome_review: p.outcome_review,
        problem_assessor: p.problem_assessor,
        outcome_assessor: p.outcome_assessor,
        display_order: 0
      }));
      
      if (plan?.id) {
        // 更新
        await updateCarePlan(
          plan.id,
          {
            plan_date: formData.plan_date,
            plan_type: formData.plan_type,
            remarks: formData.remarks
          },
          nursingNeedsData,
          problemsData
        );
      } else {
        // 計算版本號
        const existingPlans = carePlans.filter(p => p.patient_id === selectedPatientId);
        const maxVersion = existingPlans.reduce((max, p) => Math.max(max, p.version_number || 0), 0);
        
        // 新增
        await addCarePlan(
          {
            patient_id: selectedPatientId,
            plan_type: formData.plan_type,
            plan_date: formData.plan_date,
            version_number: maxVersion + 1,
            created_by: displayName || '',
            status: 'active',
            remarks: formData.remarks
          },
          nursingNeedsData,
          problemsData
        );
      }
      
      onClose();
    } catch (error) {
      console.error('儲存計劃失敗:', error);
      alert('儲存計劃失敗，請重試');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'basic' as TabType, label: '基本資訊', icon: User },
    { id: 'nursing' as TabType, label: '護理需要', icon: Activity },
    { id: 'problems' as TabType, label: '計劃內容', icon: FileText },
    { id: 'history' as TabType, label: '歷史版本', icon: History }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {plan ? '編輯個人照顧計劃' : '新增個人照顧計劃'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 px-6">
          <nav className="flex space-x-8">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loadingDetails ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">載入中...</span>
            </div>
          ) : (
            <>
              {/* 基本資訊 Tab */}
              {activeTab === 'basic' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        院友 <span className="text-red-500">*</span>
                      </label>
                      {plan ? (
                        <div className="form-input bg-gray-100 cursor-not-allowed">
                          {patients.find(p => p.院友id === selectedPatientId)?.中文姓名 || '-'}
                        </div>
                      ) : (
                        <PatientAutocomplete
                          value={selectedPatientId || ''}
                          onChange={(id) => setSelectedPatientId(Number(id))}
                        />
                      )}
                    </div>
                    
                    {selectedPatientId && (
                      <div className="col-span-2 p-4 bg-blue-50 rounded-lg">
                        {(() => {
                          const patient = patients.find(p => p.院友id === selectedPatientId);
                          const patientPlans = carePlans.filter(p => p.patient_id === selectedPatientId && p.id !== plan?.id).sort((a, b) => new Date(b.plan_date).getTime() - new Date(a.plan_date).getTime());
                          const lastPlan = patientPlans[0];
                          return (
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="text-gray-500">上次復檢日期：</span>
                                <span className="font-medium">
                                  {lastPlan?.plan_date ? new Date(lastPlan.plan_date).toLocaleDateString('zh-TW') : '-'}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500">入住日期：</span>
                                <span className="font-medium">
                                  {patient?.入住日期 ? new Date(patient.入住日期).toLocaleDateString('zh-TW') : '-'}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500">在住狀態：</span>
                                <span className="font-medium">{patient?.在住狀態 || '-'}</span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        計劃日期 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={formData.plan_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, plan_date: e.target.value }))}
                        className="form-input"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        計劃類型 <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.plan_type}
                        onChange={(e) => setFormData(prev => ({ ...prev, plan_type: e.target.value as PlanType }))}
                        className="form-input"
                      >
                        {PLAN_TYPES.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                      {shouldBeFirstMonthPlan && formData.plan_type !== '首月計劃' && (
                        <p className="mt-1 text-sm text-amber-600 flex items-center">
                          <AlertCircle className="h-4 w-4 mr-1" />
                          此院友尚在入住30天內，建議選擇「首月計劃」
                        </p>
                      )}
                    </div>
                    
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">備註</label>
                      <textarea
                        value={formData.remarks}
                        onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                        className="form-input"
                        rows={3}
                        placeholder="輸入備註..."
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 護理需要 Tab */}
              {activeTab === 'nursing' && (
                <div className="space-y-6">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">
                      請勾選院友的護理需要。「整體」欄位會自動計算：若有任何項目為「有」，則整體為「有」。
                    </p>
                  </div>
                  
                  <div className="space-y-4">
                    {nursingNeedItems.map(item => {
                      const isOverall = item.name === '整體';
                      const needValue = isOverall 
                        ? { has_need: overallNursingNeed, remarks: nursingNeeds.get(item.id)?.remarks || '' }
                        : (nursingNeeds.get(item.id) || { has_need: false, remarks: '' });
                      
                      return (
                        <div key={item.id} className={`flex items-center space-x-4 p-3 rounded-lg ${isOverall ? 'bg-blue-50' : 'bg-gray-50'}`}>
                          <div className="flex-1 font-medium text-gray-700">
                            {item.name}
                            {item.is_default && <span className="text-xs text-gray-400 ml-1">(預設)</span>}
                          </div>
                          
                          <div className="flex items-center space-x-4">
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="radio"
                                name={`nursing-${item.id}`}
                                checked={!needValue.has_need}
                                onChange={() => !isOverall && handleNursingNeedChange(item.id, 'has_need', false)}
                                disabled={isOverall}
                                className="form-radio"
                              />
                              <span className="text-sm">沒有</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="radio"
                                name={`nursing-${item.id}`}
                                checked={needValue.has_need}
                                onChange={() => !isOverall && handleNursingNeedChange(item.id, 'has_need', true)}
                                disabled={isOverall}
                                className="form-radio"
                              />
                              <span className="text-sm">有</span>
                            </label>
                          </div>
                          
                          {isOverall && (
                            <span className="text-xs text-blue-600">(自動計算)</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* 新增自訂護理需要項目 */}
                  <div className="border-t pt-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={newNursingNeedName}
                        onChange={(e) => setNewNursingNeedName(e.target.value)}
                        placeholder="新增護理需要項目名稱..."
                        className="form-input flex-1"
                      />
                      <button
                        onClick={handleAddNursingNeedItem}
                        disabled={!newNursingNeedName.trim()}
                        className="btn-secondary flex items-center space-x-1"
                      >
                        <Plus className="h-4 w-4" />
                        <span>新增項目</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 計劃內容 Tab */}
              {activeTab === 'problems' && (
                <div className="space-y-6">
                  {/* 專業類別選擇和問題庫 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <label className="text-sm font-medium text-gray-700">專業類別：</label>
                      <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value as ProblemCategory)}
                        className="form-input"
                      >
                        {PROBLEM_CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setShowProblemLibrary(!showProblemLibrary)}
                        className="btn-secondary flex items-center space-x-1"
                      >
                        <FileText className="h-4 w-4" />
                        <span>從問題庫選取</span>
                      </button>
                      <button
                        onClick={() => setShowAddProblem(true)}
                        className="btn-secondary flex items-center space-x-1"
                      >
                        <Plus className="h-4 w-4" />
                        <span>新增至問題庫</span>
                      </button>
                      <button
                        onClick={handleAddProblem}
                        className="btn-primary flex items-center space-x-1"
                      >
                        <Plus className="h-4 w-4" />
                        <span>新增問題</span>
                      </button>
                    </div>
                  </div>
                  
                  {/* 問題庫選擇面板 */}
                  {showProblemLibrary && (
                    <div className="border rounded-lg p-4 bg-gray-50">
                      <h4 className="font-medium text-gray-700 mb-3">問題庫 - {selectedCategory}</h4>
                      {filteredProblemLibrary.length === 0 ? (
                        <p className="text-gray-500 text-sm">此類別暫無問題庫項目</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {filteredProblemLibrary.map(lib => (
                            <button
                              key={lib.id}
                              onClick={() => handleSelectFromLibrary(lib)}
                              className="text-left p-3 bg-white rounded border hover:border-blue-300 hover:bg-blue-50 transition-colors"
                            >
                              <div className="font-medium text-sm">{lib.code} - {lib.name}</div>
                              {lib.description && (
                                <div className="text-xs text-gray-500 mt-1">{lib.description}</div>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* 問題列表 */}
                  {problems.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <FileText className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                      <p className="text-gray-500">尚未新增任何問題</p>
                      <p className="text-sm text-gray-400 mt-1">點擊「從問題庫選取」或「新增問題」開始</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {problems.map((problem, index) => (
                        <div key={index} className="border rounded-lg p-4 bg-white">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center space-x-2">
                              <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-sm font-medium">
                                問題 {index + 1}
                              </span>
                              <span className={`px-2 py-1 rounded text-xs ${
                                problem.problem_category === '護理' ? 'bg-blue-100 text-blue-700' :
                                problem.problem_category === '物理治療' ? 'bg-green-100 text-green-700' :
                                problem.problem_category === '職業治療' ? 'bg-purple-100 text-purple-700' :
                                problem.problem_category === '言語治療' ? 'bg-amber-100 text-amber-700' :
                                problem.problem_category === '營養師' ? 'bg-pink-100 text-pink-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {problem.problem_category}
                              </span>
                            </div>
                            <button
                              onClick={() => handleRemoveProblem(index)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          
                          <div className="space-y-4">
                            {/* 問題描述 */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">問題描述</label>
                              <input
                                type="text"
                                value={problem.problem_description}
                                onChange={(e) => handleProblemChange(index, 'problem_description', e.target.value)}
                                className="form-input"
                                placeholder="輸入問題描述..."
                              />
                            </div>
                            
                            {/* 期待目標 */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                期待目標
                                <button
                                  onClick={() => handleAddGoal(index)}
                                  className="ml-2 text-blue-600 hover:text-blue-800"
                                >
                                  <Plus className="h-4 w-4 inline" />
                                </button>
                              </label>
                              <div className="space-y-2">
                                {problem.expected_goals.map((goal, goalIndex) => (
                                  <div key={goalIndex} className="flex items-center space-x-2">
                                    <span className="text-gray-400 text-sm">{goalIndex + 1}.</span>
                                    <input
                                      type="text"
                                      value={goal}
                                      onChange={(e) => handleGoalChange(index, goalIndex, e.target.value)}
                                      className="form-input flex-1"
                                      placeholder="輸入期待目標..."
                                    />
                                    {problem.expected_goals.length > 1 && (
                                      <button
                                        onClick={() => handleRemoveGoal(index, goalIndex)}
                                        className="text-red-500 hover:text-red-700"
                                      >
                                        <X className="h-4 w-4" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                            
                            {/* 介入方式 */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                介入方式
                                <button
                                  onClick={() => handleAddIntervention(index)}
                                  className="ml-2 text-blue-600 hover:text-blue-800"
                                >
                                  <Plus className="h-4 w-4 inline" />
                                </button>
                              </label>
                              <div className="space-y-2">
                                {problem.interventions.map((intervention, intIndex) => (
                                  <div key={intIndex} className="flex items-center space-x-2">
                                    <span className="text-gray-400 text-sm">{intIndex + 1}.</span>
                                    <input
                                      type="text"
                                      value={intervention}
                                      onChange={(e) => handleInterventionChange(index, intIndex, e.target.value)}
                                      className="form-input flex-1"
                                      placeholder="輸入介入方式..."
                                    />
                                    {problem.interventions.length > 1 && (
                                      <button
                                        onClick={() => handleRemoveIntervention(index, intIndex)}
                                        className="text-red-500 hover:text-red-700"
                                      >
                                        <X className="h-4 w-4" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 歷史版本 Tab */}
              {activeTab === 'history' && (
                <div className="space-y-6">
                  {!plan ? (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <History className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                      <p className="text-gray-500">新增計劃後可查看歷史版本</p>
                    </div>
                  ) : historyPlans.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <History className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                      <p className="text-gray-500">暫無歷史版本</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-4">
                      {/* 版本列表 */}
                      <div className="col-span-1 space-y-2">
                        <h4 className="font-medium text-gray-700 mb-2">版本列表</h4>
                        {historyPlans.map(hp => (
                          <button
                            key={hp.id}
                            onClick={() => handleViewHistoryPlan(hp)}
                            className={`w-full text-left p-3 rounded border transition-colors ${
                              selectedHistoryPlan?.id === hp.id
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            } ${hp.id === plan.id ? 'ring-2 ring-blue-300' : ''}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">v{hp.version_number}</span>
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                hp.plan_type === '首月計劃' ? 'bg-green-100 text-green-700' :
                                hp.plan_type === '半年計劃' ? 'bg-blue-100 text-blue-700' :
                                'bg-purple-100 text-purple-700'
                              }`}>
                                {hp.plan_type}
                              </span>
                            </div>
                            <div className="text-sm text-gray-500 mt-1">
                              {new Date(hp.plan_date).toLocaleDateString('zh-TW')}
                            </div>
                            {hp.id === plan.id && (
                              <span className="text-xs text-blue-600">（當前版本）</span>
                            )}
                            {hp.reviewed_at && (
                              <div className="flex items-center text-xs text-green-600 mt-1">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                已復檢
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                      
                      {/* 版本詳情 */}
                      <div className="col-span-2">
                        {selectedHistoryPlan ? (
                          <div className="border rounded-lg p-4 bg-gray-50">
                            <h4 className="font-medium text-gray-700 mb-4">
                              版本 {selectedHistoryPlan.version_number} 詳情
                            </h4>
                            
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="text-gray-500">計劃日期：</span>
                                  <span className="font-medium">
                                    {new Date(selectedHistoryPlan.plan_date).toLocaleDateString('zh-TW')}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-500">計劃類型：</span>
                                  <span className="font-medium">{selectedHistoryPlan.plan_type}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">建立人員：</span>
                                  <span className="font-medium">{selectedHistoryPlan.created_by || '-'}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">問題數量：</span>
                                  <span className="font-medium">{selectedHistoryPlan.problem_count}</span>
                                </div>
                              </div>
                              
                              {/* 護理需要摘要 */}
                              <div>
                                <h5 className="text-sm font-medium text-gray-700 mb-2">護理需要</h5>
                                <div className="flex flex-wrap gap-2">
                                  {selectedHistoryPlan.nursing_needs
                                    .filter(nn => nn.has_need)
                                    .map(nn => (
                                      <span key={nn.id} className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                                        {nn.item_name}
                                      </span>
                                    ))}
                                  {selectedHistoryPlan.nursing_needs.filter(nn => nn.has_need).length === 0 && (
                                    <span className="text-gray-500 text-sm">無</span>
                                  )}
                                </div>
                              </div>
                              
                              {/* 問題列表 */}
                              <div>
                                <h5 className="text-sm font-medium text-gray-700 mb-2">問題列表</h5>
                                {selectedHistoryPlan.problems.length === 0 ? (
                                  <span className="text-gray-500 text-sm">無問題記錄</span>
                                ) : (
                                  <div className="space-y-2">
                                    {selectedHistoryPlan.problems.map((p, i) => (
                                      <div key={p.id} className="bg-white p-3 rounded border text-sm">
                                        <div className="flex items-center justify-between">
                                          <span className="font-medium">{i + 1}. {p.problem_description}</span>
                                          <span className="text-xs text-gray-500">{p.problem_category}</span>
                                        </div>
                                        {p.outcome_review && (
                                          <div className="mt-1 text-xs text-gray-600">
                                            成效：{p.outcome_review}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-full text-gray-400">
                            選擇版本查看詳情
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="btn-secondary"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !selectedPatientId}
            className="btn-primary flex items-center space-x-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                <span>儲存中...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>儲存</span>
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* 新增問題庫 Modal */}
      {showAddProblem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">新增問題至問題庫</h3>
              <button onClick={() => setShowAddProblem(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">問題代碼 *</label>
                  <input
                    type="text"
                    value={newProblem.code}
                    onChange={(e) => setNewProblem(prev => ({ ...prev, code: e.target.value }))}
                    className="form-input"
                    placeholder="例：N001、PT001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">專業類別 *</label>
                  <select
                    value={newProblem.category}
                    onChange={(e) => setNewProblem(prev => ({ ...prev, category: e.target.value as ProblemCategory }))}
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
                  value={newProblem.name}
                  onChange={(e) => setNewProblem(prev => ({ ...prev, name: e.target.value }))}
                  className="form-input"
                  placeholder="輸入問題名稱..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">說明</label>
                <textarea
                  value={newProblem.description}
                  onChange={(e) => setNewProblem(prev => ({ ...prev, description: e.target.value }))}
                  className="form-input"
                  rows={2}
                  placeholder="輸入問題說明..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  期待目標模板
                  <button
                    onClick={() => setNewProblem(prev => ({ ...prev, expected_goals: [...prev.expected_goals, ''] }))}
                    className="ml-2 text-blue-600"
                  >
                    <Plus className="h-4 w-4 inline" />
                  </button>
                </label>
                {newProblem.expected_goals.map((goal, i) => (
                  <div key={i} className="flex items-center space-x-2 mt-2">
                    <input
                      type="text"
                      value={goal}
                      onChange={(e) => {
                        const newGoals = [...newProblem.expected_goals];
                        newGoals[i] = e.target.value;
                        setNewProblem(prev => ({ ...prev, expected_goals: newGoals }));
                      }}
                      className="form-input flex-1"
                      placeholder="輸入期待目標..."
                    />
                    {newProblem.expected_goals.length > 1 && (
                      <button
                        onClick={() => {
                          const newGoals = newProblem.expected_goals.filter((_, gi) => gi !== i);
                          setNewProblem(prev => ({ ...prev, expected_goals: newGoals }));
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
                    onClick={() => setNewProblem(prev => ({ ...prev, interventions: [...prev.interventions, ''] }))}
                    className="ml-2 text-blue-600"
                  >
                    <Plus className="h-4 w-4 inline" />
                  </button>
                </label>
                {newProblem.interventions.map((int, i) => (
                  <div key={i} className="flex items-center space-x-2 mt-2">
                    <input
                      type="text"
                      value={int}
                      onChange={(e) => {
                        const newInts = [...newProblem.interventions];
                        newInts[i] = e.target.value;
                        setNewProblem(prev => ({ ...prev, interventions: newInts }));
                      }}
                      className="form-input flex-1"
                      placeholder="輸入介入方式..."
                    />
                    {newProblem.interventions.length > 1 && (
                      <button
                        onClick={() => {
                          const newInts = newProblem.interventions.filter((_, ii) => ii !== i);
                          setNewProblem(prev => ({ ...prev, interventions: newInts }));
                        }}
                        className="text-red-500"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t bg-gray-50">
              <button onClick={() => setShowAddProblem(false)} className="btn-secondary">取消</button>
              <button onClick={handleSaveNewProblemToLibrary} className="btn-primary">儲存至問題庫</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CarePlanModal;
