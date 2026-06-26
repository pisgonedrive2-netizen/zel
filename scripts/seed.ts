/**
 * Bir kere çalıştırılır: ilk veri + kullanıcılar.
 * Kullanım: npx tsx -r dotenv/config scripts/seed.ts dotenv_config_path=.env.local
 */
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import {
  initialEmployees, initialAdvances, initialSalaryExtras, initialPaymentStatuses,
  initialCompanies, initialSponsorTransactions, initialBrands, initialBrandLinks,
  initialKasaTransactions, initialContentExpenses,
  initialOrganizations, initialOrganizationMembers,
} from "../src/store/store";
import {
  employeeToRow, advanceToRow, salaryExtraToRow, paymentStatusToRow,
  companyToRow, sponsorTxToRow, brandToRow, brandLinkToRow,
  kasaToRow, contentExpenseToRow, appUserToRow,
  organizationToRow, organizationMemberToRow,
} from "../src/lib/db/mappers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY eksik");
  process.exit(1);
}

const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SEED_USERS = [
  { id: "u-admin",         username: "orkun",      pin: "lanetkel2026", name: "Orkun Bey",          role: "admin"    as const, avatar: "O" },
  { id: "u-ramiz",         username: "ramiz",      pin: "ramiz1234",    name: "Ramiz",              role: "streamer" as const, employeeId: "emp-ramiz", avatar: "R" },
  { id: "u-lucy",          username: "lucy",       pin: "lucy1234",     name: "Lucy",               role: "streamer" as const, employeeId: "emp-lucy",  avatar: "L" },
  { id: "u-acelya",        username: "acelya",     pin: "acelya1234",   name: "Açelya",             role: "streamer" as const, employeeId: "emp-acelya", avatar: "A" },
  { id: "u-denetci",       username: "denetci",    pin: "denetim2026",  name: "Denetim Ekibi",      role: "auditor"  as const, avatar: "D" },
  { id: "u-ediz",          username: "ediz",       pin: "ediz2026",     name: "Ediz",               role: "admin"    as const, avatar: "E" },
  { id: "u-brand-gala",    username: "galabet",    pin: "marka2026",    name: "Galabet (Marka)",    role: "brand"    as const, brandId: "br-gala",    avatar: "G" },
  { id: "u-brand-boffice", username: "betoffice",  pin: "marka2026",    name: "Betoffice (Marka)",  role: "brand"    as const, brandId: "br-boffice", avatar: "B" },
  { id: "u-brand-pipo",    username: "betpipo",    pin: "marka2026",    name: "Betpipo (Marka)",    role: "brand"    as const, brandId: "br-pipo",    avatar: "P" },
  { id: "u-brand-hit",     username: "hitbet",     pin: "marka2026",    name: "Hitbet (Marka)",     role: "brand"    as const, brandId: "br-hit",     avatar: "H" },
  { id: "u-brand-padi",    username: "padisahbet", pin: "marka2026",    name: "Padişahbet (Marka)", role: "brand"    as const, brandId: "br-padi",    avatar: "P" },
];

async function upsert(table: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  const { error } = await db.from(table).upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`✔ ${table}: ${rows.length}`);
}

async function main() {
  console.log("→ Supabase URL:", url);
  console.log("→ Veriler yazılıyor...");

  await upsert("organizations",        initialOrganizations.map(organizationToRow));
  await upsert("organization_members", initialOrganizationMembers.map(organizationMemberToRow));
  await upsert("employees",            initialEmployees.map(employeeToRow));
  await upsert("brands",               initialBrands.map(brandToRow));
  await upsert("external_companies",   initialCompanies.map(companyToRow));
  await upsert("advances",             initialAdvances.map(advanceToRow));
  await upsert("salary_extras",        initialSalaryExtras.map(salaryExtraToRow));
  await upsert("sponsor_transactions", initialSponsorTransactions.map(sponsorTxToRow));
  await upsert("brand_links",          initialBrandLinks.map(brandLinkToRow));
  await upsert("kasa_transactions",    initialKasaTransactions.map(kasaToRow));
  await upsert("content_expenses",     initialContentExpenses.map(contentExpenseToRow));

  const ps = initialPaymentStatuses.map(paymentStatusToRow);
  if (ps.length > 0) {
    const { error } = await db.from("payment_statuses").upsert(ps, { onConflict: "employee_id,month" });
    if (error) throw new Error(`payment_statuses: ${error.message}`);
    console.log(`✔ payment_statuses: ${ps.length}`);
  }

  for (const u of SEED_USERS) {
    const hash = await bcrypt.hash(u.pin, 10);
    const row = appUserToRow(
      { ...u, pin: "", active: true } as Parameters<typeof appUserToRow>[0],
      hash
    );
    const { error } = await db.from("app_users").upsert(row);
    if (error) throw new Error(`app_users ${u.username}: ${error.message}`);
  }
  console.log(`✔ app_users: ${SEED_USERS.length}`);

  console.log("\n✅ Seed tamamlandı.\n");
  console.log("Giriş bilgileri:");
  SEED_USERS.forEach((u) => console.log(`   ${u.username.padEnd(12)}  PIN: ${u.pin}  (${u.role})`));
}

main().catch((e) => {
  console.error("HATA:", e);
  process.exit(1);
});
