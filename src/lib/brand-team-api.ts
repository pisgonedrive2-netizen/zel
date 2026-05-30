import type { OrgTeamMember } from "@/lib/db/org-team-repo";
import type { OrgRole } from "@/store/store";

async function jsonOrThrow<T>(res: Response, fallback: string): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `${fallback} (${res.status})`);
  return data;
}

export interface TeamResponse {
  members: OrgTeamMember[];
  brandIds: string[];
  canManage: boolean;
}

export async function fetchTeam(brandId?: string): Promise<TeamResponse> {
  const qs = brandId ? `?brandId=${encodeURIComponent(brandId)}` : "";
  const res = await fetch(`/api/marka/ekip${qs}`, { credentials: "include", cache: "no-store" });
  return jsonOrThrow<TeamResponse>(res, "Ekip alınamadı");
}

export interface CreateTeamMemberInput {
  name: string;
  username?: string;
  orgRole: OrgRole;
  title?: string;
  scopeAllBrands?: boolean;
  brandIds?: string[];
}

export async function createTeamMember(
  input: CreateTeamMemberInput
): Promise<{ userId: string; username: string; memberId: string; plainPin: string }> {
  const res = await fetch("/api/marka/ekip", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return jsonOrThrow(res, "Üye oluşturulamadı");
}

export interface UpdateTeamMemberInput {
  memberId: string;
  orgRole?: OrgRole;
  title?: string;
  active?: boolean;
  scopeAllBrands?: boolean;
  brandIds?: string[];
  resetPin?: boolean;
}

export async function updateTeamMember(
  input: UpdateTeamMemberInput
): Promise<{ plainPin?: string }> {
  const res = await fetch("/api/marka/ekip", {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return jsonOrThrow(res, "Üye güncellenemedi");
}

export async function removeTeamMember(memberId: string): Promise<void> {
  const res = await fetch(`/api/marka/ekip?memberId=${encodeURIComponent(memberId)}`, {
    method: "DELETE",
    credentials: "include",
  });
  await jsonOrThrow<{ ok: boolean }>(res, "Üye kaldırılamadı");
}
