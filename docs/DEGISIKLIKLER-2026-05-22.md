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

## Deploy

```bash
git add -A
git commit -m "API sağlık: bağlantı ve link hatalarını ayır, izlenme/api UI"
git push origin main
npm run deploy   # vercel --prod → foxstreaming.vercel.app
```

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

*Son güncelleme: 22 Mayıs 2026*
