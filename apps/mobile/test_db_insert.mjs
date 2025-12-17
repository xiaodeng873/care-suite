import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mzeptzwuqvpjspxgnzkp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16ZXB0end1cXZwanNweGduemtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwMjM4NjEsImV4cCI6MjA2NzU5OTg2MX0.Uo4fgr2XdUxWY5LZ5Q7A0j6XoCyuUsHhb4WO-eabJWk';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testDatabase() {
  console.log('=== 测试数据库连接 ===');
  console.log('Supabase URL:', SUPABASE_URL);
  console.log('');
  
  // 1. 检查认证状态
  const { data: { session } } = await supabase.auth.getSession();
  console.log('当前认证状态:', session ? '已登录' : '未登录');
  if (session) {
    console.log('用户邮箱:', session.user.email);
  }
  console.log('');
  
  // 2. 获取第一个院友
  console.log('=== 获取院友列表 ===');
  const { data: patients, error: patientsError } = await supabase
    .from('院友主表')
    .select('*')
    .eq('在住狀態', '在住')
    .limit(1);
  
  if (patientsError) {
    console.error('获取院友失败:', patientsError);
    return;
  }
  
  if (!patients || patients.length === 0) {
    console.log('没有找到在住院友');
    return;
  }
  
  const patient = patients[0];
  console.log('找到院友:', patient.中文姓名, '(ID:', patient.院友id, ')');
  console.log('');
  
  // 3. 尝试插入一条测试巡房记录
  console.log('=== 测试插入巡房记录 ===');
  const testPatrolData = {
    patient_id: patient.院友id,
    patrol_date: '2025-12-17',
    patrol_time: '14:30',
    scheduled_time: '14:00',
    recorder: '测试记录者',
  };
  
  console.log('准备插入的数据:', testPatrolData);
  
  const { data: insertedRecord, error: insertError } = await supabase
    .from('patrol_rounds')
    .insert([testPatrolData])
    .select()
    .single();
  
  if (insertError) {
    console.error('插入失败:', insertError);
    console.error('错误详情:', JSON.stringify(insertError, null, 2));
  } else {
    console.log('✓ 插入成功！');
    console.log('插入的记录:', insertedRecord);
    console.log('');
    
    // 4. 验证记录是否存在
    console.log('=== 验证记录 ===');
    const { data: verifyRecords, error: verifyError } = await supabase
      .from('patrol_rounds')
      .select('*')
      .eq('id', insertedRecord.id);
    
    if (verifyError) {
      console.error('验证失败:', verifyError);
    } else if (verifyRecords && verifyRecords.length > 0) {
      console.log('✓ 记录存在于数据库中！');
      console.log('记录详情:', verifyRecords[0]);
      
      // 5. 删除测试记录
      console.log('');
      console.log('=== 清理测试记录 ===');
      const { error: deleteError } = await supabase
        .from('patrol_rounds')
        .delete()
        .eq('id', insertedRecord.id);
      
      if (deleteError) {
        console.error('删除失败:', deleteError);
      } else {
        console.log('✓ 测试记录已删除');
      }
    } else {
      console.log('✗ 记录不存在于数据库中！');
    }
  }
  
  // 6. 检查表中现有记录数
  console.log('');
  console.log('=== 统计现有记录 ===');
  const { count: patrolCount } = await supabase
    .from('patrol_rounds')
    .select('*', { count: 'exact', head: true });
  console.log('patrol_rounds 表中共有', patrolCount, '条记录');
  
  const { count: diaperCount } = await supabase
    .from('diaper_change_records')
    .select('*', { count: 'exact', head: true });
  console.log('diaper_change_records 表中共有', diaperCount, '条记录');
  
  const { count: restraintCount } = await supabase
    .from('restraint_observation_records')
    .select('*', { count: 'exact', head: true });
  console.log('restraint_observation_records 表中共有', restraintCount, '条记录');
  
  const { count: positionCount } = await supabase
    .from('position_change_records')
    .select('*', { count: 'exact', head: true });
  console.log('position_change_records 表中共有', positionCount, '条记录');
}

testDatabase().catch(console.error);
