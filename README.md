# Foxstream

Foxstream için mali takip, yayıncı yönetimi ve denetim paneli — 2026 sürümü.

## Hızlı Başlangıç

```bash
npm install
npm run dev
```

Uygulama http://localhost:3000 adresinde açılır. İlk açılışta `/login` sayfasına yönlenir.

## Roller & Giriş Bilgileri

| Kullanıcı | PIN | Rol | İndirme |
|---|---|---|---|
| `orkun` | `lanetkel2026` | **Ana Yönetici** | `/ozet` — tüm sayfalar (silinemez) |
| `ramiz` | `ramiz1234` | Yayıncı | `/yayinci` |
| `lucy` | `lucy1234` | Yayıncı | `/yayinci` |
| `acelya` | `acelya1234` | Yayıncı | `/yayinci` |
| `denetci` | `denetim2026` | Denetçi | `/denetci` — read-only |

> Admin, `/kullanicilar` sayfasından yeni kullanıcı (yöneticiler dahil) oluşturabilir, PIN sıfırlayabilir, hesabı pasifleştirebilir. **Ana yönetici (`orkun`)** silinemez/pasifleştirilemez/rolü değiştirilemez — bu sunucu API'sinde de zorlanır.

## Sayfalar

### Yönetici (Admin)

| Sayfa | URL | İçerik |
|---|---|---|
| Özet | `/ozet` | KPI özeti, bekleyen onaylar, bildirim feed |
| Maaşlar | `/maaslar` | Çalışan maaş + kira + avans + aylık ödeme · **bordro PDF/CSV** |
| Ödeme Raporu | `/rapor` | Aylık ödeme tablosu · **PDF/CSV** |
| Kasa | `/kasa` | Telegram grubu denetim hesabı · **aylık PDF/CSV** |
| Kullanıcılar | `/kullanicilar` | Kullanıcı CRUD + PIN yönetimi + ana yönetici koruması |
| **Bildirim Merkezi** | `/bildirimler` | Bildirim akışı · duyuru gönder · kasa/bordro eşikleri |
| Haftalık Takvim | `/takvim` | Yayıncı şablon + ad-hoc plan görünümü |
| Marka İzlenme | `/izlenme` | Marka × platform × link × snapshot izlenme |
| İçerik Harcamaları | `/icerik-harcamalari` | Yayıncı gönderimleri · onay/ödeme · **aylık PDF/CSV** |
| Dış Gelir (Geçmiş) | `/dis-gelir` | Sponsor TX kayıtları |
| İç Gelir | `/ic-gelir` | İç proje gelirleri |
| Giderler | `/giderler` | Operasyonel gider takibi |
| Planlanan | `/planlanan` | Gelecek hedef yatırımlar |

### Yayıncı

| Sekme | İçerik |
|---|---|
| Maaş Detayı | Aylık brüt → net hesabı, kira, avans, kayıtlı cüzdan |
| Harcamalarım | Bu hafta + tüm geçmiş gönderimler, **harcama ekle** |
| Haftalık Plan | Bu hafta + sonraki hafta plan editörü |
| Hesaplar & Linkler | Yayın platformları + marka linkleri |
| Geçmiş Aylar | Tüm aylardaki maaş + harcama özeti |

### Denetçi (Auditor)

| Sayfa | Erişim |
|---|---|
| `/denetci` | Özet — kasa, bekleyen onaylar, son bildirimler |
| `/kasa` | Read-only · aylık PDF/CSV indir |
| `/icerik-harcamalari` | Onayla/Reddet/Bilgi iste + "Audit ✓" + aylık PDF/CSV |
| `/maaslar`, `/rapor`, `/giderler` | Read-only + PDF/CSV |
| `/bildirimler` | Bildirim akışı + ayar görüntüleme (düzenleme yöneticiye özel) |

## Özellikler

### v7 — Foxstream rebrand + Supabase üretim + Bildirim Merkezi (2026-05-15)

- **Marka**: Lanetkel → **Foxstream**. Tüm görsel ve metinler güncellendi.
- **Supabase üretim** — 22 tablo, RLS, 4 fonksiyon. Tüm CRUD'lar `/api/sync` üzerinden.
- **Kanıt görseli yükleme** — `ProofUploader` bileşeni + `storage.buckets.proofs`.
- **Aylık PDF + CSV indirme** — kasa, bordro, içerik harcamaları için `MonthlyExportMenu`.
- **Bildirim Merkezi** (`/bildirimler`) — duyuru gönder, eşik ayarla, tip sessize al.
- **Kasa düşük uyarısı** + **Bordro hatırlatıcı** — yönetilebilir, otomatik bildirim.
- **Ana yönetici koruması** — `orkun` UI + sunucu API'sinde guard'lı.
- **Diğer yöneticiler de yönetici oluşturabilir** — `/kullanicilar` üzerinden.
- **Kira geriye dönük propagasyon** — `syncRentSupportFromMonth`.

### v6 — Yayıncı Self-Service + Denetim

- **Yayıncı harcama gönderimi**: kanıt URL (Gyazo/Imgur/dekont link) + ay/marka/kategori
- **Admin onay/red workflow'u**: 3 buton — Onayla, Reddet, Bilgi İste
- **Bildirim sistemi**: gönderim → admin + denetçi; onay/red → yayıncı
- **Haftalık plan editörü**: bu hafta + sonraki hafta, gün × saat × aktivite
- **Auditor rolü**: tüm denetim alanlarına read-only erişim
- **Kullanıcı yönetimi**: oluştur, PIN sıfırla (8 karakter otomatik), pasifleştir
- **Sidebar bildirim çanı**: okunmamış sayaç + dropdown panel
- **Özet sayfası bildirim feed**: bekleyen onaylar + son aktivite

### Önceki Sürümler

- **v5**: 3 rol auth + login + yayıncı paneli
- **v4**: Kasa + marka link snapshot + içerik harcaması entity
- **v3**: 3 aktif yayıncı + kira desteği + sponsor TX kayıtları
- **v2**: shadcn/ui + framer-motion + light tema
- **v1**: Temel CRUD + Zustand store

## Veri Modeli (Özet)

- **Employee** — id, name, role, kind (admin/streamer/coordinator), baseSalary, rentSupport, initialAdvance, paymentDay, walletAddress
- **Advance / SalaryExtra / MonthPaymentStatus** — aylık maaş hesabı
- **KasaTransaction** — in/out, fee, txid, counterparty, proof
- **ContentExpense** — date, brand, category, amountUsd, amountThb, screenshotUrl, **reviewStatus**, reviewedBy, reviewerNote, audited
- **WeeklyPlan** — employeeId, weekStart, date, activity, status
- **AppNotification** — type, forRole, forUserId, refId, read
- **Brand / BrandLink / LinkSnapshot** — marka × link × izlenme snapshot
- **AppUser** — username, pin, role, employeeId, active, lastLoginAt

**Üretim (Supabase):** Tüm veriler PostgreSQL’de kalıcıdır — detay: [`docs/SUPABASE.md`](./docs/SUPABASE.md).

**Geliştirme (env yok):** Veriler tarayıcı `localStorage`'ında saklanır.

## Stack

- **Next.js 15** (App Router + Turbopack)
- **TypeScript** + **Tailwind CSS v4**
- **Zustand** + Supabase senkronizasyonu (veya localStorage fallback)
- **Supabase** (PostgreSQL) — üretim veritabanı
- **shadcn/ui** + **framer-motion** + **lucide-react**
- **Recharts** (charts)
- **jsPDF + jspdf-autotable** (PDF rapor)

## Dokümantasyon

- [`ABOUT.md`](./ABOUT.md) — Projenin 1 dakikalık özeti (yeni)
- [`docs/PLAN.md`](./docs/PLAN.md) — Mimari + erişim matrisi
- [`docs/AUTH.md`](./docs/AUTH.md) — Roller, PIN'ler, güvenlik notları
- [`docs/CHANGELOG.md`](./docs/CHANGELOG.md) — Sürüm geçmişi (v7 dahil)
- [`docs/SUPABASE.md`](./docs/SUPABASE.md) — Supabase mimarisi + migration zinciri
- [`DEPLOY.md`](./DEPLOY.md) — Vercel deployment & env değişkenleri

## Bilinen Sınırlamalar

- Auth PIN tabanlı, oturum cookie'si (HMAC SHA-256) ile imzalanır. Brute-force koruması yok — iç ekip kullanımı içindir.
- İzlenme snapshot'ları manuel — YouTube/Kick/TikTok API entegrasyonu yol haritasında.
- Tek tenant — sade çok-organizasyon desteği yok.
- Bildirim kanalları yalnızca **in-app**. Desktop/Email "tercih" olarak tutuluyor; gönderim entegrasyonu yol haritasında.
- LocalStorage modunu sıfırlamak için tarayıcı konsolunda `localStorage.clear()` çalıştırın.
