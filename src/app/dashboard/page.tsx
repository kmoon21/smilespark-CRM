'use client'

import { useEffect, useState } from 'react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import { Users, Calendar, DollarSign, Clock } from 'lucide-react'

interface Appointment {
  id: string
  scheduled_at: string
  service_type: string
  status: string
  notes: string | null
  crm_clients: { first_name: string; last_name: string } | null
}

interface Stats {
  totalClients: number
  todayAppointments: number
  monthRevenue: number
  pendingCheckins: number
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

const serviceColors: Record<string, string> = {
  '90min': 'border-green-400',
  '60min': 'border-teal-400',
  '30min': 'border-yellow-400',
}

export default function DashboardPage() {
  const supabase = createClient()
  const [stats, setStats] = useState<Stats>({ totalClients: 0, todayAppointments: 0, monthRevenue: 0, pendingCheckins: 0 })
  const [todayAppts, setTodayAppts] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      const today = new Date()
      const todayStr = format(today, 'yyyy-MM-dd')
      const monthStart = startOfMonth(today).toISOString()
      const monthEnd = endOfMonth(today).toISOString()

      const [clientsRes, todayRes, revenueRes, pendingRes] = await Promise.all([
        supabase.from('crm_clients').select('id', { count: 'exact', head: true }),
        supabase.from('crm_appointments')
          .select('*', { count: 'exact', head: true })
          .gte('scheduled_at', `${todayStr}T00:00:00`)
          .lte('scheduled_at', `${todayStr}T23:59:59`),
        supabase.from('crm_appointments')
          .select('amount_paid')
          .gte('paid_at', monthStart)
          .lte('paid_at', monthEnd)
          .eq('status', 'completed'),
        supabase.from('crm_appointments')
          .select('id', { count: 'exact', head: true })
          .gte('scheduled_at', `${todayStr}T00:00:00`)
          .lte('scheduled_at', `${todayStr}T23:59:59`)
          .eq('status', 'scheduled'),
      ])

      const monthRevenue = (revenueRes.data ?? []).reduce((sum: number, a: { amount_paid: number | null }) => sum + (a.amount_paid ?? 0), 0)

      setStats({
        totalClients: clientsRes.count ?? 0,
        todayAppointments: todayRes.count ?? 0,
        monthRevenue,
        pendingCheckins: pendingRes.count ?? 0,
      })

      const apptRes = await supabase
        .from('crm_appointments')
        .select('*, crm_clients(first_name, last_name)')
        .gte('scheduled_at', `${todayStr}T00:00:00`)
        .lte('scheduled_at', `${todayStr}T23:59:59`)
        .order('scheduled_at')

      setTodayAppts((apptRes.data as Appointment[]) ?? [])
      setLoading(false)
    }

    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{getGreeting()} 👋</h1>
        <p className="text-gray-500 mt-1">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Clients', value: stats.totalClients, icon: Users, color: '#47A1A0' },
          { label: "Today's Appointments", value: stats.todayAppointments, icon: Calendar, color: '#1a2332' },
          { label: 'Month Revenue', value: `$${stats.monthRevenue.toFixed(2)}`, icon: DollarSign, color: '#FEB74B' },
          { label: 'Pending Check-ins', value: stats.pendingCheckins, icon: Clock, color: '#6366f1' },
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
          <div className="space-y-3">
            {todayAppts.map((appt) => (
              <div
                key={appt.id}
                className={`border-l-4 ${serviceColors[appt.service_type] ?? 'border-gray-300'} bg-gray-50 rounded-r-lg px-4 py-3 flex items-center justify-between`}
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {appt.crm_clients ? `${appt.crm_clients.first_name} ${appt.crm_clients.last_name}` : 'Unknown Client'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {format(new Date(appt.scheduled_at), 'h:mm a')} · {appt.service_type}
                  </p>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  appt.status === 'completed' ? 'bg-green-100 text-green-700' :
                  appt.status === 'checked_in' ? 'bg-blue-100 text-blue-700' :
                  appt.status === 'no_show' ? 'bg-red-100 text-red-700' :
                  appt.status === 'cancelled' ? 'bg-gray-100 text-gray-600' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {appt.status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3">
        <Link href="/clients/new" className="px-4 py-2.5 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: '#47A1A0' }}>
          + New Client
        </Link>
        <Link href="/appointments/new" className="px-4 py-2.5 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: '#1a2332' }}>
          + New Appointment
        </Link>
        <Link href="/clients" className="px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50">
          View All Clients
        </Link>
      </div>
    </div>
  )
}
