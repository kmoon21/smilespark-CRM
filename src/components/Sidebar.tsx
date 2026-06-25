'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Users, Calendar, Gift, Settings, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'

const supabase = createClient()
import { useEffect, useState } from 'react'

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Clients', href: '/clients', icon: Users },
  { label: 'Appointments', href: '/appointments', icon: Calendar },
  { label: 'Referrals', href: '/referrals', icon: Gift },
  { label: 'Settings', href: '/settings', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null)
    })
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="w-64 flex-shrink-0 flex flex-col h-screen fixed left-0 top-0" style={{ backgroundColor: '#1a2332' }}>
      <div className="px-6 py-6 border-b border-white/10">
        <span className="text-2xl font-bold" style={{ color: '#47A1A0' }}>SmileSpark</span>
        <span className="text-2xl font-bold ml-1" style={{ color: '#FEB74B' }}>CRM</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
              style={active ? { backgroundColor: '#47A1A0' } : {}}
            >
              <Icon size={18} />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="px-4 py-4 border-t border-white/10">
        {userEmail && (
          <p className="text-gray-400 text-xs truncate mb-3 px-1">{userEmail}</p>
        )}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors w-full px-1"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
