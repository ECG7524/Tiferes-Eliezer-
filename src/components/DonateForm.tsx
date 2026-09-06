'use client';

import { useState } from 'react';
import { formatMoney } from '@/lib/money';

export interface DonateCategory {
  id: number;
  name: string;
  nameHe: string | null;
  description: string | null;
  suggestedAmounts: number[];
  allowCustomAmount: boolean;
}

export function DonateForm({
  categories,
  action,
  stripeEnabled,
  defaultCategoryId,
  donor,
}: {
  categories: DonateCategory[];
  action: (formData: FormData) => void;
  stripeEnabled: boolean;
  defaultCategoryId?: number;
  donor?: { name: string; email: string } | null;
}) {
  const [categoryId, setCategoryId] = useState(defaultCategoryId ?? categories[0]?.id ?? 0);
  const [amount, setAmount] = useState('');
  const [payNow, setPayNow] = useState(stripeEnabled ? 'card' : 'pledge');

  const category = categories.find((c) => c.id === categoryId) ?? categories[0];
  const amountCents = Math.round(Number(amount.replace(/[^0-9.]/g, '')) * 100) || 0;

  if (!category) {
    return (
      <p className="rounded-lg border border-dashed border-gold-300 px-4 py-8 text-center text-sm text-walnut-400">
        No funds are open for giving right now.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-6">
      {/* ---- What the gift is for ---- */}
      <fieldset>
        <legend className="label">What is your gift for?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {categories.map((c) => (
            <label
              key={c.id}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                c.id === categoryId
                  ? 'border-gold-500 bg-gold-50 ring-1 ring-gold-500'
                  : 'border-gold-200 hover:border-gold-400 hover:bg-gold-50/50'
              }`}
            >
              <input
                type="radio"
                name="categoryId"
                value={c.id}
                checked={c.id === categoryId}
                onChange={() => { setCategoryId(c.id); setAmount(''); }}
                className="mt-1 accent-gold-600"
              />
              <span className="min-w-0">
                <span className="flex flex-wrap items-baseline gap-2">
                  <span className="font-semibold text-walnut-800">{c.name}</span>
                  {c.nameHe && <span className="he font-hebrew text-sm text-gold-700">{c.nameHe}</span>}
                </span>
                {c.description && <span className="mt-0.5 block text-xs text-walnut-500">{c.description}</span>}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* ---- How much ---- */}
      <fieldset>
        <legend className="label">Amount</legend>
        <div className="flex flex-wrap gap-2">
          {category.suggestedAmounts.map((cents) => (
            <button
              key={cents}
              type="button"
              onClick={() => setAmount((cents / 100).toString())}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold tabular-nums transition-colors ${
                amountCents === cents
                  ? 'border-gold-500 bg-gold-500 text-walnut-900'
                  : 'border-gold-300 text-walnut-700 hover:bg-gold-50'
              }`}
            >
              {formatMoney(cents)}
            </button>
          ))}
        </div>

        {category.allowCustomAmount && (
          <div className="relative mt-3 max-w-[12rem]">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-walnut-400">$</span>
            <input
              name="amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Other amount"
              className="input pl-7 tabular-nums"
              aria-label="Amount in dollars"
            />
          </div>
        )}
        {!category.allowCustomAmount && <input type="hidden" name="amount" value={amount} />}
      </fieldset>

      {/* ---- Who it's from ---- */}
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="label">Your details</legend>
        <div>
          <label className="label" htmlFor="donorName">Name</label>
          <input id="donorName" name="donorName" required defaultValue={donor?.name ?? ''} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="donorEmail">Email <span className="normal-case text-walnut-400">(for your receipt)</span></label>
          <input id="donorEmail" name="donorEmail" type="email" defaultValue={donor?.email ?? ''} className="input" />
        </div>
      </fieldset>

      {/* ---- Dedication ---- */}
      <div>
        <label className="label" htmlFor="occasion">
          In honour / in memory of <span className="normal-case text-walnut-400">(optional)</span>
        </label>
        <input
          id="occasion"
          name="occasion"
          maxLength={200}
          className="input"
          placeholder="לזכר נשמת… · In honour of the bar mitzvah · Refuah sheleima for…"
        />
        <p className="mt-1.5 text-xs text-walnut-400">
          This may be read out or shown on the shul board unless you ask us not to.
        </p>
      </div>

      <label className="flex items-center gap-2.5 text-sm text-walnut-600">
        <input type="checkbox" name="anonymous" className="accent-gold-600" />
        Keep my name off the board — record this gift as anonymous
      </label>

      {/* ---- How to pay ---- */}
      <fieldset className="rounded-lg border border-gold-200 bg-gold-50/40 p-4">
        <legend className="label px-1">How would you like to pay?</legend>
        <div className="space-y-2">
          {stripeEnabled && (
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="radio" name="payNow" value="card"
                checked={payNow === 'card'} onChange={() => setPayNow('card')}
                className="mt-0.5 accent-gold-600"
              />
              <span>
                <span className="font-semibold text-walnut-800">Pay now by card</span>
                <span className="block text-xs text-walnut-500">
                  Secure checkout — the shul never sees your card details.
                </span>
              </span>
            </label>
          )}
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="radio" name="payNow" value="pledge"
              checked={payNow === 'pledge'} onChange={() => setPayNow('pledge')}
              className="mt-0.5 accent-gold-600"
            />
            <span>
              <span className="font-semibold text-walnut-800">Pledge now, pay later</span>
              <span className="block text-xs text-walnut-500">
                We will record your pledge and you can settle by cash, cheque or Zelle.
              </span>
            </span>
          </label>
        </div>
      </fieldset>

      <button type="submit" disabled={amountCents < 100} className="btn-gold w-full py-3 text-base">
        {payNow === 'card' && stripeEnabled
          ? `Donate ${amountCents ? formatMoney(amountCents) : ''} by card`
          : `Pledge ${amountCents ? formatMoney(amountCents) : ''}`}
      </button>

      {amountCents > 0 && amountCents < 100 && (
        <p className="text-center text-xs text-rose-600">Please enter at least $1.</p>
      )}
    </form>
  );
}
