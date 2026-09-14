import { createClient } from "@/lib/supabase/server";

/**
 * 後台只有一個人進得去，身分由 ADMIN_USER_ID 這個環境變數認定。
 *
 * 刻意不用「旅程擁有者」或 email 比對：email 會改、旅程擁有者有很多個，
 * 而 auth.users.id 是固定且唯一的。沒設這個環境變數時一律視為沒有管理員，
 * 後台整個不存在 —— 忘了設也不會意外開放。
 */
export async function getAdminUser() {
  const adminId = process.env.ADMIN_USER_ID;
  if (!adminId) return null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== adminId) return null;

  return user;
}

export async function isAdmin(): Promise<boolean> {
  return (await getAdminUser()) !== null;
}
