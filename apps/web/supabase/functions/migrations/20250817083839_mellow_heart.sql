/*
  # 新增待入住狀態到在住狀態枚舉

  1. 枚舉更新
    - 在 `residency_status` 枚舉中新增 '待入住' 值
    - 支援院友在指派床位前的待入住狀態

  2. 說明
    - '待入住'：院友已登記但尚未指派床位
    - '在住'：院友已指派床位並入住
    - '已退住'：院友已退住
*/

-- 新增 '待入住' 到 residency_status 枚舉
ALTER TYPE residency_status ADD VALUE IF NOT EXISTS '待入住';