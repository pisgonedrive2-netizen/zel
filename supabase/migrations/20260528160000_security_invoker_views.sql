-- Faz C ek düzeltme: affiliate_partner_totals view'ini security_invoker yap.
-- Aksi halde view, oluşturan rolün haklarıyla çalışır (SECURITY DEFINER default) →
-- RLS bypass riski. Faz D'de brand-scoped policy eklenmeden önce bunu kapatıyoruz.

ALTER VIEW public.affiliate_partner_totals SET (security_invoker = true);

COMMENT ON VIEW public.affiliate_partner_totals IS
  'Partner başına aylık toplam (clicks/registrations/ftd/commission). security_invoker=true; brand-scoped RLS faz D''de ekleneceğinden şimdilik service-role ile okunur.';
