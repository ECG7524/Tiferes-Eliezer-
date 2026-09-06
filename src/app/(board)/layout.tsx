import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Shul Display' };

/**
 * The monitor gets no chrome at all — no header, no footer, no scrolling.
 * A board, not a web page.
 */
export default function BoardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
