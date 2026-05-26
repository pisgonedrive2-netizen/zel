/** İzlenme verilerini sunucudan yeniden yükle (DataProvider dinler). */
export const RELOAD_VIEWERSHIP_EVENT = "fox-reload-viewership";

export function requestViewershipReload() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(RELOAD_VIEWERSHIP_EVENT));
}
