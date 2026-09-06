import { redirect } from 'next/navigation';
import { getCurrentUser, atLeast } from '@/lib/auth';
import { AdminNav } from '@/components/AdminNav';

export const metadata = { title: 'Admin' };
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  // Gabbaim run the shul modules; a plain member has no business here.
  if (!atLeast(user, 'gabbai')) {
    redirect('/login?next=/admin&error=' + encodeURIComponent('That area is for the shul office.'));
  }

  return (
    <>
      <AdminNav isAdmin={user!.role === 'admin'} />
      {children}
    </>
  );
}
