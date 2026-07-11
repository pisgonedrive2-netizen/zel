# Changelog — 11 Temmuz 2026

## Özet

Marka paneli classy UI turu, yayıncı takvim içerik tipi özeti (önceki oturum), sayfa yükleme hızı ve landing hero animasyonları.

---

## Marka UI

### 1. Haftalık çekim özeti (`/marka/takvim`)
- `BrandWeekContentSummary`: X içerik · Y yayıncı · Z gün
- Reels / Vlog / Adult tip dağılımı + yayıncı başına chip’ler
- 7 günlük çekim şeridi

### 2. Anasayfa sadeleştirme + Teslimat komuta
- İlk ekran: Hero → **Teslimat komuta** → Action queue → paket garantisi
- Operasyon / KPI / affiliate / link detayları **CollapsibleSection** altında (varsayılan kapalı)
- Duplicate action queue sticky’den kaldırıldı

### 3. İzlenme metrikleri UI (`/marka/izlenmeler` + anasayfa + admin)
- **İki net blok:** Tüm linkler (aylık + toplam) | Bu ay eklenenler (o ayki + kümülatif)
- Aylık geçmiş tablosu + link bazlı ay/artış/toplam (varsayılan açık)
- `BrandViewershipStory` artık `computeBrandLinkViewershipStats` kullanıyor (doğru kohort/delta)
- Yanlış “lastViews = aylık” hesabı kaldırıldı
- **Aylık = ay içi artış**, toplam = kümülatif; ay sonu bakiyesi ayrı etiket

### 4. Yayıncı sayısı + admin haftalık çekim
- İzlenme panosu “X yayıncı” artık yalnızca **aktif** roster (Ramiz); pasif Lucy/Acelya sayılmaz
- `/takvim` + `/panel`: **Bu hafta · çekim komuta** — kaç marka, hangi gün, içerik tipi
- Takvim header modernize; panel’e takvim/izlenme kısayolları

### 5. Yayıncı havuzu kartları
- Daha büyük avatar, editorial chip’ler, turuncu CTA vurgu

### 6. Prim Havuzu UI (Orkun-only)
- Sticky karar şeridi: bu ay prim · rezerv · prim sonrası kâr + canlı formül
- Bölümler: Neden bu kadar? · Para akışı (waterfall) · İzlenme merdiveni · Kim ne alır (kartlar)
- 3 kolay sistem kartı (Önerilen / Sadece % / Sabit); uzman sekmeler Detaylı’da
- Basit görünümde Dağıtım artık kilitlenmiyor; `canAccessPrim` tek kapı
- Yanlış “her 1M = $100” metni kaldırıldı → `describeViewPoolBonusRules`

---

## Yayıncı (önceki + bu tur)

- Takvim: içerik tipi chip’leri (Reels/Vlog/Adult…), marka seçimi, haftalık özet kartı
- Lazy load: `/yayinci/*` dashboard sayfaları `dynamic()` ile kod bölünüyor

---

## Performans

- Bootstrap tam ekran spinner kaldırıldı → ince üst progress bar (shell hemen çizilir)
- Yayıncı section sayfaları artık 4k satırlık `streamer-dashboard`’u eager import etmiyor

---

## Landing

- Hero metinleri: eyebrow / başlık / alt metin / CTA framer-motion ile kademeli giriş

---

## Dosyalar

| Yeni / güncellenen |
|---|
| `src/components/marka/brand-week-content-summary.tsx` |
| `src/components/marka/brand-delivery-command.tsx` |
| `src/components/marka/brand-viewership-story.tsx` |
| `src/app/yayinci/lazy-streamer-dashboard.tsx` |
| `src/components/data-provider.tsx` |
| `src/app/login/page.tsx` |
| `src/app/marka/anasayfa/page.tsx` |
| `src/app/marka/takvim/page.tsx` |
| `src/app/marka/izlenmeler/page.tsx` |
| `UX_IMPROVEMENTS.md` (önceki yayıncı notları) |

---

*Kaydedildi: 11 Temmuz 2026*
