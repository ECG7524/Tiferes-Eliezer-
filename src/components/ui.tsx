import type { ReactNode } from 'react';

export function PageHeader({
  eyebrow,
  title,
  titleHe,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  titleHe?: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1 className="text-3xl sm:text-4xl">{title}</h1>
            {titleHe && <span className="he font-hebrew text-2xl text-gold-700">{titleHe}</span>}
          </div>
          {subtitle && <p className="mt-2 max-w-2xl text-sm text-walnut-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2 no-print">{actions}</div>}
      </div>
      <hr className="rule-gold mt-5" />
    </header>
  );
}

export function Card({
  title,
  titleHe,
  action,
  children,
  className = '',
  bodyClassName = 'card-pad',
}: {
  title?: string;
  titleHe?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-gold-200/70 px-5 py-3.5 sm:px-6">
          <div className="flex items-baseline gap-2.5">
            {title && <h2 className="text-base font-semibold sm:text-lg">{title}</h2>}
            {titleHe && <span className="he font-hebrew text-sm text-gold-700">{titleHe}</span>}
          </div>
          {action}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'good' | 'warn';
}) {
  const tones = {
    default: 'text-walnut-800',
    good: 'text-emerald-700',
    warn: 'text-amber-700',
  };
  return (
    <div className="card card-pad">
      <p className="eyebrow">{label}</p>
      <p className={`mt-2 font-display text-3xl font-semibold tabular-nums ${tones[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-walnut-400">{hint}</p>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-gold-300 px-4 py-8 text-center text-sm text-walnut-400">
      {children}
    </p>
  );
}

const BADGE_TONES: Record<string, string> = {
  open: 'bg-amber-100 text-amber-800',
  requested: 'bg-sky-100 text-sky-800',
  confirmed: 'bg-emerald-100 text-emerald-800',
  paid: 'bg-emerald-100 text-emerald-800',
  succeeded: 'bg-emerald-100 text-emerald-800',
  pledged: 'bg-amber-100 text-amber-800',
  partial: 'bg-sky-100 text-sky-800',
  pending: 'bg-amber-100 text-amber-800',
  cancelled: 'bg-walnut-100 text-walnut-500',
  waived: 'bg-walnut-100 text-walnut-500',
  refunded: 'bg-walnut-100 text-walnut-500',
  failed: 'bg-rose-100 text-rose-800',
  disabled: 'bg-rose-100 text-rose-800',
  available: 'bg-emerald-100 text-emerald-800',
  held: 'bg-amber-100 text-amber-800',
  assigned: 'bg-walnut-200 text-walnut-700',
  active: 'bg-emerald-100 text-emerald-800',
  member: 'bg-walnut-100 text-walnut-600',
  gabbai: 'bg-gold-200 text-gold-900',
  admin: 'bg-walnut-700 text-ivory-100',
  urgent: 'bg-rose-600 text-white',
  high: 'bg-amber-200 text-amber-900',
  normal: 'bg-walnut-100 text-walnut-600',
};

export function Badge({ value, label }: { value: string; label?: string }) {
  const tone = BADGE_TONES[value] ?? 'bg-walnut-100 text-walnut-600';
  return <span className={`badge ${tone}`}>{label ?? value.replace(/_/g, ' ')}</span>;
}

/** A row of flash text driven by ?ok= / ?error= after a redirect. */
export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;
  return (
    <div
      className={`mb-5 rounded-lg border px-4 py-3 text-sm ${
        error
          ? 'border-rose-300 bg-rose-50 text-rose-800'
          : 'border-emerald-300 bg-emerald-50 text-emerald-800'
      }`}
      role="status"
    >
      {error ?? ok}
    </div>
  );
}
