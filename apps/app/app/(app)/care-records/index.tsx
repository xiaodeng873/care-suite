import { useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useResidents } from '@/features/residents/useResidents';
import type { Resident } from '@/features/residents/types';

export default function CareRecordsIndexScreen() {
  const [search, setSearch] = useState('');
  const { data, isLoading, isError, refetch } = useResidents();

  const filtered = (data ?? []).filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.中文姓名.toLowerCase().includes(q) || r.床號.toLowerCase().includes(q);
  });

  const renderItem = ({ item }: { item: Resident }) => (
    <TouchableOpacity
      className="bg-white mx-4 mb-2 rounded-xl px-4 py-3 flex-row items-center"
      style={{ shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 }}
      onPress={() => router.push(`/(app)/care-records/${item.院友id}`)}
      activeOpacity={0.7}
    >
      <View className="w-10 h-10 bg-blue-50 rounded-lg items-center justify-center mr-3">
        <Text className="text-xs text-blue-600 font-bold">{item.床號}</Text>
      </View>
      <Text className="flex-1 text-base font-medium text-gray-900">{item.中文姓名}</Text>
      <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white px-4 py-3 border-b border-gray-100">
        <View className="bg-gray-100 rounded-xl flex-row items-center px-3 py-2">
          <Ionicons name="search-outline" size={16} color="#6b7280" />
          <TextInput
            className="flex-1 ml-2 text-sm text-gray-900"
            placeholder="搜尋院友姓名或床號…"
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center">
          <TouchableOpacity onPress={() => refetch()} className="bg-blue-600 px-6 py-2 rounded-xl">
            <Text className="text-white">重試</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.院友id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 32 }}
          ListEmptyComponent={
            <View className="items-center py-12">
              <Text className="text-gray-400">找不到院友</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
