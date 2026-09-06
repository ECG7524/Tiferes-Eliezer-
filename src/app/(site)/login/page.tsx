import Link from 'next/link';
import { redirect } from 'next/navigation';
import { loginAction } from '@/actions/auth';
import { getCurrentUser } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { Crest } from '@/components/Crest';
import { Flash } from '@/components/ui';

export const metadata = { title: 'Log in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; next?: string }>;
}) {
  const [user, settings, sp] = await Promise.all([getCurrentUser(), getSettings(), searchParams]);
  if (user) redirect('/account');

  return (
    <div className="mx-auto max-w-md py-6">
      <div className="mb-8 flex justify-center">
        <Crest size="md" nameHe={settings.nameHe} nameEn={settings.nameEn} />
      </div>

      <div className="card card-pad">
        <h1 className="text-center text-2xl">Log in</h1>
        <p className="mt-1.5 text-center text-sm text-walnut-500">
          Members can see announcements, their giving history and their seats.
        </p>
        <hr className="rule-gold my-5" />

        <Flash ok={sp.ok} error={sp.error} />

        <form action={loginAction} className="space-y-4">
          <input type="hidden" name="next" value={sp.next ?? '/account'} />
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
          </div>
          <button type="submit" className="btn-primary w-full">Log in</button>
        </form>

        <p className="mt-5 text-center text-sm text-walnut-500">
          No account yet?{' '}
          <Link href="/register" className="font-semibold text-gold-700 hover:underline">Sign up</Link>
        </p>
      </div>

      <p className="mt-6 text-center text-xs text-walnut-400">
        Zmanim, davening times and the shul calendar are open to everyone — no account needed.
      </p>
    </div>
  );
}
