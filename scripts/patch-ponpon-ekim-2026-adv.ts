/**
 * Ponpon — Ekim 2026 avans kesintisi $400 (kalan $2000).
 * npx tsx --env-file=.env.local scripts/patch-ponpon-ekim-2026-adv.ts
 */
import { getSupabaseAdmin } from "../src/lib/supabase/admin";
import { employeeFromRow, employeeToRow, salaryExtraFromRow, salaryExtraToRow } from "../src/lib/db/mappers";
import {
  encodeAdvanceOverrideInNotes,
  encodeAdvancePlanInNotes,
  propagateAdvanceCutsForEmployee,
  resolveAdvancePlan,
} from "../src/lib/advance-repay";

const PONPON_ID = "c5fba5c8-a7ec-49be-84a5-31b10bb08309";
const EKIM = "2026-10";
const EKIM_CUT = 400;
const INITIAL_ADVANCE = 2500;
const JULY_EXTRA_ID = "se-ponpon-adv-2026-07";

async function main() {
  const { data: row, error: empErr } = await getSupabaseAdmin()
    .from("employees")
    .select("*")
    .eq("id", PONPON_ID)
    .maybeSingle();
  if (empErr) throw empErr;
  if (!row) throw new Error("Ponpon employee not found");

  let emp = employeeFromRow(row as Record<string, unknown>);
  emp = { ...emp, initialAdvance: INITIAL_ADVANCE };
  const plan = resolveAdvancePlan(emp);
  if (!plan) throw new Error("Ponpon advance plan missing");

  let notes = encodeAdvancePlanInNotes(emp.notes, plan.cut, plan.start);
  notes = encodeAdvanceOverrideInNotes(notes, EKIM, EKIM_CUT);

  const patch = employeeToRow({ ...emp, notes });
  const { error: upErr } = await getSupabaseAdmin().from("employees").update(patch).eq("id", PONPON_ID);
  if (upErr) throw upErr;

  // Eski $600 serisi — $2500 açık avans bakiyesine sayılmasın (açıklamada "avans" yok).
  await getSupabaseAdmin()
    .from("salary_extras")
    .update({
      description: "600$ serisi geri ödemesi (1/6) · $100 → kalan $500",
    })
    .eq("id", JULY_EXTRA_ID);

  emp = { ...emp, notes };

  const { data: extraRows, error: exErr } = await getSupabaseAdmin()
    .from("salary_extras")
    .select("*")
    .eq("employee_id", PONPON_ID);
  if (exErr) throw exErr;
  const extras = (extraRows ?? []).map((r) => salaryExtraFromRow(r as Record<string, unknown>));

  const horizon = "2028-04";
  const next = propagateAdvanceCutsForEmployee(extras, emp, horizon);
  const before = new Map(extras.map((e) => [e.id, e]));

  let upserts = 0;
  for (const e of next) {
    const prev = before.get(e.id);
    if (!prev || prev.amount !== e.amount || prev.description !== e.description) {
      const { error } = await getSupabaseAdmin()
        .from("salary_extras")
        .upsert(salaryExtraToRow(e), { onConflict: "id" });
      if (error) throw error;
      upserts += 1;
    }
  }

  const { calcNetPayable, calcOpenAdvanceBalance } = await import("../src/store/store");

  const oct = next.find((e) => e.month === EKIM && e.type === "deduction");
  const nov = next.find((e) => e.month === "2026-11" && e.type === "deduction" && /avans/i.test(e.description));
  console.log("initialAdvance:", INITIAL_ADVANCE);
  console.log("açık avans (Eylül sonu):", calcOpenAdvanceBalance(emp, "2026-09", next));
  console.log("Ponpon notes override:", EKIM, EKIM_CUT);
  console.log("Ekim kesinti:", oct?.amount, oct?.description);
  console.log("açık avans (Ekim sonu):", calcOpenAdvanceBalance(emp, EKIM, next));
  console.log("Ekim net ödenecek:", calcNetPayable(emp, EKIM, [], next));
  console.log("Kasım (sonraki otomatik):", nov?.amount, nov?.description);
  console.log("salary_extras upserted:", upserts);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
