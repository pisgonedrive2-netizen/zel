# Foxstream B2B Yol Haritası

> **Vizyon:** Foxstream, bugünkü 5 marka × yayıncı stüdyosundan, **dışarıdan kayıt
> olan markaların kendi affiliate / partner / içerik dashboard'una sahip olabildiği
> çok-kiracılı (multi-tenant) bir B2B platforma** dönüşecek.

Bu doküman tek kaynaktır. Tüm yeni migration, API ve UI değişiklikleri buradaki
fazlara göre etiketlenir.

---

## 0. Bugünkü Durum (referans)

- **Roller:** `admin`, `streamer`, `auditor`, `brand`
- **Markalar:** 5 sabit (`br-gala`, `br-boffice`, `br-pipo`, `br-hit`, `br-padi`)
- **Marka paneli (`/marka/*`)**
  - `/marka/operasyon` — Aylık KPI (kayıt, FTD, deposit, withdrawal, demo bakiye)
  - `/marka/izlenmeler` — Marka link & snapshot izlenme
  - `/marka/takvim` — Yayıncı haftalık planı
  - `/marka/odemeler` — `internal_projects` ödeme planı
  - `/marka/bildirimler` — Marka bildirimleri
- **Kayıt:** `/api/auth/support-request` (registration) admin'e bildirim atıyor;
  `REGISTRATION_ENABLED = false` (login formu görünmüyor).
- **Tek tenant** — `brands` tablosu globalde, izolasyon `brandId` filtresiyle.

---

## Fazlama (özet)

| Faz | Kod adı | Süre tahmini | Çıktı |
|-----|---------|---------------|-------|
| **A** | Self-serve marka kaydı + onboarding | 1 hafta | Dışarıdan kayıt formu, admin onay, otomatik marka + user oluşturma |
| **B** | Marka ana dashboard birleşimi | 1 hafta | `/marka/anasayfa` — operasyon + izlenme + ödeme + bildirim özet kart |
| **C** | Affiliate Tracking MVP (manuel) | 2 hafta | Affiliate Partners + Daily Stats tablosu, CSV import, kampanya periyodları |
| **D** | Multi-tenant organizasyon | 2 hafta | `organizations` tablosu, holding/grup desteği, marka ekibi alt kullanıcılar |
| **E** | White-label + ayarlar | 1 hafta | Logo/renk/timezone, subdomain (`gala.foxstream.app`), marka tema |
| **F** | Operatör API + otomatik aff | 3+ hafta | Operatör tarafından webhook/REST → otomatik affiliate veri akışı |
| **G** | Yayıncı Havuzu + Teklif | 2 hafta | Açık yayıncı profil havuzu, marka↔yayıncı teklif/anlaşma akışı |
| **H** | Anlaşma + İçerik Post Takibi | 1.5 hafta | Aktif anlaşma yönetimi, marka için yayıncı post URL takibi |

---

## Faz G — Yayıncı Havuzu + Teklif Sistemi

### G.1 Hedef
Login arkaplanındaki "MARKALAR — Doğru yayıncılarla iş birliği yap" ve "YAYINCILAR — Yayınlarını yönet" vaadini gerçek bir **iki yönlü teklif/anlaşma platformuna** dönüştürmek.

- **Yayıncı** kendi havuz profilini doldurur (bio, kategori, platform handle'ları, fiyat aralığı, geçmiş işler).
- **Marka** havuzdan yayıncı bulur, teklif gönderir.
- **Yayıncı** teklifi kabul/red/karşı teklif eder.
- Kabul edilen teklif → **anlaşma** olur (Faz H).

### G.2 Veri modeli

```sql
CREATE TABLE public.streamer_pool_profiles (
  id              text PRIMARY KEY,
  employee_id     text NOT NULL UNIQUE REFERENCES public.employees(id) ON DELETE CASCADE,
  display_name    text NOT NULL,
  headline        text NOT NULL DEFAULT '',          -- "Türkiye'nin en hızlı vlogcusu"
  bio             text NOT NULL DEFAULT '',
  categories      text[] NOT NULL DEFAULT '{}',      -- ["Vlog","Yayın","Yetişkin"]
  languages       text[] NOT NULL DEFAULT '{tr}',
  countries       text[] NOT NULL DEFAULT '{TR}',
  rate_min_usd    numeric(12,2),
  rate_max_usd    numeric(12,2),
  rate_currency   text NOT NULL DEFAULT 'USD',
  followers_total integer NOT NULL DEFAULT 0,        -- snapshot toplamı
  avg_views       integer NOT NULL DEFAULT 0,
  avatar_url      text,
  cover_url       text,
  status          text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','published','paused','closed')),
  visibility      text NOT NULL DEFAULT 'public'
                  CHECK (visibility IN ('public','brand_only','invite_only')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.brand_offers (
  id              text PRIMARY KEY,
  brand_id        text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  employee_id     text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  /** Kim başlattı? */
  initiator       text NOT NULL DEFAULT 'brand'
                  CHECK (initiator IN ('brand','streamer')),
  title           text NOT NULL,                     -- "Padişahbet için 3 vlog"
  description     text NOT NULL DEFAULT '',
  offer_type      text NOT NULL DEFAULT 'campaign'
                  CHECK (offer_type IN ('campaign','single_post','long_term','affiliate')),
  budget_usd      numeric(12,2),
  /** Aktif görüşmenin akış pozisyonu. */
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','negotiating','accepted','rejected','withdrawn','expired')),
  deliverables    jsonb NOT NULL DEFAULT '[]',       -- [{type:"reel",count:3,platform:"instagram"}, …]
  start_date      date,
  end_date        date,
  notes           text NOT NULL DEFAULT '',
  expires_at      timestamptz,
  created_by      text REFERENCES public.app_users(id),
  responded_by    text REFERENCES public.app_users(id),
  responded_at    timestamptz,
  /** Kabul edildiğinde oluşturulan anlaşma. */
  created_deal_id text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.brand_offer_messages (
  id              text PRIMARY KEY,
  offer_id        text NOT NULL REFERENCES public.brand_offers(id) ON DELETE CASCADE,
  author_id       text NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  author_role     text NOT NULL CHECK (author_role IN ('brand','streamer','admin')),
  body            text NOT NULL,
  /** Karşı teklif fiyatı (opsiyonel). */
  counter_budget_usd numeric(12,2),
  created_at      timestamptz NOT NULL DEFAULT now()
);
```

### G.3 API
- `GET /api/streamer-pool` — filtreler: kategori, dil, min/max ücret, follower aralığı; brand kullanıcısı her zaman görür, admin tümü; streamer sadece kendi profilini.
- `GET/PUT /api/streamer-pool/me` (streamer) — profil düzenle.
- `POST /api/brand-offers` — marka veya yayıncı tarafından teklif başlat.
- `GET /api/brand-offers?role=brand|streamer&status=` — kullanıcı kendi taraflı teklifleri.
- `POST /api/brand-offers/:id/respond` — body `{ action: 'accept'|'reject'|'counter', counterBudgetUsd?, message? }`. `accept` → otomatik `brand_deals` satırı yaratır.
- `POST /api/brand-offers/:id/messages` — sohbet mesajı.
- `POST /api/brand-offers/:id/withdraw` — başlatan tarafın iptali.

### G.4 UI
- **Marka tarafı (`/marka/havuz`):** filtreli yayıncı kart grid'i, kart üstünde "Teklif gönder" butonu → modal (başlık, bütçe, deliverable, tarih, mesaj).
- **Marka tarafı (`/marka/teklifler`):** gelen/giden teklif listesi, durum filtresi, detay drawer + mesaj kutusu.
- **Yayıncı tarafı (`/yayinci/profil`):** havuz profili düzenle (bio, kategori, platform, ücret aralığı).
- **Yayıncı tarafı (`/yayinci/teklifler`):** gelen teklifler — kabul/red/karşı teklif + mesajlaşma.

---

## Faz H — Aktif Anlaşma + İçerik Post Takibi

### H.1 Hedef
Faz G'de kabul edilen teklif sonrası **anlaşma yaşam döngüsü**, ve marka için **yayıncının attığı içeriklerin (post URL'leri) takibi**.

### H.2 Veri modeli

```sql
CREATE TABLE public.brand_deals (
  id              text PRIMARY KEY,
  brand_id        text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  employee_id     text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  origin_offer_id text REFERENCES public.brand_offers(id) ON DELETE SET NULL,
  title           text NOT NULL,
  deal_type       text NOT NULL DEFAULT 'campaign'
                  CHECK (deal_type IN ('campaign','single_post','long_term','affiliate')),
  status          text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','completed','cancelled','disputed')),
  budget_usd      numeric(12,2) NOT NULL DEFAULT 0,
  paid_usd        numeric(12,2) NOT NULL DEFAULT 0,
  start_date      date,
  end_date        date,
  deliverables    jsonb NOT NULL DEFAULT '[]',
  /** Yayıncı yüklediği toplam içerik sayısı (otomatik artırılır). */
  posts_count     integer NOT NULL DEFAULT 0,
  total_views     bigint NOT NULL DEFAULT 0,
  notes           text NOT NULL DEFAULT '',
  contract_url    text,                              -- imzalı PDF ileride
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.brand_posts (
  id              text PRIMARY KEY,
  brand_id        text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  employee_id     text REFERENCES public.employees(id) ON DELETE SET NULL,
  deal_id         text REFERENCES public.brand_deals(id) ON DELETE SET NULL,
  platform        text NOT NULL CHECK (platform IN ('instagram','tiktok','youtube','kick','twitter','telegram','other')),
  post_type       text NOT NULL DEFAULT 'post'
                  CHECK (post_type IN ('post','reel','story','vlog','stream','vod','tweet','other')),
  url             text NOT NULL,
  caption         text NOT NULL DEFAULT '',
  posted_at       timestamptz,
  screenshot_url  text,
  views           bigint NOT NULL DEFAULT 0,
  likes           integer NOT NULL DEFAULT 0,
  comments        integer NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'live'
                  CHECK (status IN ('draft','live','removed','expired')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, url)
);
```

### H.3 API
- `GET/POST /api/brand-deals` (marka kendi, admin tümü, yayıncı kendi tarafı)
- `PATCH /api/brand-deals/:id` (status, paid_usd, notes)
- `GET/POST /api/brand-posts?brandId=&dealId=&employeeId=` (filtreli)
- `PATCH /api/brand-posts/:id`
- `POST /api/brand-posts/:id/refresh-metrics` — manuel veya sosyal API ile views güncelle (mevcut sosyal API helper'ları kullanılabilir)

### H.4 UI
- **`/marka/anlasmalar`** — aktif/tamamlanan/iptal sekmeleri, kart başına bütçe, posts_count, total_views, yayıncı + "Postları gör" CTA.
- **`/marka/postlar`** — tüm postlar (deal'a bağlı veya bağımsız), filtre (platform, deal, yayıncı), tablo: thumbnail/screenshot · URL link · views/likes · status · refresh metric butonu.
- **Yayıncı tarafı (`/yayinci/postlar`):** kendi yüklediği postlar + "Post ekle" formu (URL paste + platform seç + caption).
- Marka anasayfa (Faz B): "Aktif anlaşma" + "Bu ay post sayısı" KPI eklenir (ileride).

### H.5 Kabul kriterleri
- Faz G'de "accept" basıldığında otomatik `brand_deals` satırı oluşur.
- Yayıncı yeni post URL yapıştırdığında deal `posts_count` artar, marka panelinde anında görünür.
- Marka her postu doğrudan platform'da açabilir; views/likes manuel girilebilir veya "Refresh metric" ile çekilir.

---

## Faz A–F (üst bölüm referans için)

---

## Faz A — Self-Serve Marka Kaydı + Onboarding

### A.1 Hedef
Dışarıdan bir marka temsilcisi `/login`'den **"Kayıt Ol → Marka"** ile başvuru
yapabilsin, admin tek tıkla onaylayınca **marka + kullanıcı + ilk
brand_monthly_stats satırı** otomatik oluşsun.

### A.2 Veri modeli
Yeni tablo: `public.brand_registration_requests`

```sql
CREATE TABLE public.brand_registration_requests (
  id              text PRIMARY KEY,
  brand_name      text NOT NULL,              -- "Yeni Bahis A.Ş."
  short_name      text,                       -- "YBA"
  category        text NOT NULL DEFAULT 'Bahis',
  website         text,
  contact_name    text NOT NULL,
  contact_email   text NOT NULL,
  contact_phone   text,
  telegram        text,
  monthly_volume  text,                       -- aralık: "1M-5M" gibi
  preferred_username text,
  notes           text NOT NULL DEFAULT '',
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','rejected','duplicate')),
  rejection_reason text,
  reviewed_by     text REFERENCES public.app_users(id) ON DELETE SET NULL,
  reviewed_at     timestamptz,
  -- Onay sonrası oluşturulan kaynaklar
  created_brand_id text REFERENCES public.brands(id) ON DELETE SET NULL,
  created_user_id  text REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
```

İlgili eklemeler:
- `app_settings.brand_registration_enabled` (bool flag; ENV yerine DB)
- `brands.created_from_request_id` (audit)

### A.3 API yüzeyi
| Method | Path | Erişim | Görev |
|--------|------|--------|-------|
| `POST` | `/api/brand-registrations` | public | Yeni başvuru oluştur (rate-limit, duplicate kontrol) |
| `GET`  | `/api/brand-registrations` | admin  | Liste + filtre |
| `POST` | `/api/brand-registrations/:id/approve` | admin | Marka + user + KPI satırı oluştur, PIN üret, e-posta/Telegram'a gönder |
| `POST` | `/api/brand-registrations/:id/reject` | admin | Status=rejected, sebep yazılır, başvuruya cevap |

### A.4 UI
- **Login modal (`/login`):** REGISTRATION_ENABLED=true → "Kayıt Ol" görünür,
  Marka kayıt formu (mevcut form genişletilir — şirket/website/hacim alanları).
- **Admin `/kullanicilar` sayfası → yeni sekme "Marka Başvuruları":**
  - Bekleyen liste, hızlı detay drawer
  - **"Onayla"** = otomatik brand row + brand user + PIN gösterimi + e-posta/Telegram link
  - **"Reddet"** = sebep yaz
  - Audit log entry'si
- **Onboarding wizard (yeni marka 1. girişte):**
  - Marka logosu yükle (`storage.buckets.brand-assets`)
  - Kategori onayı, hedef pazarlar, currency
  - Davet edilecek alt kullanıcılar (opsiyonel)
  - "Bitir" → `/marka/anasayfa`

### A.5 Kabul kriterleri
- Login'den marka başvurusu yapılıyor → admin'e bildirim
- Admin onayı → marka kullanıcısı login olabiliyor → boş ama çalışan dashboard görüyor
- Reddedilen başvuru: yeniden başvurabilir
- Audit log'a tüm kararlar düşüyor

---

## Faz B — Marka Ana Dashboard (Birleşik Özet)

### B.1 Hedef
Yeni rota: `/marka/anasayfa` — markanın tüm modüllerinden özet. Bugün
`/marka/operasyon`'a redirect olan landing, hero KPI + 4 kart paneline çevrilir.

### B.2 Layout (background mockup ile uyumlu)
- **Hero şeridi (üst):** marka logosu + hedef vs gerçekleşen (FTD/Deposit) progress
- **4 ana kart (3×2 grid):**
  1. **Operasyon** — bu ay kayıt, FTD, deposit, withdrawal
  2. **Yayıncı Partner** — atanmış yayıncı sayısı, bu hafta plan, toplam izlenme
  3. **Affiliate** _(Faz C aktifse)_ — partner sayısı, FTD, komisyon
  4. **Ödeme** — sıradaki taksit, ödenmemiş, planlı
- **Aktivite akışı (sağ):** son 10 bildirim
- **Hızlı eylemler:** "Aylık KPI gir", "Yayıncı talep et", "Affiliate ekle"

### B.3 Renk paleti (background görseliyle aynı)
| Token | Hex | Kullanım |
|-------|-----|----------|
| `--fs-orange` | `#FF6B00` | Yayıncı / primary action |
| `--fs-green`  | `#22C55E` | Marka / başarı |
| `--fs-blue`   | `#3B82F6` | Denetim / info |
| `--fs-pink`   | `#EC4899` | Destek / vurgu |
| `--fs-bg`     | `#0A0A0A` | Arkaplan |
| `--fs-bg-soft`| `#161616` | Kart |

### B.4 Komponentler
- `BrandHomeHero` (marka adı + logo + ay seçimi)
- `BrandKpiCard` (4 lü kart şablonu)
- `BrandActivityFeed`
- `BrandQuickActions`

---

## Faz C — Affiliate Tracking MVP

### C.1 Hedef
Marka kendi affiliate partner listesini, tıklamalarını ve FTD'lerini Foxstream
panelinde tutabilsin. İlk sürüm **manuel CSV import + el ile ekle**.

### C.2 Veri modeli

```sql
CREATE TABLE public.affiliate_partners (
  id              text PRIMARY KEY,
  brand_id        text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  name            text NOT NULL,                -- "Ramiz Vlog Channel"
  external_ref    text,                         -- operatör tarafındaki aff_id
  partner_type    text NOT NULL DEFAULT 'streamer'
                  CHECK (partner_type IN ('streamer','external','agency','social')),
  commission_model text NOT NULL DEFAULT 'cpa'
                   CHECK (commission_model IN ('cpa','revshare','hybrid','flat')),
  cpa_amount      numeric(12,2) NOT NULL DEFAULT 0,
  revshare_pct    numeric(5,2)  NOT NULL DEFAULT 0,
  currency        text NOT NULL DEFAULT 'USD',
  status          text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','paused','closed')),
  /** Foxstream yayıncı eşleştirmesi (varsa). */
  employee_id     text REFERENCES public.employees(id) ON DELETE SET NULL,
  contact         text,
  notes           text NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, external_ref)
);

CREATE TABLE public.affiliate_daily_stats (
  id              text PRIMARY KEY,
  partner_id      text NOT NULL REFERENCES public.affiliate_partners(id) ON DELETE CASCADE,
  brand_id        text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  stat_date       date NOT NULL,
  clicks          integer NOT NULL DEFAULT 0,
  registrations   integer NOT NULL DEFAULT 0,
  ftd_count       integer NOT NULL DEFAULT 0,
  ftd_amount      numeric(14,2) NOT NULL DEFAULT 0,
  deposit_amount  numeric(14,2) NOT NULL DEFAULT 0,
  withdrawal_amount numeric(14,2) NOT NULL DEFAULT 0,
  net_revenue     numeric(14,2) NOT NULL DEFAULT 0,
  commission_due  numeric(12,2) NOT NULL DEFAULT 0,
  currency        text NOT NULL DEFAULT 'USD',
  source          text NOT NULL DEFAULT 'manual'
                  CHECK (source IN ('manual','csv','api','webhook')),
  imported_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (partner_id, stat_date)
);

CREATE TABLE public.affiliate_payouts (
  id              text PRIMARY KEY,
  partner_id      text NOT NULL REFERENCES public.affiliate_partners(id) ON DELETE CASCADE,
  brand_id        text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  period_start    date NOT NULL,
  period_end      date NOT NULL,
  amount          numeric(14,2) NOT NULL,
  currency        text NOT NULL DEFAULT 'USD',
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','paid','cancelled')),
  paid_date       date,
  notes           text NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
```

### C.3 API & UI
- `GET/POST/PATCH/DELETE /api/affiliate/partners`
- `GET/POST /api/affiliate/stats` (bulk insert + upsert by partner+date)
- `POST /api/affiliate/import-csv` — şablon: `partner,date,clicks,registrations,ftd_count,ftd_amount,deposit,withdrawal`
- **Yeni sayfalar:**
  - `/marka/affiliate` — partner listesi + KPI özet
  - `/marka/affiliate/[partnerId]` — partner detay + günlük grafik
  - `/marka/affiliate/import` — CSV yükle + önizleme
  - Admin tarafında `/affiliate` (tüm markalar) cross-tenant view

### C.4 Yayıncı eşleştirme
- `affiliate_partners.employee_id` doluysa → yayıncı paneline "Senin affiliate
  performansın" widget eklenir (`/yayinci/affiliate` tab)
- Marka panelinde "Bu yayıncıdan geldi" filtresi

---

## Faz D — Multi-Tenant Organizasyon

### D.1 Hedef
Bir hesap birden fazla markayı yönetebilsin (örn. holding: Galagrup → Gala +
Padişah). Marka ekibi alt rol/kullanıcılarla çalışabilsin (finance, marketing,
viewer).

### D.2 Veri modeli

```sql
CREATE TABLE public.organizations (
  id              text PRIMARY KEY,
  name            text NOT NULL,
  slug            text NOT NULL UNIQUE,         -- "galagrup"
  logo_url        text,
  primary_contact text,
  contact_email   text,
  status          text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','suspended','closed')),
  plan            text NOT NULL DEFAULT 'starter'
                  CHECK (plan IN ('starter','growth','enterprise','agency')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- brands.organization_id eklenir
ALTER TABLE public.brands
  ADD COLUMN organization_id text REFERENCES public.organizations(id);

CREATE TABLE public.organization_members (
  id              text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         text NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  org_role        text NOT NULL DEFAULT 'viewer'
                  CHECK (org_role IN ('owner','admin','finance','marketing','viewer')),
  /** Tüm markalar görünür mü, yoksa belirli markalara mı? */
  scope_all_brands boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE TABLE public.organization_member_brands (
  member_id       text NOT NULL REFERENCES public.organization_members(id) ON DELETE CASCADE,
  brand_id        text NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  PRIMARY KEY (member_id, brand_id)
);
```

### D.3 Auth değişiklikleri
- Session: `user.organizationId` + `user.brandIds[]`
- "Marka değiştir" dropdown (sidebar üst) — birden fazla marka erişiminde
- `useMarkaPortal` hook'u tek `brandId` yerine **aktif marka context**'inden okur

### D.4 Geriye uyumluluk
- Mevcut 5 marka için tek **"Foxstream Ajansı"** organization oluşturulur
- Mevcut `app_users.brandId` → `organization_member_brands`'e migrate edilir

---

## Faz E — White-label + Marka Ayarları

### E.1 Yetenekler
- `brands.logo_url`, `brands.primary_color`, `brands.timezone`, `brands.locale`,
  `brands.default_currency`
- Subdomain routing: `gala.foxstream.app` → otomatik `brandId` seç
- E-posta şablonları marka markasıyla
- Marka davet linki (email magic link)

### E.2 Yeni sayfa
- `/marka/ayarlar` (org admin yetkisiyle)
  - Marka bilgileri, ekip, faturalama, API anahtarları

---

## Faz F — Operatör API + Otomatik Affiliate

### F.1 Hedef
Marka, kendi operatör platformundan Foxstream'e webhook/REST ile veri akıtsın.

### F.2 Bileşenler
- `api_credentials` (per brand, encrypted) — operatör API key
- `webhook_endpoints` (Foxstream'in dinlediği `/api/integrations/:brand/:provider/webhook`)
- Adapter katmanı: `lib/integrations/<provider>` (Hipoo, BetConstruct, vs.)
- Cron: günlük affiliate fetch (Vercel cron)
- Logging: `integration_runs` (her çağrı, hata, kayıt sayısı)

---

## Ortak Endişeler

### Güvenlik
- RLS: tüm yeni tablolar `brand_id` üzerinden filtreli (`brand_id IN (
  SELECT brand_id FROM organization_member_brands WHERE member_id IN (
    SELECT id FROM organization_members WHERE user_id = auth.uid()
  )
)`)
- API rate-limit: kayıt formu (10/saat/IP), import (5/dakika)
- Audit log: tüm sensitive aksiyon (`brand_registration_approved`, `affiliate_imported`, vs.)

### Plan & ücretlendirme (ilerleyen iş)
- `starter` (1 marka, 3 partner, manuel)
- `growth` (5 marka, 50 partner, CSV import + API)
- `enterprise` (sınırsız, white-label, dedicated)

### Telemetri
- `audit_logs` zaten var → genişletilecek
- İleride PostHog/Mixpanel — şimdilik in-app aktivite akışı

---

## Sıra (önerilen geliştirme akışı)

1. **Faz A.1 + A.2** — migration + API ✅ (önce backend)
2. **Faz A.3 + A.4** — UI ve admin onay
3. **Faz B** — anasayfa (admin/iç ekip için faydalı)
4. **Faz C** — affiliate MVP (B2B değerinin asıl satışı)
5. **Faz D** — multi-tenant (büyüme tetiklendiğinde)
6. **Faz E/F** — premium tarafta

---

## Tablo özeti (yeni eklenecekler)

| Tablo | Faz | Kayıt başına satır |
|-------|-----|--------------------|
| `brand_registration_requests` | A | 1 / başvuru |
| `organizations` | D | 1 / şirket |
| `organization_members` | D | N / şirket |
| `organization_member_brands` | D | M×N |
| `affiliate_partners` | C | N / marka |
| `affiliate_daily_stats` | C | partner × gün |
| `affiliate_payouts` | C | partner × dönem |
| `integration_runs` | F | API çağrı başına |
| `api_credentials` | F | 1 / (brand,provider) |

---

## Rota haritası (özet)

| Rota | Faz | Rol |
|------|-----|-----|
| `/marka/anasayfa` | B | brand |
| `/marka/affiliate` | C | brand |
| `/marka/affiliate/[id]` | C | brand |
| `/marka/affiliate/import` | C | brand (admin org-rol) |
| `/marka/ayarlar` | E | brand (admin org-rol) |
| `/marka/ekip` | D | brand (admin org-rol) |
| `/kullanicilar?tab=marka-basvurulari` | A | admin |
| `/affiliate` (global) | C | admin |

---

> **Not:** Bu doküman her PR'de güncellenir. Bir fazı tamamlayan PR aynı zamanda
> bu dosyada ilgili check-list'i de işaretlemelidir.

---

## ✅ Multi-Tenant B2B Uygulaması (Faz 0–6) — TAMAMLANDI

Aşağıdaki fazlar `b2b_multi-tenant_platform` planına göre uygulandı. Her marka/yayıncı
artık birbirinden bağımsız bir kiracı (organization) olarak ele alınır; yeni kayıt
olan markalar/yayıncılar mevcut 5 marka & yayıncılardan izole çalışır.

### Faz 0 — Kiracı temeli
- Migration: `20260531120000_organizations.sql` (`organizations`, `organization_members`,
  `organization_member_brands`, `brands.organization_id`). Mevcut veri `org-foxstream`
  (type=agency) altında backfill edildi.
- `SessionPayload` + `AppUser` genişletildi: `organizationId`, `orgRole`, `brandIds[]`.
- `fetchBootstrap` org-scope'lu; çok markalı marka kullanıcısı için sidebar **marka
  değiştirici** (`BrandSwitcher`).
- `src/lib/org-access.ts` — sunucu yetki sözleşmesi (`ensureBrandAccess`,
  `resolveBrandId`, `hasOrgCapability`, `writeAudit`); `src/lib/org-capability.ts` —
  istemci eşi (UI gizleme).

### Faz 1 — Onboarding + ilk giriş
- `/api/org/onboarding` (GET/POST), `MarkaOnboardingGate`, `/marka/onboarding` ve
  `/yayinci/onboarding` sihirbazları.
- Anlamlı boş dashboard: `BrandGettingStarted` checklist.

### Faz 2 — Self-serve yayıncı kaydı
- Migration: `20260531130000_streamer_registration_requests.sql`.
- API: `/api/streamer-registrations` (public POST + admin GET),
  `[id]/approve` (employee + app_user + draft havuz profili + tek seferlik PIN),
  `[id]/reject`.
- Login formuna **Yayıncı** başvuru dalı; admin **Yayıncı Başvuruları** sekmesi
  (`/kullanicilar?tab=yayinci-basvurulari`).

### Faz 3 — Marka personel & takip (HR-lite)
- Migration: `20260531140000_brand_personnel.sql` (`brand_staff`, `brand_staff_tasks`,
  `brand_staff_shifts`, `brand_staff_activity`).
- API: `/api/marka/personel` (+`[id]`), `/api/marka/takip`.
- Sayfalar: `/marka/personel`, `/marka/personel/[id]` (görev+vardiya+aktivite),
  `/marka/takip` (kanban + vardiya takvimi). Yetki: `hr`.

### Faz 4 — CRM
- Migration: `20260531150000_crm_module.sql` (`crm_contacts`, `crm_deals`,
  `crm_interactions`).
- API: `/api/marka/crm` (+`[id]`). Sayfalar: `/marka/crm` (pipeline kanban + kontak
  listesi), `/marka/crm/[id]` (kontak detay + etkileşim zaman çizelgesi).
- Anlaşmalar affiliate partner & marka anlaşmasına (gevşek) bağlanabilir. Yetki: `crm`.

### Faz 5 — Marka-kapsamlı muhasebe
- Migration: `20260531160000_brand_accounting.sql` (`brand_ledger_entries`,
  `brand_invoices`).
- API: `/api/marka/muhasebe` (+`/sync`). Sayfalar: `/marka/muhasebe` (defter + bakiye),
  `/marka/faturalar`.
- **Otomatik besleme** (`/sync`): ödenen affiliate payout → gider, kazanılan CRM
  anlaşması → gelir, aktif personel aylık maliyeti → gider; `(brand, source, ref_id)`
  tekil indeksiyle tekrarsız. Yetki: `finance`.

### Faz 6 — Doğrulama & sıkılaştırma
- `org_role` bazlı subnav gizleme (hr/crm/finance modülleri rolüne göre).
- Tüm yeni tablolar RLS-enabled (servis-rol erişimi; proje konvansiyonuyla uyumlu —
  advisor yalnızca INFO seviyesinde, tüm DB ile tutarlı).
- `tsc --noEmit` ✅, `next build` ✅. Tüm sensitive aksiyonlar `audit_logs`'a yazılır.

> Marka subnav grupları: Genel · İş birliği · Performans · **Ekip & personel
> (Personel/Görev&Takip/CRM)** · **Finans (Muhasebe/Faturalar/Ödeme planı)** · Hesap.

---

## ✅ Marka ekip yönetimi & yetki hiyerarşisi (eklenti)

Marka kendi organizasyonu içinde ekip kurabilir; **Foxstream platform yöneticisi
(admin)** en üst yetki olarak kalır.

- Migration: `20260531170000_org_member_auditor_role.sql` — `organization_members.org_role`
  CHECK'ine **`auditor`** (marka denetçisi) eklendi.
- **Roller:** `owner` (marka sahibi), `admin` (marka yöneticisi), `finance`, `marketing`,
  `hr`, `viewer`, **`auditor`** (salt-okunur denetim).
- **Yetki ayrımı:**
  - `org-access.ts` → `canWriteBrandData` artık `auditor`/`viewer` org rollerini
    yazmadan men eder (tüm marka write API'leri için geçerli). `canManageOrgTeam`
    (owner/admin) ve `isBrandReadOnly` eklendi.
  - `org-capability.ts` (client) → görünürlük: owner/admin + denetçi/görüntüleyici tüm
    modülleri **görür** (salt-okunur); işlevsel roller yalnız kendi modülünü görür.
    `team` capability yalnız owner/admin.
- **API:** `/api/marka/ekip` (GET/POST/PATCH/DELETE) — owner/admin (veya platform admini)
  org içi üye oluşturur (app_user role=brand + organization_member + scope markaları),
  rol/başlık/durum günceller, PIN sıfırlar, üye kaldırır. Platform admini `?brandId=` ile
  markanın org'unu çözer. `src/lib/db/org-team-repo.ts` + `src/lib/brand-team-api.ts`.
- **UI:** `/marka/ekip` — ekip listesi (rol rozeti, erişim kapsamı, durum, son giriş),
  rol kartlı oluştur/düzenle modalı, tek seferlik PIN gösterimi, yetki hiyerarşisi notu.
  Subnav'a `Ekip & yetkiler` (team cap) eklendi.
