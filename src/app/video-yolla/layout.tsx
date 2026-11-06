import type { Metadata } from "next";
import { Anton, Archivo } from "next/font/google";

const display = Anton({
  subsets: ["latin", "latin-ext"],
  weight: "400",
  variable: "--font-vy-display",
  display: "swap",
});

const body = Archivo({
  subsets: ["latin", "latin-ext"],
  variable: "--font-vy-body",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.videoyolla.com"),
  title: { absolute: "videoyolla · Lanetkel clip farm" },
  description: "Lanetkel videolarından klip çıkar, reels paylaşarak kazan.",
  applicationName: "videoyolla",
  appleWebApp: { capable: true, title: "videoyolla", statusBarStyle: "black-translucent" },
  authors: [{ name: "videoyolla" }],
  openGraph: {
    title: "videoyolla · Lanetkel clip farm",
    description: "Lanetkel videolarından klip çıkar, reels paylaşarak kazan.",
    siteName: "videoyolla",
    type: "website",
    locale: "tr_TR",
    url: "https://www.videoyolla.com",
    images: [{ url: "/video-yolla/og.jpg", width: 1200, height: 630, alt: "videoyolla" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "videoyolla · Lanetkel clip farm",
    description: "Lanetkel videolarından klip çıkar, reels paylaşarak kazan.",
    images: ["/video-yolla/og.jpg"],
  },
};

export default function VideoYollaLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${display.variable} ${body.variable}`}>{children}</div>;
}
