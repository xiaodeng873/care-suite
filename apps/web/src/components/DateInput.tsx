import React, { useEffect, useRef, useState } from 'react';
import { Calendar } from 'lucide-react';
import { formatDisplayDate, parseDisplayDate } from '../utils/dateFormat';

// =====================================================
// 通用日期輸入元件
// 顯示格式：DD/MM/YYYY
// 對外 value / onChange 仍使用 ISO YYYY-MM-DD
// 保留原生日期選擇器（點擊日曆圖示開啟）
// =====================================================

interface DateInputProps {
  value: string;
  onChange: (isoDate: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  id?: string;
  name?: string;
  min?: string;
  max?: string;
  title?: string;
  autoFocus?: boolean;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
}

const DateInput: React.FC<DateInputProps> = ({
  value,
  onChange,
  placeholder = 'DD/MM/YYYY',
  required,
  disabled,
  readOnly,
  className = '',
  id,
  name,
  min,
  max,
  title,
  autoFocus,
  onBlur,
  onFocus,
}) => {
  const [display, setDisplay] = useState(() => formatDisplayDate(value));
  const [isInvalid, setIsInvalid] = useState(false);
  const dateRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDisplay(formatDisplayDate(value));
    setIsInvalid(false);
  }, [value]);

  const handleDisplayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setDisplay(raw);
    const iso = parseDisplayDate(raw);
    if (iso || raw === '') {
      setIsInvalid(false);
      onChange(iso || '');
    } else {
      setIsInvalid(true);
    }
  };

  const handleDisplayBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (!display) {
      setIsInvalid(false);
      onChange('');
    } else {
      const iso = parseDisplayDate(display);
      if (iso) {
        setDisplay(formatDisplayDate(iso));
        setIsInvalid(false);
        onChange(iso);
      } else {
        setIsInvalid(true);
      }
    }
    onBlur?.(e);
  };

  const handlePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const iso = e.target.value;
    setDisplay(formatDisplayDate(iso));
    setIsInvalid(false);
    onChange(iso);
  };

  const openPicker = () => {
    if (readOnly || disabled) return;
    dateRef.current?.showPicker?.();
  };

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleDisplayChange}
        onBlur={handleDisplayBlur}
        onFocus={onFocus}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        readOnly={readOnly}
        autoFocus={autoFocus}
        title={title}
        className={`w-full px-3 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
          isInvalid ? 'border-red-500 bg-red-50' : 'border-gray-300'
        } ${disabled || readOnly ? 'bg-gray-100 opacity-60' : ''} ${className}`}
      />
      {!readOnly && (
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
          aria-label="開啟日曆"
        >
          <Calendar className="h-5 w-5" />
        </button>
      )}
      <input
        ref={dateRef}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={handlePickerChange}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
};

export default DateInput;
