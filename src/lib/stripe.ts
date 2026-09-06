import 'server-only';
import Stripe from 'stripe';

/**
 * Stripe is optional. With no secret key the site still takes pledges and the
 * treasurer records cash, cheques and Zelle by hand — the card buttons simply
 * don't appear.
 */
export function isStripeEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Card payments are not configured. Set STRIPE_SECRET_KEY to enable them.');
  }
  // No apiVersion pin: the installed SDK's own default is the version its
  // types were generated against, which keeps this compiling across upgrades.
  cached ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return cached;
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
}
