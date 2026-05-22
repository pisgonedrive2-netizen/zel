# Supabase migrations (Foxstream)

Migrations run in filename order under `migrations/`.

## Apply to remote project

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Or paste each `.sql` file into **Supabase Dashboard → SQL Editor** in order (oldest timestamp first).

## Recent migrations

| File | Purpose |
|------|---------|
| `20260518170000_auth_support_notifications.sql` | Login: şifre sıfırlama / kayıt talebi bildirim enum + `ref_id` index |
| `20260519120000_brand_monthly_stats.sql` | Marka aylık operasyon metrikleri tablosu |
| `20260519130000_auth_pin_and_schema_hardening.sql` | `pin_updated_at`, kullanıcı FK/index, enum tamamlama, stats kısıt yamaları |
| `20260520160000_link_snapshot_engagement.sql` | `link_snapshots` engagement (likes/comments/shares/refreshed_at) + `brand_links` refresh sayacı / `created_at` index |

## PIN (şifre) değişimi

- `app_users.pin_hash` — bcrypt hash (API: `PATCH /api/users/[id]` with `newPin` or `pin`)
- `app_users.pin_updated_at` — son PIN değişim zamanı (set on hash update)

## Marka operasyon metrikleri

Table: `brand_monthly_stats` — one row per `(brand_id, month)` with `YYYY-MM`.

Required fields when saving from admin UI: counts and amounts (defaults `0`). Unique per brand+month.
