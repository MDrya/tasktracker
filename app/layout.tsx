import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TaskTracker",
  description: "Shared team task tracker",
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
