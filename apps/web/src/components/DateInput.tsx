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
  const textRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 用戶正在手動輸入時，唔好用外部 value 覆寫 display（避免游標漂移）；
    // 等 blur 或日曆選擇時先 normalise
    if (document.activeElement === textRef.current) return;
    setDisplay(formatDisplayDate(value));
    setIsInvalid(false);
  }, [value]);

  // 只保留數字，自動喺第 2、4 位數字後插入 "/"，最多 8 位數字（DD/MM/YYYY）
  const maskDate = (raw: string, cursorPos: number): { masked: string; newCursor: number } => {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    let masked = digits.slice(0, 2);
    if (digits.length > 2) masked += '/' + digits.slice(2, 4);
    if (digits.length > 4) masked += '/' + digits.slice(4, 8);
    // 游標跟隨：以游標前有幾多個數字計算新位置，順帶跳過自動插入嘅 "/"
    const digitsBeforeCursor = raw.slice(0, cursorPos).replace(/\D/g, '').length;
    let newCursor = 0;
    let count = 0;
    while (newCursor < masked.length && count < digitsBeforeCursor) {
      if (/\d/.test(masked[newCursor])) count++;
      newCursor++;
    }
    if (masked[newCursor] === '/') newCursor++;
    return { masked, newCursor };
  };

  const handleDisplayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { masked, newCursor } = maskDate(e.target.value, e.target.selectionStart ?? e.target.value.length);
    setDisplay(masked);
    // 還原游標位置（setDisplay 之後先好 setSelectionRange）
    requestAnimationFrame(() => {
      const el = textRef.current;
      if (el && document.activeElement === el) el.setSelectionRange(newCursor, newCursor);
    });
    const iso = parseDisplayDate(masked);
    if (iso || masked === '') {
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
        ref={textRef}
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
