# Auth & Yetkilendirme

## Kullanıcılar (v6 — varsayılan)

| Kullanıcı Adı | PIN | Ad | Rol | Bağlı Yayıncı |
|---|---|---|---|---|
| `orkun` | `lanetkel2026` | Orkun Bey | Admin | — |
| `ramiz` | `ramiz1234` | Ramiz | Streamer | emp-ramiz |
| `lucy` | `lucy1234` | Lucy | Streamer | emp-lucy |
| `acelya` | `acelya1234` | Açelya | Streamer | emp-acelya |
| `denetci` | `denetim2026` | Denetim Ekibi | Auditor | — |

> Admin `/kullanicilar` sayfasından tüm PIN'leri sıfırlayabilir veya yeni kullanıcı ekleyebilir.

## Rol Yetkileri

### Admin
- Tüm sayfalara CRUD erişim
- Kullanıcı yönetimi, PIN sıfırlama, yeni kullanıcı oluşturma
- Yayıncı harcama gönderimlerini onaylama/reddetme
- Bildirim alıcısı: harcama gönderimi, takvim güncellemesi, avans isteği

### Streamer (Yayıncı)
- Sadece `/yayinci` sayfasına erişebilir; başka rota'ya gitmeye çalışırsa otomatik yönlendirilir
- Kendi maaş kırılımını görür (brüt, kira, avans, net)
- Kendi içerik harcamalarını ekler, düzenler (sadece `pending` durumdayken)
- Haftalık takvimini ekler/düzenler ("bu hafta" + "sonraki hafta")
- Kendi yayın hesaplarını ve marka linklerini görür
- Geçmiş aylar özetini görür (kendi)
- **Göremez/düzenleyemez**: diğer yayıncıların verisi, kasa, dış gelir, raporlar, kullanıcılar

### Auditor (Denetçi)
- `/denetci` özet paneli + read-only mod
- Kasa hareketlerini görür (TXID, dekont kontrolü)
- Tüm içerik harcamalarını görür; "audited" olarak işaretleyebilir
- Maaş & rapor sayfalarına read-only erişim
- **Hiçbir veriyi düzenleyemez, silemez veya ekleyemez**
- Yeni avans/harcama eklendiğinde bildirim alır

## Güvenlik Notları

Mevcut sistem **client-side localStorage** tabanlıdır:
- PIN'ler tarayıcı `localStorage`'da plain text saklanır
- Bir kullanıcı DevTools açıp `lanetkel-auth-v1` key'ini inceleyerek tüm kullanıcı PIN'lerini görebilir
- Bu, **iç ekip kullanımı için yeterli**; harici risk varsa server-side auth gerekir

### v7 İçin Yol Haritası
1. **NextAuth + Vercel Postgres** ile gerçek session
2. Şifreler bcrypt hash'lenmiş şekilde DB'de
3. Server-side `getServerSession()` kontrolü her API route'ta
4. RLS (Row Level Security) — kullanıcı sadece kendi `employeeId` ile bağlı kayıtları görür
5. İki faktörlü doğrulama (TOTP)
6. PIN deneme limiti (5 başarısız → 5 dk kilit)
7. Oturum süresi & yenileme token'ları

## Yeni Kullanıcı PIN Üretimi

Admin `/kullanicilar` sayfasından yeni kullanıcı eklerken:
1. Ad + kullanıcı adı + rol seçer
2. Sistem 8 karakterli random PIN üretir
3. PIN ekranda gösterilir + kopyala butonu
4. **PIN bir daha gösterilmez** — admin not almazsa "PIN Sıfırla" ile yeni PIN üretmeli

## Yayıncı Eklerken Akış

1. Önce **Maaşlar** sayfasından yeni Employee oluştur (Ramiz/Lucy/Acelya gibi)
2. Sonra **Kullanıcılar** sayfasından bu Employee'ye bağlı yayıncı user'ı oluştur
3. Üretilen PIN'i yayıncıya teslim et (Telegram, mail, vs.)
4. Yayıncı `/login`'den giriş yapar, kendi `/yayinci` paneline yönlendirilir
