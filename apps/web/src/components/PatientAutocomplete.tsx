import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, User, Search } from 'lucide-react';
import { usePatients } from '../context/PatientContext';
import { useStation } from '../context/facility';
import { useStationFilter } from '../context/StationFilterContext';
import { useDebounce } from '../hooks/useDebounce';
import { getFormattedEnglishName } from '../utils/nameFormatter';
import BedNumberImprint from './BedNumberImprint';
import { fuzzyMatch, matchChineseName, matchEnglishName, matchBedNumber, comparePatientsForSearch } from '../utils/searchUtils';

interface PatientAutocompleteProps {
  value: string | number;
  onChange: (patientId: string) => void;
  placeholder?: string;
  className?: string;
  showResidencyFilter?: boolean;
  defaultResidencyStatus?: string;
  showStationFilter?: boolean;
  /** 忽略全域站別過濾（如 CGAT 頁特例，列出所有院友） */
  ignoreStationFilter?: boolean;
}

const PatientAutocomplete: React.FC<PatientAutocompleteProps> = ({
  value,
  onChange,
  placeholder = "搜索院友...",
  className = "",
  showResidencyFilter = false,
  defaultResidencyStatus = "在住",
  showStationFilter = false,
  ignoreStationFilter = false,
}) => {
  const { patients: filteredPatientsCtx, allPatients, beds } = usePatients();
  const patients = ignoreStationFilter ? allPatients : filteredPatientsCtx;
  const { stations } = useStation();
  const { selectedStationIds } = useStationFilter();

  // 只列出全域過濾器已選的站別；若全選則列出全部（CGAT 忽略過濾時列出全部）
  const visibleStations = ignoreStationFilter ? stations : stations.filter(s => selectedStationIds.includes(s.id));
  // 有 ≥2 個可用站別時自動顯示站別篩選（也可由 prop 強制開啟）
  const shouldShowStationFilter = showStationFilter || visibleStations.length > 1;
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 200);
  const [residencyStatus, setResidencyStatus] = useState(defaultResidencyStatus);
  const [stationFilter, setStationFilter] = useState<string>('all');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const MAX_RESULTS = 50;

  // 找到當前選中的院友
  const selectedPatient = useMemo(
    () => patients.find(p => p.院友id.toString() === value?.toString()),
    [patients, value]
  );

  // 過濾院友列表：使用 useMemo 避免每次 render 重新計算，並用 debounce 減少搜尋頻率
  const filteredPatients = useMemo(() => {
    const list = patients.filter(patient => {
      // 居住區篩選
      if (stationFilter !== 'all' && patient.station_id !== stationFilter) return false;
      // 先根據在住狀態篩選
      if (residencyStatus !== '全部' && patient.在住狀態 !== residencyStatus) {
        return false;
      }

      // 再根據搜索條件篩選
      if (!debouncedSearch) return true;

      return (
        matchBedNumber(patient.床號, debouncedSearch) ||
        matchChineseName(patient.中文姓氏, patient.中文名字, patient.中文姓名, debouncedSearch) ||
        matchEnglishName(patient.英文姓氏, patient.英文名字, patient.英文姓名, debouncedSearch) ||
        fuzzyMatch(patient.身份證號碼, debouncedSearch)
      );
    }).sort((a, b) => comparePatientsForSearch(a, b, debouncedSearch));

    return list.slice(0, MAX_RESULTS);
  }, [patients, stationFilter, residencyStatus, debouncedSearch]);

  // 處理點擊外部關閉
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 處理鍵盤導航
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
        setHighlightedIndex(0);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredPatients.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : filteredPatients.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredPatients.length) {
          handleSelectPatient(filteredPatients[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  // 處理選擇院友
  const handleSelectPatient = (patient: any) => {
    onChange(patient.院友id.toString());
    setIsOpen(false);
    setSearchTerm('');
    setHighlightedIndex(-1);
    inputRef.current?.blur();
  };

  // 處理輸入變化
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSearchTerm = e.target.value;
    setSearchTerm(newSearchTerm);
    setHighlightedIndex(-1);
    
    if (!isOpen) {
      setIsOpen(true);
    }
  };

  // 處理輸入框點擊
  const handleInputClick = () => {
    setIsOpen(true);
    if (selectedPatient) {
      setSearchTerm('');
    }
  };

  // 滾動到高亮項目
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth'
        });
      }
    }
  }, [highlightedIndex]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="search" // Use type="search" for better UX
          value={isOpen ? searchTerm : (selectedPatient ? `${selectedPatient.床號} - ${selectedPatient.中文姓名}` : '')}
          onChange={handleInputChange}
          onClick={handleInputClick}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="form-input pr-10"
          autoComplete="off"
        />
        
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          {isOpen ? (
            <Search className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
          {(showResidencyFilter || shouldShowStationFilter) && (
            <div className="p-3 border-b border-gray-200 space-y-2">
              {shouldShowStationFilter && (
                <select
                  value={stationFilter}
                  onChange={(e) => { setStationFilter(e.target.value); setHighlightedIndex(-1); }}
                  className="form-input w-full text-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value="all">全部居住區</option>
                  {visibleStations.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              )}
              {showResidencyFilter && (
                <select
                  value={residencyStatus}
                  onChange={(e) => { setResidencyStatus(e.target.value); setHighlightedIndex(-1); }}
                  className="form-input w-full text-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value="在住">在住院友</option>
                  <option value="待入住">待入住院友</option>
                  <option value="已退住">已退住院友</option>
                  <option value="全部">全部院友</option>
                </select>
              )}
            </div>
          )}

          <div className="max-h-60 overflow-y-auto">
            <div ref={listRef}>
            {filteredPatients.length > 0 ? (
              filteredPatients.map((patient, index) => (
                <div
                  key={patient.院友id}
                  onClick={() => handleSelectPatient(patient)}
                  className={`flex flex-wrap items-center gap-3 p-3 cursor-pointer transition-colors ${
                    index === highlightedIndex 
                      ? 'bg-blue-50 border-l-4 border-blue-500' 
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="w-10 h-10 bg-blue-100 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0">
                    {patient.院友相片 ? (
                      <img 
                        src={patient.院友相片} 
                        alt={patient.中文姓名} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="h-5 w-5 text-blue-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <BedNumberImprint patient={patient} beds={beds} size="sm" />
                      <span className="font-medium text-gray-900">
                        {patient.中文姓氏}{patient.中文名字}
                      </span>
                      {showResidencyFilter && (
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          patient.在住狀態 === '在住' ? 'bg-green-100 text-green-800' :
                          patient.在住狀態 === '待入住' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {patient.在住狀態}
                        </span>
                      )}
                    </div>
                    {patient.英文姓氏 || patient.英文名字 ? (
                      <p className="text-sm text-gray-600 truncate mt-1">{getFormattedEnglishName(patient.英文姓氏, patient.英文名字)}</p>
                    ) : null}
                    <p className="text-xs text-gray-500 truncate">
                      {patient.身份證號碼}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-gray-500">
                <Search className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">找不到符合條件的院友</p>
                {searchTerm && (
                  <p className="text-xs text-gray-400 mt-1">
                    搜索條件: "{searchTerm}"
                  </p>
                )}
              </div>
            )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientAutocomplete;