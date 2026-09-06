'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Crest } from './Crest';

export interface NavUser {
  firstName: string;
  lastName: string;
  role: 'member' | 'gabbai' | 'admin';
}

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/zmanim', label: 'Zmanim' },
  { href: '/schedule', label: 'Davening & Shiurim' },
  { href: '/sponsor', label: 'Sponsor' },
  { href: '/announcements', label: 'Announcements' },
  { href: '/donate', label: 'Donate' },
];

export function SiteHeader({
  user,
  nameHe,
  nameEn,
}: {
  user: NavUser | null;
  nameHe: string;
  nameEn: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const staff = user && (user.role === 'admin' || user.role === 'gabbai');

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-40 border-b border-gold-200 bg-ivory-100/90 backdrop-blur no-print">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="shrink-0" aria-label={nameEn}>
          <Crest size="sm" nameHe={nameHe} nameEn={nameEn} />
        </Link>

        <nav className="ml-auto hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive(l.href)
                  ? 'bg-gold-100 text-walnut-800'
                  : 'text-walnut-600 hover:bg-gold-50 hover:text-walnut-800'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          {staff && (
            <Link href="/admin" className="btn-ghost btn-sm hidden sm:inline-flex">
              Admin
            </Link>
          )}
          {user ? (
            <Link href="/account" className="btn-primary btn-sm">
              {user.firstName}
            </Link>
          ) : (
            <Link href="/login" className="btn-primary btn-sm">
              Log in
            </Link>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="btn-ghost btn-sm lg:hidden"
            aria-expanded={open}
            aria-label="Toggle menu"
          >
            Menu
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-gold-200 bg-ivory-50 px-4 py-2 lg:hidden">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`block rounded-md px-3 py-2.5 text-sm font-medium ${
                isActive(l.href) ? 'bg-gold-100 text-walnut-800' : 'text-walnut-600'
              }`}
            >
              {l.label}
            </Link>
          ))}
          {staff && (
            <Link href="/admin" onClick={() => setOpen(false)} className="block rounded-md px-3 py-2.5 text-sm font-medium text-walnut-600">
              Admin
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}

export function SiteFooter({
  nameHe,
  nameEn,
  dedicationHe,
  nasiHe,
  address,
  phone,
  email,
}: {
  nameHe: string;
  nameEn: string;
  dedicationHe: string;
  nasiHe: string;
  address: string;
  phone?: string | null;
  email?: string | null;
}) {
  return (
    <footer className="mt-16 border-t border-gold-200 bg-ivory-200/60 no-print">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="flex flex-col items-center text-center">
          <p className="he font-hebrew text-xl font-bold text-walnut-800">{nameHe}</p>
          <p className="mt-1 font-display text-sm uppercase tracking-[0.2em] text-gold-700">{nameEn}</p>
          <hr className="rule-gold my-4 max-w-xs" />
          <p className="he font-hebrew text-sm text-walnut-600">{dedicationHe}</p>
          <p className="he font-hebrew text-sm text-walnut-600">{nasiHe}</p>
          <p className="mt-4 text-sm text-walnut-500">{address}</p>
          <p className="text-sm text-walnut-500">
            {phone && <a href={`tel:${phone}`} className="hover:text-gold-700">{phone}</a>}
            {phone && email ? ' · ' : ''}
            {email && <a href={`mailto:${email}`} className="hover:text-gold-700">{email}</a>}
          </p>
          <p className="mt-6 text-xs text-walnut-400">
            <Link href="/display" className="hover:text-gold-700">Shul display board</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
