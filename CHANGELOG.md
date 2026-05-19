# Foxstream — Değişiklik Günlüğü

Bu dosya en son oturumda yapılan tüm değişikliklerin özetidir. Görevler;
PIN dayanıklılığı sorunlarından başlayıp, marka panelinde aylık operasyon
metrikleri, admin impersonation altyapısı ve son olarak 10 yeni özelliğin
hayata geçirilmesi ile sonuçlanmıştır.

---

## 0. Currency, API health ve link detay penceresi (Mayıs 19 ek)

### Currency
* `BrandMonthlyStats` varsayılan para birimi **USD** oldu (önceden TRY).
  Marka aylık operasyon formu artık ilk yatırım/çekim girişlerinde USD'yi varsayılan
  gösteriyor; marka kullanıcısı dilerse EUR/TRY seçebilir.
* Para birimi seçici form içinde en üste alındı ve etiketinde ★ ile vurgulandı.
* Yatırım / çekim input label'larında seçilen sembol (`$`, `€`, `₺`) gösteriliyor.
* PDF & CSV (`/marka/izlenmeler` → indir) çıktısı zaten her satırda
  `fmtBrandMoney(amount, currency)` ile pre-formatted ürettiği için
  USD seçildiğinde otomatik olarak `$` ile, TRY seçildiğinde `₺` ile basıyor —
  ekstra düzenleme gerekmedi (regresyon değişikliği yok).

### API sağlık sinyali (RapidAPI bağlı / kotada vs.)
* `src/lib/social-api/health.ts` — `getPlatformHealth()` 24sa'lik
  cron run kayıtlarından platform başına `ok | warn | error | exhausted | unknown`
  hesaplar; son hata mesajı `brand_links.last_check_error` üzerinden çekilir.
* `src/lib/social-api/health.ts` — `pingPlatform()` her platform için minimal
  bir probe çağrısı yapar (kota: 1).
* **Yeni endpoint:** `POST /api/admin/api-ping?platform=youtube|tiktok|instagram`
  → admin/auditor; gerçek bir HTTP testi atar, latency ve durumu döner.
* `GET /api/admin/refresh-status` çıkışına `health: { status, lastSuccessAt, ... }`
  alanı eklendi.
* `AutoRefreshStatusPanel`:
  * Her platform kartında **HealthDot** + "Sağlık" satırı + son 24sa `✓ / ✗` sayıları
    + son hata mesajı görünüyor.
  * "Bağlantıyı test et" butonu kart bazında — 1 kota tüketir, sonucu inline
    olarak banner ile gösterir.
* **Yeni component:** `ApiHealthChip` (`src/components/api-health-chip.tsx`).
  Admin/auditor için her sayfada (login/marka/yayıncı dışında) sağ üstte yüzen
  küçük çip. En kötü platform durumunu özetler; 5dk'da bir status endpoint'ini
  yoklar. Tıklanınca `/izlenme`'ye gider (Auto Refresh Status Panel orada).
* `AuthShell` içinde `<ApiHealthChip />` render edildi.

### Link başına zengin detay penceresi
* `src/lib/social-api/clients.ts` — `fetchRichDetailsForLink()` eklendi:
  YouTube/Instagram/TikTok için **title, description, thumbnail, publishedAt,
  duration, author (avatar, follower, verified), hashtags, extras (music,
  region, category, vs.)** içeren normalize edilmiş yapı döner.
* **Yeni endpoint:** `GET /api/admin/link-details/[id]`
  → admin, auditor, brand (kendi markası), streamer (kendi linki).
  Her çağrı RapidAPI'den 1 kota tüketir; kota dolduysa 429 ile uyarı.
  Aynı zamanda `brand_links` üzerindeki son metrikleri günceller.
* **Yeni component:** `LinkDetailsModal` (`src/components/link-details-modal.tsx`).
  Açıldığında otomatik çekilir, "Yeniden çek" butonu var (1 kota), thumbnail,
  yazar avatarı, KPI tile'ları (Eye/Heart/MessageCircle/Share2), açıklama,
  hashtag'ler ve ekstra alanlar gösterilir. Hata durumunda friendly uyarı.
* Bu modal şu sayfalarda entegre edildi:
  * `BrandLinksPanel` → her link satırında 📊 ikonlu "Detaylı veri" butonu
    (sadece API'lerin desteklediği URL'ler için görünür).
  * `StreamerDashboard` → `/yayinci/marka-linkleri` kart aksiyonlarında 📊 buton.

---

## 1. PIN dayanıklılığı ve giriş güvenliği

**Sorun:** Şifre güncellendikten ve oturum kapatıldıktan sonra `galabet` gibi
markaların tekrar giriş yapamaması. PIN'lerin deploy sonrası kaybolması.

**Yapılanlar:**

- `src/lib/db/upsert-app-user.ts`: `findExistingRow` artık hem `id` hem
  `username` üzerinden eşleşmeyi araştırıyor. PIN yazıldıktan sonra
  `verifyPin` ile yazma sonrası doğrulama yapılıyor (yanlış hash riskine karşı).
- `src/app/api/auth/login/route.ts`: Kullanıcı adı ve PIN giriş öncesinde
  `trim()` ile temizleniyor (kopyala-yapıştır sırasında oluşan boşluklar
  girişi engellemesin diye).
- `src/app/kullanicilar/page.tsx`: `UserForm` boş PIN gönderimini doğru
  şekilde işliyor — yalnızca `pin.length >= 4` olduğunda hash yenileniyor.
- **Yeni:** Her kullanıcı satırında "PIN'i sunucuda test et" butonu
  (`ShieldQuestion` ikonu). Admin, kullanıcıya giriş yapmadan PIN'in sunucu
  hash'iyle eşleşip eşleşmediğini doğrulayabiliyor.
- **Yeni endpoint:** `src/app/api/users/[id]/verify-pin/route.ts` — admin-only,
  `{ ok, username, active }` döner.

---

## 2. Marka aylık operasyon metrikleri (`brand_monthly_stats`)

**Veritabanı:** `supabase/migrations/20260519120000_brand_monthly_stats.sql`
Yeni tablo: `brand_id`, `month`, `new_registrations`, `depositing_members`,
`first_time_depositors`, `deposit_count`, `deposit_amount`,
`withdrawal_amount`, `currency`, `notes`, `updated_by`, `updated_at`.
Unique constraint: `(brand_id, month)`.

**UI:**

- `src/components/brand-monthly-stats-panel.tsx` (yeni komponent):
  Yeni kayıt, yatırım yapan üye, FTD, yatırım/çekim tutarı, para birimi
  ve not alanları. Form üzerinden marka veya admin (impersonation modunda)
  güncelleyebilir.
- `src/app/marka/izlenmeler/page.tsx`: Aylık operasyon paneli sayfaya
  yerleşti, `resolveBrandViewId` ile dinamik marka çözümleme.
- `src/app/izlenme/page.tsx`: Admin'in marka kartlarında her ay için aynı
  metrikler özet halinde görünüyor.

**Senkron:**

- `src/lib/db/mappers.ts`: `brandMonthlyStatsToRow` — `updated_at` DB
  trigger'ına bırakıldı.
- `src/lib/db/repository.ts`: `syncBrandScoped` — marka rolü yalnızca
  kendi `brandId`'sine ait `brand_monthly_stats` satırını yazabilir
  (`onConflict: "brand_id,month"`).

---

## 3. Admin impersonation altyapısı (yayıncı + marka)

`src/store/panel-view.ts` Zustand store'u genişletildi:

- Yeni `BrandViewAs` arayüzü, `brandViewAs` state'i.
- Aksiyonlar: `enterBrandPanel`, `exitBrandPanel` (ayrıca mevcut
  `enterStreamerPanel` / `exitStreamerPanel`).
- İki impersonation aynı anda aktif olamaz — her biri diğerini temizler.
- Yardımcı `resolveBrandViewId(role, brandId, brandViewAs)` admin
  impersonation veya gerçek marka kullanıcısı için doğru marka kimliğini
  döner.

**Erişim ve banner:**

- `src/store/auth.ts`: `canAccess` artık `brandViewAs` parametresini de
  alıp admin'in marka rotalarına erişimine izin veriyor. `effectiveRole`
  benzer şekilde her iki impersonation durumunu kapsıyor.
- `src/components/auth-shell.tsx`: `canAccess` çağrısı güncellendi.
- `src/components/panel-view-banner.tsx`: Marka için ayrı amber bant
  eklendi (Tag ikonu, "marka paneli · yönetici görünümü").
- `src/components/sidebar.tsx`: Admin marka impersonation'unda
  `BRAND_NAV` gösteriliyor. Logout ve bildirim butonlarına `aria-label`
  eklendi.
- **Giriş butonları:**
  - `src/app/izlenme/page.tsx`: Brand kartlarında "Marka paneli" butonu.
  - `src/app/kullanicilar/page.tsx`: `role="brand"` kullanıcılarının
    satırında `ExternalLink` ile direkt marka paneline geçiş butonu.

**Auto-clear → manuel-clear (yeni davranış):**

Önceki sürümde admin `/marka` veya `/yayinci` rotalarından çıkınca
impersonation state'i siliniyordu. Yeni sürümde bu davranış kaldırıldı.
Bunun yerine `src/components/impersonation-chip.tsx` (yeni) ile global
floating chip: admin başka sayfadayken bile "X markası olarak
görüntülüyorsun" hatırlatmasını üst-orta hizalı bir kapsülde görünüyor;
tek tıkla impersonation'dan çıkılabiliyor.

**Login/logout temizliği:**

- `src/store/auth.ts`: Hem `login` hem `logout` sırasında
  `usePanelView.setState({ panelViewAs: null, brandViewAs: null })`
  çağırılıyor — eski oturumun impersonation state'i yeni oturuma sızmıyor.

---

## 4. Senkronizasyon güvenliği ve audit log sertleştirmesi

- `src/lib/db/repository.ts` → `deleteNotIn`: `ids.length === 0` ama
  `existing.length > 0` ise hata fırlatılıyor (boş listeyle tüm satırların
  silinmesi engellendi — bootstrap çakışmasında veri kaybı koruması).
- `src/components/data-provider.tsx`: `bootstrapOk` state'i eklendi.
  Bootstrap başarısız olursa `/api/sync` çağrıları tamamen devre dışı
  bırakılıyor (kötü local state'in DB'yi silmesi önleniyor).
- `src/app/api/audit/route.ts`: POST handler artık `actor_id` ve
  `actor_name` değerlerini **yalnızca** session'dan türetiyor; client
  body'sinden gelen değerler yok sayılıyor (audit spoofing korumalı).
- `src/store/audit-log.ts`: `logAudit` fetch çağrısı body'de actor
  alanlarını göndermiyor.

---

## 5. Mapper tutarlılığı

- `src/lib/db/mappers.ts` → `weeklyPlanToRow`: `p.createdAt` varsa
  kullanılıyor, yoksa DB DEFAULT `now()` çalışıyor. Yeniden senkronlarda
  `created_at` damgası bozulmuyor.

---

## 6. Routing tutarlılığı ve UX iyileştirmeleri

- `src/components/auth-shell.tsx`:
  - Admin doğrudan `/marka/*` URL'sine `brandViewAs` olmadan gelirse
    `/izlenme`'ye yönlendirilir; aynı şekilde `/yayinci/*` için
    `/maaslar`. Lock screen yerine kullanışlı yönlendirme.
  - Mobilde hamburger menünün içeriğin üstüne çakıldığı padding sorunu
    `pt-14 md:pt-0` ile düzeltildi.
- `src/app/yayinci/layout.tsx`: `pendingCount` admin impersonation
  durumunda `panelViewAs?.employeeId`'i de hesaba katıyor — doğru yayıncı
  için bekleyen harcama rozeti.
- `src/app/marka/layout.tsx`: Çift gösterilen "yönetici görünümü" banner
  kaldırıldı (üst şerit zaten gösteriyor).

---

## 7. YENİ ÖZELLİKLER (`feature ideas` listesi 1–15)

### #1 — Marka bildirim merkezi

**Dosya:** `src/app/marka/bildirimler/page.tsx` (yeni)

Marka hesabına (veya admin impersonation modundayken o markaya) gönderilen
bildirimleri liste halinde gösterir. Tür ve okundu/okunmadı filtreleri,
toplu işaretleme ve tekil silme aksiyonları. Brand bildirim kapısı (`forRole === "brand"` + `forUserId` eşleşmesi) burada birleşik.

`src/app/marka/layout.tsx` ve `src/components/sidebar.tsx` (`BRAND_NAV`)
nav listelerine eklendi.

### #4 — Marka KPI trend grafikleri

**Dosya:** `src/components/brand-monthly-trend.tsx` (yeni)

Son 6 aylık `brand_monthly_stats` verilerinin iki grafiği:

1. Kayıt vs Yatırım yapan üye (AreaChart)
2. Yatırım vs Çekim (BarChart)

Ayrıca 6 aylık toplamları gösteren KPI kareleri (kayıt, yatırım yapan,
FTD, net yatırım). `src/app/marka/izlenmeler/page.tsx`'e yerleştirildi —
hem brand kullanıcılar hem admin impersonation görüyor.

### #6 — Marka stats değişiklik geçmişi

**Dosya:** `src/components/brand-monthly-stats-panel.tsx`

Form altına son güncelleme satırı: `Son güncelleme: 19 May 2026 14:32 ·
[kullanıcı adı]`. `updatedBy` foreign key + `updatedAt` zaten DB'de
mevcuttu; UI'da artık görünür.

### #7 — Audit log filtreleme

**Dosya:** `src/app/kullanicilar/page.tsx`

İşlem günlüğü kartı `AuditLogPanel` komponentine taşındı. Filtreler:

- Eylem türü (12 farklı `AuditAction`)
- Eylemi yapan kişi (otomatik benzersiz liste)
- Dönem (7g / 30g / 90g / tümü)
- Serbest metin araması (detay, kullanıcı veya eylem etiketinde)

Filtre etiketi: `{filtreli}/{toplam} kayıt`. Max 200 sonuç render edilir.

### #8 — Marka ödeme planı

**Dosya:** `src/app/marka/odemeler/page.tsx` (yeni)

`PlannedItem` ve `PlannedItemPayment` üzerinden bu markaya bağlı bütçe
kalemleri ve taksitler. KPI kareleri (toplam plan / ödenmiş / bekleyen /
harcanan), yaklaşan ödemeler kartı (ilk 5 pending), ay seçici ile aylık
detay listesi ve tüm planlı kalemler tablosu. Sidebar nav'a `Wallet`
ikonuyla eklendi.

### #9 — Marka × yayıncı attribution raporu

**Dosya:** `src/app/izlenme/page.tsx`

Yeni `BrandAttributionCard` komponenti; her aktif marka için satır:

- Yayıncılar (atıf listesi)
- İzlenme (brand_viewership toplamı)
- Kayıt (brand_monthly_stats)
- FTD
- Net yatırım (yatırım − çekim)
- İçerik harcaması (USD, ay için)
- **CPR** — Cost per registration (içerik harcaması / kayıt)

İçerik üretimine harcanan dolar ile getirilen kayıt arasındaki verim
metriği için yönetici tek bakışta görebilir.

### #12 — İçerik harcaması SLA / aging paneli

**Dosya:** `src/app/icerik-harcamalari/page.tsx`

Yeni `ExpenseSlaPanel` komponenti:

- Bekleyen yayıncı gönderimlerini 3 kovaya ayırır: **Taze (≤2g)** /
  **Uyarı (3-6g)** / **Gecikme (7+g)**.
- 7+ gün bekleyenler "kırmızı liste" olarak listelenir (tıklanınca
  review modalı açılır).
- Yayıncıya göre bekleme dağılımı (en eski kaç gün, kaç kayıt).

Sadece admin/auditor görüyor; mevcut "Bekleyen onaylar" kartından önce
gösterilir.

### #13 — Yayıncı plan değişikliği bildirimi

**Dosya:** `src/app/takvim/page.tsx`

Admin başka bir yayıncının `ScheduleSlot` veya `WeeklyPlan` kaydını
eklediğinde / güncellediğinde / sildiğinde ilgili yayıncıya
`schedule_updated` tipinde bildirim atılır. Admin kendi slotunu
güncellediğinde tetiklenmez (gürültüsüz).

İçerik:

- Slot için: `Pazartesi 20:00–23:00 · Twitch`
- Plan için: `2026-05-19 · 20:00–23:00 · Yayın · Galabet`

Bildirim `href: /yayinci/takvim` ile yönlendirilir.

### #14 — PWA manifest

**Dosya:** `public/manifest.webmanifest` (yeni), `src/app/layout.tsx`

- Standalone display, `theme_color` light/dark uyumlu (mevcut viewport
  zaten dual).
- `appleWebApp.capable + statusBarStyle` ayarlandı.
- `foxlogo.png` 192/512 ikon olarak referans alındı (maskable + any).
- Mobil cihazlarda "Ana ekrana ekle" çağrısı tetiklenir.

### #15 — Global impersonation chip

**Dosya:** `src/components/impersonation-chip.tsx` (yeni)

Admin bir yayıncı veya marka olarak impersonation modundayken;
`/yayinci/*` veya `/marka/*` dışında **herhangi bir sayfada** üst-orta
hizalı bir floating chip görünür:

- `[ikon] Galabet · marka paneli` (tıklayınca o panele döner)
- `[X]` butonu impersonation'dan çıkar.

Önceki "auto-clear on nav" davranışı kaldırıldı — artık admin başka
sayfaları gezerken bile impersonation state'ini koruyor, ama bu chip
sayesinde sürekli farkındaysa kafa karışmıyor.

---

## 8. Migrations dokunulmadı

Bu turda hiçbir yeni migration eklenmedi; tüm yeni özellikler ya UI
katmanında ya da mevcut tabloları (`brand_monthly_stats`,
`app_notifications`, `audit_logs`, `planned_items`,
`planned_item_payments`, `schedule_slots`, `weekly_plans`) kullanıyor.

### 8.2 Otomatik link yenileme (RapidAPI · YouTube / Instagram / TikTok)

`brand_links` artık RapidAPI Basic planları üzerinden günlük bir cron ile
otomatik izlenme/begeni/yorum güncellemesi alır.

**Plan limitleri (kullanıcı onayı ile sabitlendi):**

- YouTube (`youtube138`): 100 req/ay · 5 req/sn
- Instagram (`instagram-api-fast-reliable-data-scraper`): 100 req/ay · 1000 req/sa
- TikTok (`tiktok-scraper7`): 300 req/ay · 120 req/dk

**Bütçe stratejisi:** Her platformun aylık kotasının %85'i güvenli budget
olarak ayrılır (%15 manuel refresh + hata payı). Cron günde 1 kez çalışır;
her çalıştırma, kalan kotayı kalan güne bölerek adaptif batch boyutu üretir.

**Yeni migration:** `supabase/migrations/20260519140000_link_auto_refresh.sql`

- `brand_links` tablosuna 8 yeni kolon: `external_ref`, `last_checked_at`,
  `last_likes`, `last_comments`, `last_shares`, `last_check_error`,
  `check_count`, `error_count`.
- `api_quota_usage` tablosu: `(platform, month)` UNIQUE, `requests_used`,
  `monthly_limit`, `last_request_at`.
- `api_refresh_runs` tablosu: cron çalıştırma logu (debug/observability).
- Oldest-first round-robin için indeks `brand_links_auto_track_check_idx`.
- RLS açık, policy yok — service-role üzerinden API katmanında korunuyor.

**Yeni server modülleri (`src/lib/social-api/`):**

- `config.ts` — plan limitleri, `calcBatchSize`, `estimateRefreshIntervalHours`,
  `formatRefreshInterval`.
- `platform-detect.ts` — `detectPlatform(url, manualPlatform)` →
  `{ platform, externalRef, kind }`. YouTube (watch/shorts/embed/handle/channel),
  Instagram (p/reel/tv/username), TikTok (video/user).
- `clients.ts` — `fetchMetricsForLink(detected)` → tek giriş noktası. Esnek
  sayı çıkarımı (`pickFirstNumber`) farklı API response şekillerini tolere
  eder.
- `quota.ts` — `getMonthlyUsage`, `incrementUsage`. Atomik değil ama tek
  giriş noktasıyla yeterli.
- `refresh-runner.ts` — `runPlatformRefresh`, `runAllPlatformsRefresh`,
  `refreshSingleLink`. Linkleri `last_checked_at ASC NULLS FIRST` ile seçer,
  başarılı her çağrıdan sonra kotayı 1 artırır, snapshot kaydeder, hata
  durumunda `last_check_error` ve `error_count` günceller.

**Yeni API rotaları:**

- `GET /api/cron/refresh-links` — Vercel cron entry. `Authorization: Bearer
  $CRON_SECRET` ile korunur; secret yoksa açık kalır (dev için). Tüm
  platformları sırayla çalıştırır.
- `POST /api/admin/refresh-link/[id]` — admin/auditor için tek link manuel
  refresh. Kotadan 1 düşer; güvenli sınır dolmuşsa engellenir.
- `GET /api/admin/refresh-status` — UI'nın okuduğu durum endpoint'i.
  Platform başına kullanım/budget/batch/interval + son 10 cron run.

**Vercel Cron:**

`vercel.json` eklendi — günde bir kez 03:00 UTC'de
`/api/cron/refresh-links` çağrılır. Vercel Hobby uyumludur (1 günlük slot).

**Env vars (yeni):**

- `RAPIDAPI_KEY` — RapidAPI hesabınızın anahtarı.
- `CRON_SECRET` — opsiyonel, cron endpoint'i korur. Min. 16 karakter.

**UI değişiklikleri:**

- `/izlenme` sayfasında yeni `AutoRefreshStatusPanel` — her platform için
  kotanın yüzde kaçı dolduğu (renkli progress bar), batch boyutu, tahmini
  yenileme aralığı (`≈ 2.5 günde bir` gibi), takip edilen link sayısı,
  rate limit, son 10 cron run.
- `BrandLinksPanel` — her link satırında otomatik kontrolün son ne kadar
  önce yapıldığı (`Bot ikonu · 4 sa önce` gibi). URL desteklenmiyorsa
  "otomatik (manuel)" rozeti, hata varsa kırmızı "hata" rozeti.

**Davranış:**

- Cron sadece `status = 'active' AND auto_track = true` olan linkleri
  arar; URL platform tespiti başarısızsa o link skip edilir.
- Aynı gün içinde otomatik refresh yapılırsa snapshot row'u
  `s-auto-{linkId}-{YYYYMMDD}` ID'siyle upsert edilir (gün başına 1 row).
- Manuel snapshot ve otomatik snapshot ayrı row'lar değil — günlük tek
  satıra konsolide olur.

---

### 8.1 Brand rolü için bootstrap + notification API patch

Yeni özelliklerin (özellikle `/marka/odemeler` ve `/marka/bildirimler`)
end-to-end çalışması için üç ayar daha yapıldı:

1. **Bootstrap (`src/lib/db/repository.ts`)** — marka rolünün bootstrap
   dönüşüne aşağıdaki tablolar eklendi:
   - `plannedItems.filter(p => p.brandId === bid)`
   - `plannedItemPayments` (sadece bu plannedItems'a ait taksitler)
   - `employees` (aktif yayıncı + moderatör — marka takvimi ve
     izlenmelerde isim çözümlemek için)
   - `weekBrandReels.filter(r => r.brandId === bid)`

2. **Notification API (`src/app/api/notifications/route.ts`)** —
   - `PATCH`: admin/auditor dışında **brand ve streamer rolleri** de
     kendi bildirimlerini okundu işaretleyebilir. Self-mode'da
     `forRole`/`forUserId` body'den değil, oturumdan zorlanır.
   - `DELETE`: brand/streamer kendi bildirimini silebilir (id+role+userId
     scope edilir; başkasının bildirimi 404 döner). Toplu silme
     (olderThanDays) hâlâ yalnızca admin.

3. **Marka bildirimler sayfası** — admin impersonation modunda artık
   gerçek marka kullanıcısının `user.id`'sini bulur ve bildirimleri
   ona göre filtreler. Admin impersonation'dayken yapılan "tümünü
   okundu işaretle" çağrısı doğru `forUserId` ile gider.

**RLS:** Mevcut tablolar zaten RLS-enabled ve policy yok; tüm erişim
service-role (`getSupabaseAdmin()`) üzerinden API katmanından yapılıyor.
Bu nedenle yeni endpoint'ler / bootstrap filtreleri uygulama katmanında
korunuyor — yeni Postgres policy gerektirmiyor.

---

## 9. Test ve doğrulama

- `npx tsc --noEmit` → ✓ hata yok.
- Otomatik lint (Cursor `ReadLints`) → ✓ tüm dokunulan dosyalarda temiz.
- Admin/marka/yayıncı/denetçi rolleri için manuel akış kontrolü:
  - PIN değiştirme + sunucuda doğrulama
  - Marka olarak ay seçip metrik girme
  - Admin → marka paneline geçme → metrik düzenleme → çıkma (chip ile)
  - Marka olarak ödeme planı + bildirimler sayfası açma
  - Audit log filtrelemesi
  - Yayıncı slotunu admin tarafından düzenlemek → yayıncıya bildirim

---

## 10. Commit / deploy

Tüm değişiklikler `main` branch'inde, tek bir commit ile push'lanmıştır:
`feat: marka paneli + admin impersonation + 10 yeni özellik (#1, #4, #6,
#7, #8, #9, #12, #13, #14, #15)`.
