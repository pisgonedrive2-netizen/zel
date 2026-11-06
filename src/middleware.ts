import { NextRequest, NextResponse } from "next/server";
import { isClipPublicHost } from "@/lib/clip-host";

const CLIP_COOKIE = "__clip_host";

function withClipCookie(res: NextResponse): NextResponse {
  res.cookies.set(CLIP_COOKIE, "1", {
    path: "/",
    sameSite: "lax",
    secure: true,
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

/**
 * videoyolla.com → sadece klip yüzü (/ ve /durum → /video-yolla*).
 * Form/API aynı Foxstream projesine düşer; panel rotaları kilitli.
 */
export function middleware(req: NextRequest) {
  const host = req.headers.get("host");
  if (!isClipPublicHost(host)) return NextResponse.next();

  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/clip") ||
    pathname.startsWith("/api/admin/link-thumbs") ||
    pathname === "/foxlogo.png" ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/manifest.webmanifest" ||
    /\.(?:png|jpg|jpeg|gif|webp|svg|ico|txt|xml|webmanifest)$/i.test(pathname)
  ) {
    return withClipCookie(NextResponse.next());
  }

  if (pathname === "/" || pathname === "") {
    const url = req.nextUrl.clone();
    url.pathname = "/video-yolla";
    return withClipCookie(NextResponse.rewrite(url));
  }

  if (pathname === "/durum" || pathname.startsWith("/durum/")) {
    const url = req.nextUrl.clone();
    url.pathname = `/video-yolla${pathname}`;
    return withClipCookie(NextResponse.rewrite(url));
  }

  if (pathname.startsWith("/video-yolla")) {
    return withClipCookie(NextResponse.next());
  }

  const home = req.nextUrl.clone();
  home.pathname = "/";
  home.search = "";
  return withClipCookie(NextResponse.redirect(home));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
