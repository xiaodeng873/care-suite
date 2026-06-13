import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useResidents } from '@/features/residents/useResidents';
import type { Resident } from '@/features/residents/types';

export default function IntakeOutputIndex() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const { data: residents = [], isLoading, refetch } = useResidents();

  const filtered = residents.filter((r) => {
    const q = search.trim();
    if (!q) return true;
    return r.中文姓名?.includes(q) || r.床號?.includes(q);
  });

  const renderItem = ({ item }: { item: Resident }) => (
    <TouchableOpacity
      className="flex-row items-center justify-between bg-white px-4 py-3 mb-1 rounded-lg"
      activeOpacity={0.7}
      onPress={() =>
        router.push({ pathname: '/(app)/intake-output/[id]', params: { id: String(item.院友id) } })
      }
    >
      <View className="flex-row items-center gap-3">
        <View
          className={`w-8 h-8 rounded-full items-center justify-center ${
            item.性別 === '男' ? 'bg-blue-100' : 'bg-pink-100'
          }`}
        >
          <Text className={`text-xs font-bold ${item.性別 === '男' ? 'text-blue-600' : 'text-pink-600'}`}>
            {item.性別 === '男' ? '男' : '女'}
          </Text>
        </View>
        <View>
          <Text className="text-base font-semibold text-gray-800">{item.中文姓名}</Text>
          {item.床號 ? (
            <Text className="text-xs text-gray-400">{item.床號}</Text>
          ) : null}
        </View>
      </View>
      <Text className="text-gray-400 text-lg">›</Text>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-gray-50">
      <View className="px-4 pt-4 pb-2">
        <TextInput
          className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-base text-gray-800"
          placeholder="搜尋院友姓名或床號…"
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.院友id)}
          renderItem={renderItem}
          contentContainerClassName="px-4 pb-8"
          onRefresh={refetch}
          refreshing={isLoading}
          ListEmptyComponent={
            <View className="items-center justify-center py-16">
              <Text className="text-gray-400 text-base">未找到院友</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
