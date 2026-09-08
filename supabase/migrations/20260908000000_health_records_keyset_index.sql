-- ============================================================
-- Migration: 健康監測記錄 keyset 分頁複合索引
-- 2026-09-08
--
-- 背景：全量背景載入由 offset 分頁（.range）改用 keyset 游標分頁
-- （記錄日期, 記錄時間, 記錄id）。offset 分頁頁深愈大 DB 要重掃前面所有行，
-- 資料增長會愈來愈慢甚至 statement timeout (57014)。
-- 此索引配合 RLS 院舍過濾（facility_id）+ ORDER BY 記錄日期 DESC,
-- 記錄時間 DESC, 記錄id DESC，令每頁成本恒定。
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_健康監測記錄_facility_日期時間id
  ON 健康監測記錄(facility_id, 記錄日期, 記錄時間, 記錄id);
