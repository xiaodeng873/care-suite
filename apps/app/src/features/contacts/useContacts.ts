import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface PatientContact {
  id: string;
  院友id: number;
  聯絡人姓名: string;
  關係?: string;
  聯絡電話?: string;
  電郵?: string;
  地址?: string;
  備註?: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export function useContacts() {
  return useQuery({
    queryKey: ['contacts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patient_contacts')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as PatientContact[];
    },
  });
}

export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (contact: Omit<PatientContact, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('patient_contacts')
        .insert([contact])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (contact: PatientContact) => {
      const { data, error } = await supabase
        .from('patient_contacts')
        .update({ ...contact, updated_at: new Date().toISOString() })
        .eq('id', contact.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('patient_contacts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });
}
