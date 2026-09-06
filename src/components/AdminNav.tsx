'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const SECTIONS: { href: string; label: string; adminOnly?: boolean }[] = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/donations', label: 'Donations' },
  { href: '/admin/categories', label: 'Funds' },
  { href: '/admin/sponsorships', label: 'Kiddush & Seudos' },
  { href: '/admin/seats', label: 'Seats' },
  { href: '/admin/aliyos', label: 'Aliyos' },
  { href: '/admin/schedule', label: 'Davening & Shiurim' },
  { href: '/admin/announcements', label: 'Announcements' },
  { href: '/admin/yahrzeits', label: 'Yahrzeits' },
  { href: '/admin/members', label: 'Members', adminOnly: true },
  { href: '/admin/settings', label: 'Settings', adminOnly: true },
];

export function AdminNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex flex-wrap gap-1 rounded-xl border border-gold-200 bg-white/70 p-1.5 no-print">
      {SECTIONS.filter((s) => isAdmin || !s.adminOnly).map((s) => {
        const active = s.href === '/admin' ? pathname === '/admin' : pathname.startsWith(s.href);
        return (
          <Link
            key={s.href}
            href={s.href}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active ? 'bg-walnut-700 text-ivory-50' : 'text-walnut-600 hover:bg-gold-100'
            }`}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
