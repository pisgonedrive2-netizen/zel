# Foxstream — Supabase + Vercel Kurulum & Deploy Rehberi

Bu adımlar tek seferlik. Tamamlandığında her `git push` veya `vercel --prod` otomatik canlıya çıkar.

## 1. Supabase — Hazır

Proje otomatik kuruldu:

| | |
|---|---|
| Proje | `lanetkel` (org: `orkuntilki`) |
| Ref | `hpztacekyayeucgokgbx` |
| URL | https://hpztacekyayeucgokgbx.supabase.co |
| Bölge | eu-central-1 |
| Dashboard | https://supabase.com/dashboard/project/hpztacekyayeucgokgbx |

Şema (22 tablo, RLS açık, enum + trigger + SQL fonksiyonlar + Storage `proofs` bucket) Migration MCP üzerinden uygulandı:

```
employees, advances, salary_extras, payment_statuses,
external_companies, sponsor_transactions, internal_projects, expense_entries,
planned_items, streamer_accounts, schedule_slots,
brands, brand_links, link_snapshots, brand_viewership,
kasa_transactions, content_expenses, weekly_plans, week_brand_reels,
app_notifications, audit_logs, app_users + storage.buckets.proofs
```

## 2. Veritabanını seed etmek (Tek seferlik)

`.env.local` sende mevcut. Terminalden:

```bash
cd /Users/orkun/Downloads/zel
npm run seed
```

Bu komut:
- 4 çalışan (Ramiz, Lucy, Acelya, Orkun)
- 5 marka (Gala, Boffice, Pipo, Hit, Padi) + 20 marka link slotu
- 30 sponsor firma + 47 sponsor işlemi
- 11 kasa hareketi (Nis–May 2026)
- 15 içerik harcaması (Ramiz Nisan raporu)
- 19 maaş extra (kira destek + avans geri ödeme)
- 1 ödeme durumu (Ramiz Nisan)
- 10 kullanıcı (admin/yayıncı/denetçi/marka)

yükler. Sonunda PIN'leri yazdırır.

### Test girişleri

| Kullanıcı | PIN | Rol |
|---|---|---|
| `orkun` | `lanetkel2026` | admin |
| `ramiz` | `ramiz1234` | streamer |
| `lucy` | `lucy1234` | streamer |
| `acelya` | `acelya1234` | streamer |
| `denetci` | `denetim2026` | auditor |
| `galabet` / `betoffice` / `betpipo` / `hitbet` / `padisahbet` | `marka2026` | brand |

## 3. Vercel CLI ile Deploy

Git **gerekmez** — Vercel CLI doğrudan dosyalardan deploy eder.

```bash
cd /Users/orkun/Downloads/zel
npm i -g vercel              # CLI (bir kere)
vercel login                 # tarayıcıdan onayla (bir kere)
vercel link                  # yeni proje oluştur veya mevcuta bağla
```

### 4 environment variable'ı tek seferlik ekle (her ortama)

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production preview development
# → https://hpztacekyayeucgokgbx.supabase.co

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production preview development
# → eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3Mi...

vercel env add SUPABASE_SERVICE_ROLE_KEY production preview development
# → eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3Mi...   ← service_role

vercel env add SESSION_SECRET production preview development
# → thyhCT7iXAo2nwiDE5p/Hp0GZVVp2xEBas2XJgzoQXA=
```

Hepsi `.env.local` içinde — kopyala/yapıştır yeterli.

### Canlıya çık

```bash
npm run deploy           # = vercel --prod
```

URL'i konsoldan alırsın (`https://<proje>.vercel.app`).

## 4. İleride değişiklikler

- Kod değiştir → `npm run deploy` → 30 sn’de yeni sürüm yayında.
- DB şema değişikliği → `supabase/migrations/*.sql` ekle → MCP'den `apply_migration` çalıştır.
- Yeni .env değişkeni → `vercel env add KEY production preview development` + `npm run deploy`.

## 5. Görsel yükleme

Yayıncı ve admin formundaki **Kanıt** alanında "Yükle" butonu → dosya seçer → `/api/upload` endpoint'i Supabase Storage'daki `proofs` bucket'a yükler → public URL döndürür.

- Bucket: `public`, max 10 MB
- Klasör: `expense/<userId>/<timestamp>-<rand>.<ext>` (expense formu)
- Klasör: `kasa/<userId>/<timestamp>-<rand>.<ext>` (kasa formu)
- Sadece oturum açmış kullanıcı yükleyebilir
- Yalnızca `image/png`, `jpeg`, `webp`, `gif`

## 6. Hangi tabloya ne yazılıyor?

| Sayfa | Tablo(lar) |
|---|---|
| /maaslar | employees · advances · salary_extras · payment_statuses |
| /dis-gelir | external_companies · sponsor_transactions |
| /ic-gelir | internal_projects |
| /giderler | expense_entries |
| /planlanan | planned_items |
| /kasa | kasa_transactions |
| /icerik-harcamalari | content_expenses |
| /izlenme · /marka/izlenmeler | brands · brand_links · link_snapshots · brand_viewership |
| /takvim · /marka/takvim | schedule_slots · weekly_plans · week_brand_reels |
| /yayinci/* | streamer_accounts (scoped) + her şeyin yayıncı süzgeçli görünümü |
| /kullanicilar | app_users · audit_logs |
| /denetci | content_expenses (read-only audit) |
| Bildirimler | app_notifications |
| Kanıt yükleme | storage.buckets.proofs |
