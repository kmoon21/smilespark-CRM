'use client'

import { useEffect, useRef, useState } from 'react'
import { isToday } from 'date-fns'
import { Star } from 'lucide-react'
import { SERVICE_DURATION_MINUTES } from '@/lib/capacity'
import { getServiceColors, getStatusBorder } from '@/lib/service-colors'
import {
  parseUTC,
  topPx,
  heightPx,
  formatLocalTime,
  nowMinsSinceOpen,
  SLOT_HEIGHT,
  TOTAL_HEIGHT,
  HOUR_LABELS,
  GRID_LINES,
} from '@/lib/time'


export type AppointmentFull = {
  id: string
  client_id: string
  scheduled_at: string
  service_type: string
  status: string
  chair_number: number | null
  notes: string | null
  amount_paid: number | null
  payment_method: string | null
  crm_clients: { first_name: string; last_name: string } | null
}

type LayoutAppt = AppointmentFull & { col: number; colCount: number }

function durationMs(serviceType: string) {
  return (SERVICE_DURATION_MINUTES[serviceType] ?? 60) * 60_000
}

function computeLayout(appts: AppointmentFull[]): LayoutAppt[] {
  if (appts.length === 0) return []
  const sorted = [...appts].sort(
    (a, b) => parseUTC(a.scheduled_at).getTime() - parseUTC(b.scheduled_at).getTime()
  )
  const slotEnds: number[] = []
  const colOf: number[] = new Array(sorted.length)
  for (let i = 0; i < sorted.length; i++) {
    const start = parseUTC(sorted[i].scheduled_at).getTime()
    const end = start + durationMs(sorted[i].service_type)
    let col = slotEnds.findIndex(e => e <= start)
    if (col === -1) { col = slotEnds.length; slotEnds.push(end) }
    else slotEnds[col] = end
    colOf[i] = col
  }
  return sorted.map((appt, i) => {
    const aStart = parseUTC(appt.scheduled_at).getTime()
    const aEnd = aStart + durationMs(appt.service_type)
    let colCount = 1
    for (let j = 0; j < sorted.length; j++) {
      if (i === j) continue
      const bStart = parseUTC(sorted[j].scheduled_at).getTime()
      const bEnd = bStart + durationMs(sorted[j].service_type)
      if (bStart < aEnd && bEnd > aStart) colCount = Math.max(colCount, 2)
    }
    return { ...appt, col: colOf[i], colCount }
  })
}

const GAP = 3

function ApptBlock({ appt, onClick, hasPkg }: { appt: LayoutAppt; onClick: (a: AppointmentFull) => void; hasPkg?: boolean }) {
  const { bg, text } = getServiceColors(appt.service_type)
  const borderColor = getStatusBorder(appt.status)
  const top = topPx(appt.scheduled_at)
  const height = heightPx(appt.service_type, SERVICE_DURATION_MINUTES)
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
    <button
      onClick={() => onClick(appt)}
      className="absolute rounded-lg overflow-hidden hover:brightness-95 transition-all shadow-sm text-left w-auto"
      style={{
        top, height, left: leftCalc, right: rightCalc,
        backgroundColor: bg, color: text,
        borderLeft: `3px solid ${borderColor}`,
      }}
    >
      <div className="px-2 py-1.5 h-full flex flex-col overflow-hidden relative">
        {hasPkg && (
          <Star size={11} className="absolute top-1 right-1 flex-shrink-0" style={{ color: '#FEB74B', fill: '#FEB74B' }} />
        )}
        <p className="text-xs font-bold leading-tight truncate pr-3">{name}</p>
        {height >= 96 && (
          <p className="text-xs opacity-80 mt-0.5">{appt.service_type.replace('_', ' ')}</p>
        )}
        {height >= 96 && (
          <p className="text-xs opacity-70 mt-0.5">{formatLocalTime(appt.scheduled_at)}</p>
        )}
      </div>
    </button>
  )
}

export default function DayView({
  appointments,
  date,
  onApptClick,
  pkgClientIds,
}: {
  appointments: AppointmentFull[]
  date: Date
  onApptClick: (appt: AppointmentFull) => void
  pkgClientIds?: Set<string>
}) {
  const gridRef = useRef<HTMLDivElement>(null)
  const [nowTop, setNowTop] = useState<number | null>(null)

  useEffect(() => {
    function calc() {
      if (!isToday(date)) { setNowTop(null); return }
      setNowTop((nowMinsSinceOpen() / 30) * SLOT_HEIGHT)
    }
    calc()
    const id = setInterval(calc, 60_000)
    return () => clearInterval(id)
  }, [date])

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
        <div className="flex" style={{ height: TOTAL_HEIGHT + 10, paddingTop: 10 }}>

          {/* Time axis */}
          <div className="w-16 flex-shrink-0 relative" style={{ height: TOTAL_HEIGHT }}>
            {HOUR_LABELS.map(({ top, label }) => (
              <div key={top} className="absolute right-3" style={{ top }}>
                <span className="text-xs text-gray-400 font-medium leading-none -mt-2 block">
                  {label}
                </span>
              </div>
            ))}
            {nowTop !== null && nowTop >= 0 && nowTop <= TOTAL_HEIGHT && (
              <div className="absolute right-1 z-10 pointer-events-none" style={{ top: nowTop - 5 }}>
                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              </div>
            )}
          </div>

          {/* Event column */}
          <div className="flex-1 relative border-l border-gray-200" style={{ height: TOTAL_HEIGHT }}>
            {GRID_LINES.map(({ top, isHour, isHalf }) => (
              <div
                key={top}
                className="absolute left-0 right-0 pointer-events-none"
                style={{
                  top,
                  borderTop: isHour
                    ? '1px solid #d1d5db'
                    : isHalf
                      ? '1px solid #e5e7eb'
                      : '1px dotted #e0e0e0',
                }}
              />
            ))}
            {nowTop !== null && nowTop >= 0 && nowTop <= TOTAL_HEIGHT && (
              <div
                className="absolute left-0 right-0 z-10 pointer-events-none h-0.5 bg-red-400"
                style={{ top: nowTop }}
              />
            )}
            {laid.map(appt => <ApptBlock key={appt.id} appt={appt} onClick={onApptClick} hasPkg={pkgClientIds?.has(appt.client_id)} />)}
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
