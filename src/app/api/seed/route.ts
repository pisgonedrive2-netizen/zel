import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { countAppUsers, pickSnapshot, syncAppData, upsertAppUser } from "@/lib/db/repository";
import { useStore } from "@/store/store";

const SEED_USERS = [
  { id: "u-admin", username: "orkun", pin: "lanetkel2026", name: "Orkun Bey", role: "admin" as const, avatar: "O" },
  { id: "u-ramiz", username: "ramiz", pin: "ramiz1234", name: "Ramiz", role: "streamer" as const, employeeId: "emp-ramiz", avatar: "R" },
  { id: "u-lucy", username: "lucy", pin: "lucy1234", name: "Lucy", role: "streamer" as const, employeeId: "emp-lucy", avatar: "L" },
  { id: "u-acelya", username: "acelya", pin: "acelya1234", name: "Açelya", role: "streamer" as const, employeeId: "emp-acelya", avatar: "A" },
  { id: "u-denetci", username: "denetci", pin: "denetim2026", name: "Denetim Ekibi", role: "auditor" as const, avatar: "D" },
  { id: "u-brand-gala", username: "galabet", pin: "marka2026", name: "Galabet (Marka)", role: "brand" as const, brandId: "br-gala", avatar: "G" },
  { id: "u-brand-boffice", username: "betoffice", pin: "marka2026", name: "Betoffice (Marka)", role: "brand" as const, brandId: "br-boffice", avatar: "B" },
  { id: "u-brand-pipo", username: "betpipo", pin: "marka2026", name: "Betpipo (Marka)", role: "brand" as const, brandId: "br-pipo", avatar: "P" },
  { id: "u-brand-hit", username: "hitbet", pin: "marka2026", name: "Hitbet (Marka)", role: "brand" as const, brandId: "br-hit", avatar: "H" },
  { id: "u-brand-padi", username: "padisahbet", pin: "marka2026", name: "Padişahbet (Marka)", role: "brand" as const, brandId: "br-padi", avatar: "P" },
];

/** İlk kurulum — SEED_SECRET header ile çağrılır. */
export async function POST(req: Request) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const secret = req.headers.get("x-seed-secret");
  if (!secret || secret !== process.env.SEED_SECRET) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const count = await countAppUsers();
  if (count > 0) {
    return NextResponse.json({ error: "Veritabanı zaten dolu", count }, { status: 409 });
  }

  const adminSession = {
    userId: "u-admin",
    username: "orkun",
    name: "Orkun Bey",
    role: "admin" as const,
    avatar: "O",
  };

  for (const u of SEED_USERS) {
    await upsertAppUser(
      { ...u, pin: "", active: true },
      u.pin
    );
  }

  await syncAppData(
    adminSession,
    pickSnapshot(useStore.getState() as unknown as Record<string, unknown>)
  );

  return NextResponse.json({ ok: true, users: SEED_USERS.length });
}
