'use client'

import { useEffect, useState } from 'react'
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import { Users, Calendar, DollarSign, Clock } from 'lucide-react'
import { getServiceColors, SERVICE_LABELS, type ServiceType } from '@/lib/service-colors'
import { parseUTC, formatLocalTime } from '@/lib/time'
import AppointmentModal from '@/components/AppointmentModal'
import type { AppointmentFull } from '@/components/DayView'

interface Stats {
  totalClients: number
  todayAppointments: number
  monthRevenue: number
  pendingCheckins: number
}

// Status badge styling
const STATUS_BADGE: Record<string, string> = {
  completed:  'bg-green-100 text-green-700',
  checked_in: 'bg-blue-100 text-blue-700',
  no_show:    'bg-red-100 text-red-700',
  cancelled:  'bg-gray-100 text-gray-600',
  scheduled:  'bg-yellow-100 text-yellow-700',
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ totalClients: 0, todayAppointments: 0, monthRevenue: 0, pendingCheckins: 0 })
  const [todayAppts, setTodayAppts] = useState<AppointmentFull[]>([])
  const [loading, setLoading] = useState(true)
  const [modalAppt, setModalAppt] = useState<AppointmentFull | null>(null)

  useEffect(() => {
    async function loadData() {
      const supabase = createClient()
      const now = new Date()

      // UTC-correct day boundaries (startOfDay/endOfDay return local midnight,
      // toISOString() converts to UTC — matches the calendar's timezone logic)
      const dayStart = startOfDay(now).toISOString()
      const dayEnd   = endOfDay(now).toISOString()
      const monthStart = startOfMonth(now).toISOString()
      const monthEnd   = endOfMonth(now).toISOString()

      const [clientsRes, todayCountRes, revenueRes, pendingRes, apptRes] = await Promise.all([
        // Total clients
        supabase.from('crm_clients').select('id', { count: 'exact', head: true }),

        // Today's appointment count
        supabase.from('crm_appointments')
          .select('id', { count: 'exact', head: true })
          .gte('scheduled_at', dayStart)
          .lte('scheduled_at', dayEnd)
          .neq('status', 'cancelled'),

        // Month revenue — sum amount_paid where paid_at is this month
        supabase.from('crm_appointments')
          .select('amount_paid')
          .gte('paid_at', monthStart)
          .lte('paid_at', monthEnd)
          .eq('status', 'completed')
          .not('amount_paid', 'is', null),

        // Pending check-ins — scheduled today but not yet checked in / completed
        supabase.from('crm_appointments')
          .select('id', { count: 'exact', head: true })
          .gte('scheduled_at', dayStart)
          .lte('scheduled_at', dayEnd)
          .eq('status', 'scheduled'),

        // Full appointment rows for today's list + modal
        supabase.from('crm_appointments')
          .select('id, client_id, scheduled_at, service_type, status, chair_number, notes, amount_paid, payment_method, crm_clients(first_name, last_name)')
          .gte('scheduled_at', dayStart)
          .lte('scheduled_at', dayEnd)
          .neq('status', 'cancelled')
          .order('scheduled_at'),
      ])

      const monthRevenue = ((revenueRes.data ?? []) as { amount_paid: number }[])
        .reduce((sum, a) => sum + (a.amount_paid ?? 0), 0)

      setStats({
        totalClients:      clientsRes.count ?? 0,
        todayAppointments: todayCountRes.count ?? 0,
        monthRevenue,
        pendingCheckins:   pendingRes.count ?? 0,
      })

      // Sort by local time (parseUTC handles all Supabase timestamp formats)
      const sorted = ((apptRes.data ?? []) as AppointmentFull[]).sort(
        (a, b) => parseUTC(a.scheduled_at).getTime() - parseUTC(b.scheduled_at).getTime()
      )
      setTodayAppts(sorted)
      setLoading(false)
    }

    loadData()
  }, [])

  function handleApptUpdate(updated: AppointmentFull) {
    setTodayAppts(prev => prev.map(a => a.id === updated.id ? updated : a))
    setModalAppt(updated)
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{getGreeting()} 👋</h1>
        <p className="text-gray-500 mt-1">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Clients',         value: stats.totalClients,                              icon: Users,       color: '#47A1A0' },
          { label: "Today's Appointments",  value: stats.todayAppointments,                         icon: Calendar,    color: '#1a2332' },
          { label: 'Month Revenue',         value: `$${stats.monthRevenue.toFixed(2)}`,             icon: DollarSign,  color: '#FEB74B' },
          { label: 'Pending Check-ins',     value: stats.pendingCheckins,                           icon: Clock,       color: '#6366f1' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4">
            <div className="p-3 rounded-lg" style={{ backgroundColor: color + '20' }}>
              <Icon size={20} style={{ color }} />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">{label}</p>
              <p className="text-2xl font-bold text-gray-900">{loading ? '…' : value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Today's Appointments */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Today&apos;s Appointments</h2>
        {loading ? (
          <p className="text-gray-400 text-sm">Loading…</p>
        ) : todayAppts.length === 0 ? (
          <p className="text-gray-400 text-sm">No appointments scheduled for today 🦷</p>
        ) : (
          <div className="space-y-2">
            {todayAppts.map(appt => {
              const { bg } = getServiceColors(appt.service_type)
              const label = SERVICE_LABELS[appt.service_type as ServiceType] ?? appt.service_type
              const clientName = appt.crm_clients
                ? `${appt.crm_clients.first_name} ${appt.crm_clients.last_name}`
                : 'Unknown Client'

              return (
                <button
                  key={appt.id}
                  onClick={() => setModalAppt(appt)}
                  className="w-full flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 hover:bg-gray-100 active:bg-gray-200 transition-colors text-left border border-gray-100"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: bg }} />
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{clientName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatLocalTime(appt.scheduled_at)} · {label}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ml-3 ${STATUS_BADGE[appt.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {appt.status.replace('_', ' ')}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3">
        <Link href="/checkin" className="px-4 py-2.5 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: '#47A1A0' }}>
          + Check In Client
        </Link>
        <Link href="/appointments/new" className="px-4 py-2.5 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: '#1a2332' }}>
          + New Appointment
        </Link>
        <Link href="/clients" className="px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50">
          View All Clients
        </Link>
      </div>

      {/* Appointment modal */}
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
