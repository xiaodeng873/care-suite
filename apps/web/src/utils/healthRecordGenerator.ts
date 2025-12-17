import { HealthRecord } from '../lib/database';

export interface GeneratedHealthData {
  血壓收縮壓?: string;
  血壓舒張壓?: string;
  脈搏?: string;
  體溫?: string;
  血含氧量?: string;
  呼吸頻率?: string;
  血糖值?: string;
  體重?: string;
}

export interface GeneratorResult {
  success: boolean;
  data?: GeneratedHealthData;
  recordCount?: number;
  error?: string;
}

const roundToDecimal = (value: number, decimals: number): string => {
  return value.toFixed(decimals);
};

const generateRandomOffset = (min: number, max: number): number => {
  return Math.random() * (max - min) + min;
};

export const generateHealthRecordSuggestions = (
  recentRecords: HealthRecord[],
  recordType: '生命表徵' | '血糖控制' | '體重控制'
): GeneratorResult => {
  console.log('[healthRecordGenerator] 輸入記錄數量:', recentRecords?.length);
  console.log('[healthRecordGenerator] 記錄類型:', recordType);

  if (!recentRecords || recentRecords.length === 0) {
    console.log('[healthRecordGenerator] 無記錄，返回 no-data');
    return {
      success: false,
      error: 'no-data'
    };
  }

  const result: GeneratedHealthData = {};

  try {
    if (recordType === '生命表徵') {
      const validSystolic = recentRecords.filter(r => r.血壓收縮壓 != null).map(r => r.血壓收縮壓!);
      const validDiastolic = recentRecords.filter(r => r.血壓舒張壓 != null).map(r => r.血壓舒張壓!);
      const validPulse = recentRecords.filter(r => r.脈搏 != null).map(r => r.脈搏!);
      const validTemp = recentRecords.filter(r => r.體溫 != null).map(r => r.體溫!);
      const validOxygen = recentRecords.filter(r => r.血含氧量 != null).map(r => r.血含氧量!);
      const validResp = recentRecords.filter(r => r.呼吸頻率 != null).map(r => r.呼吸頻率!);

      console.log('[healthRecordGenerator] 有效數據數量:', {
        收縮壓: validSystolic.length,
        舒張壓: validDiastolic.length,
        脈搏: validPulse.length,
        體溫: validTemp.length,
        血氧: validOxygen.length,
        呼吸: validResp.length
      });

      if (validSystolic.length > 0) {
        const avg = validSystolic.reduce((a, b) => a + b, 0) / validSystolic.length;
        const offset = generateRandomOffset(-10, 10);
        const value = Math.max(80, Math.round(avg + offset));
        result.血壓收縮壓 = value.toString();
      }

      if (validDiastolic.length > 0) {
        const avg = validDiastolic.reduce((a, b) => a + b, 0) / validDiastolic.length;
        const offset = generateRandomOffset(-10, 10);
        const value = Math.max(50, Math.round(avg + offset));
        result.血壓舒張壓 = value.toString();
      }

      if (validPulse.length > 0) {
        const avg = validPulse.reduce((a, b) => a + b, 0) / validPulse.length;
        const offset = generateRandomOffset(-10, 10);
        const value = Math.max(40, Math.round(avg + offset));
        result.脈搏 = value.toString();
      }

      if (validTemp.length > 0) {
        const avg = validTemp.reduce((a, b) => a + b, 0) / validTemp.length;
        const offset = generateRandomOffset(-0.5, 0.5);
        let value = avg + offset;
        value = Math.min(37.4, Math.max(35.0, value));
        result.體溫 = roundToDecimal(value, 1);
      }

      if (validOxygen.length > 0) {
        const avg = validOxygen.reduce((a, b) => a + b, 0) / validOxygen.length;
        const offset = generateRandomOffset(-2, 2);
        const value = Math.max(90, Math.min(100, Math.round(avg + offset)));
        result.血含氧量 = value.toString();
      }

      if (validResp.length > 0) {
        const avg = validResp.reduce((a, b) => a + b, 0) / validResp.length;
        const offset = generateRandomOffset(-5, 5);
        const value = Math.max(12, Math.round(avg + offset));
        result.呼吸頻率 = value.toString();
      }
    } else if (recordType === '血糖控制') {
      const validGlucose = recentRecords.filter(r => r.血糖值 != null).map(r => r.血糖值!);

      if (validGlucose.length > 0) {
        const avg = validGlucose.reduce((a, b) => a + b, 0) / validGlucose.length;
        const offset = generateRandomOffset(-7, 7);
        const value = Math.max(4.0, avg + offset);
        result.血糖值 = roundToDecimal(value, 1);
      }
    } else if (recordType === '體重控制') {
      const validWeight = recentRecords.filter(r => r.體重 != null).map(r => r.體重!);

      if (validWeight.length > 0) {
        const avg = validWeight.reduce((a, b) => a + b, 0) / validWeight.length;
        const offset = generateRandomOffset(-1, 1);
        const value = Math.max(22.0, avg + offset);
        result.體重 = roundToDecimal(value, 1);
      }
    }

    if (Object.keys(result).length === 0) {
      console.log('[healthRecordGenerator] 沒有生成任何有效數據');
      return {
        success: false,
        error: 'no-valid-data'
      };
    }

    console.log('[healthRecordGenerator] 成功生成數據:', result);

    return {
      success: true,
      data: result,
      recordCount: recentRecords.length
    };
  } catch (error) {
    console.error('[healthRecordGenerator] 生成錯誤:', error);
    return {
      success: false,
      error: 'generation-error'
    };
  }
};
