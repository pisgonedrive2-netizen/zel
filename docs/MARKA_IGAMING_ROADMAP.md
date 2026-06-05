# Marka Dashboard — iGaming Program Yol Haritası (TODO)

> **Amaç:** Foxstream marka portalını (`/marka/*`) çok kiracılı, operatör entegrasyonlu, affiliate + içerik + finans + uyumluluk katmanları olan tam kapsamlı bir **iGaming partner programı** haline getirmek.  
> **Referans:** Mevcut sayfalar (`marka-subnav`), Supabase tabloları (`brands`, `brand_monthly_stats`, `brand_deals`, `crm_*`, `brand_payroll_*`, …) ve `docs/B2B_ROADMAP.md`.

Durum etiketleri: `[Mevcut]` · `[Kısmi]` · `[Yeni]` · `[Supabase]` · `[API]` · `[UI]`

---

## 0. Platform omurgası (tüm sayfalar için ortak)

### 0.1 Multi-tenant & güvenlik
- [ ] `[Supabase]` RLS: marka kullanıcısı yalnızca `organization_member_brands` + `session.brandId` kapsamındaki satırları okur/yazar
- [ ] `[Supabase]` `brand_api_keys` — operatör webhook / REST için marka başına anahtar, scope, rotate, audit
- [ ] `[Supabase]` `brand_audit_log` — kritik işlemler (KPI düzenleme, ödeme onayı, kullanıcı daveti)
- [ ] `[API]` Org capability matrisi genişletme: `compliance`, `affiliate_api`, `streamer_contracts`, `bonus_ops`
- [ ] `[UI]` Marka içi rol şablonları: Owner, Marketing, Affiliate Manager, Finance, HR, Viewer (salt okunur)

### 0.2 iGaming çekirdek veri modeli (yeni tablolar)
- [ ] `[Supabase]` `brand_operators` — markanın bağlı olduğu lisanslı operatör(ler), API endpoint, para birimi
- [ ] `[Supabase]` `brand_player_events` — kayıt, FTD, deposit, withdrawal, chargeback (günlük/oyuncu bazlı agregat)
- [ ] `[Supabase]` `brand_affiliate_stats` — click, registration, FTD, active players, GGR/NGR, commission (gün/affiliate/kampanya)
- [ ] `[Supabase]` `brand_campaigns` — bonus, turnuva, landing, promo kod, CPA/RevShare kuralları
- [ ] `[Supabase]` `brand_compliance_checks` — KYC durumu, restricted geo, responsible gaming bayrakları
- [ ] `[Supabase]` `brand_kpi_targets` — aylık hedef (FTD, deposit, NGR, içerik teslim, affiliate ROI)
- [ ] `[Supabase]` Realtime: `brand_notifications` kanalı + kritik KPI eşikleri (Supabase Realtime veya pg_notify)

### 0.3 Entegrasyon katmanı
- [ ] `[API]` Operatör webhook alıcıları: `POST /api/marka/webhooks/{operatorId}/registrations|deposits|ftd`
- [ ] `[API]` Zamanlanmış ETL: Vercel Cron → ham CSV/SFTP → `brand_player_events` normalize
- [ ] `[API]` Idempotent import batch (`import_batch_id`, duplicate guard)
- [ ] `[UI]` Entegrasyon sağlık paneli: son sync, hata satırı, yeniden dene

---

## 1. Anasayfa (`/marka/anasayfa`)

**Mevcut:** KPI kartları, aylık trend, aktivite feed, getting started, modül grid, içerik özeti.

### 1.1 Executive iGaming özeti
- [ ] `[UI]` Tek ekran: **FTD · Aktif oyuncu · Deposit · Withdrawal · NGR · Komisyon** (seçili ay + önceki ay Δ%)
- [ ] `[UI]` **Affiliate funnel:** tıklama → kayıt → FTD → 30g retention (mini funnel chart)
- [ ] `[UI]` **İçerik ROI:** harcanan influencer bütçe vs attribute edilen FTD/deposit (anlaşma + affiliate birleşik)
- [ ] `[Supabase]` Materialized view `mv_brand_dashboard_monthly` — hızlı anasayfa sorgusu
- [ ] `[UI]` Hedef vs gerçekleşen bar ( `brand_kpi_targets` )

### 1.2 Uyarılar & aksiyon kuyruğu
- [ ] `[UI]` “Bugün yapılacaklar”: bekleyen teklif, geciken teslimat, düşük demo bakiye, affiliate anomali
- [ ] `[API]` Eşik kuralları motoru (deposit düşüşü %X, FTD hedef altı)
- [ ] `[UI]` Marka özel duyuru bandı (kampanya launch, compliance deadline)

### 1.3 Kişiselleştirme
- [ ] `[UI]` Widget düzeni kaydet (`app_settings` marka scope)
- [ ] `[UI]` Çoklu marka holding görünümü (org `scopeAllBrands` → konsolide KPI)

---

## 2. Operasyon özeti (`/marka/operasyon`)

**Mevcut:** `brand_monthly_stats` — kayıt, yatırım, çekim, demo bakiye.

### 2.1 Operasyonel KPI derinliği
- [ ] `[Supabase]` Kolonlar: `active_players`, `churn_rate`, `arpu`, `arppu`, `bonus_cost`, `ggr`, `ngr`
- [ ] `[UI]` Günlük/haftalık granularite toggle (sadece ay değil)
- [ ] `[UI]` Segment kırılımı: kanal (affiliate / organic / influencer), ülke, cihaz
- [ ] `[API]` Operatörden otomatik doldurma; manuel override + audit trail

### 2.2 Canlı yayın & demo oyun
- [ ] `[Mevcut]` Demo bakiye tahsis — genişlet
- [ ] `[UI]` Demo tüketim grafiği, yayıncı bazlı demo kullanım (`brand_deals` + operasyon linki)
- [ ] `[Supabase]` `brand_live_sessions` — planlanan canlı, gerçekleşen süre, izleyici peak

### 2.3 Risk & fraud özeti
- [ ] `[UI]` Şüpheli deposit/withdrawal spike kartı
- [ ] `[Supabase]` `brand_risk_flags` — operatörden gelen risk skoru
- [ ] `[UI]` Compliance checklist tamamlanma %

---

## 3. Yayıncı havuzu (`/marka/havuz`)

**Mevcut:** Havuz profilleri, filtre, teklif başlatma.

### 3.1 iGaming uyumlu yayıncı keşfi
- [ ] `[UI]` Filtre: kategori (casino stream, spor, slots), dil, ülke kitle, min avg view, yasaklı içerik uyumu
- [ ] `[Supabase]` `streamer_pool_profiles.igaming_tags`, `restricted_markets[]`
- [ ] `[UI]` “Benzer yayıncılar” önerisi (embedding veya kural tabanlı)
- [ ] `[UI]` Geçmiş marka işbirliği skoru (teslim süresi, view performansı)

### 3.2 Uyumluluk & sözleşme ön kontrol
- [ ] `[UI]` Yayıncıya teklif öncesi checklist: 18+, disclosure, bonus kuralları
- [ ] `[Supabase]` `streamer_compliance_docs` — imzalı sözleşme PDF, expiry

---

## 4. Teklifler (`/marka/teklifler`)

**Mevcut:** `brand_offers`, mesajlaşma, durum akışı.

### 4.1 Kampanya tipleri (iGaming)
- [ ] `[UI]` Teklif şablonları: CPA launch, RevShare hybrid, fixed fee + performance kicker
- [ ] `[Supabase]` `brand_offer_templates` — marka bazlı şablon kütüphanesi
- [ ] `[UI]` Deliverable: X reel + Y stream + bonus kod mention + link in bio
- [ ] `[UI]` Bütçe tavanı, milestone ödemeleri (FTD hedefi → bonus ödeme)

### 4.2 Müzakere & onay
- [ ] `[Mevcut]` Mesaj thread — eklenti: dosya eki, counter-offer diff
- [ ] `[API]` Çok aşamalı onay (marketing → finance → owner)
- [ ] `[UI]` SLA: teklif yanıt süresi, otomatik expire bildirimi

---

## 5. Anlaşmalar (`/marka/anlasmalar`, `/marka/anlasmalar/[id]`)

**Mevcut:** `brand_deals`, deliverables, post sayısı trigger.

### 5.1 Aktif kampanya yönetimi
- [ ] `[UI]` Anlaşma kanban: draft → active → review → completed → disputed
- [ ] `[Supabase]` `brand_deal_milestones` — tarih, KPI, ödeme bağlantısı
- [ ] `[UI]` Performans paneli: planlanan vs gerçekleşen post/view/FTD attribution

### 5.2 Attribution (iGaming kritik)
- [ ] `[Supabase]` `brand_deal_tracking_links` — UTM, promo code, affiliate sub-id
- [ ] `[API]` Operatör raporu ile eşleştirme: hangi yayıncı hangi FTD’yi getirdi
- [ ] `[UI]` ROI tablosu: deal bütçe / attributed NGR / payback period

### 5.3 Sözleşme & faturalama bağlantısı
- [ ] `[UI]` Anlaşmadan otomatik `brand_ledger_entries` taslağı
- [ ] `[Supabase]` `brand_deal_invoices` — kısmi ödeme, avans, final

---

## 6. Yayıncı takvimi (`/marka/takvim`)

**Mevcut:** Partner planları, achievement, kişisel hesap senkronu.

### 6.1 Marka operasyon takvimi
- [ ] `[UI]` Kampanya launch günleri, bonus start/end, regulatory deadline overlay
- [ ] `[Supabase]` `brand_calendar_events` — marka scope, tip, hatırlatma
- [ ] `[UI]` Tüm partner yayıncıların içerik achievement ızgara (mevcut admin takvim mantığı marka scope)

### 6.2 Teslimat & SLA
- [ ] `[UI]` Anlaşma deliverable’ları takvim hücresinde
- [ ] `[API]` Gecikme bildirimi → `app_notifications.for_brand_id`
- [ ] `[UI]` “Kişisel hesaplardan tara” marka görünümünde (mevcut achievement sync)

---

## 7. İzlenmeler (`/marka/izlenmeler`)

**Mevcut:** `brand_links`, snapshots, RapidAPI otomatik yenileme.

### 7.1 Sosyal performans
- [ ] `[UI]` Marka + yayıncı linkleri konsolide; platform sağlık durumu
- [ ] `[UI]` Aylık view trend, en iyi içerik, engagement rate
- [ ] `[Supabase]` `link_performance_daily` — agregat snapshot (sorgu hızı)

### 7.2 iGaming landing & tracking
- [ ] `[UI]` Affiliate landing URL performansı (click → reg conversion)
- [ ] `[Supabase]` `brand_tracking_domains` — domain, SSL, redirect chain audit

---

## 8. Postlar (`/marka/postlar`)

**Mevcut:** `brand_posts`, metrik yenileme.

### 8.1 İçerik kütüphanesi
- [ ] `[UI]` Tüm partner postları grid: filtre platform, yayıncı, anlaşma, durum
- [ ] `[UI]` Toplu API metrik yenileme (marka kotası içinde)
- [ ] `[Supabase]` `brand_post_approvals` — yayın öncesi marka onayı workflow

### 8.2 Uyumluluk inceleme
- [ ] `[UI]` İçerik compliance flag: eksik #ad, yasaklı ifade, yaş sınırı uyarısı
- [ ] `[API]` Basit kural motoru + ileride AI moderation queue
- [ ] `[Supabase]` `brand_content_violations` — tip, severity, resolved_at

---

## 9. Affiliate (`/marka/affiliate`)

**Mevcut:** `affiliate_partners`, `affiliate_daily_stats`, dönemler.

### 9.1 Tam affiliate işletim sistemi
- [ ] `[Supabase]` `affiliate_tiers` — commission ladder, minimum FTD, carryover
- [ ] `[Supabase]` `affiliate_payouts` — dönem kapanışı, ödeme durumu, fatura ref
- [ ] `[UI]` Partner 360: click, reg, FTD, dep, GGR, commission, EPC, ROI
- [ ] `[UI]` Sub-affiliate / master affiliate ağacı

### 9.2 Kampanya & promosyon
- [ ] `[Supabase]` `affiliate_campaigns` — promo code, landing varyantı, geo allowlist
- [ ] `[UI]` A/B landing performansı
- [ ] `[API]` Operatör promo code API sync

### 9.3 Fraud & kalite
- [ ] `[UI]` Anomali: sahte FTD, duplicate device, incentive abuse
- [ ] `[Supabase]` `affiliate_quality_scores` — operatörden gelen skor
- [ ] `[UI]` Partner suspend / hold payout akışı

---

## 10. CRM (`/marka/crm`, `/marka/crm/[id]`)

**Mevcut:** `crm_contacts`, `crm_deals`, `crm_interactions`.

### 10.1 B2B partner pipeline (affiliate & influencer)
- [ ] `[UI]` Pipeline aşamaları: lead → qualified → contract → live → churn risk
- [ ] `[Supabase]` `crm_deals` genişletme: expected_monthly_ftd, commission_model
- [ ] `[UI]` Interaction timeline: call, email, Telegram, toplantı notu

### 10.2 Operatör & ajans ilişkileri
- [ ] `[UI]` CRM tipi: affiliate partner, media agency, streamer manager
- [ ] `[Supabase]` `crm_contracts` — renewal date, auto-renew, doc URL (Supabase Storage)

---

## 11. Personel (`/marka/personel`, `/marka/personel/[id]`)

**Mevcut:** `brand_staff`, görevler, vardiya, aktivite.

### 11.1 İç ekip (marka çalışanları)
- [ ] `[UI]` Organizasyon şeması, departman bazlı headcount maliyeti
- [ ] `[Supabase]` `brand_staff_compensation` — maaş, bonus, para birimi
- [ ] `[UI]` Performans KPI: handled deals, support tickets, campaign count

### 11.2 Yayıncı ≠ personel ayrımı
- [ ] `[UI]` Net UX: `brand_staff` (marka payroll) vs `employees` (Foxstream yayıncı partner)
- [ ] `[API]` Yetki: HR rolü personel görür, marketing yayıncı anlaşmalarını görür

---

## 12. Departmanlar (`/marka/departmanlar`)

**Mevcut:** `brand_departments`.

- [ ] `[UI]` Departman bütçe envelope (aylık marketing spend cap)
- [ ] `[Supabase]` `brand_department_budgets` — plan vs actual
- [ ] `[UI]` Departman → kampanya → anlaşma hiyerarşi ağacı
- [ ] `[UI]` Cost center raporu (P&L’e besleme)

---

## 13. Görev & Takip (`/marka/takip`)

**Mevcut:** `brand_staff_tasks`, `brand_staff_shifts`.

- [ ] `[UI]` Kampanya launch checklist şablonları (legal, creative, affiliate, ops)
- [ ] `[Supabase]` `brand_tasks` — marka geneli (sadece staff değil), assignee user_id
- [ ] `[UI]` Gantt / haftalık iş yükü görünümü
- [ ] `[API]` Slack/Telegram webhook — görev tamamlandı bildirimi
- [ ] `[Supabase]` `brand_sla_policies` — içerik onay SLA, affiliate payout SLA

---

## 14. Ekip & yetkiler (`/marka/ekip`)

**Mevcut:** Org üyeleri, davet, pasifleştirme.

- [ ] `[UI]` Davet akışı: e-posta + PIN, rol seçimi, marka scope
- [ ] `[Supabase]` `organization_member_permissions` — fine-grained JSON permissions
- [ ] `[UI]` Oturum geçmişi, 2FA (Supabase Auth MFA — marka kullanıcıları Auth’a taşınırsa)
- [ ] `[API]` SSO (SAML/OIDC) enterprise plan

---

## 15. Muhasebe (`/marka/muhasebe`)

**Mevcut:** `brand_ledger_entries`, P&L görünümü.

- [ ] `[UI]` iGaming P&L: Gross gaming revenue, bonus cost, affiliate commission, influencer COGS, net
- [ ] `[Supabase]` `brand_ledger_entries.category` enum genişletme (affiliate, streamer, ops, tax)
- [ ] `[UI]` Çok para birimi + FX rate tablosu (`brand_fx_rates`)
- [ ] `[API]` Operatör settlement import → otomatik ledger satırı
- [ ] `[UI]` Bütçe vs actual burn-down chart

---

## 16. Faturalar (`/marka/faturalar`)

**Mevcut:** `brand_invoices`.

- [ ] `[UI]` Gelen / giden fatura, KDV, e-Fatura entegrasyon hook
- [ ] `[Supabase]` `brand_invoice_lines` — kalem detayı, anlaşma/affiliate ref
- [ ] `[UI]` Onay workflow + PDF Storage bucket (`brand-invoices`)
- [ ] `[API]` Ödeme eşleştirme (invoice paid → ledger)

---

## 17. Bordro (`/marka/bordro`)

**Mevcut:** `brand_payroll_items`, departman bağlantısı.

- [ ] `[UI]` Ay kapanışı: personel + yayıncı ödemeleri ayrı sekmeler
- [ ] `[Supabase]` `brand_payroll_runs` — batch id, status, approved_by
- [ ] `[UI]` Vergi/kesinti kuralları (ülke bazlı şablon)
- [ ] `[API]` Export: bank transfer CSV, accounting ERP

---

## 18. Ödeme planı (`/marka/odemeler`)

**Mevcut:** `internal_projects` / project payments.

- [ ] `[UI]` Influencer ödeme takvimi ↔ `brand_deals` milestone
- [ ] `[Supabase]` `brand_payment_schedules` — tekrarlayan, escrow
- [ ] `[UI]` Cashflow forecast 90 gün
- [ ] `[API]` TRON/USDT/crypto payout izleme (marka kasa ayrı modül)

---

## 19. Bildirimler (`/marka/bildirimler`)

**Mevcut:** `for_brand_id` scope.

- [ ] `[UI]` Bildirim tercihleri marka bazlı (e-posta digest, Telegram bot)
- [ ] `[Supabase]` `brand_notification_rules` — event type → kanal
- [ ] `[UI]` Kritik: FTD spike, compliance breach, payout ready
- [ ] `[API]` Supabase Realtime subscription marka panelinde

---

## 20. Marka profili (`/marka/profil`)

- [ ] `[UI]` White-label: logo, primary color, subdomain (`organizations` genişletme)
- [ ] `[Supabase]` `brands.license_jurisdiction`, `brands.restricted_geos[]`
- [ ] `[UI]` Operatör bağlantıları listesi + API key yönetimi
- [ ] `[UI]` Veri saklama & KVKK/GDPR onay kayıtları
- [ ] `[Supabase]` `brand_settings` JSON: timezone, default currency, fiscal year start

---

## 21. Onboarding (`/marka/onboarding`)

- [ ] `[Mevcut]` Getting started — genişlet
- [ ] `[UI]` iGaming onboarding wizard: lisans bilgisi → operatör API → ilk KPI import → ilk affiliate → ilk teklif
- [ ] `[Supabase]` `brand_onboarding_progress` — adım tamamlanma
- [ ] `[API]` Sandbox operatör verisi ile demo mod

---

## 22. Yeni modüller (nav’da henüz yok — öneri)

| Modül | Route önerisi | Supabase odak |
|--------|----------------|---------------|
| **Kampanya yönetimi** | `/marka/kampanyalar` | `brand_campaigns`, bonus rules |
| **Oyuncu analitiği** | `/marka/oyuncular` | `brand_player_events` (agregat, PII yok) |
| **Compliance merkezi** | `/marka/uyumluluk` | `brand_compliance_checks`, docs Storage |
| **Raporlar & export** | `/marka/raporlar` | Scheduled reports, PDF/CSV |
| **API & webhook** | `/marka/entegrasyon` | `brand_api_keys`, webhook logs |
| **Destek / ticket** | `/marka/destek` | `brand_support_tickets` |
| **Rekabet & benchmark** | `/marka/benchmark` | Anonim agregat (network opt-in) |

---

## 23. Supabase uygulama öncelik sırası (önerilen fazlar)

### Faz 1 — Veri omurgası (4–6 hf)
1. `brand_player_events` + import API  
2. `brand_kpi_targets` + anasayfa/operasyon bağlantısı  
3. `brand_audit_log` + kritik UI işlemleri  
4. RLS gözden geçirme (marka izolasyonu test suite)

### Faz 2 — Affiliate derinleşme (4 hf)
1. `affiliate_campaigns`, `affiliate_payouts`, tier kuralları  
2. Affiliate sayfası ROI + operatör sync  
3. Fraud/anomali kartları

### Faz 3 — İçerik & attribution (4 hf)
1. `brand_deal_tracking_links` + FTD attribution eşleme  
2. Post compliance workflow  
3. Takvim + kampanya overlay

### Faz 4 — Finans tamamlama (3 hf)
1. Ledger kategorileri + çok PB  
2. Fatura satır detayı + ödeme eşleme  
3. Bordro run + export

### Faz 5 — Enterprise (6+ hf)
1. SSO, fine-grained permissions  
2. Realtime + webhook platform  
3. White-label subdomain  
4. Compliance merkezi + Storage belgeler

---

## 24. Hızlı kazanımlar (mevcut kod üzerinde, düşük efor)

- [ ] Anasayfaya affiliate funnel mini widget (`affiliate_daily_stats` zaten var)
- [ ] Operasyon sayfasına GGR/NGR kolonları (manuel giriş → sonra API)
- [ ] Anlaşma detayına tracking link + promo code alanları
- [ ] CRM deal kartına `expected_ftd` / `commission_model`
- [ ] Bildirim kuralları: FTD hedef altı (`brand_monthly_stats` + `brand_kpi_targets`)
- [ ] Raporlar: tek tık CSV export tüm marka modüllerinden

---

## 25. Kalite & uyumluluk (sürekli)

- [ ] `[Test]` Marka A kullanıcısı Marka B verisini göremez (RLS + API integration tests)
- [ ] `[Test]` Webhook signature doğrulama
- [ ] `[Docs]` Marka API referansı (OpenAPI)
- [ ] `[Compliance]` PII minimizasyonu — oyuncu tablolarında agregat only
- [ ] `[Compliance]` Audit log immutable (append-only trigger)
- [ ] `[Performance]` Aylık dashboard materialized view refresh cron

---

*Son güncelleme: 2026-06-03 · Foxstream marka portalı mevcut durumuna göre hazırlanmıştır.*
