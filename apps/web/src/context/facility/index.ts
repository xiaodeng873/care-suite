/**
 * Facility Context Exports
 * 
 * 導出設施管理相關的 Context：
 * - StationContext: 站點與床位管理
 */

export { 
  StationProvider, 
  useStation, 
  useStationData
} from './StationContext';

export type { Station, Bed } from './StationContext';
export { default as StationContext } from './StationContext';
