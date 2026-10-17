import type { Kick, Pitch, Player, Session } from './types'

/** Geometría de una patada. Palos centrados en x = ancho/2, y = 0 (línea de try).
 *  dx > 0 = a la derecha de los palos (mirando desde la cancha hacia los palos). */
export function kickGeometry(x: number, y: number, pitch: Pitch) {
  const cx = pitch.width / 2
  const dx = x - cx
  const yy = Math.max(y, 0.01)
  const distance = Math.hypot(dx, yy)
  const angle = (Math.atan(Math.abs(dx) / yy) * 180) / Math.PI // 0° = de frente
  const signedAngle = dx >= 0 ? angle : -angle
  // Apertura: ángulo que forman los dos palos vistos desde el punto de pateo
  const a1 = Math.atan2(cx - pitch.postGap / 2 - x, yy)
  const a2 = Math.atan2(cx + pitch.postGap / 2 - x, yy)
  const postGap = (Math.abs(a2 - a1) * 180) / Math.PI
  return { distance, angle, signedAngle, postGap, dx }
}

export const SIDES = ['izq_abierta', 'izquierda', 'frente', 'derecha', 'der_abierta'] as const
export type Side = (typeof SIDES)[number]
export const SIDE_LABEL: Record<Side, string> = {
  izq_abierta: 'Izq. abierta',
  izquierda: 'Izquierda',
  frente: 'Frente',
  derecha: 'Derecha',
  der_abierta: 'Der. abierta',
}
/** Límites de ángulo de cada sector (grados, negativo = izquierda) */
export const SIDE_RANGE: Record<Side, [number, number]> = {
  izq_abierta: [-90, -30],
  izquierda: [-30, -10],
  frente: [-10, 10],
  derecha: [10, 30],
  der_abierta: [30, 90],
}
export const BANDS = ['0-20', '20-30', '30-40', '40+'] as const
export type Band = (typeof BANDS)[number]
export const BAND_LABEL: Record<Band, string> = { '0-20': '0–20 m', '20-30': '20–30 m', '30-40': '30–40 m', '40+': '40 m+' }
export const BAND_RANGE: Record<Band, [number, number]> = { '0-20': [0, 20], '20-30': [20, 30], '30-40': [30, 40], '40+': [40, 200] }

export function sideOf(signedAngle: number): Side {
  if (signedAngle <= -30) return 'izq_abierta'
  if (signedAngle <= -10) return 'izquierda'
  if (signedAngle < 10) return 'frente'
  if (signedAngle < 30) return 'derecha'
  return 'der_abierta'
}
export function bandOf(d: number): Band {
  if (d < 20) return '0-20'
  if (d < 30) return '20-30'
  if (d < 40) return '30-40'
  return '40+'
}

export type WindRel = 'favor' | 'contra' | 'cruzado' | 'sin'
export const WIND_REL_LABEL: Record<WindRel, string> = {
  favor: 'A favor',
  contra: 'En contra',
  cruzado: 'Cruzado',
  sin: 'Sin viento / sin dato',
}
/** Relación del viento con la patada. En el 2º tiempo los equipos cambian de lado: se invierte. */
export function windRelation(s: Session, k: Kick): WindRel {
  if (s.windDir == null || !s.windSpeed || s.windSpeed < 1.5) return 'sin'
  let dir = s.windDir
  if (k.half === 2) dir = (dir + 180) % 360
  const d = ((dir % 360) + 360) % 360
  if (d <= 45 || d >= 315) return 'favor'
  if (d >= 135 && d <= 225) return 'contra'
  return 'cruzado'
}

/** Datos derivados de una patada (con espejo opcional para zurdos). */
export function enrich(k: Kick, s: Session, player: Player | undefined, mirror: boolean) {
  const g = kickGeometry(k.x, k.y, s.pitch)
  const flip = mirror && player?.foot === 'izquierdo'
  const signed = flip ? -g.signedAngle : g.signedAngle
  let result = k.result
  if (flip && result === 'derecha') result = 'izquierda'
  else if (flip && result === 'izquierda') result = 'derecha'
  // posición normalizada (en metros relativos al centro de los palos)
  const dx = flip ? -g.dx : g.dx
  return {
    kick: k,
    session: s,
    player,
    distance: g.distance,
    angle: g.angle,
    signedAngle: signed,
    postGap: g.postGap,
    dx,
    y: k.y,
    side: sideOf(signed),
    band: bandOf(g.distance),
    good: k.result === 'adentro',
    result,
    wind: windRelation(s, k),
  }
}
export type EKick = ReturnType<typeof enrich>
