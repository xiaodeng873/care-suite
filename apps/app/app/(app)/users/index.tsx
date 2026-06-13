import { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser } from '@/features/users/useUsers';
import type { UserProfile, DepartmentType, EmploymentType, UserRole } from '@/features/users/types';
import { ROLE_LABEL, ROLE_COLOR, DEPT_COLOR } from '@/features/users/types';

const ALL_DEPTS: DepartmentType[] = ['行政', '社工', '護理', '專職', '膳食', '衛生'];
const ALL_ROLES: UserRole[] = ['staff', 'admin', 'developer'];
const ALL_EMP_TYPES: EmploymentType[] = ['正職', '兼職'];

function getPosition(user: UserProfile) {
  return (
    user.nursing_position ||
    user.allied_health_position ||
    user.hygiene_position ||
    user.other_position ||
    '—'
  );
}

type FormState = {
  username: string;
  name_zh: string;
  name_en: string;
  department: DepartmentType;
  nursing_position: string;
  hire_date: string;
  employment_type: EmploymentType;
  role: UserRole;
  is_active: boolean;
};

const EMPTY_FORM: FormState = {
  username: '', name_zh: '', name_en: '', department: '護理',
  nursing_position: '', hire_date: new Date().toISOString().slice(0, 10),
  employment_type: '正職', role: 'staff', is_active: true,
};

function UserCard({ user, onPress }: { user: UserProfile; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className={`mx-4 mb-2 rounded-xl bg-white shadow-sm overflow-hidden ${!user.is_active ? 'opacity-50' : ''}`}
    >
      <View className="px-4 py-3 flex-row items-center gap-3">
        <View className="w-10 h-10 rounded-full bg-indigo-100 items-center justify-center">
          <Text className="text-indigo-700 font-bold text-base">
            {user.name_zh.charAt(0)}
          </Text>
        </View>
        <View className="flex-1">
          <View className="flex-row items-center gap-2 flex-wrap">
            <Text className="font-semibold text-gray-900 text-base">{user.name_zh}</Text>
            {user.name_en && <Text className="text-sm text-gray-500">{user.name_en}</Text>}
            {!user.is_active && (
              <View className="bg-gray-100 px-1.5 py-0.5 rounded-full">
                <Text className="text-gray-500 text-xs">已停用</Text>
              </View>
            )}
          </View>
          <View className="flex-row items-center gap-1.5 mt-0.5 flex-wrap">
            <View className={`px-2 py-0.5 rounded-full ${DEPT_COLOR[user.department] || 'bg-gray-100 text-gray-700'}`}>
              <Text className="text-xs">{user.department}</Text>
            </View>
            <Text className="text-xs text-gray-500">{getPosition(user)}</Text>
            <Text className="text-xs text-gray-400">·</Text>
            <Text className="text-xs text-gray-500">{user.employment_type}</Text>
          </View>
        </View>
        <View className={`px-2 py-0.5 rounded-full ${ROLE_COLOR[user.role]}`}>
          <Text className="text-xs font-medium">{ROLE_LABEL[user.role]}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function UsersScreen() {
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState<DepartmentType | 'all'>('all');
  const [showInactive, setShowInactive] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const { data, isLoading, isError, refetch } = useUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.filter((u) => {
      if (!showInactive && !u.is_active) return false;
      if (dept !== 'all' && u.department !== dept) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          u.name_zh.toLowerCase().includes(q) ||
          (u.name_en?.toLowerCase().includes(q) ?? false) ||
          u.username.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [data, search, dept, showInactive]);

  function openCreate() {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(user: UserProfile) {
    setEditingUser(user);
    setForm({
      username: user.username, name_zh: user.name_zh, name_en: user.name_en ?? '',
      department: user.department, nursing_position: user.nursing_position ?? '',
      hire_date: user.hire_date, employment_type: user.employment_type,
      role: user.role, is_active: user.is_active,
    });
    setShowModal(true);
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    if (!form.name_zh.trim()) { Alert.alert('提示', '請填寫中文姓名'); return; }
    if (!form.username.trim()) { Alert.alert('提示', '請填寫帳號'); return; }
    const payload = {
      username: form.username.trim(),
      name_zh: form.name_zh.trim(),
      name_en: form.name_en.trim() || undefined,
      department: form.department,
      nursing_position: form.nursing_position.trim() || undefined,
      hire_date: form.hire_date,
      employment_type: form.employment_type,
      role: form.role,
      is_active: form.is_active,
    };
    try {
      if (editingUser) {
        await updateUser.mutateAsync({ id: editingUser.id, ...payload });
      } else {
        await createUser.mutateAsync(payload as any);
      }
      setShowModal(false);
    } catch (e: any) {
      Alert.alert('儲存失敗', e?.message ?? '請重試');
    }
  }

  function handleDelete(user: UserProfile) {
    Alert.alert('確認刪除', `確定刪除「${user.name_zh}」的帳號？此操作不可復原。`, [
      { text: '取消', style: 'cancel' },
      { text: '刪除', style: 'destructive', onPress: () => deleteUser.mutate(user.id) },
    ]);
  }

  const saving = createUser.isPending || updateUser.isPending;

  return (
    <View className="flex-1 bg-gray-100">
      <View className="px-4 py-2 bg-white border-b border-gray-200">
        <TextInput
          value={search} onChangeText={setSearch}
          placeholder="搜尋姓名或帳號..."
          className="bg-gray-100 rounded-xl px-4 py-2.5 text-sm text-gray-800"
          placeholderTextColor="#9ca3af" clearButtonMode="while-editing"
        />
      </View>

      <View className="bg-white border-b border-gray-200 py-2">
        <FlatList
          horizontal showsHorizontalScrollIndicator={false}
          data={['all', ...ALL_DEPTS] as const}
          keyExtractor={(item) => item}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => setDept(item)}
              className={`px-3 py-1.5 rounded-full ${dept === item ? 'bg-indigo-600' : 'bg-gray-100'}`}>
              <Text className={`text-sm font-medium ${dept === item ? 'text-white' : 'text-gray-600'}`}>
                {item === 'all' ? '全部' : item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <TouchableOpacity onPress={() => setShowInactive(!showInactive)}
        className="flex-row items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
        <Text className="text-sm text-gray-600">顯示已停用帳號</Text>
        <View className={`w-10 h-6 rounded-full ${showInactive ? 'bg-indigo-600' : 'bg-gray-300'} items-center justify-center`}>
          <View className={`w-4 h-4 rounded-full bg-white ${showInactive ? 'ml-3' : 'mr-3'}`} />
        </View>
      </TouchableOpacity>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-red-500 text-center">載入失敗</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <UserCard user={item} onPress={() => openEdit(item)} />}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
          contentContainerStyle={{ paddingVertical: 12, paddingBottom: 100 }}
          ListHeaderComponent={
            <Text className="px-4 pb-2 text-xs text-gray-500">共 {filtered.length} 名員工</Text>
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-20 px-8">
              <Text className="text-gray-400 text-lg">沒有符合條件的用戶</Text>
            </View>
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        className="absolute bottom-8 right-6 w-14 h-14 bg-indigo-600 rounded-full items-center justify-center shadow-lg"
        style={{ elevation: 6 }}
        onPress={openCreate}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>

      {/* Create/Edit Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-gray-50">
          <View className="flex-row items-center justify-between px-4 py-4 bg-white border-b border-gray-200">
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text className="text-base text-gray-500">取消</Text>
            </TouchableOpacity>
            <Text className="text-base font-semibold">{editingUser ? '編輯員工' : '新增員工'}</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving
                ? <ActivityIndicator size="small" color="#6366f1" />
                : <Text className="text-base font-semibold text-indigo-600">儲存</Text>}
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">
            <Text className="text-sm font-medium text-gray-700 mb-1">中文姓名 *</Text>
            <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-4"
              value={form.name_zh} onChangeText={(v) => setField('name_zh', v)} placeholder="陳大明" />

            <Text className="text-sm font-medium text-gray-700 mb-1">英文姓名</Text>
            <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-4"
              value={form.name_en} onChangeText={(v) => setField('name_en', v)} placeholder="Chan Tai Ming（可選）" />

            <Text className="text-sm font-medium text-gray-700 mb-1">帳號 *</Text>
            <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-4"
              value={form.username} onChangeText={(v) => setField('username', v)}
              placeholder="login_username" autoCapitalize="none" />

            <Text className="text-sm font-medium text-gray-700 mb-1">部門</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {ALL_DEPTS.map((d) => (
                <TouchableOpacity key={d} onPress={() => setField('department', d)}
                  className="px-3 py-2 rounded-xl border"
                  style={{ backgroundColor: form.department === d ? '#6366f1' : 'white', borderColor: form.department === d ? '#6366f1' : '#e5e7eb' }}>
                  <Text style={{ color: form.department === d ? 'white' : '#374151', fontSize: 13 }}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-sm font-medium text-gray-700 mb-1">職位</Text>
            <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-4"
              value={form.nursing_position} onChangeText={(v) => setField('nursing_position', v)}
              placeholder="如：護士長、護理員（可選）" />

            <Text className="text-sm font-medium text-gray-700 mb-1">入職日期</Text>
            <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-4"
              value={form.hire_date} onChangeText={(v) => setField('hire_date', v)} placeholder="YYYY-MM-DD" />

            <Text className="text-sm font-medium text-gray-700 mb-1">僱用類型</Text>
            <View className="flex-row gap-3 mb-4">
              {ALL_EMP_TYPES.map((et) => (
                <TouchableOpacity key={et} onPress={() => setField('employment_type', et)}
                  className="flex-1 py-3 rounded-xl border items-center"
                  style={{ backgroundColor: form.employment_type === et ? '#6366f1' : 'white', borderColor: form.employment_type === et ? '#6366f1' : '#e5e7eb' }}>
                  <Text style={{ color: form.employment_type === et ? 'white' : '#374151', fontSize: 14, fontWeight: '600' }}>{et}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-sm font-medium text-gray-700 mb-1">角色</Text>
            <View className="flex-row gap-2 mb-4">
              {ALL_ROLES.map((r) => (
                <TouchableOpacity key={r} onPress={() => setField('role', r)}
                  className="flex-1 py-2 rounded-xl border items-center"
                  style={{ backgroundColor: form.role === r ? '#6366f1' : 'white', borderColor: form.role === r ? '#6366f1' : '#e5e7eb' }}>
                  <Text style={{ color: form.role === r ? 'white' : '#374151', fontSize: 13 }}>{ROLE_LABEL[r]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-sm font-medium text-gray-700 mb-1">狀態</Text>
            <View className="flex-row gap-3 mb-4">
              {([true, false] as const).map((v) => (
                <TouchableOpacity key={String(v)} onPress={() => setField('is_active', v)}
                  className="flex-1 py-3 rounded-xl border items-center"
                  style={{ backgroundColor: form.is_active === v ? (v ? '#10b981' : '#ef4444') : 'white', borderColor: form.is_active === v ? (v ? '#10b981' : '#ef4444') : '#e5e7eb' }}>
                  <Text style={{ color: form.is_active === v ? 'white' : '#374151', fontSize: 14, fontWeight: '600' }}>{v ? '啟用' : '停用'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {editingUser && (
              <TouchableOpacity onPress={() => { setShowModal(false); setTimeout(() => handleDelete(editingUser), 300); }}
                className="bg-red-50 border border-red-200 rounded-xl py-3 items-center mb-8">
                <Text className="text-red-600 font-semibold">刪除此員工帳號</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
