import { View, Text, Pressable, ScrollView, SafeAreaView, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '@/lib/auth/session';
import { signOut } from '@/lib/auth/auth';
import { FEATURE_CARDS, type FeatureCard } from '@/features/dashboard/feature-cards';
import { useLayout } from '@/hooks/useLayout';
import { ContentContainer } from '@/components/ContentContainer';

const CARD_CATEGORIES = [
  { label: '院友', ids: ['residents', 'contacts', 'diagnosis', 'vaccinations', 'admissions', 'beds'] },
  { label: '記錄', ids: ['care-records', 'patient-logs', 'incidents', 'follow-ups', 'annual-checkup', 'assessments'] },
  { label: '藥物', ids: ['medications', 'prescriptions', 'drugs'] },
  { label: '治療 & 護理', ids: ['care-plans', 'wounds', 'restraints', 'rehab'] },
  { label: '健康監測', ids: ['health', 'intake-output', 'tasks'] },
  { label: '日常 & 外部', ids: ['hygiene', 'meals', 'vmo-visits', 'outreach'] },
  { label: '系統', ids: ['reports', 'users'] },
];

export default function DashboardScreen() {
  const router  = useRouter();
  const session = useSession();
  const { columns, maxContentWidth } = useLayout();
  const { width } = useWindowDimensions();
  const PADDING = 16;
  const GAP = 12;
  // 卡片寬度：寬螢幕時以 maxContentWidth 為基準，手機以實際寬度計算
  const effectiveWidth = maxContentWidth ?? width;
  const cardWidth = (effectiveWidth - PADDING * 2 - GAP * (columns - 1)) / columns;

  const displayName =
    session.userProfile?.name_zh ??
    session.userProfile?.username ??
    session.supabaseUser?.email ??
    '用戶';

  const isDeveloper = !!session.supabaseUser;
  const canManageUsers =
    isDeveloper ||
    session.userProfile?.role === 'admin';

  function isCardVisible(card: FeatureCard): boolean {
    if (!card.permissionKey) return true;
    if (card.permissionKey === 'canManageUsers') return canManageUsers;
    return true;
  }

  async function handleSignOut() {
    await signOut();
    router.replace('/(auth)/login');
  }

  const visibleCards = FEATURE_CARDS.filter(isCardVisible);
  const cardMap = Object.fromEntries(visibleCards.map(c => [c.id, c]));

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center justify-between bg-primary-600 px-4 py-3">
        <View>
          <Text className="text-lg font-bold text-white">SeniorCare</Text>
          <Text className="text-xs text-primary-100">{displayName}</Text>
        </View>
        <Pressable
          onPress={handleSignOut}
          className="rounded-full p-2 active:bg-primary-700"
          hitSlop={8}
        >
          <Ionicons name="log-out-outline" size={22} color="white" />
        </Pressable>
      </View>

      {/* Feature grid grouped by category */}
      <ContentContainer>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
        {CARD_CATEGORIES.map(cat => {
          const cards = cat.ids.map(id => cardMap[id]).filter(Boolean);
          if (!cards.length) return null;
          return (
            <View key={cat.label} className="mb-5">
              <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">{cat.label}</Text>
              <View className="flex-row flex-wrap gap-3">
                {cards.map(card => (
                  <Pressable
                    key={card.id}
                    className="items-center rounded-xl bg-white p-4 shadow-sm active:bg-gray-100"
                    style={{ width: cardWidth, minWidth: 120 }}
                    onPress={() => router.push(card.href as any)}
                  >
                    <Ionicons name={card.icon as any} size={28} color="#2563eb" />
                    <Text className="mt-2 text-center text-sm font-medium text-gray-800">
                      {card.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          );
        })}
        </ScrollView>
      </ContentContainer>
    </SafeAreaView>
  );
}
