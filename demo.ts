import type { Kick, KickType, Player, Result, Session } from './types'
import { kickGeometry } from './geo'

// Datos de ejemplo para la primera vez. Se borran desde el aviso o en Ajustes.
export function makeDemo(): { players: Player[]; sessions: Session[]; kicks: Kick[] } {
  let seed = 7
  const rnd = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  const pitch = { length: 100, width: 70, postGap: 5.6 }
  const player: Player = { id: 'demo-p1', name: 'Jugador de ejemplo', foot: 'derecho', number: 10, position: 'Apertura', demo: true }
  const now = Date.now()
  const day = 86400000
  const defs: { type: Session['type']; daysAgo: number; n: number; opp?: string; wind: number; dir: number | null; temp: number; w: Session['weather'] }[] = [
    { type: 'entrenamiento', daysAgo: 24, n: 22, wind: 2, dir: null, temp: 15, w: 'parcial' },
    { type: 'entrenamiento', daysAgo: 17, n: 26, wind: 4.5, dir: 90, temp: 18, w: 'despejado' },
    { type: 'partido', daysAgo: 13, n: 7, opp: 'Club Ejemplo', wind: 5, dir: 180, temp: 16, w: 'nublado' },
    { type: 'entrenamiento', daysAgo: 6, n: 24, wind: 3, dir: 0, temp: 20, w: 'despejado' },
    { type: 'partido', daysAgo: 2, n: 8, opp: 'Rival de ejemplo', wind: 2.5, dir: 270, temp: 14, w: 'parcial' },
  ]
  const sessions: Session[] = []
  const kicks: Kick[] = []
  defs.forEach((d, i) => {
    const date = new Date(now - d.daysAgo * day)
    date.setHours(d.type === 'partido' ? 15 : 18, 30, 0, 0)
    const s: Session = {
      id: `demo-s${i}`,
      type: d.type,
      date: date.toISOString(),
      place: d.type === 'partido' ? 'Cancha visitante' : 'Club',
      temp: d.temp,
      weather: d.w,
      windSpeed: d.wind,
      windDir: d.dir,
      opponent: d.opp,
      pitch,
      playerIds: [player.id],
      demo: true,
      createdAt: date.getTime(),
    }
    sessions.push(s)
    for (let j = 0; j < d.n; j++) {
      const r = rnd()
      const kickType: KickType = d.type === 'partido' ? (r < 0.55 ? 'conversion' : r < 0.9 ? 'penal' : 'drop') : r < 0.5 ? 'conversion' : r < 0.85 ? 'penal' : 'drop'
      let x: number, y: number
      let tryX: number | undefined
      if (kickType === 'conversion') {
        tryX = 2 + rnd() * 66
        x = tryX
        y = 10 + rnd() * 22
      } else if (kickType === 'drop') {
        x = 20 + rnd() * 30
        y = 18 + rnd() * 20
      } else {
        x = 6 + rnd() * 58
        y = 18 + rnd() * 30
      }
      const g = kickGeometry(x, y, pitch)
      const p = Math.max(0.15, Math.min(0.97, 1.18 - g.distance / 95 - g.angle / 170 - (kickType === 'drop' ? 0.12 : 0)))
      let result: Result = 'adentro'
      if (rnd() > p) {
        const m = rnd()
        result = m < 0.48 ? 'izquierda' : m < 0.75 ? 'derecha' : m < 0.92 ? 'corta' : 'palo'
      }
      kicks.push({
        id: `demo-k${i}-${j}`,
        sessionId: s.id,
        playerId: player.id,
        kickType,
        x,
        y,
        tryX,
        result,
        half: d.type === 'partido' ? (j < d.n / 2 ? 1 : 2) : undefined,
        tee: kickType !== 'drop',
        createdAt: date.getTime() + j * 60000,
      })
    }
  })
  return { players: [player], sessions, kicks }
}
