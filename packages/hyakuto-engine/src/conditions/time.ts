// Time-of-day bands — an engine primitive shared by the condition parser, the
// `if_time` predicate, content validation, and tests. The band vocabulary and
// its boundaries live here once (structure-derived), never hand-duplicated.

export type TimeBand =
  | 'late_night'
  | 'morning'
  | 'midday'
  | 'afternoon'
  | 'evening'
  | 'night';

// Each band with the local hour (0–23) it starts at, in ascending order. The
// last band runs to midnight, wrapping back to the first. Tunable in one place.
const BAND_STARTS: { band: TimeBand; startHour: number }[] = [
  { band: 'late_night', startHour: 0 },  // 00:00–04:59
  { band: 'morning', startHour: 5 },     // 05:00–10:59
  { band: 'midday', startHour: 11 },     // 11:00–12:59
  { band: 'afternoon', startHour: 13 },  // 13:00–16:59
  { band: 'evening', startHour: 17 },    // 17:00–20:59
  { band: 'night', startHour: 21 },      // 21:00–23:59
];

export const TIME_BANDS: readonly TimeBand[] = BAND_STARTS.map((b) => b.band);

export function isTimeBand(value: string): value is TimeBand {
  return (TIME_BANDS as readonly string[]).includes(value);
}

/** The time band for an epoch-ms instant, using the local-time hour. */
export function bandOf(now: number): TimeBand {
  const hour = new Date(now).getHours();
  // Walk from the last band down to the first; the first whose start hour the
  // current hour reaches is the active band.
  for (let i = BAND_STARTS.length - 1; i >= 0; i--) {
    if (hour >= BAND_STARTS[i].startHour) return BAND_STARTS[i].band;
  }
  // hour is always >= 0, so the late_night band (startHour 0) always matches;
  // this is unreachable but keeps the function total.
  return BAND_STARTS[0].band;
}
