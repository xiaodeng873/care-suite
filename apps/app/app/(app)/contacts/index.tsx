import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, Modal, ScrollView, Switch, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PatientAutocomplete } from '@/components/PatientAutocomplete';
import { ResidentGroupedList } from '@/components/ResidentGroupedList';
import {
  useContacts, useCreateContact, useUpdateContact, useDeleteContact,
  type PatientContact,
} from '@/features/contacts/useContacts';

const RELATIONSHIPS = ['子女', '配偶', '兄弟姊妹', '父母', '親戟', '朋友', '其他'];

type FormState = {
  院友id: number | null;
  聯絡人姓名: string;
  關係: string;
  聯絡電話: string;
  電郵: string;
  地址: string;
  備註: string;
  is_primary: boolean;
};

const EMPTY: FormState = {
  院友id: null,
  聯絡人姓名: '',
  關係: '',
  聯絡電話: '',
  電郵: '',
  地址: '',
  備註: '',
  is_primary: false,
};

export default function ContactsScreen() {
  const { data: contacts = [], isLoading, refetch } = useContacts();
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PatientContact | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  function openCreate() { setEditing(null); setForm(EMPTY); setShowModal(true); }
  function openEdit(c: PatientContact) {
    setEditing(c);
    setForm({
      院友id: c.院友id,
      聯絡人姓名: c.聯絡人姓名,
      關係: c.關係 ?? '',
      聯絡電話: c.聯絡電話 ?? '',
      電郵: c.電郵 ?? '',
      地址: c.地址 ?? '',
      備註: c.備註 ?? '',
      is_primary: c.is_primary,
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.院友id || !form.聯絡人姓名.trim()) {
      Alert.alert('提示', '請選擇院友並填寫聯絡人姓名');
      return;
    }
    const payload = {
      院友id: form.院友id,
      聯絡人姓名: form.聯絡人姓名.trim(),
      關係: form.關係 || undefined,
      聯絡電話: form.聯絡電話 || undefined,
      電郵: form.電郵 || undefined,
      地址: form.地址 || undefined,
      備註: form.備註 || undefined,
      is_primary: form.is_primary,
    };
    if (editing) { await updateContact.mutateAsync({ ...editing, ...payload }); }
    else { await createContact.mutateAsync(payload); }
    setShowModal(false);
  }

  const isSaving = createContact.isPending || updateContact.isPending;

  return (
    <View className="flex-1 bg-gray-50">
      <ResidentGroupedList
        records={contacts}
        isLoading={isLoading}
        onRefresh={refetch}
        showSort={false}
        getPatientId={(c) => c.院友id}
        getDate={(c) => c.created_at}
        getRecordSearchText={(c) => `${c.聯絡人姓名} ${c.關係 ?? ''} ${c.聯絡電話 ?? ''}`}
        emptyText="暫無聯絡人記錄"
        renderCard={(item) => (
          <TouchableOpacity
            className="bg-white rounded-xl mb-2 px-4 py-3 shadow-sm"
            style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}
            onPress={() => openEdit(item)} activeOpacity={0.7}
          >
            <View className="flex-row items-start justify-between">
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className="text-base font-semibold text-gray-900">{item.聯絡人姓名}</Text>
                  {item.is_primary && (
                    <View className="bg-blue-100 px-2 py-0.5 rounded-full">
                      <Text className="text-xs text-blue-700">主要聯絡人</Text>
                    </View>
                  )}
                </View>
                {item.關係 && <Text className="text-sm text-gray-500 mt-0.5">{item.關係}</Text>}
                {item.聯絡電話 && <Text className="text-sm text-gray-600 mt-1">📞 {item.聯絡電話}</Text>}
              </View>
              <TouchableOpacity onPress={() => Alert.alert('確認刪除', '確定要刪除此聯絡人記錄？', [
                { text: '取消', style: 'cancel' },
                { text: '刪除', style: 'destructive', onPress: () => deleteContact.mutate(item.id) },
              ])} className="p-1">
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity
        className="absolute bottom-8 right-6 w-14 h-14 bg-blue-500 rounded-full items-center justify-center shadow-lg"
        style={{ elevation: 6 }} onPress={openCreate}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-gray-50">
          <View className="flex-row items-center justify-between px-4 py-4 bg-white border-b border-gray-200">
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text className="text-base text-gray-500">取消</Text>
            </TouchableOpacity>
            <Text className="text-base font-semibold text-gray-900">
              {editing ? '編輯聯絡人' : '新增聯絡人'}
            </Text>
            <TouchableOpacity onPress={handleSave} disabled={isSaving}>
              {isSaving
                ? <ActivityIndicator size="small" color="#3b82f6" />
                : <Text className="text-base font-semibold text-blue-500">儲存</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">
            <Text className="text-sm font-medium text-gray-700 mb-1">院友 *</Text>
            <View className="mb-4">
              <PatientAutocomplete
                value={form.院友id}
                onChange={(id) => setForm(f => ({ ...f, 院友id: id }))}
                showResidencyFilter
                defaultResidencyStatus="在住"
              />
            </View>

            <Text className="text-sm font-medium text-gray-700 mb-1">聯絡人姓名 *</Text>
            <TextInput
              className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base text-gray-800 mb-4"
              value={form.聯絡人姓名}
              onChangeText={v => setForm(f => ({ ...f, 聯絡人姓名: v }))}
              placeholder="請輸入聯絡人姓名"
            />

            <Text className="text-sm font-medium text-gray-700 mb-1">關係</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
              {RELATIONSHIPS.map(rel => (
                <TouchableOpacity
                  key={rel}
                  onPress={() => setForm(f => ({ ...f, 關係: f.關係 === rel ? '' : rel }))}
                  className="mr-2 px-3 py-2 rounded-xl border"
                  style={{
                    backgroundColor: form.關係 === rel ? '#3b82f6' : 'white',
                    borderColor: form.關係 === rel ? '#3b82f6' : '#e5e7eb',
                  }}
                >
                  <Text style={{ color: form.關係 === rel ? 'white' : '#374151', fontSize: 13 }}>{rel}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text className="text-sm font-medium text-gray-700 mb-1">聯絡電話</Text>
            <TextInput
              className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base text-gray-800 mb-4"
              value={form.聯絡電話}
              onChangeText={v => setForm(f => ({ ...f, 聯絡電話: v }))}
              placeholder="請輸入電話號碼"
              keyboardType="phone-pad"
            />

            <Text className="text-sm font-medium text-gray-700 mb-1">電郵</Text>
            <TextInput
              className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base text-gray-800 mb-4"
              value={form.電郵}
              onChangeText={v => setForm(f => ({ ...f, 電郵: v }))}
              placeholder="請輸入電郵地址"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text className="text-sm font-medium text-gray-700 mb-1">地址</Text>
            <TextInput
              className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base text-gray-800 mb-4"
              value={form.地址}
              onChangeText={v => setForm(f => ({ ...f, 地址: v }))}
              placeholder="請輸入地址"
            />

            <Text className="text-sm font-medium text-gray-700 mb-1">備註</Text>
            <TextInput
              className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base text-gray-800 mb-4"
              value={form.備註}
              onChangeText={v => setForm(f => ({ ...f, 備註: v }))}
              placeholder="備註（可選）"
              multiline numberOfLines={3}
              textAlignVertical="top"
              style={{ minHeight: 80 }}
            />

            <View className="flex-row items-center justify-between bg-white rounded-xl px-4 py-3 mb-8 border border-gray-200">
              <Text className="text-base text-gray-700">設為主要聯絡人</Text>
              <Switch
                value={form.is_primary}
                onValueChange={v => setForm(f => ({ ...f, is_primary: v }))}
                trackColor={{ false: '#e5e7eb', true: '#3b82f6' }}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
