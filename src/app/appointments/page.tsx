'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase-browser'

interface Appointment {
  id: string
  scheduled_at: string
  service_type: string
  status: string
  amount_paid: number | null
  notes: string | null
  crm_clients: { first_name: string; last_name: string } | null
}

const statusColors: Record<string, string> = {
  scheduled: 'bg-yellow-100 text-yellow-700',
  checked_in: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  no_show: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-600',
}

export default function AppointmentsPage() {
  const supabase = createClient()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('crm_appointments')
      .select('*, crm_clients(first_name, last_name)')
      .order('scheduled_at', { ascending: false })
      .then(({ data }) => {
        setAppointments((data as Appointment[]) ?? [])
        setLoading(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
        <Link
          href="/appointments/new"
          className="px-4 py-2.5 rounded-lg text-white text-sm font-medium"
          style={{ backgroundColor: '#47A1A0' }}
        >
          + New Appointment
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <p className="text-gray-400 text-sm p-6">Loading appointments…</p>
        ) : appointments.length === 0 ? (
          <p className="text-gray-400 text-sm p-6">No appointments yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-5 py-3">Client</th>
                <th className="px-5 py-3">Service</th>
                <th className="px-5 py-3">Date & Time</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Amount</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {appointments.map((appt) => (
                <tr key={appt.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-gray-900">
                    {appt.crm_clients
                      ? `${appt.crm_clients.first_name} ${appt.crm_clients.last_name}`
                      : '—'}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{appt.service_type}</td>
                  <td className="px-5 py-3 text-gray-600">
                    {format(new Date(appt.scheduled_at), 'MMM d, yyyy h:mm a')}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusColors[appt.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {appt.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-600">
                    {appt.amount_paid != null ? `$${appt.amount_paid.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-5 py-3">
                    <Link
                      href={`/appointments/${appt.id}`}
                      className="text-xs font-medium px-3 py-1.5 rounded-md border border-gray-200 hover:bg-gray-100 transition-colors"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
