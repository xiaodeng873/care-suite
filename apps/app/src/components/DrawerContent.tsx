/**
 * DrawerContent — 完全按照 web Layout.tsx 的手機側邊選單實現
 * 結構：標題列「選單」+ 分類 h3 + 項目列表，無 accordion，無底部用戶區塊
 */
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

interface NavItem {
  name: string;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
}

interface NavCategory {
  name: string;
  items: NavItem[];
}

// 完全對應 web Layout.tsx 的 allNavCategories（排除列印/範本/床位管理）
const NAV_CATEGORIES: NavCategory[] = [
  {
    name: '院友',
    items: [
      { name: '院友列表',   route: '/(app)/residents', icon: 'people-outline' },
      { name: '院友聯絡人', route: '/(app)/contacts',  icon: 'person-add-outline' },
      { name: '報表查詢',   route: '/(app)/reports',   icon: 'bar-chart-outline' },
    ],
  },
  {
    name: '記錄',
    items: [
      { name: '監測記錄', route: '/(app)/health',       icon: 'pulse-outline' },
      { name: '護理記錄', route: '/(app)/care-records', icon: 'clipboard-outline' },
      { name: '院友日誌', route: '/(app)/patient-logs', icon: 'book-outline' },
      { name: '診斷記錄', route: '/(app)/diagnosis',    icon: 'document-text-outline' },
      { name: '疫苗記錄', route: '/(app)/vaccinations', icon: 'medical-outline' },
    ],
  },
  {
    name: '藥物',
    items: [
      { name: '處方管理',     route: '/(app)/prescriptions', icon: 'receipt-outline' },
      { name: '藥物工作流程', route: '/(app)/medications',   icon: 'checkmark-circle-outline' },
      { name: '藥物資料庫',   route: '/(app)/drugs',         icon: 'server-outline' },
    ],
  },
  {
    name: '治療',
    items: [
      { name: 'VMO排程',  route: '/(app)/vmo-visits', icon: 'stethoscope-outline' },
      { name: '醫院外展', route: '/(app)/outreach',   icon: 'business-outline' },
      { name: '復康服務', route: '/(app)/rehab',      icon: 'walk-outline' },
    ],
  },
  {
    name: '定期',
    items: [
      { name: '年度體檢',     route: '/(app)/annual-checkup', icon: 'calendar-outline' },
      { name: '健康評估',     route: '/(app)/assessments',    icon: 'search-outline' },
      { name: '個人照顧計劃', route: '/(app)/care-plans',     icon: 'list-circle-outline' },
      { name: '約束物品',     route: '/(app)/restraints',     icon: 'shield-outline' },
      { name: '傷口管理',     route: '/(app)/wounds',         icon: 'cut-outline' },
    ],
  },
  {
    name: '日常',
    items: [
      { name: '覆診管理',     route: '/(app)/follow-ups',  icon: 'calendar-number-outline' },
      { name: '缺席管理',     route: '/(app)/admissions',  icon: 'car-outline' },
      { name: '任務管理',     route: '/(app)/tasks',       icon: 'time-outline' },
      { name: '餐膳指引',     route: '/(app)/meals',       icon: 'restaurant-outline' },
      { name: '意外事件報告', route: '/(app)/incidents',   icon: 'warning-outline' },
    ],
  },
];

export function DrawerContent({ navigation }: { navigation?: any }) {
  const router   = useRouter();
  const pathname = usePathname();

  function isActive(route: string): boolean {
    const segment = route.replace('/(app)', '');
    return pathname === segment || pathname.startsWith(segment + '/');
  }

  function handleClose() {
    if (navigation) navigation.closeDrawer();
  }

  function handlePress(route: string) {
    if (navigation) navigation.closeDrawer();
    router.push(route as any);
  }

  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      {/* 標題列 — 對應 web 手機選單的 <span>選單</span> + X 按鈕 */}
      <View style={{
        height: 64,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
        marginTop: 44,
      }}>
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#111827' }}>選單</Text>
        <Pressable onPress={handleClose} hitSlop={8}>
          <Ionicons name="close" size={24} color="#9ca3af" />
        </Pressable>
      </View>

      {/* 導航項目 — 對應 web 手機選單的分類 h3 + item 列表 */}
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: 16, paddingVertical: 16 }}>
          {NAV_CATEGORIES.map((category) => (
            <View key={category.name} style={{ marginBottom: 16 }}>
              {/* 分類標題 — 對應 web: text-xs font-semibold text-gray-500 uppercase */}
              <Text style={{
                fontSize: 12,
                fontWeight: '600',
                color: '#6b7280',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 8,
              }}>
                {category.name}
              </Text>
              {/* 項目列表 */}
              <View style={{ gap: 2 }}>
                {category.items.map((item) => {
                  const active = isActive(item.route);
                  return (
                    <Pressable
                      key={item.route}
                      onPress={() => handlePress(item.route)}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 8,
                        backgroundColor: active
                          ? '#eff6ff'
                          : pressed ? '#f9fafb' : 'transparent',
                      })}
                    >
                      <Ionicons
                        name={item.icon}
                        size={16}
                        color={active ? '#1d4ed8' : '#374151'}
                      />
                      <Text style={{
                        fontSize: 14,
                        color: active ? '#1d4ed8' : '#374151',
                      }}>
                        {item.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
