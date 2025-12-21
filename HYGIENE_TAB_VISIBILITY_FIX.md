# 选项卡可见性修复

## 问题
当用户在日历中回到过去的日期时，仍然会看到在那个日期还未创建的选项卡。

例如：
- Position 选项卡在 2025-12-13 创建
- 但用户查看 2025-12-01 时，仍然能看到 Position 选项卡

## 解决方案
添加 `getVisibleTabs()` 函数，根据 `selectedDate` 过滤选项卡：
- 只显示在选择日期当天或之前启用的选项卡
- 当日期改变时，自动切换到第一个可用的选项卡（如果当前选项卡不可见）

## 实现细节

### 1. getVisibleTabs 函数
```typescript
const getVisibleTabs = (): TabType[] => {
  const dateStr = selectedDate.toISOString().split('T')[0];
  return availableTabs.filter(tab => {
    const tabConfig = careTabs.find(t => t.tab_type === tab);
    if (!tabConfig?.last_activated_at) return false;
    
    const activationDate = tabConfig.last_activated_at.split('T')[0];
    return dateStr >= activationDate;
  });
};
```

### 2. 在 renderTabs 中使用 getVisibleTabs
```typescript
const renderTabs = () => {
  const visibleTabs = getVisibleTabs();
  return (
    <View style={styles.tabsContainer}>
      {visibleTabs.map((tab) => {
        // ... tab rendering
      })}
    </View>
  );
};
```

### 3. 添加日期改变时的选项卡切换逻辑
需要添加 useEffect 监听 selectedDate 和 careTabs 变化，当当前 activeTab 不在可见列表中时自动切换。

## 测试场景

### 场景 1: 查看历史日期
1. 打开患者 ID 19 的护理记录
2. 切换日期到 2025-12-01
3. **预期结果**: 只显示 diaper, patrol, restraint 选项卡（11/30 创建的）
4. **不应显示**: position (12/13创建), hygiene (12/21创建)

### 场景 2: 切换到中间日期
1. 切换日期到 2025-12-15
2. **预期结果**: 显示 diaper, patrol, restraint, position（position在12/13启用）
3. **不应显示**: hygiene (12/21创建)

### 场景 3: 切换到今天
1. 切换日期到 2025-12-21
2. **预期结果**: 显示所有 5 个选项卡

### 场景 4: 自动切换选项卡
1. 当前选择 hygiene 选项卡（12/21）
2. 切换日期到 2025-12-15
3. **预期结果**: 自动切换到第一个可用的选项卡（如 diaper），因为 hygiene 在那个日期还不存在

## 注意事项
- 必须先执行 `20251221120000_fix_last_activated_at.sql` 修复脚本
- 确保 `last_activated_at` 字段反映真实的创建日期
- 该功能依赖于正确的 `patient_care_tabs` 数据
