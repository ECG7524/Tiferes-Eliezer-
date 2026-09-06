import type { Metadata, Viewport } from 'next';
import './globals.css';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings().catch(() => null);
  const name = s ? `${s.nameEn} · ${s.nameHe}` : 'Kehal Tiferes Eliezer';
  return {
    title: { default: name, template: `%s · ${s?.nameEn ?? 'Tiferes Eliezer'}` },
    description: `Zmanim, davening times, shiurim, announcements and giving for ${s?.nameEn ?? 'the shul'}.`,
    // Served from public/. A missing file simply leaves the browser default.
    icons: { icon: '/icon.png', apple: '/icon.png' },
  };
}

export const viewport: Viewport = {
  themeColor: '#FAF6EC',
  width: 'device-width',
  initialScale: 1,
};

/**
 * The one root layout. It carries the document shell and the fonts, and
 * nothing else — the public site and the shul monitor each dress the page
 * themselves in their own group layout.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* A plain stylesheet link rather than next/font, so a build never
            depends on reaching Google; the serif fallbacks are close enough. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Frank+Ruhl+Libre:wght@400;500;700;900&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
