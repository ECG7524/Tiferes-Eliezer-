import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

const now = sql`(unixepoch())`;

/* ------------------------------------------------------------------ */
/* Settings — one row, id = 1. Everything the gabbai can tune.        */
/* ------------------------------------------------------------------ */
export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey().default(1),

  nameHe: text('name_he').notNull().default('קהל תפארת אליעזר'),
  nameEn: text('name_en').notNull().default('Kehal Tiferes Eliezer'),
  dedicationHe: text('dedication_he').notNull().default('ע"ש הרה"ג ר\' אליעזר געלדצעהלער זצ"ל'),
  nasiHe: text('nasi_he').notNull().default('בנשיאות הרה"ג ר\' יוסף האלפערט שליט"א'),

  addressLine: text('address_line').notNull().default('1146 N Maple Ave'),
  city: text('city').notNull().default('Toms River'),
  state: text('state').notNull().default('NJ'),
  zip: text('zip').notNull().default('08755'),
  phone: text('phone').default(''),
  email: text('email').default(''),

  // Zmanim geography. Elevation is in metres.
  latitude: real('latitude').notNull().default(40.0334),
  longitude: real('longitude').notNull().default(-74.2129),
  elevation: real('elevation').notNull().default(12),
  timezone: text('timezone').notNull().default('America/New_York'),

  // Halachic preferences
  candleLightingMinutes: integer('candle_lighting_minutes').notNull().default(18),
  havdalahMinutes: integer('havdalah_minutes').notNull().default(50),
  // Which tzais opinion drives the headline "Tzais" figure on the board.
  tzaisOpinion: text('tzais_opinion', {
    enum: ['geonim_8_5', 'minutes_50', 'minutes_60', 'minutes_72', 'degrees_16_1', 'baal_hatanya'],
  }).notNull().default('geonim_8_5'),
  // Alos opinion for the headline figure.
  alosOpinion: text('alos_opinion', {
    enum: ['degrees_16_1', 'minutes_72', 'minutes_90', 'minutes_120', 'baal_hatanya'],
  }).notNull().default('degrees_16_1'),
  inIsrael: integer('in_israel', { mode: 'boolean' }).notNull().default(false),

  // Money
  currency: text('currency').notNull().default('usd'),
  defaultKiddushCents: integer('default_kiddush_cents').notNull().default(36000),
  defaultShaloshSeudosCents: integer('default_shalosh_seudos_cents').notNull().default(18000),
  defaultSeatCents: integer('default_seat_cents').notNull().default(50000),
  defaultAliyahCents: integer('default_aliyah_cents').notNull().default(3600),

  // Display board
  displayRotateSeconds: integer('display_rotate_seconds').notNull().default(20),
  displayShowYahrzeits: integer('display_show_yahrzeits', { mode: 'boolean' }).notNull().default(true),
  displayShowSponsors: integer('display_show_sponsors', { mode: 'boolean' }).notNull().default(true),
  displayShowDaf: integer('display_show_daf', { mode: 'boolean' }).notNull().default(true),
  displayMessage: text('display_message').default(''),
  // The board reads as a Hebrew luach by default, the way a beis medrash
  // board normally does.
  displayLanguage: text('display_language', { enum: ['hebrew', 'english'] })
    .notNull()
    .default('hebrew'),
  // JSON array of learning cycle keys, e.g. ["chumash","daf","nach","dirshu"]
  displayLearningCycles: text('display_learning_cycles')
    .notNull()
    .default('["chumash","daf","nach","dirshu"]'),
  displayShowTefillah: integer('display_show_tefillah', { mode: 'boolean' }).notNull().default(true),

  // Nusach Sefard and Eretz Yisrael say מוריד הטל through the summer;
  // Ashkenaz says nothing there.
  saysMoridHatal: integer('says_morid_hatal', { mode: 'boolean' }).notNull().default(true),
  // Rema is 7 days after the molad; much of Chassidus says 3.
  kiddushLevanaFromDays: integer('kiddush_levana_from_days').notNull().default(7),

  // Whether new signups need an admin to approve them before they can log in.
  requireApproval: integer('require_approval', { mode: 'boolean' }).notNull().default(true),

  updatedAt: integer('updated_at').notNull().default(now),
});

/* ------------------------------------------------------------------ */
/* People                                                              */
/* ------------------------------------------------------------------ */
export const users = sqliteTable(
  'users',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    hebrewName: text('hebrew_name').default(''),
    phone: text('phone').default(''),
    // member: sees announcements + own giving. gabbai: runs the shul modules.
    // admin: everything including members + settings.
    role: text('role', { enum: ['member', 'gabbai', 'admin'] }).notNull().default('member'),
    status: text('status', { enum: ['pending', 'active', 'disabled'] }).notNull().default('pending'),
    notes: text('notes').default(''),
    createdAt: integer('created_at').notNull().default(now),
  },
  (t) => ({ emailIdx: uniqueIndex('users_email_idx').on(t.email) }),
);

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at').notNull(),
    createdAt: integer('created_at').notNull().default(now),
  },
  (t) => ({ userIdx: index('sessions_user_idx').on(t.userId) }),
);

/* ------------------------------------------------------------------ */
/* Giving                                                              */
/* ------------------------------------------------------------------ */
export const donationCategories = sqliteTable(
  'donation_categories',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    nameHe: text('name_he').default(''),
    description: text('description').default(''),
    // Drives which module a gift belongs to, so the ledger can roll up by kind.
    kind: text('kind', {
      enum: ['general', 'kiddush', 'shalosh_seudos', 'seats', 'aliyos', 'building', 'membership', 'other'],
    }).notNull().default('general'),
    // JSON array of suggested amounts in cents, e.g. [1800, 3600, 10000]
    suggestedAmounts: text('suggested_amounts').notNull().default('[1800,3600,5400,10000]'),
    allowCustomAmount: integer('allow_custom_amount', { mode: 'boolean' }).notNull().default(true),
    goalCents: integer('goal_cents').default(0),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => ({ slugIdx: uniqueIndex('donation_categories_slug_idx').on(t.slug) }),
);

/**
 * A commitment to give. Cash in the door is a `payment`; this is the promise.
 * A straight card donation creates a pledge AND a payment together so that
 * every dollar has one consistent home in the ledger.
 */
export const pledges = sqliteTable(
  'pledges',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    donorName: text('donor_name').notNull(),
    donorEmail: text('donor_email').default(''),
    donorPhone: text('donor_phone').default(''),
    categoryId: integer('category_id').references(() => donationCategories.id, { onDelete: 'set null' }),
    amountCents: integer('amount_cents').notNull(),
    // "לזכר נשמת", "In honour of the bar mitzvah", etc. Shown on the board.
    occasion: text('occasion').default(''),
    dedication: text('dedication').default(''),
    anonymous: integer('anonymous', { mode: 'boolean' }).notNull().default(false),
    status: text('status', { enum: ['open', 'paid', 'partial', 'cancelled'] }).notNull().default('open'),
    dueDate: text('due_date').default(''), // ISO yyyy-mm-dd
    notes: text('notes').default(''),
    createdById: integer('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: integer('created_at').notNull().default(now),
  },
  (t) => ({
    userIdx: index('pledges_user_idx').on(t.userId),
    statusIdx: index('pledges_status_idx').on(t.status),
  }),
);

export const payments = sqliteTable(
  'payments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    pledgeId: integer('pledge_id').references(() => pledges.id, { onDelete: 'set null' }),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    donorName: text('donor_name').notNull(),
    donorEmail: text('donor_email').default(''),
    categoryId: integer('category_id').references(() => donationCategories.id, { onDelete: 'set null' }),
    amountCents: integer('amount_cents').notNull(),
    method: text('method', { enum: ['card', 'cash', 'check', 'zelle', 'quickpay', 'other'] })
      .notNull()
      .default('cash'),
    reference: text('reference').default(''), // cheque number, Zelle confirmation, etc.
    stripeSessionId: text('stripe_session_id').default(''),
    stripePaymentIntent: text('stripe_payment_intent').default(''),
    status: text('status', { enum: ['pending', 'succeeded', 'refunded', 'failed'] })
      .notNull()
      .default('succeeded'),
    paidAt: integer('paid_at').notNull().default(now),
    notes: text('notes').default(''),
    recordedById: integer('recorded_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: integer('created_at').notNull().default(now),
  },
  (t) => ({
    pledgeIdx: index('payments_pledge_idx').on(t.pledgeId),
    userIdx: index('payments_user_idx').on(t.userId),
    stripeIdx: index('payments_stripe_idx').on(t.stripeSessionId),
    paidAtIdx: index('payments_paid_at_idx').on(t.paidAt),
  }),
);

/* ------------------------------------------------------------------ */
/* Kiddush / Shalosh Seudos sponsorship slots                          */
/* ------------------------------------------------------------------ */
export const sponsorships = sqliteTable(
  'sponsorships',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    kind: text('kind', { enum: ['kiddush', 'shalosh_seudos', 'seudas_yom_tov', 'melava_malka'] })
      .notNull()
      .default('kiddush'),
    date: text('date').notNull(), // ISO yyyy-mm-dd of the Shabbos / Yom Tov
    label: text('label').default(''), // "Parashas Noach", "Shabbos Chanukah"
    sponsorUserId: integer('sponsor_user_id').references(() => users.id, { onDelete: 'set null' }),
    sponsorName: text('sponsor_name').default(''),
    occasion: text('occasion').default(''),
    amountCents: integer('amount_cents').notNull().default(0),
    pledgeId: integer('pledge_id').references(() => pledges.id, { onDelete: 'set null' }),
    status: text('status', { enum: ['open', 'requested', 'confirmed', 'cancelled'] })
      .notNull()
      .default('open'),
    // More than one family can go in on the same kiddush.
    coSponsors: text('co_sponsors').default(''),
    notes: text('notes').default(''),
    createdAt: integer('created_at').notNull().default(now),
  },
  (t) => ({
    dateIdx: index('sponsorships_date_idx').on(t.date),
    kindDateIdx: index('sponsorships_kind_date_idx').on(t.kind, t.date),
  }),
);

/* ------------------------------------------------------------------ */
/* Seats                                                               */
/* ------------------------------------------------------------------ */
export const seats = sqliteTable(
  'seats',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    section: text('section').notNull().default('Main'), // Main, Ezras Nashim, Beis Medrash
    row: text('row').notNull().default('A'),
    number: integer('number').notNull().default(1),
    label: text('label').default(''), // overrides "Row A, Seat 3" if the shul names seats
    priceCents: integer('price_cents').notNull().default(50000),
    // Which year the assignment covers, e.g. 5786.
    year: integer('year').notNull().default(5786),
    holderUserId: integer('holder_user_id').references(() => users.id, { onDelete: 'set null' }),
    holderName: text('holder_name').default(''),
    status: text('status', { enum: ['available', 'held', 'assigned'] }).notNull().default('available'),
    pledgeId: integer('pledge_id').references(() => pledges.id, { onDelete: 'set null' }),
    notes: text('notes').default(''),
  },
  (t) => ({
    seatIdx: uniqueIndex('seats_unique_idx').on(t.year, t.section, t.row, t.number),
    yearIdx: index('seats_year_idx').on(t.year),
  }),
);

/* ------------------------------------------------------------------ */
/* Aliyos                                                              */
/* ------------------------------------------------------------------ */
export const aliyos = sqliteTable(
  'aliyos',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    date: text('date').notNull(), // ISO yyyy-mm-dd
    parsha: text('parsha').default(''),
    occasionLabel: text('occasion_label').default(''), // "Shabbos Mevorchim", "Yom Kippur - Mincha"
    aliyah: text('aliyah', {
      enum: [
        'kohen', 'levi', 'shlishi', 'revii', 'chamishi', 'shishi', 'shvii',
        'maftir', 'hosafa', 'acharon', 'chosson_torah', 'chosson_bereishis',
        'pesicha', 'hagbah', 'gelilah', 'other',
      ],
    }).notNull().default('kohen'),
    recipientUserId: integer('recipient_user_id').references(() => users.id, { onDelete: 'set null' }),
    recipientName: text('recipient_name').notNull().default(''),
    amountCents: integer('amount_cents').notNull().default(0),
    pledgeId: integer('pledge_id').references(() => pledges.id, { onDelete: 'set null' }),
    status: text('status', { enum: ['pledged', 'paid', 'waived'] }).notNull().default('pledged'),
    notes: text('notes').default(''),
    createdAt: integer('created_at').notNull().default(now),
  },
  (t) => ({
    dateIdx: index('aliyos_date_idx').on(t.date),
    recipientIdx: index('aliyos_recipient_idx').on(t.recipientUserId),
  }),
);

/* ------------------------------------------------------------------ */
/* Davening schedule                                                   */
/* ------------------------------------------------------------------ */
export const minyanim = sqliteTable(
  'minyanim',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(), // "Shacharis", "Mincha", "Maariv", "Neitz"
    nameHe: text('name_he').default(''),
    // Which days this minyan runs. `weekday` = Mon-Fri excluding special days.
    dayType: text('day_type', {
      enum: ['weekday', 'monday_thursday', 'sunday', 'friday', 'shabbos', 'yom_tov', 'rosh_chodesh', 'fast_day', 'erev_shabbos', 'motzei_shabbos', 'selichos', 'sunday_thursday'],
    }).notNull().default('weekday'),
    // Fixed clock time, or an offset from a zman that moves with the year.
    timeType: text('time_type', { enum: ['fixed', 'relative'] }).notNull().default('fixed'),
    fixedTime: text('fixed_time').default('07:00'), // HH:mm 24h
    relativeTo: text('relative_to', {
      enum: ['alos', 'sunrise', 'sof_zman_shma', 'chatzos', 'mincha_gedola', 'plag', 'candle_lighting', 'sunset', 'tzais'],
    }).default('sunset'),
    offsetMinutes: integer('offset_minutes').notNull().default(0),
    // Round the computed time to a tidier figure, e.g. down to the nearest 5.
    roundTo: integer('round_to').notNull().default(0),
    roundDirection: text('round_direction', { enum: ['nearest', 'earlier', 'later'] }).notNull().default('earlier'),
    location: text('location').default('Main Shul'),
    notes: text('notes').default(''),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    showOnDisplay: integer('show_on_display', { mode: 'boolean' }).notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => ({ dayIdx: index('minyanim_day_idx').on(t.dayType) }),
);

export const shiurim = sqliteTable(
  'shiurim',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    title: text('title').notNull(),
    titleHe: text('title_he').default(''),
    maggidShiur: text('maggid_shiur').default(''),
    description: text('description').default(''),
    location: text('location').default('Beis Medrash'),
    recurrence: text('recurrence', { enum: ['weekly', 'daily', 'monthly', 'once'] }).notNull().default('weekly'),
    // 0 = Sunday .. 6 = Shabbos. Null for daily/once.
    dayOfWeek: integer('day_of_week'),
    specificDate: text('specific_date').default(''), // ISO date for one-off shiurim
    // Same fixed/relative machinery as minyanim, so "30 min before Mincha" works.
    timeType: text('time_type', { enum: ['fixed', 'relative'] }).notNull().default('fixed'),
    startTime: text('start_time').default('20:00'),
    relativeTo: text('relative_to', {
      enum: ['alos', 'sunrise', 'sof_zman_shma', 'chatzos', 'mincha_gedola', 'plag', 'candle_lighting', 'sunset', 'tzais'],
    }).default('sunset'),
    offsetMinutes: integer('offset_minutes').notNull().default(0),
    durationMinutes: integer('duration_minutes').notNull().default(45),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    showOnDisplay: integer('show_on_display', { mode: 'boolean' }).notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => ({ dayIdx: index('shiurim_day_idx').on(t.dayOfWeek) }),
);

/* ------------------------------------------------------------------ */
/* Announcements & events                                              */
/* ------------------------------------------------------------------ */
export const announcements = sqliteTable(
  'announcements',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    title: text('title').notNull(),
    body: text('body').notNull().default(''),
    priority: text('priority', { enum: ['normal', 'high', 'urgent'] }).notNull().default('normal'),
    // Members only, or on the shul monitor and the public homepage too.
    audience: text('audience', { enum: ['public', 'members'] }).notNull().default('public'),
    publishAt: integer('publish_at').notNull().default(now),
    expiresAt: integer('expires_at'),
    pinned: integer('pinned', { mode: 'boolean' }).notNull().default(false),
    showOnDisplay: integer('show_on_display', { mode: 'boolean' }).notNull().default(true),
    authorId: integer('author_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: integer('created_at').notNull().default(now),
  },
  (t) => ({ publishIdx: index('announcements_publish_idx').on(t.publishAt) }),
);

export const events = sqliteTable(
  'events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    title: text('title').notNull(),
    description: text('description').default(''),
    startAt: integer('start_at').notNull(),
    endAt: integer('end_at'),
    location: text('location').default(''),
    showOnDisplay: integer('show_on_display', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at').notNull().default(now),
  },
  (t) => ({ startIdx: index('events_start_idx').on(t.startAt) }),
);

/* ------------------------------------------------------------------ */
/* Yahrzeits                                                           */
/* ------------------------------------------------------------------ */
export const yahrzeits = sqliteTable(
  'yahrzeits',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
    // Whose yahrzeit it is.
    nifterName: text('nifter_name').notNull(),
    nifterNameHe: text('nifter_name_he').default(''),
    relationship: text('relationship').default(''), // "father", "mother"
    // Hebrew date of petirah, which is what the yahrzeit actually follows.
    hebrewDay: integer('hebrew_day').notNull(),
    hebrewMonth: integer('hebrew_month').notNull(), // hebcal month constant
    hebrewYear: integer('hebrew_year').notNull(),
    // Kept for reference / for families who only know the English date.
    gregorianDate: text('gregorian_date').default(''),
    showOnDisplay: integer('show_on_display', { mode: 'boolean' }).notNull().default(true),
    notes: text('notes').default(''),
    createdAt: integer('created_at').notNull().default(now),
  },
  (t) => ({
    userIdx: index('yahrzeits_user_idx').on(t.userId),
    hebIdx: index('yahrzeits_heb_idx').on(t.hebrewMonth, t.hebrewDay),
  }),
);

export type User = typeof users.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type DonationCategory = typeof donationCategories.$inferSelect;
export type Pledge = typeof pledges.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Sponsorship = typeof sponsorships.$inferSelect;
export type Seat = typeof seats.$inferSelect;
export type Aliyah = typeof aliyos.$inferSelect;
export type Minyan = typeof minyanim.$inferSelect;
export type Shiur = typeof shiurim.$inferSelect;
export type Announcement = typeof announcements.$inferSelect;
export type ShulEvent = typeof events.$inferSelect;
export type Yahrzeit = typeof yahrzeits.$inferSelect;
