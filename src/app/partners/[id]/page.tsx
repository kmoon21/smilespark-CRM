'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase-browser'
import Sidebar from '@/components/Sidebar'
import { Building2, Check, ChevronLeft } from 'lucide-react'
import { SERVICE_LABELS, type ServiceType } from '@/lib/service-colors'

interface Partner {
  id: string
  business_name: string
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  referral_code: string
  spif_amount: number
  total_earned: number
  total_paid: number
  balance_owed: number
  notes: string | null
  active: boolean
  created_at: string
}

interface PartnerReferral {
  id: string
  partner_id: string
  client_id: string | null
  appointment_id: string | null
  spif_amount: number
  paid: boolean
  paid_at: string | null
  created_at: string
  crm_clients: { first_name: string; last_name: string } | null
  crm_appointments: { scheduled_at: string; service_type: string } | null
}

export default function PartnerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [partner, setPartner] = useState<Partner | null>(null)
  const [referrals, setReferrals] = useState<PartnerReferral[]>([])
  const [loading, setLoading] = useState(true)
  const [togglingActive, setTogglingActive] = useState(false)
  const [markingPaid, setMarkingPaid] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState(false)

  async function loadAll() {
    setLoading(true)
    const supabase = createClient()

    const [{ data: partnerData }, { data: referralData }] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from('crm_partners')
        .select('*')
        .eq('id', id)
        .maybeSingle(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from('crm_partner_referrals')
        .select('*, crm_clients(first_name, last_name), crm_appointments(scheduled_at, service_type)')
        .eq('partner_id', id)
        .order('created_at', { ascending: false }),
    ])

    setPartner((partnerData as Partner) ?? null)
    setReferrals((referralData as PartnerReferral[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function toggleActive() {
    if (!partner) return
    setTogglingActive(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (createClient() as any)
      .from('crm_partners')
      .update({ active: !partner.active })
      .eq('id', id)
    setPartner(prev => prev ? { ...prev, active: !prev.active } : prev)
    setTogglingActive(false)
  }

  async function markPaid(referral: PartnerReferral) {
    if (referral.paid || !partner) return
    setMarkingPaid(referral.id)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (createClient() as any)
      .from('crm_partner_referrals')
      .update({ paid: true, paid_at: new Date().toISOString() })
      .eq('id', referral.id)

    const newTotalPaid = partner.total_paid + referral.spif_amount
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (createClient() as any)
      .from('crm_partners')
      .update({ total_paid: newTotalPaid })
      .eq('id', id)

    setReferrals(prev =>
      prev.map(r =>
        r.id === referral.id
          ? { ...r, paid: true, paid_at: new Date().toISOString() }
          : r
      )
    )
    setPartner(prev =>
      prev
        ? {
            ...prev,
            total_paid: newTotalPaid,
            balance_owed: prev.total_earned - newTotalPaid,
          }
        : prev
    )
    setMarkingPaid(null)
  }

  async function markAllPaid() {
    if (!partner) return
    const unpaid = referrals.filter(r => !r.paid)
    if (unpaid.length === 0) return
    setMarkingAll(true)

    const ids = unpaid.map(r => r.id)
    const now = new Date().toISOString()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (createClient() as any)
      .from('crm_partner_referrals')
      .update({ paid: true, paid_at: now })
      .in('id', ids)

    const sumUnpaid = unpaid.reduce((acc, r) => acc + r.spif_amount, 0)
    const newTotalPaid = partner.total_paid + sumUnpaid
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (createClient() as any)
      .from('crm_partners')
      .update({ total_paid: newTotalPaid })
      .eq('id', id)

    setReferrals(prev =>
      prev.map(r =>
        ids.includes(r.id) ? { ...r, paid: true, paid_at: now } : r
      )
    )
    setPartner(prev =>
      prev
        ? {
            ...prev,
            total_paid: newTotalPaid,
            balance_owed: prev.total_earned - newTotalPaid,
          }
        : prev
    )
    setMarkingAll(false)
  }

  const unpaidCount = referrals.filter(r => !r.paid).length

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />
      <main className="flex-1 ml-64 overflow-y-auto">
        <div className="px-8 py-8 max-w-6xl">

          {/* Back link */}
          <Link
            href="/partners"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
          >
            <ChevronLeft size={16} />
            Back to Partners
          </Link>

          {loading ? (
            <div className="text-gray-400 text-sm py-10 text-center">Loading…</div>
          ) : !partner ? (
            <div className="text-red-500 text-sm py-10 text-center">Partner not found.</div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-start gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: '#47A1A015' }}
                  >
                    <Building2 size={24} style={{ color: '#47A1A0' }} />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">{partner.business_name}</h1>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-gray-500">
                      {partner.contact_name && <span>{partner.contact_name}</span>}
                      {partner.contact_phone && <span>{partner.contact_phone}</span>}
                      {partner.contact_email && <span>{partner.contact_email}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-gray-500">Referral Code:</span>
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-yellow-100 text-yellow-700">
                        {partner.referral_code}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Active toggle */}
                <button
                  onClick={toggleActive}
                  disabled={togglingActive}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors disabled:opacity-50"
                  style={
                    partner.active
                      ? { borderColor: '#22c55e', color: '#16a34a', backgroundColor: '#f0fdf4' }
                      : { borderColor: '#d1d5db', color: '#6b7280', backgroundColor: '#f9fafb' }
                  }
                >
                  {partner.active ? (
                    <>
                      <Check size={14} />
                      Active
                    </>
                  ) : (
                    'Inactive'
                  )}
                </button>
              </div>

              {/* Stat cards */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-white rounded-xl shadow-sm p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#47A1A0' }}>
                    Total Earned
                  </p>
                  <p className="text-3xl font-bold text-gray-900">${(partner.total_earned ?? 0).toFixed(2)}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide mb-1 text-green-600">
                    Total Paid
                  </p>
                  <p className="text-3xl font-bold text-gray-900">${(partner.total_paid ?? 0).toFixed(2)}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-5">
                  <p
                    className="text-xs font-semibold uppercase tracking-wide mb-1"
                    style={{ color: (partner.balance_owed ?? 0) > 0 ? '#FEB74B' : '#9ca3af' }}
                  >
                    Balance Owed
                  </p>
                  <p
                    className="text-3xl font-bold"
                    style={{ color: (partner.balance_owed ?? 0) > 0 ? '#FEB74B' : '#9ca3af' }}
                  >
                    ${(partner.balance_owed ?? 0).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Referral History */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <h2 className="text-base font-bold text-gray-900">Referral History</h2>
                  {unpaidCount > 0 && (
                    <button
                      onClick={markAllPaid}
                      disabled={markingAll}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-xs font-semibold disabled:opacity-50 transition-opacity hover:opacity-90"
                      style={{ backgroundColor: '#1a2332' }}
                    >
                      <Check size={13} />
                      {markingAll ? 'Marking…' : `Mark All Paid (${unpaidCount})`}
                    </button>
                  )}
                </div>

                {referrals.length === 0 ? (
                  <div className="px-6 py-12 text-center text-gray-400 text-sm">
                    No referrals recorded yet.
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-left">
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Client</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Appt Date</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Service</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">SPIF</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                        <th className="px-6 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {referrals.map(referral => (
                        <tr key={referral.id} className="hover:bg-gray-50 transition-colors">
                          {/* Date */}
                          <td className="px-6 py-4 text-gray-600">
                            {format(new Date(referral.created_at), 'MMM d, yyyy')}
                          </td>

                          {/* Client */}
                          <td className="px-6 py-4">
                            {referral.crm_clients && referral.client_id ? (
                              <Link
                                href={`/clients/${referral.client_id}`}
                                className="font-medium hover:underline"
                                style={{ color: '#47A1A0' }}
                              >
                                {referral.crm_clients.first_name} {referral.crm_clients.last_name}
                              </Link>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>

                          {/* Appt Date */}
                          <td className="px-6 py-4 text-gray-600">
                            {referral.crm_appointments
                              ? format(new Date(referral.crm_appointments.scheduled_at), 'MMM d, yyyy')
                              : '—'}
                          </td>

                          {/* Service */}
                          <td className="px-6 py-4 text-gray-600">
                            {referral.crm_appointments
                              ? SERVICE_LABELS[referral.crm_appointments.service_type as ServiceType] ??
                                referral.crm_appointments.service_type
                              : '—'}
                          </td>

                          {/* SPIF */}
                          <td className="px-6 py-4 font-semibold text-gray-900">
                            ${(referral.spif_amount ?? 0).toFixed(2)}
                          </td>

                          {/* Status */}
                          <td className="px-6 py-4">
                            {referral.paid ? (
                              <div>
                                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">
                                  Paid
                                </span>
                                {referral.paid_at && (
                                  <p className="text-xs text-gray-400 mt-0.5">
                                    {format(new Date(referral.paid_at), 'MMM d, yyyy')}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-700">
                                Unpaid
                              </span>
                            )}
                          </td>

                          {/* Mark Paid button */}
                          <td className="px-6 py-4">
                            {!referral.paid && (
                              <button
                                onClick={() => markPaid(referral)}
                                disabled={markingPaid === referral.id}
                                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 hover:opacity-80"
                                style={{ borderColor: '#1a2332', color: '#1a2332' }}
                              >
                                <Check size={12} />
                                {markingPaid === referral.id ? 'Saving…' : 'Mark Paid'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
