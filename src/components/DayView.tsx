'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { isToday } from 'date-fns'
import { SERVICE_DURATION_MINUTES } from '@/lib/capacity'

const SLOT_HEIGHT = 64 // px per 30 minutes
const START_HOUR = 9
const END_HOUR = 20
const TOTAL_SLOTS = (END_HOUR - START_HOUR) * 2  // 22 × 30-min slots
const TOTAL_HEIGHT = TOTAL_SLOTS * SLOT_HEIGHT    // 1408px

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  scheduled:  { bg: '#47A1A0', text: 'white' },
  checked_in: { bg: '#3b82f6', text: 'white' },
  completed:  { bg: '#22c55e', text: 'white' },
  no_show:    { bg: '#9ca3af', text: 'white' },
  cancelled:  { bg: '#e5e7eb', text: '#6b7280' },
}

export type AppointmentFull = {
  id: string
  scheduled_at: string
  service_type: string
  status: string
  chair_number: number | null
  crm_clients: { first_name: string; last_name: string } | null
}

type LayoutAppt = AppointmentFull & { col: number; colCount: number }

// ---------------------------------------------------------------------------
// Timezone helpers — always use browser local time
// Supabase may return timestamps without a trailing 'Z' (e.g. "2024-06-30 10:00:00"),
// which JS would parse as *local* time rather than UTC. Normalise to an
// unambiguous UTC ISO string first, then read back in local time.
// ---------------------------------------------------------------------------
function parseLocal(scheduledAt: string): Date {
  let s = scheduledAt.trim()
  // Replace the PostgreSQL space separator with 'T'
  if (s.length >= 19 && s[10] === ' ') s = s.slice(0, 10) + 'T' + s.slice(11)
  // If no timezone designator, assume UTC (Supabase stores as UTC)
  if (!/[Z+\-]\d*$/.test(s.slice(10))) s += 'Z'
  return new Date(s)
}

/** Minutes elapsed since START_HOUR in the browser's local timezone. */
function localMinsSinceOpen(scheduledAt: string): number {
  const d = parseLocal(scheduledAt)
  return (d.getHours() - START_HOUR) * 60 + d.getMinutes()
}

function topPx(scheduledAt: string) {
  return Math.max(0, (localMinsSinceOpen(scheduledAt) / 30) * SLOT_HEIGHT)
}

function heightPx(serviceType: string) {
  return (( SERVICE_DURATION_MINUTES[serviceType] ?? 60) / 30) * SLOT_HEIGHT
}

function nowMinsSinceOpen(): number {
  const n = new Date()
  return (n.getHours() - START_HOUR) * 60 + n.getMinutes()
}

function formatLocalTime(scheduledAt: string): string {
  const d = parseLocal(scheduledAt)
  const h = d.getHours()
  const m = d.getMinutes()
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  const ampm = h >= 12 ? 'PM' : 'AM'
  const mm = m === 0 ? '00' : String(m).padStart(2, '0')
  return `${h12}:${mm} ${ampm}`
}

// ---------------------------------------------------------------------------
// Grid lines — 15-min subdivisions
// ---------------------------------------------------------------------------
// Marks at every 15 minutes from 9 AM to 8 PM (44 intervals)
// px per 15 min = SLOT_HEIGHT / 2 = 32px
const GRID_LINES = Array.from({ length: (END_HOUR - START_HOUR) * 4 }, (_, i) => {
  const totalMins = i * 15
  const isHour = totalMins % 60 === 0
  const isHalf = !isHour && totalMins % 60 === 30
  return {
    top: (totalMins / 30) * SLOT_HEIGHT,
    isHour,
    isHalf,
    // quarter = 15-min and 45-min marks
  }
})

// Hour labels on the time axis (one per hour, 11 labels: 9 AM … 8 PM)
const HOUR_LABELS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => {
  const hour = START_HOUR + i
  const h12 = hour > 12 ? hour - 12 : hour
  const ampm = hour >= 12 ? 'PM' : 'AM'
  return { top: i * SLOT_HEIGHT * 2, label: `${h12} ${ampm}` }
})

// ---------------------------------------------------------------------------
// Layout computation — concurrent appointments rendered side-by-side
// ---------------------------------------------------------------------------
function durationMs(serviceType: string) {
  return (SERVICE_DURATION_MINUTES[serviceType] ?? 60) * 60_000
}

function computeLayout(appts: AppointmentFull[]): LayoutAppt[] {
  if (appts.length === 0) return []
  const sorted = [...appts].sort(
    (a, b) => parseLocal(a.scheduled_at).getTime() - parseLocal(b.scheduled_at).getTime()
  )
  const slotEnds: number[] = []
  const colOf: number[] = new Array(sorted.length)
  for (let i = 0; i < sorted.length; i++) {
    const start = parseLocal(sorted[i].scheduled_at).getTime()
    const end = start + durationMs(sorted[i].service_type)
    let col = slotEnds.findIndex(e => e <= start)
    if (col === -1) { col = slotEnds.length; slotEnds.push(end) }
    else slotEnds[col] = end
    colOf[i] = col
  }
  return sorted.map((appt, i) => {
    const aStart = parseLocal(appt.scheduled_at).getTime()
    const aEnd = aStart + durationMs(appt.service_type)
    let colCount = 1
    for (let j = 0; j < sorted.length; j++) {
      if (i === j) continue
      const bStart = parseLocal(sorted[j].scheduled_at).getTime()
      const bEnd = bStart + durationMs(sorted[j].service_type)
      if (bStart < aEnd && bEnd > aStart) colCount = Math.max(colCount, 2)
    }
    return { ...appt, col: colOf[i], colCount }
  })
}

// ---------------------------------------------------------------------------
// Appointment block
// ---------------------------------------------------------------------------
const GAP = 3

function ApptBlock({ appt }: { appt: LayoutAppt }) {
  const style = STATUS_STYLES[appt.status] ?? STATUS_STYLES.scheduled
  const top = topPx(appt.scheduled_at)
  const height = heightPx(appt.service_type)
  const name = appt.crm_clients
    ? `${appt.crm_clients.first_name} ${appt.crm_clients.last_name}`
    : 'Unknown'

  const pct = 100 / appt.colCount
  const leftCalc =
    appt.colCount === 1
      ? '2px'
      : `calc(${appt.col * pct}% + ${appt.col === 0 ? GAP : GAP / 2}px)`
  const rightCalc =
    appt.colCount === 1
      ? '2px'
      : `calc(${(appt.colCount - appt.col - 1) * pct}% + ${appt.col === appt.colCount - 1 ? GAP : GAP / 2}px)`

  return (
    <Link
      href={`/appointments/${appt.id}`}
      className="absolute rounded-lg overflow-hidden hover:brightness-95 transition-all shadow-sm"
      style={{ top, height, left: leftCalc, right: rightCalc, backgroundColor: style.bg, color: style.text }}
    >
      <div className="px-2 py-1.5 h-full flex flex-col overflow-hidden">
        <p className="text-xs font-bold leading-tight truncate">{name}</p>
        {height >= 96 && (
          <p className="text-xs opacity-80 mt-0.5">{appt.service_type}</p>
        )}
        {height >= 96 && (
          <p className="text-xs opacity-70 mt-0.5">{formatLocalTime(appt.scheduled_at)}</p>
        )}
      </div>
    </Link>
  )
}

// ---------------------------------------------------------------------------
// DayView
// ---------------------------------------------------------------------------
export default function DayView({
  appointments,
  date,
}: {
  appointments: AppointmentFull[]
  date: Date
}) {
  const gridRef = useRef<HTMLDivElement>(null)
  const [nowTop, setNowTop] = useState<number | null>(null)

  // Current-time indicator — update every minute
  useEffect(() => {
    function calc() {
      if (!isToday(date)) { setNowTop(null); return }
      setNowTop((nowMinsSinceOpen() / 30) * SLOT_HEIGHT)
    }
    calc()
    const id = setInterval(calc, 60_000)
    return () => clearInterval(id)
  }, [date])

  // Scroll to current time when viewing today
  useEffect(() => {
    if (!gridRef.current) return
    if (isToday(date)) {
      gridRef.current.scrollTop = Math.max(0, (nowMinsSinceOpen() / 30) * SLOT_HEIGHT - 120)
    } else {
      gridRef.current.scrollTop = 0
    }
  }, [date])

  const laid = computeLayout(appointments)

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto" ref={gridRef}>
        <div className="flex" style={{ height: TOTAL_HEIGHT }}>

          {/* Time axis */}
          <div className="w-16 flex-shrink-0 relative flex-shrink-0" style={{ height: TOTAL_HEIGHT }}>
            {HOUR_LABELS.map(({ top, label }) => (
              <div
                key={top}
                className="absolute right-3"
                style={{ top }}
              >
                <span className="text-xs text-gray-400 font-medium leading-none -mt-2 block">
                  {label}
                </span>
              </div>
            ))}
            {/* Red dot at current time */}
            {nowTop !== null && nowTop >= 0 && nowTop <= TOTAL_HEIGHT && (
              <div
                className="absolute right-1 z-10 pointer-events-none"
                style={{ top: nowTop - 5 }}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              </div>
            )}
          </div>

          {/* Event column */}
          <div className="flex-1 relative border-l border-gray-200" style={{ height: TOTAL_HEIGHT }}>
            {/* Grid lines — hour / half-hour / quarter-hour */}
            {GRID_LINES.map(({ top, isHour, isHalf }) => (
              <div
                key={top}
                className="absolute left-0 right-0 pointer-events-none"
                style={{
                  top,
                  borderTop: isHour
                    ? '1px solid #e5e7eb'
                    : isHalf
                      ? '1px solid #f0f0f0'
                      : '1px dotted #f5f5f5',
                }}
              />
            ))}

            {/* Current-time line */}
            {nowTop !== null && nowTop >= 0 && nowTop <= TOTAL_HEIGHT && (
              <div
                className="absolute left-0 right-0 z-10 pointer-events-none h-0.5 bg-red-400"
                style={{ top: nowTop }}
              />
            )}

            {/* Appointment blocks */}
            {laid.map(appt => <ApptBlock key={appt.id} appt={appt} />)}

            {appointments.length === 0 && (
              <p className="absolute inset-0 flex items-center justify-center text-sm text-gray-300">
                No appointments this day
              </p>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
