import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession, type SessionPayload } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { upsertBrandLinksMerged } from "@/lib/db/repository";
import {
  persistContentExpenseRow,
  persistSalaryExtraRow,
} from "@/lib/content-expense-sync";
import {
  scheduleSlotFromRow,
  scheduleSlotToRow,
  brandLinkFromRow,
  brandLinkToRow,
  linkSnapshotFromRow,
  linkSnapshotToRow,
  viewershipFromRow,
  viewershipToRow,
  weeklyPlanFromRow,
  weeklyPlanToRow,
  weekBrandReelFromRow,
  weekBrandReelToRow,
  streamerAccountFromRow,
  streamerAccountToRow,
  employeeFromRow,
  salaryExtraFromRow,
  contentExpenseFromRow,
} from "@/lib/db/mappers";
import { normalizeWeeklyPlanInput } from "@/lib/weekly-plan-normalize";
import type {
  ScheduleSlot,
  BrandLink,
  LinkSnapshot,
  BrandViewership,
  WeeklyPlan,
  WeekBrandReel,
  StreamerAccount,
  ContentExpense,
  SalaryExtra,
} from "@/store/store";

function contentExpenseFromPayload(row: Record<string, unknown>): ContentExpense {
  if (row.employeeId != null) return row as unknown as ContentExpense;
  return contentExpenseFromRow(row);
}

function salaryExtraFromPayload(row: Record<string, unknown>): SalaryExtra {
  if (row.employeeId != null) return row as unknown as SalaryExtra;
  return salaryExtraFromRow(row);
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EntityKey =
  | "schedule_slot"
  | "brand_link"
  | "link_snapshot"
  | "brand_viewership"
  | "weekly_plan"
  | "week_brand_reel"
  | "streamer_account"
  | "content_expense"
  | "salary_extra";

function canWriteAdmin(session: SessionPayload) {
  return session.role === "admin";
}

function assertStreamerOwns(
  session: SessionPayload,
  employeeId: string | undefined | null
): boolean {
  return session.role === "streamer" && !!session.employeeId && session.employeeId === employeeId;
}

async function authorizeWrite(
  entity: EntityKey,
  session: SessionPayload,
  row: Record<string, unknown>
): Promise<string | null> {
  if (canWriteAdmin(session)) return null;

  if (session.role === "auditor") return "Denetçi salt okunur";

  if (session.role === "streamer" && session.employeeId) {
    switch (entity) {
      case "schedule_slot": {
        const s = scheduleSlotFromRow(row);
        return assertStreamerOwns(session, s.employeeId) ? null : "Yetki yok";
      }
      case "brand_link": {
        const l = brandLinkFromRow(row);
        return l.ownerId === session.employeeId ? null : "Yetki yok";
      }
      case "link_snapshot":
        return null;
      case "brand_viewership": {
        const v = viewershipFromRow(row);
        return !v.employeeId || v.employeeId === session.employeeId ? null : "Yetki yok";
      }
      case "weekly_plan": {
        const p = weeklyPlanFromRow(row);
        return p.employeeId === session.employeeId ? null : "Yetki yok";
      }
      case "week_brand_reel": {
        const r = weekBrandReelFromRow(row);
        return r.employeeId === session.employeeId ? null : "Yetki yok";
      }
      case "streamer_account": {
        const a = streamerAccountFromRow(row);
        return a.employeeId === session.employeeId ? null : "Yetki yok";
      }
      case "content_expense": {
        const e = contentExpenseFromRow(row);
        return e.employeeId === session.employeeId ? null : "Yetki yok";
      }
      case "salary_extra":
        return "Yetki yok";
      default:
        return "Yetki yok";
    }
  }

  return "Bu işlem için yetki yok";
}

/** POST — tek satır upsert. */
export async function POST(req: Request) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum gerekli — lütfen tekrar giriş yapın" }, { status: 401 });
  }

  const body = (await req.json()) as { entity?: EntityKey; row?: Record<string, unknown> };
  const entity = body.entity;
  const row = body.row;
  if (!entity || !row?.id) {
    return NextResponse.json({ error: "entity ve row.id gerekli" }, { status: 400 });
  }

  const authErr = await authorizeWrite(entity, session, row);
  if (authErr) {
    return NextResponse.json({ error: authErr }, { status: 403 });
  }

  const db = getSupabaseAdmin();

  try {
    switch (entity) {
      case "schedule_slot": {
        const slot = scheduleSlotFromRow(row) as ScheduleSlot;
        const { error } = await db
          .from("schedule_slots")
          .upsert(scheduleSlotToRow(slot), { onConflict: "id" });
        if (error) throw new Error(error.message);
        break;
      }
      case "brand_link": {
        const link = brandLinkFromRow(row) as BrandLink;
        await upsertBrandLinksMerged([link], []);
        break;
      }
      case "link_snapshot": {
        const snap = linkSnapshotFromRow(row) as LinkSnapshot;
        if (session.role === "streamer" && session.employeeId) {
          const { data: linkRow } = await db
            .from("brand_links")
            .select("owner_id")
            .eq("id", snap.linkId)
            .maybeSingle();
          const ownerId = (linkRow as { owner_id?: string | null } | null)?.owner_id;
          if (ownerId !== session.employeeId) {
            return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
          }
        }
        const { error } = await db
          .from("link_snapshots")
          .upsert(linkSnapshotToRow(snap), { onConflict: "id" });
        if (error) throw new Error(error.message);
        break;
      }
      case "brand_viewership": {
        const v = viewershipFromRow(row) as BrandViewership;
        const { error } = await db
          .from("brand_viewership")
          .upsert(viewershipToRow(v), { onConflict: "id" });
        if (error) throw new Error(error.message);
        break;
      }
      case "weekly_plan": {
        const p = weeklyPlanFromRow(row) as WeeklyPlan;
        const [{ data: empRows, error: empErr }, { data: accRows, error: accErr }] =
          await Promise.all([
            db.from("employees").select("*"),
            db.from("streamer_accounts").select("*"),
          ]);
        if (empErr) throw new Error(empErr.message);
        if (accErr) throw new Error(accErr.message);
        const employees = (empRows ?? []).map((r) =>
          employeeFromRow(r as Record<string, unknown>)
        );
        const streamerAccounts = (accRows ?? []).map((r) =>
          streamerAccountFromRow(r as Record<string, unknown>)
        );
        const planInput =
          session.role === "streamer" && session.employeeId
            ? { ...p, employeeId: session.employeeId }
            : p;
        const normalized = normalizeWeeklyPlanInput(planInput, {
          employees,
          fallbackEmployeeId: session.employeeId ?? p.employeeId,
          streamerAccounts,
        });
        if (!normalized) {
          return NextResponse.json(
            { error: "Geçersiz yayıncı veya plan tarihi — yayıncı listesinden seçin." },
            { status: 400 }
          );
        }
        let createdBy = normalized.createdBy ?? null;
        if (createdBy) {
          const { data: u } = await db
            .from("app_users")
            .select("id")
            .eq("id", createdBy)
            .maybeSingle();
          if (!u) createdBy = session.userId;
        }
        const safe: WeeklyPlan = {
          ...normalized,
          id: p.id,
          createdBy: createdBy ?? undefined,
        };
        const { error } = await db
          .from("weekly_plans")
          .upsert(weeklyPlanToRow(safe), { onConflict: "id" });
        if (error) throw new Error(error.message);
        break;
      }
      case "week_brand_reel": {
        const r = weekBrandReelFromRow(row) as WeekBrandReel;
        const { error } = await db
          .from("week_brand_reels")
          .upsert(weekBrandReelToRow(r), { onConflict: "id" });
        if (error) throw new Error(error.message);
        break;
      }
      case "streamer_account": {
        const a = streamerAccountFromRow(row) as StreamerAccount;
        const { error } = await db
          .from("streamer_accounts")
          .upsert(streamerAccountToRow(a), { onConflict: "id" });
        if (error) throw new Error(error.message);
        break;
      }
      case "content_expense": {
        await persistContentExpenseRow(contentExpenseFromPayload(row));
        break;
      }
      case "salary_extra": {
        if (!canWriteAdmin(session)) {
          return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
        }
        await persistSalaryExtraRow(salaryExtraFromPayload(row));
        break;
      }
      default:
        return NextResponse.json({ error: "Bilinmeyen entity" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, id: String(row.id) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Kayıt hatası";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** DELETE — tek satır sil. */
export async function DELETE(req: Request) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum gerekli — lütfen tekrar giriş yapın" }, { status: 401 });
  }

  const entity = new URL(req.url).searchParams.get("entity") as EntityKey | null;
  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!entity || !id) {
    return NextResponse.json({ error: "entity ve id gerekli" }, { status: 400 });
  }

  if (!canWriteAdmin(session) && session.role !== "streamer") {
    return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
  }

  const db = getSupabaseAdmin();

  try {
    if (session.role === "streamer" && session.employeeId) {
      const eid = session.employeeId;
      switch (entity) {
        case "schedule_slot": {
          const { data } = await db.from("schedule_slots").select("employee_id").eq("id", id).maybeSingle();
          if (!data || String((data as { employee_id: string }).employee_id) !== eid) {
            return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
          }
          break;
        }
        case "brand_link": {
          const { data } = await db.from("brand_links").select("owner_id").eq("id", id).maybeSingle();
          if (!data || String((data as { owner_id: string }).owner_id) !== eid) {
            return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
          }
          break;
        }
        case "weekly_plan": {
          const { data } = await db.from("weekly_plans").select("employee_id").eq("id", id).maybeSingle();
          if (!data || String((data as { employee_id: string }).employee_id) !== eid) {
            return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
          }
          break;
        }
        case "week_brand_reel": {
          const { data } = await db.from("week_brand_reels").select("employee_id").eq("id", id).maybeSingle();
          if (!data || String((data as { employee_id: string }).employee_id) !== eid) {
            return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
          }
          break;
        }
        case "streamer_account": {
          const { data } = await db.from("streamer_accounts").select("employee_id").eq("id", id).maybeSingle();
          if (!data || String((data as { employee_id: string }).employee_id) !== eid) {
            return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
          }
          break;
        }
        case "content_expense": {
          const { data } = await db.from("content_expenses").select("employee_id").eq("id", id).maybeSingle();
          if (!data || String((data as { employee_id: string }).employee_id) !== eid) {
            return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
          }
          break;
        }
        case "link_snapshot":
        case "brand_viewership":
          return NextResponse.json({ error: "Silme için yönetici gerekli" }, { status: 403 });
        default:
          return NextResponse.json({ error: "Bilinmeyen entity" }, { status: 400 });
      }
    }

    const tableMap: Record<EntityKey, string> = {
      schedule_slot: "schedule_slots",
      brand_link: "brand_links",
      link_snapshot: "link_snapshots",
      brand_viewership: "brand_viewership",
      weekly_plan: "weekly_plans",
      week_brand_reel: "week_brand_reels",
      streamer_account: "streamer_accounts",
      content_expense: "content_expenses",
      salary_extra: "salary_extras",
    };
    const table = tableMap[entity];
    if (!table) {
      return NextResponse.json({ error: "Bilinmeyen entity" }, { status: 400 });
    }
    if (entity === "brand_link" && canWriteAdmin(session)) {
      await db.from("link_snapshots").delete().eq("link_id", id);
    }
    const { error } = await db.from(table).delete().eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Silme hatası";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
