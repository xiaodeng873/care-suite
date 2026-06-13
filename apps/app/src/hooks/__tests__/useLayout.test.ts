import { computeLayout } from '../useLayout';

describe('computeLayout（版面邏輯）', () => {
  // ── 手機直向（375px）──────────────────────────────────────────
  describe('手機直向（寬度 375）', () => {
    const layout = computeLayout(375, 812, 'ios');

    it('isPhone 為 true', () => expect(layout.isPhone).toBe(true));
    it('isTablet 為 false', () => expect(layout.isTablet).toBe(false));
    it('卡片欄數為 2', () => expect(layout.columns).toBe(2));
    it('無最大寬度限制（全寬）', () => expect(layout.maxContentWidth).toBeUndefined());
  });

  // ── 平板直向（768px）──────────────────────────────────────────
  describe('平板直向（寬度 768）', () => {
    const layout = computeLayout(768, 1024, 'ios');

    it('isTablet 為 true', () => expect(layout.isTablet).toBe(true));
    it('isPhone 為 false', () => expect(layout.isPhone).toBe(false));
    it('卡片欄數為 3', () => expect(layout.columns).toBe(3));
    it('無最大寬度限制（全寬）', () => expect(layout.maxContentWidth).toBeUndefined());
  });

  // ── 平板橫向（1024px）─────────────────────────────────────────
  describe('平板橫向（寬度 1024）', () => {
    const layout = computeLayout(1024, 768, 'ios');

    it('isLandscape 為 true', () => expect(layout.isLandscape).toBe(true));
    it('卡片欄數為 4', () => expect(layout.columns).toBe(4));
    it('最大寬度為 960', () => expect(layout.maxContentWidth).toBe(960));
  });

  // ── Web（1280px）──────────────────────────────────────────────
  describe('Web（寬度 1280）', () => {
    const layout = computeLayout(1280, 800, 'web');

    it('isWeb 為 true', () => expect(layout.isWeb).toBe(true));
    it('卡片欄數為 4', () => expect(layout.columns).toBe(4));
    it('最大寬度為 960', () => expect(layout.maxContentWidth).toBe(960));
  });
});
