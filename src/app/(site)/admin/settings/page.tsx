import { getSettings } from '@/lib/settings';
import {
  computeZmanim, todayISO, fmtTime,
  ALOS_OPINION_LABELS, TZAIS_OPINION_LABELS, BOARD_ZMAN_OPTIONS,
} from '@/lib/zmanim';
import { isStripeEnabled } from '@/lib/stripe';
import { LEARNING_CYCLES } from '@/lib/learning';
import { ARTWORK, artworkPresence } from '@/lib/artwork';
import { saveSettingsAction } from '@/actions/admin';
import { PageHeader, Card, Flash, Badge } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const [sp, s] = await Promise.all([searchParams, getSettings()]);
  const enabledCycles = parseCycles(s.displayLearningCycles);
  const artwork = artworkPresence();
  const chosenZmanim = parseCycles(s.displayZmanim);
  const tz = s.timezone;
  const today = todayISO(tz);
  const preview = computeZmanim(today, s);

  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        title="Settings"
        subtitle="The shul's identity, its coordinates for zmanim, house rates and how the monitor behaves."
      />

      <Flash ok={sp.ok} error={sp.error} />

      <form action={saveSettingsAction} className="space-y-6">
        <Card title="Identity">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="nameEn">Name (English)</label>
              <input id="nameEn" name="nameEn" defaultValue={s.nameEn} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="nameHe">Name (Hebrew)</label>
              <input id="nameHe" name="nameHe" dir="rtl" defaultValue={s.nameHe} className="input font-hebrew" />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="dedicationHe">Dedication line</label>
              <input id="dedicationHe" name="dedicationHe" dir="rtl" defaultValue={s.dedicationHe} className="input font-hebrew" />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="nasiHe">Nasi line</label>
              <input id="nasiHe" name="nasiHe" dir="rtl" defaultValue={s.nasiHe} className="input font-hebrew" />
            </div>
          </div>
          <div className="mt-5 border-t border-gold-200 pt-5">
            <p className="eyebrow mb-2">Crest artwork</p>
            <p className="mb-3 text-xs text-walnut-500">
              Add these to the <code className="font-mono">public/</code> folder as PNGs with
              transparent backgrounds. Anything missing falls back to the next best file, so the
              site keeps working while you add them.
            </p>
            <table className="table-shul">
              <tbody>
                {ARTWORK.map((a) => {
                  const present = artwork?.[a.file];
                  return (
                    <tr key={a.file}>
                      <td className="font-mono text-xs text-walnut-700">{a.file}</td>
                      <td className="text-walnut-700">{a.label}</td>
                      <td className="text-xs text-walnut-400">{a.usedFor}</td>
                      <td className="text-right">
                        {artwork === null ? (
                          <span className="text-xs text-walnut-400">—</span>
                        ) : present ? (
                          <Badge value="active" label="in place" />
                        ) : (
                          <Badge value="pending" label="not added yet" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Address &amp; contact">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="addressLine">Street</label>
              <input id="addressLine" name="addressLine" defaultValue={s.addressLine} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="city">City</label>
              <input id="city" name="city" defaultValue={s.city} className="input" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="state">State</label>
                <input id="state" name="state" defaultValue={s.state} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="zip">ZIP</label>
                <input id="zip" name="zip" defaultValue={s.zip} className="input" />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="phone">Phone</label>
              <input id="phone" name="phone" type="tel" defaultValue={s.phone ?? ''} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="email">Office email</label>
              <input id="email" name="email" type="email" defaultValue={s.email ?? ''} className="input" />
            </div>
          </div>
        </Card>

        <Card title="Zmanim">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="latitude">Latitude</label>
              <input id="latitude" name="latitude" type="number" step="0.0001" defaultValue={s.latitude} className="input tabular-nums" />
            </div>
            <div>
              <label className="label" htmlFor="longitude">Longitude</label>
              <input id="longitude" name="longitude" type="number" step="0.0001" defaultValue={s.longitude} className="input tabular-nums" />
            </div>
            <div>
              <label className="label" htmlFor="elevation">Elevation (m)</label>
              <input id="elevation" name="elevation" type="number" step="1" defaultValue={s.elevation} className="input tabular-nums" />
            </div>
            <div className="sm:col-span-3">
              <label className="label" htmlFor="timezone">Timezone</label>
              <input id="timezone" name="timezone" defaultValue={s.timezone} className="input" placeholder="America/New_York" />
            </div>
            <div>
              <label className="label" htmlFor="candleLightingMinutes">Candle lighting (min before shkia)</label>
              <input id="candleLightingMinutes" name="candleLightingMinutes" type="number" defaultValue={s.candleLightingMinutes} className="input tabular-nums" />
            </div>
            <div>
              <label className="label" htmlFor="havdalahMinutes">Havdalah (min after shkia)</label>
              <input id="havdalahMinutes" name="havdalahMinutes" type="number" defaultValue={s.havdalahMinutes} className="input tabular-nums" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 pb-2.5 text-sm text-walnut-600">
                <input type="checkbox" name="inIsrael" defaultChecked={s.inIsrael} className="accent-gold-600" /> In Eretz Yisroel
              </label>
            </div>
            <div>
              <label className="label" htmlFor="alosOpinion">Alos follows</label>
              <select id="alosOpinion" name="alosOpinion" defaultValue={s.alosOpinion} className="select">
                {Object.entries(ALOS_OPINION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="tzaisOpinion">Tzais follows</label>
              <select id="tzaisOpinion" name="tzaisOpinion" defaultValue={s.tzaisOpinion} className="select">
                {Object.entries(TZAIS_OPINION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-gold-200 bg-gold-50/60 px-4 py-3">
            <p className="eyebrow mb-2">With the current settings, today works out as</p>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm tabular-nums text-walnut-700">
              <span>Alos <strong>{fmtTime(preview.byId.alos, tz)}</strong></span>
              <span>Neitz <strong>{fmtTime(preview.byId.sunrise, tz)}</strong></span>
              <span>Chatzos <strong>{fmtTime(preview.byId.chatzos, tz)}</strong></span>
              <span>Shkia <strong>{fmtTime(preview.byId.sunset, tz)}</strong></span>
              <span>Tzais <strong>{fmtTime(preview.byId.tzais, tz)}</strong></span>
            </div>
            <p className="mt-2 text-xs text-walnut-400">Save the form to see these update.</p>
          </div>
        </Card>

        <Card title="Giving details">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="taxId">501(c)(3) EIN</label>
              <input id="taxId" name="taxId" defaultValue={s.taxId ?? ''} className="input" placeholder="85-3969999" />
            </div>
            <div>
              <label className="label" htmlFor="zelleTo">Zelle to</label>
              <input id="zelleTo" name="zelleTo" defaultValue={s.zelleTo ?? ''} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="quickPayTo">QuickPay to</label>
              <input id="quickPayTo" name="quickPayTo" defaultValue={s.quickPayTo ?? ''} className="input" />
            </div>
          </div>
          <p className="mt-3 text-xs text-walnut-400">
            These appear on the donation page so donors can give the way they prefer, and so the
            deduction is stated where they can see it.
          </p>
        </Card>

        <Card title="House rates">
          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label className="label" htmlFor="defaultKiddushCents">Kiddush</label>
              <input id="defaultKiddushCents" name="defaultKiddushCents" inputMode="decimal" defaultValue={s.defaultKiddushCents / 100} className="input tabular-nums" />
            </div>
            <div>
              <label className="label" htmlFor="defaultShaloshSeudosCents">Shalosh Seudos</label>
              <input id="defaultShaloshSeudosCents" name="defaultShaloshSeudosCents" inputMode="decimal" defaultValue={s.defaultShaloshSeudosCents / 100} className="input tabular-nums" />
            </div>
            <div>
              <label className="label" htmlFor="defaultSeatCents">Seat (per year)</label>
              <input id="defaultSeatCents" name="defaultSeatCents" inputMode="decimal" defaultValue={s.defaultSeatCents / 100} className="input tabular-nums" />
            </div>
            <div>
              <label className="label" htmlFor="defaultAliyahCents">Aliyah</label>
              <input id="defaultAliyahCents" name="defaultAliyahCents" inputMode="decimal" defaultValue={s.defaultAliyahCents / 100} className="input tabular-nums" />
            </div>
          </div>
          <p className="mt-4 rounded-lg bg-gold-50 px-3 py-2.5 text-xs text-walnut-500">
            Card payments are{' '}
            <strong className={isStripeEnabled() ? 'text-emerald-700' : 'text-amber-700'}>
              {isStripeEnabled() ? 'switched on' : 'switched off'}
            </strong>
            {isStripeEnabled()
              ? '. Donors can pay by card and the ledger updates when Stripe confirms the payment.'
              : '. Add STRIPE_SECRET_KEY to the environment to accept cards; until then the site takes pledges and the office records cash, cheques and Zelle.'}
          </p>
        </Card>

        <Card title="Shul monitor">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="displayRotateSeconds">Seconds per panel</label>
              <input id="displayRotateSeconds" name="displayRotateSeconds" type="number" min={5} max={120} defaultValue={s.displayRotateSeconds} className="input tabular-nums" />
            </div>
            <div className="sm:col-span-2 rounded-lg bg-gold-50 px-3 py-2.5 text-xs text-walnut-500">
              Open the board at <code className="font-mono">/display</code>. To check how a Shabbos or
              Yom Tov will look before it arrives, add a date —{' '}
              <a href="/display?date=2026-12-12" target="_blank" className="font-semibold text-gold-700 hover:underline">
                /display?date=2026-12-12
              </a>{' '}
              — which previews that day without affecting the monitor in shul.
            </div>
            <div>
              <label className="label" htmlFor="displayMessage">Standing message on the board</label>
              <input id="displayMessage" name="displayMessage" defaultValue={s.displayMessage ?? ''} className="input" placeholder="Please switch off phones in the beis medrash" />
            </div>
            <div>
              <label className="label" htmlFor="displayLanguage">Board language</label>
              <select id="displayLanguage" name="displayLanguage" defaultValue={s.displayLanguage} className="select">
                <option value="hebrew">עברית — Hebrew, right to left</option>
                <option value="english">English, left to right</option>
              </select>
            </div>
            <div className="sm:col-span-2 flex flex-wrap gap-5">
              <label className="flex items-center gap-2 text-sm text-walnut-600">
                <input type="checkbox" name="displayShowYahrzeits" defaultChecked={s.displayShowYahrzeits} className="accent-gold-600" /> Show yahrzeits
              </label>
              <label className="flex items-center gap-2 text-sm text-walnut-600">
                <input type="checkbox" name="displayShowSponsors" defaultChecked={s.displayShowSponsors} className="accent-gold-600" /> Show sponsors
              </label>
              <label className="flex items-center gap-2 text-sm text-walnut-600">
                <input type="checkbox" name="displayShowDaf" defaultChecked={s.displayShowDaf} className="accent-gold-600" /> Show Daf Yomi in the header
              </label>
              <label className="flex items-center gap-2 text-sm text-walnut-600">
                <input type="checkbox" name="displayShowTefillah" defaultChecked={s.displayShowTefillah} className="accent-gold-600" /> Show the tefillah band
              </label>
            </div>
          </div>

          <div className="mt-5 border-t border-gold-200 pt-5">
            <p className="eyebrow mb-2">זמני היום — which zmanim the board carries</p>
            <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
              {BOARD_ZMAN_OPTIONS.map((z) => (
                <label key={z.id} className="flex items-center gap-2 text-sm text-walnut-600">
                  <input
                    type="checkbox"
                    name="displayZmanim"
                    value={z.id}
                    defaultChecked={chosenZmanim.includes(z.id)}
                    className="accent-gold-600"
                  />
                  <span className="he font-hebrew text-base text-walnut-800">{z.labelHe}</span>
                  <span className="text-xs text-walnut-400">{z.labelEn}</span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-walnut-400">
              They appear on the board in the order listed here. The full zmanim page always shows
              everything regardless of this choice.
            </p>
          </div>

          <div className="mt-5 border-t border-gold-200 pt-5">
            <p className="eyebrow mb-2">לימוד יומי — which cycles the board carries</p>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {LEARNING_CYCLES.map((c) => (
                <label key={c.key} className="flex items-center gap-2 text-sm text-walnut-600">
                  <input
                    type="checkbox"
                    name="displayLearningCycles"
                    value={c.key}
                    defaultChecked={enabledCycles.includes(c.key)}
                    className="accent-gold-600"
                  />
                  <span className="he font-hebrew text-base text-walnut-800">{c.labelHe}</span>
                  <span className="text-xs text-walnut-400">{c.labelEn}</span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-walnut-400">
              Chumash follows the coming Shabbos&apos;s parsha, one aliyah a day, and pauses on a week
              whose Shabbos is Yom Tov.
            </p>
          </div>

          <div className="mt-5 flex flex-wrap items-end gap-6 border-t border-gold-200 pt-5">
            <label className="flex items-start gap-2 text-sm text-walnut-600">
              <input type="checkbox" name="saysMoridHatal" defaultChecked={s.saysMoridHatal} className="mt-0.5 accent-gold-600" />
              <span>
                <span className="he font-hebrew text-base text-walnut-800">מוריד הטל</span>
                <span className="block text-xs text-walnut-400">
                  Say it through the summer. Nusach Sefard and Eretz Yisrael do; Ashkenaz says nothing there.
                </span>
              </span>
            </label>
            <div>
              <label className="label" htmlFor="kiddushLevanaFromDays">קידוש לבנה — earliest</label>
              <select id="kiddushLevanaFromDays" name="kiddushLevanaFromDays" defaultValue={s.kiddushLevanaFromDays} className="select">
                <option value={7}>7 days after the molad (Rema)</option>
                <option value={3}>3 days after the molad</option>
              </select>
            </div>
          </div>
        </Card>

        <Card title="Accounts">
          <label className="flex items-start gap-2.5 text-sm text-walnut-600">
            <input type="checkbox" name="requireApproval" defaultChecked={s.requireApproval} className="mt-0.5 accent-gold-600" />
            <span>
              <strong className="text-walnut-800">New signups need approval</strong>
              <span className="block text-xs text-walnut-400">
                Leave this on so only people the office recognises can see members-only notices.
              </span>
            </span>
          </label>
        </Card>

        <div className="sticky bottom-4 flex justify-end no-print">
          <button type="submit" className="btn-primary shadow-lift">Save all settings</button>
        </div>
      </form>
    </>
  );
}

/** The saved learning cycles, tolerant of a hand-edited value. */
function parseCycles(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch { /* fall through to none selected */ }
  return [];
}
