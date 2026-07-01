'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { Search, UserPlus, ChevronRight, ArrowLeft } from 'lucide-react'

type Client = {
  id: string
  first_name: string
  last_name: string
  phone: string | null
  email: string | null
}

export default function CheckInSearchPage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Client[]>([])
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSearch() {
    const q = query.trim()
    if (!q) return
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('crm_clients')
      .select('id, first_name, last_name, phone, email')
      .or(
        `first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`
      )
      .limit(10)
    setResults(data ?? [])
    setSearched(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-start pt-16 px-6">
      <div className="w-full max-w-2xl">
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-1 text-gray-400 hover:text-gray-700 transition-colors mb-10 text-sm"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>

        <h1 className="text-4xl font-bold text-center mb-2" style={{ color: '#1a2332' }}>
          Client Check-In
        </h1>
        <p className="text-center text-gray-500 mb-10 text-lg">
          Search by name or phone number
        </p>

        <div className="flex gap-3 mb-6">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Name or phone…"
            className="flex-1 border border-gray-300 rounded-2xl px-6 py-5 text-xl focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
            autoFocus
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-6 rounded-2xl text-white disabled:opacity-60 flex items-center justify-center"
            style={{ backgroundColor: '#47A1A0' }}
          >
            <Search size={28} />
          </button>
        </div>

        {loading && (
          <p className="text-center text-gray-400 py-6 text-lg">Searching…</p>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg mb-6">No clients found for &ldquo;{query}&rdquo;</p>
            <button
              onClick={() => router.push('/clients/new')}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-white text-lg font-semibold"
              style={{ backgroundColor: '#1a2332' }}
            >
              <UserPlus size={22} />
              Add New Client
            </button>
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="space-y-3">
            {results.map((client) => (
              <button
                key={client.id}
                onClick={() => router.push(`/checkin/${client.id}`)}
                className="w-full flex items-center justify-between bg-white rounded-2xl px-6 py-5 shadow-sm border-2 border-gray-100 hover:border-teal-400 active:scale-[0.99] transition-all text-left"
              >
                <div>
                  <p className="text-xl font-semibold" style={{ color: '#1a2332' }}>
                    {client.first_name} {client.last_name}
                  </p>
                  <p className="text-gray-400 mt-1 text-base">
                    {[client.phone, client.email].filter(Boolean).join(' · ') || 'No contact info'}
                  </p>
                </div>
                <ChevronRight size={26} className="text-gray-300" />
              </button>
            ))}

            <button
              onClick={() => router.push('/clients/new')}
              className="w-full flex items-center justify-center gap-2 bg-white rounded-2xl px-6 py-5 border-2 border-dashed border-gray-200 text-gray-400 hover:border-teal-300 hover:text-teal-600 transition-all text-base font-medium mt-2"
            >
              <UserPlus size={20} />
              Not listed — Add New Client
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
