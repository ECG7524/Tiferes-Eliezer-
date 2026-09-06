import { getSettings } from '@/lib/settings';
import { getCurrentUser } from '@/lib/auth';
import { SiteHeader, SiteFooter } from '@/components/SiteChrome';

export const dynamic = 'force-dynamic';

/** The public website: crest, navigation and the shul's footer plate. */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, user] = await Promise.all([getSettings(), getCurrentUser()]);
  const address = [settings.addressLine, `${settings.city}, ${settings.state} ${settings.zip}`]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        user={user ? { firstName: user.firstName, lastName: user.lastName, role: user.role } : null}
        nameHe={settings.nameHe}
        nameEn={settings.nameEn}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-10">{children}</main>
      <SiteFooter
        nameHe={settings.nameHe}
        nameEn={settings.nameEn}
        dedicationHe={settings.dedicationHe}
        nasiHe={settings.nasiHe}
        address={address}
        phone={settings.phone}
        email={settings.email}
      />
    </div>
  );
}
