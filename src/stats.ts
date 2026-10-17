import { BANDS, SIDES, type Band, type EKick, type Side, type WindRel } from './geo'
import { POINTS, type KickType, type Result, type Session } from './types'

export interface Cell {
  n: number
  made: number
}
export const pct = (c: Cell) => (c.n ? c.made / c.n : 0)
export const fmtPct = (c: Cell) => (c.n ? `${Math.round(pct(c) * 100)}%` : '–')
const add = (c: Cell, good: boolean) => {
  c.n++
  if (good) c.made++
}

export function countsPoints(s: Session, pointsInFriendlies: boolean) {
  return s.type === 'partido' || (pointsInFriendlies && s.type === 'amistoso')
}

export function summarize(ks: EKick[], minAttempts: number, pointsInFriendlies: boolean) {
  const total: Cell = { n: 0, made: 0 }
  const zones = new Map<string, Cell>()
  const bySide = new Map<Side, Cell>(SIDES.map((s) => [s, { n: 0, made: 0 }]))
  const byBand = new Map<Band, Cell>(BANDS.map((b) => [b, { n: 0, made: 0 }]))
  const byType = new Map<KickType, Cell>()
  const byWind = new Map<WindRel, Cell>()
  const byTee: Record<'tee' | 'sin', Cell> = { tee: { n: 0, made: 0 }, sin: { n: 0, made: 0 } }
  const misses: Record<Result, number> = { adentro: 0, derecha: 0, izquierda: 0, corta: 0, palo: 0, otro: 0 }
  const leftHalf: Cell = { n: 0, made: 0 }
  const rightHalf: Cell = { n: 0, made: 0 }
  let pointsMade = 0
  let pointsWasted = 0
  let pointsKicks = 0
  for (const k of ks) {
    add(total, k.good)
    const key = `${k.side}|${k.band}`
    if (!zones.has(key)) zones.set(key, { n: 0, made: 0 })
    add(zones.get(key)!, k.good)
    add(bySide.get(k.side)!, k.good)
    add(byBand.get(k.band)!, k.good)
    if (!byType.has(k.kick.kickType)) byType.set(k.kick.kickType, { n: 0, made: 0 })
    add(byType.get(k.kick.kickType)!, k.good)
    if (!byWind.has(k.wind)) byWind.set(k.wind, { n: 0, made: 0 })
    add(byWind.get(k.wind)!, k.good)
    if (k.kick.kickType !== 'drop') add(k.kick.tee === false ? byTee.sin : byTee.tee, k.good)
    if (!k.good) misses[k.result]++
    if (k.signedAngle <= -10) add(leftHalf, k.good)
    else if (k.signedAngle >= 10) add(rightHalf, k.good)
    if (countsPoints(k.session, pointsInFriendlies)) {
      pointsKicks++
      const p = POINTS[k.kick.kickType]
      if (k.good) pointsMade += p
      else pointsWasted += p
    }
  }
  const ranked = [...zones.entries()]
    .filter(([, c]) => c.n >= minAttempts)
    .map(([key, c]) => {
      const [side, band] = key.split('|') as [Side, Band]
      return { side, band, cell: c }
    })
    .sort((a, b) => pct(b.cell) - pct(a.cell) || b.cell.n - a.cell.n)
  const missCount = total.n - total.made
  let bias: { dir: 'izquierda' | 'derecha' | 'parejo'; share: number } = { dir: 'parejo', share: 0 }
  if (missCount > 0) {
    const l = misses.izquierda
    const r = misses.derecha
    if (l > r) bias = { dir: 'izquierda', share: l / missCount }
    else if (r > l) bias = { dir: 'derecha', share: r / missCount }
  }
  return {
    total,
    zones,
    bySide,
    byBand,
    byType,
    byWind,
    byTee,
    misses,
    missCount,
    bias,
    ranked,
    best: ranked[0],
    worst: ranked.length > 1 ? ranked[ranked.length - 1] : undefined,
    leftHalf,
    rightHalf,
    pointsMade,
    pointsWasted,
    pointsKicks,
  }
}
export type Summary = ReturnType<typeof summarize>

/** Acierto por semana (lunes a domingo) */
export function weekly(ks: EKick[]) {
  const m = new Map<number, Cell>()
  for (const k of ks) {
    const d = new Date(k.session.date)
    const day = (d.getDay() + 6) % 7
    const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day).getTime()
    if (!m.has(monday)) m.set(monday, { n: 0, made: 0 })
    add(m.get(monday)!, k.good)
  }
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([t, c]) => ({ t, cell: c }))
}

export function sessionPoints(s: Session, kicks: { kickType: KickType; result: Result }[], pointsInFriendlies: boolean) {
  if (!countsPoints(s, pointsInFriendlies)) return null
  let made = 0
  let wasted = 0
  for (const k of kicks) {
    const p = POINTS[k.kickType]
    if (k.result === 'adentro') made += p
    else wasted += p
  }
  return { made, wasted }
}
