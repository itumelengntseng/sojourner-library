import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { AUTHOR, SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import { StillCoversToggle } from "@/components/StillCoversToggle";
import { STILL_BOOT } from "@/lib/stillCovers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_TAGLINE,
  authors: [{ name: AUTHOR }],
  robots: { index: false, follow: false }, // private library
};

export const viewport: Viewport = { themeColor: "#2b2724" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: STILL_BOOT }} />
      </head>
      <body className="lamplit min-h-dvh antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-ink focus:px-3 focus:py-2">
          Skip to content
        </a>
        {children}
        <footer className="no-print mt-16 border-t border-timber-dark/60 px-4 py-6 text-center font-sans text-xs text-sandstone/80">
          {SITE_NAME} · All works by {AUTHOR} · <Link href="/writers-room" className="underline-offset-2 hover:underline">Writer&apos;s Room</Link>
          {" · "}<StillCoversToggle />
        </footer>
      </body>
    </html>
  );
}
