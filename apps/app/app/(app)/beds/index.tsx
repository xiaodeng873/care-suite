import { View, Text, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useResidents } from '@/features/residents/useResidents';
import { useLayout } from '@/hooks/useLayout';

export default function BedsScreen() {
  const { data: residents = [], isLoading, refetch } = useResidents();
  const { columns } = useLayout();
  const active = residents.filter(r => r.在住狀態 === '在住').sort((a, b) => (a.床號 ?? '').localeCompare(b.床號 ?? ''));

  return (
    <View className="flex-1 bg-gray-50">
      <View className="px-4 pt-4 pb-2 flex-row items-center justify-between">
        <Text className="text-sm text-gray-500">共 {active.length} 位在住院友</Text>
      </View>
      {isLoading ? <ActivityIndicator className="mt-8" size="large" color="#3b82f6" /> : (
        <FlatList
          data={active}
          keyExtractor={item => String(item.院友id)}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          numColumns={columns}
          columnWrapperStyle={columns > 1 ? { gap: 12 } : undefined}
          renderItem={({ item }) => (
            <View
              className="flex-1 bg-white rounded-2xl p-4 mb-3 shadow-sm"
              style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}
            >
              <View className="w-10 h-10 bg-blue-50 rounded-xl items-center justify-center mb-2">
                <Ionicons name="bed-outline" size={20} color="#3b82f6" />
              </View>
              <Text className="text-base font-bold text-blue-600 mb-0.5">{item.床號 ?? '—'}</Text>
              <Text className="text-sm font-medium text-gray-800" numberOfLines={1}>{item.中文姓名}</Text>
              {item.英文姓名 && <Text className="text-xs text-gray-400" numberOfLines={1}>{item.英文姓名}</Text>}
            </View>
          )}
          ListEmptyComponent={<Text className="text-center text-gray-400 mt-16">暫無在住院友</Text>}
        />
      )}
    </View>
  );
}
