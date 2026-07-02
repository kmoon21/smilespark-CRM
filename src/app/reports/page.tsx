'use client'

import { useEffect, useState, useCallback } from 'react'
import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase-browser'
import { useStudio } from '@/lib/studio-context'
import { TrendingUp, Calendar, Users, Gift, Building2, Package, DollarSign } from 'lucide-react'

const TABS = [
  { key: 'revenue', label: 'Revenue', icon: TrendingUp },
  { key: 'appointments', label: 'Appointments', icon: Calendar },
  { key: 'clients', label: 'Clients', icon: Users },
  { key: 'referrals', label: 'Referrals', icon: Gift },
  { key: 'partners', label: 'Partners', icon: Building2 },
  { key: 'packages', label: 'Packages', icon: Package },
  { key: 'expenses', label: 'Expenses', icon: DollarSign },
] as const

type TabKey = typeof TABS[number]['key']

const DATE_RANGES = [
  { label: 'This Month', value: 'this_month' },
  { label: 'Last Month', value: 'last_month' },
  { label: 'Last 3 Months', value: 'last_3_months' },
  { label: 'This Year', value: 'this_year' },
  { label: 'All Time', value: 'all_time' },
] as const

type DateRangeKey = typeof DATE_RANGES[number]['value']

function getDateBounds(range: DateRangeKey): { from: string | null; to: string | null } {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

  if (range === 'all_time') return { from: null, to: null }

  if (range === 'this_month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return { from: fmt(from), to: fmt(to) }
  }
  if (range === 'last_month') {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const to = new Date(now.getFullYear(), now.getMonth(), 0)
    return { from: fmt(from), to: fmt(to) }
  }
  if (range === 'last_3_months') {
    const from = new Date(now.getFullYear(), now.getMonth() - 2, 1)
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return { from: fmt(from), to: fmt(to) }
  }
  if (range === 'this_year') {
    return { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31` }
  }
  return { from: null, to: null }
}

function fmt$(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ── Revenue Tab ───────────────────────────────────────────────────────────────

interface RevenueRow {
  service_type: string
  count: number
  total: number
}

function RevenueTab({ studioId, from, to }: { studioId: string | null; from: string | null; to: string | null }) {
  const [rows, setRows] = useState<RevenueRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (createClient() as any)
      .from('crm_appointments')
      .select('service_type, amount_paid')
      .eq('status', 'completed')
    if (studioId) q = q.eq('studio_id', studioId)
    if (from) q = q.gte('scheduled_at', from)
    if (to) q = q.lte('scheduled_at', to + 'T23:59:59')
    q.then(({ data }: { data: { service_type: string; amount_paid: number }[] | null }) => {
      const map: Record<string, RevenueRow> = {}
      for (const row of data ?? []) {
        const key = row.service_type || 'Unknown'
        if (!map[key]) map[key] = { service_type: key, count: 0, total: 0 }
        map[key].count++
        map[key].total += row.amount_paid ?? 0
      }
      const sorted = Object.values(map).sort((a, b) => b.total - a.total)
      setRows(sorted)
      setLoading(false)
    })
  }, [studioId, from, to])

  const grandTotal = rows.reduce((s, r) => s + r.total, 0)
  const grandCount = rows.reduce((s, r) => s + r.count, 0)

  if (loading) return <p className="text-gray-400 text-sm py-8 text-center">Loading…</p>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Revenue</p>
          <p className="text-3xl font-bold text-gray-900">{fmt$(grandTotal)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Completed Appointments</p>
          <p className="text-3xl font-bold text-gray-900">{grandCount}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-8">No completed appointments in this period.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left px-5 py-3">Service</th>
                <th className="text-right px-5 py-3">Appointments</th>
                <th className="text-right px-5 py-3">Revenue</th>
                <th className="text-right px-5 py-3">Avg / Appt</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.service_type} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{r.service_type}</td>
                  <td className="px-5 py-3 text-right text-gray-600">{r.count}</td>
                  <td className="px-5 py-3 text-right text-gray-900 font-medium">{fmt$(r.total)}</td>
                  <td className="px-5 py-3 text-right text-gray-500">{fmt$(r.count ? r.total / r.count : 0)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-semibold text-sm">
                <td className="px-5 py-3 text-gray-900">Total</td>
                <td className="px-5 py-3 text-right text-gray-900">{grandCount}</td>
                <td className="px-5 py-3 text-right text-gray-900">{fmt$(grandTotal)}</td>
                <td className="px-5 py-3 text-right text-gray-500">{fmt$(grandCount ? grandTotal / grandCount : 0)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Appointments Tab ──────────────────────────────────────────────────────────

interface ApptStats {
  completed: number
  noshow: number
  cancelled: number
  scheduled: number
  total: number
}

function AppointmentsTab({ studioId, from, to }: { studioId: string | null; from: string | null; to: string | null }) {
  const [stats, setStats] = useState<ApptStats | null>(null)
  const [byDay, setByDay] = useState<{ day: string; count: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (createClient() as any)
      .from('crm_appointments')
      .select('status, scheduled_at')
    if (studioId) q = q.eq('studio_id', studioId)
    if (from) q = q.gte('scheduled_at', from)
    if (to) q = q.lte('scheduled_at', to + 'T23:59:59')
    q.then(({ data }: { data: { status: string; scheduled_at: string }[] | null }) => {
      const s: ApptStats = { completed: 0, noshow: 0, cancelled: 0, scheduled: 0, total: 0 }
      const dayMap: Record<string, number> = {}
      for (const row of data ?? []) {
        s.total++
        if (row.status === 'completed') s.completed++
        else if (row.status === 'no-show') s.noshow++
        else if (row.status === 'cancelled') s.cancelled++
        else s.scheduled++
        const day = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(row.scheduled_at).getDay()]
        dayMap[day] = (dayMap[day] ?? 0) + 1
      }
      setStats(s)
      const ORDER = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
      setByDay(ORDER.map(d => ({ day: d, count: dayMap[d] ?? 0 })))
      setLoading(false)
    })
  }, [studioId, from, to])

  if (loading) return <p className="text-gray-400 text-sm py-8 text-center">Loading…</p>
  if (!stats) return null

  const pct = (n: number) => stats.total ? Math.round(n / stats.total * 100) : 0
  const maxDay = Math.max(...byDay.map(d => d.count), 1)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, color: 'text-gray-900' },
          { label: 'Completed', value: `${stats.completed} (${pct(stats.completed)}%)`, color: 'text-green-600' },
          { label: 'No-show', value: `${stats.noshow} (${pct(stats.noshow)}%)`, color: 'text-red-500' },
          { label: 'Cancelled', value: `${stats.cancelled} (${pct(stats.cancelled)}%)`, color: 'text-orange-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <p className="text-sm font-semibold text-gray-700 mb-4">Appointments by Day of Week</p>
        <div className="flex items-end gap-3 h-32">
          {byDay.map(({ day, count }) => (
            <div key={day} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs text-gray-500">{count || ''}</span>
              <div
                className="w-full rounded-t"
                style={{
                  height: `${Math.round((count / maxDay) * 96)}px`,
                  backgroundColor: '#47A1A0',
                  minHeight: count ? 4 : 0,
                }}
              />
              <span className="text-xs text-gray-500">{day}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Clients Tab ───────────────────────────────────────────────────────────────

function ClientsTab({ studioId, from, to }: { studioId: string | null; from: string | null; to: string | null }) {
  const [total, setTotal] = useState(0)
  const [newCount, setNewCount] = useState(0)
  const [topClients, setTopClients] = useState<{ name: string; visits: number; spent: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const db = createClient() as any // eslint-disable-line @typescript-eslint/no-explicit-any

    // Total clients
    let cq = db.from('crm_clients').select('id', { count: 'exact', head: true })
    if (studioId) cq = cq.eq('studio_id', studioId)
    if (from) cq = cq.gte('created_at', from)
    if (to) cq = cq.lte('created_at', to + 'T23:59:59')

    // Appointments for top clients
    let aq = db.from('crm_appointments').select('client_id, amount_paid, crm_clients(first_name, last_name)').eq('status', 'completed')
    if (studioId) aq = aq.eq('studio_id', studioId)
    if (from) aq = aq.gte('scheduled_at', from)
    if (to) aq = aq.lte('scheduled_at', to + 'T23:59:59')

    Promise.all([cq, aq]).then(([{ count }, { data }]) => {
      setTotal(count ?? 0)
      // New clients: approximate from appointments in range
      const uniqueIds = new Set((data ?? []).map((r: any) => r.client_id)) // eslint-disable-line @typescript-eslint/no-explicit-any
      setNewCount(uniqueIds.size)

      const map: Record<string, { name: string; visits: number; spent: number }> = {}
      for (const row of data ?? []) {
        const id = row.client_id
        const c = row.crm_clients as { first_name: string; last_name: string } | null
        const name = c ? `${c.first_name} ${c.last_name}` : 'Unknown'
        if (!map[id]) map[id] = { name, visits: 0, spent: 0 }
        map[id].visits++
        map[id].spent += row.amount_paid ?? 0
      }
      const top = Object.values(map).sort((a, b) => b.spent - a.spent).slice(0, 10)
      setTopClients(top)
      setLoading(false)
    })
  }, [studioId, from, to])

  if (loading) return <p className="text-gray-400 text-sm py-8 text-center">Loading…</p>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Clients</p>
          <p className="text-3xl font-bold text-gray-900">{total}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Active This Period</p>
          <p className="text-3xl font-bold text-gray-900">{newCount}</p>
        </div>
      </div>

      {topClients.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <p className="px-5 py-3 text-sm font-semibold text-gray-700 border-b border-gray-100">Top Clients by Spend</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                <th className="text-left px-5 py-3">#</th>
                <th className="text-left px-5 py-3">Client</th>
                <th className="text-right px-5 py-3">Visits</th>
                <th className="text-right px-5 py-3">Total Spent</th>
              </tr>
            </thead>
            <tbody>
              {topClients.map((c, i) => (
                <tr key={c.name + i} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3 text-gray-400 text-xs">{i + 1}</td>
                  <td className="px-5 py-3 font-medium text-gray-900">{c.name}</td>
                  <td className="px-5 py-3 text-right text-gray-600">{c.visits}</td>
                  <td className="px-5 py-3 text-right font-medium text-gray-900">{fmt$(c.spent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Referrals Tab ─────────────────────────────────────────────────────────────

function ReferralsTab({ studioId, from, to }: { studioId: string | null; from: string | null; to: string | null }) {
  const [rows, setRows] = useState<{ name: string; referrals: number; credits: number }[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const db = createClient() as any // eslint-disable-line @typescript-eslint/no-explicit-any
    // Clients with referred_by_client_id set
    let q = db.from('crm_clients').select('referred_by_client_id, referral_credit, created_at')
    if (studioId) q = q.eq('studio_id', studioId)
    if (from) q = q.gte('created_at', from)
    if (to) q = q.lte('created_at', to + 'T23:59:59')
    q.then(async ({ data }: { data: { referred_by_client_id: string | null; referral_credit: number }[] | null }) => {
      const referred = (data ?? []).filter(r => r.referred_by_client_id)
      setTotal(referred.length)

      const referrerIds = [...new Set(referred.map(r => r.referred_by_client_id!))]
      if (!referrerIds.length) { setRows([]); setLoading(false); return }

      const { data: referrers } = await db
        .from('crm_clients')
        .select('id, first_name, last_name, referral_credit')
        .in('id', referrerIds)

      const countMap: Record<string, number> = {}
      for (const r of referred) countMap[r.referred_by_client_id!] = (countMap[r.referred_by_client_id!] ?? 0) + 1

      const rows = (referrers ?? []).map((r: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
        name: `${r.first_name} ${r.last_name}`,
        referrals: countMap[r.id] ?? 0,
        credits: r.referral_credit ?? 0,
      })).sort((a: any, b: any) => b.referrals - a.referrals) // eslint-disable-line @typescript-eslint/no-explicit-any

      setRows(rows)
      setLoading(false)
    })
  }, [studioId, from, to])

  if (loading) return <p className="text-gray-400 text-sm py-8 text-center">Loading…</p>

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-100 p-5 inline-block">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Referrals</p>
        <p className="text-3xl font-bold text-gray-900">{total}</p>
      </div>

      {rows.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-8">No referrals in this period.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                <th className="text-left px-5 py-3">Client</th>
                <th className="text-right px-5 py-3">Referrals</th>
                <th className="text-right px-5 py-3">Credits Earned</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{r.name}</td>
                  <td className="px-5 py-3 text-right text-gray-600">{r.referrals}</td>
                  <td className="px-5 py-3 text-right font-medium" style={{ color: '#FEB74B' }}>{fmt$(r.credits)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Partners Tab ──────────────────────────────────────────────────────────────

function PartnersTab({ studioId, from, to }: { studioId: string | null; from: string | null; to: string | null }) {
  const [rows, setRows] = useState<{ business_name: string; referrals: number; earned: number; owed: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const db = createClient() as any // eslint-disable-line @typescript-eslint/no-explicit-any
    let q = db.from('crm_partner_referrals').select('partner_id, spif_amount, crm_partners(business_name)')
    if (from) q = q.gte('created_at', from)
    if (to) q = q.lte('created_at', to + 'T23:59:59')
    q.then(async ({ data }: { data: { partner_id: string; spif_amount: number; crm_partners: { business_name: string } | null }[] | null }) => {
      const map: Record<string, { business_name: string; referrals: number; earned: number }> = {}
      for (const row of data ?? []) {
        const id = row.partner_id
        const name = row.crm_partners?.business_name ?? 'Unknown'
        if (!map[id]) map[id] = { business_name: name, referrals: 0, earned: 0 }
        map[id].referrals++
        map[id].earned += row.spif_amount ?? 0
      }

      // Get balance_owed from partners table
      const ids = Object.keys(map)
      const owed: Record<string, number> = {}
      if (ids.length) {
        let pq = db.from('crm_partners').select('id, balance_owed').in('id', ids)
        if (studioId) pq = pq.eq('studio_id', studioId)
        const { data: partners } = await pq
        for (const p of partners ?? []) owed[p.id] = p.balance_owed ?? 0
      }

      const rows = Object.entries(map).map(([id, r]) => ({ ...r, owed: owed[id] ?? 0 }))
        .sort((a, b) => b.referrals - a.referrals)
      setRows(rows)
      setLoading(false)
    })
  }, [studioId, from, to])

  if (loading) return <p className="text-gray-400 text-sm py-8 text-center">Loading…</p>

  const totalEarned = rows.reduce((s, r) => s + r.earned, 0)
  const totalOwed = rows.reduce((s, r) => s + r.owed, 0)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Partner Referrals</p>
          <p className="text-3xl font-bold text-gray-900">{rows.reduce((s, r) => s + r.referrals, 0)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">SPIFs Earned</p>
          <p className="text-3xl font-bold text-gray-900">{fmt$(totalEarned)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Balance Owed</p>
          <p className="text-3xl font-bold text-red-500">{fmt$(totalOwed)}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-8">No partner referrals in this period.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                <th className="text-left px-5 py-3">Partner</th>
                <th className="text-right px-5 py-3">Referrals</th>
                <th className="text-right px-5 py-3">SPIFs Earned</th>
                <th className="text-right px-5 py-3">Balance Owed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{r.business_name}</td>
                  <td className="px-5 py-3 text-right text-gray-600">{r.referrals}</td>
                  <td className="px-5 py-3 text-right text-gray-900">{fmt$(r.earned)}</td>
                  <td className="px-5 py-3 text-right font-medium text-red-500">{fmt$(r.owed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Packages Tab ──────────────────────────────────────────────────────────────

const PKG_TYPE_LABELS: Record<string, string> = {
  '60min_3pack': '60-Min 3-Pack',
  '60min_6pack': '60-Min 6-Pack',
  '90min_3pack': '90-Min 3-Pack',
  '90min_6pack': '90-Min 6-Pack',
}

function PackagesTab({ studioId }: { studioId: string | null }) {
  const [rows, setRows] = useState<{
    package_type: string; sold: number; active: number; revenue: number
  }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (createClient() as any).from('crm_packages').select('package_type, amount_paid, sessions_remaining')
    if (studioId) q = q.eq('studio_id', studioId)
    q.then(({ data }: { data: { package_type: string; amount_paid: number; sessions_remaining: number }[] | null }) => {
      const map: Record<string, { sold: number; active: number; revenue: number }> = {}
      for (const row of data ?? []) {
        const key = row.package_type || 'Unknown'
        if (!map[key]) map[key] = { sold: 0, active: 0, revenue: 0 }
        map[key].sold++
        map[key].revenue += row.amount_paid ?? 0
        if ((row.sessions_remaining ?? 0) > 0) map[key].active++
      }
      const sorted = Object.entries(map)
        .map(([package_type, v]) => ({ package_type, ...v }))
        .sort((a, b) => b.sold - a.sold)
      setRows(sorted)
      setLoading(false)
    })
  }, [studioId])

  if (loading) return <p className="text-gray-400 text-sm py-8 text-center">Loading…</p>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Packages Sold</p>
          <p className="text-3xl font-bold text-gray-900">{rows.reduce((s, r) => s + r.sold, 0)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Currently Active</p>
          <p className="text-3xl font-bold text-gray-900">{rows.reduce((s, r) => s + r.active, 0)}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-8">No packages sold yet.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                <th className="text-left px-5 py-3">Package</th>
                <th className="text-right px-5 py-3">Sold</th>
                <th className="text-right px-5 py-3">Active</th>
                <th className="text-right px-5 py-3">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.package_type} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{PKG_TYPE_LABELS[r.package_type] ?? r.package_type}</td>
                  <td className="px-5 py-3 text-right text-gray-600">{r.sold}</td>
                  <td className="px-5 py-3 text-right text-gray-600">{r.active}</td>
                  <td className="px-5 py-3 text-right font-medium text-gray-900">{fmt$(r.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Expenses Tab ──────────────────────────────────────────────────────────────

interface Expense {
  id: string
  description: string
  amount: number
  category: string
  expense_date: string
  notes: string | null
}

const EXPENSE_CATEGORIES = ['Supplies', 'Equipment', 'Marketing', 'Rent', 'Utilities', 'Payroll', 'Insurance', 'Other']

function ExpensesTab({ studioId, from, to }: { studioId: string | null; from: string | null; to: string | null }) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    description: '', amount: '', category: 'Supplies', expense_date: new Date().toISOString().slice(0, 10), notes: '',
  })

  const load = useCallback(() => {
    setLoading(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (createClient() as any)
      .from('crm_expenses')
      .select('*')
      .order('expense_date', { ascending: false })
    if (studioId) q = q.eq('studio_id', studioId)
    if (from) q = q.gte('expense_date', from)
    if (to) q = q.lte('expense_date', to)
    q.then(({ data }: { data: Expense[] | null }) => {
      setExpenses(data ?? [])
      setLoading(false)
    })
  }, [studioId, from, to])

  useEffect(() => { load() }, [load])

  async function addExpense() {
    if (!form.description || !form.amount) return
    setSaving(true)
    const payload: Record<string, unknown> = {
      description: form.description,
      amount: parseFloat(form.amount),
      category: form.category,
      expense_date: form.expense_date,
      notes: form.notes || null,
    }
    if (studioId) payload.studio_id = studioId
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (createClient() as any).from('crm_expenses').insert(payload)
    setShowAdd(false)
    setForm({ description: '', amount: '', category: 'Supplies', expense_date: new Date().toISOString().slice(0, 10), notes: '' })
    setSaving(false)
    load()
  }

  if (loading) return <p className="text-gray-400 text-sm py-8 text-center">Loading…</p>

  const total = expenses.reduce((s, e) => s + (e.amount ?? 0), 0)
  const byCategory: Record<string, number> = {}
  for (const e of expenses) byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Expenses</p>
          <p className="text-3xl font-bold text-red-500">{fmt$(total)}</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: '#47A1A0' }}
        >
          + Add Expense
        </button>
      </div>

      {Object.keys(byCategory).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">By Category</p>
          <div className="space-y-2">
            {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
              <div key={cat} className="flex justify-between text-sm">
                <span className="text-gray-600">{cat}</span>
                <span className="font-medium text-gray-900">{fmt$(amt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {expenses.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-8">No expenses logged in this period.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                <th className="text-left px-5 py-3">Date</th>
                <th className="text-left px-5 py-3">Description</th>
                <th className="text-left px-5 py-3">Category</th>
                <th className="text-right px-5 py-3">Amount</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{e.expense_date}</td>
                  <td className="px-5 py-3 text-gray-900">{e.description}{e.notes && <span className="text-gray-400 ml-1 text-xs">— {e.notes}</span>}</td>
                  <td className="px-5 py-3">
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{e.category}</span>
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-red-500">{fmt$(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Add Expense</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#47A1A0]"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="e.g. Wax strips, printer ink"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Amount ($)</label>
                  <input
                    type="number"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#47A1A0]"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                  <input
                    type="date"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#47A1A0]"
                    value={form.expense_date}
                    onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#47A1A0]"
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                >
                  {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#47A1A0]"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={addExpense}
                disabled={saving}
                className="flex-1 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: '#47A1A0' }}
              >
                {saving ? 'Saving…' : 'Save Expense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [tab, setTab] = useState<TabKey>('revenue')
  const [dateRange, setDateRange] = useState<DateRangeKey>('this_month')
  const { studio } = useStudio()
  const { from, to } = getDateBounds(dateRange)

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />
      <main className="flex-1 ml-64 overflow-y-auto">
        <div className="px-8 py-8 max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
              {studio && <p className="text-sm text-gray-500 mt-0.5">{studio.name}</p>}
            </div>
            <select
              value={dateRange}
              onChange={e => setDateRange(e.target.value as DateRangeKey)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#47A1A0] bg-white"
            >
              {DATE_RANGES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-white border border-gray-100 rounded-xl p-1 w-fit">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  tab === key ? 'text-white' : 'text-gray-500 hover:text-gray-700'
                }`}
                style={tab === key ? { backgroundColor: '#47A1A0' } : {}}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tab === 'revenue' && <RevenueTab studioId={studio?.id ?? null} from={from} to={to} />}
          {tab === 'appointments' && <AppointmentsTab studioId={studio?.id ?? null} from={from} to={to} />}
          {tab === 'clients' && <ClientsTab studioId={studio?.id ?? null} from={from} to={to} />}
          {tab === 'referrals' && <ReferralsTab studioId={studio?.id ?? null} from={from} to={to} />}
          {tab === 'partners' && <PartnersTab studioId={studio?.id ?? null} from={from} to={to} />}
          {tab === 'packages' && <PackagesTab studioId={studio?.id ?? null} />}
          {tab === 'expenses' && <ExpensesTab studioId={studio?.id ?? null} from={from} to={to} />}
        </div>
      </main>
    </div>
  )
}
