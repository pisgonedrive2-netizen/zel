import { WEEKDAYS } from "@/store/store";
import { getRuntimeLocale } from "./locale-state";

/** Pazartesi başlangıçlı kısa gün adları (TR Pzt… / RU Пн…). slice(0,3) Cuma/Pazar’ı karıştırır. */
const WEEKDAYS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;

export function weekdayShort(index: number): string {
  const i = ((index % 7) + 7) % 7;
  return getRuntimeLocale() === "ru" ? WEEKDAYS_RU[i] : WEEKDAYS[i];
}
