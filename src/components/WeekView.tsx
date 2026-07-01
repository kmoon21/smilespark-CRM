'use client'

import Link from 'next/link'
import { addDays, format, isSameDay, isToday } from 'date-fns'
import type { AppointmentFull } from './DayView'

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  scheduled:  { bg: '#47A1A0', text: 'white' },
  checked_in: { bg: '#3b82f6', text: 'white' },
  completed:  { bg: '#22c55e', text: 'white' },
  no_show:    { bg: '#9ca3af', text: 'white' },
  cancelled:  { bg: '#e5e7eb', text: '#6b7280' },
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

  return (
    <div className="h-full overflow-y-auto">
      <div className="grid grid-cols-7 divide-x divide-gray-200 min-h-full">
        {days.map((day) => {
          const dayAppts = appointments
            .filter(a => isSameDay(new Date(a.scheduled_at), day))
            .sort((a, b) =>
              new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
            )
          const today = isToday(day)

          return (
            <div key={day.toISOString()} className="flex flex-col min-h-full">
              {/* Day header */}
              <div
                className="sticky top-0 z-10 border-b border-gray-200 bg-white px-2 py-3 text-center cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => onDayClick(day)}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  {format(day, 'EEE')}
                </p>
                <div
                  className="mt-1 mx-auto w-9 h-9 rounded-full flex items-center justify-center"
                  style={today ? { backgroundColor: '#47A1A0' } : {}}
                >
                  <p
                    className={`text-lg font-bold leading-none ${
                      today ? 'text-white' : 'text-gray-800'
                    }`}
                  >
                    {format(day, 'd')}
                  </p>
                </div>
              </div>

              {/* Appointments */}
              <div className="flex-1 p-1.5 space-y-1.5">
                {dayAppts.length === 0 && (
                  <div
                    className="mt-4 text-center text-xs text-gray-300 cursor-pointer"
                    onClick={() => onDayClick(day)}
                  >
                    —
                  </div>
                )}
                {dayAppts.map(appt => {
                  const style = STATUS_STYLES[appt.status] ?? STATUS_STYLES.scheduled
                  const name = appt.crm_clients
                    ? `${appt.crm_clients.first_name} ${appt.crm_clients.last_name[0]}.`
                    : 'Unknown'

                  return (
                    <Link
                      key={appt.id}
                      href={`/appointments/${appt.id}`}
                      className="block rounded-lg px-2 py-1.5 hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: style.bg, color: style.text }}
                    >
                      <p className="text-xs font-bold leading-none">
                        {format(new Date(appt.scheduled_at), 'h:mm a')}
                      </p>
                      <p className="text-xs mt-0.5 truncate opacity-90">{name}</p>
                      <p className="text-xs opacity-70 mt-0.5">
                        {appt.service_type}
                        {appt.chair_number ? ` · C${appt.chair_number}` : ''}
                      </p>
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
