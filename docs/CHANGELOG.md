# CHANGELOG

## v7 — 2026-05-15 (Foxstream rebrand · Supabase üretim · denetim & bildirim merkezi)

### Marka & Dağıtım
- **Yeniden adlandırma**: "Lanetkel Mali Dashboard" → **Foxstream**. Tüm sayfalar, metadata, login alt-başlığı, README ve PDF/CSV başlıkları güncellendi.
- **Vercel prod**: [`foxstreaming.vercel.app`](https://foxstreaming.vercel.app) (alias değiştirildi).
- **`src/app/layout.tsx`** — `title.template`, `applicationName`, `metadataBase`, `openGraph` (tr_TR), favicon eklendi.

### Veri Katmanı (Supabase)
- **22 tablo** ve 4 saklı fonksiyon (`set_updated_at`, `sum_approved_content_expenses`, `pending_expense_count`, `calc_kasa_balance`). RLS açık, servis rolü API üzerinden erişir.
- **`app_users`, `audit_logs`, `app_notifications`** — kalıcı log ve oturum izleme.
- **`payment_statuses` + `paid_by` + `approved_at`** — yönetici ödeme onaylarının kim/ne zaman izi.
- **`storage.buckets.proofs`** — yayıncı kanıt resimleri için public read bucket (listing kapalı).
- **`app_settings`** (anahtar/JSON) ve **`notification_preferences`** tablosu — yönetici ayarlanabilir eşikler.
- **`expense_paid`** notification tipi enum'a eklendi.

### Yetkilendirme
- **Ana yönetici koruması** — `orkun` (`u-admin`) silinemez, pasifleştirilemez, rolü değiştirilemez, kullanıcı adı düzenlenemez. UI + sunucu API'sinde guard.
- **Yöneticiler diğer yöneticileri oluşturabilir** — `addUser` zaten serbest, sayfa açıklaması yenilendi.
- **Denetçi onay yetkisi** — auditor `content_expenses` ve `app_notifications` üzerinde scope'lu yazım yapabilir; silme yok.
- **Yönetici ödeme onayı** — `payment_statuses` ve `content_expenses` için `paidBy` + `approvedAt` izleme.

### Kullanıcı Deneyimi
- **`ProofUploader`** — yayıncı kanıt için URL yapıştır veya görsel yükle (Supabase Storage).
- **Aylık PDF/CSV indirme** — kasa, bordro ve içerik harcamaları için `MonthlyExportMenu` ve ortak `src/lib/monthly-exports.ts`.
- **Bildirim Merkezi (`/bildirimler`)** — yönetici ve denetçilere açık.
  - Bildirim akışı + rol/tip/arama filtresi + okundu/sil eylemleri.
  - **Yönetici duyuru gönderir** (tüm role veya tek kullanıcıya, opsiyonel link & tip).
  - **Eşik ayarları** — kasa düşük uyarısı (USDT), bordro hatırlatıcı aç/kapat, "kaç gün önceden", tip-bazlı sessize alma.
  - Eski bildirimleri toplu silme.
- **Kasa düşük uyarısı** — `KasaLowAlertEffect` günde bir, yapılandırılan eşik altında admin + denetçi'ye bildirim bırakır.
- **Bordro hatırlatıcı** — ayarlar üzerinden devre dışı bırakılabilir veya "kaç gün önce" değiştirilebilir.

### Maaş Mantığı
- **Geriye dönük kira propagasyonu** — `syncRentSupportFromMonth`: bir çalışanın `rentSupport` değeri güncellendiğinde, başlangıç ayından itibaren mevcut `salaryExtras` (type `rent`) kayıtları yeniden hesaplanır.

### Düzeltmeler
- **Beyaz sayfa** — `/login` üzerinde `DataProvider`'ın sonsuz spinner durumu çözüldü; Supabase mode'da user yokken hemen `ready` set ediliyor.
- **Sync sırası** — `/api/seed` artık önce `app_users`, sonra `syncAppData` çağırıyor; foreign-key hatası ortadan kalktı.
- **Supabase linter** — `search_path = ''` (public fonksiyonlar) ve `proofs_public_read` policy kaldırıldı.

### Migrations
- `20260515120000_initial_schema.sql` — temel 22 tablo + enum + trigger.
- `20260515130000_storage_proofs.sql` — kanıt görseli bucket.
- `20260515133000_security_advisors.sql` — `search_path` sabitleme.
- `20260515143000_payment_approval_metadata.sql` — `payment_statuses.paid_by` + `approved_at`.
- `20260515160000_notification_settings.sql` — `app_settings`, `notification_preferences`, `expense_paid` enum.

## v6 — 2026-05-14 (Yayıncı self-service + Auditor + Notifications)

### Yeni
- **Auditor (Denetçi) rolü** — kasa, içerik harcaması, maaş ve rapor sayfalarına read-only erişim
- **`/denetci` özet paneli** — denetim için tek sayfada gösterge
- **`/kullanicilar` admin sayfası** — kullanıcı ekleme, PIN sıfırlama, aktif/pasif toggle
- **Bildirim sistemi** — `Notification` entity, sidebar çanı, özet feed
- **Yayıncı içerik harcaması gönderimi** — `/yayinci` panelinden screenshot URL'siyle gönderim
- **Admin onay/red akışı** — `reviewStatus`, `reviewerNote`, audit trail
- **WeeklyPlan** — yayıncı bu hafta/sonraki hafta plan editörü
- `useIsReadOnly()` hook — auditor için CRUD butonları gizler

### Düzeltme
- **Ramiz Nisan 2026 maaşı paid olarak işaretlendi** (1 Mayıs 2026 ödendi — Telegram grubu kaydına göre)
- `ContentExpense` Nisan 2026 kalemleri `paid: true, paidDate: 2026-05-01, reviewStatus: approved`

### Schema
- `Notification` — yeni entity
- `WeeklyPlan` — yeni entity
- `ContentExpense` — `screenshotUrl`, `submittedAt`, `submittedBy`, `reviewStatus`, `reviewedAt`, `reviewerNote` alanları
- `AppUser` — `lastLoginAt` opt
- Persist key: v5 → **v6**

## v5 — 2026-05-13 (Auth + 3 rol)

- Auth store + `/login` ekranı
- 4 kullanıcı (admin + 3 yayıncı)
- AuthShell route guard
- `/yayinci` yayıncı paneli

## v4 — 2026-05-13 (Kasa + Marka takibi + İçerik harcaması)

- `KasaTransaction` entity + `/kasa` sayfası
- `Brand` + `BrandLink` + `LinkSnapshot` entity'leri
- `/izlenme` yeniden yapılandırıldı
- `ContentExpense` entity + `/icerik-harcamalari`
- Ramiz Nisan 2026 raporu seed
- Telegram grup mesajlarından 12 kasa kaydı

## v3 — 2026-05-12 (Yayıncı yapısı)

- 3 aktif yayıncı + 1 koordinatör
- Ramiz/Lucy/Acelya detayları + kira destekleri
- Sponsor TX bazlı dış gelir (52 işlem)

## v2 — 2026-05-11 (UI overhaul)

- shadcn/ui + framer-motion entegrasyonu
- Light tema
- Sidebar grouping

## v1 — Initial scaffold
