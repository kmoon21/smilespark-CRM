'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import Sidebar from '@/components/Sidebar'
import { ChevronLeft } from 'lucide-react'

function generateReferralCode(lastName: string): string {
  const prefix = lastName.replace(/\s/g, '').slice(0, 4).toUpperCase().padEnd(4, 'X')
  const digits = Math.floor(1000 + Math.random() * 9000).toString()
  return `${prefix}${digits}`
}

export default function NewClientPage() {
  const supabase = createClient()
  const router = useRouter()
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    birthday: '',
    notes: '',
  })
  const [referralCode, setReferralCode] = useState('')
  const [inboundCode, setInboundCode] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submitGuard = useRef(false)

  useEffect(() => {
    setReferralCode(generateReferralCode(form.last_name || 'X'))
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (name === 'last_name') {
      setReferralCode(generateReferralCode(value))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitGuard.current) return
    submitGuard.current = true
    setSaving(true)
    setError(null)

    // Resolve inbound referral code — could be client or partner code
    let referred_by_client_id: string | null = null
    let partner_referral_code: string | null = null
    let matchedPartner: { id: string; spif_amount: number } | null = null

    if (inboundCode.trim()) {
      const code = inboundCode.trim().toUpperCase()
      const [clientRes, partnerRes] = await Promise.all([
        (supabase as any).from('crm_clients').select('id').eq('referral_code', code).maybeSingle(),
        (supabase as any).from('crm_partners').select('id, spif_amount').eq('referral_code', code).maybeSingle(),
      ])
      if (clientRes.data) {
        referred_by_client_id = clientRes.data.id
      } else if (partnerRes.data) {
        partner_referral_code = code
        matchedPartner = partnerRes.data
      } else {
        setError(`Referral code "${code}" not found`)
        setSaving(false)
        submitGuard.current = false
        return
      }
    }

    const { data, error: insertError } = await (supabase as any)
      .from('crm_clients')
      .insert({
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email || null,
        phone: form.phone || null,
        birthday: form.birthday || null,
        notes: form.notes || null,
        referral_code: referralCode,
        ...(referred_by_client_id ? { referred_by_client_id } : {}),
        ...(partner_referral_code ? { partner_referral_code } : {}),
      })
      .select('id')
      .single()

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      submitGuard.current = false
      return
    }

    const newClientId: string = data.id

    // Log partner SPIF referral if applicable
    if (matchedPartner) {
      await (supabase as any).from('crm_partner_referrals').insert({
        partner_id: matchedPartner.id,
        client_id: newClientId,
        spif_amount: matchedPartner.spif_amount,
      })
      // Fetch current total_earned then increment by spif_amount (no RPC needed)
      const { data: pd } = await (supabase as any)
        .from('crm_partners')
        .select('total_earned')
        .eq('id', matchedPartner.id)
        .maybeSingle()
      const newTotal = ((pd?.total_earned ?? 0) as number) + matchedPartner.spif_amount
      await (supabase as any)
        .from('crm_partners')
        .update({ total_earned: newTotal } as never)
        .eq('id', matchedPartner.id)
    }

    router.push(`/clients/${newClientId}`)
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />
      <main className="flex-1 ml-64 overflow-y-auto">
    <div className="p-8 max-w-2xl">
      <Link href="/clients" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 transition-colors mb-6">
        <ChevronLeft size={15} />
        Clients
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New Client</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Name <span className="text-red-400">*</span>
            </label>
            <input
              name="first_name"
              value={form.first_name}
              onChange={handleChange}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last Name <span className="text-red-400">*</span>
            </label>
            <input
              name="last_name"
              value={form.last_name}
              onChange={handleChange}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Birthday</label>
          <input
            name="birthday"
            type="date"
            value={form.birthday}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Referred by Code <span className="text-gray-400 font-normal">(client or partner code, optional)</span>
          </label>
          <input
            value={inboundCode}
            onChange={e => setInboundCode(e.target.value)}
            placeholder="e.g. CART1234 or CRUNCH20"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono uppercase"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Referral Code (auto-generated)
          </label>
          <input
            value={referralCode}
            readOnly
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-gray-50 text-gray-500 font-mono"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
          />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-lg text-white text-sm font-medium disabled:opacity-60"
            style={{ backgroundColor: '#47A1A0' }}
          >
            {saving ? 'Saving…' : 'Save Client'}
          </button>
          <Link
            href="/clients"
            className="px-5 py-2.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
      </main>
    </div>
  )
}
