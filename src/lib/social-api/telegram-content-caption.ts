export function buildContentCaption(opts: {
  employeeName?: string | null;
  platform: string;
  url: string;
  handle?: string | null;
}): string {
  const who = [opts.employeeName?.trim(), opts.handle?.trim()].filter(Boolean).join(" · ");
  const plat = opts.platform.trim() || "Video";
  const head = who ? `${who} · ${plat}` : plat;
  return `${head}\n${opts.url.trim()}`;
}
