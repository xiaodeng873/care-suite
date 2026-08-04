import type { UserProfile } from '@care-suite/shared';
import type { ProblemCategory } from '../lib/database';

/**
 * 把員工 profile 的職位/部門對應到 ICP 問題庫的專業分類。
 * 開發者與主管不應被視為任何專業，回傳 null 表示「全部可見」。
 */
export function getUserProfessionCategory(userProfile: UserProfile | null): ProblemCategory | null {
  if (!userProfile) return null;

  const { nursing_position, allied_health_position, department } = userProfile;

  if (nursing_position) {
    return '護理';
  }

  if (allied_health_position) {
    if (allied_health_position.includes('物理')) return '物理治療';
    if (allied_health_position.includes('職業')) return '職業治療';
    if (allied_health_position.includes('言語')) return '言語治療';
  }

  if (department === '膳食') return '營養師';
  if (department === '社工') return '社工';
  // 醫生、行政、衛生等目前無法單純對應，視為不過濾

  return null;
}

/**
 * 判斷使用者是否應預設開啟「只看我的專業」過濾。
 */
export function shouldDefaultToMyProfession(userProfile: UserProfile | null): boolean {
  return getUserProfessionCategory(userProfile) !== null;
}
