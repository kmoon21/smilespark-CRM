'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

interface Studio {
  id: string
  name: string
}

interface StudioCtx {
  studio: Studio | null
  loading: boolean
}

const StudioContext = createContext<StudioCtx>({ studio: null, loading: true })

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const [studio, setStudio] = useState<Studio | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(createClient() as any)
      .from('crm_studios')
      .select('id, name')
      .limit(1)
      .maybeSingle()
      .then(({ data }: { data: Studio | null }) => {
        setStudio(data)
        setLoading(false)
      })
  }, [])

  return (
    <StudioContext.Provider value={{ studio, loading }}>
      {children}
    </StudioContext.Provider>
  )
}

export function useStudio() {
  return useContext(StudioContext)
}
