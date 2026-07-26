'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import Sidebar from '@/components/Sidebar'
import { Building2, Plus, X, Check } from 'lucide-react'

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
  active: boolean
  bookingsCount: number
}

interface AddForm {
  business_name: string
  contact_name: string
  contact_phone: string
  contact_email: string
  spif_amount: string
}

function generatePartnerCode(businessName: string): string {
  const clean = businessName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  const prefix = clean.slice(0, 6).padEnd(4, 'X')
  const digits = Math.floor(10 + Math.random() * 90).toString()
  return `${prefix}${digits}`
}

const defaultForm: AddForm = {
  business_name: '',
  contact_name: '',
  contact_phone: '',
  contact_email: '',
  spif_amount: '20',
}

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<AddForm>(defaultForm)
  const [partnerCode, setPartnerCode] = useState('')
  const [saving, setSaving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  async function loadPartners() {
    setLoading(true)
    const supabase = createClient()

    const { data: partnerData } = await (supabase as any)
      .from('crm_partners')
      .select('*')
      .order('created_at', { ascending: false })

    const { data: referralData } = await (supabase as any)
      .from('crm_partner_referrals')
      .select('partner_id')

    const countMap: Record<string, number> = {}
    if (referralData) {
      for (const row of referralData as { partner_id: string }[]) {
        countMap[row.partner_id] = (countMap[row.partner_id] ?? 0) + 1
      }
    }

    const merged: Partner[] = (partnerData ?? []).map((p: Partner) => ({
      ...p,
      bookingsCount: countMap[p.id] ?? 0,
    }))

    setPartners(merged)
    setLoading(false)
  }

  useEffect(() => {
    loadPartners()
  }, [])

  function handleFormChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    if (name === 'business_name') {
      setPartnerCode(generatePartnerCode(value))
    }
  }

  function openAdd() {
    setForm(defaultForm)
    setPartnerCode('')
    setAddError(null)
    setShowAdd(true)
  }

  async function handleAddPartner(e: React.FormEvent) {
    e.preventDefault()
    if (!form.business_name.trim()) {
      setAddError('Business name is required.')
      return
    }
    setSaving(true)
    setAddError(null)

    const supabase = createClient()
    const { error } = await (supabase as any)
      .from('crm_partners')
      .insert({
        business_name: form.business_name.trim(),
        contact_name: form.contact_name.trim() || null,
        contact_phone: form.contact_phone.trim() || null,
        contact_email: form.contact_email.trim() || null,
        spif_amount: parseFloat(form.spif_amount) || 20,
        referral_code: partnerCode,
      })

    if (error) {
      setAddError(error.message ?? 'Failed to save partner.')
      setSaving(false)
      return
    }

    setSaving(false)
    setShowAdd(false)
    loadPartners()
  }

  const totalEarned = partners.reduce((sum, p) => sum + (p.total_earned ?? 0), 0)
  const totalPaid = partners.reduce((sum, p) => sum + (p.total_paid ?? 0), 0)
  const totalBalance = partners.reduce((sum, p) => sum + (p.balance_owed ?? 0), 0)

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />
      <main className="flex-1 ml-64 overflow-y-auto">
        <div className="px-8 py-8 max-w-7xl">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Building2 size={28} style={{ color: '#47A1A0' }} />
              <h1 className="text-2xl font-bold text-gray-900">Partners</h1>
            </div>
            <button
              onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#47A1A0' }}
            >
              <Plus size={16} />
              Add Partner
            </button>
          </div>

          {/* Summary stat cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm p-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Total Partners</p>
              <p className="text-3xl font-bold text-gray-900">{partners.length}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">SPIF Earned</p>
              <p className="text-3xl font-bold text-gray-900">${totalEarned.toFixed(2)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">SPIF Paid</p>
              <p className="text-3xl font-bold text-gray-900">${totalPaid.toFixed(2)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Balance Owed</p>
              <p
                className="text-3xl font-bold"
                style={{ color: totalBalance > 0 ? '#FEB74B' : '#9ca3af' }}
              >
                ${totalBalance.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Partners table */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-10 text-center text-gray-400 text-sm">Loading partners…</div>
            ) : partners.length === 0 ? (
              <div className="p-16 flex flex-col items-center gap-3">
                <Building2 size={48} className="text-gray-300" />
                <p className="text-lg font-semibold text-gray-500">No partners yet</p>
                <p className="text-sm text-gray-400 text-center max-w-xs">
                  Add gyms, salons, hotels, or other businesses that refer clients to SmileSpark.
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left">
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Business Name</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Code</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">SPIF Rate</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Bookings</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Earned</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Balance</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {partners.map(partner => (
                    <tr key={partner.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-gray-900">{partner.business_name}</td>
                      <td className="px-6 py-4">
                        <p className="text-gray-700">{partner.contact_name ?? '—'}</p>
                        {partner.contact_phone && (
                          <p className="text-xs text-gray-400 mt-0.5">{partner.contact_phone}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs font-semibold px-2 py-1 rounded bg-yellow-100 text-yellow-700">
                          {partner.referral_code}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-700">${(partner.spif_amount ?? 0).toFixed(2)}</td>
                      <td className="px-6 py-4 text-gray-700">{partner.bookingsCount}</td>
                      <td className="px-6 py-4 text-gray-700">${(partner.total_earned ?? 0).toFixed(2)}</td>
                      <td className="px-6 py-4 font-semibold" style={{ color: (partner.balance_owed ?? 0) > 0 ? '#FEB74B' : '#9ca3af' }}>
                        ${(partner.balance_owed ?? 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        {partner.active ? (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">Active</span>
                        ) : (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">Inactive</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          href={`/partners/${partner.id}`}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80"
                          style={{ borderColor: '#47A1A0', color: '#47A1A0' }}
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
      </main>

      {/* Add Partner Modal */}
      {showAdd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-y-auto max-h-[90vh]">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Add Partner</h2>
              <button
                onClick={() => setShowAdd(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddPartner} className="px-6 py-5 space-y-4">
              {/* Business Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Business Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="business_name"
                  value={form.business_name}
                  onChange={handleFormChange}
                  placeholder="e.g. Sunrise Fitness"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Contact Name + Phone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Contact Name</label>
                  <input
                    type="text"
                    name="contact_name"
                    value={form.contact_name}
                    onChange={handleFormChange}
                    placeholder="Jane Smith"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Phone</label>
                  <input
                    type="tel"
                    name="contact_phone"
                    value={form.contact_phone}
                    onChange={handleFormChange}
                    placeholder="(555) 000-0000"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  name="contact_email"
                  value={form.contact_email}
                  onChange={handleFormChange}
                  placeholder="jane@sunrisefitness.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* SPIF per Booking + Referral Code */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">SPIF per Booking ($)</label>
                  <input
                    type="number"
                    name="spif_amount"
                    value={form.spif_amount}
                    onChange={handleFormChange}
                    min="0"
                    step="0.01"
                    placeholder="20"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Referral Code</label>
                  <input
                    type="text"
                    value={partnerCode}
                    onChange={e => setPartnerCode(e.target.value.toUpperCase())}
                    placeholder="Auto-generated"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              {/* Error */}
              {addError && (
                <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{addError}</p>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-50 transition-opacity hover:opacity-90"
                  style={{ backgroundColor: '#47A1A0' }}
                >
                  {saving ? (
                    'Saving…'
                  ) : (
                    <>
                      <Check size={15} />
                      Save Partner
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="flex-1 py-2.5 rounded-lg border border-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
