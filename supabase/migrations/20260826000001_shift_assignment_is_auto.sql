-- user_shift_assignments 增加 is_auto 標記：一鍵排班插入的班次為 true，
-- 「一鍵排空」據此只刪除自動排班產生的班次（跨 session 仍有效，不再依賴前端記憶）
ALTER TABLE user_shift_assignments
  ADD COLUMN IF NOT EXISTS is_auto boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN user_shift_assignments.is_auto IS '是否由一鍵排班自動插入；一鍵排空只刪除 is_auto = true 的班次';
