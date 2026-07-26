'use client'

import { useState, useEffect } from 'react'
import {
  format, addDays, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval,
  isBefore, isAfter, isToday, addMonths, subMonths,
  isSameDay, isSameMonth,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import { SERVICE_DURATION_MINUTES, findAvailableChair } from '@/lib/capacity'

const TEAL = '#47A1A0'
const GOLD  = '#FEB74B'
const NAVY  = '#1a2332'

const TODAY    = new Date()
const MAX_DATE = addDays(TODAY, 60)

// ─── Service definitions ──────────────────────────────────────────────────────

type BookableId = '30min' | '60min' | '90min'

type BookableService = {
  id: BookableId
  label: string
  duration: string
  price: string
}

const BOOKABLE: BookableService[] = [
  { id: '30min', label: 'Express',  duration: '30 min', price: '$99'  },
  { id: '60min', label: 'Standard', duration: '60 min', price: '$175' },
  { id: '90min', label: 'Premium',  duration: '90 min', price: '$225' },
]

const CONTACT_SERVICES = [
  { label: 'Brand Ambassador', desc: 'Complimentary brand program' },
  { label: 'Family & Friends', desc: 'Special pricing available' },
]

// ─── Time slots: 9 AM – 8 PM in 30-min increments ────────────────────────────

type TimeSlot = { label: string; hour: number; minute: number }

const TIME_SLOTS: TimeSlot[] = []
for (let h = 9; h <= 20; h++) {
  for (const m of [0, 30]) {
    if (h === 20 && m === 30) break
    const h12  = h > 12 ? h - 12 : h === 0 ? 12 : h
    const ampm = h >= 12 ? 'PM' : 'AM'
    TIME_SLOTS.push({ label: `${h12}:${m === 0 ? '00' : '30'} ${ampm}`, hour: h, minute: m })
  }
}

// ─── Slot availability helper (no DB call — uses pre-fetched day appointments) ─

type DayAppt = { scheduled_at: string; service_type: string; chair_number: number | null }

function slotAvailable(hour: number, minute: number, date: Date, serviceId: string, appts: DayAppt[]): boolean {
  const slotMs = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, 0, 0).getTime()
  const durMs  = (SERVICE_DURATION_MINUTES[serviceId] ?? 60) * 60_000
  const propEnd = slotMs + durMs
  const taken   = new Set<number>()
  for (const a of appts) {
    const s = new Date(a.scheduled_at).getTime()
    const d = (SERVICE_DURATION_MINUTES[a.service_type] ?? 60) * 60_000
    if (s < propEnd && s + d > slotMs) taken.add(a.chair_number ?? 1)
  }
  return !taken.has(1) || !taken.has(2)
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4 | 'success'

// ─── Main component ───────────────────────────────────────────────────────────

export default function BookPage() {
  const [step, setStep] = useState<Step>(1)

  // Step 1 — service
  const [service, setService] = useState<BookableService | null>(null)

  // Step 2 — date + time
  const [calMonth,    setCalMonth]    = useState(() => new Date(TODAY.getFullYear(), TODAY.getMonth(), 1))
  const [selDate,     setSelDate]     = useState<Date | null>(null)
  const [selSlot,     setSelSlot]     = useState<TimeSlot | null>(null)
  const [dayAppts,    setDayAppts]    = useState<DayAppt[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)

  // Step 3 — client info
  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [phone,     setPhone]     = useState('')
  const [email,     setEmail]     = useState('')
  const [birthday,  setBirthday]  = useState('')
  const [refCode,   setRefCode]   = useState('')
  const [agreed,    setAgreed]    = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Step 4 — confirm / submit
  const [submitting,   setSubmitting]   = useState(false)
  const [submitError,  setSubmitError]  = useState<string | null>(null)
  const [confirmedDate, setConfirmedDate] = useState<string | null>(null)

  // ─── Fetch day appointments whenever date or service changes ─────────────────

  useEffect(() => {
    if (!selDate || !service) return
    setLoadingSlots(true)
    setSelSlot(null)
    const supabase = createClient()
    const d = selDate
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
    const dayEnd   = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
    supabase
      .from('crm_appointments')
      .select('scheduled_at, service_type, chair_number')
      .neq('status', 'cancelled')
      .neq('status', 'no_show')
      .gte('scheduled_at', dayStart.toISOString())
      .lte('scheduled_at', dayEnd.toISOString())
      .then(({ data }) => {
        setDayAppts((data ?? []) as DayAppt[])
        setLoadingSlots(false)
      })
  }, [selDate, service])

  // ─── Calendar grid ────────────────────────────────────────────────────────────

  const calDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(calMonth), { weekStartsOn: 0 }),
    end:   endOfWeek(endOfMonth(calMonth),   { weekStartsOn: 0 }),
  })

  function dayDisabled(day: Date): boolean {
    const d = new Date(day.getFullYear(), day.getMonth(), day.getDate())
    const t = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate())
    return isBefore(d, t) || isAfter(d, MAX_DATE)
  }

  function selectDate(day: Date) {
    setSelDate(new Date(day.getFullYear(), day.getMonth(), day.getDate()))
    setSelSlot(null)
  }

  // ─── Step 3 validation ────────────────────────────────────────────────────────

  function validateStep3(): boolean {
    if (!firstName.trim()) { setFormError('First name is required');        return false }
    if (!lastName.trim())  { setFormError('Last name is required');         return false }
    if (!phone.trim())     { setFormError('Phone number is required');      return false }
    if (!agreed)           { setFormError('Please agree to the cancellation policy'); return false }
    setFormError(null)
    return true
  }

  // ─── Final booking submission ─────────────────────────────────────────────────

  async function handleConfirm() {
    if (!service || !selDate || !selSlot) return
    setSubmitting(true)
    setSubmitError(null)

    const supabase = createClient()
    const scheduledAt = new Date(
      selDate.getFullYear(), selDate.getMonth(), selDate.getDate(),
      selSlot.hour, selSlot.minute, 0, 0,
    )

    // Final capacity check (race-condition guard)
    const availability = await findAvailableChair(supabase, scheduledAt, service.id)
    if ('error' in availability) {
      setSubmitError('This time slot was just taken. Please go back and choose another time.')
      setSubmitting(false)
      return
    }

    // Studio id
    const { data: studio } = await supabase.from('crm_studios').select('id').single()
    const studioId = (studio as { id: string } | null)?.id ?? null

    // Find or create client by phone (exact match)
    let clientId: string | null = null
    const { data: existing } = await supabase
      .from('crm_clients')
      .select('id')
      .eq('phone', phone.trim())
      .limit(1)

    if (existing && existing.length > 0) {
      clientId = (existing[0] as { id: string }).id
    } else {
      // Resolve referral code → client
      let referredById: string | null = null
      if (refCode.trim()) {
        const { data: referrer } = await supabase
          .from('crm_clients')
          .select('id')
          .ilike('referral_code', refCode.trim())
          .maybeSingle()
        if (referrer) referredById = (referrer as { id: string }).id
      }

      const { data: newClient, error: clientErr } = await supabase
        .from('crm_clients')
        .insert({
          studio_id:              studioId,
          first_name:             firstName.trim(),
          last_name:              lastName.trim(),
          phone:                  phone.trim(),
          email:                  email.trim() || null,
          birthday:               birthday || null,
          referred_by_client_id:  referredById,
        } as never)
        .select('id')
        .single()

      if (clientErr || !newClient) {
        setSubmitError('Unable to save your info. Please try again.')
        setSubmitting(false)
        return
      }
      clientId = (newClient as { id: string }).id

      // Log referral record
      if (referredById && clientId) {
        await supabase.from('crm_referrals').insert({
          referrer_client_id:  referredById,
          referred_client_id:  clientId,
          code_used:           refCode.trim().toUpperCase(),
        } as never)
      }
    }

    // Create appointment
    const notes = refCode.trim()
      ? `Booked online. Referral: ${refCode.trim()}`
      : 'Booked online'

    const { data: appt, error: apptErr } = await supabase
      .from('crm_appointments')
      .insert({
        studio_id:    studioId,
        client_id:    clientId,
        service_type: service.id,
        scheduled_at: scheduledAt.toISOString(),
        status:       'scheduled',
        chair_number: availability.chair,
        notes,
      } as never)
      .select('id')
      .single()

    if (apptErr || !appt) {
      setSubmitError('Unable to complete your booking. Please try again.')
      setSubmitting(false)
      return
    }

    setConfirmedDate(scheduledAt.toISOString())
    setStep('success')
    setSubmitting(false)
  }

  // ─── Success screen ───────────────────────────────────────────────────────────

  if (step === 'success' && service && selDate && selSlot) {
    return (
      <div style={{ backgroundColor: '#f8fafb', minHeight: '100vh' }}>
        <BookHeader />
        <div className="max-w-lg mx-auto px-4 pt-12 pb-16 text-center">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ backgroundColor: `${TEAL}20` }}
          >
            <Check size={36} strokeWidth={3} style={{ color: TEAL }} />
          </div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: NAVY }}>You&apos;re booked!</h1>
          <p className="text-gray-500 mb-8">We can&apos;t wait to see you, {firstName}.</p>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100 text-left mb-8">
            <SummaryRow label="Service">
              <p className="font-bold" style={{ color: NAVY }}>{service.label}</p>
              <p className="text-gray-500 text-sm">{service.duration} · {service.price}</p>
            </SummaryRow>
            <SummaryRow label="Date & Time">
              <p className="font-bold" style={{ color: NAVY }}>{format(selDate, 'EEEE, MMMM d, yyyy')}</p>
              <p className="text-gray-500 text-sm">{selSlot.label}</p>
            </SummaryRow>
            <SummaryRow label="Name">
              <p className="font-bold" style={{ color: NAVY }}>{firstName} {lastName}</p>
              <p className="text-gray-500 text-sm">{phone}</p>
            </SummaryRow>
          </div>

          <p className="text-sm text-gray-400 leading-relaxed">
            Need to change or cancel? Call or text us at least 24 hours in advance.
          </p>
        </div>
      </div>
    )
  }

  // ─── Booking wizard ───────────────────────────────────────────────────────────

  return (
    <div style={{ backgroundColor: '#f8fafb', minHeight: '100vh' }}>
      <BookHeader />

      {/* Step indicator */}
      <div className="px-4 pt-4 pb-2 max-w-lg mx-auto">
        <div className="flex items-center">
          {([1, 2, 3, 4] as const).map((s) => (
            <div key={s} className="flex items-center" style={{ flex: s < 4 ? '1' : 'none' }}>
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{
                  backgroundColor: step !== 'success' && step >= s ? TEAL : '#e5e7eb',
                  color:           step !== 'success' && step >= s ? 'white' : '#9ca3af',
                }}
              >
                {step !== 'success' && step > s ? <Check size={13} strokeWidth={3} /> : s}
              </div>
              {s < 4 && (
                <div
                  className="h-0.5 flex-1 mx-1"
                  style={{ backgroundColor: step !== 'success' && step > s ? TEAL : '#e5e7eb' }}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-[11px] text-gray-400 font-medium">
          <span>Service</span>
          <span className="mr-1">Date &amp; Time</span>
          <span>Your Info</span>
          <span>Confirm</span>
        </div>
      </div>

      <main className="px-4 pb-16 max-w-lg mx-auto">

        {/* ── STEP 1: Service Selection ────────────────────────────────────────── */}
        {step === 1 && (
          <div className="mt-4 space-y-3">
            <h2 className="text-xl font-bold mb-4" style={{ color: NAVY }}>Choose Your Service</h2>

            {BOOKABLE.map((svc) => {
              const sel = service?.id === svc.id
              return (
                <button
                  key={svc.id}
                  onClick={() => setService(svc)}
                  className="w-full text-left rounded-2xl border-2 p-5 transition-all active:scale-[0.99]"
                  style={{
                    borderColor:     sel ? TEAL : '#e5e7eb',
                    backgroundColor: sel ? `${TEAL}10` : 'white',
                    boxShadow:       sel ? `0 0 0 1px ${TEAL}40` : '0 1px 4px rgba(0,0,0,0.06)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="font-bold text-lg" style={{ color: sel ? TEAL : NAVY }}>
                          {svc.label}
                        </span>
                        <span className="text-sm text-gray-400">{svc.duration}</span>
                      </div>
                      <div className="text-2xl font-bold mt-0.5" style={{ color: sel ? TEAL : NAVY }}>
                        {svc.price}
                      </div>
                    </div>
                    <div
                      className="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                      style={{
                        borderColor:     sel ? TEAL : '#d1d5db',
                        backgroundColor: sel ? TEAL : 'transparent',
                      }}
                    >
                      {sel && <Check size={13} strokeWidth={3} color="white" />}
                    </div>
                  </div>
                </button>
              )
            })}

            {/* Contact-us services */}
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2">Special Programs</p>
            {CONTACT_SERVICES.map((svc) => (
              <div
                key={svc.label}
                className="rounded-2xl border-2 border-dashed p-5 flex items-center justify-between"
                style={{ borderColor: '#d1d5db', backgroundColor: '#fafafa' }}
              >
                <div>
                  <p className="font-semibold text-gray-700">{svc.label}</p>
                  <p className="text-sm text-gray-400 mt-0.5">{svc.desc}</p>
                </div>
                <span className="font-bold text-sm whitespace-nowrap ml-4" style={{ color: GOLD }}>
                  Contact us →
                </span>
              </div>
            ))}

            <button
              disabled={!service}
              onClick={() => setStep(2)}
              className="w-full py-4 rounded-2xl font-bold text-white text-base mt-2 transition-opacity disabled:opacity-40"
              style={{ backgroundColor: TEAL }}
            >
              Continue
            </button>
          </div>
        )}

        {/* ── STEP 2: Date & Time ──────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="mt-4">
            <StepHeader title="Pick a Date & Time" onBack={() => setStep(1)} />

            {/* Selected service chip */}
            <div
              className="rounded-xl px-4 py-2.5 mb-5 inline-flex items-center gap-2"
              style={{ backgroundColor: `${TEAL}15` }}
            >
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: TEAL }} />
              <span className="text-sm font-semibold" style={{ color: TEAL }}>
                {service?.label} · {service?.duration} · {service?.price}
              </span>
            </div>

            {/* Calendar */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
              {/* Month nav */}
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => setCalMonth(m => subMonths(m, 1))}
                  disabled={isSameMonth(calMonth, TODAY)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 disabled:opacity-30 transition"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="font-semibold" style={{ color: NAVY }}>
                  {format(calMonth, 'MMMM yyyy')}
                </span>
                <button
                  onClick={() => setCalMonth(m => addMonths(m, 1))}
                  disabled={isAfter(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1), MAX_DATE)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 disabled:opacity-30 transition"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              {/* Day-of-week headers */}
              <div className="grid grid-cols-7 mb-1">
                {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                  <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
                ))}
              </div>

              {/* Days */}
              <div className="grid grid-cols-7 gap-y-0.5">
                {calDays.map((day, i) => {
                  const inMonth  = isSameMonth(day, calMonth)
                  const disabled = !inMonth || dayDisabled(day)
                  const selected = selDate ? isSameDay(day, selDate) : false
                  const today    = isToday(day)
                  return (
                    <button
                      key={i}
                      disabled={disabled}
                      onClick={() => selectDate(day)}
                      className="aspect-square flex items-center justify-center text-sm rounded-full transition-all"
                      style={{
                        backgroundColor: selected ? TEAL : today && !selected ? `${TEAL}18` : 'transparent',
                        color:           !inMonth  ? '#d1d5db'
                                       : disabled  ? '#d1d5db'
                                       : selected  ? 'white'
                                       : today     ? TEAL
                                       :             NAVY,
                        fontWeight:  selected || today ? '700' : '400',
                        cursor:      disabled ? 'default' : 'pointer',
                      }}
                    >
                      {format(day, 'd')}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Time slots */}
            {selDate ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
                <p className="text-sm font-semibold text-gray-600 mb-3">
                  {format(selDate, 'EEEE, MMMM d')}
                </p>
                {loadingSlots ? (
                  <div className="text-center py-6 text-gray-400 text-sm">Loading availability…</div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {TIME_SLOTS.map((slot) => {
                      const avail    = slotAvailable(slot.hour, slot.minute, selDate, service!.id, dayAppts)
                      const selected = selSlot?.hour === slot.hour && selSlot?.minute === slot.minute
                      return (
                        <button
                          key={slot.label}
                          disabled={!avail}
                          onClick={() => setSelSlot(slot)}
                          className="py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
                          style={{
                            backgroundColor: selected ? TEAL : avail ? 'white' : '#f3f4f6',
                            color:           selected ? 'white' : avail ? NAVY : '#c4c4c4',
                            border:          `2px solid ${selected ? TEAL : avail ? '#e5e7eb' : '#f0f0f0'}`,
                            textDecoration:  !avail ? 'line-through' : 'none',
                          }}
                        >
                          {slot.label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-center text-gray-400 text-sm my-6">
                Select a date above to see available times
              </p>
            )}

            <button
              disabled={!selDate || !selSlot}
              onClick={() => setStep(3)}
              className="w-full py-4 rounded-2xl font-bold text-white text-base transition-opacity disabled:opacity-40"
              style={{ backgroundColor: TEAL }}
            >
              Continue
            </button>
          </div>
        )}

        {/* ── STEP 3: Client Info ──────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="mt-4">
            <StepHeader title="Your Information" onBack={() => setStep(2)} />

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FieldGroup label="First Name" required>
                  <input
                    type="text"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    placeholder="Jane"
                    autoComplete="given-name"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3.5 focus:outline-none bg-white"
                    style={{ fontSize: '16px' }}
                  />
                </FieldGroup>
                <FieldGroup label="Last Name" required>
                  <input
                    type="text"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    placeholder="Smith"
                    autoComplete="family-name"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3.5 focus:outline-none bg-white"
                    style={{ fontSize: '16px' }}
                  />
                </FieldGroup>
              </div>

              <FieldGroup label="Phone" required>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  autoComplete="tel"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3.5 focus:outline-none bg-white"
                  style={{ fontSize: '16px' }}
                />
              </FieldGroup>

              <FieldGroup label="Email" optional>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="jane@example.com"
                  autoComplete="email"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3.5 focus:outline-none bg-white"
                  style={{ fontSize: '16px' }}
                />
              </FieldGroup>

              <FieldGroup label="Birthday" optional>
                <input
                  type="date"
                  value={birthday}
                  onChange={e => setBirthday(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3.5 focus:outline-none bg-white"
                  style={{ fontSize: '16px' }}
                />
              </FieldGroup>

              <FieldGroup label="Referral Code" optional>
                <input
                  type="text"
                  value={refCode}
                  onChange={e => setRefCode(e.target.value.toUpperCase())}
                  placeholder="e.g. JANE2024"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3.5 focus:outline-none bg-white tracking-widest font-mono"
                  style={{ fontSize: '16px' }}
                />
              </FieldGroup>

              {/* Cancellation policy */}
              <div className="rounded-2xl border border-gray-200 p-4 bg-white">
                <p className="text-sm font-semibold mb-1.5" style={{ color: NAVY }}>Cancellation Policy</p>
                <p className="text-xs text-gray-500 leading-relaxed mb-3">
                  We require at least 24 hours notice to cancel or reschedule.
                  Late cancellations or no-shows may result in a cancellation fee.
                </p>
                <button
                  type="button"
                  onClick={() => setAgreed(v => !v)}
                  className="flex items-start gap-3 w-full text-left"
                >
                  <div
                    className="w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center mt-0.5 transition-all"
                    style={{
                      borderColor:     agreed ? TEAL : '#d1d5db',
                      backgroundColor: agreed ? TEAL : 'transparent',
                    }}
                  >
                    {agreed && <Check size={12} strokeWidth={3} color="white" />}
                  </div>
                  <span className="text-sm text-gray-600">
                    I agree to the cancellation policy{' '}
                    <span className="text-red-400">*</span>
                  </span>
                </button>
              </div>

              {formError && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                  <p className="text-sm text-red-600">{formError}</p>
                </div>
              )}

              <button
                onClick={() => { if (validateStep3()) setStep(4) }}
                className="w-full py-4 rounded-2xl font-bold text-white text-base transition-opacity"
                style={{ backgroundColor: TEAL }}
              >
                Review Booking
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Confirmation ─────────────────────────────────────────────── */}
        {step === 4 && (
          <div className="mt-4">
            <StepHeader title="Review & Confirm" onBack={() => setStep(3)} />

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100 mb-5">
              <SummaryRow label="Service">
                <p className="font-bold text-base" style={{ color: NAVY }}>{service?.label}</p>
                <p className="text-gray-500 text-sm">{service?.duration} · {service?.price}</p>
              </SummaryRow>
              <SummaryRow label="Date & Time">
                <p className="font-bold text-base" style={{ color: NAVY }}>
                  {selDate ? format(selDate, 'EEEE, MMMM d, yyyy') : ''}
                </p>
                <p className="text-gray-500 text-sm">{selSlot?.label}</p>
              </SummaryRow>
              <SummaryRow label="Your Info">
                <p className="font-bold text-base" style={{ color: NAVY }}>{firstName} {lastName}</p>
                <p className="text-gray-500 text-sm">{phone}</p>
                {email    && <p className="text-gray-400 text-sm">{email}</p>}
                {refCode  && <p className="text-gray-400 text-xs mt-1">Referral code: {refCode}</p>}
              </SummaryRow>
            </div>

            {submitError && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 mb-4">
                <p className="text-sm text-red-600">{submitError}</p>
              </div>
            )}

            <button
              disabled={submitting}
              onClick={handleConfirm}
              className="w-full py-4 rounded-2xl font-bold text-white text-base transition-opacity disabled:opacity-60"
              style={{ backgroundColor: TEAL }}
            >
              {submitting ? 'Confirming…' : 'Confirm Booking'}
            </button>

            <p className="text-center text-xs text-gray-400 mt-3">
              By confirming you agree to our cancellation policy.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function BookHeader() {
  return (
    <header style={{ backgroundColor: NAVY }} className="px-4 py-5 flex justify-center">
      <div className="text-center">
        <div className="flex items-center justify-center gap-1.5">
          <span className="text-white text-2xl font-bold tracking-tight">SmileSpark</span>
          <span style={{ color: GOLD }} className="text-2xl font-bold">Studio</span>
        </div>
        <p className="text-gray-400 text-xs mt-0.5 tracking-wide uppercase">Online Booking</p>
      </div>
    </header>
  )
}

function StepHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2 mb-5">
      <button
        onClick={onBack}
        className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 -ml-1 transition"
        style={{ color: '#9ca3af' }}
      >
        <ChevronLeft size={20} />
      </button>
      <h2 className="text-xl font-bold" style={{ color: NAVY }}>{title}</h2>
    </div>
  )
}

function FieldGroup({
  label, required, optional, children,
}: {
  label: string
  required?: boolean
  optional?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}{' '}
        {required && <span className="text-red-400">*</span>}
        {optional && <span className="text-gray-400 font-normal">(optional)</span>}
      </label>
      {children}
    </div>
  )
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-4">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{label}</p>
      {children}
    </div>
  )
}
