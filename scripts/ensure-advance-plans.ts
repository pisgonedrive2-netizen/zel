/**
 * Avans planını notes + salary_extras ile güvenceye alır.
 * (DDL kolonları yoksa notes etiketi üretim yoludur.)
 *
 * Kullanım: npx tsx --env-file=.env.local scripts/ensure-advance-plans.ts
 */
import { getSupabaseAdmin } from "../src/lib/supabase/admin";
import {
  encodeAdvancePlanInNotes,
  parseAdvancePlanFromNotes,
  reconcileAdvanceCutsForAllEmployees,
} from "../src/lib/advance-repay";
import { employeeFromRow, salaryExtraFromRow, salaryExtraToRow } from "../src/lib/db/mappers";
import type { Employee } from "../src/store/store";

async function probeAdvanceColumns(): Promise<boolean> {
  const { error } = await getSupabaseAdmin()
    .from("employees")
    .select("id, advance_monthly_cut, advance_repay_start_month")
    .limit(1);
  if (error?.code === "42703") return false;
  if (error) {
    console.warn("probe warning:", error.message);
    return false;
  }
  return true;
}

async function main() {
  const colsOk = await probeAdvanceColumns();
  console.log(`advance_* kolonları: ${colsOk ? "VAR" : "YOK (notes fallback)"}`);

  const { data: empRows, error: empErr } = await getSupabaseAdmin()
    .from("employees")
    .select("*")
    .eq("status", "active");
  if (empErr) throw empErr;
  const employees = (empRows ?? []).map((r) => employeeFromRow(r as Record<string, unknown>));

  // Kolon yoksa planı notes’a yaz (zaten varsa dokunma)
  for (const e of employees) {
    const plan = parseAdvancePlanFromNotes(e.notes);
    const cut = e.advanceMonthlyCut ?? plan.cut;
    const start = e.advanceRepayStartMonth ?? plan.start;
    if (!(cut && cut > 0 && start)) continue;
    const nextNotes = encodeAdvancePlanInNotes(e.notes, cut, start);
    const patch: Record<string, unknown> = { notes: nextNotes };
    if (colsOk) {
      patch.advance_monthly_cut = cut;
      patch.advance_repay_start_month = start;
    }
    if (nextNotes !== e.notes || colsOk) {
      const { error } = await getSupabaseAdmin().from("employees").update(patch).eq("id", e.id);
      if (error) console.error("employee update", e.id, error.message);
      else console.log(`plan ok: ${e.name} cut=${cut} start=${start}`);
    } else {
      console.log(`plan zaten notes’ta: ${e.name}`);
    }
  }

  const { data: extraRows, error: exErr } = await getSupabaseAdmin()
    .from("salary_extras")
    .select("*");
  if (exErr) throw exErr;
  const extras = (extraRows ?? []).map((r) => salaryExtraFromRow(r as Record<string, unknown>));

  const refreshedEmps = (
    await getSupabaseAdmin().from("employees").select("*").eq("status", "active")
  ).data;
  const emps2: Employee[] = (refreshedEmps ?? []).map((r) =>
    employeeFromRow(r as Record<string, unknown>),
  );

  const nextExtras = reconcileAdvanceCutsForAllEmployees(emps2, extras);
  const beforeIds = new Set(extras.map((e) => e.id));
  const afterById = new Map(nextExtras.map((e) => [e.id, e]));

  let upserts = 0;
  let deletes = 0;
  for (const e of nextExtras) {
    const prev = extras.find((x) => x.id === e.id);
    if (
      !prev ||
      prev.amount !== e.amount ||
      prev.description !== e.description ||
      prev.month !== e.month
    ) {
      const { error } = await getSupabaseAdmin()
        .from("salary_extras")
        .upsert(salaryExtraToRow(e), { onConflict: "id" });
      if (error) console.error("upsert", e.id, error.message);
      else upserts += 1;
    }
  }
  for (const id of beforeIds) {
    if (!afterById.has(id) && id.startsWith("se-advcut-")) {
      const { error } = await getSupabaseAdmin().from("salary_extras").delete().eq("id", id);
      if (error) console.error("delete", id, error.message);
      else deletes += 1;
    }
  }
  console.log(`salary_extras upsert=${upserts} delete_stale_auto=${deletes}`);
  console.log(
    "plans:",
    emps2
      .filter((e) => parseAdvancePlanFromNotes(e.notes).cut || e.advanceMonthlyCut)
      .map((e) => `${e.name}:${e.advanceMonthlyCut ?? parseAdvancePlanFromNotes(e.notes).cut}@${e.advanceRepayStartMonth ?? parseAdvancePlanFromNotes(e.notes).start}`)
      .join(", ") || "(yok)",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
