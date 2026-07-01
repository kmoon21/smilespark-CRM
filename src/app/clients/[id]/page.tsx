'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase-browser'
import { Copy, Check } from 'lucide-react'

interface Client {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  birthday: string | null
  referral_code: string | null
  notes: string | null
  created_at: string
}

interface Appointment {
  id: string
  scheduled_at: string
  service_type: string
  status: string
  amount_paid: number | null
  notes: string | null
}

interface Photo {
  id: string
  photo_type: string
  storage_url: string | null
  taken_at: string
  appointment_id: string | null
}

interface Package {
  id: string
  package_type: string
  total_sessions: number
  sessions_used: number
  sessions_remaining: number
  purchased_at: string
}

const PKG_TYPE_LABELS: Record<string, string> = {
  '60min_3pack': '60-Min 3-Pack',
  '60min_6pack': '60-Min 6-Pack',
  '90min_3pack': '90-Min 3-Pack',
  '90min_6pack': '90-Min 6-Pack',
}

const statusColors: Record<string, string> = {
  scheduled: 'bg-yellow-100 text-yellow-700',
  checked_in: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  no_show: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-600',
}

export default function ClientDetailPage() {
  const supabase = createClient()
  const { id } = useParams<{ id: string }>()
  const [client, setClient] = useState<Client | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [photos, setPhotos] = useState<Photo[]>([])
  const [notes, setNotes] = useState('')
  const [savedNotes, setSavedNotes] = useState(false)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [packages, setPackages] = useState<Package[]>([])
  const [usingSession, setUsingSession] = useState<string | null>(null)
  const [referralCredit, setReferralCredit] = useState(0)

  useEffect(() => {
    async function load() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: clientData } = await (supabase as any)
        .from('crm_clients')
        .select('*')
        .eq('id', id)
        .single()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: apptData } = await (supabase as any)
        .from('crm_appointments')
        .select('*')
        .eq('client_id', id)
        .order('scheduled_at', { ascending: false })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: photoData } = await (supabase as any)
        .from('crm_photos')
        .select('*')
        .eq('client_id', id)
        .order('taken_at', { ascending: false })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: pkgData } = await (supabase as any)
        .from('crm_packages')
        .select('*')
        .eq('client_id', id)
        .gt('sessions_remaining', 0)
        .order('purchased_at', { ascending: false })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count: refCount } = await (supabase as any)
        .from('crm_clients')
        .select('id', { count: 'exact', head: true })
        .eq('referred_by_client_id', id)

      if (clientData) {
        setClient(clientData as Client)
        setNotes((clientData as Client).notes ?? '')
      }
      setAppointments((apptData as Appointment[]) ?? [])
      setPhotos((photoData as Photo[]) ?? [])
      setPackages((pkgData as Package[]) ?? [])
      setReferralCredit((refCount ?? 0) * 20)
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleNotesBlur() {
    if (!client) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('crm_clients').update({ notes }).eq('id', id)
    setSavedNotes(true)
    setTimeout(() => setSavedNotes(false), 2000)
  }

  async function applySession(pkg: Package) {
    setUsingSession(pkg.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('crm_packages')
      .update({
        sessions_used: pkg.sessions_used + 1,
        sessions_remaining: pkg.sessions_remaining - 1,
      })
      .eq('id', pkg.id)
    setPackages(prev =>
      prev
        .map(p => p.id === pkg.id
          ? { ...p, sessions_used: p.sessions_used + 1, sessions_remaining: p.sessions_remaining - 1 }
          : p
        )
        .filter(p => p.sessions_remaining > 0)
    )
    setUsingSession(null)
  }

  function copyReferralCode() {
    if (client?.referral_code) {
      navigator.clipboard.writeText(client.referral_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const photoPairs = photos.reduce<Record<string, Photo[]>>((acc, photo) => {
    const key = photo.appointment_id ?? 'unlinked'
    if (!acc[key]) acc[key] = []
    acc[key].push(photo)
    return acc
  }, {})

  if (loading) return <div className="p-8 text-gray-400">Loading&#8230;</div>
  if (!client) return <div className="p-8 text-red-500">Client not found.</div>

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {client.first_name} {client.last_name}
          </h1>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
            {client.phone && <span>{client.phone}</span>}
            {client.email && <span>{client.email}</span>}
            {client.birthday && (
              <span>Born {format(new Date(client.birthday), 'MMM d, yyyy')}</span>
            )}
          </div>
          {client.referral_code && (
            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs text-gray-500">Referral Code:</span>
              <span className="font-mono text-sm bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                {client.referral_code}
              </span>
              <button onClick={copyReferralCode} className="text-gray-400 hover:text-gray-600">
                {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
              </button>
            </div>
          )}
          {referralCredit > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-gray-500">Credit Balance:</span>
              <span className="text-sm font-semibold" style={{ color: '#FEB74B' }}>
                ${referralCredit.toFixed(2)}
              </span>
            </div>
          )}
        </div>
        <button className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50">
          Edit
        </button>
      </div>

      <section className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Visit History</h2>
        {appointments.length === 0 ? (
          <p className="text-gray-400 text-sm">No visits yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b">
                <th className="pb-2">Date</th>
                <th className="pb-2">Service</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Amount</th>
                <th className="pb-2">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {appointments.map((appt) => (
                <tr key={appt.id}>
                  <td className="py-2.5 text-gray-700">
                    {format(new Date(appt.scheduled_at), 'MMM d, yyyy h:mm a')}
                  </td>
                  <td className="py-2.5 text-gray-700">{appt.service_type}</td>
                  <td className="py-2.5">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[appt.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {appt.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-2.5 text-gray-700">
                    {appt.amount_paid != null ? `$${appt.amount_paid.toFixed(2)}` : '—'}
                  </td>
                  <td className="py-2.5 text-gray-500 text-xs max-w-xs truncate">
                    {appt.notes ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Active Packages */}
      {packages.length > 0 && (
        <section className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Package</h2>
          <div className="space-y-4">
            {packages.map(pkg => (
              <div key={pkg.id} className="rounded-xl p-4"
                style={{ backgroundColor: '#47A1A010', border: '1px solid #47A1A040' }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {PKG_TYPE_LABELS[pkg.package_type] ?? pkg.package_type}
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Purchased {format(new Date(pkg.purchased_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <span className="text-sm font-bold" style={{ color: '#47A1A0' }}>
                    {pkg.sessions_remaining} left
                  </span>
                </div>
                {/* Session dot tracker */}
                <div className="flex gap-1.5 mb-3">
                  {Array.from({ length: pkg.total_sessions }, (_, i) => (
                    <div key={i} className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                      style={i < pkg.sessions_used
                        ? { backgroundColor: '#47A1A0', borderColor: '#47A1A0' }
                        : { backgroundColor: 'transparent', borderColor: '#47A1A060' }}>
                      {i < pkg.sessions_used && (
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                          <path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    {pkg.sessions_used} of {pkg.total_sessions} sessions used
                  </p>
                  <button
                    onClick={() => applySession(pkg)}
                    disabled={usingSession === pkg.id}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-40 transition-opacity"
                    style={{ backgroundColor: '#47A1A0' }}
                  >
                    {usingSession === pkg.id ? 'Saving…' : 'Use Session'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Photos</h2>
        {photos.length === 0 ? (
          <p className="text-gray-400 text-sm">
            No photos yet. Photos will appear here after appointments.
          </p>
        ) : (
          <div className="space-y-6">
            {Object.entries(photoPairs).map(([apptId, apptPhotos]) => {
              const before = apptPhotos.find((p) => p.photo_type === 'before')
              const after = apptPhotos.find((p) => p.photo_type === 'after')
              const date = apptPhotos[0]?.taken_at
              return (
                <div key={apptId}>
                  {date && (
                    <p className="text-xs text-gray-500 mb-2">
                      {format(new Date(date), 'MMM d, yyyy')}
                    </p>
                  )}
                  <div className="flex gap-4">
                    {before && (
                      <div className="flex-1">
                        <p className="text-xs font-medium text-gray-500 mb-1">Before</p>
                        {before.storage_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={before.storage_url}
                            alt="Before"
                            className="w-full rounded-lg object-cover h-48"
                          />
                        ) : (
                          <div className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-sm">
                            No image
                          </div>
                        )}
                      </div>
                    )}
                    {after && (
                      <div className="flex-1">
                        <p className="text-xs font-medium text-gray-500 mb-1">After</p>
                        {after.storage_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={after.storage_url}
                            alt="After"
                            className="w-full rounded-lg object-cover h-48"
                          />
                        ) : (
                          <div className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-sm">
                            No image
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Notes</h2>
          {savedNotes && <span className="text-green-500 text-sm">Saved ✓</span>}
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleNotesBlur}
          rows={5}
          placeholder="Add notes about this client…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
        />
      </section>
    </div>
  )
}
