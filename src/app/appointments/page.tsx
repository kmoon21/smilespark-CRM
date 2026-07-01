'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  addDays,
  endOfDay,
  endOfWeek,
  format,
  startOfDay,
  startOfWeek,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import Sidebar from '@/components/Sidebar'
import DayView, { type AppointmentFull } from '@/components/DayView'
import WeekView from '@/components/WeekView'
import AppointmentModal from '@/components/AppointmentModal'
import { SERVICE_COLORS, SERVICE_LABELS, STATUS_BORDER, type ServiceType } from '@/lib/service-colors'

type View = 'day' | 'week'

export default function AppointmentsPage() {
  const [view, setView] = useState<View>('day')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [appointments, setAppointments] = useState<AppointmentFull[]>([])
  const [loading, setLoading] = useState(true)
  const [modalAppt, setModalAppt] = useState<AppointmentFull | null>(null)

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 })

  useEffect(() => {
    setLoading(true)
    const supabase = createClient()
    const from = view === 'day'
      ? startOfDay(selectedDate).toISOString()
      : weekStart.toISOString()
    const to = view === 'day'
      ? endOfDay(selectedDate).toISOString()
      : weekEnd.toISOString()

    supabase
      .from('crm_appointments')
      .select('id, client_id, scheduled_at, service_type, status, chair_number, notes, amount_paid, payment_method, crm_clients(first_name, last_name)')
      .gte('scheduled_at', from)
      .lte('scheduled_at', to)
      .neq('status', 'cancelled')
      .order('scheduled_at')
      .then(({ data }) => {
        setAppointments((data as AppointmentFull[]) ?? [])
        setLoading(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, view])

  function handleApptUpdate(updated: AppointmentFull) {
    setAppointments(prev => prev.map(a => a.id === updated.id ? updated : a))
    setModalAppt(updated)
  }

  function goBack() {
    setSelectedDate(d => addDays(d, view === 'day' ? -1 : -7))
  }
  function goForward() {
    setSelectedDate(d => addDays(d, view === 'day' ? 1 : 7))
  }

  const dateLabel = view === 'day'
    ? format(selectedDate, 'EEEE, MMMM d, yyyy')
    : `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d, yyyy')}`

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />
      <main className="flex-1 ml-64 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={goBack}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={() => setSelectedDate(new Date())}
              className="px-3 py-1.5 text-sm font-medium rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
            >
              Today
            </button>
            <button
              onClick={goForward}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
            >
              <ChevronRight size={20} />
            </button>
            <h1 className="ml-2 text-base font-semibold text-gray-800">
              {dateLabel}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* View toggle */}
            <div className="flex border border-gray-200 rounded-lg overflow-hidden text-sm">
              {(['day', 'week'] as View[]).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className="px-4 py-1.5 font-medium capitalize transition-colors"
                  style={
                    view === v
                      ? { backgroundColor: '#47A1A0', color: 'white' }
                      : { backgroundColor: 'white', color: '#6b7280' }
                  }
                >
                  {v}
                </button>
              ))}
            </div>

            <Link
              href="/appointments/new"
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-white text-sm font-medium"
              style={{ backgroundColor: '#1a2332' }}
            >
              <Plus size={16} />
              New Appointment
            </Link>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-shrink-0 bg-white border-b border-gray-100 px-6 py-2 flex items-center gap-x-5 gap-y-1 flex-wrap">
          {(Object.keys(SERVICE_COLORS) as ServiceType[]).map(type => (
            <div key={type} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: SERVICE_COLORS[type].bg }} />
              <span className="text-xs text-gray-500">{SERVICE_LABELS[type]}</span>
            </div>
          ))}
          <div className="w-px h-3 bg-gray-200 mx-1" />
          {Object.entries(STATUS_BORDER).map(([status, color]) => (
            <div key={status} className="flex items-center gap-1.5">
              <div className="w-0.5 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs text-gray-400">{status.replace('_', ' ')}</span>
            </div>
          ))}
          {loading && <span className="ml-auto text-xs text-gray-400">Loading…</span>}
        </div>

        {/* Calendar body */}
        <div className="flex-1 overflow-hidden">
          {view === 'day' ? (
            <DayView
              appointments={appointments}
              date={selectedDate}
              onApptClick={setModalAppt}
            />
          ) : (
            <WeekView
              appointments={appointments}
              weekStart={weekStart}
              onDayClick={(d) => { setSelectedDate(d); setView('day') }}
              onApptClick={setModalAppt}
            />
          )}
        </div>
      </main>

      {/* Appointment detail modal */}
      {modalAppt && (
        <AppointmentModal
          appt={modalAppt}
          onClose={() => setModalAppt(null)}
          onUpdate={handleApptUpdate}
        />
      )}
    </div>
  )
}
