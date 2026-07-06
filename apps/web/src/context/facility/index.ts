/**
 * Facility Context Exports
 * 
 * 導出設施管理相關的 Context：
 * - SeniorCareontext: 居住區與床位管理
 */

export { 
  StationProvider, 
  useStation, 
  useStationData
} from './StationContext';

export type { Station, Room, Bed } from './StationContext';
export { default as SeniorCareontext } from './StationContext';
