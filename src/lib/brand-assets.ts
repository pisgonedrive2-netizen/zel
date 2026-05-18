/** Marka kimliği → statik PNG yolu (`public/brands`). */
const BRAND_LOGO_BY_ID: Record<string, string> = {
  "br-gala": "/brands/gala.png",
  "br-boffice": "/brands/boffice.png",
  "br-pipo": "/brands/pipo.png",
  "br-hit": "/brands/hit.png",
  "br-padi": "/brands/padisah.png",
};

export function brandLogoSrc(brandId: string): string | undefined {
  return BRAND_LOGO_BY_ID[brandId];
}
