import { getSupabaseAdmin } from "@/lib/supabase/admin";

let cached: boolean | null = null;
let probedAt = 0;

/** employees.advance_monthly_cut kolonları var mı? (migration sonrası true). */
export async function employeesHaveAdvanceColumns(force = false): Promise<boolean> {
  const now = Date.now();
  if (!force && cached != null && now - probedAt < 5 * 60_000) return cached;
  const { error } = await getSupabaseAdmin()
    .from("employees")
    .select("id, advance_monthly_cut")
    .limit(1);
  cached = !(error && (error.code === "42703" || /advance_monthly_cut/i.test(error.message)));
  probedAt = now;
  return cached;
}

export function resetAdvanceColumnsProbe() {
  cached = null;
  probedAt = 0;
}
