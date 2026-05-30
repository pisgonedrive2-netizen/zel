-- Foxstream — Marka ekip yönetimi: org rolüne "auditor" (marka denetçisi) ekle
--
-- Senaryo: Foxstream platformu (admin) en yetkilidir; her marka kendi
-- organizasyonu içinde ekip kurabilir. Marka sahibi (owner) yöneticisi (admin),
-- denetçisi (auditor) ve işlevsel rolleri (finance/marketing/hr/viewer) atayabilir.
-- "auditor" salt-okunur denetim rolüdür; veri göremez yerine veriyi görür, yazamaz
-- (yazma kilidi uygulama katmanında org-access.ts ile uygulanır).

ALTER TABLE public.organization_members
  DROP CONSTRAINT IF EXISTS organization_members_org_role_check;

ALTER TABLE public.organization_members
  ADD CONSTRAINT organization_members_org_role_check
  CHECK (org_role IN ('owner', 'admin', 'finance', 'marketing', 'hr', 'viewer', 'auditor'));

COMMENT ON COLUMN public.organization_members.org_role IS
  'Org içi rol: owner/admin (yönetim), finance/marketing/hr (işlevsel), viewer (salt görüntüleme), auditor (salt-okunur denetim).';

NOTIFY pgrst, 'reload schema';
