import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

async function fetchStats() {
  const [residents, incidents, tasks, followUps] = await Promise.all([
    supabase.from('patients').select('院友id', { count: 'exact', head: true }).eq('狀態', '在住'),
    supabase.from('incident_records').select('id', { count: 'exact', head: true })
      .gte('incident_date', new Date().toISOString().split('T')[0]),
    supabase.from('patient_health_tasks').select('id', { count: 'exact', head: true })
      .lt('next_due_at', new Date().toISOString()),
    supabase.from('follow_up_records').select('id', { count: 'exact', head: true })
      .gte('follow_up_date', new Date().toISOString().split('T')[0])
      .lte('follow_up_date', new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]),
  ]);
  return {
    activeResidents: residents.count ?? 0,
    todayIncidents: incidents.count ?? 0,
    overdueTasks: tasks.count ?? 0,
    upcomingFollowUps: followUps.count ?? 0,
  };
}

function StatCard({ icon, label, value, color, bg }: { icon: any; label: string; value: number; color: string; bg: string }) {
  return (
    <View className="flex-1 rounded-2xl p-4 min-w-40 mr-3" style={{ backgroundColor: bg }}>
      <View className="w-10 h-10 rounded-xl items-center justify-center mb-3" style={{ backgroundColor: color + '20' }}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text className="text-3xl font-bold mb-1" style={{ color }}>{value}</Text>
      <Text className="text-xs text-gray-500">{label}</Text>
    </View>
  );
}

export default function ReportsScreen() {
  const { data: stats, isLoading } = useQuery({ queryKey: ['reports-stats'], queryFn: fetchStats, refetchInterval: 60000 });

  if (isLoading) {
    return <View className="flex-1 items-center justify-center"><ActivityIndicator size="large" color="#3b82f6" /></View>;
  }

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }}>
      <Text className="text-lg font-bold text-gray-900 mb-4">即時概覽</Text>

      <View className="flex-row mb-4">
        <StatCard icon="people-outline" label="在住院友" value={stats?.activeResidents ?? 0} color="#3b82f6" bg="#eff6ff" />
        <StatCard icon="warning-outline" label="今日事故" value={stats?.todayIncidents ?? 0} color="#ef4444" bg="#fef2f2" />
      </View>

      <View className="flex-row mb-4">
        <StatCard icon="time-outline" label="逾期任務" value={stats?.overdueTasks ?? 0} color="#f59e0b" bg="#fffbeb" />
        <StatCard icon="calendar-outline" label="本週覆診" value={stats?.upcomingFollowUps ?? 0} color="#22c55e" bg="#f0fdf4" />
      </View>

      <View className="bg-white rounded-2xl p-4 mt-2 border border-gray-100">
        <View className="flex-row items-center gap-2 mb-2">
          <Ionicons name="information-circle-outline" size={18} color="#9ca3af" />
          <Text className="text-sm text-gray-500">更多報表功能（如列印表格、Excel 匯出）</Text>
        </View>
        <Text className="text-xs text-gray-400">請使用電腦版查看完整報表功能。</Text>
      </View>
    </ScrollView>
  );
}
