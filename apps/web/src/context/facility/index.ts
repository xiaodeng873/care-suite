/**
 * Facility Context Exports
 * 
 * 導出設施管理相關的 Context：
 * - StationContext: 站點與床位管理
 * - ScheduleContext: 排程管理（待實現）
 */

export { 
  StationProvider, 
  useStation, 
  useStationData,
  default as StationContext 
} from './StationContext';

export type { Station, Bed } from './StationContext';
