import { getRuntimeLocale } from "./locale-state";
import { UI_PHRASES, UI_RU } from "./ui-ru";
import type { AppLocale } from "./locale";

/** Elle düzeltilen / tarama kaçıran ifadeler. */
const EXTRA_RU: Record<string, string> = {
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
  "Bu ay": "Этот месяц",
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
  "maaş satırı her ay bordrodaki kişilere göre hesaplanır": "строка зарплаты считается по людям в ведомости каждого месяца",
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

let extraPhrases: [string, string][] | null = null;
function extraPairs(): [string, string][] {
  if (!extraPhrases) {
    extraPhrases = Object.entries(EXTRA_RU).sort((a, b) => b[0].length - a[0].length);
  }
  return extraPhrases;
}

function glossaryTranslate(input: string): string {
  let i = 0;
  let out = "";
  const dicts = [extraPairs(), UI_PHRASES];
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
