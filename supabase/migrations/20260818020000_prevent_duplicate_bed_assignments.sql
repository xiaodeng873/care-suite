-- 防止多個在住院友被指派到同一床位
-- 背景：目前 beds.is_occupied 僅為標記，沒有資料庫層級約束防止
--       兩位在住院友同時擁有相同的 bed_id，導致同一床位顯示多個院友。

-- 1. 先建立輔助函數：列出重複床位指派（供診斷用）
CREATE OR REPLACE FUNCTION fn_list_duplicate_bed_assignments()
RETURNS TABLE (
  bed_id uuid,
  bed_number text,
  patient_id bigint,
  patient_name text,
  status text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.bed_id,
    b.bed_number,
    p.院友id AS patient_id,
    (p.中文姓氏 || p.中文名字) AS patient_name,
    p.在住狀態 AS status
  FROM "院友主表" p
  JOIN beds b ON b.id = p.bed_id
  WHERE p.在住狀態 = '在住'
    AND p.bed_id IS NOT NULL
    AND p.bed_id IN (
      SELECT bed_id
      FROM "院友主表"
      WHERE 在住狀態 = '在住' AND bed_id IS NOT NULL
      GROUP BY bed_id
      HAVING COUNT(*) > 1
    )
  ORDER BY b.bed_number, p.院友id;
END;
$$ LANGUAGE plpgsql;

-- 2. 新增部分唯一索引：同一床位只能有一位在住院友
--    若執行失敗，請先用 SELECT * FROM fn_list_duplicate_bed_assignments();
--    查看重複個案，並在 UI 或 SQL 中修正後再重新 apply 此 migration。
DROP INDEX IF EXISTS idx_院友主表_bed_id_unique_inpatient;
CREATE UNIQUE INDEX idx_院友主表_bed_id_unique_inpatient
  ON "院友主表" (bed_id)
  WHERE 在住狀態 = '在住' AND bed_id IS NOT NULL;
