import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KonveksiTracker",
  description: "Shared team task tracker",
  // iOS ignores the manifest's icons for the Home Screen and reads
  // apple-touch-icon instead; without it the shortcut gets a blurry
  // screenshot of the page.
  appleWebApp: {
    capable: true,
    title: "KonveksiTracker",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
  other: {
    // Next emits the standardised `mobile-web-app-capable`; iOS 16.4+ reads
    // the manifest's display mode anyway, but older iOS only understands
    // this legacy name, so it's spelled out rather than relied upon.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Prevent iOS zoom-on-focus jank; inputs use >=16px font anyway.
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-100 text-neutral-900 antialiased">
        {children}
      </body>
    </html>
  );
}
