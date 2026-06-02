/**
 * TronGrid kota planı (Pro ~100k istek/ay).
 *
 * Arka plan 5 dk: ~6 istek × 288/gün ≈ 1.7k/gün ≈ 52k/ay (100k limit içinde).
 */

/** Cron + istemci arka plan senkron aralığı (ms). */
export const TRON_BACKGROUND_POLL_MS = 5 * 60 * 1000;

/** Arka plan / cron: son kaç gün taranır (üst üste bindirme ile kaçırma önlenir). */
export const TRON_BACKGROUND_RECENT_DAYS = 7;

/** Incremental sync: pass başına max sayfa (200 tx/sayfa). */
export const TRON_PAGES_INCREMENTAL = 10;

/** Tarihten itibaren tam çekim: pass başına max sayfa. */
export const TRON_PAGES_FULL = 25;

/** TronGrid istekleri arası bekleme (ms). */
export const TRON_REQUEST_GAP_MS = 220;
