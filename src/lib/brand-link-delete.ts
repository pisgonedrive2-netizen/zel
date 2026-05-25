import { createNotificationPersisted } from "@/lib/notification-actions";
import { isPostOrLinkGoneError } from "@/lib/social-api/link-gone";
import { useAuth } from "@/store/auth";
import { useStore, type BrandLink } from "@/store/store";

export function confirmDeleteBrandLink(link: BrandLink, brandName?: string): boolean {
  const gone = isPostOrLinkGoneError(link.lastCheckError);
  const label = link.handle?.trim() || link.url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60);
  const brand = brandName ? ` (${brandName})` : "";
  if (gone) {
    return confirm(
      `“${label}”${brand} için gönderi artık mevcut değil görünüyor.\n\nLink hem izlenme panelinden hem yayıncı hesabından silinsin mi?`
    );
  }
  return confirm(
    `“${label}”${brand} linki silinsin mi?\n\nYayıncı panelinde de kaldırılır (sayfa yenilendiğinde).`
  );
}

/** Yönetici silme — store + Supabase + yayıncı bildirimi. */
export async function deleteBrandLinkAsAdmin(
  link: BrandLink,
  opts?: { brandName?: string; deletedByUserId?: string; skipConfirm?: boolean }
): Promise<boolean> {
  if (!opts?.skipConfirm && !confirmDeleteBrandLink(link, opts?.brandName)) return false;

  const { deleteBrandLink, brands } = useStore.getState();
  deleteBrandLink(link.id);

  const brandLabel =
    opts?.brandName ?? brands.find((b) => b.id === link.brandId)?.shortName ?? "Marka";
  const gone = isPostOrLinkGoneError(link.lastCheckError);

  if (link.ownerId) {
    const owner = useAuth.getState().users.find((u) => u.employeeId === link.ownerId);
    if (owner) {
      await createNotificationPersisted({
        type: "general",
        title: "Marka linki kaldırıldı",
        message: gone
          ? `${brandLabel} · ${link.platform}: Gönderi artık mevcut değil; link yönetici tarafından silindi.`
          : `${brandLabel} · ${link.platform}: Link yönetici tarafından silindi.`,
        forRole: "streamer",
        forUserId: owner.id,
        refId: link.id,
        triggeredBy: opts?.deletedByUserId,
        href: "/yayinci/marka-linkleri",
      });
    }
  }

  return true;
}
