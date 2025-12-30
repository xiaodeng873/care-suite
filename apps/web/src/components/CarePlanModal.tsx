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
  Clock,
  Users
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
  type NursingNeedItem,
  type CaseConferenceProfessional
} from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import { getPatientContacts, type PatientContact } from '../lib/database';
import PatientAutocomplete from './PatientAutocomplete';

interface CarePlanModalProps {
  plan?: CarePlan | null;
  onClose: () => void;
  defaultPatientId?: number;
  isDuplicate?: boolean; // 是否為另存模式
}

type TabType = 'basic' | 'nursing' | 'problems' | 'review' | 'conference';

const PLAN_TYPES: PlanType[] = ['首月計劃', '半年計劃', '年度計劃'];
const PROBLEM_CATEGORIES: ProblemCategory[] = ['護理', '社工', '物理治療', '職業治療', '言語治療', '營養師', '醫生'];
const OUTCOME_REVIEWS: OutcomeReview[] = ['保持現狀', '滿意', '部分滿意', '需要持續改善'];

const CarePlanModal: React.FC<CarePlanModalProps> = ({
  plan,
  onClose,
  defaultPatientId,
  isDuplicate = false
}) => {
  const { 
    patients, 
    addCarePlan, 
    updateCarePlan, 
    carePlans,
    problemLibrary,
    nursingNeedItems,
    getCarePlanWithDetails,
    addProblemToLibrary,
    addNursingNeedItem,
    diagnosisRecords
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
    plan_date: isDuplicate ? new Date().toISOString().split('T')[0] : (plan?.plan_date || new Date().toISOString().split('T')[0]),
    plan_type: (isDuplicate ? '半年計劃' : (plan?.plan_type || '首月計劃')) as PlanType,
    remarks: plan?.remarks || ''
  });
  
  // 計算的復檢到期日（用於顯示）
  const [calculatedReviewDueDate, setCalculatedReviewDueDate] = useState<string>('');
  
  // 護理需要
  const [nursingNeeds, setNursingNeeds] = useState<Map<string, boolean>>(new Map());
  const [newNursingNeedName, setNewNursingNeedName] = useState('');
  
  // 一鍵檢討下拉選單的 key，用於強制重置
  const [bulkReviewKey, setBulkReviewKey] = useState(0);
  
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

  // 個案會議
  const [caseConference, setCaseConference] = useState<{
    conference_date: string;
    professionals: { category: ProblemCategory; assessor: string; assessment_date: string }[];
    family_contact_date: string;
    family_member_name: string;
  }>({
    conference_date: plan?.case_conference_date || '',
    professionals: plan?.case_conference_professionals || [],
    family_contact_date: plan?.family_contact_date || '',
    family_member_name: plan?.family_member_name || ''
  });
  const [patientContacts, setPatientContacts] = useState<PatientContact[]>([]);

  // 載入患者聯絡人
  useEffect(() => {
    const loadContacts = async () => {
      if (selectedPatientId) {
        try {
          const contacts = await getPatientContacts(selectedPatientId);
          setPatientContacts(contacts);
        } catch (error) {
          console.error('載入聯絡人失敗:', error);
        }
      }
    };
    loadContacts();
  }, [selectedPatientId]);

  // 初始化復檢到期日
  useEffect(() => {
    if (formData.plan_date && formData.plan_type) {
      const reviewDate = new Date(formData.plan_date);
      if (formData.plan_type === '首月計劃' || formData.plan_type === '半年計劃') {
        reviewDate.setMonth(reviewDate.getMonth() + 6);
      } else if (formData.plan_type === '年度計劃') {
        reviewDate.setFullYear(reviewDate.getFullYear() + 1);
      }
      setCalculatedReviewDueDate(reviewDate.toISOString().split('T')[0]);
    }
  }, []);

  // 載入現有計劃詳情
  useEffect(() => {
    const loadPlanDetails = async () => {
      if (plan?.id) {
        setLoadingDetails(true);
        try {
          const details = await getCarePlanWithDetails(plan.id);
          if (details) {
            // 設定護理需要
            const needsMap = new Map<string, boolean>();
            details.nursing_needs.forEach(nn => {
              needsMap.set(nn.nursing_need_item_id, nn.has_need);
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
        } catch (error) {
          console.error('載入計劃詳情失敗:', error);
        } finally {
          setLoadingDetails(false);
        }
      } else {
        // 新增模式：初始化護理需要
        const needsMap = new Map<string, boolean>();
        nursingNeedItems.forEach(item => {
          needsMap.set(item.id, false);
        });
        setNursingNeeds(needsMap);
      }
    };
    
    loadPlanDetails();
  }, [plan, getCarePlanWithDetails, nursingNeedItems]);
  
  // 計算「整體」護理需要（自動計算）
  const overallNursingNeed = useMemo(() => {
    const overallItem = nursingNeedItems.find(item => item.name === '整體');
    if (!overallItem) return false;
    
    // 檢查除了「整體」之外是否有任何「有」的需要
    let hasAnyNeed = false;
    nursingNeeds.forEach((hasNeed, key) => {
      const item = nursingNeedItems.find(i => i.id === key);
      if (item && item.name !== '整體' && hasNeed) {
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
  
  const handleNursingNeedChange = (itemId: string, value: boolean) => {
    setNursingNeeds(prev => {
      const newMap = new Map(prev);
      newMap.set(itemId, value);
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
        newMap.set(newItem.id, false);
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
      const nursingNeedsData = Array.from(nursingNeeds.entries()).map(([itemId, hasNeed]) => {
        // 如果是整體項目，使用自動計算的值
        if (overallItem && itemId === overallItem.id) {
          return {
            nursing_need_item_id: itemId,
            has_need: overallNursingNeed
          };
        }
        return {
          nursing_need_item_id: itemId,
          has_need: hasNeed
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
      
      if (plan?.id && !isDuplicate) {
        // 更新
        await updateCarePlan(
          plan.id,
          {
            plan_date: formData.plan_date,
            plan_type: formData.plan_type,
            remarks: formData.remarks,
            case_conference_date: caseConference.conference_date || undefined,
            case_conference_professionals: caseConference.professionals.length > 0 ? caseConference.professionals : undefined,
            family_contact_date: caseConference.family_contact_date || undefined,
            family_member_name: caseConference.family_member_name || undefined
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
            remarks: formData.remarks,
            case_conference_date: caseConference.conference_date || undefined,
            case_conference_professionals: caseConference.professionals.length > 0 ? caseConference.professionals : undefined,
            family_contact_date: caseConference.family_contact_date || undefined,
            family_member_name: caseConference.family_member_name || undefined
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
    { id: 'review' as TabType, label: '成效檢討', icon: CheckCircle },
    { id: 'conference' as TabType, label: '個案會議', icon: Users }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {isDuplicate ? '另存個人照顧計劃' : (plan ? '編輯個人照顧計劃' : '新增個人照顧計劃')}
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
                          const patientDiagnoses = diagnosisRecords.filter(d => d.patient_id === selectedPatientId);
                          const hasDiagnosis = patientDiagnoses.length > 0;
                          const hasAllergy = patient?.藥物敏感 && patient.藥物敏感.length > 0;
                          const hasAdverseReaction = patient?.不良藥物反應 && patient.不良藥物反應.length > 0;
                          
                          return (
                            <div className="space-y-3">
                              <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                  <span className="text-gray-500">上次復檢日期：</span>
                                  <span className="font-medium">
                                    {lastPlan?.review_due_date ? new Date(lastPlan.review_due_date).toLocaleDateString('zh-TW') : '-'}
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
                              <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                  <span className="text-gray-500">入住類型：</span>
                                  <span className="font-medium">{patient?.入住類型 || '-'}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">護理等級：</span>
                                  <span className="font-medium">{patient?.護理等級 || '-'}</span>
                                </div>
                              </div>
                              
                              <div className="border-t border-blue-200 pt-3 mt-3">
                                <div className="space-y-2">
                                  <div className="text-sm">
                                    <span className="text-gray-500">診斷：</span>
                                    <span className="font-medium ml-2">
                                      {hasDiagnosis ? (
                                        patientDiagnoses.map((record, idx) => (
                                          <span key={idx}>
                                            {idx > 0 && '、'}
                                            {record.diagnosis_item}
                                          </span>
                                        ))
                                      ) : (
                                        '-'
                                      )}
                                    </span>
                                  </div>
                                  <div className="text-sm">
                                    <span className="text-gray-500">藥物過敏：</span>
                                    <span className="font-medium ml-2">
                                      {hasAllergy ? patient?.藥物敏感?.join('、') : 'NKDA'}
                                    </span>
                                  </div>
                                  <div className="text-sm">
                                    <span className="text-gray-500">藥物不良反應：</span>
                                    <span className="font-medium ml-2">
                                      {hasAdverseReaction ? patient?.不良藥物反應?.join('、') : 'NKADR'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                    
                    <div className="col-span-2 grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          計劃類型 <span className="text-red-500">*</span>
                        </label>
                      <select
                        value={formData.plan_type}
                        onChange={(e) => {
                          const newPlanType = e.target.value as PlanType;
                          setFormData(prev => ({ ...prev, plan_type: newPlanType }));
                          
                          // 自動計算計劃日期和復檢到期日（僅在另存或新增模式時）
                          if (selectedPatientId && (isDuplicate || !plan)) {
                            const patient = patients.find(p => p.院友id === selectedPatientId);
                            const patientPlans = carePlans
                              .filter(p => p.patient_id === selectedPatientId && (!plan || p.id !== plan.id))
                              .sort((a, b) => new Date(b.plan_date).getTime() - new Date(a.plan_date).getTime());
                            const lastPlan = patientPlans[0];
                            
                            let calculatedPlanDate = new Date();
                            
                            if (newPlanType === '首月計劃') {
                              // 首月計劃：入住日期 + 30天
                              if (patient?.入住日期) {
                                calculatedPlanDate = new Date(patient.入住日期);
                                calculatedPlanDate.setDate(calculatedPlanDate.getDate() + 30);
                              }
                            } else if (newPlanType === '半年計劃') {
                              // 半年計劃：上次復檢到期日（如果沒有則用今天）
                              if (lastPlan?.review_due_date) {
                                calculatedPlanDate = new Date(lastPlan.review_due_date);
                              }
                            } else if (newPlanType === '年度計劃') {
                              // 年度計劃：上次復檢到期日（如果沒有則用今天）
                              if (lastPlan?.review_due_date) {
                                calculatedPlanDate = new Date(lastPlan.review_due_date);
                              }
                            }
                            
                            const planDateStr = calculatedPlanDate.toISOString().split('T')[0];
                            setFormData(prev => ({ ...prev, plan_date: planDateStr }));
                            
                            // 計算復檢到期日
                            const reviewDate = new Date(calculatedPlanDate);
                            if (newPlanType === '首月計劃' || newPlanType === '半年計劃') {
                              reviewDate.setMonth(reviewDate.getMonth() + 6);
                            } else if (newPlanType === '年度計劃') {
                              reviewDate.setFullYear(reviewDate.getFullYear() + 1);
                            }
                            setCalculatedReviewDueDate(reviewDate.toISOString().split('T')[0]);
                          }
                        }}
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
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          計劃日期 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={formData.plan_date}
                          onChange={(e) => {
                            const newPlanDate = e.target.value;
                            setFormData(prev => ({ ...prev, plan_date: newPlanDate }));
                            
                            // 當手動修改計劃日期時，重新計算復檢到期日
                            if (newPlanDate) {
                              const reviewDate = new Date(newPlanDate);
                              if (formData.plan_type === '首月計劃' || formData.plan_type === '半年計劃') {
                                reviewDate.setMonth(reviewDate.getMonth() + 6);
                              } else if (formData.plan_type === '年度計劃') {
                                reviewDate.setFullYear(reviewDate.getFullYear() + 1);
                              }
                              setCalculatedReviewDueDate(reviewDate.toISOString().split('T')[0]);
                            }
                          }}
                          className="form-input"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          下次復檢日期
                        </label>
                        <input
                          type="date"
                          value={calculatedReviewDueDate}
                          readOnly
                          className="form-input bg-gray-50 cursor-not-allowed"
                        />
                      </div>
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
                      const hasNeed = isOverall ? overallNursingNeed : (nursingNeeds.get(item.id) || false);
                      
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
                                checked={!hasNeed}
                                onChange={() => !isOverall && handleNursingNeedChange(item.id, false)}
                                disabled={isOverall}
                                className="form-radio"
                              />
                              <span className="text-sm">沒有</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="radio"
                                name={`nursing-${item.id}`}
                                checked={hasNeed}
                                onChange={() => !isOverall && handleNursingNeedChange(item.id, true)}
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

              {/* 成效檢討 Tab */}
              {activeTab === 'review' && (
                <div className="space-y-6">
                  {problems.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <CheckCircle className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                      <p className="text-gray-500">尚未新增問題，請在「計劃內容」分頁中新增問題</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg flex-1">
                          <p className="text-sm text-blue-800">
                            請對每個問題進行成效檢討，選擇最合適的評估結果。
                          </p>
                        </div>
                        
                        {/* 一鍵檢訊 */}
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-600">一鍵檢討：</span>
                          <select
                            key={bulkReviewKey}
                            onChange={(e) => {
                              if (e.target.value) {
                                const review = e.target.value as OutcomeReview;
                                setProblems(prev => prev.map(p => ({ ...p, outcome_review: review })));
                                // 增加 key 值來強制重置組件
                                setBulkReviewKey(prev => prev + 1);
                              }
                            }}
                            className="form-input text-sm"
                            defaultValue=""
                          >
                            <option value="">選擇評估...</option>
                            {OUTCOME_REVIEWS.map(review => (
                              <option key={review} value={review}>{review}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      
                      {problems
                        .map((problem, originalIndex) => ({ problem, originalIndex }))
                        .sort((a, b) => {
                          // 未檢討的排在前面
                          const aReviewed = a.problem.outcome_review ? 1 : 0;
                          const bReviewed = b.problem.outcome_review ? 1 : 0;
                          return aReviewed - bReviewed;
                        })
                        .map(({ problem, originalIndex: index }) => (
                        <div key={index} className="border rounded-lg p-4 bg-white">
                          <div className="space-y-3">
                            {/* 問題標題 */}
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-2">
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
                                <p className="text-sm font-medium text-gray-900">{problem.problem_description}</p>
                              </div>
                            </div>
                            
                            {/* 期待目標 */}
                            {problem.expected_goals.filter(g => g.trim()).length > 0 && (
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">期待目標</label>
                                <ul className="list-disc list-inside space-y-1">
                                  {problem.expected_goals.filter(g => g.trim()).map((goal, gi) => (
                                    <li key={gi} className="text-sm text-gray-600">{goal}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            {/* 介入方式 */}
                            {problem.interventions.filter(i => i.trim()).length > 0 && (
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">介入方式</label>
                                <ul className="list-disc list-inside space-y-1">
                                  {problem.interventions.filter(i => i.trim()).map((intervention, ii) => (
                                    <li key={ii} className="text-sm text-gray-600">{intervention}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            {/* 成效檢討選項 */}
                            <div className="pt-3 border-t">
                              <label className="block text-sm font-medium text-gray-700 mb-2">成效檢討</label>
                              <div className="flex flex-wrap gap-3">
                                {OUTCOME_REVIEWS.map(review => (
                                  <label 
                                    key={review} 
                                    className="flex items-center space-x-2 cursor-pointer"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      // 如果再次點擊已選中的選項，則取消選擇
                                      if (problem.outcome_review === review) {
                                        handleProblemChange(index, 'outcome_review', undefined);
                                      } else {
                                        handleProblemChange(index, 'outcome_review', review);
                                      }
                                    }}
                                  >
                                    <input
                                      type="radio"
                                      name={`outcome-review-${index}`}
                                      checked={problem.outcome_review === review}
                                      onChange={() => {}} // 空函數避免 React 警告
                                      className="form-radio h-4 w-4 text-blue-600 pointer-events-none"
                                    />
                                    <span className="text-sm">{review}</span>
                                  </label>
                                ))}
                              </div>
                              {problem.outcome_review ? (
                                <div className="mt-2 flex items-center text-xs text-green-600">
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  已選擇：{problem.outcome_review}
                                </div>
                              ) : (
                                <div className="mt-2 flex items-center text-xs text-amber-600">
                                  <AlertCircle className="h-4 w-4 mr-1" />
                                  待檢討
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 個案會議 Tab */}
              {activeTab === 'conference' && (
                <div className="space-y-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="text-lg font-medium text-blue-800 mb-2">個案會議記錄</h3>
                    <p className="text-sm text-blue-600">記錄個案會議資訊，包括各專業評估者和評估日期</p>
                  </div>

                  {/* 會議日期 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">會議日期</label>
                    <input
                      type="date"
                      value={caseConference.conference_date}
                      onChange={(e) => setCaseConference(prev => ({ ...prev, conference_date: e.target.value }))}
                      className="form-input w-full max-w-xs"
                    />
                  </div>

                  {/* 各專業評估 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">各專業評估</label>
                    <div className="space-y-3">
                      {PROBLEM_CATEGORIES.map(category => {
                        // 檢查計劃是否有該專業的問題
                        const hasProblem = problems.some(p => p.problem_category === category);
                        const profData = caseConference.professionals.find(p => p.category === category);
                        // 獲取該專業問題的評估者作為默認值
                        const defaultAssessor = problems.find(p => p.problem_category === category)?.problem_assessor || '';
                        
                        return (
                          <div key={category} className={`grid grid-cols-3 gap-4 p-3 rounded-lg ${hasProblem ? 'bg-gray-50' : 'bg-gray-100 opacity-60'}`}>
                            <div className="flex items-center">
                              <span className={`text-sm font-medium ${hasProblem ? 'text-gray-900' : 'text-gray-400'}`}>
                                {category}
                              </span>
                              {!hasProblem && <span className="text-xs text-gray-400 ml-2">(無相關問題)</span>}
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">評估者</label>
                              <input
                                type="text"
                                placeholder={hasProblem ? (defaultAssessor || '輸入評估者') : ''}
                                value={profData?.assessor || (hasProblem ? defaultAssessor : '')}
                                onChange={(e) => {
                                  setCaseConference(prev => {
                                    const existing = prev.professionals.find(p => p.category === category);
                                    if (existing) {
                                      return {
                                        ...prev,
                                        professionals: prev.professionals.map(p => 
                                          p.category === category ? { ...p, assessor: e.target.value } : p
                                        )
                                      };
                                    } else {
                                      return {
                                        ...prev,
                                        professionals: [...prev.professionals, {
                                          category,
                                          assessor: e.target.value,
                                          assessment_date: formData.plan_date
                                        }]
                                      };
                                    }
                                  });
                                }}
                                disabled={!hasProblem}
                                className="form-input text-sm w-full"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">評估日期</label>
                              <input
                                type="date"
                                value={profData?.assessment_date || (hasProblem ? formData.plan_date : '')}
                                max={formData.plan_date}
                                onChange={(e) => {
                                  setCaseConference(prev => {
                                    const existing = prev.professionals.find(p => p.category === category);
                                    if (existing) {
                                      return {
                                        ...prev,
                                        professionals: prev.professionals.map(p => 
                                          p.category === category ? { ...p, assessment_date: e.target.value } : p
                                        )
                                      };
                                    } else {
                                      return {
                                        ...prev,
                                        professionals: [...prev.professionals, {
                                          category,
                                          assessor: defaultAssessor,
                                          assessment_date: e.target.value
                                        }]
                                      };
                                    }
                                  });
                                }}
                                disabled={!hasProblem}
                                className="form-input text-sm w-full"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 家屬聯絡 */}
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">家屬聯絡</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">聯絡家屬/聽取報告日期 (選填)</label>
                        <input
                          type="date"
                          value={caseConference.family_contact_date}
                          onChange={(e) => setCaseConference(prev => ({ ...prev, family_contact_date: e.target.value }))}
                          className="form-input w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">院友家屬姓名 (選填)</label>
                        <div className="relative">
                          <input
                            type="text"
                            list="family-contacts"
                            value={caseConference.family_member_name}
                            onChange={(e) => setCaseConference(prev => ({ ...prev, family_member_name: e.target.value }))}
                            className="form-input w-full"
                            placeholder="輸入或選擇聯絡人"
                          />
                          <datalist id="family-contacts">
                            {patientContacts.map(contact => (
                              <option key={contact.id} value={`${contact.聯絡人姓名}${contact.關係 ? ` (${contact.關係})` : ''}`} />
                            ))}
                          </datalist>
                        </div>
                      </div>
                    </div>
                  </div>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60" onClick={() => setShowAddProblem(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
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
