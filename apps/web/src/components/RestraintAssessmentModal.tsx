import React, { useState } from 'react';
import { X, Shield, Calendar, User, FileText, AlertTriangle } from 'lucide-react';
import { usePatients, type PatientRestraintAssessment } from '../context/PatientContext';
import PatientAutocomplete from './PatientAutocomplete';

interface RestraintAssessmentModalProps {
  assessment?: PatientRestraintAssessment;
  onClose: () => void;
  onUpdate?: () => void;
  renewFrom?: PatientRestraintAssessment | null;
}

const RestraintAssessmentModal: React.FC<RestraintAssessmentModalProps> = ({ assessment, onClose, onUpdate, renewFrom }) => {
  const { patients, addPatientRestraintAssessment, updatePatientRestraintAssessment } = usePatients();

  // 香港時區輔助函數
  const getHongKongDate = () => {
    const now = new Date();
    const hongKongTime = new Date(now.getTime() + (8 * 60 * 60 * 1000)); // GMT+8
    return hongKongTime.toISOString().split('T')[0];
  };

  const [formData, setFormData] = useState({
    patient_id: assessment?.patient_id || (renewFrom ? renewFrom.patient_id : '') as string | number,
    doctor_signature_date: assessment?.doctor_signature_date || '',
    next_due_date: assessment?.next_due_date || '',
    risk_factors: assessment?.risk_factors || (renewFrom?.risk_factors ?? {}),
    alternatives: assessment?.alternatives || (renewFrom?.alternatives ?? {}),
    suggested_restraints: assessment?.suggested_restraints || (renewFrom?.suggested_restraints ?? {}),
    other_restraint_notes: assessment?.other_restraint_notes || renewFrom?.other_restraint_notes || '',
    usage_record: assessment?.usage_record || {
      start_date: assessment?.doctor_signature_date || renewFrom?.doctor_signature_date || '',
      end_date: '',
      doctor: '',
      reasons: {} as Record<string, boolean | string>,
      types: {} as Record<string, boolean | string>,
      observations: { '血液循環': true, '呼吸狀況': true, '精神狀況': true, '皮膚狀況': true, '姿勢舒適': true } as Record<string, boolean | string>,
    },
  });

  // 計算下次到期日期（醫生簽署日期 + 6個月）
  const calculateNextDueDate = (signatureDate: string): string => {
    if (!signatureDate) return '';
    
    const date = new Date(signatureDate);
    date.setMonth(date.getMonth() + 6);
    return date.toISOString().split('T')[0];
  };

  // 當醫生簽署日期改變時，自動計算下次到期日期
  React.useEffect(() => {
    if (formData.doctor_signature_date) {
      const calculatedDueDate = calculateNextDueDate(formData.doctor_signature_date);
      setFormData(prev => ({
        ...prev,
        next_due_date: calculatedDueDate,
        // 開始日期預填醫生簽署日期（僅當尚未填寫時）
        usage_record: prev.usage_record?.start_date
          ? prev.usage_record
          : { ...prev.usage_record, start_date: formData.doctor_signature_date },
      }));
    }
  }, [formData.doctor_signature_date]);

  // 風險因素選項
  const riskFactorCategories = [
    {
      category: '精神及/或行為異常的情況',
      subcategories: [
        '情緒問題/神志昏亂',
        '遊走',
        '傷害自己的行為，請註明：',
        '傷害/騷擾他人的行為，請註明：'
      ]
    },
    {
      category: '未能保持正確坐姿',
      subcategories: [
        '背部及腰肢肌肉無力',
        '癱瘓',
        '關節退化',
        '其他，請註明：'
      ]
    },
    {
      category: '有跌倒風險',
      subcategories: [
        '步履失平衡',
        '住院期間曾經跌倒',
        '視/聽力衰退',
        '受藥物影響',
        '其他跌倒的風險，請註明：'
      ]
    },
    {
      category: '曾除去治療用之醫療器材及／或維護身體的用品',
      subcategories: [
        '餵食管',
        '氧氣喉管或面罩',
        '尿片或衣服',
        '其他造口護理裝置',
        '導尿管',
        '其他醫療器材，請註明：'
      ]
    },
    {
      category: '其他，請註明：',
      subcategories: []
    }
  ];

  // 折衷辦法選項
  const alternativeOptions = [
    '延醫診治，找出影響情緒或神志昏亂的原因並處理',
    '與註冊醫生/註冊中醫/表列中醫商討療程或調校藥物',
    '尋求物理治療師/職業治療師/臨床心理學家/社工的介入',
    '改善家具：使用更合適的座椅、座墊或其他配件',
    '改善環境：令住客對環境感安全、舒適及熟悉',
    '提供消閒及分散注意力的活動',
    '多與住客傾談，建立融洽互信的關係',
    '安老院員工定期觀察及巡視',
    '調節日常護理程序以配合住客的特殊需要',
    '請家人/親友探望協助',
    '其他，請註明：'
  ];

  // 約束物品選項
  const restraintOptions = [
    {
      name: '約束衣',
      usageConditions: ['坐在椅上', '躺在床上', '坐在椅上及躺在床上']
    },
    {
      name: '約束腰帶',
      usageConditions: ['坐在椅上', '躺在床上', '坐在椅上及躺在床上']
    },
    {
      name: '手腕帶',
      usageConditions: ['坐在椅上', '躺在床上', '坐在椅上及躺在床上']
    },
    {
      name: '約束手套/連指手套',
      usageConditions: ['坐在椅上', '躺在床上', '坐在椅上及躺在床上']
    },
    {
      name: '防滑褲/防滑褲帶',
      usageConditions: ['坐在椅上', '躺在床上', '坐在椅上及躺在床上']
    },
    {
      name: '枱板',
      usageConditions: ['坐在椅上/輪椅上']
    },
    {
      name: '其他：',
      usageConditions: ['坐在椅上', '躺在床上', '坐在椅上及躺在床上']
    }
  ];

  // 生成時段選項
  const generateTimeOptions = () => {
    const dayTimes = []; // 日間：早上7點到晚上7點
    const nightTimes = []; // 晚間：晚上7點到早上7點
    
    // 日間時段：7A, 8A, 9A, 10A, 11A, 12N, 1P, 2P, 3P, 4P, 5P, 6P, 7P
    for (let hour = 7; hour <= 11; hour++) {
      dayTimes.push(`${hour}A`);
    }
    dayTimes.push('12N'); // 中午
    for (let hour = 1; hour <= 7; hour++) {
      dayTimes.push(`${hour}P`);
    }
    
    // 晚間時段：7P, 8P, 9P, 10P, 11P, 12M, 1A, 2A, 3A, 4A, 5A, 6A, 7A
    for (let hour = 7; hour <= 11; hour++) {
      nightTimes.push(`${hour}P`);
    }
    nightTimes.push('12M'); // 午夜
    for (let hour = 1; hour <= 7; hour++) {
      nightTimes.push(`${hour}A`);
    }
    
    return { dayTimes, nightTimes };
  };

  const { dayTimes, nightTimes } = generateTimeOptions();

  const handleRiskFactorChange = (category: string, subcategory: string, checked: boolean) => {
    setFormData(prev => {
      const newRiskFactors = { ...prev.risk_factors };
      newRiskFactors[subcategory] = checked;
      
      // 檢查是否有任何子項目被勾選，如果有則勾選主項目
      if (category === '精神及/或行為異常的情況') {
        const subcategories = ['情緒問題/神志昏亂', '遊走', '傷害自己的行為，請註明：', '傷害/騷擾他人的行為，請註明：'];
        const hasAnyChecked = subcategories.some(sub => newRiskFactors[sub]);
        newRiskFactors[category] = hasAnyChecked;
      } else if (category === '未能保持正確坐姿') {
        const subcategories = ['背部及腰肢肌肉無力', '癱瘓', '關節退化', '其他，請註明：'];
        const hasAnyChecked = subcategories.some(sub => newRiskFactors[sub]);
        newRiskFactors[category] = hasAnyChecked;
      } else if (category === '有跌倒風險') {
        const subcategories = ['步履失平衡', '住院期間曾經跌倒', '視/聽力衰退', '受藥物影響', '其他跌倒的風險，請註明：'];
        const hasAnyChecked = subcategories.some(sub => newRiskFactors[sub]);
        newRiskFactors[category] = hasAnyChecked;
      } else if (category === '曾除去治療用之醫療器材及／或維護身體的用品') {
        const subcategories = ['餵食管', '氧氣喉管或面罩', '尿片或衣服', '其他造口護理裝置', '導尿管', '其他，請註明：'];
        const hasAnyChecked = subcategories.some(sub => newRiskFactors[sub]);
        newRiskFactors[category] = hasAnyChecked;
      }
      
      return {
        ...prev,
        risk_factors: newRiskFactors
      };
    });
  };

  const handleAlternativeChange = (category: string, subcategory: string, checked: boolean) => {
    setFormData(prev => {
      const newAlternatives = { ...prev.alternatives };
      newAlternatives[subcategory] = checked;
      
      return {
        ...prev,
        alternatives: newAlternatives
      };
    });
  };

  const handleAlternativeOptionChange = (option: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      alternatives: {
        ...prev.alternatives,
        [option]: checked
      }
    }));
  };

  const handleRestraintChange = (restraint: string, field: string, value: any) => {
    setFormData(prev => {
      const newRestraints = { ...prev.suggested_restraints };
      if (!newRestraints[restraint]) {
        newRestraints[restraint] = { checked: false };
      }
      newRestraints[restraint] = {
        ...newRestraints[restraint],
        [field]: value
      };
      return {
        ...prev,
        suggested_restraints: newRestraints
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.patient_id) {
      alert('請選擇院友');
      return;
    }

    // 必須至少勾選一個風險因素
    const hasAnyRiskFactor = riskFactorCategories.some(({ category, subcategories }) =>
      formData.risk_factors[category] || subcategories.some(sub => formData.risk_factors[sub])
    );
    if (!hasAnyRiskFactor) {
      alert('請至少勾選一個風險因素評估');
      return;
    }

    // 有子類的父類如被勾選，必須至少有一個子類被勾選
    for (const { category, subcategories } of riskFactorCategories) {
      if (subcategories.length > 0 && formData.risk_factors[category]) {
        const hasChild = subcategories.some(sub => formData.risk_factors[sub]);
        if (!hasChild) {
          alert(`「${category}」已勾選，請至少選擇一個子項目`);
          return;
        }
      }
    }

    // 必須至少勾選一個折衷辦法
    const hasAnyAlternative = Object.values(formData.alternatives).some(v => v === true);
    if (!hasAnyAlternative) {
      alert('請至少勾選一個折衷辦法');
      return;
    }

    // 必須至少勾選一個約束物品建議
    const hasAnyRestraint = Object.values(formData.suggested_restraints).some(
      (config: any) => config?.checked === true
    );
    if (!hasAnyRestraint) {
      alert('請至少勾選一個約束物品建議');
      return;
    }

    // 勾選「其他：」時必須填寫約束物品類型
    const otherRestraint = formData.suggested_restraints['其他：'] as any;
    if (otherRestraint?.checked && !otherRestraint?.otherRestraintType?.trim()) {
      alert('請輸入其他約束物品類型');
      return;
    }

    try {
      const assessmentData = {
        patient_id: parseInt(formData.patient_id),
        doctor_signature_date: formData.doctor_signature_date || null,
        next_due_date: formData.next_due_date || null,
        risk_factors: formData.risk_factors,
        alternatives: formData.alternatives,
        suggested_restraints: formData.suggested_restraints,
        other_restraint_notes: formData.other_restraint_notes || null,
        usage_record: formData.usage_record || null,
      };

      if (assessment) {
        await updatePatientRestraintAssessment({
          id: assessment.id,
          ...assessmentData
        });
      } else {
        await addPatientRestraintAssessment(assessmentData);
      }
      
      onUpdate?.();
      onClose();
    } catch (error) {
      console.error('儲存約束物品評估失敗:', error);
      alert('儲存約束物品評估失敗，請重試');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-100">
                <Shield className="h-6 w-6 text-yellow-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">
                {assessment ? '編輯約束物品評估' : renewFrom ? '新增評估（續期）' : '新增約束物品評估'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 基本資訊 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="form-label">
                <User className="h-4 w-4 inline mr-1" />
                院友 *
              </label>
              {assessment || renewFrom ? (
                <div className="form-input bg-gray-100 cursor-not-allowed">
                  {(() => {
                    const pid = assessment?.patient_id ?? renewFrom?.patient_id;
                    const p = patients.find(pt => pt.院友id === Number(pid));
                    return p ? `${p.床號} - ${p.中文姓名}` : '未知院友';
                  })()
                  }
                </div>
              ) : (
                <PatientAutocomplete
                  value={formData.patient_id}
                  onChange={(patientId) => setFormData(prev => ({ ...prev, patient_id: patientId }))}
                  placeholder="搜尋院友..."
                  showResidencyFilter={true}
                  defaultResidencyStatus="在住"
                />
              )}
            </div>

            <div>
              <label className="form-label">
                <Calendar className="h-4 w-4 inline mr-1" />
                醫生簽署日期
              </label>
              <input
                type="date"
                value={formData.doctor_signature_date}
                onChange={(e) => setFormData(prev => ({ ...prev, doctor_signature_date: e.target.value }))}
                className="form-input"
              />
            </div>

            <div>
              <label className="form-label">
                <Calendar className="h-4 w-4 inline mr-1" />
                下次到期日期
              </label>
              <input
                type="date"
                value={formData.next_due_date}
                onChange={(e) => setFormData(prev => ({ ...prev, next_due_date: e.target.value }))}
                className="form-input bg-gray-50"
                readOnly
              />
              <p className="text-xs text-gray-500 mt-1">
                自動計算：醫生簽署日期 + 6個月
              </p>
            </div>
          </div>

          {/* 風險因素 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2 text-yellow-600" />
              風險因素評估
            </h3>
            
            {riskFactorCategories.map(({ category, subcategories }) => (
              <div key={category} className="border rounded-lg p-4 bg-gray-50">
                <div className="space-y-3">
                  {/* 主項目 checkbox */}
                  <label className="flex flex-wrap items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.risk_factors[category] || false}
                      onChange={(e) => setFormData(prev => {
                        const newRiskFactors = { ...prev.risk_factors, [category]: e.target.checked };
                        // 取消勾選父類時，同時取消其下所有子類
                        if (!e.target.checked) {
                          subcategories.forEach(sub => { newRiskFactors[sub] = false; });
                        }
                        return { ...prev, risk_factors: newRiskFactors };
                      })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="font-medium text-gray-900">{category}</span>
                  </label>
                  {/* 子項目 */}
                  <div className="ml-6 space-y-2">
                    {subcategories.map(subcategory => (
                      <div key={subcategory}>
                        <label className="flex flex-wrap items-center gap-2">
                          <input
                            type="checkbox"
                            checked={formData.risk_factors[subcategory] || false}
                            onChange={(e) => handleRiskFactorChange(category, subcategory, e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700">{subcategory}</span>
                        </label>
                        {/* 傷害自己的行為說明 */}
                        {subcategory === '傷害自己的行為，請註明：' && formData.risk_factors[subcategory] && (
                          <div className="ml-6 mt-2">
                            
                            <textarea
                              value={formData.risk_factors['傷害自己的行為說明'] || ''}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                risk_factors: {
                                  ...prev.risk_factors,
                                  '傷害自己的行為說明': e.target.value
                                }
                              }))}
                              className="form-input text-sm"
                              rows={1}
                              placeholder="請詳細說明..."
                            />
                          </div>
                        )}
                        {/* 傷害/騷擾他人的行為說明 */}
                        {subcategory === '傷害/騷擾他人的行為，請註明：' && formData.risk_factors[subcategory] && (
                          <div className="ml-6 mt-2">
                           
                            <textarea
                              value={formData.risk_factors['傷害/騷擾他人的行為說明'] || ''}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                risk_factors: {
                                  ...prev.risk_factors,
                                  '傷害/騷擾他人的行為說明': e.target.value
                                }
                              }))}
                              className="form-input text-sm"
                              rows={1}
                              placeholder="請詳細說明..."
                            />
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {/* 其他說明 */}
                    {category === '未能保持正確坐姿' && formData.risk_factors['其他，請註明：'] && (
                      <div className="mt-2">
                      
                        <textarea
                          value={formData.risk_factors['其他未能保持正確坐姿說明'] || ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            risk_factors: {
                              ...prev.risk_factors,
                              '其他未能保持正確坐姿說明': e.target.value
                            }
                          }))}
                          className="form-input text-sm"
                          rows={1}
                          placeholder="請詳細說明..."
                        />
                      </div>
                    )}
                    
                    {category === '有跌倒風險' && formData.risk_factors['其他跌倒的風險，請註明：'] && (
                      <div className="mt-2">
              
                        <textarea
                          value={formData.risk_factors['其他跌倒的風險說明'] || ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            risk_factors: {
                              ...prev.risk_factors,
                              '其他跌倒的風險說明': e.target.value
                            }
                          }))}
                          className="form-input text-sm"
                          rows={1}
                          placeholder="請詳細說明..."
                        />
                      </div>
                    )}
                    
                    {category === '曾除去治療用之醫療器材及／或維護身體的用品' && formData.risk_factors['其他醫療器材，請註明：'] && (
                      <div className="mt-2">
                   
                        <textarea
                          value={formData.risk_factors['其他醫療器材說明'] || ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            risk_factors: {
                              ...prev.risk_factors,
                              '其他醫療器材說明': e.target.value
                            }
                          }))}
                          className="form-input text-sm"
                          rows={1}
                          placeholder="請詳細說明..."
                        />
                      </div>
                    )}
                    
                    {category === '其他，請註明：' && (
                      <div className="mt-2">
                        <textarea
                          value={formData.risk_factors['其他風險因素說明'] || ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            risk_factors: {
                              ...prev.risk_factors,
                              '其他風險因素說明': e.target.value
                            }
                          }))}
                          className="form-input text-sm"
                          rows={1}
                          placeholder="請詳細說明其他風險因素..."
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 折衷辦法 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-blue-600" />
              折衷辦法
            </h3>
            
            <div className="border rounded-lg p-4 bg-gray-50">
              <div className="space-y-3">
  
                <p className="text-sm text-gray-600">（請在合適的方格內加上「✓」號，可作多項選擇）</p>
                
                <div className="space-y-2">
                  {alternativeOptions.map(option => (
                    <label key={option} className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={formData.alternatives[option] || false}
                        onChange={(e) => handleAlternativeOptionChange(option, e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-0.5"
                      />
                      <span className="text-sm text-gray-700">{option}</span>
                    </label>
                  ))}
                </div>
                
                {/* 其他說明文字區域 */}
                {formData.alternatives['其他，請註明：'] && (
                  <div className="mt-3">
            
                    <textarea
                      value={formData.alternatives.其他說明 || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        alternatives: {
                          ...prev.alternatives,
                          其他說明: e.target.value
                        }
                      }))}
                      className="form-input text-sm"
                      rows={1}
                      placeholder="請詳細說明其他折衷辦法..."
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 約束物品建議 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <Shield className="h-5 w-5 mr-2 text-yellow-600" />
              約束物品建議
            </h3>
            
            {/* 約束物品建議表格 */}
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 border-r">約束物品種類</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 border-r">使用約束物品情況</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">使用約束物品的時段</th>
                  </tr>
                </thead>
                <tbody>
                  {restraintOptions.map((restraintOption, index) => {
                    const restraintName = restraintOption.name;
                    const config = formData.suggested_restraints[restraintName] || { 
                      checked: false,
                      usageConditions: '',
                      dayTime: false,
                      dayStartTime: '',
                      dayEndTime: '',
                      nightTime: false,
                      nightStartTime: '',
                      nightEndTime: '',
                      allDay: false,
                      otherTime: '',
                      otherRestraintType: ''
                    };
                    
                    return (
                      <tr key={restraintName} className={`border-t ${index % 2 === 1 ? 'bg-gray-50' : 'bg-white'}`}>
                        {/* 約束物品種類 */}
                        <td className="px-4 py-4 border-r align-top">
                          <div className="space-y-2">
                            <label className="flex flex-wrap items-center gap-2">
                              <input
                                type="checkbox"
                                checked={config.checked || false}
                                onChange={(e) => handleRestraintChange(restraintName, 'checked', e.target.checked)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <span className="font-medium text-gray-900">{restraintName}</span>
                            </label>
                            
                            {/* 其他約束物品類型輸入 */}
                            {restraintName === '其他：' && config.checked && (
                              <div className="ml-6">
                                <input
                                  type="text"
                                  value={config.otherRestraintType || ''}
                                  onChange={(e) => handleRestraintChange(restraintName, 'otherRestraintType', e.target.value)}
                                  className="form-input text-sm w-full"
                                  placeholder="請輸入約束物品類型..."
                                />
                              </div>
                            )}
                          </div>
                        </td>
                        
                        {/* 使用約束物品情況 */}
                        <td className="px-4 py-4 border-r align-top">
                          {config.checked && (
                            <div className="space-y-2">
                              {restraintOption.usageConditions.map(condition => (
                                <label key={condition} className="flex flex-wrap items-center gap-2">
                                  <input
                                    type="radio"
                                    name={`${restraintName}-usage-condition`}
                                    value={condition}
                                    checked={config.usageConditions === condition}
                                    onChange={(e) => handleRestraintChange(restraintName, 'usageConditions', e.target.value)}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                  />
                                  <span className="text-sm text-gray-700">{condition}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </td>
                        
                        {/* 使用約束物品的時段 */}
                        <td className="px-4 py-4 align-top">
                          {config.checked && (
                            <div className="space-y-3">
                              {/* 日間時段 */}
                              <div className="flex flex-wrap items-center gap-2 flex-wrap">
                                <input
                                  type="checkbox"
                                  checked={config.dayTime || false}
                                  onChange={(e) => handleRestraintChange(restraintName, 'dayTime', e.target.checked)}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label className="text-sm text-gray-700">日間 (由</label>
                                <select
                                  value={config.dayStartTime || ''}
                                  onChange={(e) => handleRestraintChange(restraintName, 'dayStartTime', e.target.value)}
                                  className="form-input text-sm w-20"
                                  disabled={!config.dayTime}
                                >
                                  <option value="">--:-- --</option>
                                  {dayTimes.map(time => (
                                    <option key={`day-start-${time}`} value={time}>{time}</option>
                                  ))}
                                </select>
                                <label className="text-sm text-gray-700">時至</label>
                                <select
                                  value={config.dayEndTime || ''}
                                  onChange={(e) => handleRestraintChange(restraintName, 'dayEndTime', e.target.value)}
                                  className="form-input text-sm w-20"
                                  disabled={!config.dayTime}
                                >
                                  <option value="">--:-- --</option>
                                  {dayTimes.map(time => (
                                    <option key={`day-end-${time}`} value={time}>{time}</option>
                                  ))}
                                </select>
                                <label className="text-sm text-gray-700">時 )</label>
                              </div>
                              
                              {/* 晚上時段 */}
                              <div className="flex flex-wrap items-center gap-2 flex-wrap">
                                <input
                                  type="checkbox"
                                  checked={config.nightTime || false}
                                  onChange={(e) => handleRestraintChange(restraintName, 'nightTime', e.target.checked)}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label className="text-sm text-gray-700">晚上 (由</label>
                                <select
                                  value={config.nightStartTime || ''}
                                  onChange={(e) => handleRestraintChange(restraintName, 'nightStartTime', e.target.value)}
                                  className="form-input text-sm w-20"
                                  disabled={!config.nightTime}
                                >
                                  <option value="">--:-- --</option>
                                  {nightTimes.map(time => (
                                    <option key={`night-start-${time}`} value={time}>{time}</option>
                                  ))}
                                </select>
                                <label className="text-sm text-gray-700">時至</label>
                                <select
                                  value={config.nightEndTime || ''}
                                  onChange={(e) => handleRestraintChange(restraintName, 'nightEndTime', e.target.value)}
                                  className="form-input text-sm w-20"
                                  disabled={!config.nightTime}
                                >
                                  <option value="">--:-- --</option>
                                  {nightTimes.map(time => (
                                    <option key={`night-end-${time}`} value={time}>{time}</option>
                                  ))}
                                </select>
                                <label className="text-sm text-gray-700">時 )</label>
                              </div>
                              
                              {/* 全日時段 */}
                              <div className="flex flex-wrap items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={config.allDay || false}
                                  onChange={(e) => handleRestraintChange(restraintName, 'allDay', e.target.checked)}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label className="text-sm text-gray-700">全日</label>
                              </div>
                              
                              {/* 其他時段 */}
                              <div className="flex flex-wrap items-center gap-2">
                                <label className="text-xs font-medium text-gray-700">其他：</label>
                                <textarea
                                  value={config.otherTime || ''}
                                  onChange={(e) => handleRestraintChange(restraintName, 'otherTime', e.target.value)}
                                  className="form-input text-sm flex-1"
                                  rows={1}
                                  placeholder="請輸入其他時段說明..."
                                />
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 約束物品使用紀錄 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-green-600" />
              約束物品使用紀錄
            </h3>
            <div className="border rounded-lg p-4 bg-gray-50 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">開始日期</label>
                  <input
                    type="date"
                    value={formData.usage_record?.start_date || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, usage_record: { ...prev.usage_record, start_date: e.target.value } }))}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">結束日期</label>
                  <input
                    type="date"
                    value={formData.usage_record?.end_date || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, usage_record: { ...prev.usage_record, end_date: e.target.value } }))}
                    className="form-input"
                  />
                </div>
              </div>
              <div>
                <label className="form-label">處方醫生</label>
                <input
                  type="text"
                  value={formData.usage_record?.doctor || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, usage_record: { ...prev.usage_record, doctor: e.target.value } }))}
                  className="form-input"
                  placeholder="請輸入處方醫生姓名"
                />
              </div>
              {/* 原因 */}
              <div>
                <label className="form-label font-medium">原因（可多選）</label>
                <div className="flex flex-wrap gap-x-4 gap-y-2 mt-1">
                  {['自身安全', '維持治療', '防止跌倒', '免傷害他人'].map(r => (
                    <label key={r} className="flex items-center gap-2">
                      <input type="checkbox"
                        checked={!!formData.usage_record?.reasons?.[r]}
                        onChange={(e) => setFormData(prev => ({ ...prev, usage_record: { ...prev.usage_record, reasons: { ...prev.usage_record?.reasons, [r]: e.target.checked } } }))}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded" />
                      <span className="text-sm">{r}</span>
                    </label>
                  ))}
                  <label className="flex items-center gap-2">
                    <input type="checkbox"
                      checked={!!formData.usage_record?.reasons?.['其他']}
                      onChange={(e) => setFormData(prev => ({ ...prev, usage_record: { ...prev.usage_record, reasons: { ...prev.usage_record?.reasons, '其他': e.target.checked } } }))}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded" />
                    <span className="text-sm">其他:</span>
                  </label>
                  {formData.usage_record?.reasons?.['其他'] && (
                    <input type="text"
                      value={(formData.usage_record?.reasons?.['其他_text'] as string) || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, usage_record: { ...prev.usage_record, reasons: { ...prev.usage_record?.reasons, '其他_text': e.target.value } } }))}
                      className="form-input text-sm" placeholder="請說明..." />
                  )}
                </div>
              </div>
              {/* 種類 */}
              <div>
                <label className="form-label font-medium">種類（可多選）</label>
                <div className="flex flex-wrap gap-x-4 gap-y-2 mt-1">
                  {['約束衣', '約束腰帶', '手腕帶', '約束手套', '防滑褲帶', '枱板'].map(t => (
                    <label key={t} className="flex items-center gap-2">
                      <input type="checkbox"
                        checked={!!formData.usage_record?.types?.[t]}
                        onChange={(e) => setFormData(prev => ({ ...prev, usage_record: { ...prev.usage_record, types: { ...prev.usage_record?.types, [t]: e.target.checked } } }))}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded" />
                      <span className="text-sm">{t}</span>
                    </label>
                  ))}
                  <label className="flex items-center gap-2">
                    <input type="checkbox"
                      checked={!!formData.usage_record?.types?.['其他']}
                      onChange={(e) => setFormData(prev => ({ ...prev, usage_record: { ...prev.usage_record, types: { ...prev.usage_record?.types, '其他': e.target.checked } } }))}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded" />
                    <span className="text-sm">其他:</span>
                  </label>
                  {formData.usage_record?.types?.['其他'] && (
                    <input type="text"
                      value={(formData.usage_record?.types?.['其他_text'] as string) || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, usage_record: { ...prev.usage_record, types: { ...prev.usage_record?.types, '其他_text': e.target.value } } }))}
                      className="form-input text-sm" placeholder="請說明..." />
                  )}
                </div>
              </div>
              {/* 需要觀察事項 */}
              <div>
                <label className="form-label font-medium">需要觀察事項（可多選）</label>
                <div className="flex flex-wrap gap-x-4 gap-y-2 mt-1">
                  {['血液循環', '呼吸狀況', '精神狀況', '皮膚狀況', '姿勢舒適'].map(o => (
                    <label key={o} className="flex items-center gap-2">
                      <input type="checkbox"
                        checked={!!formData.usage_record?.observations?.[o]}
                        onChange={(e) => setFormData(prev => ({ ...prev, usage_record: { ...prev.usage_record, observations: { ...prev.usage_record?.observations, [o]: e.target.checked } } }))}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded" />
                      <span className="text-sm">{o}</span>
                    </label>
                  ))}
                  <label className="flex items-center gap-2">
                    <input type="checkbox"
                      checked={!!formData.usage_record?.observations?.['其他']}
                      onChange={(e) => setFormData(prev => ({ ...prev, usage_record: { ...prev.usage_record, observations: { ...prev.usage_record?.observations, '其他': e.target.checked } } }))}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded" />
                    <span className="text-sm">其他:</span>
                  </label>
                  {formData.usage_record?.observations?.['其他'] && (
                    <input type="text"
                      value={(formData.usage_record?.observations?.['其他_text'] as string) || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, usage_record: { ...prev.usage_record, observations: { ...prev.usage_record?.observations, '其他_text': e.target.value } } }))}
                      className="form-input text-sm" placeholder="請說明..." />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 提交按鈕 */}
          <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-gray-200">
            <button
              type="submit"
              className="btn-primary flex-1"
            >
              {assessment ? '更新約束物品評估' : '新增約束物品評估'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RestraintAssessmentModal;