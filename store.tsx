import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react'
import type { Data, Kick, Player, Session, Settings } from './types'
import { makeDemo } from './demo'

// Por ahora los datos viven en el celular (localStorage).
// En la etapa 2 este archivo es el único que cambia para sincronizar con Supabase.
const KEY = 'alospalos:v1'

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

const defaultSettings: Settings = {
  theme: 'system',
  showWasted: false,
  pointsInFriendlies: false,
  defaultPitch: { length: 100, width: 70, postGap: 5.6 },
  v: 2,
}

/** Cada cuenta es una sola persona: junta todos los pateadores reales en uno ("yo"). */
function ensureMe(d: Data): Data {
  const real = d.players.filter((p) => !p.demo)
  if (!real.length) return { ...d, settings: { ...d.settings, meId: undefined } }
  const pick =
    real.find((p) => p.id === d.settings.meId) ?? real.find((p) => p.id === d.settings.lastPlayerId) ?? real[0]
  const others = new Set(real.filter((p) => p.id !== pick.id).map((p) => p.id))
  if (!others.size && d.settings.meId === pick.id) return d
  return {
    ...d,
    players: d.players.filter((p) => !others.has(p.id)),
    kicks: d.kicks.map((k) => (others.has(k.playerId) ? { ...k, playerId: pick.id } : k)),
    sessions: d.sessions.map((s) => ({ ...s, playerIds: [...new Set(s.playerIds.map((id) => (others.has(id) ? pick.id : id)))] })),
    settings: { ...d.settings, meId: pick.id },
  }
}

function load(): Data {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const d = JSON.parse(raw) as Data & { settings: { v?: number } }
      const st = { ...defaultSettings, ...d.settings }
      // v2: los puntos perdidos pasan a estar apagados por defecto
      if (!d.settings.v) st.showWasted = false
      return ensureMe({ ...d, settings: { ...st, v: 2 } as Settings })
    }
  } catch {
    /* sin storage: arrancamos con ejemplo */
  }
  return { version: 1, settings: defaultSettings, ...makeDemo() }
}

type Action =
  | { t: 'upsertPlayer'; p: Player }
  | { t: 'deletePlayer'; id: string }
  | { t: 'upsertSession'; s: Session }
  | { t: 'deleteSession'; id: string }
  | { t: 'addKick'; k: Kick }
  | { t: 'updateKick'; k: Kick }
  | { t: 'deleteKick'; id: string }
  | { t: 'settings'; s: Partial<Settings> }
  | { t: 'clearDemo' }
  | { t: 'replace'; d: Data }
  | { t: 'setMe'; p: Player }
  | { t: 'importData'; sessions: Session[]; kicks: Kick[] }
  | { t: 'adoptAccount'; uid: string; p: Player; settings?: Partial<Settings> }
  | { t: 'reset' }

function upsert<T extends { id: string }>(arr: T[], item: T) {
  const i = arr.findIndex((x) => x.id === item.id)
  if (i < 0) return [...arr, item]
  const c = arr.slice()
  c[i] = item
  return c
}

export function reducer(d: Data, a: Action): Data {
  switch (a.t) {
    case 'upsertPlayer':
      return { ...d, players: upsert(d.players, a.p) }
    case 'deletePlayer':
      return {
        ...d,
        players: d.players.filter((p) => p.id !== a.id),
        kicks: d.kicks.filter((k) => k.playerId !== a.id),
        sessions: d.sessions.map((s) => ({ ...s, playerIds: s.playerIds.filter((x) => x !== a.id) })),
      }
    case 'upsertSession':
      return { ...d, sessions: upsert(d.sessions, a.s) }
    case 'deleteSession':
      return { ...d, sessions: d.sessions.filter((s) => s.id !== a.id), kicks: d.kicks.filter((k) => k.sessionId !== a.id) }
    case 'addKick':
      return {
        ...d,
        kicks: [...d.kicks, a.k],
        settings: { ...d.settings, lastPlayerId: a.k.playerId },
        sessions: d.sessions.map((s) =>
          s.id === a.k.sessionId && !s.playerIds.includes(a.k.playerId) ? { ...s, playerIds: [...s.playerIds, a.k.playerId] } : s,
        ),
      }
    case 'updateKick':
      return { ...d, kicks: upsert(d.kicks, a.k) }
    case 'deleteKick':
      return { ...d, kicks: d.kicks.filter((k) => k.id !== a.id) }
    case 'settings':
      return { ...d, settings: { ...d.settings, ...a.s } }
    case 'clearDemo': {
      const demoSessions = new Set(d.sessions.filter((s) => s.demo).map((s) => s.id))
      const demoPlayers = new Set(d.players.filter((p) => p.demo).map((p) => p.id))
      return {
        ...d,
        players: d.players.filter((p) => !p.demo),
        sessions: d.sessions.filter((s) => !s.demo),
        kicks: d.kicks.filter((k) => !demoSessions.has(k.sessionId) && !demoPlayers.has(k.playerId)),
      }
    }
    case 'replace':
      return ensureMe({ ...a.d, settings: { ...defaultSettings, ...a.d.settings } })
    case 'adoptAccount': {
      // Lo que estaba en el celular pasa a ser de la cuenta (id del usuario de Supabase)
      const old = d.settings.meId
      const swap = (id: string) => (id === old ? a.uid : id)
      return {
        ...d,
        players: [...d.players.filter((p) => p.demo), a.p],
        kicks: d.kicks.map((k) => (k.id.startsWith('demo-') ? k : { ...k, playerId: swap(k.playerId) })),
        sessions: d.sessions.map((s) => (s.demo ? s : { ...s, playerIds: [a.uid] })),
        settings: { ...d.settings, ...(a.settings ?? {}), meId: a.uid, lastPlayerId: undefined },
      }
    }
    case 'reset':
      return { version: 1, settings: { ...defaultSettings }, ...makeDemo() }
    case 'importData':
      return { ...d, sessions: [...d.sessions, ...a.sessions], kicks: [...d.kicks, ...a.kicks] }
    case 'setMe':
      return { ...d, players: upsert(d.players, a.p), settings: { ...d.settings, meId: a.p.id } }
  }
}

const Ctx = createContext<{ data: Data; dispatch: (a: Action) => void } | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(reducer, undefined, load)
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data))
    } catch {
      /* ignorar */
    }
  }, [data])
  useEffect(() => {
    const root = document.documentElement
    if (data.settings.theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', data.settings.theme)
  }, [data.settings.theme])
  const v = useMemo(() => ({ data, dispatch }), [data])
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>
}

/** El pateador de esta cuenta */
export function useMe() {
  const { data } = useStore()
  return data.players.find((p) => p.id === data.settings.meId)
}

export function useStore() {
  const c = useContext(Ctx)
  if (!c) throw new Error('sin store')
  return c
}
