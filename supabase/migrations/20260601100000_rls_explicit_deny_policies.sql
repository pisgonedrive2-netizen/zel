-- Foxstream — RLS: açık "service_role only" politikaları (explicit deny dokümantasyonu)
--
-- NEDEN BU MIGRATION?
-- Uygulama Supabase'e YALNIZCA service_role anahtarı ile (Next.js API route'ları
-- üzerinden, sunucu tarafında) yazar/okur. İstemci tarafında anon veya authenticated
-- anahtar ile doğrudan PostgREST erişimi KULLANILMAZ.
--
-- Mevcut migration'larda tüm tablolarda `ENABLE ROW LEVEL SECURITY` var ancak hiçbir
-- `CREATE POLICY` tanımı yoktu. PostgreSQL'de "RLS açık + policy yok" durumu, RLS'e
-- tabi roller (anon, authenticated) için TÜM satır erişimini reddeder (varsayılan deny).
-- service_role ise BYPASSRLS özniteliğine sahip olduğundan RLS'i atlar ve normal çalışır.
-- Yani sistem zaten güvenliydi; ancak bu durum örtük (implicit) olduğu için güvenlik
-- review'lerinde net görünmüyordu.
--
-- Bu migration ne yapar?
--   1. İlgili her tabloda RLS'in etkin olduğunu garanti eder (idempotent ALTER ... ENABLE).
--   2. Her tablo için TEK ve AÇIK bir politika tanımlar:
--        service_role_all_<table>  → FOR ALL TO service_role USING (true) WITH CHECK (true)
--      Böylece "yalnız service_role erişebilir" niyeti kod tabanında ve pg_policies'te
--      açıkça belgelenmiş olur.
--   3. anon / authenticated rolleri için BİLİNÇLİ olarak hiçbir politika tanımlanmaz.
--      Politika olmaması = bu roller için erişim reddi (deny-by-default). İstenen davranış budur.
--
-- NOT: service_role zaten RLS'i bypass ettiği için bu politika fonksiyonel olarak
-- davranışı değiştirmez; amacı güvenlik duruşunu AÇIK ve denetlenebilir kılmaktır.
-- Tüm DDL idempotent'tir (DROP POLICY IF EXISTS ardından CREATE POLICY).

-- ─────────────────────────────────────────────────────────────────────────────
-- Yardımcı: aşağıdaki blok her tablo için aynı deseni izler.
--   ALTER TABLE public.<t> ENABLE ROW LEVEL SECURITY;            -- idempotent
--   DROP POLICY IF EXISTS "service_role_all_<t>" ON public.<t>;  -- idempotent
--   CREATE POLICY "service_role_all_<t>" ON public.<t>
--     FOR ALL TO service_role USING (true) WITH CHECK (true);
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════════
-- 1) initial_schema (20260515120000_initial_schema.sql) — RLS açık çekirdek tablolar
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_app_users" ON public.app_users;
CREATE POLICY "service_role_all_app_users" ON public.app_users
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_employees" ON public.employees;
CREATE POLICY "service_role_all_employees" ON public.employees
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.advances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_advances" ON public.advances;
CREATE POLICY "service_role_all_advances" ON public.advances
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.salary_extras ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_salary_extras" ON public.salary_extras;
CREATE POLICY "service_role_all_salary_extras" ON public.salary_extras
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.payment_statuses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_payment_statuses" ON public.payment_statuses;
CREATE POLICY "service_role_all_payment_statuses" ON public.payment_statuses
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.external_companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_external_companies" ON public.external_companies;
CREATE POLICY "service_role_all_external_companies" ON public.external_companies
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.sponsor_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_sponsor_transactions" ON public.sponsor_transactions;
CREATE POLICY "service_role_all_sponsor_transactions" ON public.sponsor_transactions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.internal_projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_internal_projects" ON public.internal_projects;
CREATE POLICY "service_role_all_internal_projects" ON public.internal_projects
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.expense_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_expense_entries" ON public.expense_entries;
CREATE POLICY "service_role_all_expense_entries" ON public.expense_entries
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.planned_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_planned_items" ON public.planned_items;
CREATE POLICY "service_role_all_planned_items" ON public.planned_items
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.streamer_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_streamer_accounts" ON public.streamer_accounts;
CREATE POLICY "service_role_all_streamer_accounts" ON public.streamer_accounts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.schedule_slots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_schedule_slots" ON public.schedule_slots;
CREATE POLICY "service_role_all_schedule_slots" ON public.schedule_slots
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_brands" ON public.brands;
CREATE POLICY "service_role_all_brands" ON public.brands
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.brand_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_brand_links" ON public.brand_links;
CREATE POLICY "service_role_all_brand_links" ON public.brand_links
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.link_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_link_snapshots" ON public.link_snapshots;
CREATE POLICY "service_role_all_link_snapshots" ON public.link_snapshots
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.brand_viewership ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_brand_viewership" ON public.brand_viewership;
CREATE POLICY "service_role_all_brand_viewership" ON public.brand_viewership
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.kasa_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_kasa_transactions" ON public.kasa_transactions;
CREATE POLICY "service_role_all_kasa_transactions" ON public.kasa_transactions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.content_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_content_expenses" ON public.content_expenses;
CREATE POLICY "service_role_all_content_expenses" ON public.content_expenses
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.weekly_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_weekly_plans" ON public.weekly_plans;
CREATE POLICY "service_role_all_weekly_plans" ON public.weekly_plans
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.week_brand_reels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_week_brand_reels" ON public.week_brand_reels;
CREATE POLICY "service_role_all_week_brand_reels" ON public.week_brand_reels
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_app_notifications" ON public.app_notifications;
CREATE POLICY "service_role_all_app_notifications" ON public.app_notifications
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_audit_logs" ON public.audit_logs;
CREATE POLICY "service_role_all_audit_logs" ON public.audit_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ═════════════════════════════════════════════════════════════════════════════
-- 2) notification_settings (20260515160000)
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_app_settings" ON public.app_settings;
CREATE POLICY "service_role_all_app_settings" ON public.app_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_notification_preferences" ON public.notification_preferences;
CREATE POLICY "service_role_all_notification_preferences" ON public.notification_preferences
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ═════════════════════════════════════════════════════════════════════════════
-- 3) link_auto_refresh (20260519140000)
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.api_quota_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_api_quota_usage" ON public.api_quota_usage;
CREATE POLICY "service_role_all_api_quota_usage" ON public.api_quota_usage
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.api_refresh_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_api_refresh_runs" ON public.api_refresh_runs;
CREATE POLICY "service_role_all_api_refresh_runs" ON public.api_refresh_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ═════════════════════════════════════════════════════════════════════════════
-- 4) affiliate_tracking (20260528130000)
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.affiliate_partners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_affiliate_partners" ON public.affiliate_partners;
CREATE POLICY "service_role_all_affiliate_partners" ON public.affiliate_partners
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.affiliate_daily_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_affiliate_daily_stats" ON public.affiliate_daily_stats;
CREATE POLICY "service_role_all_affiliate_daily_stats" ON public.affiliate_daily_stats
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_affiliate_payouts" ON public.affiliate_payouts;
CREATE POLICY "service_role_all_affiliate_payouts" ON public.affiliate_payouts
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ═════════════════════════════════════════════════════════════════════════════
-- 5) planned_items_enhanced (20260518140000)
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.planned_item_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_planned_item_payments" ON public.planned_item_payments;
CREATE POLICY "service_role_all_planned_item_payments" ON public.planned_item_payments
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ═════════════════════════════════════════════════════════════════════════════
-- 6) multi_kasa (20260518150000)
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.kasas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_kasas" ON public.kasas;
CREATE POLICY "service_role_all_kasas" ON public.kasas
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ═════════════════════════════════════════════════════════════════════════════
-- 7) ic_gelir_brand_schedules (20260518120000)
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.internal_project_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_internal_project_payments" ON public.internal_project_payments;
CREATE POLICY "service_role_all_internal_project_payments" ON public.internal_project_payments
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ═════════════════════════════════════════════════════════════════════════════
-- 8) brand_registration_requests (20260528120000)
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.brand_registration_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_brand_registration_requests" ON public.brand_registration_requests;
CREATE POLICY "service_role_all_brand_registration_requests" ON public.brand_registration_requests
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ═════════════════════════════════════════════════════════════════════════════
-- 9) streamer_pool_and_offers (20260528140000)
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.streamer_pool_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_streamer_pool_profiles" ON public.streamer_pool_profiles;
CREATE POLICY "service_role_all_streamer_pool_profiles" ON public.streamer_pool_profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.brand_offers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_brand_offers" ON public.brand_offers;
CREATE POLICY "service_role_all_brand_offers" ON public.brand_offers
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.brand_offer_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_brand_offer_messages" ON public.brand_offer_messages;
CREATE POLICY "service_role_all_brand_offer_messages" ON public.brand_offer_messages
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ═════════════════════════════════════════════════════════════════════════════
-- 10) brand_deals_and_posts (20260528150000)
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.brand_deals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_brand_deals" ON public.brand_deals;
CREATE POLICY "service_role_all_brand_deals" ON public.brand_deals
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.brand_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_brand_posts" ON public.brand_posts;
CREATE POLICY "service_role_all_brand_posts" ON public.brand_posts
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ═════════════════════════════════════════════════════════════════════════════
-- 11) brand_monthly_stats (20260519120000)
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.brand_monthly_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_brand_monthly_stats" ON public.brand_monthly_stats;
CREATE POLICY "service_role_all_brand_monthly_stats" ON public.brand_monthly_stats
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ═════════════════════════════════════════════════════════════════════════════
-- 12) Faz 0 — organizations (20260531120000)  [B2B multi-tenant]
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_organizations" ON public.organizations;
CREATE POLICY "service_role_all_organizations" ON public.organizations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_organization_members" ON public.organization_members;
CREATE POLICY "service_role_all_organization_members" ON public.organization_members
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.organization_member_brands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_organization_member_brands" ON public.organization_member_brands;
CREATE POLICY "service_role_all_organization_member_brands" ON public.organization_member_brands
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ═════════════════════════════════════════════════════════════════════════════
-- 13) Faz 2 — streamer_registration_requests (20260531130000)  [B2B]
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.streamer_registration_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_streamer_registration_requests" ON public.streamer_registration_requests;
CREATE POLICY "service_role_all_streamer_registration_requests" ON public.streamer_registration_requests
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ═════════════════════════════════════════════════════════════════════════════
-- 14) Faz 3 — brand_personnel / brand_staff* (20260531140000)  [B2B]
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.brand_staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_brand_staff" ON public.brand_staff;
CREATE POLICY "service_role_all_brand_staff" ON public.brand_staff
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.brand_staff_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_brand_staff_tasks" ON public.brand_staff_tasks;
CREATE POLICY "service_role_all_brand_staff_tasks" ON public.brand_staff_tasks
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.brand_staff_shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_brand_staff_shifts" ON public.brand_staff_shifts;
CREATE POLICY "service_role_all_brand_staff_shifts" ON public.brand_staff_shifts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.brand_staff_activity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_brand_staff_activity" ON public.brand_staff_activity;
CREATE POLICY "service_role_all_brand_staff_activity" ON public.brand_staff_activity
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ═════════════════════════════════════════════════════════════════════════════
-- 15) Faz 4 — crm_module / crm_* (20260531150000)  [B2B]
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_crm_contacts" ON public.crm_contacts;
CREATE POLICY "service_role_all_crm_contacts" ON public.crm_contacts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.crm_deals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_crm_deals" ON public.crm_deals;
CREATE POLICY "service_role_all_crm_deals" ON public.crm_deals
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.crm_interactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_crm_interactions" ON public.crm_interactions;
CREATE POLICY "service_role_all_crm_interactions" ON public.crm_interactions
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ═════════════════════════════════════════════════════════════════════════════
-- 16) Faz 5 — brand_accounting / brand_ledger* + brand_invoices (20260531160000)  [B2B]
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.brand_ledger_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_brand_ledger_entries" ON public.brand_ledger_entries;
CREATE POLICY "service_role_all_brand_ledger_entries" ON public.brand_ledger_entries
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.brand_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_brand_invoices" ON public.brand_invoices;
CREATE POLICY "service_role_all_brand_invoices" ON public.brand_invoices
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- PostgREST şema önbelleğini yenile.
-- ─────────────────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
