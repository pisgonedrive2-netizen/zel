import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";

export async function GET() {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ user: null });
  }
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null });
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
    },
  });
}
