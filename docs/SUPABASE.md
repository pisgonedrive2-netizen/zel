# Supabase Kurulumu

Bu proje artık **PostgreSQL (Supabase)** üzerinde kalıcı veri tutar. Vercel yalnızca uygulamayı host eder; veritabanı Supabase’te olur.

## 1. Supabase projesi

1. [supabase.com](https://supabase.com) → Yeni proje oluşturun.
2. **SQL Editor** → `supabase/migrations/` altındaki dosyaları **sıra ile** yapıştırıp **Run** edin:
   - `20260515120000_initial_schema.sql` (temel 22 tablo + enum + trigger)
   - `20260515130000_storage_proofs.sql` (kanıt görseli bucket)
   - `20260515133000_security_advisors.sql` (`search_path` sabitleme)
   - `20260515143000_payment_approval_metadata.sql` (`paid_by`, `approved_at`)
   - `20260515160000_notification_settings.sql` (`app_settings`, `notification_preferences`)

Veya Supabase MCP / `supabase db push` ile uygulayın.

## 2. Ortam değişkenleri

`.env.local` oluşturun (`.env.example` şablonu):

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SESSION_SECRET=uzun-rastgele-bir-metin-en-az-16-karakter
SEED_SECRET=tek-seferlik-seed-anahtari
```

- **Service role** yalnızca sunucuda kullanılır (Vercel → Environment Variables).
- `SESSION_SECRET` ve `SEED_SECRET` üretmek için: `openssl rand -base64 32`

## 3. İlk veri (seed)

Veritabanı boşken bir kez çalıştırın:

```bash
curl -X POST http://localhost:3000/api/seed \
  -H "x-seed-secret: TEK_SEFERLIK_SEED_ANAHTARINIZ"
```

Bu işlem çalışanları, markaları, kasa kayıtlarını, örnek harcamaları ve kullanıcıları (orkun, ramiz, …) yükler.

## 4. Vercel deploy

Vercel projesine aynı env değişkenlerini ekleyin (Production + Preview).  
`SUPABASE_SERVICE_ROLE_KEY` ve `SESSION_SECRET` asla `NEXT_PUBLIC_` ile başlamamalı.

Deploy sonrası production URL’de seed’i **bir kez** çalıştırın (boş DB ise).

**Önemli — PIN güvenliği:** Kullanıcı PIN’leri yalnızca `app_users.pin_hash` (bcrypt) olarak saklanır. Deploy sonrası PIN’ler **sıfırlanmaz**; profil güncellemeleri hash’e dokunmaz. `/api/seed` mevcut kullanıcıların PIN’ini **asla değiştirmez** (yalnızca yeni kayıtlar seed PIN alır). Production’da seed’i tekrar tekrar çalıştırmayın.

Ek migration’lar (sırayla): `20260518170000_auth_support_notifications.sql`, `20260519120000_brand_monthly_stats.sql`, `20260519130000_auth_pin_and_schema_hardening.sql`, `20260520130000_api_refresh_settings.sql`, `20260520140000_expense_brand_link.sql`, `20260520150000_brand_live_demo_balance.sql`

## Veritabanı şifresi

PostgreSQL şifresi projede **saklanmaz** (yalnızca `SUPABASE_SERVICE_ROLE_KEY` kullanılır). Şifreyi görmek veya sıfırlamak için: Supabase Dashboard → **Project Settings** → **Database** → **Database password** → *Reset database password*.

## Tablolar (24+)

### Çekirdek (kimlik, oturum, log)
| Tablo | Açıklama |
|--------|----------|
| `app_users` | Giriş (username + `pin_hash`, `pin_updated_at`) — ana yönetici (`u-admin`) korumalıdır |
| `brand_monthly_stats` | Marka bazlı aylık kayıt / yatırım metrikleri (`brand_id` + `YYYY-MM`) |
| `audit_logs` | Kalıcı eylem günlüğü (`actor_id`, `action`, `detail`) |
| `app_settings` | Anahtar/JSON yapılandırma (kasa eşiği, bordro hatırlatıcı, …) |
| `notification_preferences` | Kullanıcı bazında bildirim tercihleri |

### Çalışanlar & ödeme
| Tablo | Açıklama |
|--------|----------|
| `employees` | Yayıncılar + koordinatörler |
| `advances` | Aylık avans hareketleri |
| `salary_extras` | Bonus/kesinti/kira/içerik onayı kayıtları |
| `payment_statuses` | Ay/çalışan başına `paid` + `paid_by` + `approved_at` |

### Finans
| Tablo | Açıklama |
|--------|----------|
| `kasa_transactions` | Telegram denetim kasası in/out + fee + proof |
| `content_expenses` | Yayıncı içerik harcaması + 4 aşamalı onay |
| `external_companies`, `sponsor_transactions` | Dış gelir kayıtları |
| `internal_projects` | İç projeler / gelir kaynakları (marka, yayıncılar, ödeme günü, hatırlatma) |
| `internal_project_payments` | Aylık marka tahsilat kayıtları |
| `planned_items` | Planlanan yatırım/hedef (kategori, tarih aralığı, harcama, bağlantılar) |
| `planned_item_payments` | Planlanan kalemlerin taksit kayıtları |
| `expense_entries` | Operasyonel giderler |
| `planned_items` | Gelecek hedef yatırımlar |

### Yayın & marka
| Tablo | Açıklama |
|--------|----------|
| `streamer_accounts` | Yayıncı kendi platformları |
| `schedule_slots` | Şablon haftalık takvim |
| `weekly_plans` | Ad-hoc plan kayıtları (tarihli) |
| `week_brand_reels` | Haftalık marka reel yayını |
| `brands`, `brand_links`, `link_snapshots` | Marka × link × izlenme snapshot |
| `brand_viewership` | Aylık marka izlenme toplamı |

### Bildirim
| Tablo | Açıklama |
|--------|----------|
| `app_notifications` | Bildirim akışı (`for_role`, `for_user_id`, `read`, `href`) |

## Saklı fonksiyonlar

- `set_updated_at()` — tüm tabloların `updated_at` trigger'ı (search_path sabitlendi).
- `sum_approved_content_expenses(employee_id, month)` — bordroya eklenecek içerik onayı toplamı.
- `pending_expense_count()` — bekleyen harcama sayısı.
- `calc_kasa_balance(as_of)` — kasa anlık bakiye.

## Storage

- `proofs` bucket — kanıt görseli (`/api/upload` endpoint'i service role ile yükler).
- Public read açık, **listing kapalı** (advisor uyumu için).

## Güvenlik

- Tüm tablolarda **RLS açık**; doğrudan tarayıcıdan anon key ile yazma yok.
- Uygulama **Next.js API** + **service role** kullanır (sunucu yan).
- Oturum: `httpOnly` + `SameSite=Lax` cookie, HMAC SHA-256 imzalı.
- **Ana yönetici (`u-admin`)** koruması: silinemez, pasifleştirilemez, rolü/kullanıcı adı değiştirilemez. Hem UI hem `/api/users/[id]` PATCH/DELETE bunu zorlar.

## localStorage modu

`NEXT_PUBLIC_SUPABASE_URL` tanımlı değilse uygulama eski gibi **localStorage** ile çalışır (yalnızca geliştirme).
