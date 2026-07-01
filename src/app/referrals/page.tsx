'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase-browser'
import { Gift, Trophy, Info } from 'lucide-react'
import Sidebar from '@/components/Sidebar'

interface Referrer {
  id: string
  first_name: string
  last_name: string
  referral_code: string | null
  count: number
  credit: number
  latestAt: string | null
}

type ReferredRow = { referred_by_client_id: string; created_at: string }
type ReferrerRow = { id: string; first_name: string; last_name: string; referral_code: string | null }

export default function ReferralsPage() {
  const [referrers, setReferrers] = useState<Referrer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = createClient() as any

      // Step 1: all clients who were referred by someone
      const { data: referred } = await supabase
        .from('crm_clients')
        .select('referred_by_client_id, created_at')
        .not('referred_by_client_id', 'is', null)

      const referredRows = (referred ?? []) as ReferredRow[]

      if (referredRows.length === 0) {
        setLoading(false)
        return
      }

      // Step 2: unique referrer IDs → fetch their details
      const ids = [...new Set(referredRows.map(r => r.referred_by_client_id))]
      const { data: referrerData } = await supabase
        .from('crm_clients')
        .select('id, first_name, last_name, referral_code')
        .in('id', ids)

      const referrerRows = (referrerData ?? []) as ReferrerRow[]

      // Step 3: aggregate counts, credit, latest date
      const aggregated: Referrer[] = referrerRows
        .map(r => {
          const mine = referredRows.filter(x => x.referred_by_client_id === r.id)
          const latestAt = mine
            .map(x => x.created_at)
            .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null
          return {
            id: r.id,
            first_name: r.first_name,
            last_name: r.last_name,
            referral_code: r.referral_code,
            count: mine.length,
            credit: mine.length * 20,
            latestAt,
          }
        })
        .sort((a, b) => b.count - a.count)

      setReferrers(aggregated)
      setLoading(false)
    }
    load()
  }, [])

  const totalReferrals = referrers.reduce((s, r) => s + r.count, 0)
  const totalCredit = referrers.reduce((s, r) => s + r.credit, 0)
  const hasData = !loading && referrers.length > 0

  // Medal colors for top 3 ranks
  function rankColor(i: number) {
    if (i === 0) return '#FEB74B'
    if (i === 1) return '#9ca3af'
    if (i === 2) return '#b45309'
    return '#d1d5db'
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />
      <main className="flex-1 ml-64 overflow-y-auto">
        <div className="p-8 max-w-5xl">

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-lg" style={{ backgroundColor: '#FEB74B20' }}>
              <Gift size={22} style={{ color: '#FEB74B' }} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Referrals</h1>
          </div>

          {/* How it works banner */}
          <div
            className="flex items-start gap-3 rounded-xl px-5 py-4 mb-8 border"
            style={{ backgroundColor: '#47A1A010', borderColor: '#47A1A040' }}
          >
            <Info size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#47A1A0' }} />
            <p className="text-sm text-gray-600">
              <span className="font-semibold" style={{ color: '#1a2332' }}>How it works: </span>
              Every client gets a unique referral code. When a new client books using that code,
              the referring client earns <span className="font-semibold">$20 credit</span> toward their next visit.
            </p>
          </div>

          {loading ? (
            <p className="text-gray-400 text-sm">Loading…</p>
          ) : !hasData ? (

            /* ── Empty state ── */
            <div className="bg-white rounded-xl shadow-sm p-14 text-center">
              <div
                className="mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-4"
                style={{ backgroundColor: '#FEB74B15' }}
              >
                <Gift size={26} style={{ color: '#FEB74B' }} />
              </div>
              <p className="text-gray-700 font-semibold mb-1">No referrals yet</p>
              <p className="text-sm text-gray-400 max-w-sm mx-auto">
                Referral codes are automatically generated for every client and shown on their profile.
              </p>
            </div>

          ) : (
            <>
              {/* ── Summary stats ── */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4">
                  <div className="p-3 rounded-lg" style={{ backgroundColor: '#47A1A020' }}>
                    <Gift size={20} style={{ color: '#47A1A0' }} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Total Referrals Made</p>
                    <p className="text-2xl font-bold text-gray-900">{totalReferrals}</p>
                  </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4">
                  <div
                    className="p-3 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: '#FEB74B20' }}
                  >
                    <span className="text-lg font-bold leading-none" style={{ color: '#FEB74B' }}>$</span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Total Credits Issued</p>
                    <p className="text-2xl font-bold text-gray-900">${totalCredit.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* ── Section 1: Client Referrals table ── */}
              <div className="bg-white rounded-xl shadow-sm mb-6 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-lg font-semibold text-gray-900">Client Referrals</h2>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      <th className="px-6 py-3">Client</th>
                      <th className="px-6 py-3">Referral Code</th>
                      <th className="px-6 py-3">Referrals</th>
                      <th className="px-6 py-3">Credit Earned</th>
                      <th className="px-6 py-3">Last Referral</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {referrers.map(r => (
                      <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-3.5">
                          <Link
                            href={`/clients/${r.id}`}
                            className="font-medium hover:underline"
                            style={{ color: '#47A1A0' }}
                          >
                            {r.first_name} {r.last_name}
                          </Link>
                        </td>
                        <td className="px-6 py-3.5">
                          {r.referral_code ? (
                            <span className="font-mono text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                              {r.referral_code}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-6 py-3.5">
                          <span
                            className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white"
                            style={{ backgroundColor: '#47A1A0' }}
                          >
                            {r.count}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 font-semibold text-gray-900">
                          ${r.credit.toFixed(2)}
                        </td>
                        <td className="px-6 py-3.5 text-gray-500">
                          {r.latestAt ? format(new Date(r.latestAt), 'MMM d, yyyy') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Section 2: Leaderboard ── */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                  <Trophy size={18} style={{ color: '#FEB74B' }} />
                  <h2 className="text-lg font-semibold text-gray-900">Top Referral Codes</h2>
                </div>
                <div className="divide-y divide-gray-100">
                  {referrers.map((r, i) => (
                    <div key={r.id} className="px-6 py-3.5 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                      <span
                        className="w-6 text-center text-sm font-bold flex-shrink-0"
                        style={{ color: rankColor(i) }}
                      >
                        {i + 1}
                      </span>
                      <Link
                        href={`/clients/${r.id}`}
                        className="flex-1 font-medium hover:underline"
                        style={{ color: '#1a2332' }}
                      >
                        {r.first_name} {r.last_name}
                      </Link>
                      {r.referral_code && (
                        <span className="font-mono text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                          {r.referral_code}
                        </span>
                      )}
                      <span className="text-sm font-semibold text-gray-600 flex-shrink-0">
                        {r.count} {r.count === 1 ? 'referral' : 'referrals'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
