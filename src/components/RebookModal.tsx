'use client'

import { useEffect, useState } from 'react'
import { addWeeks, format, getDay, setHours, setMinutes } from 'date-fns'
import { X, Check, CalendarDays, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import { findAvailableChair } from '@/lib/capacity'
import { parseUTC } from '@/lib/time'
import { SERVICE_COLORS, SERVICE_LABELS, type ServiceType } from '@/lib/service-colors'

const SERVICE_OPTIONS: ServiceType[] = ['30min', '60min', '90min', 'brand_ambassador', 'family_friends']

// 30-min time slots 9 AM – 8 PM
const TIME_SLOTS: { label: string; hour: number; minute: number }[] = Array.from(
  { length: 23 },
  (_, i) => {
    const totalMins = 9 * 60 + i * 30
    const hour = Math.floor(totalMins / 60)
    const minute = totalMins % 60
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    const ampm = hour >= 12 ? 'PM' : 'AM'
    return { label: `${h12}:${String(minute).padStart(2, '0')} ${ampm}`, hour, minute }
  }
)

const WEEK_OPTIONS = [
  { label: '4 Weeks', weeks: 4 },
  { label: '5 Weeks', weeks: 5 },
  { label: '6 Weeks', weeks: 6 },
  { label: '8 Weeks', weeks: 8 },
]

interface RebookModalProps {
  clientId: string
  clientName: string
  lastAppointment: {
    scheduled_at: string
    service_type: string
  }
  onClose: () => void
}

export default function RebookModal({ clientId, clientName, lastAppointment, onClose }: RebookModalProps) {
  const originalDate = parseUTC(lastAppointment.scheduled_at)
  const originalHour = originalDate.getHours()
  const originalMinute = originalDate.getMinutes()
  const originalDow = getDay(originalDate) // 0=Sun…6=Sat

  // Find the matching time slot index
  const defaultSlotIdx = TIME_SLOTS.findIndex(s => s.hour === originalHour && s.minute === originalMinute)

  const [serviceType, setServiceType] = useState<ServiceType>(lastAppointment.service_type as ServiceType)
  const [selectedWeeks, setSelectedWeeks] = useState<number | null>(null)
  const [customDate, setCustomDate] = useState('')
  const [slotIdx, setSlotIdx] = useState(defaultSlotIdx >= 0 ? defaultSlotIdx : 0)
  const [resolvedDate, setResolvedDate] = useState<Date | null>(null)
  const [capacityError, setCapacityError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [booked, setBooked] = useState<{ scheduledAt: Date } | null>(null)

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Resolve date whenever inputs change
  useEffect(() => {
    setCapacityError(null)
    const slot = TIME_SLOTS[slotIdx]

    if (selectedWeeks !== null) {
      // Walk forward from original date until we hit the same day-of-week
      let candidate = addWeeks(originalDate, selectedWeeks)
      // addWeeks preserves day-of-week, so we're already on the right dow
      // but snap to same dow just in case DST shifted it
      const diff = (originalDow - getDay(candidate) + 7) % 7
      candidate = new Date(candidate.getTime() + diff * 86_400_000)
      candidate = setHours(setMinutes(candidate, slot.minute), slot.hour)
      candidate.setSeconds(0, 0)
      setResolvedDate(candidate)
      setCustomDate('')
    } else if (customDate) {
      const [y, m, d] = customDate.split('-').map(Number)
      if (y && m && d) {
        const candidate = new Date(y, m - 1, d, slot.hour, slot.minute, 0, 0)
        setResolvedDate(candidate)
      } else {
        setResolvedDate(null)
      }
    } else {
      setResolvedDate(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeeks, customDate, slotIdx])

  async function handleConfirm() {
    if (!resolvedDate) return
    setChecking(true)
    setCapacityError(null)
    const supabase = createClient()
    const result = await findAvailableChair(supabase, resolvedDate, serviceType)
    if ('error' in result) {
      setCapacityError(result.error)
      setChecking(false)
      return
    }
    setSaving(true)
    setChecking(false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('crm_appointments')
      .insert({
        client_id: clientId,
        scheduled_at: resolvedDate.toISOString(),
        service_type: serviceType,
        status: 'scheduled',
        chair_number: result.chair,
      })
    setBooked({ scheduledAt: resolvedDate })
    setSaving(false)
  }

  const slot = TIME_SLOTS[slotIdx]
  const isCustomMode = selectedWeeks === null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="fixed inset-0 z-70 flex items-end sm:items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md pointer-events-auto overflow-y-auto max-h-[90vh]"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg" style={{ backgroundColor: '#47A1A020' }}>
                <CalendarDays size={18} style={{ color: '#47A1A0' }} />
              </div>
              <div>
                <h2 className="text-base font-bold" style={{ color: '#1a2332' }}>
                  Rebook {clientName}
                </h2>
                <p className="text-xs text-gray-400">Same time, new date</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {booked ? (
            /* ── Success state ── */
            <div className="px-6 py-10 text-center">
              <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-4"
                style={{ backgroundColor: '#47A1A020' }}>
                <Check size={26} style={{ color: '#47A1A0' }} />
              </div>
              <p className="text-lg font-bold text-gray-900 mb-1">Booked!</p>
              <p className="text-sm text-gray-500 mb-6">
                {format(booked.scheduledAt, 'EEEE, MMMM d')} at {format(booked.scheduledAt, 'h:mm a')}
              </p>
              <a
                href={`/appointments?date=${format(booked.scheduledAt, 'yyyy-MM-dd')}`}
                className="inline-flex items-center gap-1.5 text-sm font-semibold hover:underline"
                style={{ color: '#47A1A0' }}
              >
                View on calendar <ExternalLink size={13} />
              </a>
            </div>
          ) : (
            <div className="px-6 py-5 space-y-5">

              {/* Service picker */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
                  Service
                </label>
                <div className="grid grid-cols-1 gap-1.5">
                  {SERVICE_OPTIONS.map(type => {
                    const { bg } = SERVICE_COLORS[type]
                    const selected = type === serviceType
                    return (
                      <button
                        key={type}
                        onClick={() => setServiceType(type)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all text-left"
                        style={selected
                          ? { borderColor: '#47A1A0', backgroundColor: '#47A1A008' }
                          : { borderColor: '#e5e7eb', backgroundColor: 'white' }}
                      >
                        <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: bg }} />
                        <span className="text-sm font-medium" style={{ color: '#1a2332' }}>
                          {SERVICE_LABELS[type]}
                        </span>
                        {selected && <Check size={14} className="ml-auto" style={{ color: '#47A1A0' }} />}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Quick week options */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
                  When
                </label>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {WEEK_OPTIONS.map(({ label, weeks }) => (
                    <button
                      key={weeks}
                      onClick={() => { setSelectedWeeks(weeks); setCustomDate('') }}
                      className="py-3 rounded-xl border-2 text-sm font-semibold transition-all"
                      style={selectedWeeks === weeks
                        ? { borderColor: '#47A1A0', backgroundColor: '#47A1A0', color: 'white' }
                        : { borderColor: '#e5e7eb', backgroundColor: 'white', color: '#374151' }}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Custom date */}
                <button
                  onClick={() => { setSelectedWeeks(null); setCustomDate('') }}
                  className="w-full text-left px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all mb-2"
                  style={isCustomMode
                    ? { borderColor: '#47A1A0', backgroundColor: '#47A1A008', color: '#1a2332' }
                    : { borderColor: '#e5e7eb', backgroundColor: 'white', color: '#6b7280' }}
                >
                  Custom date
                </button>
                {isCustomMode && (
                  <input
                    type="date"
                    value={customDate}
                    onChange={e => setCustomDate(e.target.value)}
                    min={format(new Date(), 'yyyy-MM-dd')}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                )}
              </div>

              {/* Time picker */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
                  Time
                </label>
                <select
                  value={slotIdx}
                  onChange={e => setSlotIdx(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
                >
                  {TIME_SLOTS.map((s, i) => (
                    <option key={i} value={i}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* Resolved date preview */}
              {resolvedDate && (
                <div
                  className="rounded-xl px-4 py-3 text-sm font-semibold text-center"
                  style={{ backgroundColor: '#47A1A010', color: '#1a2332', border: '1px solid #47A1A040' }}
                >
                  {format(resolvedDate, 'EEEE, MMMM d')} at {slot.label}
                </div>
              )}

              {/* Capacity error */}
              {capacityError && (
                <div className="rounded-xl px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-200">
                  {capacityError}
                </div>
              )}

              {/* Confirm */}
              <button
                onClick={handleConfirm}
                disabled={!resolvedDate || checking || saving}
                className="w-full py-3.5 rounded-xl text-white text-sm font-bold disabled:opacity-40 transition-opacity"
                style={{ backgroundColor: '#1a2332' }}
              >
                {checking ? 'Checking availability…' : saving ? 'Booking…' : 'Confirm Booking'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
