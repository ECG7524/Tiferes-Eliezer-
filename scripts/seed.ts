import { DateTime } from 'luxon';
import { eq } from 'drizzle-orm';
import { HDate, months } from '@hebcal/core';
import bcrypt from 'bcryptjs';
import { db } from '../src/db';
import {
  settings, users, donationCategories, pledges, payments,
  sponsorships, seats, aliyos, minyanim, shiurim, announcements, events, yahrzeits,
} from '../src/db/schema';
import { computeZmanim, addDaysISO, todayISO } from '../src/lib/zmanim';

/**
 * Fills a fresh database with the shul's real details plus enough sample
 * content that every page has something to show on the first run.
 * Safe to re-run: it only inserts where a table is still empty.
 */

const TZ = 'America/New_York';

async function main() {
  console.log('Seeding Kehal Tiferes Eliezer…\n');

  /* ---------------- Settings ---------------- */
  await db.insert(settings).values({ id: 1 }).onConflictDoNothing();
  await db.update(settings).set({
    nameHe: 'קהל תפארת אליעזר',
    nameEn: 'Kehal Tiferes Eliezer',
    dedicationHe: 'ע"ש הרה"ג ר\' אליעזר געלדצעהלער זצ"ל',
    nasiHe: 'בנשיאות הרה"ג ר\' יוסף האלפערט שליט"א',
    addressLine: '1146 N Maple Ave',
    city: 'Toms River',
    state: 'NJ',
    zip: '08755',
    latitude: 40.0334,
    longitude: -74.2129,
    elevation: 12,
    timezone: TZ,
    displayMessage: 'Please switch phones to silent in the beis medrash',
  });
  console.log('  settings   ✓');

  const s = (await db.select().from(settings))[0];
  const today = todayISO(TZ);

  /* ---------------- People ---------------- */
  if ((await db.select().from(users).limit(1)).length === 0) {
    const hash = await bcrypt.hash('changeme123', 12);
    await db.insert(users).values([
      {
        email: 'admin@tifereseliezer.org', passwordHash: hash,
        firstName: 'Shul', lastName: 'Office', hebrewName: '',
        role: 'admin', status: 'active',
        notes: 'Seeded administrator — change this password immediately.',
      },
      {
        email: 'gabbai@tifereseliezer.org', passwordHash: hash,
        firstName: 'Yosef', lastName: 'Gabbai', hebrewName: 'יוסף',
        role: 'gabbai', status: 'active',
      },
      {
        email: 'member@tifereseliezer.org', passwordHash: hash,
        firstName: 'Dovid', lastName: 'Friedman', hebrewName: 'דוד בן אברהם',
        phone: '(732) 555-0142', role: 'member', status: 'active',
      },
    ]);
    console.log('  users      ✓  (password for all three: changeme123)');
  }

  const [admin, gabbai, member] = await db.select().from(users);

  /* ---------------- Funds ---------------- */
  if ((await db.select().from(donationCategories).limit(1)).length === 0) {
    await db.insert(donationCategories).values([
      { slug: 'general', name: 'General Fund', nameHe: 'קרן כללית', kind: 'general', sortOrder: 1,
        description: 'Everyday running of the shul', suggestedAmounts: '[1800,3600,5400,10000]' },
      { slug: 'kiddush', name: 'Kiddush Fund', nameHe: 'קרן קידוש', kind: 'kiddush', sortOrder: 2,
        description: 'Sponsor or contribute towards the Shabbos kiddush', suggestedAmounts: '[3600,10000,18000,36000]' },
      { slug: 'shalosh-seudos', name: 'Shalosh Seudos', nameHe: 'שלוש סעודות', kind: 'shalosh_seudos', sortOrder: 3,
        description: 'The seudah between Mincha and Maariv', suggestedAmounts: '[1800,3600,10000,18000]' },
      { slug: 'seats', name: 'Seats', nameHe: 'מקומות', kind: 'seats', sortOrder: 4,
        description: 'Annual seat for the Yamim Noraim and the year round', suggestedAmounts: '[25000,50000,75000]' },
      { slug: 'aliyos', name: 'Aliyos & Kibbudim', nameHe: 'עליות', kind: 'aliyos', sortOrder: 5,
        description: 'Undertakings made at the bima', suggestedAmounts: '[1800,3600,5400,10000]' },
      { slug: 'building', name: 'Building Fund', nameHe: 'קרן בנין', kind: 'building', sortOrder: 6,
        description: 'Towards the expansion of the beis medrash',
        suggestedAmounts: '[18000,36000,100000,180000]', goalCents: 25_000_00 },
      { slug: 'kollel', name: 'Kollel & Shiurim', nameHe: 'קרן תורה', kind: 'other', sortOrder: 7,
        description: 'Supporting the limud haTorah in the shul', suggestedAmounts: '[1800,3600,10000]' },
    ]);
    console.log('  funds      ✓');
  }

  const cats = await db.select().from(donationCategories);
  const fund = (slug: string) => cats.find((c) => c.slug === slug)!.id;

  /* ---------------- Davening ---------------- */
  if ((await db.select().from(minyanim).limit(1)).length === 0) {
    await db.insert(minyanim).values([
      // Weekday
      { name: 'Shacharis — Neitz', nameHe: 'שחרית כותיקין', dayType: 'weekday', timeType: 'relative',
        relativeTo: 'sunrise', offsetMinutes: -10, location: 'Main Shul', sortOrder: 1 },
      { name: 'Shacharis', nameHe: 'שחרית', dayType: 'weekday', timeType: 'fixed', fixedTime: '07:15',
        location: 'Main Shul', sortOrder: 2 },
      { name: 'Shacharis — Late', nameHe: 'שחרית', dayType: 'weekday', timeType: 'fixed', fixedTime: '08:30',
        location: 'Beis Medrash', sortOrder: 3 },
      { name: 'Mincha', nameHe: 'מנחה', dayType: 'weekday', timeType: 'relative', relativeTo: 'sunset',
        offsetMinutes: -20, roundTo: 5, roundDirection: 'earlier', location: 'Main Shul', sortOrder: 4 },
      { name: 'Maariv', nameHe: 'מעריב', dayType: 'weekday', timeType: 'relative', relativeTo: 'tzais',
        offsetMinutes: 5, roundTo: 5, roundDirection: 'later', location: 'Main Shul', sortOrder: 5 },
      // Monday & Thursday get an extra early minyan for krias haTorah
      { name: 'Shacharis — Early', nameHe: 'שחרית', dayType: 'monday_thursday', timeType: 'fixed',
        fixedTime: '06:20', location: 'Beis Medrash', notes: 'Krias haTorah', sortOrder: 0 },
      // Sunday
      { name: 'Shacharis', nameHe: 'שחרית', dayType: 'sunday', timeType: 'fixed', fixedTime: '07:30',
        location: 'Main Shul', sortOrder: 1 },
      { name: 'Shacharis — Late', nameHe: 'שחרית', dayType: 'sunday', timeType: 'fixed', fixedTime: '08:45',
        location: 'Beis Medrash', sortOrder: 2 },
      { name: 'Mincha', nameHe: 'מנחה', dayType: 'sunday', timeType: 'relative', relativeTo: 'sunset',
        offsetMinutes: -20, roundTo: 5, roundDirection: 'earlier', location: 'Main Shul', sortOrder: 3 },
      // Erev Shabbos
      { name: 'Mincha Erev Shabbos', nameHe: 'מנחה ערב שבת', dayType: 'erev_shabbos', timeType: 'relative',
        relativeTo: 'candle_lighting', offsetMinutes: 5, location: 'Main Shul', sortOrder: 6 },
      // Shabbos
      { name: 'Shacharis — Neitz', nameHe: 'שחרית כותיקין', dayType: 'shabbos', timeType: 'relative',
        relativeTo: 'sunrise', offsetMinutes: -15, location: 'Beis Medrash', sortOrder: 1 },
      { name: 'Shacharis', nameHe: 'שחרית', dayType: 'shabbos', timeType: 'fixed', fixedTime: '08:45',
        location: 'Main Shul', sortOrder: 2 },
      { name: 'Mincha', nameHe: 'מנחה', dayType: 'shabbos', timeType: 'relative', relativeTo: 'sunset',
        offsetMinutes: -75, roundTo: 5, roundDirection: 'earlier', location: 'Main Shul', sortOrder: 3 },
      { name: 'Maariv / Motzei Shabbos', nameHe: 'מעריב', dayType: 'shabbos', timeType: 'relative',
        relativeTo: 'tzais', offsetMinutes: 10, location: 'Main Shul', sortOrder: 4 },
    ]);
    console.log('  minyanim   ✓');
  }

  /* ---------------- Shiurim ---------------- */
  if ((await db.select().from(shiurim).limit(1)).length === 0) {
    await db.insert(shiurim).values([
      { title: 'Daf Yomi', titleHe: 'דף היומי', maggidShiur: 'R\' Yosef Halpert', recurrence: 'daily',
        timeType: 'fixed', startTime: '06:00', durationMinutes: 45, location: 'Beis Medrash', sortOrder: 1 },
      { title: 'Daf Yomi — Evening', titleHe: 'דף היומי', maggidShiur: 'R\' Moshe Klein', recurrence: 'daily',
        timeType: 'relative', relativeTo: 'tzais', offsetMinutes: 30, durationMinutes: 45,
        location: 'Beis Medrash', sortOrder: 2 },
      { title: 'Halacha Shiur', titleHe: 'שיעור הלכה', maggidShiur: 'The Rav', recurrence: 'weekly',
        dayOfWeek: 2, timeType: 'fixed', startTime: '20:30', durationMinutes: 45, location: 'Main Shul',
        description: 'Hilchos Shabbos, working through the Mishnah Berurah.', sortOrder: 3 },
      { title: 'Chumash & Rashi', titleHe: 'חומש ורש"י', maggidShiur: 'R\' Dovid Friedman', recurrence: 'weekly',
        dayOfWeek: 4, timeType: 'fixed', startTime: '21:00', durationMinutes: 40, location: 'Beis Medrash',
        description: 'The parsha of the week with the classic meforshim.', sortOrder: 4 },
      { title: 'Pirkei Avos', titleHe: 'פרקי אבות', maggidShiur: 'The Rav', recurrence: 'weekly',
        dayOfWeek: 6, timeType: 'relative', relativeTo: 'sunset', offsetMinutes: -105, durationMinutes: 30,
        location: 'Main Shul', description: 'Between Mincha and Shalosh Seudos.', sortOrder: 5 },
      { title: 'Mishnayos B\'Iyun', titleHe: 'משניות בעיון', maggidShiur: 'R\' Yosef Gabbai', recurrence: 'weekly',
        dayOfWeek: 0, timeType: 'fixed', startTime: '20:00', durationMinutes: 60, location: 'Beis Medrash', sortOrder: 6 },
    ]);
    console.log('  shiurim    ✓');
  }

  /* ---------------- Sponsorship calendar ---------------- */
  if ((await db.select().from(sponsorships).limit(1)).length === 0) {
    // Walk forward to the coming Shabbos, then open 12 weeks of slots.
    let iso = today;
    for (let i = 0; i < 7; i++) {
      if (computeZmanim(iso, s).info.isShabbos) break;
      iso = addDaysISO(iso, 1, TZ);
    }

    const rows = [];
    for (let w = 0; w < 12; w++) {
      const { info } = computeZmanim(iso, s);
      const label = info.parsha ? `Parashas ${info.parsha}` : info.holidays[0]?.en ?? '';

      // Make the first couple of weeks look lived-in.
      rows.push({
        kind: 'kiddush' as const, date: iso, label,
        amountCents: s.defaultKiddushCents,
        ...(w === 0
          ? { status: 'confirmed' as const, sponsorName: 'The Friedman family', sponsorUserId: member?.id ?? null,
              occasion: 'In honour of the bar mitzvah of their son Avrohom' }
          : w === 2
            ? { status: 'confirmed' as const, sponsorName: 'The Klein family',
                occasion: 'לזכר נשמת ר\' שמואל בן ר\' יעקב ז"ל' }
            : { status: 'open' as const }),
      });
      rows.push({
        kind: 'shalosh_seudos' as const, date: iso, label,
        amountCents: s.defaultShaloshSeudosCents,
        ...(w === 1
          ? { status: 'confirmed' as const, sponsorName: 'The Weiss family', occasion: 'In appreciation to the shul' }
          : { status: 'open' as const }),
      });

      iso = addDaysISO(iso, 7, TZ);
    }
    await db.insert(sponsorships).values(rows);
    console.log('  kiddush    ✓  (12 weeks opened)');
  }

  /* ---------------- Seats ---------------- */
  if ((await db.select().from(seats).limit(1)).length === 0) {
    const rows = [];
    for (const [section, rowLetters, perRow, price] of [
      ['Main Shul', ['A', 'B', 'C', 'D', 'E'], 12, 50000],
      ['Beis Medrash', ['A', 'B', 'C'], 10, 36000],
      ['Ezras Nashim', ['A', 'B'], 12, 25000],
    ] as const) {
      for (const row of rowLetters) {
        for (let n = 1; n <= perRow; n++) {
          rows.push({ section, row, number: n, year: 5786, priceCents: price, status: 'available' as const });
        }
      }
    }
    await db.insert(seats).values(rows);

    // Put a few names in so the chart doesn't look untouched.
    const placed = await db.select().from(seats).limit(4);
    for (const [i, seat] of placed.entries()) {
      await db.update(seats).set({
        status: 'assigned',
        holderName: ['R\' Dovid Friedman', 'R\' Moshe Klein', 'R\' Shmuel Weiss', 'R\' Yaakov Stern'][i],
        holderUserId: i === 0 ? member?.id ?? null : null,
      }).where(eq(seats.id, seat.id));
    }
    console.log('  seats      ✓  (5786 chart laid out)');
  }

  /* ---------------- Giving ---------------- */
  if ((await db.select().from(pledges).limit(1)).length === 0) {
    const samples = [
      { name: 'R\' Dovid Friedman', userId: member?.id ?? null, cents: 36000, cat: fund('kiddush'), occasion: 'Bar mitzvah kiddush', paid: 36000, method: 'card' as const },
      { name: 'R\' Moshe Klein', userId: null, cents: 100000, cat: fund('building'), occasion: 'Building campaign', paid: 50000, method: 'check' as const },
      { name: 'R\' Shmuel Weiss', userId: null, cents: 18000, cat: fund('shalosh-seudos'), occasion: 'Shalosh seudos', paid: 18000, method: 'zelle' as const },
      { name: 'R\' Yaakov Stern', userId: null, cents: 50000, cat: fund('seats'), occasion: 'Seat 5786', paid: 0, method: 'cash' as const },
      { name: 'Anonymous', userId: null, cents: 5400, cat: fund('general'), occasion: '', paid: 5400, method: 'cash' as const },
      { name: 'R\' Chaim Rosenberg', userId: null, cents: 180000, cat: fund('building'), occasion: 'לעילוי נשמת', paid: 180000, method: 'card' as const },
      { name: 'R\' Aharon Lieber', userId: null, cents: 3600, cat: fund('aliyos'), occasion: 'Maftir, Parashas Noach', paid: 0, method: 'cash' as const },
      { name: 'R\' Yitzchok Berger', userId: null, cents: 10000, cat: fund('kollel'), occasion: 'Kollel support', paid: 10000, method: 'zelle' as const },
    ];

    for (const [i, sample] of samples.entries()) {
      const daysAgo = (i + 1) * 9;
      const when = Math.floor(DateTime.now().setZone(TZ).minus({ days: daysAgo }).toSeconds());

      const [pledge] = await db.insert(pledges).values({
        userId: sample.userId,
        donorName: sample.name,
        categoryId: sample.cat,
        amountCents: sample.cents,
        occasion: sample.occasion,
        anonymous: sample.name === 'Anonymous',
        status: sample.paid >= sample.cents ? 'paid' : sample.paid > 0 ? 'partial' : 'open',
        createdById: gabbai?.id ?? null,
        createdAt: when,
      }).returning();

      if (sample.paid > 0) {
        await db.insert(payments).values({
          pledgeId: pledge.id,
          userId: sample.userId,
          donorName: sample.name,
          categoryId: sample.cat,
          amountCents: sample.paid,
          method: sample.method,
          status: 'succeeded',
          paidAt: when,
          recordedById: gabbai?.id ?? null,
          createdAt: when,
        });
      }
    }
    console.log('  giving     ✓');
  }

  /* ---------------- Aliyos ---------------- */
  if ((await db.select().from(aliyos).limit(1)).length === 0) {
    // Find the Shabbos just gone.
    let shabbos = today;
    for (let i = 0; i < 7; i++) {
      const iso = addDaysISO(today, -i, TZ);
      if (computeZmanim(iso, s).info.isShabbos) { shabbos = iso; break; }
    }
    const parsha = computeZmanim(shabbos, s).info.parsha ?? '';

    await db.insert(aliyos).values([
      { date: shabbos, parsha, aliyah: 'kohen', recipientName: 'R\' Dovid Friedman', recipientUserId: member?.id ?? null, amountCents: 3600, status: 'paid' },
      { date: shabbos, parsha, aliyah: 'levi', recipientName: 'R\' Moshe Klein', amountCents: 3600, status: 'pledged' },
      { date: shabbos, parsha, aliyah: 'shlishi', recipientName: 'R\' Shmuel Weiss', amountCents: 1800, status: 'paid' },
      { date: shabbos, parsha, aliyah: 'maftir', recipientName: 'R\' Aharon Lieber', amountCents: 5400, status: 'pledged', occasionLabel: 'Aufruf' },
      { date: shabbos, parsha, aliyah: 'hagbah', recipientName: 'R\' Yaakov Stern', amountCents: 1800, status: 'paid' },
    ]);
    console.log('  aliyos     ✓');
  }

  /* ---------------- Announcements & events ---------------- */
  if ((await db.select().from(announcements).limit(1)).length === 0) {
    const now = Math.floor(Date.now() / 1000);
    await db.insert(announcements).values([
      { title: 'Shiurim resume this week', body: 'The evening Daf Yomi and the Tuesday night halacha shiur are both back on their regular schedule.', priority: 'normal', audience: 'public', publishAt: now - 86400, pinned: true, showOnDisplay: true, authorId: admin?.id ?? null },
      { title: 'Kiddush sponsorship dates available', body: 'Several Shabbosos are open for kiddush and shalosh seudos. Book online or speak to a gabbai.', priority: 'high', audience: 'public', publishAt: now - 3600 * 6, showOnDisplay: true, authorId: admin?.id ?? null },
      { title: 'Seats for the coming year', body: 'The 5786 seating chart is now open. Members can see their seat from their account page.', priority: 'normal', audience: 'members', publishAt: now - 86400 * 3, showOnDisplay: false, authorId: admin?.id ?? null },
      { title: 'Building fund update', body: 'Thanks to your generosity we have passed the first milestone of the beis medrash expansion.', priority: 'normal', audience: 'public', publishAt: now - 86400 * 5, showOnDisplay: true, authorId: admin?.id ?? null },
    ]);

    await db.insert(events).values([
      { title: 'Melava Malka', description: 'Motzei Shabbos, with divrei Torah from the Rav.', startAt: Math.floor(DateTime.now().setZone(TZ).plus({ days: 9 }).set({ hour: 20, minute: 30 }).toSeconds()), location: 'Social Hall', showOnDisplay: true },
      { title: 'Shul dinner', description: 'Annual dinner in support of the building fund.', startAt: Math.floor(DateTime.now().setZone(TZ).plus({ days: 34 }).set({ hour: 19, minute: 0 }).toSeconds()), location: 'Main Shul', showOnDisplay: true },
    ]);
    console.log('  notices    ✓');
  }

  /* ---------------- Yahrzeits ---------------- */
  if ((await db.select().from(yahrzeits).limit(1)).length === 0) {
    const hy = new HDate().yy;
    // One falling within the coming week, so the board has something to show.
    const soon = new HDate(new Date()).add(3, 'd');

    await db.insert(yahrzeits).values([
      { userId: member?.id ?? null, nifterName: 'Avrohom Friedman', nifterNameHe: 'ר\' אברהם בן ר\' יצחק ז"ל',
        relationship: 'Father', hebrewDay: soon.dd, hebrewMonth: soon.mm, hebrewYear: hy - 12, showOnDisplay: true },
      { userId: member?.id ?? null, nifterName: 'Rochel Friedman', nifterNameHe: 'מרת רחל בת ר\' משה ע"ה',
        relationship: 'Mother', hebrewDay: 18, hebrewMonth: months.KISLEV, hebrewYear: hy - 7, showOnDisplay: true },
      { userId: gabbai?.id ?? null, nifterName: 'Shmuel Gabbai', nifterNameHe: 'ר\' שמואל בן ר\' יעקב ז"ל',
        relationship: 'Father', hebrewDay: 3, hebrewMonth: months.ADAR_I, hebrewYear: hy - 20, showOnDisplay: true },
    ]);
    console.log('  yahrzeits  ✓');
  }

  console.log('\nDone. Log in at /login with admin@tifereseliezer.org / changeme123');
  console.log('Change that password straight away from the account page.\n');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
