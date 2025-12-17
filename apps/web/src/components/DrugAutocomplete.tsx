import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Pill, Search } from 'lucide-react';
import { usePatients } from '../context/PatientContext';

interface DrugAutocompleteProps {
  value: string;
  onChange: (drugName: string, drugData?: any) => void;
  placeholder?: string;
  className?: string;
}

const DrugAutocomplete: React.FC<DrugAutocompleteProps> = ({
  value,
  onChange,
  placeholder = "搜索藥物...",
  className = ""
}) => {
  const { drugDatabase } = usePatients();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 過濾藥物列表
  const filteredDrugs = (drugDatabase || []).filter(drug => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      drug.drug_name.toLowerCase().includes(searchLower) ||
      drug.drug_code?.toLowerCase().includes(searchLower) ||
      drug.drug_type?.toLowerCase().includes(searchLower) ||
      drug.administration_route?.toLowerCase().includes(searchLower)
    );
  });

  // 處理點擊外部關閉
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 同步外部 value 變化
  useEffect(() => {
    setSearchTerm(value);
  }, [value]);

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
          prev < filteredDrugs.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : filteredDrugs.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredDrugs.length) {
          handleSelectDrug(filteredDrugs[highlightedIndex]);
        } else if (searchTerm.trim()) {
          // 如果沒有選中項目但有輸入內容，直接使用輸入的內容
          handleSelectDrug({ drug_name: searchTerm.trim() });
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setHighlightedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  // 處理選擇藥物
  const handleSelectDrug = (drug: any) => {
    onChange(drug.drug_name, drug);
    setSearchTerm(drug.drug_name);
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.blur();
  };

  // 處理輸入變化
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSearchTerm = e.target.value;
    setSearchTerm(newSearchTerm);
    setHighlightedIndex(-1);
    
    // 即時更新父組件的值
    onChange(newSearchTerm);
    
    if (!isOpen) {
      setIsOpen(true);
    }
  };

  // 處理輸入框點擊
  const handleInputClick = () => {
    setIsOpen(true);
  };

  // 處理失去焦點
  const handleInputBlur = () => {
    // 延遲關閉以允許點擊選項
    setTimeout(() => {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }, 200);
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
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onClick={handleInputClick}
          onBlur={handleInputBlur}
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
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          <div ref={listRef}>
            {filteredDrugs.length > 0 ? (
              filteredDrugs.map((drug, index) => (
                <div
                  key={drug.id}
                  onClick={() => handleSelectDrug(drug)}
                  className={`flex items-center space-x-3 p-3 cursor-pointer transition-colors ${
                    index === highlightedIndex 
                      ? 'bg-blue-50 border-l-4 border-blue-500' 
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0">
                    {drug.photo_url ? (
                      <img 
                        src={drug.photo_url} 
                        alt={drug.drug_name} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Pill className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900">
                        {drug.drug_name}
                      </span>
                      {drug.drug_code && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          {drug.drug_code}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
                      {drug.drug_type && (
                        <span className="text-xs text-gray-500">{drug.drug_type}</span>
                      )}
                      {drug.administration_route && (
                        <span className="text-xs text-gray-500">• {drug.administration_route}</span>
                      )}
                      {drug.unit && (
                        <span className="text-xs text-gray-500">• {drug.unit}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-gray-500">
                <Search className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">找不到符合條件的藥物</p>
                {searchTerm && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-400 mb-2">
                      搜索條件: "{searchTerm}"
                    </p>
                    <button
                      onClick={() => handleSelectDrug({ drug_name: searchTerm.trim() })}
                      className="text-xs text-blue-600 hover:text-blue-700 underline"
                    >
                      使用 "{searchTerm.trim()}" 作為新藥物名稱
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DrugAutocomplete;