/**
 * 合併的 Context 模組
 * 
 * 將多個小 Context 合併為更大的邏輯單元，減少 Provider 嵌套層級：
 * - MedicalContext: 覆診、診斷、疫苗、醫院外展、傷口、健康記錄
 * - WorkflowContext: 排程、處方、藥物工作流程
 * - RecordsContext: 護理記錄、照顧計劃、評估、事故、餐飲、日誌等
 */

export * from './MedicalContext';
export * from './WorkflowContext';
export * from './RecordsContext';
