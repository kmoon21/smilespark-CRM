/** Service type definitions with display metadata and colors. */

export type ServiceType =
  | '30min'
  | '60min'
  | '90min'
  | 'brand_ambassador'
  | 'family_friends'

export const SERVICE_LABELS: Record<ServiceType, string> = {
  '30min':            'Express',
  '60min':            'Standard',
  '90min':            'Premium',
  brand_ambassador:   'Brand Ambassador',
  family_friends:     'Family & Friends',
}

/** Calendar block fill colors — keyed by service type. */
export const SERVICE_COLORS: Record<ServiceType, { bg: string; text: string }> = {
  '30min':          { bg: '#4ade80', text: '#16a34a' },
  '60min':          { bg: '#c4b5fd', text: '#7c3aed' },
  '90min':          { bg: '#60a5fa', text: '#1d4ed8' },
  brand_ambassador: { bg: '#fb923c', text: '#c2410c' },
  family_friends:   { bg: '#f87171', text: '#b91c1c' },
}

/** Thin left-border color for appointment blocks — shows status at a glance. */
export const STATUS_BORDER: Record<string, string> = {
  scheduled:  '#d1d5db',  // gray
  checked_in: '#2563eb',  // blue
  completed:  '#15803d',  // green
  no_show:    '#dc2626',  // red
  cancelled:  '#9ca3af',  // muted gray
}

export function getServiceColors(serviceType: string): { bg: string; text: string } {
  return SERVICE_COLORS[serviceType as ServiceType] ?? { bg: '#c4b5fd', text: '#7c3aed' }
}

export function getStatusBorder(status: string): string {
  return STATUS_BORDER[status] ?? '#d1d5db'
}
