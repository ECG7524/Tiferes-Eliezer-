import Link from 'next/link';
import { redirect } from 'next/navigation';
import { registerAction } from '@/actions/auth';
import { getCurrentUser } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { Crest } from '@/components/Crest';
import { Flash } from '@/components/ui';

export const metadata = { title: 'Sign up' };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [user, settings, sp] = await Promise.all([getCurrentUser(), getSettings(), searchParams]);
  if (user) redirect('/account');

  return (
    <div className="mx-auto max-w-md py-6">
      <div className="mb-8 flex justify-center">
        <Crest size="md" nameHe={settings.nameHe} nameEn={settings.nameEn} />
      </div>

      <div className="card card-pad">
        <h1 className="text-center text-2xl">Create an account</h1>
        <hr className="rule-gold my-5" />

        <Flash error={sp.error} />

        <form action={registerAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="firstName">First name</label>
              <input id="firstName" name="firstName" required autoComplete="given-name" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="lastName">Last name</label>
              <input id="lastName" name="lastName" required autoComplete="family-name" className="input" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="hebrewName">Hebrew name <span className="normal-case text-walnut-400">(optional)</span></label>
            <input id="hebrewName" name="hebrewName" dir="rtl" className="input font-hebrew" placeholder="לדוגמה: יוסף בן אברהם" />
          </div>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required autoComplete="email" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="phone">Phone <span className="normal-case text-walnut-400">(optional)</span></label>
            <input id="phone" name="phone" type="tel" autoComplete="tel" className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="confirmPassword">Confirm</label>
              <input id="confirmPassword" name="confirmPassword" type="password" required minLength={8} autoComplete="new-password" className="input" />
            </div>
          </div>
          <button type="submit" className="btn-primary w-full">Create account</button>
        </form>

        {settings.requireApproval && (
          <p className="mt-4 rounded-lg bg-gold-50 px-3 py-2.5 text-xs text-walnut-500">
            New accounts are reviewed by the shul office before they become active.
          </p>
        )}

        <p className="mt-5 text-center text-sm text-walnut-500">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-gold-700 hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}
