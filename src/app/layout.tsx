import type { Metadata, Viewport } from "next";
import "./globals.css";
import AuthShell from "@/components/auth-shell";
import { DataProvider } from "@/components/data-provider";
import { PayrollReminderEffect } from "@/components/payroll-reminder-effect";
import { BrandPaymentReminderEffect } from "@/components/brand-payment-reminder-effect";
import { KasaLowAlertEffect } from "@/components/kasa-low-alert-effect";
import { KasaTronSyncEffect } from "@/components/kasa-tron-sync-effect";
import { SessionIdleGuard } from "@/components/session-idle-guard";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeScript } from "@/components/theme-script";

export const metadata: Metadata = {
  title: {
    default: "Foxstream",
    template: "%s · Foxstream",
  },
  description: "Foxstream — yayın, içerik ve finans operasyonları için tek panel.",
  applicationName: "Foxstream",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Foxstream",
    statusBarStyle: "black-translucent",
  },
  authors: [{ name: "Foxstream" }],
  metadataBase: new URL("https://foxstreaming.vercel.app"),
  openGraph: {
    title: "Foxstream",
    description: "Yayın, içerik ve finans operasyonları için merkezi panel.",
    type: "website",
    locale: "tr_TR",
    siteName: "Foxstream",
  },
  icons: {
    icon: [{ url: "/foxlogo.png", type: "image/png" }],
    apple: "/foxlogo.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)",  color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body className="flex h-screen min-h-0 overflow-hidden bg-background text-foreground antialiased">
        <ThemeScript />
        <TooltipProvider>
          <div className="flex min-h-0 min-w-0 flex-1 flex-row">
            <PayrollReminderEffect />
            <BrandPaymentReminderEffect />
            <KasaLowAlertEffect />
            <KasaTronSyncEffect />
            <SessionIdleGuard />
            <DataProvider>
              <AuthShell>{children}</AuthShell>
            </DataProvider>
          </div>
        </TooltipProvider>
      </body>
    </html>
  );
}
