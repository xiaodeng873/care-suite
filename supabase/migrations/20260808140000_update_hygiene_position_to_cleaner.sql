-- 在「清潔員」enum 值可用後，把既有衛生部用戶的職位從「助理員」改為「清潔員」

UPDATE public.user_profiles
SET hygiene_position = '清潔員'::hygiene_position_type,
    updated_at = NOW()
WHERE hygiene_position = '助理員'::hygiene_position_type;
