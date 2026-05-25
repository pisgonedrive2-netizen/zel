# Foxstream — Değişiklik Özeti (22 Mayıs 2026)

Bu dosya son oturumda yapılan **API sağlık ayrımı** ve **izlenme/API sayfası** düzeltmelerini özetler. Production deploy ile birlikte yayına alınmıştır.

---

## Sorun

`/izlenme/api` sayfasında platformlar **kırmızı / hata** görünüyordu; oysa **Bağlantıyı test et (ping)** başarılı dönüyordu.

**Kök neden:** Sağlık metriği, RapidAPI erişimini değil, son 24 saatteki **link yenileme başarısızlıklarını** (`api_refresh_runs` + `brand_links.last_check_error`) tek skor altında topluyordu. Ping ayrı bir `connection_probe` kaydı oluşturuyordu; UI bunu “API ayakta” olarak yansıtmıyordu.

---

## Çözüm: İki katmanlı sağlık

| Katman | Ne ölçer? | Alanlar |
|--------|-----------|---------|
| **API bağlantısı** | RapidAPI probe / ping, son başarılı çalışma | `connectivityStatus`, `lastPingAt` |
| **Link / yenileme** | Takip edilen linklerde son kontrol hatası, bayat linkler | `linksWithError`, `staleTrackedLinks`, `lastError` |

Genel kart rengi (`status`): bağlantı OK iken yalnızca link sorunları → **uyarı (amber)**, bağlantı gerçekten kopuksa → **hata (kırmızı)**.

---

## Değişen dosyalar

### `src/lib/social-api/health.ts`
- `PlatformHealth` genişletildi: `connectivityStatus`, `lastPingAt`, `linksWithError`, `staleTrackedLinks`.
- `getPlatformHealth()` ping kayıtlarını (`notes: connection_probe`) ve `brand_links` hata sayılarını ayrı hesaplar.
- `platformLinkLabels()` — YouTube / Instagram / TikTok platform eşlemesi (Türkçe slug uyumu).
- `recordPlatformPingSuccess()` — başarılı ping sonrası probe kaydı.

### `src/app/api/admin/refresh-status/route.ts`
- `GET` yanıtındaki `health` nesnesine yeni alanlar eklendi (UI ve navbar tüketir).

### `src/app/izlenme/api/page.tsx`
- Üst **durum bandı**: RapidAPI kapalı / erişim sorunu / link hatası (API ayakta) / tümü sağlıklı.
- KPI **“Son hata”** → **“Link hatası”** (yanıltıcı “API down” algısı giderildi).
- `AutoRefreshStatusPanel` → `hideCapabilities` (özellik kataloğu tekrarı kaldırıldı; katalog sayfa üstünde kalır).

### `src/components/auto-refresh-status-panel.tsx`
- Platform kartları: **API bağlantısı**, **Genel durum**, **Link hatası** satırları.
- Kırmızı çerçeve yalnızca `connectivityStatus === "error"` veya kota tükendiğinde.
- Hata kutusu metni: **“Link / yenileme”** (API bağlantı hatası değil).
- `hideCapabilities?: boolean` prop — API sayfasında alttaki ikinci katalog gizlenir.
- Ping sonrası optimistic güncellemede `connectivityStatus: "ok"`.

### `src/components/izlenme/izlenme-navbar.tsx`
- Navbar chip: bağlantı ve link uyarıları ayrı önceliklendirilir.
- **“API problemi”** yalnızca gerçek erişim/kota sorununda (kırmızı).
- Link sorunları için amber **“Link yenileme uyarısı”**.

---

## Kullanım notları

1. **Ping başarılı ama kart hâlâ uyarılıysa** — Bu beklenen davranış olabilir: API erişilebilir, bazı linkler yenilenememiş. Bekleyen link tablosundan tek tek veya navbar **Yenile** ile toplu yenileyin.
2. **Yeşil band için** — Her platformda en az bir kez **Bağlantıyı test et** veya son 48 saatte başarılı probe/cron kaydı gerekir.
3. **Özellik probu hataları** — Katalogdaki tek endpoint testleri başarısız olabilir; bu tüm platformu “kapalı” saydırmaz.

---

## Marka paneli (`/marka/*`)

Bu deploy’da marka rotalarında değişiklik yok. Kontrol edildi:

- `/marka` → `/marka/operasyon` yönlendirmesi
- Nav: operasyon, izlenmeler, takvim, ödemeler, bildirimler
- Bildirimler: marka rolü için `schedule_updated` ve marka bildirimleri görünür (`OPS_ONLY` tipler hariç)

---

## Deploy (tamamlandı)

| | |
|---|---|
| Commit | `f015a5d` |
| Canlı | [https://foxstreaming.vercel.app](https://foxstreaming.vercel.app) |
| Inspect | [Vercel deployment](https://vercel.com/pisgonedrive2-netizens-projects/foxstream/FqdBqoXH22E7JKzSK9zZm8wysZit) |

### Ortam (hatırlatma)

| Değişken | Açıklama |
|----------|----------|
| `RAPIDAPI_KEY` | Production’da tanımlı olmalı (ping ve yenileme) |
| `TRONGRID_API_KEY` | TRON kasa senkronu (önceki deploy) |

---

## Önceki deploy’lar (bağlam)

| Commit | Özet |
|--------|------|
| `c6415ea` | TRON kasa, plan bildirimleri, API özellik kataloğu, yayıncı düzeltmeleri |
| `c7180db` | Yayıncı harcama PDF, TRON kasa |
| `5d51b3c` | İzlenme/bildirim merkezi, layout |

---

---

## Ek düzeltme — TRON çıkış + izlenme paneli (aynı gün)

### TRON kasa
- Giden USDT için TronGrid **ayrı pass** (`all` + `only_from` + `only_to`).
- `TRON_KASA_ADDRESS` / `TRON_SYNC_FROM` ortam değişkeni → kasa kaydına otomatik yazılır.
- Kasa sayfasında **Son 30 gün** hızlı senkron.
- Cron: `GET /api/cron/tron-sync` (4 saatte bir, `CRON_SECRET` gerekli).
- `ignoreDuplicates` + global `tron_tx_id` çakışma koruması.

### İzlenme / Acelya “0 link · 100k”
- KPI ve yayıncı sıralaması artık **link + manuel `brand_viewership`** toplar.
- Operatörler sayfası manuel raporları da sayar.
- Kart metni: manuel rapor ayrı gösterilir.

### Pro API veri çekimi
- YouTube: önce `/v2/video-details` ve `/v2/channel-details`.
- TikTok profil: `/user/posts` son 30 videonun izlenme toplamı.

### Sizin yapmanız gerekenler (Vercel)
| Değişken | Değer |
|----------|--------|
| `TRONGRID_API_KEY` | TronGrid Pro anahtarınız |
| `TRON_KASA_ADDRESS` | `TEFigtFTbqZf47pwXPJCGdZv9jPgrgTcUE` |
| `TRON_SYNC_FROM` | `2025-04-01` |
| `CRON_SECRET` | (mevcut cron ile aynı) |

Kasa → Genel Kasa seç → **Son 30 gün** veya **TRON hareketlerini çek** → filtre **Tümü**.

---

## Ek — API kota, yayıncı bildirimleri, özet izlenme

### API limitleri (100 hatası)
- Veritabanındaki eski `monthly_limit: 100` artık **config’ten** okunuyor (YT/IG **1000**, TikTok **5000**).
- `refresh-status` çağrısında limitler otomatik senkronize edilir.
- Panelde **Aylık kota** satırı: `kullanılan/limit` + güvenli bütçe ayrı gösterilir.

### Yayıncı harcama bildirimleri
- Onay / red / ödeme / **bilgi iste** → Supabase’e kalıcı bildirim (`/api/content-expenses/notify-streamer`).
- Harcama gönderince yayıncıya **“Harcamanız alındı”** bildirimi.
- Nav’da **Harcamalar** rozeti: `needs_info` + okunmamış harcama bildirimleri.
- Harcamalar sayfasında amber **“Bilgi gerekli”** şeridi.

### Özet sayfası
- Toplam izlenme = link snapshot + **manuel yayıncı raporları** (bu ay).

*Son güncelleme: 22 Mayıs 2026*
