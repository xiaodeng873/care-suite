import React, { useEffect } from 'react';
import DateInput from './DateInput';

type NursingAssessmentValue = Record<string, string | boolean>;

interface PatientNursingAssessmentSectionProps {
  value: NursingAssessmentValue;
  onChange: (value: NursingAssessmentValue) => void;
  currentUserName?: string;
  currentUserRank?: string;
}

const PatientNursingAssessmentSection: React.FC<PatientNursingAssessmentSectionProps> = ({
  value,
  onChange,
  currentUserName,
  currentUserRank
}) => {
  const v = value || {};

  const getBool = (key: string) => !!v[key];
  const getText = (key: string) => typeof v[key] === 'string' ? v[key] : '';

  const setVal = (key: string, val: string | boolean) => {
    onChange({ ...v, [key]: val });
  };

  // 自動帶入現時登入者作為評估員姓名及職級（若欄位為空）
  useEffect(() => {
    if (!currentUserName && !currentUserRank) return;

    const next: NursingAssessmentValue = { ...v };
    let changed = false;

    if (currentUserName && !getText('assessor_name')) {
      next.assessor_name = currentUserName;
      changed = true;
    }
    if (currentUserRank && !getText('assessor_rank')) {
      next.assessor_rank = currentUserRank;
      changed = true;
    }

    if (changed) {
      onChange(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserName, currentUserRank]);

  const Checkbox: React.FC<{k: string;label: React.ReactNode;disabled?: boolean;}> = ({
    k,
    label,
    disabled
  }) =>
  <label className="inline-flex items-center gap-1.5 text-sm text-gray-700 whitespace-nowrap">
      <input
      type="checkbox"
      checked={getBool(k)}
      onChange={(e) => setVal(k, e.target.checked)}
      disabled={disabled}
      className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 disabled:opacity-50" />
    
      <span>{label}</span>
    </label>;


  const TextInput: React.FC<{
    k: string;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    type?: 'text' | 'date';
  }> = ({ k, placeholder, className = 'form-input', disabled, type = 'text' }) =>
  type === 'date' ?
  <DateInput

    value={getText(k)}

    disabled={disabled}
    className={className}
    placeholder={placeholder} onChange={(value) => setVal(k, value)} /> :


  <input
    type="text"
    value={getText(k)}
    onChange={(e) => setVal(k, e.target.value)}
    disabled={disabled}
    className={className}
    placeholder={placeholder} />;



  const CheckboxWithText: React.FC<{
    cbKey: string;
    textKey: string;
    label: React.ReactNode;
    inputClassName?: string;
  }> = ({ cbKey, textKey, label, inputClassName = 'form-input' }) =>
  <div className="flex flex-wrap items-center gap-2">
      <Checkbox k={cbKey} label={label} />
      <TextInput
      k={textKey}
      className={`${inputClassName} flex-1 min-w-[120px]`}
      disabled={!getBool(cbKey)} />
    
    </div>;


  const SectionCard: React.FC<{title: string;children: React.ReactNode;}> = ({ title, children }) =>
  <div className="border border-gray-200 rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {children}
    </div>;


  return (
    <div className="space-y-6">
      {/* 一般情況 */}
      <SectionCard title="一般情況">
        <div className="flex flex-wrap items-center gap-4">
          <Checkbox k="general_good" label="滿意" />
          <Checkbox k="general_normal" label="一般" />
          <Checkbox k="general_weak" label="衰弱" />
          <CheckboxWithText cbKey="general_other_cb" textKey="general_other_text" label="其他：" />
        </div>
      </SectionCard>

      {/* 精神狀況與情緒方面 */}
      <SectionCard title="精神狀況與情緒方面">
        <div className="flex flex-wrap items-center gap-4">
          <Checkbox k="mental_normal" label="正常" />
          <Checkbox k="mental_confuse" label="混亂" />
          <Checkbox k="mental_dementia" label="癡呆" />
          <CheckboxWithText cbKey="mental_other_cb" textKey="mental_other_text" label="其他：" />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Checkbox k="mood_normal" label="正常" />
          <Checkbox k="mood_anxious" label="憂慮" />
          <Checkbox k="mood_irritable" label="煩躁" />
          <Checkbox k="mood_depressed" label="憂鬱" />
          <CheckboxWithText cbKey="mood_other_cb" textKey="mood_other_text" label="其他：" />
        </div>
      </SectionCard>

      {/* 體格 */}
      <SectionCard title="體格">
        <div className="flex flex-wrap items-center gap-4">
          <Checkbox k="body_normal" label="正常" />
          <Checkbox k="body_thin" label="瘦削" />
          <Checkbox k="body_fat" label="過肥" />
          <CheckboxWithText cbKey="body_other_cb" textKey="body_other_text" label="其他：" />
        </div>
      </SectionCard>

      {/* 皮膚 */}
      <SectionCard title="皮膚">
        <div className="flex flex-wrap items-center gap-4">
          <Checkbox k="skin_normal" label="正常" />
          <Checkbox k="skin_pale" label="蒼白" />
          <Checkbox k="skin_dry" label="脫水" />
          <Checkbox k="skin_edema" label="水腫" />
          <Checkbox k="skin_pigment" label="異常色素" />
          <Checkbox k="skin_rash" label="疹" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <CheckboxWithText cbKey="skin_eschar_cb" textKey="skin_eschar_loc" label="痂(位置)" />
          <CheckboxWithText cbKey="skin_wound_cb" textKey="skin_wound_loc" label="傷口(位置)" />
          <CheckboxWithText cbKey="skin_ulcer_cb" textKey="skin_ulcer_loc" label="褥瘡(位置)" />
          <CheckboxWithText cbKey="skin_other_cb" textKey="skin_other_text" label="其他：" />
        </div>
      </SectionCard>

      {/* 視力 / 聽覺 */}
      <SectionCard title="視力與聽覺">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm font-medium text-gray-700 whitespace-nowrap">視力：</span>
          <Checkbox k="vision_normal" label="正常" />
          <Checkbox k="vision_weak" label="弱視" />
          {getBool('vision_weak') &&
          <span className="inline-flex items-center gap-2 text-sm text-gray-700">
              (<Checkbox k="vision_weak_l" label="左" />
              <span>/</span>
              <Checkbox k="vision_weak_r" label="右" />)
            </span>
          }
          <Checkbox k="vision_glasses" label="戴眼鏡" />
          <Checkbox k="vision_blind" label="盲" />
          {getBool('vision_blind') &&
          <span className="inline-flex items-center gap-2 text-sm text-gray-700">
              (<Checkbox k="vision_blind_l" label="左" />
              <span>/</span>
              <Checkbox k="vision_blind_r" label="右" />)
            </span>
          }
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm font-medium text-gray-700 whitespace-nowrap">聽覺：</span>
          <Checkbox k="hearing_normal" label="正常" />
          <Checkbox k="hearing_weak" label="弱聽" />
          {getBool('hearing_weak') &&
          <span className="inline-flex items-center gap-2 text-sm text-gray-700">
              (<Checkbox k="hearing_weak_l" label="左" />
              <span>/</span>
              <Checkbox k="hearing_weak_r" label="右" />)
            </span>
          }
          <Checkbox k="hearing_aid" label="戴助聽器" />
          <Checkbox k="hearing_lost" label="失聽" />
          {getBool('hearing_lost') &&
          <span className="inline-flex items-center gap-2 text-sm text-gray-700">
              (<Checkbox k="hearing_lost_l" label="左" />
              <span>/</span>
              <Checkbox k="hearing_lost_r" label="右" />)
            </span>
          }
        </div>
      </SectionCard>

      {/* 表達能力 */}
      <SectionCard title="表達能力">
        <div className="flex flex-wrap items-center gap-4">
          <Checkbox k="express_clear" label="清楚" />
          <Checkbox k="express_vague" label="含糊" />
          <Checkbox k="express_difficulty" label="言語困難" />
          <Checkbox k="express_mute" label="啞" />
          <Checkbox k="express_dialect" label="使用方言" />
          <TextInput k="express_other_text" placeholder="其他" className="form-input flex-1 min-w-[120px]" />
        </div>
      </SectionCard>

      {/* 飲食方面 / 膳食要求 / 牙齒狀況 */}
      <SectionCard title="飲食方面、膳食要求及牙齒狀況">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm font-medium text-gray-700 whitespace-nowrap">飲食方面：</span>
          <Checkbox k="eat_normal" label="正常" />
          <Checkbox k="eat_anorexia" label="厭食" />
          <Checkbox k="eat_swallow" label="吞嚥困難" />
          <Checkbox k="eat_choke" label="哽塞" />
          <CheckboxWithText cbKey="eat_other_cb" textKey="eat_other_text" label="其他：" />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm font-medium text-gray-700 whitespace-nowrap">膳食要求：</span>
          <Checkbox k="diet_normal" label="正常" />
          <Checkbox k="diet_low_sugar" label="低糖" />
          <Checkbox k="diet_low_salt" label="低鹽" />
          <Checkbox k="diet_soft" label="爛飯/碎餐" />
          <CheckboxWithText cbKey="diet_other_cb" textKey="diet_other_text" label="其他：" />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm font-medium text-gray-700 whitespace-nowrap">牙齒狀況：</span>
          <Checkbox k="teeth_enough" label="足夠" />
          <Checkbox k="teeth_bad" label="欠佳" />
          <Checkbox k="teeth_denture" label="配戴假牙：" />
          {getBool('teeth_denture') &&
          <span className="inline-flex items-center gap-2 text-sm text-gray-700">
              上顎 (<Checkbox k="denture_up_fixed" label="固定" />
              <span>/</span>
              <Checkbox k="denture_up_active" label="活動" />) 下顎 (<Checkbox k="denture_down_fixed" label="固定" />
              <span>/</span>
              <Checkbox k="denture_down_active" label="活動" />)
            </span>
          }
        </div>
      </SectionCard>

      {/* 小便 / 大便 */}
      <SectionCard title="小便與大便">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm font-medium text-gray-700 whitespace-nowrap">小便：</span>
          <Checkbox k="urine_normal" label="正常" />
          <div className="inline-flex items-center gap-2">
            <Checkbox k="urine_incont" label="失禁(次數)" />
            <TextInput
              k="urine_incont_count"
              className="form-input w-24"
              disabled={!getBool('urine_incont')} />
            
          </div>
          <CheckboxWithText cbKey="urine_other_cb" textKey="urine_other_text" label="其他：" />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm font-medium text-gray-700 whitespace-nowrap">大便：</span>
          <Checkbox k="stool_normal" label="正常" />
          <div className="inline-flex items-center gap-2">
            <Checkbox k="stool_incont" label="失禁(次數)" />
            <TextInput
              k="stool_incont_count"
              className="form-input w-24"
              disabled={!getBool('stool_incont')} />
            
          </div>
          <div className="inline-flex items-center gap-2">
            <Checkbox k="stool_constip" label="便秘(每" />
            <TextInput
              k="stool_constip_days"
              className="form-input w-16 text-center"
              disabled={!getBool('stool_constip')} />
            
            <span className="text-sm text-gray-700">天一次)</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-700 whitespace-nowrap">其他：</span>
          <TextInput k="stool_other_text" className="form-input flex-1 min-w-[120px]" />
        </div>
      </SectionCard>
      {/* 活動能力 */}
      <SectionCard title="活動能力">
        <div className="flex flex-wrap items-center gap-4">
          <Checkbox k="move_normal" label="正常" />
          <Checkbox k="move_aid" label="需輔助器" />
          {getBool('move_aid') &&
          <span className="inline-flex items-center gap-2 text-sm text-gray-700">
              (<Checkbox k="aid_stick" label="杖" />
              <span>、</span>
              <Checkbox k="aid_frame" label="圍身架" />
              <span>、</span>
              <Checkbox k="aid_fork" label="三/四腳叉" />
              <span>、</span>
              <Checkbox k="aid_wheelchair" label="輪椅" />
              <span>、其他：</span>
              <TextInput k="move_aid_other" className="form-input w-32" />)
            </span>
          }
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Checkbox k="move_pain" label="有痛楚" />
          {getBool('move_pain') &&
          <span className="inline-flex items-center gap-2 text-sm text-gray-700">
              (<Checkbox k="pain_move" label="移動時" />
              <span>、</span>
              <Checkbox k="pain_intermit" label="間歇性" />
              <span>、</span>
              <Checkbox k="pain_weather" label="氣候性" />
              <span>、其他：</span>
              <TextInput k="move_pain_other" className="form-input w-32" />)
            </span>
          }
        </div>
      </SectionCard>

      {/* 傷殘情況 */}
      <SectionCard title="傷殘情況">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="inline-flex items-center gap-2">
            <Checkbox k="dis_paralysis" label="癱瘓" />
            {getBool('dis_paralysis') &&
            <span className="inline-flex items-center gap-2 text-sm text-gray-700">
                (<Checkbox k="paralysis_l" label="左" />
                <span>/</span>
                <Checkbox k="paralysis_r" label="右" />)
              </span>
            }
          </div>
          <div className="inline-flex items-center gap-2">
            <Checkbox k="dis_weak" label="軟弱" />
            {getBool('dis_weak') &&
            <span className="inline-flex items-center gap-2 text-sm text-gray-700">
                (<Checkbox k="weak_l" label="左" />
                <span>/</span>
                <Checkbox k="weak_r" label="右" />
                <span>、</span>
                <Checkbox k="weak_up" label="上" />
                <span>/</span>
                <Checkbox k="weak_down" label="下肢" />)
              </span>
            }
          </div>
          <div className="inline-flex items-center gap-2">
            <Checkbox k="dis_atrophy" label="萎縮" />
            {getBool('dis_atrophy') &&
            <span className="inline-flex items-center gap-2 text-sm text-gray-700">
                (<Checkbox k="atrophy_l" label="左" />
                <span>/</span>
                <Checkbox k="atrophy_r" label="右" />
                <span>、</span>
                <Checkbox k="atrophy_up" label="上" />
                <span>/</span>
                <Checkbox k="atrophy_down" label="下肢" />)
              </span>
            }
          </div>
          <div className="inline-flex items-center gap-2">
            <Checkbox k="dis_deform" label="變形" />
            {getBool('dis_deform') &&
            <span className="inline-flex items-center gap-2 text-sm text-gray-700">
                (<Checkbox k="deform_l" label="左" />
                <span>/</span>
                <Checkbox k="deform_r" label="右" />
                <span>、</span>
                <Checkbox k="deform_up" label="上" />
                <span>/</span>
                <Checkbox k="deform_down" label="下肢" />)
              </span>
            }
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Checkbox k="dis_amput" label="截肢" />
          {getBool('dis_amput') &&
          <span className="inline-flex items-center gap-2 text-sm text-gray-700">
              (<Checkbox k="amput_l" label="左" />
              <span>/</span>
              <Checkbox k="amput_r" label="右" />
              <span>、</span>
              <Checkbox k="amput_up" label="上" />
              <span>/</span>
              <Checkbox k="amput_down" label="下肢" />)
            </span>
          }
          <CheckboxWithText cbKey="dis_other_cb" textKey="dis_other_text" label="其他：" />
        </div>
      </SectionCard>

      {/* 自我照顧能力 */}
      <SectionCard title="自我照顧能力">
        <div className="flex flex-wrap items-center gap-4">
          <Checkbox k="care_self" label="自助" />
          <Checkbox k="care_depend" label="完全依靠別人" />
          <Checkbox k="care_assist" label="需協助" />
        </div>
        {getBool('care_assist') &&
        <div className="flex flex-wrap items-center gap-2 pl-0 md:pl-4">
            <span className="text-sm text-gray-700">(</span>
            <Checkbox k="assist_feed" label="餵食" />
            <span className="text-sm text-gray-700">、</span>
            <Checkbox k="assist_bed" label="上落床" />
            <span className="text-sm text-gray-700">、</span>
            <Checkbox k="assist_bath" label="沐浴" />
            <span className="text-sm text-gray-700">、</span>
            <Checkbox k="assist_cloth" label="穿衣" />
            <span className="text-sm text-gray-700">、</span>
            <Checkbox k="assist_toilet" label="如廁" />
            <span className="text-sm text-gray-700">、</span>
            <CheckboxWithText cbKey="assist_other_cb" textKey="care_assist_other" label="其他：" />
            <span className="text-sm text-gray-700">)</span>
          </div>
        }
      </SectionCard>

      {/* 評估員資料 */}
      <SectionCard title="評估員資料">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <TextInput k="assessor_name" placeholder="評估員姓名" />
          <TextInput k="assessor_rank" placeholder="職級" />
          <TextInput k="assessor_sign" placeholder="簽署" />
          <TextInput k="assess_date" type="date" placeholder="評估日期" />
        </div>
      </SectionCard>
    </div>);

};

export default PatientNursingAssessmentSection;