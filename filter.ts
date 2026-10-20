import { createContext, useContext } from 'react'
import type { Data, Foot, KickType, SessionType } from './types'
import { enrich, type EKick } from './geo'

export type Scope = 'piso' | 'drop' | 'todas'
export type Period = 'all' | '7' | '30' | '90' | 'custom'
export interface Filter {
  scope: Scope
  period: Period
  from?: string
  to?: string
  sessionTypes: SessionType[]
  kickTypes: KickType[] // dentro de "piso": conversión / penal
  playerId: string // 'all' o id
  feet: Foot[]
  minAttempts: number
  mirror: boolean
  showKicks: boolean
  zoneLabel: 'pct' | 'frac'
}
export const defaultFilter: Filter = {
  scope: 'piso',
  period: 'all',
  sessionTypes: [],
  kickTypes: [],
  playerId: 'all',
  feet: [],
  minAttempts: 5,
  mirror: false,
  showKicks: false,
  zoneLabel: 'frac',
}
export const SCOPE_LABEL: Record<Scope, string> = { piso: 'De piso', drop: 'Drops', todas: 'Todas' }
export const PERIOD_LABEL: Record<Period, string> = { all: 'Siempre', '7': 'Últimos 7 días', '30': 'Últimos 30 días', '90': 'Últimos 90 días', custom: 'Rango' }

export function activeFilterCount(f: Filter) {
  return (f.sessionTypes.length ? 1 : 0) + (f.kickTypes.length ? 1 : 0) + 0
}

export function applyFilter(d: Data, f: Filter): EKick[] {
  const sessions = new Map(d.sessions.map((s) => [s.id, s]))
  const players = new Map(d.players.map((p) => [p.id, p]))
  let from = -Infinity
  let to = Infinity
  if (f.period !== 'all' && f.period !== 'custom') from = Date.now() - Number(f.period) * 86400000
  if (f.period === 'custom') {
    if (f.from) from = new Date(f.from + 'T00:00').getTime()
    if (f.to) to = new Date(f.to + 'T23:59:59').getTime()
  }
  const out: EKick[] = []
  for (const k of d.kicks) {
    const s = sessions.get(k.sessionId)
    if (!s) continue
    const t = new Date(s.date).getTime()
    if (t < from || t > to) continue
    if (f.scope === 'piso' && k.kickType === 'drop') continue
    if (f.scope === 'drop' && k.kickType !== 'drop') continue
    if (f.kickTypes.length && f.scope !== 'drop' && !f.kickTypes.includes(k.kickType)) continue
    if (f.sessionTypes.length && !f.sessionTypes.includes(s.type)) continue
    if (f.playerId !== 'all' && k.playerId !== f.playerId) continue
    const p = players.get(k.playerId)
    if (f.feet.length && (!p || !f.feet.includes(p.foot))) continue
    out.push(enrich(k, s, p, f.mirror))
  }
  return out
}

export const FilterCtx = createContext<{ filter: Filter; setFilter: (f: Filter) => void } | null>(null)
export const useFilter = () => useContext(FilterCtx)!
