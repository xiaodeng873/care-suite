import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type MealCombinationType =
  | '正飯+正餸' | '正飯+碎餸' | '正飯+糊餸'
  | '軟飯+正餸' | '軟飯+碎餸' | '軟飯+糊餸'
  | '糊飯+糊餸';

export type SpecialDietType = '糖尿餐' | '痛風餐' | '低鹽餐' | '雞蛋' | '素食';

export const MEAL_COMBINATIONS: MealCombinationType[] = [
  '正飯+正餸', '正飯+碎餸', '正飯+糊餸',
  '軟飯+正餸', '軟飯+碎餸', '軟飯+糊餸',
  '糊飯+糊餸',
];

export const SPECIAL_DIETS: SpecialDietType[] = ['糖尿餐', '痛風餐', '低鹽餐', '雞蛋', '素食'];

export const GUIDANCE_SOURCE_OPTIONS = ['言語治療師', '病房出院指示', '營養師建議', '醫生指示', '護理評估', '其他'] as const;

export interface MealGuidance {
  id: string;
  patient_id: number;
  meal_combination: MealCombinationType;
  special_diets: SpecialDietType[];
  needs_thickener: boolean;
  thickener_amount?: string;
  egg_quantity?: number;
  remarks?: string;
  guidance_date?: string;
  guidance_source?: string;
  created_at: string;
  updated_at: string;
}

export function useMealGuidance() {
  return useQuery({
    queryKey: ['meal-guidance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meal_guidance')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as MealGuidance[];
    },
  });
}

export function useCreateMealGuidance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (guidance: Omit<MealGuidance, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('meal_guidance')
        .insert([guidance])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meal-guidance'] }),
  });
}

export function useUpdateMealGuidance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (guidance: MealGuidance) => {
      const { data, error } = await supabase
        .from('meal_guidance')
        .update({ ...guidance, updated_at: new Date().toISOString() })
        .eq('id', guidance.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meal-guidance'] }),
  });
}

export function useDeleteMealGuidance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('meal_guidance').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meal-guidance'] }),
  });
}
