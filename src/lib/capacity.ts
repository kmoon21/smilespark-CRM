import { createClient } from '@/lib/supabase-browser'

type SupabaseClient = ReturnType<typeof createClient>

export const SERVICE_DURATION_MINUTES: Record<string, number> = {
  '30min': 30,
  '60min': 60,
  '90min': 90,
}

/**
 * Finds the first available chair for a proposed appointment.
 * Checks for overlapping active appointments on the same day and returns
 * chair 1 or 2, or an error string if both are booked.
 */
export async function findAvailableChair(
  supabase: SupabaseClient,
  scheduledAt: Date,
  serviceType: string,
  excludeId?: string
): Promise<{ chair: 1 | 2 } | { error: string }> {
  const duration = SERVICE_DURATION_MINUTES[serviceType] ?? 60
  const proposedStart = scheduledAt.getTime()
  const proposedEnd = proposedStart + duration * 60_000

  const dayStart = new Date(scheduledAt)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(scheduledAt)
  dayEnd.setHours(23, 59, 59, 999)

  let q = supabase
    .from('crm_appointments')
    .select('id, scheduled_at, service_type, chair_number')
    .neq('status', 'cancelled')
    .neq('status', 'no_show')
    .gte('scheduled_at', dayStart.toISOString())
    .lte('scheduled_at', dayEnd.toISOString())

  if (excludeId) q = q.neq('id', excludeId)

  const { data } = await q
  const existing = (data ?? []) as Array<{
    id: string
    scheduled_at: string
    service_type: string
    chair_number: number | null
  }>

  const takenChairs = new Set<number>()
  for (const appt of existing) {
    const s = new Date(appt.scheduled_at).getTime()
    const d = SERVICE_DURATION_MINUTES[appt.service_type] ?? 60
    const e = s + d * 60_000
    // Overlap: existing starts before proposed ends AND existing ends after proposed starts
    if (s < proposedEnd && e > proposedStart) {
      takenChairs.add(appt.chair_number ?? 1) // null → treat as chair 1
    }
  }

  if (!takenChairs.has(1)) return { chair: 1 }
  if (!takenChairs.has(2)) return { chair: 2 }
  return { error: 'Both chairs are booked at this time. Please choose a different time.' }
}
