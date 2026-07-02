import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Drawer } from 'expo-router/drawer';
import { DrawerContent } from '@/components/DrawerContent';

export default function AppLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        drawerContent={() => <DrawerContent />}
        screenOptions={{
          headerShown: true,
          drawerType: 'front',
          drawerStyle: { width: 256 },
          swipeEnabled: true,
          overlayColor: 'rgba(0,0,0,0.75)',
          headerStyle: { backgroundColor: '#ffffff' },
          headerTintColor: '#111827',
          headerTitleStyle: { fontWeight: '600', fontSize: 17 },
        }}
      >
        {/* ── 院友 ── */}
        <Drawer.Screen name="index"     options={{ drawerLabel: '主頁',         headerTitle: 'SeniorCare' }} />
        <Drawer.Screen name="residents" options={{ drawerLabel: '院友列表',     headerTitle: '院友記錄' }} />
        <Drawer.Screen name="contacts"  options={{ drawerLabel: '院友聯絡人',   headerTitle: '院友聯絡人' }} />
        <Drawer.Screen name="beds"      options={{ drawerLabel: '床位管理',     headerTitle: '床位管理' }} />
        <Drawer.Screen name="reports"   options={{ drawerLabel: '報表查詢',     headerTitle: '報表查詢' }} />

        {/* ── 記錄 ── */}
        <Drawer.Screen name="health"       options={{ drawerLabel: '監測記錄',   headerTitle: '監測記錄' }} />
        <Drawer.Screen name="care-records" options={{ drawerLabel: '護理記錄',   headerTitle: '護理記錄' }} />
        <Drawer.Screen name="patient-logs" options={{ drawerLabel: '院友日誌',   headerTitle: '院友日誌' }} />
        <Drawer.Screen name="diagnosis"    options={{ drawerLabel: '診斷記錄',   headerTitle: '診斷記錄' }} />
        <Drawer.Screen name="vaccinations" options={{ drawerLabel: '疫苗記錄',   headerTitle: '疫苗記錄' }} />

        {/* ── 藥物 ── */}
        <Drawer.Screen name="prescriptions" options={{ drawerLabel: '處方管理',     headerTitle: '處方管理' }} />
        <Drawer.Screen name="medications"   options={{ drawerLabel: '藥物工作流程', headerTitle: '藥物工作流程' }} />
        <Drawer.Screen name="drugs"         options={{ drawerLabel: '藥物資料庫',   headerTitle: '藥物資料庫' }} />

        {/* ── 治療 ── */}
        <Drawer.Screen name="vmo-visits" options={{ drawerLabel: 'VMO排程',   headerTitle: 'VMO排程' }} />
        <Drawer.Screen name="outreach"   options={{ drawerLabel: '醫院外展',  headerTitle: '醫院外展' }} />
        <Drawer.Screen name="rehab"      options={{ drawerLabel: '復康服務',  headerTitle: '復康服務' }} />

        {/* ── 定期 ── */}
        <Drawer.Screen name="annual-checkup" options={{ drawerLabel: '年度體檢',     headerTitle: '年度體檢' }} />
        <Drawer.Screen name="assessments"    options={{ drawerLabel: '健康評估',     headerTitle: '健康評估' }} />
        <Drawer.Screen name="care-plans"     options={{ drawerLabel: '個人照顧計劃', headerTitle: '個人照顧計劃' }} />
        <Drawer.Screen name="restraints"     options={{ drawerLabel: '約束物品',     headerTitle: '約束物品管理' }} />
        <Drawer.Screen name="wounds"         options={{ drawerLabel: '傷口管理',     headerTitle: '傷口管理' }} />

        {/* ── 日常 ── */}
        <Drawer.Screen name="follow-ups"    options={{ drawerLabel: '覆診管理',     headerTitle: '覆診管理' }} />
        <Drawer.Screen name="admissions"    options={{ drawerLabel: '缺席管理',     headerTitle: '缺席管理' }} />
        <Drawer.Screen name="tasks"         options={{ drawerLabel: '任務管理',     headerTitle: '任務管理' }} />
        <Drawer.Screen name="meals"         options={{ drawerLabel: '餐膳指引',     headerTitle: '餐膳指引' }} />
        <Drawer.Screen name="incidents"     options={{ drawerLabel: '意外事件報告', headerTitle: '意外事件報告' }} />
        <Drawer.Screen name="intake-output" options={{ drawerLabel: '出入量記錄',   headerTitle: '出入量記錄' }} />
        <Drawer.Screen name="hygiene"       options={{ drawerLabel: '衛生護理',     headerTitle: '衛生護理' }} />

        {/* ── 設定 ── */}
        <Drawer.Screen name="users" options={{ drawerLabel: '用戶管理', headerTitle: '用戶管理' }} />
      </Drawer>
    </GestureHandlerRootView>
  );
}
