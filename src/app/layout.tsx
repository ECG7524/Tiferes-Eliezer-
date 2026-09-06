import type { Metadata, Viewport } from 'next';
// Self-hosted so the board keeps its typography with no network at all — a
// monitor in a shul should not lose its fonts when the wifi drops.
import '@fontsource/david-libre/hebrew-400.css';
import '@fontsource/david-libre/hebrew-500.css';
import '@fontsource/david-libre/hebrew-700.css';
import '@fontsource/david-libre/latin-400.css';
import '@fontsource/david-libre/latin-700.css';
import '@fontsource/suez-one/hebrew-400.css';
import '@fontsource/suez-one/latin-400.css';
import '@fontsource/playfair-display/latin-500.css';
import '@fontsource/playfair-display/latin-600.css';
import '@fontsource/playfair-display/latin-700.css';
import '@fontsource/playfair-display/latin-800.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import './globals.css';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings().catch(() => null);
  const name = s ? `${s.nameEn} · ${s.nameHe}` : 'Kehal Tiferes Eliezer';
  return {
    title: { default: name, template: `%s · ${s?.nameEn ?? 'Tiferes Eliezer'}` },
    description: `Zmanim, davening times, shiurim, announcements and giving for ${s?.nameEn ?? 'the shul'}.`,
    icons: {
      icon: [
        { url: '/brand/kte-icon-32.png', sizes: '32x32', type: 'image/png' },
        { url: '/brand/kte-icon-192.png', sizes: '192x192', type: 'image/png' },
        { url: '/brand/kte-icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
      apple: { url: '/brand/kte-icon-180.png', sizes: '180x180' },
    },
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
      <body>{children}</body>
    </html>
  );
}
