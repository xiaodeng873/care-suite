/*
  # 將餐膳組合「鼻胃飼」記錄搬移至「不適用」

  1. 變更
    - 將 meal_guidance 表中所有 meal_combination = '鼻胃飼' 的記錄更新為 '不適用'
*/

-- 更新現有記錄：原餐膳組合為「鼻胃飼」的改為「不適用」
UPDATE meal_guidance
SET meal_combination = '不適用'
WHERE meal_combination::text = '鼻胃飼';
