# קהל תפארת אליעזר · Kehal Tiferes Eliezer

The shul's website: zmanim, davening and shiur times, announcements, a members'
area, a full giving ledger, and a display board for the monitor in shul.

> ע"ש הרה"ג ר' אליעזר געלדצעהלער זצ"ל · בנשיאות הרה"ג ר' יוסף האלפערט שליט"א
> 1146 N Maple Ave, Toms River, NJ 08755

---

## What it does

**Zmanim** — calculated for the shul's own coordinates, not a nearby city.
Alos through tzais, both the Gr"a and Mag"a positions, shaos zmanios, candle
lighting, Hebrew date, parsha, yom tov, sefiras ha'omer and Daf Yomi. Any date,
past or future.

**Davening & shiurim** — a time can be fixed on the clock (*Shacharis 7:15*) or
pegged to a zman so it moves with the year on its own
(*Mincha 20 minutes before shkia, rounded down to the nearest 5*). Weekday,
Monday/Thursday, Sunday, Erev Shabbos, Shabbos, Yom Tov, Rosh Chodesh and fast
days each get their own schedule, and a Yom Tov that lands on Shabbos matches
both.

**Giving** — one ledger for every dollar, whatever form it arrives in:

| | |
|---|---|
| Funds | General, Kiddush, Shalosh Seudos, Seats, Aliyos, Building, Kollel — edit freely, with optional campaign goals and progress bars |
| Pledges | What was promised, what has been paid against it, what is still outstanding |
| Payments | Card via Stripe, plus cash, cheque, Zelle and QuickPay entered by the office |
| Kiddush & Shalosh Seudos | A Shabbos-by-Shabbos calendar members can claim from, labelled with each week's parsha |
| Seats | A seating chart by section and row, with holders, prices and year-to-year rollover |
| Aliyos | The gabbai's book — who was called up and what they undertook |

Every sponsorship, seat and aliyah with money attached books a pledge in the
same ledger, so nothing is tracked in two places.

**Members** — sign up, see announcements meant for members, review your own
giving history and outstanding pledges, your seats, your aliyos, and keep your
own yahrzeits (stored by Hebrew date, so leap years and short Cheshvans work out
correctly every year).

**The display board** at `/display` — a full-screen board for a monitor in shul.
Live clock, the next minyan with a countdown, the day's zmanim, and rotating
panels for davening, shiurim, announcements, sponsors and yahrzeits. It refreshes
its own data every minute and rolls over at midnight without a reload. No login
needed — open it on a smart TV, a Raspberry Pi or an old laptop and leave it.

---

## Getting it running

```bash
npm install
cp .env.example .env.local     # then edit it — see below
npm run setup                  # creates the database and fills it with sample content
npm run dev                    # http://localhost:3000
```

`npm run setup` seeds an administrator:

```
admin@tifereseliezer.org  /  changeme123
```

**Change that password immediately** from *My account → Change password*, and
delete the two other sample accounts from *Admin → Members*.

For production:

```bash
npm run build
npm start
```

### Environment

Everything in `.env.local` is optional except `SESSION_SECRET`.

| Variable | What it does |
|---|---|
| `SESSION_SECRET` | Any long random string. `openssl rand -base64 32` |
| `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` | Leave unset for a local SQLite file at `data/shul.db`. Set both to host on Turso, which is what serverless hosting needs |
| `STRIPE_SECRET_KEY` | Turns on card payments. Leave blank and the site still takes pledges while the office records cash and cheques |
| `STRIPE_WEBHOOK_SECRET` | Required with Stripe — this is how a payment actually reaches the ledger |
| `NEXT_PUBLIC_SITE_URL` | Your public URL, so Stripe knows where to send donors back |

### Turning on card payments

1. Create a Stripe account and put the secret key in `STRIPE_SECRET_KEY`.
2. Add a webhook endpoint in the Stripe dashboard pointing at
   `https://your-site/api/stripe/webhook`, subscribed to
   `checkout.session.completed` and `charge.refunded`.
3. Put that endpoint's signing secret in `STRIPE_WEBHOOK_SECRET`.

A card gift is written to the ledger **only** when Stripe's webhook confirms it.
The donor's redirect back to the thank-you page is a courtesy screen and is never
treated as proof of payment.

---

## Setting up your shul

Log in as the administrator and work through **Admin**:

1. **Settings** — the shul's name, address, coordinates, timezone, candle-lighting
   minutes, which alos and tzais opinions to follow, and house rates for kiddush,
   seats and aliyos. The page shows you today's zmanim recalculated with whatever
   you have chosen.
2. **Davening & Shiurim** — enter the minyanim and shiurim. A panel at the top
   shows what your rules resolve to today, so you can see a time landing correctly
   before you rely on it.
3. **Funds** — the list donors pick from.
4. **Kiddush & Seudos** — *Open up the coming weeks* creates the next few months
   of Shabbos slots in one go, each labelled with its parsha.
5. **Seats** — *Lay out seats* builds the chart by section and row.
6. **Members** — approve signups and appoint gabbaim.

### The crest

Save the shul's artwork as `public/logo.png` and it appears in the header, on the
homepage and on the board. Until then the site falls back to a typographic
wordmark, so nothing looks broken.

### Roles

| Role | Can do |
|---|---|
| **Member** | See members-only announcements, their own giving, seats and yahrzeits |
| **Gabbai** | All of the shul modules — donations, sponsorships, seats, aliyos, schedule, announcements |
| **Admin** | Everything, plus members and settings |

The first person to sign up on a fresh install becomes the administrator.

---

## Notes on how it is built

Next.js (App Router) with server actions, Drizzle over SQLite through libSQL, and
Tailwind. Zmanim come from [`kosher-zmanim`](https://github.com/BehindTheMath/KosherZmanim),
the JavaScript port of KosherJava; the Hebrew calendar from
[`@hebcal/core`](https://github.com/hebcal/hebcal-es6).

A few decisions worth knowing about:

- **Money is stored as integer cents.** It only becomes a decimal on screen.
- **Forms are plain HTML posting to server actions**, so the office pages work
  even if JavaScript fails to load.
- **Sessions are stored hashed**, so a leaked database row can't be replayed as a
  live cookie. Disabling a member cuts their sessions immediately.
- **Pledge status is derived, never set by hand** — it is recalculated from the
  payments recorded against it, so the ledger can't drift.
- **Yahrzeits are stored by Hebrew date**, and the civil date is computed per
  year rather than stored.

### Layout

```
src/
  app/
    (site)/       the public website and the admin console
    (board)/      the shul monitor, deliberately without site chrome
    api/          Stripe webhook, display board polling endpoint
  lib/
    zmanim.ts     zmanim, Hebrew calendar, the fixed/relative time resolver
    schedule.ts   resolving minyanim and shiurim for a given day
    ledger.ts     pledge/payment totals and reconciliation
    displayData.ts  everything the board needs, in one JSON shape
  actions/        server actions, grouped by module
  db/schema.ts    the whole database
scripts/
  migrate.ts      applies drizzle/*.sql
  seed.ts         the shul's details plus sample content
```

### Changing the database

```bash
# edit src/db/schema.ts, then
npm run db:generate
npm run db:migrate
```

---

## A word on the zmanim

The calculations follow the standard astronomical method and the shul's own
coordinates, and where opinions differ the chosen view is named beneath each
time. **For anything with practical halachic consequence, ask the Rav.**
