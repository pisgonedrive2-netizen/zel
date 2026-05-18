-- Supabase security advisor cleanup.
-- App data tables intentionally have RLS enabled with no client policies:
-- all access goes through Next.js API routes using service_role.

ALTER FUNCTION public.set_updated_at() SET search_path = '';
ALTER FUNCTION public.sum_approved_content_expenses(text, text) SET search_path = '';
ALTER FUNCTION public.pending_expense_count() SET search_path = '';
ALTER FUNCTION public.calc_kasa_balance(timestamptz) SET search_path = '';

DROP POLICY IF EXISTS "proofs_public_read" ON storage.objects;
