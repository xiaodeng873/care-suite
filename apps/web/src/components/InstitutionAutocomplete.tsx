import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, Building2 } from 'lucide-react';
import { INSTITUTION_GROUPS } from '../utils/medicationSettings';
import type { MedicationSettingsData } from '../utils/medicationSettings';

interface InstitutionOption {
  name: string;       // 中文機構名（儲存值）
  group: string;      // 分組標題（如「醫管局 — 醫院」）
  abbr?: string;      // 英文簡稱（如 WTSH）
}

interface InstitutionAutocompleteProps {
  value: string;
  onChange: (institutionName: string) => void;
  medSettings: MedicationSettingsData;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

/**
 * 藥物來源機構 autocomplete：可輸入中文或英文簡稱搜索，選定後一律存中文名。
 * 不設即時新增；新機構須到「藥物設定」加進清單。
 */
const InstitutionAutocomplete: React.FC<InstitutionAutocompleteProps> = ({
  value,
  onChange,
  medSettings,
  placeholder = '輸入中文名或英文簡稱搜索…',
  className = '',
  required = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 全部機構選項（含分組與英文簡稱）
  const allOptions = useMemo<InstitutionOption[]>(() => {
    const abbrMap = medSettings.機構簡稱 || {};
    const out: InstitutionOption[] = [];
    for (const g of INSTITUTION_GROUPS) {
      const list = (medSettings[g.key] as string[]) || [];
      for (const name of list) out.push({ name, group: g.label, abbr: abbrMap[name] });
    }
    return out;
  }, [medSettings]);

  // 過濾：中文名包含關鍵字，或英文簡稱前綴/包含命中（不分大小寫）；簡稱命中排前
  const filteredOptions = useMemo(() => {
    const term = searchTerm.trim();
    if (!term) return allOptions;
    const upper = term.toUpperCase();
    const scored = allOptions
      .map((opt) => {
        const abbr = (opt.abbr || '').toUpperCase();
        let score = -1;
        if (abbr && abbr === upper) score = 100;
        else if (abbr && abbr.startsWith(upper)) score = 80;
        else if (opt.name.startsWith(term)) score = 60;
        else if (opt.name.includes(term)) score = 40;
        else if (abbr && abbr.includes(upper)) score = 20;
        return { opt, score };
      })
      .filter((x) => x.score >= 0)
      .sort((a, b) => b.score - a.score || a.opt.name.localeCompare(b.opt.name, 'zh-Hant'));
    return scored.map((x) => x.opt);
  }, [allOptions, searchTerm]);

  // 點擊外部關閉
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

  const handleSelect = (opt: InstitutionOption) => {
    onChange(opt.name);
    setSearchTerm(opt.name);
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
        setHighlightedIndex(0);
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          handleSelect(filteredOptions[highlightedIndex]);
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
    setHighlightedIndex(-1);
    // 即時同步父組件；清空時也要反映
    onChange(term);
    if (!isOpen) setIsOpen(true);
  };

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
      const el = listRef.current.children[highlightedIndex] as HTMLElement;
      if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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
          onClick={() => setIsOpen(true)}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="form-input pr-10"
          autoComplete="off"
          required={required}
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
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, index) => (
                <div
                  key={`${opt.group}-${opt.name}`}
                  onClick={() => handleSelect(opt)}
                  className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                    index === highlightedIndex
                      ? 'bg-blue-50 border-l-4 border-blue-500'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <Building2 className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-900 flex-1 min-w-0 truncate">{opt.name}</span>
                  {opt.abbr && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded flex-shrink-0">{opt.abbr}</span>
                  )}
                  <span className="text-xs text-gray-400 flex-shrink-0">{opt.group}</span>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-gray-500">
                <Search className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">清單中找不到「{searchTerm.trim()}」</p>
                <p className="text-xs text-gray-400 mt-1">如需新增機構，請前往「藥物設定」加進清單</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default InstitutionAutocomplete;
