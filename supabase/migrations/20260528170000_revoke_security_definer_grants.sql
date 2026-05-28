-- Faz H ek düzeltme: SECURITY DEFINER trigger fonksiyonlarını PostgREST
-- (anon + authenticated) için kapat. Bu fonksiyonlar sadece trigger ile veya
-- service-role RPC ile çağrılır — REST üzerinden expose edilmemeli.

REVOKE EXECUTE ON FUNCTION public.recompute_deal_post_metrics(text)
  FROM anon, authenticated, public;

REVOKE EXECUTE ON FUNCTION public.tr_brand_posts_recompute_metrics()
  FROM anon, authenticated, public;
