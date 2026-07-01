'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ArrowLeft, Search, X } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import { findAvailableChair } from '@/lib/capacity'
import { SERVICE_COLORS, SERVICE_LABELS, type ServiceType } from '@/lib/service-colors'

type Client = { id: string; first_name: string; last_name: string; phone: string | null }

const SERVICE_OPTIONS: { type: ServiceType; desc: string }[] = [
  { type: '30min',          desc: '30-minute session' },
  { type: '60min',          desc: '60-minute session' },
  { type: '90min',          desc: '90-minute session' },
  { type: 'brand_ambassador', desc: 'Complimentary — brand ambassador' },
  { type: 'family_friends', desc: 'Discounted — family & friends' },
]

// 9:00 AM – 7:30 PM in 30-min increments
const TIME_OPTIONS: { label: string; value: string }[] = []
for (let h = 9; h < 20; h++) {
  for (const m of [0, 30]) {
    if (h === 19 && m === 30) break
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
    const ampm = h >= 12 ? 'PM' : 'AM'
    TIME_OPTIONS.push({
      label: `${h12}:${m === 0 ? '00' : '30'} ${ampm}`,
      value: `${String(h).padStart(2, '0')}:${m === 0 ? '00' : '30'}`,
    })
  }
}

const todayStr = format(new Date(), 'yyyy-MM-dd')

export default function NewAppointmentPage() {
  const router = useRouter()

  // Client search
  const [clientSearch, setClientSearch] = useState('')
  const [clientResults, setClientResults] = useState<Client[]>([])
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)

  // Appointment fields
  const [date, setDate] = useState(todayStr)
  const [time, setTime] = useState('09:00')
  const [serviceType, setServiceType] = useState<ServiceType>('60min')
  const [notes, setNotes] = useState('')

  // Submit state
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Live client search with 300ms debounce
  useEffect(() => {
    const q = clientSearch.trim()
    if (!q || selectedClient) { setClientResults([]); setShowDropdown(false); return }
    const timer = setTimeout(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('crm_clients')
        .select('id, first_name, last_name, phone')
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%`)
        .limit(8)
      setClientResults((data as Client[]) ?? [])
      setShowDropdown(true)
    }, 300)
    return () => clearTimeout(timer)
  }, [clientSearch, selectedClient])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedClient) { setError('Please select a client'); return }
    setSaving(true)
    setError(null)

    const [hh, mm] = time.split(':').map(Number)
    const scheduledAt = new Date(date)
    scheduledAt.setHours(hh, mm, 0, 0)

    const supabase = createClient()

    // Capacity check
    const availability = await findAvailableChair(supabase, scheduledAt, serviceType)
    if ('error' in availability) {
      setError(availability.error)
      setSaving(false)
      return
    }

    // Fetch studio id
    const { data: studio } = await supabase.from('crm_studios').select('id').single()
    const studioId = (studio as { id: string } | null)?.id ?? null

    const { error: err } = await supabase
      .from('crm_appointments')
      .insert({
        studio_id: studioId,
        client_id: selectedClient.id,
        service_type: serviceType,
        scheduled_at: scheduledAt.toISOString(),
        status: 'scheduled',
        chair_number: availability.chair,
        notes: notes || null,
      } as never)

    if (err) {
      setError(err.message)
      setSaving(false)
      return
    }

    router.push('/appointments')
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Simple back nav — no sidebar needed for a focused form */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto px-6 py-10">
          <button
            onClick={() => router.push('/appointments')}
            className="flex items-center gap-1.5 text-gray-400 hover:text-gray-700 transition-colors mb-8 text-sm"
          >
            <ArrowLeft size={16} />
            Back to Calendar
          </button>

          <h1 className="text-2xl font-bold mb-8" style={{ color: '#1a2332' }}>
            New Appointment
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Client search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Client <span className="text-red-400">*</span>
              </label>
              {selectedClient ? (
                <div
                  className="flex items-center justify-between bg-white border-2 rounded-xl px-4 py-3"
                  style={{ borderColor: '#47A1A0' }}
                >
                  <div>
                    <p className="font-semibold text-gray-900">
                      {selectedClient.first_name} {selectedClient.last_name}
                    </p>
                    {selectedClient.phone && (
                      <p className="text-sm text-gray-400 mt-0.5">{selectedClient.phone}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedClient(null); setClientSearch('') }}
                    className="text-gray-400 hover:text-gray-600 p-1"
                  >
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={clientSearch}
                      onChange={e => setClientSearch(e.target.value)}
                      onFocus={() => clientResults.length > 0 && setShowDropdown(true)}
                      placeholder="Search by name or phone…"
                      className="w-full border border-gray-300 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                    />
                  </div>
                  {showDropdown && clientResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
                      {clientResults.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0"
                          onClick={() => {
                            setSelectedClient(c)
                            setClientSearch('')
                            setShowDropdown(false)
                          }}
                        >
                          <p className="font-medium text-gray-900 text-sm">
                            {c.first_name} {c.last_name}
                          </p>
                          {c.phone && <p className="text-xs text-gray-400 mt-0.5">{c.phone}</p>}
                        </button>
                      ))}
                    </div>
                  )}
                  {showDropdown && clientSearch.trim() && clientResults.length === 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 px-4 py-3">
                      <p className="text-sm text-gray-400">No clients found</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Date <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={date}
                min={todayStr}
                onChange={e => setDate(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
              />
            </div>

            {/* Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Time <span className="text-red-400">*</span>
              </label>
              <select
                value={time}
                onChange={e => setTime(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
              >
                {TIME_OPTIONS.map(({ label, value }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            {/* Service type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Service <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {SERVICE_OPTIONS.map(({ type, desc }) => {
                  const selected = serviceType === type
                  const { bg, text } = SERVICE_COLORS[type]
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setServiceType(type)}
                      className="flex items-start gap-2 px-3 py-2.5 rounded-xl border-2 font-medium text-sm transition-all text-left"
                      style={{
                        borderColor: selected ? bg : '#e5e7eb',
                        backgroundColor: selected ? bg + '22' : 'white',
                        color: selected ? text : '#6b7280',
                      }}
                    >
                      <div
                        className="mt-0.5 w-3 h-3 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: selected ? bg : '#e5e7eb' }}
                      />
                      <div>
                        <p className="font-semibold leading-none">{SERVICE_LABELS[type]}</p>
                        <p className="text-xs mt-0.5 font-normal opacity-70">{desc}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Notes <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Any notes for this appointment…"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white resize-none"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-sm text-red-600 font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={saving || !selectedClient}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-50 transition-opacity"
              style={{ backgroundColor: '#47A1A0' }}
            >
              {saving ? 'Booking…' : 'Book Appointment'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
