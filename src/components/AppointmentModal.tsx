'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { X, Check, UserX, Ban, ExternalLink, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import { getServiceColors, getStatusBorder, SERVICE_COLORS, SERVICE_LABELS, type ServiceType } from '@/lib/service-colors'
import { formatLocalTime } from '@/lib/time'
import { SERVICE_DURATION_MINUTES } from '@/lib/capacity'
import type { AppointmentFull } from './DayView'

const SERVICE_OPTIONS: ServiceType[] = ['30min', '60min', '90min', 'brand_ambassador', 'family_friends']

const DEFAULT_PRICES: Record<string, number> = {
  '30min':          99,
  '60min':          175,
  '90min':          225,
  brand_ambassador: 175,
  family_friends:   99,
}

const PAYMENT_METHODS = ['Cash', 'Card', 'Square', 'Comp', 'Package'] as const
type PaymentMethod = typeof PAYMENT_METHODS[number]

const STATUS_LABELS: Record<string, string> = {
  scheduled:  'Scheduled',
  checked_in: 'Checked In',
  completed:  'Completed',
  no_show:    'No Show',
  cancelled:  'Cancelled',
}

function formatDate(scheduledAt: string) {
  // parseUTC-equivalent inline (avoid importing to keep modal self-contained)
  let s = scheduledAt.trim()
  if (s[10] === ' ') s = s.slice(0, 10) + 'T' + s.slice(11)
  s = s.replace(/\+00:00$/, 'Z').replace(/\+00$/, 'Z')
  if (!s.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(s)) s += 'Z'
  const d = new Date(s)
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

export default function AppointmentModal({
  appt,
  onClose,
  onUpdate,
}: {
  appt: AppointmentFull
  onClose: () => void
  onUpdate: (updated: AppointmentFull) => void
}) {
  const [status, setStatus] = useState(appt.status)
  const [serviceType, setServiceType] = useState<ServiceType>(appt.service_type as ServiceType)
  const [serviceOpen, setServiceOpen] = useState(false)
  const [savingService, setSavingService] = useState(false)
  const [notes, setNotes] = useState(appt.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [savingStatus, setSavingStatus] = useState<string | null>(null)
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const serviceRef = useRef<HTMLDivElement>(null)

  // Payment state
  const [amountPaid, setAmountPaid] = useState<number | null>(appt.amount_paid ?? null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    (appt.payment_method as PaymentMethod | null) ?? 'Card'
  )
  const [amountInput, setAmountInput] = useState(
    appt.amount_paid != null
      ? appt.amount_paid.toFixed(2)
      : (DEFAULT_PRICES[appt.service_type] ?? 175).toFixed(2)
  )
  const [editingPayment, setEditingPayment] = useState(false)
  const [savingPayment, setSavingPayment] = useState(false)

  // Close service picker on outside click
  useEffect(() => {
    if (!serviceOpen) return
    function onOutside(e: MouseEvent) {
      if (serviceRef.current && !serviceRef.current.contains(e.target as Node)) {
        setServiceOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [serviceOpen])

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function updateStatus(newStatus: string) {
    setSavingStatus(newStatus)
    const supabase = createClient()
    const { error } = await supabase
      .from('crm_appointments')
      .update({ status: newStatus } as never)
      .eq('id', appt.id)
    if (!error) {
      setStatus(newStatus)
      onUpdate({ ...appt, status: newStatus, notes })
    }
    setSavingStatus(null)
  }

  async function updateService(newType: ServiceType) {
    if (newType === serviceType) { setServiceOpen(false); return }
    setSavingService(true)
    setServiceOpen(false)
    const supabase = createClient()
    const { error } = await supabase
      .from('crm_appointments')
      .update({ service_type: newType } as never)
      .eq('id', appt.id)
    if (!error) {
      setServiceType(newType)
      onUpdate({ ...appt, service_type: newType, status, notes })
    }
    setSavingService(false)
  }

  async function saveNotes(value: string) {
    setSaving(true)
    const supabase = createClient()
    await supabase
      .from('crm_appointments')
      .update({ notes: value || null } as never)
      .eq('id', appt.id)
    onUpdate({ ...appt, status, notes: value })
    setSaving(false)
  }

  async function savePayment() {
    const amount = parseFloat(amountInput)
    if (isNaN(amount) || amount < 0) return
    setSavingPayment(true)
    const supabase = createClient()
    await supabase
      .from('crm_appointments')
      .update({
        amount_paid: amount,
        payment_method: paymentMethod,
        paid_at: new Date().toISOString(),
      } as never)
      .eq('id', appt.id)
    setAmountPaid(amount)
    setEditingPayment(false)
    onUpdate({ ...appt, service_type: serviceType, status, notes, amount_paid: amount, payment_method: paymentMethod })
    setSavingPayment(false)
  }

  function handleNotesChange(value: string) {
    setNotes(value)
    if (notesTimer.current) clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(() => saveNotes(value), 1000)
  }

  const { bg } = getServiceColors(serviceType)
  const borderColor = getStatusBorder(status)
  const duration = SERVICE_DURATION_MINUTES[serviceType] ?? 60
  const clientName = appt.crm_clients
    ? `${appt.crm_clients.first_name} ${appt.crm_clients.last_name}`
    : 'Unknown'

  const isTerminal = status === 'completed' || status === 'cancelled'

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md pointer-events-auto overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Color header strip — service type */}
          <div className="h-2" style={{ backgroundColor: bg }} />

          <div className="px-6 py-5">
            {/* Header row */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2.5 h-5 rounded-full" style={{ backgroundColor: borderColor }} />
                  <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: borderColor }}>
                    {STATUS_LABELS[status] ?? status}
                  </span>
                </div>
                <h2 className="text-xl font-bold" style={{ color: '#1a2332' }}>{clientName}</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors -mt-1 -mr-1"
              >
                <X size={20} />
              </button>
            </div>

            {/* Details grid */}
            <div className="space-y-3 mb-5">
              {/* Service — tappable picker */}
              <div className="relative py-2.5 border-b border-gray-100" ref={serviceRef}>
                <button
                  onClick={() => setServiceOpen(o => !o)}
                  disabled={savingService}
                  className="w-full flex items-center justify-between hover:bg-gray-50 rounded-lg px-1 -mx-1 transition-colors disabled:opacity-50"
                >
                  <span className="text-sm text-gray-400">Service</span>
                  <div className="flex items-center gap-2">
                    {savingService
                      ? <span className="text-xs text-gray-400">saving…</span>
                      : <>
                          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: bg }} />
                          <span className="text-sm font-semibold" style={{ color: '#1a2332' }}>
                            {SERVICE_LABELS[serviceType]}
                            <span className="font-normal text-gray-400 ml-1">· {duration} min</span>
                          </span>
                          <ChevronDown size={14} className="text-gray-400" />
                        </>
                    }
                  </div>
                </button>

                {serviceOpen && (
                  <div className="absolute right-0 top-full mt-1 z-10 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden w-64">
                    {SERVICE_OPTIONS.map(type => {
                      const { bg: optBg } = SERVICE_COLORS[type]
                      const selected = type === serviceType
                      return (
                        <button
                          key={type}
                          onClick={() => updateService(type)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 text-left"
                          style={selected ? { backgroundColor: optBg + '18' } : {}}
                        >
                          <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: optBg }} />
                          <div className="flex-1">
                            <p className="text-sm font-semibold" style={{ color: '#1a2332' }}>
                              {SERVICE_LABELS[type]}
                            </p>
                            <p className="text-xs text-gray-400">
                              {SERVICE_DURATION_MINUTES[type]} min
                            </p>
                          </div>
                          {selected && <Check size={14} style={{ color: '#47A1A0' }} />}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Date */}
              <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
                <span className="text-sm text-gray-400">Date</span>
                <span className="text-sm font-semibold" style={{ color: '#1a2332' }}>
                  {formatDate(appt.scheduled_at)}
                </span>
              </div>

              {/* Time */}
              <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
                <span className="text-sm text-gray-400">Time</span>
                <span className="text-sm font-semibold" style={{ color: '#1a2332' }}>
                  {formatLocalTime(appt.scheduled_at)}
                </span>
              </div>

              {/* Chair */}
              {appt.chair_number && (
                <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
                  <span className="text-sm text-gray-400">Chair</span>
                  <span className="text-sm font-semibold" style={{ color: '#1a2332' }}>
                    Chair {appt.chair_number}
                  </span>
                </div>
              )}

              {/* Client profile link */}
              {appt.client_id && (
                <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
                  <span className="text-sm text-gray-400">Profile</span>
                  <Link
                    href={`/clients/${appt.client_id}`}
                    className="text-sm font-semibold flex items-center gap-1 hover:underline"
                    style={{ color: '#47A1A0' }}
                    onClick={onClose}
                  >
                    View client <ExternalLink size={13} />
                  </Link>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="mb-5">
              <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
                Notes {saving && <span className="normal-case font-normal tracking-normal ml-1 text-gray-300">saving…</span>}
              </label>
              <textarea
                value={notes}
                onChange={e => handleNotesChange(e.target.value)}
                rows={3}
                placeholder="Add notes…"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none bg-gray-50"
              />
            </div>

            {/* Payment — only when completed */}
            {status === 'completed' && (
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                    Payment
                  </label>
                  {amountPaid != null && !editingPayment && (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1">
                      <Check size={11} />
                      Paid · ${amountPaid.toFixed(2)} · {paymentMethod}
                    </span>
                  )}
                </div>

                {(amountPaid == null || editingPayment) ? (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">Amount ($)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={amountInput}
                          onChange={e => setAmountInput(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">Method</label>
                        <select
                          value={paymentMethod}
                          onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
                        >
                          {PAYMENT_METHODS.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={savePayment}
                        disabled={savingPayment}
                        className="flex-1 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50 transition-opacity"
                        style={{ backgroundColor: '#47A1A0' }}
                      >
                        {savingPayment ? 'Saving…' : 'Save Payment'}
                      </button>
                      {editingPayment && (
                        <button
                          onClick={() => setEditingPayment(false)}
                          className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditingPayment(true)}
                    className="w-full text-left text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors"
                  >
                    Edit payment
                  </button>
                )}
              </div>
            )}

            {/* Status action buttons */}
            {!isTerminal && (
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => updateStatus('completed')}
                  disabled={savingStatus !== null || status === 'completed'}
                  className="flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 border-green-200 bg-green-50 hover:bg-green-100 active:scale-[0.97] transition-all disabled:opacity-40"
                >
                  <Check size={18} className="text-green-600" />
                  <span className="text-xs font-semibold text-green-700">
                    {savingStatus === 'completed' ? '…' : 'Completed'}
                  </span>
                </button>

                <button
                  onClick={() => updateStatus('no_show')}
                  disabled={savingStatus !== null || status === 'no_show'}
                  className="flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 border-red-200 bg-red-50 hover:bg-red-100 active:scale-[0.97] transition-all disabled:opacity-40"
                >
                  <UserX size={18} className="text-red-600" />
                  <span className="text-xs font-semibold text-red-700">
                    {savingStatus === 'no_show' ? '…' : 'No Show'}
                  </span>
                </button>

                <button
                  onClick={() => updateStatus('cancelled')}
                  disabled={savingStatus !== null || status === 'cancelled'}
                  className="flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 border-gray-200 bg-gray-50 hover:bg-gray-100 active:scale-[0.97] transition-all disabled:opacity-40"
                >
                  <Ban size={18} className="text-gray-500" />
                  <span className="text-xs font-semibold text-gray-600">
                    {savingStatus === 'cancelled' ? '…' : 'Cancel'}
                  </span>
                </button>
              </div>
            )}

            {isTerminal && (
              <div className="text-center py-2 text-sm text-gray-400">
                This appointment is <span className="font-semibold">{STATUS_LABELS[status]}</span>.
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
