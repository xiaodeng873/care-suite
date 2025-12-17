# 验证手机端保存流程

## 问题描述
- 手机端新增记录显示"成功"
- 但在 Supabase 数据库中看不到记录
- Web 端的记录可以在数据库看到
- 手机端和数据库不同步

## 已添加的调试日志

### 1. RecordDetailScreen.tsx 保存时会输出：
```
Saving patrolData: {patient_id, patrol_date, ...}
Current user session: user@email.com
✓ Patrol round created in Supabase: <record_id>
✓ Full saved record: {完整记录JSON}
✓ Record confirmed saved to database
  - Record ID: <id>
  - Record Type: patrol
  - Patient ID: <patient_id>
```

### 2. database.ts 会输出：
```
[DB] Creating patrol round: {data}
[DB] Patrol round created successfully: <record_id>
```

### 3. 如果失败会输出：
```
❌ 保存記錄失敗: <error>
  - Error type: <type>
  - Error message: <message>
  - Full error: {完整错误JSON}
```

## 测试步骤

1. 在手机App中登录
2. 选择一个院友
3. 添加一条巡房记录
4. 查看手机端的日志输出（使用 `npx expo start` 的控制台）
5. 检查是否看到：
   - ✓ "Current user session" 显示邮箱（说明已登录）
   - ✓ "[DB] Creating patrol round" 日志
   - ✓ "Patrol round created in Supabase" 带 ID
   - ✓ "Record confirmed saved to database"
6. 复制记录的 ID
7. 登录 Supabase 控制台，在 patrol_rounds 表中搜索这个 ID

## 可能的原因

### A. 未登录或认证过期
- 症状：看不到 "Current user session" 邮箱
- 解决：重新登录

### B. RLS 策略问题
- 症状：看到 "RLS policy" 相关错误
- 解决：检查 Supabase RLS 策略

### C. 网络问题
- 症状：超时或连接错误
- 解决：检查网络连接

### D. 数据库连接到错误的项目
- 症状：保存成功但在控制台看不到
- 解决：确认 SUPABASE_URL 是否正确

## 下一步

运行 App 并尝试保存一条记录，观察日志输出，根据输出判断问题所在。
