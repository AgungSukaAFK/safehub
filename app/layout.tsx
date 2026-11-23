import type { Metadata, Viewport } from "next";
import { StandaloneLinkHandler, ThemeColorSync } from "@/components/pwa/link-handlers";
import { PwaSupport } from "@/components/pwa/pwa-support";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/app-config";
import { appearanceInitScript } from "@/lib/font-options";
import { fontVariables } from "@/lib/fonts";
import { AppThemeProvider } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  // App internal: jangan diindeks mesin pencari
  robots: { index: false, follow: false },
  manifest: "/manifest.json",
  icons: { icon: "/icon.svg", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#18181b" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={fontVariables} suppressHydrationWarning>
      <head>
        {/* Anti-flash: font, ukuran, aksen dipasang sebelum render */}
        <script dangerouslySetInnerHTML={{ __html: appearanceInitScript }} />
      </head>
      <body className="min-h-svh antialiased">
        <AppThemeProvider>
          <TooltipProvider delay={300}>{children}</TooltipProvider>
          {/* PWA untuk semua pengunjung (frontend-guide §22.1) */}
          <PwaSupport />
          <ThemeColorSync />
          <StandaloneLinkHandler />
          <Toaster
            richColors
            closeButton
            position="bottom-right"
            // HP: di atas tab bawah (components/shell/mobile-tabs.tsx)
            mobileOffset={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom))" }}
            toastOptions={{ closeButtonAriaLabel: "Tutup", classNames: { content: "flex-1" } }}
          />
        </AppThemeProvider>
      </body>
    </html>
  );
}
