'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { addDays, format, isToday } from 'date-fns'
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
import type { AppointmentFull } from './DayView'


/** True if a UTC appointment falls on a given calendar day in local time. */
function isLocalDay(scheduledAt: string, day: Date): boolean {
  const d = parseUTC(scheduledAt)
  return (
    d.getFullYear() === day.getFullYear() &&
    d.getMonth() === day.getMonth() &&
    d.getDate() === day.getDate()
  )
}

export default function WeekView({
  appointments,
  weekStart,
  onDayClick,
}: {
  appointments: AppointmentFull[]
  weekStart: Date
  onDayClick: (date: Date) => void
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const gridRef = useRef<HTMLDivElement>(null)
  const [nowTop, setNowTop] = useState<number | null>(null)

  // Current-time indicator — shown on whichever day-column is today
  useEffect(() => {
    function calc() {
      const today = new Date()
      const inWeek = days.some(
        d => d.getFullYear() === today.getFullYear() &&
             d.getMonth() === today.getMonth() &&
             d.getDate() === today.getDate()
      )
      setNowTop(inWeek ? (nowMinsSinceOpen() / 30) * SLOT_HEIGHT : null)
    }
    calc()
    const id = setInterval(calc, 60_000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart])

  // Scroll to current time on mount / week change
  useEffect(() => {
    if (!gridRef.current) return
    const today = new Date()
    const inWeek = days.some(
      d => d.getFullYear() === today.getFullYear() &&
           d.getMonth() === today.getMonth() &&
           d.getDate() === today.getDate()
    )
    gridRef.current.scrollTop = inWeek
      ? Math.max(0, (nowMinsSinceOpen() / 30) * SLOT_HEIGHT - 120)
      : 0
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart])

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Sticky day-header row */}
      <div className="flex flex-shrink-0 border-b border-gray-200 bg-white z-10">
        {/* Spacer above time axis */}
        <div className="w-16 flex-shrink-0" />
        {/* Day headers */}
        {days.map(day => {
          const today = isToday(day)
          return (
            <div
              key={day.toISOString()}
              className="flex-1 border-l border-gray-200 py-3 text-center cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => onDayClick(day)}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                {format(day, 'EEE')}
              </p>
              <div
                className="mt-1 mx-auto w-8 h-8 rounded-full flex items-center justify-center"
                style={today ? { backgroundColor: '#47A1A0' } : {}}
              >
                <p className={`text-base font-bold leading-none ${today ? 'text-white' : 'text-gray-800'}`}>
                  {format(day, 'd')}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Scrollable grid */}
      <div className="flex-1 overflow-y-auto" ref={gridRef}>
        <div className="flex" style={{ height: TOTAL_HEIGHT }}>

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

          {/* Day columns */}
          {days.map(day => {
            const today = isToday(day)
            const dayAppts = appointments
              .filter(a => isLocalDay(a.scheduled_at, day))
              .sort((a, b) => parseUTC(a.scheduled_at).getTime() - parseUTC(b.scheduled_at).getTime())

            return (
              <div
                key={day.toISOString()}
                className="flex-1 relative border-l border-gray-200"
                style={{ height: TOTAL_HEIGHT }}
              >
                {/* Grid lines */}
                {GRID_LINES.map(({ top, isHour, isHalf }) => (
                  <div
                    key={top}
                    className="absolute left-0 right-0 pointer-events-none"
                    style={{
                      top,
                      borderTop: isHour
                        ? '1px solid #e5e7eb'
                        : isHalf
                          ? '1px solid #ebebeb'
                          : '1px dashed #ebebeb',
                    }}
                  />
                ))}

                {/* Today highlight */}
                {today && (
                  <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: '#47A1A008' }} />
                )}

                {/* Current time line across today's column */}
                {today && nowTop !== null && nowTop >= 0 && nowTop <= TOTAL_HEIGHT && (
                  <div
                    className="absolute left-0 right-0 z-10 pointer-events-none h-0.5 bg-red-400"
                    style={{ top: nowTop }}
                  />
                )}

                {/* Appointment blocks */}
                {dayAppts.map(appt => {
                  const { bg, text } = getServiceColors(appt.service_type)
                  const borderColor = getStatusBorder(appt.status)
                  const top = topPx(appt.scheduled_at)
                  const height = heightPx(appt.service_type, SERVICE_DURATION_MINUTES)
                  const name = appt.crm_clients
                    ? `${appt.crm_clients.first_name} ${appt.crm_clients.last_name[0]}.`
                    : '?'

                  return (
                    <Link
                      key={appt.id}
                      href={`/appointments/${appt.id}`}
                      className="absolute left-0.5 right-0.5 rounded overflow-hidden hover:brightness-95 transition-all shadow-sm"
                      style={{ top, height, backgroundColor: bg, color: text, borderLeft: `3px solid ${borderColor}` }}
                    >
                      <div className="px-1.5 py-1 h-full flex flex-col overflow-hidden">
                        <p className="text-xs font-bold leading-tight truncate" style={{ fontSize: '10px' }}>
                          {formatLocalTime(appt.scheduled_at)}
                        </p>
                        {height >= 64 && (
                          <p className="leading-tight truncate mt-0.5" style={{ fontSize: '10px', opacity: 0.9 }}>
                            {name}
                          </p>
                        )}
                        {height >= 96 && (
                          <p className="leading-tight mt-0.5" style={{ fontSize: '10px', opacity: 0.7 }}>
                            {appt.service_type}
                          </p>
                        )}
                      </div>
                    </Link>
                  )
                })}

                {/* Clickable empty area */}
                {dayAppts.length === 0 && (
                  <div
                    className="absolute inset-0 cursor-pointer"
                    onClick={() => onDayClick(day)}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
