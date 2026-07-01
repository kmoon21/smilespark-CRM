'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { findAvailableChair } from '@/lib/capacity'
import { SERVICE_COLORS, SERVICE_LABELS, type ServiceType } from '@/lib/service-colors'
import { Check, ChevronLeft, ChevronRight, Camera, RotateCcw, X } from 'lucide-react'

type Client = {
  id: string
  first_name: string
  last_name: string
  phone: string | null
  email: string | null
}

type QuizKey =
  | 'previousWhitening'
  | 'sensitiveTeeth'
  | 'pregnant'
  | 'dentalWork'
  | 'toothPain'
  | 'photosensitiveMeds'

type QuizAnswers = Record<QuizKey, 'yes' | 'no' | null>

const QUIZ_QUESTIONS: { key: QuizKey; label: string; warnIfYes?: boolean }[] = [
  { key: 'previousWhitening', label: 'Have you had whitening treatments before?' },
  { key: 'sensitiveTeeth', label: 'Do you have sensitive teeth?', warnIfYes: true },
  { key: 'pregnant', label: 'Are you pregnant or nursing?', warnIfYes: true },
  { key: 'dentalWork', label: 'Do you have crowns, veneers, or bonding?' },
  { key: 'toothPain', label: 'Do you currently have tooth pain or cavities?', warnIfYes: true },
  { key: 'photosensitiveMeds', label: 'Are you taking any photosensitivity medications?', warnIfYes: true },
]

function recommendTreatment(quiz: QuizAnswers): string {
  if (quiz.toothPain === 'yes') return 'Consult dentist before proceeding — active tooth pain detected'
  if (quiz.pregnant === 'yes') return 'Treatment not recommended during pregnancy or nursing'
  if (quiz.sensitiveTeeth === 'yes' && quiz.photosensitiveMeds === 'yes')
    return 'Sensitive formula with reduced session time'
  if (quiz.sensitiveTeeth === 'yes') return 'Sensitive-safe formula recommended'
  if (quiz.photosensitiveMeds === 'yes') return 'Reduced intensity — photosensitivity noted'
  if (quiz.dentalWork === 'yes') return 'Standard treatment — note: whitening will not affect dental work'
  return 'Standard whitening treatment'
}

export default function CheckInWizard() {
  const { clientId } = useParams<{ clientId: string }>()
  const router = useRouter()

  const [step, setStep] = useState(1)
  const [client, setClient] = useState<Client | null>(null)
  const [studioId, setStudioId] = useState<string | null>(null)
  const [appointmentId, setAppointmentId] = useState<string | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1 — Service
  const [serviceType, setServiceType] = useState<ServiceType>('60min')
  const [apptNotes, setApptNotes] = useState('')

  // Step 2 — Consent
  const [quiz, setQuiz] = useState<QuizAnswers>({
    previousWhitening: null,
    sensitiveTeeth: null,
    pregnant: null,
    dentalWork: null,
    toothPain: null,
    photosensitiveMeds: null,
  })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isSigningRef = useRef(false)
  const [hasSigned, setHasSigned] = useState(false)

  // Step 3 — Photo
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoSkipped, setPhotoSkipped] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [clientRes, studioRes] = await Promise.all([
        supabase
          .from('crm_clients')
          .select('id, first_name, last_name, phone, email')
          .eq('id', clientId)
          .single(),
        supabase.from('crm_studios').select('id').single(),
      ])
      setClient(clientRes.data)
      const studio = studioRes.data as { id: string } | null
      setStudioId(studio?.id ?? null)
      setPageLoading(false)
    }
    load()
  }, [clientId])

  // Canvas helpers
  function getPos(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      }
    }
    return {
      x: ((e as React.MouseEvent).clientX - rect.left) * scaleX,
      y: ((e as React.MouseEvent).clientY - rect.top) * scaleY,
    }
  }

  function onSignStart(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault()
    isSigningRef.current = true
    const ctx = canvasRef.current!.getContext('2d')!
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }

  function onSignMove(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault()
    if (!isSigningRef.current) return
    const ctx = canvasRef.current!.getContext('2d')!
    const pos = getPos(e)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = '#1a2332'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
    if (!hasSigned) setHasSigned(true)
  }

  function onSignEnd() {
    isSigningRef.current = false
  }

  function clearSignature() {
    const canvas = canvasRef.current!
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
    setHasSigned(false)
  }

  // Step handlers
  async function handleStep1() {
    setSaving(true)
    setError(null)
    const supabase = createClient()
    const now = new Date()

    // Hard-block if both chairs are already booked at this time
    const availability = await findAvailableChair(supabase, now, serviceType)
    if ('error' in availability) {
      setError(availability.error)
      setSaving(false)
      return
    }

    const { data, error: err } = await supabase
      .from('crm_appointments')
      .insert({
        studio_id: studioId,
        client_id: clientId,
        service_type: serviceType,
        scheduled_at: now.toISOString(),
        status: 'checked_in',
        chair_number: availability.chair,
        notes: apptNotes || null,
      } as never)
      .select('id')
      .single()
    if (err) { setError(err.message); setSaving(false); return }
    setAppointmentId((data as unknown as { id: string }).id)
    setSaving(false)
    setStep(2)
  }

  async function handleStep2() {
    const allAnswered = Object.values(quiz).every((v) => v !== null)
    if (!allAnswered) { setError('Please answer all questions above'); return }
    if (!hasSigned) { setError('Please sign the consent form'); return }
    setSaving(true)
    setError(null)
    const supabase = createClient()
    const signatureDataUrl = canvasRef.current!.toDataURL('image/png')
    const { error: err } = await supabase.from('crm_consent_forms').insert({
      appointment_id: appointmentId,
      client_id: clientId,
      quiz_responses: quiz,
      recommended_treatment: recommendTreatment(quiz),
      signature_data_url: signatureDataUrl,
      signed_at: new Date().toISOString(),
    } as never)
    if (err) { setError(err.message); setSaving(false); return }
    setSaving(false)
    setStep(3)
  }

  async function handleStep3(skip = false) {
    if (skip || !photoFile) {
      setPhotoSkipped(true)
      setStep(4)
      return
    }
    setSaving(true)
    setError(null)
    const supabase = createClient()
    const ext = photoFile.name.split('.').pop() ?? 'jpg'
    const path = `${clientId}/${appointmentId}/before-${Date.now()}.${ext}`
    const { error: uploadErr } = await supabase.storage
      .from('photos')
      .upload(path, photoFile, { contentType: photoFile.type })
    if (uploadErr) {
      setError(`Photo upload failed: ${uploadErr.message}`)
      setSaving(false)
      return
    }
    const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(path)
    await supabase.from('crm_photos').insert({
      appointment_id: appointmentId,
      client_id: clientId,
      photo_type: 'before',
      storage_path: path,
      storage_url: publicUrl,
      taken_at: new Date().toISOString(),
    } as never)
    setSaving(false)
    setStep(4)
  }

  const quizComplete = Object.values(quiz).every((v) => v !== null)
  const recommendedTreatment = quizComplete ? recommendTreatment(quiz) : null

  if (pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400 text-xl">Loading…</p>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-500 text-xl">Client not found.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <button
          onClick={() => (step > 1 ? setStep(step - 1) : router.push('/checkin'))}
          className="flex items-center gap-1 text-gray-500 hover:text-gray-800 transition-colors py-2 pr-4"
        >
          <ChevronLeft size={22} />
          <span className="text-base">{step === 1 ? 'Search' : 'Back'}</span>
        </button>

        <div className="text-center">
          <p className="font-semibold text-gray-800 text-base">
            {client.first_name} {client.last_name}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {['Service', 'Consent', 'Photo', 'Complete'][step - 1]}
          </p>
        </div>

        {/* Step dots */}
        <div className="flex gap-2 items-center">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className="rounded-full transition-all"
              style={{
                width: s === step ? 24 : 10,
                height: 10,
                backgroundColor: s < step ? '#47A1A0' : s === step ? '#47A1A0' : '#e5e7eb',
                opacity: s < step ? 0.5 : 1,
              }}
            />
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10">

        {/* ── STEP 1: Service ── */}
        {step === 1 && (
          <div>
            <h2 className="text-3xl font-bold mb-1" style={{ color: '#1a2332' }}>Select Service</h2>
            <p className="text-gray-400 mb-8">Choose the treatment duration for today&apos;s visit</p>

            <div className="space-y-3 mb-8">
              {([
                { type: '30min' as ServiceType,          desc: '30-minute whitening session' },
                { type: '60min' as ServiceType,          desc: '60-minute whitening session' },
                { type: '90min' as ServiceType,          desc: '90-minute whitening session' },
                { type: 'brand_ambassador' as ServiceType, desc: 'Complimentary — brand ambassador' },
                { type: 'family_friends' as ServiceType,  desc: 'Discounted — family & friends' },
              ]).map(({ type, desc }) => {
                const selected = serviceType === type
                const { bg, text } = SERVICE_COLORS[type]
                return (
                  <button
                    key={type}
                    onClick={() => setServiceType(type)}
                    className="w-full flex items-center justify-between px-6 py-4 rounded-2xl border-2 transition-all text-left active:scale-[0.99]"
                    style={{
                      borderColor: selected ? bg : '#e5e7eb',
                      backgroundColor: selected ? bg + '22' : 'white',
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-4 h-4 rounded-sm flex-shrink-0" style={{ backgroundColor: bg }} />
                      <div>
                        <p className="text-lg font-bold" style={{ color: selected ? text : '#1a2332' }}>
                          {SERVICE_LABELS[type]}
                        </p>
                        <p className="text-gray-400 text-sm mt-0.5">{desc}</p>
                      </div>
                    </div>
                    <div
                      className="w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                      style={{
                        borderColor: selected ? bg : '#e5e7eb',
                        backgroundColor: selected ? bg : 'transparent',
                      }}
                    >
                      {selected && <Check size={16} style={{ color: text }} />}
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={apptNotes}
                onChange={(e) => setApptNotes(e.target.value)}
                placeholder="Any notes for this visit…"
                rows={3}
                className="w-full border border-gray-300 rounded-2xl px-5 py-4 text-base focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none bg-white"
              />
            </div>

            {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}

            <button
              onClick={handleStep1}
              disabled={saving}
              className="w-full py-5 rounded-2xl text-white text-xl font-semibold disabled:opacity-60 flex items-center justify-center gap-2 active:scale-[0.99] transition-transform"
              style={{ backgroundColor: '#47A1A0' }}
            >
              {saving ? 'Creating appointment…' : 'Continue'}
              {!saving && <ChevronRight size={22} />}
            </button>
          </div>
        )}

        {/* ── STEP 2: Consent + Quiz ── */}
        {step === 2 && (
          <div>
            <h2 className="text-3xl font-bold mb-1" style={{ color: '#1a2332' }}>Health Check</h2>
            <p className="text-gray-400 mb-8">Please answer each question honestly</p>

            <div className="space-y-4 mb-8">
              {QUIZ_QUESTIONS.map(({ key, label, warnIfYes }) => (
                <div key={key} className="bg-white rounded-2xl border border-gray-200 px-6 py-5">
                  <p className="text-base font-medium text-gray-800 mb-4 leading-snug">{label}</p>
                  <div className="flex gap-3">
                    {(['yes', 'no'] as const).map((answer) => {
                      const selected = quiz[key] === answer
                      const warn = selected && answer === 'yes' && warnIfYes
                      return (
                        <button
                          key={answer}
                          onClick={() => setQuiz((q) => ({ ...q, [key]: answer }))}
                          className="flex-1 py-4 rounded-xl font-semibold text-lg transition-all border-2 active:scale-[0.98]"
                          style={{
                            borderColor: selected ? (warn ? '#f59e0b' : '#47A1A0') : '#e5e7eb',
                            backgroundColor: selected ? (warn ? '#fffbeb' : '#f0fafa') : 'white',
                            color: selected ? (warn ? '#92400e' : '#1a2332') : '#9ca3af',
                          }}
                        >
                          {answer === 'yes' ? 'Yes' : 'No'}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {recommendedTreatment && (
              <div
                className="rounded-2xl border-2 px-6 py-5 mb-8"
                style={{ borderColor: '#47A1A0', backgroundColor: '#f0fafa' }}
              >
                <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#47A1A0' }}>
                  Recommended Treatment
                </p>
                <p className="font-semibold text-gray-800 text-base">{recommendedTreatment}</p>
              </div>
            )}

            {/* Signature canvas */}
            <div className="bg-white rounded-2xl border border-gray-200 px-6 py-5 mb-8">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-gray-800">Client Signature</p>
                {hasSigned && (
                  <button
                    onClick={clearSignature}
                    className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 py-1 px-2"
                  >
                    <RotateCcw size={14} />
                    Clear
                  </button>
                )}
              </div>
              <p className="text-sm text-gray-400 mb-4 leading-relaxed">
                I confirm the above information is accurate and I consent to treatment.
              </p>
              <canvas
                ref={canvasRef}
                width={600}
                height={160}
                className="w-full rounded-xl border-2 border-dashed touch-none"
                style={{
                  borderColor: hasSigned ? '#47A1A0' : '#e5e7eb',
                  cursor: 'crosshair',
                }}
                onMouseDown={onSignStart}
                onMouseMove={onSignMove}
                onMouseUp={onSignEnd}
                onMouseLeave={onSignEnd}
                onTouchStart={onSignStart}
                onTouchMove={onSignMove}
                onTouchEnd={onSignEnd}
              />
              {!hasSigned && (
                <p className="text-center text-gray-400 text-sm mt-3">
                  Sign above with your finger or stylus
                </p>
              )}
            </div>

            {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}

            <button
              onClick={handleStep2}
              disabled={saving}
              className="w-full py-5 rounded-2xl text-white text-xl font-semibold disabled:opacity-60 flex items-center justify-center gap-2 active:scale-[0.99] transition-transform"
              style={{ backgroundColor: '#47A1A0' }}
            >
              {saving ? 'Saving…' : 'Continue'}
              {!saving && <ChevronRight size={22} />}
            </button>
          </div>
        )}

        {/* ── STEP 3: Before Photo ── */}
        {step === 3 && (
          <div>
            <h2 className="text-3xl font-bold mb-1" style={{ color: '#1a2332' }}>Before Photo</h2>
            <p className="text-gray-400 mb-8">Capture a before photo to track results over time</p>

            {!photoPreview ? (
              <label className="flex flex-col items-center justify-center w-full h-80 rounded-2xl border-2 border-dashed border-gray-200 cursor-pointer hover:border-teal-400 transition-colors bg-white mb-6 active:bg-gray-50">
                <Camera size={56} className="text-gray-200 mb-4" />
                <p className="text-gray-500 font-medium text-xl">Take or upload photo</p>
                <p className="text-gray-400 text-sm mt-2">JPG, PNG, HEIC</p>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    setPhotoFile(file)
                    setPhotoPreview(URL.createObjectURL(file))
                  }}
                />
              </label>
            ) : (
              <div className="relative mb-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoPreview}
                  alt="Before photo preview"
                  className="w-full rounded-2xl object-cover max-h-96"
                />
                <button
                  onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
                  className="absolute top-4 right-4 bg-black/50 rounded-full p-2 text-white hover:bg-black/70 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            )}

            {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}

            <button
              onClick={() => handleStep3(false)}
              disabled={saving || !photoFile}
              className="w-full py-5 rounded-2xl text-white text-xl font-semibold disabled:opacity-40 flex items-center justify-center gap-2 mb-4 active:scale-[0.99] transition-transform"
              style={{ backgroundColor: '#47A1A0' }}
            >
              {saving ? 'Uploading…' : 'Upload & Continue'}
              {!saving && <ChevronRight size={22} />}
            </button>

            <button
              onClick={() => handleStep3(true)}
              disabled={saving}
              className="w-full py-5 rounded-2xl border-2 border-gray-200 text-gray-500 text-xl font-medium hover:border-gray-300 transition-colors active:scale-[0.99]"
            >
              Skip Photo
            </button>
          </div>
        )}

        {/* ── STEP 4: Complete ── */}
        {step === 4 && (
          <div className="text-center">
            <div
              className="w-28 h-28 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ backgroundColor: '#47A1A0' }}
            >
              <Check size={54} className="text-white" strokeWidth={2.5} />
            </div>

            <h2 className="text-3xl font-bold mb-2" style={{ color: '#1a2332' }}>
              Check-In Complete!
            </h2>
            <p className="text-gray-400 text-lg mb-10">
              {client.first_name} is all set for their {serviceType} session.
            </p>

            <div className="bg-white rounded-2xl border border-gray-200 px-6 py-6 mb-8 text-left space-y-4">
              {[
                ['Client', `${client.first_name} ${client.last_name}`],
                ['Service', serviceType],
                ['Status', 'Checked In'],
                ...(recommendedTreatment ? [['Treatment', recommendedTreatment]] : []),
                ...(photoSkipped ? [['Photo', 'Skipped']] : [['Photo', 'Captured']]),
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between items-start gap-4">
                  <span className="text-gray-400 flex-shrink-0">{label}</span>
                  <span
                    className="font-semibold text-right"
                    style={{ color: label === 'Status' ? '#47A1A0' : '#1a2332' }}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <button
                onClick={() => router.push(`/clients/${clientId}`)}
                className="w-full py-5 rounded-2xl text-white text-xl font-semibold active:scale-[0.99] transition-transform"
                style={{ backgroundColor: '#1a2332' }}
              >
                View Client Profile
              </button>
              <button
                onClick={() => router.push('/checkin')}
                className="w-full py-5 rounded-2xl border-2 border-gray-200 text-gray-700 text-xl font-medium hover:border-gray-300 transition-colors active:scale-[0.99]"
              >
                Check In Another Client
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full py-4 text-gray-400 text-base font-medium hover:text-gray-600 transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
