import * as OpenCC from 'opencc-js';

// 延遲初始化，避免模塊加載時的性能開銷
let _t2s: ((text: string) => string) | null = null;
let _s2t: ((text: string) => string) | null = null;

function getT2S() {
  if (!_t2s) _t2s = OpenCC.Converter({ from: 'hk', to: 'cn' });
  return _t2s;
}

function getS2T() {
  if (!_s2t) _s2t = OpenCC.Converter({ from: 'cn', to: 'hk' });
  return _s2t;
}

/** 繁體（港）→ 簡體：用於顯示層 */
export const t2s = (text: string | null | undefined): string => {
  if (text == null || text === '') return text ?? '';
  return getT2S()(text);
};

/** 簡體 → 繁體（港）：用於存檔前轉換用戶輸入 */
export const s2t = (text: string | null | undefined): string => {
  if (text == null || text === '') return text ?? '';
  return getS2T()(text);
};
