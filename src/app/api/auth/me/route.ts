import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { enrichSessionForMainAdmin } from "@/lib/db/repository";

export async function GET() {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ user: null });
  }
  let session = await getSession();
  if (!session) return NextResponse.json({ user: null });
  session = await enrichSessionForMainAdmin(session);
  return NextResponse.json({
    user: {
      id: session.userId,
      username: session.username,
      name: session.name,
      role: session.role,
      employeeId: session.employeeId,
      brandId: session.brandId,
      organizationId: session.organizationId,
      orgRole: session.orgRole,
      brandIds: session.brandIds,
      avatar: session.avatar,
      pin: "",
      active: true,
      impersonatorId: session.impersonatorId,
      impersonatorName: session.impersonatorName,
    },
  });
}
