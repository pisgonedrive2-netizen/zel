# Foxstream Dashboard — Geliştirme Planı

## Mevcut Mimari (v5)

- **Framework**: Next.js 15 (App Router, Turbopack)
- **State**: Zustand + persist (`localStorage`)
- **UI**: Tailwind v4 + shadcn/ui + framer-motion + Recharts
- **Auth**: Client-side PIN bazlı (Zustand persist, 3 rol)

## Roller & Erişim Matrisi

| Sayfa | Admin | Yayıncı | Denetçi |
|---|---|---|---|
| `/login` | ✓ | ✓ | ✓ |
| `/ozet` | ✓ tam | — | ✓ read-only KPI |
| `/maaslar` | ✓ CRUD | — | ✓ read-only |
| `/rapor` | ✓ CRUD | — | ✓ read-only + export |
| `/kasa` | ✓ CRUD | — | ✓ read-only |
| `/takvim` | ✓ CRUD | — | — |
| `/izlenme` | ✓ CRUD | — | — |
| `/icerik-harcamalari` | ✓ CRUD + onay | — | ✓ read-only |
| `/dis-gelir` | ✓ CRUD | — | ✓ read-only |
| `/ic-gelir` | ✓ CRUD | — | — |
| `/giderler` | ✓ CRUD | — | ✓ read-only |
| `/planlanan` | ✓ CRUD | — | — |
| `/kullanicilar` | ✓ admin only | — | — |
| `/yayinci` | — | ✓ kendi verisi | — |
| `/denetci` | — | — | ✓ özet panel |

## Tamamlanmış İşler (v1 → v5)

- ✅ Tüm temel CRUD sayfaları
- ✅ Maaş hesabı + carry-forward avans + kira desteği
- ✅ Dış gelir geçmiş kayıtları (52 sponsor TX)
- ✅ Marka takibi + sosyal medya link snapshot'ları
- ✅ Kasa hareketleri (Telegram grubu kayıtları seed'lendi)
- ✅ Yayıncı içerik harcamaları (Ramiz Nisan raporu)
- ✅ Auth: 3 rol (admin / streamer / login)
- ✅ Sidebar role-based nav
- ✅ Yayıncı kişisel paneli (5 sekme)

## v6 Hedefleri (bu iterasyon)

### 1. Ödeme Durumu
- [x] **Ramiz Nisan 2026 ödemesi 1 Mayıs'ta paid olarak işaretle**
  - PaymentStatus seed: `{employeeId: emp-ramiz, month: 2026-04, paid: true, paidDate: 2026-05-01}`

### 2. Yayıncı Self-Service
- [x] **Haftalık harcama gönderim formu** — yayıncı kendi panelinden ekleyebilir
  - Marka, tutar (USD + opt THB), açıklama, kanıt URL (Gyazo/Imgur/dekont)
  - Submit edince `reviewStatus="pending"` olarak admin'e iletilir
- [x] **Haftalık takvim editor** — yayıncı kendi haftalık planını girer
  - "Bu hafta" / "Sonraki hafta" sekmesi
  - Gün × saat plan; aktivite (Yayın / Vlog / Edit / İzin) + marka tag
- [x] Görüntülenme: yayıncı yalnızca kendi kayıtlarını görür ve düzenler

### 3. Bildirim Sistemi
- [x] `Notification` entity
- [x] Tetikleyiciler:
  - Yayıncı harcama gönderdi → admin + denetçi
  - Yayıncı takvim güncelledi → admin
  - Admin harcama onayladı/reddetti → ilgili yayıncı
  - Yeni avans eklendi → denetçi
- [x] Sidebar'da çan ikonu + okunmamış sayısı
- [x] Özet sayfasında bildirim feed'i

### 4. İçerik Harcaması — Onay Akışı
- [x] `ContentExpense` extension: `screenshotUrl`, `submittedAt`, `submittedBy`, `reviewStatus`, `reviewedAt`, `reviewerNote`
- [x] Admin sayfasında bekleyen onaylar bölümü
- [x] Onay/red butonu + not yazma
- [x] Denetçi inceleyebilir (read-only, "audited" işaretleyebilir)

### 5. Denetçi (Auditor) Rolü
- [x] Yeni rol: `auditor`
- [x] Yeni kullanıcı: `denetci` / PIN: `denetim2026`
- [x] Read-only erişim: kasa, içerik harcamaları, maaşlar, rapor
- [x] Bağımsız `/denetci` özet sayfası
- [x] Her sayfa için `useIsReadOnly()` hook → CRUD butonları gizlenir

### 6. Kullanıcı Yönetimi (Admin)
- [x] `/kullanicilar` sayfası
- [x] Mevcut kullanıcı listesi (rol, durum, son giriş tahmini)
- [x] Yeni kullanıcı ekleme — auto-generated PIN (8 karakter), kopyalanır
- [x] PIN sıfırlama — yeni PIN gösterilir
- [x] Kullanıcı pasifleştirme/aktifleştirme
- [x] Yayıncı kullanıcıyı Employee kaydına bağlama dropdown

## v7+ İdeal Gelecek

- [ ] Sunucu tarafı auth (NextAuth + Postgres)
- [ ] Görsel/dosya yükleme (Vercel Blob)
- [ ] YouTube/Kick API entegrasyonu (otomatik izlenme snapshot'ı)
- [ ] Telegram bot — kasa güncellemelerini otomatik parse
- [ ] Mobil PWA + push bildirim
- [ ] Sponsor sözleşmesi PDF üretici
- [ ] Multi-currency (USD/THB/TL eşzamanlı)
- [ ] İki faktörlü doğrulama
