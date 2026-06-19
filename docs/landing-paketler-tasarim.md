# Influencer İçerik Paketleri — Tasarım & Metin Rehberi

Bu doküman, `LandingPackages` bileşenindeki paket fiyatlandırma sayfasının tam tasarım spesifikasyonunu, tüm metinleri, renkleri, etkileşim akışını ve veri yapısını içerir. Başka bir projede birebir veya uyarlanmış şekilde yeniden kullanılabilir.

---

## 1. Genel konsept

**Amaç:** 5 marka (Padişahbet, Galabet, Betpipo, Hitbet, Betoffice) için aylık influencer içerik paketlerini kart tabanlı, animasyonlu ve interaktif bir landing bölümünde sunmak.

**CTA:** Tüm “Teklif al” butonları → `https://t.me/lanetkelresmi`

**Para birimi:** USD · TR binlik ayracı (`$10.000`)

**Hedef kitle:** Türkiye pazarı · bahis/eğlence nişi

---

## 2. Renk paleti & tipografi

| Token | Değer | Kullanım |
|-------|-------|----------|
| `ORANGE` | `#FF6B00` | Ana vurgu, featured paket, CTA |
| Arka plan | `#09090b` | Bölüm zemini |
| Kart zemin | `white/[0.03]` | Paket kartları |
| Kenarlık | `white/10` | Kart border |
| Metin birincil | `white` | Başlıklar, fiyat |
| Metin ikincil | `white/60` | Açıklamalar |
| Metin soluk | `white/40` | Dipnot, birim |
| Garanti rozeti | `emerald-300` on `emerald-500/12` | Garantili izlenme |
| Işıma | `radial-gradient(120% 80% at 50% 0%, rgba(255,107,0,0.16) 0%, transparent 60%)` | Üst glow |

**Font:** Sistem sans · başlıklar `font-bold` / `font-extrabold` · fiyatlar `text-3xl`–`text-4xl`

---

## 3. İçerik türü etiketleri

| Key | Label | Renk | İkon |
|-----|-------|------|------|
| `youtube` | YouTube | `#EF4444` | Youtube |
| `reel` | Reel | `#EC4899` | Clapperboard |
| `normal` | Adult İçerik | `#3B82F6` | FileText |
| `live` | Live Yayın | `#22C55E` | Radio |
| `campaign` | Özel Kampanya | `#FF6B00` | Megaphone |

---

## 4. Marka rozetleri

5 marka üst bölümde renkli chip olarak gösterilir:

| Marka | Renk |
|-------|------|
| Padişahbet | `#F59E0B` |
| Galabet | `#EF4444` |
| Betpipo | `#8B5CF6` |
| Hitbet | `#22C55E` |
| Betoffice | `#3B82F6` |

**Chip stili:** `rounded-full border px-3 py-1 text-xs font-semibold` · sol nokta + marka adı

---

## 5. Bölüm başlığı (Hero)

**Eyebrow:** `İÇERİK PAKETLERİ` (uppercase, tracking `[0.25em]`, turuncu)

**H1:** Markana uygun **içerik paketini** seç. *(“içerik paketini” turuncu)*

**Alt metin:**
> Garantili izlenmeli aylık paketler — YouTube, Reel, adult içerik ve canlı yayın. Türkiye pazarına özel fiyatlandırma.

---

## 6. Erişim paneli (ReachPanel)

**Başlık:** Aylık toplam erişim  
**Sağ etiket:** Canlı veri · Haz 2026

**Ana sayı:** `90M+` izlenme / ay *(animasyonlu sayaç)*

**Görsel:** 12 adet soyut gradient bar (marka adı/sayı göstermeden momentum hissi)

**Alt metin:**
> Yüzlerce içerik linki ve onlarca platform üzerinden ölçülen **organik erişim**. Rakamlar aylık toplamı yansıtır.

---

## 7. Stat kartları (4'lü grid)

| Değer | Etiket |
|-------|--------|
| 90M+ | Aylık içerik izlenmesi |
| 5 | Aktif marka |
| 400+ | İçerik linki |
| 38M+ | En viral tek içerik |

---

## 8. İçerik galerisi

**Başlık:** Ürettiğimiz içeriklerden kesitler  
**Sağ:** Gerçek içerikler · tıkla & izle

**Davranış:** İlk 4 YouTube Short · tıklayınca inline iframe oynatma · 9:13 aspect ratio

**Örnek içerikler (gerçek veri):**

| Video ID | Marka | İzlenme |
|----------|-------|---------|
| lsk5wAFGGpo | Padişahbet | 38.6M |
| JVvF8iOLVgc | Padişahbet | 943K |
| rcSNWCZHX0k | Padişahbet | 447K |
| 0EDxE8_kSPw | Padişahbet | 407K |

---

## 9. Organik paylaşım platformları

**Başlık:** İçeriklerimiz başka nerelerde paylaşılıyor?

**Metin:**
> Ürettiğimiz içerikler, takip ettiğimiz hesapların çok ötesinde — kullanıcılar tarafından onlarca global platformda organik olarak yeniden paylaşılıyor. Bu, ölçtüğümüz rakamların **görünenden çok daha geniş** bir kitleye ulaştığını gösterir.

**Platform wordmark'ları (CSS, görsel asset değil):**
Pornhub · YouPorn · RedTube · Tube8 · EPORNER · reddit · HDalemi · doeda · `+40 platform daha`

---

## 10. Paketler

### 10.1 Starter — $5.500 / marka / ay

| Alan | Değer |
|------|-------|
| İkon | Rocket |
| Renk | `#38BDF8` |
| Tagline | YouTube olmadan hızlı başlangıç — reel ve adult içerik odaklı. |
| Garanti izlenme | 250K |
| CPM | ≈ $6,9 |
| İçerik | 2× Reel · 1× Adult İçerik |

### 10.2 Standard — $10.000 / marka / ay ⭐ FEATURED

| Alan | Değer |
|------|-------|
| İkon | Star |
| Renk | `#FF6B00` (ORANGE) |
| Badge | En çok tercih |
| Tagline | Referans paket — 4 reel + adult içerik, YouTube yok. |
| Garanti izlenme | 1M |
| CPM | ≈ $4,0 |
| İçerik | 4× Reel · 1× Adult İçerik |
| **Featured stil** | Turuncu border, gradient zemin, `lg:-translate-y-3 lg:scale-[1.03]`, hover -16px |

### 10.3 Premium — $16.500 / marka / ay

| Alan | Değer |
|------|-------|
| İkon | Crown |
| Renk | `#A855F7` |
| Tagline | 1 YouTube + geniş reel kapsamı + canlı yayın. |
| Garanti izlenme | 2.5M |
| CPM | ≈ $2,8 |
| İçerik | 1× YouTube · 6× Reel · 2× Adult İçerik · 1× Live Yayın |

### 10.4 Elite — $25.000 / marka / ay

| Alan | Değer |
|------|-------|
| İkon | Trophy |
| Renk | `#FACC15` |
| Tagline | 2 YouTube + maksimum kapsama ve özel kampanya prodüksiyonu. |
| Garanti izlenme | 6M |
| CPM | ≈ $1,7 |
| İçerik | 2× YouTube · 8× Reel · 4× Adult İçerik · 2× Live Yayın · 1× Özel Kampanya |

### 10.5 Multi-marka — $40.000 / 5 marka / ay

| Alan | Değer |
|------|-------|
| İkon | Boxes |
| Renk | `#22C55E` |
| Badge | %20 indirim |
| Not | Marka başına $8.000 · %20 indirim |
| Tagline | 5 markanın tamamı için Standard paket — reel + adult içerik, YouTube yok. |
| Garanti izlenme | 5M |
| CPM | ≈ $3,2 |
| İçerik | 20× Reel · 5× Adult İçerik |
| Layout | Geniş yatay kart (yeşil gradient) |

---

## 11. Paket kartı UI

Her kartta:
- Sol üst: “Seçildi” rozeti (seçiliyse)
- Sağ üst: Badge (varsa)
- İkon + paket adı + “X prodüksiyon / ay”
- Fiyat + birim
- Garanti izlenme + CPM rozetleri
- Tagline
- İçerik listesi (ikon + adet × tür)
- Renkli tag chip'leri
- **Seç** butonu (primary)
- **Teklif al** butonu (ghost → Telegram)

**Seçili kart:** `border-orange-400 ring-2 ring-orange-400/60 bg-orange-500/[0.08]`

---

## 12. Add-on'lar (à la carte)

**Başlık:** Pakete ek seç (à la carte)  
**Sağ:** Seçili paket adı veya “Önce yukarıdan paket seç”

| Add-on | Fiyat |
|--------|-------|
| Ekstra YouTube | $5.000 / adet |
| Ekstra Adult İçerik | $7.000 / adet |
| Live Yayın | $1.500 / adet |
| Ekstra Reel | $3.000 / adet |
| Story serisi | $2.000 / adet |

**Etkileşim:** +/- stepper · seçilen ek toplamı · “Seçimi teklife ekle” butonu

---

## 13. Teklif özeti (OfferSummary)

Seçili paket + add-on'lar birleşince görünür:

- Paket satırı (ikon, ad, fiyat)
- Add-on satırları (adet × tür = tutar)
- **Toplam** + **Teklif al · Telegram** CTA
- “Temizle” linki

---

## 14. Performans güvencesi

**Metin:**
> **Performans güvencesi:** Paketin garantili izlenmesine ulaşılamazsa, eksik kalan kısım bir sonraki ay **ücretsiz ek prodüksiyonla** telafi edilir. Hedef aşımında üretilen ekstra erişim markaya bonus olarak raporlanır.

---

## 15. Dipnot

> Fiyatlar marka başına aylık tutardır (USD). Tüm paketlere içerik raporu, post takibi ve affiliate ölçümü dahildir. Türkiye pazarına özel; bahis/eğlence nişi için optimize edilmiştir.

---

## 16. Animasyonlar (Framer Motion)

| Bileşen | Animasyon |
|---------|-----------|
| Bölüm başlığı | `opacity 0→1`, `y 20→0` |
| Marka rozetleri | scale + stagger delay |
| Stat sayaçları | spring sayaç (useSpring) |
| Reach barları | height 0→% + stagger |
| Paket kartları | scroll-in y + hover lift |
| Galeri | scroll-in y + hover -4px |
| Teklif özeti | fade-in y |

---

## 17. Etkileşim akışı

```
1. Kullanıcı paket kartında "Seç" → kart vurgulanır
2. Add-on'larda adet seçer → "Seçimi teklife ekle"
3. Teklif özeti açılır (scroll)
4. "Teklif al · Telegram" → t.me/lanetkelresmi
```

Paket seçilmeden add-on commit → paket alanına smooth scroll + “Önce paket seç” mesajı

---

## 18. Teknik yapı (React)

```
LandingPackages
├── ReachPanel
├── ContentGallery (4 item, inline YouTube)
├── SHARE_PLATFORMS wordmarks
├── PackageCard × 4
├── Multi-marka geniş kart
├── AddonSelector
└── OfferSummary (conditional)
```

**State:**
- `selectedId: string | null`
- `committedAddons: Record<string, number>`

**Bağımlılıklar:** framer-motion, lucide-react

---

## 19. Section HTML yapısı

```html
<section id="paketler" class="bg-[#09090b] border-t border-white/5 py-16 sm:py-20">
  <div class="max-w-[1240px] mx-auto">
    <!-- hero, badges, reach, stats, gallery, platforms, cards, multi, addons, summary, guarantee, footer -->
  </div>
</section>
```

---

## 20. Yeniden kullanım notları

1. `TELEGRAM_URL` sabitini hedef projeye göre değiştirin
2. `GALLERY` video ID'lerini kendi içerik verinizle güncelleyin
3. `REACH_BARS` ve stat sayıları canlı veriye bağlanabilir
4. Marka listesi `BRAND_BADGES` dizisinden yönetilir
5. Paket fiyatları `CONTENT_PACKAGES` + `MULTI_PACKAGE` sabitlerinde
6. Featured paket: `featured: true` + `badge: "En çok tercih"`

---

*Son güncelleme: Haziran 2026 · Standard pakette YouTube yok · Premium 1 YouTube · Elite 2 YouTube · “İçerik” → “Adult İçerik”*
