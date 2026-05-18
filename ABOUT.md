# Foxstream

**Foxstream**, küçük yayıncı stüdyoları için tasarlanmış bütünleşik bir operasyon panelidir. Maaş, kasa, marka takibi, içerik harcaması onayı ve denetim akışlarını tek bir Next.js + Supabase uygulamasında birleştirir.

> Canlı: [`foxstreaming.vercel.app`](https://foxstreaming.vercel.app)

## Neyi çözer?

Telegram gruplarında dolaşan ekran görüntüleri, manuel Excel tabloları ve gece yarısı "Lucy'ye kira yatırdık mı?" mesajları yerine **tek panel**:

- **Yayıncı kendi harcamasını gönderir** → ekran görüntüsü/dekont yükler.
- **Denetçi inceler ve onaylar** → onay/red/ek bilgi akışı tetiklenir.
- **Yönetici ödemeyi mühürler** → bordro net rakamlarına geçer; ana yönetici kilidi vardır.
- **Kasa hareketleri otomatik akar** → eşik altına düşerse uyarı gelir.
- **Aylık raporlar tek tıkla** → kasa, bordro ve harcama PDF/CSV indirilir.

## Roller

| Rol | Erişim |
|---|---|
| **Ana yönetici (`orkun`)** | Her şey · silinemez/değiştirilemez |
| Yönetici | Tüm CRUD · ödeme onayı · kullanıcı ekleme · bildirim ayarları |
| Denetçi | Read-only + harcama inceleme · audit log · aylık PDF/CSV |
| Yayıncı | Kendi maaşı, harcaması, takvimi, marka linkleri |
| Marka | Yayıncı takvimi + atanan marka için izlenme |

## Mimari (özet)

- **Frontend**: Next.js 15 (App Router) + Tailwind v4 + shadcn/ui + Zustand.
- **Backend**: Next.js API Routes (Node runtime) — `/api/sync`, `/api/bootstrap`, `/api/notifications`, `/api/upload`, `/api/audit`, `/api/users/*`.
- **DB**: Supabase Postgres — 22 tablo, RLS açık, **servis rolü yalnızca API üzerinden** erişir.
- **Storage**: Supabase `proofs` bucket — kanıt görselleri.
- **Auth**: Username + PIN, HMAC SHA-256 imzalı cookie oturumu (`SESSION_SECRET`).
- **Mode toggle**: env yoksa otomatik **localStorage** demo modu.

## Hızlı başlangıç

```bash
git clone <repo> && cd foxstream
npm install
npm run dev
# http://localhost:3000 → /login → orkun / lanetkel2026
```

Üretim kurulumu için: [`DEPLOY.md`](./DEPLOY.md) ve [`docs/SUPABASE.md`](./docs/SUPABASE.md).

## Dokümantasyon haritası

- [`README.md`](./README.md) — Sayfa & özellik listesi
- [`docs/CHANGELOG.md`](./docs/CHANGELOG.md) — Sürüm geçmişi (v7 son)
- [`docs/PLAN.md`](./docs/PLAN.md) — Mimari + erişim matrisi
- [`docs/AUTH.md`](./docs/AUTH.md) — Auth & rol notları
- [`docs/SUPABASE.md`](./docs/SUPABASE.md) — DB şeması + migration zinciri
- [`DEPLOY.md`](./DEPLOY.md) — Vercel deployment & env değişkenleri
