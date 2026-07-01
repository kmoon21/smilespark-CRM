/**
 * Parse a Supabase scheduled_at string as UTC and return a Date whose
 * .getHours() / .getMinutes() reflect the browser's local timezone.
 *
 * Supabase returns timestamps in several formats, all UTC:
 *   "2026-06-30 17:00:00+00"     ← PostgreSQL default (space, +00)
 *   "2026-06-30T17:00:00+00:00"  ← ISO 8601 with offset
 *   "2026-06-30T17:00:00Z"       ← already canonical
 *   "2026-06-30T17:00:00"        ← no tz designator (still UTC from Supabase)
 *
 * All of these must parse to the same UTC instant so that .getHours()
 * returns the correct local hour (e.g. 17:00 UTC → 10 AM PDT).
 */
export function parseUTC(scheduledAt: string): Date {
  let s = scheduledAt.trim()

  // 1. Replace PostgreSQL space separator with 'T'
  if (s.length >= 19 && s[10] === ' ') {
    s = s.slice(0, 10) + 'T' + s.slice(11)
  }

  // 2. Normalise all UTC offset variants → 'Z'
  s = s
    .replace(/\+00:00$/, 'Z')
    .replace(/\+00$/, 'Z')

  // 3. If still no timezone designator, assume UTC (Supabase always stores UTC)
  if (!s.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(s)) {
    s += 'Z'
  }

  return new Date(s)
}

export const START_HOUR = 9
export const END_HOUR = 20
export const SLOT_HEIGHT = 64   // px per 30 min
export const TOTAL_SLOTS = (END_HOUR - START_HOUR) * 2
export const TOTAL_HEIGHT = TOTAL_SLOTS * SLOT_HEIGHT

/** Top offset in px for an appointment in the time grid (local time). */
export function topPx(scheduledAt: string): number {
  const d = parseUTC(scheduledAt)
  const mins = (d.getHours() - START_HOUR) * 60 + d.getMinutes()
  return Math.max(0, (mins / 30) * SLOT_HEIGHT)
}

/** Block height in px based on service duration. */
export function heightPx(serviceType: string, durationMap: Record<string, number>): number {
  return ((durationMap[serviceType] ?? 60) / 30) * SLOT_HEIGHT
}

/** Minutes since START_HOUR right now (local time). */
export function nowMinsSinceOpen(): number {
  const n = new Date()
  return (n.getHours() - START_HOUR) * 60 + n.getMinutes()
}

/** Format a scheduled_at string as local time, e.g. "10:00 AM". */
export function formatLocalTime(scheduledAt: string): string {
  const d = parseUTC(scheduledAt)
  const h = d.getHours()
  const m = d.getMinutes()
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

/** Hour labels for the time axis: 9 AM … 8 PM */
export const HOUR_LABELS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => {
  const hour = START_HOUR + i
  const h12 = hour > 12 ? hour - 12 : hour
  const ampm = hour >= 12 ? 'PM' : 'AM'
  return { top: i * SLOT_HEIGHT * 2, label: `${h12} ${ampm}` }
})

/** Grid lines at every 15 min: hour / half-hour / quarter marks */
export const GRID_LINES = Array.from({ length: (END_HOUR - START_HOUR) * 4 }, (_, i) => {
  const totalMins = i * 15
  const isHour = totalMins % 60 === 0
  const isHalf = !isHour && totalMins % 60 === 30
  return {
    top: (totalMins / 30) * SLOT_HEIGHT,
    isHour,
    isHalf,
  }
})
