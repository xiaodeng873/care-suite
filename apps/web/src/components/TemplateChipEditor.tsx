import React, { useEffect, useRef, useState } from 'react';

// 訊息模板佔位符（注意：「疫苗名稱1/2」必須先於「疫苗名稱」匹配）
export const TEMPLATE_TOKENS = ['院舍名稱', '接種日期', '疫苗名稱1', '疫苗名稱2', '疫苗名稱', '截止日期', '院友名稱'] as const;

const TOKEN_REGEX = /\{(院舍名稱|接種日期|疫苗名稱1|疫苗名稱2|疫苗名稱|截止日期|院友名稱)\}/g;

const CHIP_CLASS =
  'inline-block px-1.5 py-0.5 mx-0.5 rounded bg-green-100 text-green-700 text-xs font-medium align-middle select-none cursor-grab';

interface TemplateChipEditorProps {
  value: string;
  onChange: (template: string) => void;
  chipValues: Record<string, string>;
}

// 將純文字模板（含 {token}）渲染為 文字節點 + chip span
function renderNodes(template: string, chipLabel: (token: string) => string): React.ReactNode[] {
  const parts = template.split(TOKEN_REGEX);
  return parts.map((part, i) => {
    if (i % 2 === 0) {
      return part ? <React.Fragment key={i}>{part}</React.Fragment> : null;
    }
    return (
      <span key={`${i}-${part}`} data-token={part} contentEditable={false} draggable className={CHIP_CLASS}>
        {chipLabel(part)}
      </span>
    );
  });
}

const TemplateChipEditor: React.FC<TemplateChipEditorProps> = ({ value, onChange, chipValues }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const dragSourceChipRef = useRef<HTMLElement | null>(null);
  // 只在 mount / 外部重置時渲染內容；用戶輸入期間唔 re-render（避免 cursor jump）
  const [displayTemplate] = useState(value);
  const serializedRef = useRef(value);

  const chipLabel = (token: string): string => {
    const v = (chipValues[token] || '').trim();
    return v ? `${token}：${v}` : token;
  };

  // chip 有值即顯示值：直接改 chip span 文字，唔郁文字節點，cursor 唔會跳
  useEffect(() => {
    const root = editorRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>('[data-token]').forEach(el => {
      const token = el.dataset.token || '';
      const label = chipLabel(token);
      if (el.textContent !== label) el.textContent = label;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chipValues]);

  // 將 editor DOM serialize 返做純文字模板（chip → {token}）
  const serialize = (): string => {
    const root = editorRef.current;
    if (!root) return '';
    let out = '';
    root.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        out += node.textContent || '';
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (el.dataset.token) {
          out += `{${el.dataset.token}}`;
        } else if (el.tagName === 'BR') {
          out += '\n';
        } else if (el.tagName === 'DIV') {
          out += (el.textContent || '') + '\n';
        } else {
          out += el.textContent || '';
        }
      }
    });
    return out;
  };

  const syncFromDom = () => {
    const template = serialize();
    serializedRef.current = template;
    onChange(template);
  };

  const createChipElement = (token: string): HTMLElement => {
    const chip = document.createElement('span');
    chip.dataset.token = token;
    chip.contentEditable = 'false';
    chip.draggable = true;
    chip.className = CHIP_CLASS;
    chip.textContent = chipLabel(token);
    return chip;
  };

  const insertChipAtRange = (range: Range, token: string) => {
    range.deleteContents();
    const chip = createChipElement(token);
    range.insertNode(chip);
    range.setStartAfter(chip);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  };

  // 攞 drop 位置：caretRangeFromPoint（Chrome/Edge/Safari），fallback caretPositionFromPoint（Firefox）
  const rangeFromPoint = (x: number, y: number): Range | null => {
    const root = editorRef.current;
    if (!root) return null;
    let range: Range | null = null;
    const caretRangeFn = (document as any).caretRangeFromPoint;
    if (typeof caretRangeFn === 'function') {
      range = caretRangeFn.call(document, x, y);
    } else if (typeof (document as any).caretPositionFromPoint === 'function') {
      const pos = (document as any).caretPositionFromPoint(x, y);
      if (pos) {
        range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        range.collapse(true);
      }
    }
    if (!range) return null;
    // clamp 到編輯區範圍內
    const node = range.commonAncestorContainer;
    if (!root.contains(node.nodeType === Node.ELEMENT_NODE ? node : node.parentNode)) return null;
    return range;
  };

  const handleToolbarChipClick = (token: string) => {
    const root = editorRef.current;
    if (!root) return;
    const sel = window.getSelection();
    let range: Range | null = null;
    if (sel && sel.rangeCount > 0) {
      const r = sel.getRangeAt(0);
      const node = r.commonAncestorContainer;
      if (root.contains(node.nodeType === Node.ELEMENT_NODE ? node : node.parentNode)) {
        range = r;
      }
    }
    if (!range) {
      range = document.createRange();
      range.selectNodeContents(root);
      range.collapse(false);
    }
    insertChipAtRange(range, token);
    syncFromDom();
    root.focus();
  };

  const handleToolbarChipDragStart = (e: React.DragEvent, token: string) => {
    e.dataTransfer.setData('text/plain', token);
    e.dataTransfer.effectAllowed = 'copy';
    dragSourceChipRef.current = null;
  };

  const handleEditorChipDragStart = (e: React.DragEvent) => {
    const chip = (e.target as HTMLElement).closest('[data-token]') as HTMLElement | null;
    if (!chip) return;
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', chip.dataset.token || '');
    e.dataTransfer.effectAllowed = 'move';
    dragSourceChipRef.current = chip;
  };

  const handleEditorDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = dragSourceChipRef.current ? 'move' : 'copy';
  };

  const handleEditorDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const token = e.dataTransfer.getData('text/plain');
    if (!token || !TEMPLATE_TOKENS.includes(token as (typeof TEMPLATE_TOKENS)[number])) return;
    const range = rangeFromPoint(e.clientX, e.clientY);
    if (!range) return;
    // 編輯區內搬位：先移除原 chip，再喺新位置插入
    const source = dragSourceChipRef.current;
    if (source && editorRef.current?.contains(source)) {
      source.remove();
    }
    insertChipAtRange(range, token);
    syncFromDom();
  };

  const handleEditorDragEnd = () => {
    dragSourceChipRef.current = null;
  };

  return (
    <div className="space-y-2">
      {/* 佔位符工具列：click = 游標位置插入；drag = 拉入編輯區 */}
      <div className="flex flex-wrap gap-2">
        {TEMPLATE_TOKENS.map(token => (
          <button
            key={token}
            type="button"
            draggable
            onClick={() => handleToolbarChipClick(token)}
            onDragStart={(e) => handleToolbarChipDragStart(e, token)}
            className="px-2 py-1 rounded bg-green-50 border border-green-200 text-green-700 text-xs font-medium hover:bg-green-100 transition-colors cursor-grab"
            title="點擊插入到游標位置，或拖曳到訊息內容"
          >
            {chipLabel(token)}
          </button>
        ))}
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={syncFromDom}
        onDragStart={handleEditorChipDragStart}
        onDragOver={handleEditorDragOver}
        onDrop={handleEditorDrop}
        onDragEnd={handleEditorDragEnd}
        className="form-input w-full min-h-[7rem] whitespace-pre-wrap leading-relaxed"
      >
        {renderNodes(displayTemplate, chipLabel)}
      </div>

      <p className="text-xs text-gray-500">
        點擊或拖曳上方標籤插入佔位符；標籤可直接拖曳搬位，backspace 整粒刪除
      </p>
    </div>
  );
};

export default TemplateChipEditor;
