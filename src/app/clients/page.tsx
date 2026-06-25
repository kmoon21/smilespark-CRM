'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { Search } from 'lucide-react'

interface Client {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  referral_code: string | null
  created_at: string
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('crm_clients')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setClients((data as Client[]) ?? [])
        setLoading(false)
      })
  }, [])

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase()
    return (
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q) ||
      (c.phone ?? '').includes(q)
    )
  })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
        <Link
          href="/clients/new"
          className="px-4 py-2.5 rounded-lg text-white text-sm font-medium"
          style={{ backgroundColor: '#47A1A0' }}
        >
          + Add Client
        </Link>
      </div>

      <div className="relative mb-5">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, phone, or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md border border-gray-300 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <p className="text-gray-400 text-sm p-6">Loading clients…</p>
        ) : filtered.length === 0 ? (
          <p className="text-gray-400 text-sm p-6">
            {clients.length === 0 ? 'No clients yet. Add your first client.' : 'No clients match your search.'}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Phone</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Member Since</th>
                <th className="px-5 py-3">Referral Code</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <Link href={`/clients/${client.id}`} className="font-medium text-gray-900 hover:underline" style={{ color: '#47A1A0' }}>
                      {client.first_name} {client.last_name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{client.phone ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-600">{client.email ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-500">{format(new Date(client.created_at), 'MMM d, yyyy')}</td>
                  <td className="px-5 py-3">
                    {client.referral_code ? (
                      <span className="bg-yellow-100 text-yellow-700 text-xs font-mono px-2 py-0.5 rounded">{client.referral_code}</span>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-3">
                    <Link href={`/clients/${client.id}`} className="text-xs font-medium px-3 py-1.5 rounded-md border border-gray-200 hover:bg-gray-100 transition-colors">
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
  )
}
