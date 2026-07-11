# UX İyileştirmeleri — Temmuz 2026

Bu belge, üç rol (yönetici, marka, yayıncı) için yapılan dashboard ve kullanıcı deneyimi güncellemelerini özetler.

## Özet

| # | Değişiklik | Kim | Rota / Dosya |
|---|------------|-----|--------------|
| 1 | Marka giriş → Anasayfa | Marka | `/marka/anasayfa` |
| 2 | Yayıncı giriş → Anasayfa | Yayıncı | `/yayinci/anasayfa` |
| 3 | Alt yönetici giriş → Kontrol Paneli | Yönetici | `/panel` |
| 4 | Onay Merkezi | Yönetici | `/onaylar` |
| 5 | Sidebar başlığı role göre | Hepsi | `sidebar.tsx` |
| 6 | Marka listesinden panele gir | Yönetici | `/izlenme/markalar` |
| 7 | Yayıncı mobil nav sadeleştirme | Yayıncı | `yayinci/layout.tsx` |
| 8 | Görev tamamlama akışı | Yayıncı + Yönetici | `completed_at` kolonu |
| 9 | Entegrasyon rozeti kaldırıldı | Marka | `marka-nav.ts` |

---

## 1. Marka — Anasayfa varsayılan landing

**Önce:** Login sonrası `/marka/izlenmeler`  
**Sonra:** `/marka/anasayfa`

Marka kullanıcıları artık doğrudan KPI kartları, aksiyon kuyruğu (`BrandActionQueue`), hızlı aksiyonlar ve getting-started checklist ile karşılanıyor.

**Dosyalar:**
- `src/store/auth.ts` — `landingFor("brand")`
- `src/app/marka/page.tsx` — redirect

---

## 2. Yayıncı — Anasayfa dashboard

**Yeni sayfa:** `/yayinci/anasayfa`

İçerik:
- Saat bazlı selamlama + çalışan adı
- **Bugün yapılacaklar** (görev tamamlama butonu ile)
- **Hızlı aksiyonlar:** Harcama ekle, Plan aç, Link ekle, Teklifler (badge'li)
- **Mini maaş özeti** (net, ödeme durumu)
- **Mini izlenme özeti** (veri varsa)
- **Başlangıç checklist'i** (profil, hesap, link, harcama, plan)

**Dosyalar:**
- `src/app/yayinci/anasayfa/page.tsx`
- `src/components/yayinci/streamer-quick-actions.tsx`
- `src/components/yayinci/streamer-getting-started.tsx`
- `src/app/yayinci/page.tsx` — redirect
- `src/components/sidebar.tsx` — STREAMER_NAV'a Anasayfa eklendi

---

## 3. Yönetici — Kontrol Paneli (lite dashboard)

**Yeni sayfa:** `/panel`  
**Landing:** Orkun dışındaki adminler artık `/maaslar` yerine buraya düşer. Orkun hâlâ `/ozet`.

İçerik:
- **AdminActionInbox** — sayaçlı aksiyon şeridi
- 4 KPI: bekleyen onay, ödenmemiş bordro, aktif marka, aylık izlenme
- Son 6 bildirim
- Hızlı linkler (Maaşlar, Onaylar, Harcamalar, Kasa, Görevler)
- Orkun için “Tam özet paneli” linki

**Dosyalar:**
- `src/app/panel/page.tsx`
- `src/lib/admin-dashboard-metrics.ts`
- `src/components/admin/admin-action-inbox.tsx`

---

## 4. Yönetici — Onay Merkezi

**Yeni sayfa:** `/onaylar`

Sekmeler:
1. **İçerik harcamaları** — `pending` liste → `/icerik-harcamalari`
2. **Bordro ödemeleri** — ödenmemiş çalışanlar → `/maaslar`
3. **Görevler** — gecikmiş görevler → `/gorevler`

Sidebar'da **Kontrol** grubunda **Kontrol Paneli** ve **Onay Merkezi** ilk sırada.

**Dosya:** `src/app/onaylar/page.tsx`

---

## 5. Sidebar — Role göre başlık

| Rol | Başlık | Alt yazı |
|-----|--------|----------|
| Admin | Yönetim Paneli | FOXSTREAM |
| Marka | Marka Paneli | FOXSTREAM / marka adı (view-as) |
| Yayıncı | Yayıncı Paneli | FOXSTREAM / çalışan adı (view-as) |
| Denetçi | Denetim Paneli | FOXSTREAM |

**Dosya:** `src/components/sidebar.tsx`

---

## 6. Marka listesinden panele gir

`/izlenme/markalar` kart menüsüne **Marka paneli** eklendi. Tek tıkla `enterBrandPanel` + `/marka/anasayfa`.

Ayrıca `/izlenme/marka/[brandId]` detay sayfasındaki buton da anasayfaya yönlendiriyor.

**Dosyalar:**
- `src/app/izlenme/markalar/page.tsx`
- `src/app/izlenme/marka/[brandId]/brand-detail-client.tsx`

---

## 7. Yayıncı mobil navigasyon

**Masaüstü:** Yatay tab bar kaldırıldı (sidebar yeterli).  
**Mobil:** Alt sabit bar — Anasayfa, Maaş, Harcamalar, Takvim, **Daha fazla** (sheet ile kalan modüller).

**Dosya:** `src/app/yayinci/layout.tsx`

---

## 8. Görev tamamlama akışı

Yayıncı **Bugün yapılacaklar** kartında **Tamamlandı** butonu:
- Bildirime `completed_at` yazar
- Bildirimi okundu işaretler
- Yöneticiye “Görev tamamlandı” bildirimi gönderir (`/gorevler` linki)

**Veritabanı:** `app_notifications.completed_at` (timestamptz)

**Dosyalar:**
- `supabase/migrations/20260707110000_notification_completed_at.sql`
- `src/store/store.ts` — `AppNotification.completedAt`
- `src/lib/db/mappers.ts`
- `src/app/api/notifications/route.ts` — PATCH `completedAt`
- `src/lib/notification-actions.ts` — `markNotificationCompletedPersisted`
- `src/components/yayinci/streamer-today-tasks-card.tsx`
- `src/lib/streamer-today-tasks.ts`
- `src/lib/task-notifications.ts` — görev linki `/yayinci/anasayfa`

---

## 9. Marka — Entegrasyon rozeti

`marka-nav.ts` içinde Entegrasyon modülünden `inDevelopment: true` kaldırıldı; sayfa kullanıma hazır olarak gösteriliyor.

---

## Test planı

### Marka
- [ ] Login → `/marka/anasayfa` açılıyor
- [ ] Action queue ve quick actions görünüyor
- [ ] Getting-started core adımlar bitince kapanıyor

### Yayıncı
- [ ] Login → `/yayinci/anasayfa`
- [ ] Hızlı aksiyon linkleri doğru sayfaya gidiyor
- [ ] Görev “Tamamlandı” → listeden düşüyor, admin bildirimi geliyor
- [ ] Mobilde alt bar 5 öğe + Daha fazla sheet

### Yönetici
- [ ] Ediz login → `/panel`
- [ ] Orkun login → `/ozet`
- [ ] Onay Merkezi sekmeleri doğru listeler
- [ ] Markalar listesinden Marka paneli çalışıyor
- [ ] Sidebar başlığı “Yönetim Paneli”

---

## Migration

Supabase'de çalıştırıldı:

```sql
-- 20260707110000_notification_completed_at.sql
ALTER TABLE public.app_notifications
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;
```

---

---

## Ek — Yayıncı UX turu (11 Temmuz 2026)

| # | Değişiklik | Dosya |
|---|------------|-------|
| 10 | Onboarding gate (profil yoksa sihirbaz; “Şimdilik geç” kalıcı) | `streamer-onboarding-gate.tsx`, `yayinci/layout.tsx` |
| 11 | Admin view-as: havuz profili doğru employee ile yükle/kaydet | `profil/page.tsx`, `streamer-pool-api.ts` |
| 12 | Admin view-as: teklifler `employeeId` ile filtrelenir | `teklifler/page.tsx`, `fetchOffers` |
| 13 | Empty CTA: teklifler → profil, postlar → ekle, istatistik/bildirim | ilgili sayfalar |
| 14 | Anasayfa: `needs_info` uyarısı + Post ekle hızlı aksiyon | `anasayfa/page.tsx` |
| 15 | “Mesajlar” → “Bildirimler” metni; bildirim sayfası 60sn polling | `streamer-dashboard.tsx` |
| 16 | Onboarding’de mobil alt menü gizlendi | `yayinci/layout.tsx` |

### Test (yayıncı)
- [ ] Profili olmayan yayıncı → onboarding; “Şimdilik geç” → anasayfa, tekrar yakalanmaz
- [ ] Admin yayıncı paneline gir → Havuz profili / Teklifler doğru çalışanın verisi
- [ ] `needs_info` harcama varsa anasayfada amber uyarı
- [ ] Bildirimler boşken CTA’lar ve 60 sn yenileme

*Son güncelleme: 11 Temmuz 2026*

