import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Data, Kick, Player, Session, Settings } from './types'

// Datos públicos del proyecto (la clave "anon" está pensada para ir en la app;
// la seguridad la ponen las reglas de la base, ver supabase/schema.sql).
const URL = import.meta.env.VITE_SUPABASE_URL || 'https://semhedzprjqbpmmhnyou.supabase.co'
const KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlbWhlZHpwcmpxYnBtbWhueW91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0MzE0MDgsImV4cCI6MjEwODAwNzQwOH0.k6ox-o-iJ8geKtbmgv3Ns-izRpjwoOO2WbKcAwNMUkA'

/** En la vista previa de Claude no hay salida a internet: la app funciona solo en el celular */
export const cloudEnabled = import.meta.env.MODE !== 'single'

export const sb: SupabaseClient | null = cloudEnabled
  ? createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'alospalos-auth' } })
  : null

export type Visibility = 'todos' | 'amigos' | 'nadie'
export interface ProfileRow {
  id: string
  username: string
  name: string
  foot: Player['foot']
  number: number | null
  position: string | null
  height: number | null
  weight: number | null
  dob: string | null
  visibility: Visibility
  settings: Partial<Settings>
}

export const profileToPlayer = (p: ProfileRow): Player => ({
  id: p.id,
  username: p.username,
  name: p.name,
  foot: p.foot,
  number: p.number ?? undefined,
  position: p.position ?? undefined,
  height: p.height ?? undefined,
  weight: p.weight ?? undefined,
  dob: p.dob ?? undefined,
})

export async function usernameAvailable(u: string) {
  if (!sb) return true
  const { data, error } = await sb.rpc('username_available', { u })
  if (error) throw error
  return !!data
}

/** Para entrar con nombre de usuario: la base devuelve el mail solo si la contraseña es correcta */
export async function emailForLogin(username: string, password: string) {
  if (!sb) return null
  const { data, error } = await sb.rpc('email_for_login', { u: username, p: password })
  if (error) throw new Error(/too_many/.test(error.message) ? 'Demasiados intentos con ese usuario. Esperá 15 minutos o entrá con tu mail.' : error.message)
  return (data as string | null) ?? null
}

export async function fetchProfile(id: string): Promise<ProfileRow | null> {
  if (!sb) return null
  const { data, error } = await sb.from('profiles').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data as ProfileRow | null
}

export async function saveProfile(id: string, p: Player, extra?: { visibility?: Visibility; settings?: Partial<Settings> }) {
  if (!sb) return
  const row: Record<string, unknown> = {
    id,
    username: p.username,
    name: p.name,
    foot: p.foot,
    number: p.number ?? null,
    position: p.position ?? null,
    height: p.height ?? null,
    weight: p.weight ?? null,
    dob: p.dob || null,
    updated_at: new Date().toISOString(),
  }
  if (extra?.visibility) row.visibility = extra.visibility
  if (extra?.settings) row.settings = extra.settings
  const { error } = await sb.from('profiles').upsert(row)
  if (error) throw error
}

/* ---------- Sincronización de patadas y sesiones ---------- */
const SNAP = 'alospalos:synced'
type Snap = { uid: string; s: Record<string, string>; k: Record<string, string> }
function loadSnap(uid: string): Snap {
  try {
    const raw = localStorage.getItem(SNAP)
    if (raw) {
      const v = JSON.parse(raw) as Snap
      if (v.uid === uid) return v
    }
  } catch {
    /* nada */
  }
  return { uid, s: {}, k: {} }
}
function saveSnap(v: Snap) {
  try {
    localStorage.setItem(SNAP, JSON.stringify(v))
  } catch {
    /* nada */
  }
}
export function clearSnap() {
  try {
    localStorage.removeItem(SNAP)
  } catch {
    /* nada */
  }
}

const own = (d: Data) => ({
  sessions: d.sessions.filter((s) => !s.demo),
  kicks: d.kicks.filter((k) => !k.id.startsWith('demo-')),
})

/** Sube lo que cambió desde la última vez y borra lo que se borró en el celular. */
export async function pushChanges(uid: string, d: Data) {
  if (!sb) return
  const snap = loadSnap(uid)
  const { sessions, kicks } = own(d)
  const sUp: Session[] = []
  const kUp: Kick[] = []
  const sNow: Record<string, string> = {}
  const kNow: Record<string, string> = {}
  for (const s of sessions) {
    const j = JSON.stringify(s)
    sNow[s.id] = j
    if (snap.s[s.id] !== j) sUp.push(s)
  }
  for (const k of kicks) {
    const j = JSON.stringify(k)
    kNow[k.id] = j
    if (snap.k[k.id] !== j) kUp.push(k)
  }
  const sDel = Object.keys(snap.s).filter((id) => !(id in sNow))
  const kDel = Object.keys(snap.k).filter((id) => !(id in kNow))
  if (!sUp.length && !kUp.length && !sDel.length && !kDel.length) return
  const now = new Date().toISOString()
  // primero sesiones, después patadas (en tandas para no mandar todo junto)
  for (let i = 0; i < sUp.length; i += 200) {
    const { error } = await sb.from('sessions').upsert(sUp.slice(i, i + 200).map((s) => ({ user_id: uid, id: s.id, date: s.date, data: s, updated_at: now })))
    if (error) throw error
  }
  for (let i = 0; i < kUp.length; i += 400) {
    const { error } = await sb
      .from('kicks')
      .upsert(kUp.slice(i, i + 400).map((k) => ({ user_id: uid, id: k.id, session_id: k.sessionId, kick_type: k.kickType, result: k.result, data: k, updated_at: now })))
    if (error) throw error
  }
  for (let i = 0; i < kDel.length; i += 200) {
    const { error } = await sb.from('kicks').delete().eq('user_id', uid).in('id', kDel.slice(i, i + 200))
    if (error) throw error
  }
  for (let i = 0; i < sDel.length; i += 200) {
    const { error } = await sb.from('sessions').delete().eq('user_id', uid).in('id', sDel.slice(i, i + 200))
    if (error) throw error
  }
  saveSnap({ uid, s: sNow, k: kNow })
}

async function fetchAll<T>(table: 'sessions' | 'kicks', uid: string): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb!.from(table).select('data').eq('user_id', uid).range(from, from + 999)
    if (error) throw error
    out.push(...(data ?? []).map((r: { data: T }) => r.data))
    if (!data || data.length < 1000) break
  }
  return out
}

/** Trae todo lo que hay en la cuenta de un usuario (propio o de un amigo, según permisos) */
export async function pullUser(uid: string) {
  const [sessions, kicks] = await Promise.all([fetchAll<Session>('sessions', uid), fetchAll<Kick>('kicks', uid)])
  return { sessions, kicks }
}

/** Junta lo de la nube con lo del celular. Lo de la nube manda en lo que ya estaba sincronizado. */
export function mergeCloud(uid: string, local: Data, cloud: { sessions: Session[]; kicks: Kick[] }): Data {
  const snap = loadSnap(uid)
  const sMap = new Map(local.sessions.map((s) => [s.id, s]))
  const kMap = new Map(local.kicks.map((k) => [k.id, k]))
  const cloudS = new Set(cloud.sessions.map((s) => s.id))
  const cloudK = new Set(cloud.kicks.map((k) => k.id))
  for (const s of cloud.sessions) {
    const loc = sMap.get(s.id)
    // si cambió acá y todavía no se subió, gana lo local
    if (!loc || snap.s[s.id] === JSON.stringify(loc)) sMap.set(s.id, s)
  }
  for (const k of cloud.kicks) {
    const loc = kMap.get(k.id)
    if (!loc || snap.k[k.id] === JSON.stringify(loc)) kMap.set(k.id, k)
  }
  // lo que estaba sincronizado y ya no está en la nube se borró desde otro dispositivo
  for (const id of Object.keys(snap.s)) if (!cloudS.has(id)) sMap.delete(id)
  for (const id of Object.keys(snap.k)) if (!cloudK.has(id)) kMap.delete(id)
  const merged = { ...local, sessions: [...sMap.values()], kicks: [...kMap.values()] }
  // lo que vino de la nube queda marcado como sincronizado
  const s2 = { ...snap.s }
  const k2 = { ...snap.k }
  for (const s of cloud.sessions) if (sMap.get(s.id) === s) s2[s.id] = JSON.stringify(s)
  for (const k of cloud.kicks) if (kMap.get(k.id) === k) k2[k.id] = JSON.stringify(k)
  for (const id of Object.keys(s2)) if (!sMap.has(id)) delete s2[id]
  for (const id of Object.keys(k2)) if (!kMap.has(id)) delete k2[id]
  saveSnap({ uid, s: s2, k: k2 })
  return merged
}

/* ---------- Amigos ---------- */
export interface FriendRow {
  requester: string
  addressee: string
  status: 'pending' | 'accepted'
}
export async function listFriendships(uid: string) {
  if (!sb) return { rows: [] as FriendRow[], profiles: {} as Record<string, ProfileRow> }
  const { data, error } = await sb.from('friendships').select('*').or(`requester.eq.${uid},addressee.eq.${uid}`)
  if (error) throw error
  const rows = (data ?? []) as FriendRow[]
  const ids = [...new Set(rows.map((r) => (r.requester === uid ? r.addressee : r.requester)))]
  const profiles: Record<string, ProfileRow> = {}
  if (ids.length) {
    const { data: ps, error: e2 } = await sb.from('profiles').select('*').in('id', ids)
    if (e2) throw e2
    for (const p of (ps ?? []) as ProfileRow[]) profiles[p.id] = p
  }
  return { rows, profiles }
}
export async function searchUsers(q: string, uid: string) {
  if (!sb || q.trim().length < 2) return []
  const { data, error } = await sb
    .from('profiles')
    .select('id,username,name,foot,number,position,visibility')
    .or(`username.ilike.${q.trim().replace(/[%,()]/g, '')}%,name.ilike.%${q.trim().replace(/[%,()]/g, '')}%`)
    .neq('id', uid)
    .limit(15)
  if (error) throw error
  return (data ?? []) as ProfileRow[]
}
export async function requestFriend(uid: string, other: string) {
  const { error } = await sb!.from('friendships').insert({ requester: uid, addressee: other })
  if (error && error.code !== '23505') throw error
}
export async function acceptFriend(requester: string, uid: string) {
  const { error } = await sb!.from('friendships').update({ status: 'accepted' }).eq('requester', requester).eq('addressee', uid)
  if (error) throw error
}
export async function removeFriend(a: string, b: string) {
  const { error } = await sb!.from('friendships').delete().or(`and(requester.eq.${a},addressee.eq.${b}),and(requester.eq.${b},addressee.eq.${a})`)
  if (error) throw error
}
