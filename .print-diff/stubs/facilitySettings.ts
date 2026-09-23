
export interface FacilitySettings {
  facilityNameZh: string; facilityNameEn: string;
  facilityAddressZh: string; facilityAddressEn: string;
  facilityPhone: string; facilityFax: string; logoDataUri: string | null;
}
export const DEFAULT_FACILITY_SETTINGS: FacilitySettings = {
  facilityNameZh: '善頤(福群)護老院', facilityNameEn: '',
  facilityAddressZh: '', facilityAddressEn: '', facilityPhone: '', facilityFax: '', logoDataUri: null,
};
export const getFacilitySettings = async () => DEFAULT_FACILITY_SETTINGS;
export const getCurrentFacilityId = async () => 1;
export const clearFacilitySettingsCache = () => {};
