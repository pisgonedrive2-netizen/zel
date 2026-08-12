import { getRuntimeLocale } from "./locale-state";
import { UI_PHRASES, UI_RU } from "./ui-ru";
import type { AppLocale } from "./locale";
import ADMIN_SCAN from "./admin-scan-ru.json";
import BRAND_SCAN from "./brand-scan-ru.json";
import LOGIN_SCAN from "./login-scan-ru.json";
import PAGES_SCAN from "./pages-scan-ru.json";

/** Elle düzeltilen / tarama kaçıran ifadeler (SCAN üzerine yazar). */
const HAND_RU: Record<string, string> = {
  // Login / register footer — exact overrides (short glossary stems otherwise poison these)
  "Kayıt ol": "Регистрация",
  "Yayıncı başvurusu gönder": "Отправить заявку стримера",
  "Marka başvurusu gönder": "Отправить заявку бренда",
  "Kayıt talebi gönder": "Отправить заявку на регистрацию",
  "← Giriş ekranına dön": "← Назад к входу",
  "Giriş ekranına dön": "Назад к входу",
  "Havuza katıl": "Вступить в пул",
  "Aktif olduğun platformlar": "Ваши активные платформы",
  "Sahne / yayıncı adı *": "Сценическое / имя стримера *",
  "İletişim e-postası *": "Контактный e-mail *",
  "Gerçek ad soyad": "Настоящее ФИО",
  "Detaylı izlenme": "Подробные просмотры",
  "Detaylı izlenme paneli": "Панель подробных просмотров",
  "Marka paneli": "Панель бренда",
  "Marka modül grupları": "Группы модулей бренда",
  "Kenar çubuğunu genişlet": "Развернуть боковую панель",
  "Kenar çubuğunu daralt": "Свернуть боковую панель",
  "Menüde ara": "Поиск в меню",
  "Son Bildirimler": "Последние уведомления",
  "Bildirim yok.": "Нет уведомлений.",
  "Temizle": "Очистить",
  "Okundu": "Прочитано",
  "Bildirimi sil": "Удалить уведомление",
  "Üst kontroller": "Верхние элементы",
  "Panele geri dön": "Назад в панель",
  "Kaydet": "Сохранить",
  "Vazgeç": "Отмена",
  "Ara...": "Поиск...",
  "Yükleniyor...": "Загрузка…",
  "Yükleniyor": "Загрузка",
  "Hata": "Ошибка",
  "Başarılı": "Успешно",
  "Uyarı": "Внимание",
  "Bilgi": "Инфо",
  "Kapat": "Закрыть",
  "Devam": "Далее",
  "Göster": "Показать",
  "Gizle": "Скрыть",
  "Kopyalandı": "Скопировано",
  "Zorunlu alan": "Обязательное поле",
  "Geçersiz": "Неверно",
  "Seçili": "Выбрано",
  "Filtreler": "Фильтры",
  "Dışa aktar CSV": "Экспорт CSV",
  "Dışa aktar PDF": "Экспорт PDF",
  "Yenile": "Обновить",
  "Bugün": "Сегодня",
  "Bu ay": "Этот месяц",
  "Bu hafta": "Эта неделя",
  "Geçen ay": "Прошлый месяц",
  "Geçen hafta": "Прошлая неделя",
  "Dışa aktarma başarısız": "Экспорт не удался",
  "bilinmeyen hata": "неизвестная ошибка",
  "Hazırlanıyor…": "Готовится…",
  "Ay seç": "Месяц",
  "Rapor ayı seç": "Выберите месяц отчёта",
  "Dışa aktar": "Экспорт",
  "PDF olarak indir": "Скачать PDF",
  "Excel (CSV) olarak indir": "Скачать Excel (CSV)",
  "Excel uyumlu, UTF-8 BOM ile": "Совместимо с Excel, UTF-8 BOM",
  "İndir": "Скачать",
  "Dış partner": "Внешний партнёр",
  "Ajans": "Агентство",
  "Sosyal": "Соцсети",
  "Sabit": "Фикс",
  "Bekliyor": "Ожидает",
  "Onaylandı": "Одобрено",
  "İptal": "Отмена",
  "Denetim modu": "Режим аудита",
  "hesabındasınız": "вы в этом аккаунте",
  "olarak": "как",
  "Kendi hesabıma dön": "Вернуться в свой аккаунт",
  "Bildirim Merkezi": "Центр уведомлений",
  "okunmamış": "непрочитанных",
  "yeni": "новых",
  "Akış": "Лента",
  "Gönder": "Отправить",
  "Ayarlar": "Настройки",
  "Tercihler": "Настройки",
  "Bildirim bölümleri": "Разделы уведомлений",
  "Kötü": "Плохой",
  "Temkinli": "Осторожный",
  "Baz (gerçek)": "База (факт)",
  "İyi": "Хороший",
  "Agresif": "Агрессивный",
  "Senaryolar": "Сценарии",
  "Hazır senaryolar": "Готовые сценарии",
  "Özel senaryo (ne olursa?)": "Свой сценарий (что если?)",
  "Kurallar": "Правила",
  "Dağıtım": "Распределение",
  "kayıt": "записей",
  "Genel Bakış": "Обзор",
  "mali özet": "финансовая сводка",
  "bordosunda": "в ведомости",
  "kayıtlı yayın": "зарегистрированных эфиров",
  "tutarlar": "суммы",
  "Kar marjı": "Маржа прибыли",
  "Kar marjı %": "Маржа прибыли %",
  "Kasa bakiyesi nasıl okunur?": "Как читать баланс кассы?",
  "Toplam bakiye": "Общий баланс",
  "Bu rakam": "Эта сумма",
  "toplamıdır": "это сумма",
  "otomatik TRON hareketleridir": "это автоматические движения TRON",
  "harcama kasasıdır": "это касса расходов",
  "Kasa detayı →": "Детали кассы →",
  "Ramiz cüzdan toplam": "Итого кошелёк Рамиза",
  "Ramiz cüzdan (otomatik)": "Кошелёк Рамиза (авто)",
  "Ramiz cüzdanı": "Кошелёк Рамиза",
  "Genel Kasa": "Общая касса",
  "Genel kasa bakiyesi düşük": "Низкий баланс общей кассы",
  "Genel kasa durumu": "Состояние общей кассы",
  "Maaş/gider için kullanılan ana kasa": "Основная касса для зарплат и расходов",
  "Bu Ay": "Этот месяц",
  "Bu Ay Bekleyen Ödeme": "Ожидает выплаты в этом месяце",
  "Bu Ay Bekleyen Ödemeler": "Ожидающие выплаты в этом месяце",
  "Geri ödenmemiş avans bakiyesi": "Непогашенный остаток аванса",
  "İçerik Harcaması (Bu Ay)": "Расход на контент (этот месяц)",
  "Net Kar (yıllık tahmin)": "Чистая прибыль (годовая оценка)",
  "Toplam Gelir (yıllık)": "Доход всего (год)",
  "Bordrolu Yayıncı": "Стримеры в ведомости",
  "Tam kadro": "Полный состав",
  "Aktif Marka": "Активные бренды",
  "Takip Edilen Link": "Отслеживаемые ссылки",
  "Otomatik izlenen sosyal medya linkleri": "Автоматически отслеживаемые ссылки соцсетей",
  "Gelir / Gider Analizi": "Анализ доходов / расходов",
  "Mali Dağılım": "Финансовое распределение",
  "İç Proje": "Внутренний проект",
  "Dış Firmalar": "Внешние компании",
  "Aylık Gelir Kırılımı": "Разбивка дохода по месяцам",
  "Dış + İç proje gelirleri": "Внешние + внутренние доходы",
  "Son Aktiviteler": "Последние действия",
  "Güncel durum bildirimleri": "Актуальные уведомления",
  "Tüm yayıncı gönderimleri onaylanmış": "Все заявки стримеров одобрены",
  "Bekleyen inceleme yok": "Нет ожидающих проверок",
  "bekleyen maaş ödemesi": "ожидающих зарплатных выплат",
  "Tüm içerik harcamaları kapalı": "Все расходы на контент закрыты",
  "Bekleyen rapor yok": "Нет ожидающих отчётов",
  "Ödeme Raporu hazır": "Отчёт по выплатам готов",
  "Bildirimler": "Уведомления",
  "Bildirim Akışı": "Лента уведомлений",
  "Tüm bildirimler okundu": "Все уведомления прочитаны",
  "Görüntüle →": "Смотреть →",
  "Otomatik": "Авто",
  "Temiz": "Чисто",
  "Aktif": "Активен",
  "aktif": "активных",
  "kişi": "чел.",
  "bekliyor": "ожидает",
  "ödeme": "выплата",
  "toplam": "итого",
  "yıllık tahmin": "годовая оценка",
  "yıllık": "год",
  "işletme": "операции",
  "harcama": "расход",
  "marj": "маржа",
  "bordrosu": "ведомость",
  "koordinatör": "координатор",
  "yayıncı": "стример",
  "OrkunTilki bu uygulamayı geliştirdi.": "OrkunTilki разработал это приложение.",
  "bakiyesi": "баланс",
  "maaş ve gider ödemeleri için kullanılan ana kasa": "основная касса для зарплат и расходов",
  "otomatik işlem": "автоопераций",
  "Açık avans": "Открытый аванс",
  "açık avans": "открытый аванс",
  "Kayıtlı yayın ekibi": "Зарегистрированная команда эфиров",
  "hepsi bu ay bordoda.": "все в ведомости этого месяца.",
  "takip edilen link": "отслеживаемых ссылок",
  "yayıncı raporu": "отчёт стримера",
  "aşağıdaki tutarlar bu aya aittir (bir önceki ayın maaşı değil).": "суммы ниже относятся к этому месяцу (это не зарплата прошлого месяца).",
  "ödeme · toplam": "выплата · итого",
  "maaş satırı her ay bordrodaki kişilere göre hesaplanır": "строка зарплаты считается по людям в ведомости каждого месяца",
  "tahmin payları · maaş toplamı 12 ay bordro netlerinin gerçek toplamı": "доли оценки · сумма зарплат — фактический итог нетто за 12 месяцев",
  "temel": "база",
  "işlem": "операций",
  "link": "ссылок",
  "göre hesaplanır": "считается по",
  "Görüntülenen ay:": "Показан месяц:",
  "Ay tarihi": "Дата месяца",
  "Bu ayın linkleri": "Ссылки этого месяца",
  "Yatırım & büyüme hedefleri": "Инвестиции и цели роста",
  "Haftalık çekim özeti": "Сводка съёмок за неделю",
  "Plan bölümü — hızlı atlama": "Раздел плана — быстрый переход",
  "Yayıncıların aktif kullandığı tüm hesap, kanal ve linkler": "Все активные аккаунты, каналы и ссылки стримеров",
  "Kanban": "Канбан",
  "Zaman çizelgesi": "Таймлайн",
  "Hesaplar ve PIN": "Аккаунты и PIN",
  "Sabit büyüme senaryosu net kar:": "Чистая прибыль при фиксированном росте:",
  "Kayıtlı planlanan toplam bütçe:": "Зарегистрированный плановый бюджет:",

  // İzlenme · Markalar
  "Hedefi olan markalar": "Бренды с целью",
  "Hedef tanımsız": "Цель не задана",
  "Ort. hedef tutturma": "Ср. выполнение цели",
  "Bu ay izlenme": "Просмотры за месяц",
  "Lider platform": "Лидер платформы",
  "Aktif marka": "Активный бренд",
  "Yükselişte": "В росте",
  "Bir önceki aya göre en güçlü artış": "Самый сильный рост к прошлому месяцу",
  "Tıklanan her kart marka detay sayfasını açar — {month} özeti ile.":
    "Каждая карточка открывает страницу бренда — сводка за {month}.",
  "Marka kart listesi · ay bazlı performans": "Список брендов · показатели по месяцу",
  "PDF özet": "PDF сводка",
  "Veri yok": "Нет данных",
  "{n} izlenme": "{n} просмотров",
  "{n} toplam": "{n} всего",

  // Takvim — tam cümleler (tarama yarı-çevirilerini ezer)
  "Plan ekle": "Добавить план",
  "Yayıncı planlarını göster": "Показать планы стримера",
  "Yayıncı Haftalık Planları": "Недельные планы стримера",
  "Hızlı başlangıç:": "Быстрый старт:",
  "İçerik URL": "URL контента",
  "İçerik paylaşıldı": "Контент опубликован",
  "İçerik yok": "Нет контента",
  "Paylaşım yapıldı": "Контент опубликован",
  "Paylaşım yok": "Нет публикации",
  "Paylaşım": "Публикация",
  "Paylaşım takvimi (detay)": "Календарь публикаций (детали)",
  "30 günlük URL işaretleme — achievement ile aynı veri":
    "Отметка URL за 30 дней — те же данные, что в achievement",
  "Linkler, harcamalar, izlenme — uzun liste; varsayılan kapalı":
    "Ссылки, расходы, просмотры — длинный список; по умолчанию свёрнут",
  "Günlük içerik check-in": "Ежедневный check-in контента",
  "operasyon & performans": "операции и эффективность",
  "Aylık takvim, seri ve kişisel hesap paylaşımları — plan tahtasının üstünde":
    "Месячный календарь, серии и публикации личных аккаунтов — над доской плана",
  "paylaşım achievement'ı": "achievement публикаций",
  "7 saniye şablon · haftalık plan": "7-секундный шаблон · недельный план",
  "Tek tıkla haftalık plan satırları": "Строки недельного плана в один клик",
  "Yayıncı planı": "План стримера",
  "Geniş ekran": "Широкий экран",
  "Saat saat geniş takvim görünümü": "Почасовой широкий календарь",
  "Takvim saat dilimi": "Часовой пояс календаря",
  "Bu yayıncı için henüz paylaşım kaydı yok (check-in veya havuz postu). Alttaki":
    "У этого стримера ещё нет записей публикаций (check-in или пост пула). Ниже",
  "ile ekleyin veya": "добавьте или через",
  "üzerinden URL girin; achievement takvimi otomatik dolacak.":
    "введите URL; календарь achievement заполнится автоматически.",
  "Yeni Hesap Ekle": "Добавить аккаунт",
  "Hesabı Düzenle": "Изменить аккаунт",
  "Yayın Slotu Ekle": "Добавить слот эфира",
  "Slotu Düzenle": "Изменить слот",
  "Haftalık Plan Ekle": "Добавить недельный план",
  "Planı Düzenle": "Изменить план",
  "Haftalık takvim · geniş ekran": "Недельный календарь · широкий экран",
  "şablon önizleme": "превью шаблона",
  "Haftalık Yayın Planı": "Недельный план эфиров",
  "Rutin yayın slotları + yayıncıların eklediği haftalık planlar. Slot eklemek için boş hücreye tıklayın.":
    "Регулярные слоты эфира + недельные планы стримеров. Чтобы добавить слот, нажмите пустую ячейку.",
  "Saat dilimi:": "Часовой пояс:",

  // Aylık İçerik Planı
  "Aylık İçerik Planı": "Месячный контент-план",
  "4 haftalık şablon · düzenlenebilir · seçili yayıncıya hafta olarak yazılır":
    "Шаблон на 4 недели · редактируемый · записывается выбранному стримеру по неделям",
  "Sıfırla": "Сбросить",
  "Hafta": "Неделя",
  "hf": "нед.",
  "Boş": "Пусто",
  "Toplam reels": "Всего Reels",
  "Yetişkin": "Adult",
  "Edit / montaj": "Монтаж",
  "Kick yayını": "Эфир Kick",
  "Reels dağılımı (çekim)": "Распределение Reels (съёмка)",
  "Gala stok": "Сток Gala",
  "Gala: {shoot} çekim → {publish} paylaşım + {stock} stok (çekim günlerinde markayı aradan çıkarmak için).":
    "Gala: {shoot} съёмка → {publish} публикаций + {stock} сток (чтобы закрыть бренд в съёмочные дни).",
  "Hizmet bedelleri": "Стоимость услуг",
  "yalnız yönetici": "только админ",
  "Ana paket": "Основной пакет",
  "12 reels paketi": "Пакет 12 Reels",
  "Marka başı · ayda 2 reels": "За бренд · 2 Reels в месяц",
  "Yayıncı (Ramiz) yan marka ve paket bedellerini görmez. Özel içerik serbest kota — ay içinde kararlaştırılır.":
    "Стример (Рамиз) не видит оплату побочных брендов и пакетов. Спецконтент — свободная квота, решается в течение месяца.",
  "CSV": "CSV",
  "Yazdır": "Печать",
  "CSV indirildi.": "CSV скачан.",
  "4 haftayı yaz": "Записать 4 недели",
  "4 hafta → {count} plan yazıldı ({name}).": "4 недели → записано планов: {count} ({name}).",
  "Haftayı plana yaz": "Записать неделю в план",
  "Boş günlere bas": "Заполнить пустые дни",
  "Sonraki haftaya kopyala": "Копировать на следующую неделю",
  "Hafta {n} için şablon boş günlere yazılsın mı?":
    "Записать шаблон недели {n} в пустые дни?",
  "Şablon varsayılana sıfırlandı.": "Шаблон сброшен к значениям по умолчанию.",
  "4. haftadan sonra şablon haftası yok — takvim haftasını kaydırın.":
    "После 4-й недели шаблона нет — сдвиньте неделю календаря.",
  "Hafta {n}": "Неделя {n}",
  "Hafta {n}: yazılacak boş gün yok (veya zaten dolu).":
    "Неделя {n}: нет пустых дней для записи (или уже заполнено).",
  "Hafta {n} → {count} plan yazıldı ({range}).":
    "Неделя {n} → записано планов: {count} ({range}).",
  "Şablon hafta {from} → {to} kopyalandı": "Шаблон недели {from} → {to} скопирован",
  "· {count} plan yazıldı.": "· записано планов: {count}.",
  "· hedef hafta doluydu, yalnızca şablon güncellendi.":
    "· целевая неделя была занята, обновлён только шаблон.",
  "Tür": "Тип",
  "Adet": "Кол-во",
  "Başlık": "Заголовок",
  "Galagrup günü (Boffice + Pipo + Hit + Gala + Padi · 1’er)":
    "День Galagrup (Boffice + Pipo + Hit + Gala + Padi · по 1)",
  "Marka": "Бренд",
  "— Marka —": "— Бренд —",
  "Stok (çekimden ayrılacak)": "Сток (из съёмки)",
  "Not": "Заметка",
  "Opsiyonel": "Необязательно",
  "Günü temizle": "Очистить день",
  "Düzenle · {week}. hafta · gün {day}": "Редактировать · неделя {week} · день {day}",
  "Serbest": "Свободно",
  "İzin": "Выходной",
  "Vlog": "Vlog",
  "Reels": "Reels",

  // Slot titles / notes (brand names stay)
  "Edit · Montaj · Kostüm · Mekan": "Монтаж · костюм · локация",
  "Ortak prep / post-prod günü": "Общий prep / post-prod день",
  "Padişah Yetişkin İçeriği": "Padişah — adult-контент",
  "Padişah Vlog": "Padişah Vlog",
  "5 Padişah Reels": "5 Reels Padişah",
  "5 Galagrup Reels": "5 Reels Galagrup",
  "Her birine 1 adet": "По 1 шт. каждому",
  "Galabet Vlog": "Galabet Vlog",
  "Galabet Kick Yayını": "Эфир Kick · Galabet",
  "Padişah Kick Yayını": "Эфир Kick · Padişah",
  "Galabet Yetişkin İçeriği": "Galabet — adult-контент",
  "Özel içerik / esnek kota — ay içinde kararlaştırılır":
    "Спецконтент / гибкая квота — решается в течение месяца",
  "Galabet 5 Reels": "5 Reels Galabet",
  "Tek marka · 5 çekim (Galagrup değil)": "Один бренд · 5 съёмок (не Galagrup)",

  // Rule templates
  "Yetişkin içerik {n} (hedef 6: Padişah Salı×4 + Gala Cmt W1–W2).":
    "Adult-контент {n} (цель 6: Padişah вт×4 + Gala сб W1–W2).",
  "{brand} reels {n} (hedef 2 — yalnızca Galagrup Pazartesileri).":
    "{brand} Reels {n} (цель 2 — только понедельники Galagrup).",
  "Padişah reels {n} (hedef 12).": "Padişah Reels {n} (цель 12).",
  "Gala reels çekim {n} (hedef 7 → 5 paylaşım + 2 stok).":
    "Gala Reels съёмка {n} (цель 7 → 5 публикаций + 2 сток).",
  "Toplam reels çekim {n} (hedef 25).": "Всего Reels съёмка {n} (цель 25).",
};

const EXTRA_RU: Record<string, string> = {
  ...ADMIN_SCAN,
  ...BRAND_SCAN,
  ...LOGIN_SCAN,
  ...PAGES_SCAN,
  ...HAND_RU,
};

const TR_CHAR = /[ğıüşöçİĞÜŞÖÇ]/;
const SKIP = /^(https?:|mailto:|tel:)/i;
const ONLY_CODE = /^[\w./#@%+=?&:;-]+$/;
const LETTER = /\p{L}/u;

function preserveWs(original: string, translated: string): string {
  const lead = original.match(/^\s*/)?.[0] ?? "";
  const trail = original.match(/\s*$/)?.[0] ?? "";
  return lead + translated + trail;
}

function isLetter(ch: string | undefined): boolean {
  return !!ch && LETTER.test(ch);
}

/** Cümle içi eşleşme — kısa kökler ("ile","marka") cümleyi bozar; exact match etkilenmez. */
const GLOSSARY_MIN_LEN = 10;

let extraPhrases: [string, string][] | null = null;
let glossaryExtraPhrases: [string, string][] | null = null;
let glossaryUiPhrases: [string, string][] | null = null;

function extraPairs(): [string, string][] {
  if (!extraPhrases) {
    extraPhrases = Object.entries(EXTRA_RU).sort((a, b) => b[0].length - a[0].length);
  }
  return extraPhrases;
}

function glossaryDicts(): [string, string][][] {
  if (!glossaryExtraPhrases) {
    glossaryExtraPhrases = extraPairs().filter(([k]) => k.length >= GLOSSARY_MIN_LEN);
  }
  if (!glossaryUiPhrases) {
    glossaryUiPhrases = UI_PHRASES.filter(([k]) => k.length >= GLOSSARY_MIN_LEN);
  }
  return [glossaryExtraPhrases, glossaryUiPhrases];
}

function glossaryTranslate(input: string): string {
  let i = 0;
  let out = "";
  const dicts = glossaryDicts();
  while (i < input.length) {
    let hit: [string, string] | null = null;
    if (!isLetter(input[i - 1])) {
      outer: for (const pairs of dicts) {
        for (const pair of pairs) {
          if (!input.startsWith(pair[0], i)) continue;
          if (isLetter(input[i + pair[0].length])) continue;
          hit = pair;
          break outer;
        }
      }
    }
    if (hit) {
      out += hit[1];
      i += hit[0].length;
    } else {
      out += input[i];
      i++;
    }
  }
  return out;
}

/** TR metni locale RU ise çevirir; aksi halde olduğu gibi bırakır. */
export function t(text: string, locale?: AppLocale): string {
  if (!text) return text;
  const loc = locale ?? getRuntimeLocale();
  if (loc !== "ru") return text;
  const trimmed = text.trim();
  if (trimmed.length < 2) return text;
  if (SKIP.test(trimmed)) return text;

  const exact = EXTRA_RU[trimmed] ?? UI_RU[trimmed] ?? EXTRA_RU[text] ?? UI_RU[text];
  if (exact) return preserveWs(text, exact);
  if (ONLY_CODE.test(trimmed) && !TR_CHAR.test(trimmed)) return text;

  const stripped = trimmed.replace(/[:.…]+$/, "");
  if (stripped !== trimmed && (EXTRA_RU[stripped] || UI_RU[stripped])) {
    const hit = EXTRA_RU[stripped] ?? UI_RU[stripped];
    return preserveWs(text, hit + trimmed.slice(stripped.length));
  }

  const via = glossaryTranslate(trimmed);
  if (via !== trimmed) return preserveWs(text, via);
  return text;
}

export function tMaybe(value: unknown, locale?: AppLocale): unknown {
  return typeof value === "string" ? t(value, locale) : value;
}
