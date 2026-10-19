import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { sb, cloudEnabled, fetchProfile, profileToPlayer, saveProfile, pushChanges, pullUser, mergeCloud, clearSnap, type ProfileRow, type Visibility } from './cloud'
import { useStore, reducer } from './store'
import type { Player, Settings } from './types'

type SyncState = 'off' | 'syncing' | 'ok' | 'offline' | 'error'

interface AuthCtx {
  enabled: boolean
  ready: boolean
  user: User | null
  profile: ProfileRow | null
  recovering: boolean
  /** mensaje para mostrar en la pantalla de ingreso (link vencido, mail confirmado, etc.) */
  notice: string
  clearNotice: () => void
  sync: SyncState
  lastSync: number | null
  syncError: string
  /** la cuenta ya está lista para usar la app */
  linked: boolean
  signOut: () => Promise<void>
  setVisibility: (v: Visibility) => Promise<void>
  saveMe: (p: Player) => Promise<void>
  doneRecovering: () => void
  syncNow: () => void
}
const Ctx = createContext<AuthCtx | null>(null)
export const useAuth = () => useContext(Ctx)!

const pickSettings = (s: Settings): Partial<Settings> => ({ theme: s.theme, showWasted: s.showWasted, pointsInFriendlies: s.pointsInFriendlies, defaultPitch: s.defaultPitch })

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, dispatch } = useStore()
  const [ready, setReady] = useState(!cloudEnabled)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [recovering, setRecovering] = useState(false)
  const [notice, setNotice] = useState('')
  const [sync, setSync] = useState<SyncState>('off')
  const [lastSync, setLastSync] = useState<number | null>(null)
  const [syncError, setSyncError] = useState('')
  const [linked, setLinked] = useState(false)
  const dataRef = useRef(data)
  dataRef.current = data
  const pushTimer = useRef<number>()
  const pushing = useRef(false)

  // Sesión de Supabase
  useEffect(() => {
    if (!sb) return
    const { data: sub } = sb.auth.onAuthStateChange((ev, session) => {
      if (ev === 'PASSWORD_RECOVERY') setRecovering(true)
      setUser(session?.user ?? null)
    })
    ;(async () => {
      // Links de los mails: ?token_hash=...&type=signup|recovery|email
      // La verificación la hace la app (no el link), así los antivirus de los mails no "gastan" el link.
      const url = new URL(location.href)
      const tokenHash = url.searchParams.get('token_hash')
      const type = url.searchParams.get('type') as 'signup' | 'email' | 'recovery' | 'invite' | 'email_change' | null
      const hash = new URLSearchParams(location.hash.replace(/^#/, ''))
      const clean = () => {
        try {
          history.replaceState(null, '', location.pathname)
        } catch {
          /* nada */
        }
      }
      if (tokenHash && type) {
        const { data: vd, error } = await sb!.auth.verifyOtp({ token_hash: tokenHash, type })
        clean()
        if (error) {
          setNotice(
            /expired|invalid/i.test(error.message)
              ? 'El link ya se usó o venció. Si ya confirmaste, entrá con tu mail y contraseña; si no, pedí un mail nuevo.'
              : /fetch/i.test(error.message)
                ? 'No hay conexión para confirmar el mail. Abrí el link de nuevo cuando tengas señal.'
                : `No se pudo confirmar: ${error.message}`,
          )
        } else {
          if (type === 'recovery') setRecovering(true)
          else setNotice('¡Mail confirmado! Ya podés usar la app.')
          setUser(vd.session?.user ?? vd.user ?? null)
        }
      } else if (hash.get('error_description')) {
        // Links viejos que vuelven con error en la dirección
        const code = hash.get('error_code') ?? ''
        setNotice(
          code === 'otp_expired'
            ? 'El link ya se usó o venció. Si ya confirmaste, entrá con tu mail y contraseña; si no, pedí un mail nuevo.'
            : `No se pudo confirmar: ${hash.get('error_description')}`,
        )
        clean()
      }
      const { data: d } = await sb!.auth.getSession()
      setUser(d.session?.user ?? null)
      setReady(true)
    })()
    return () => sub.subscription.unsubscribe()
  }, [])

  // Al entrar: traer perfil, pasar lo del celular a la cuenta y juntar con la nube
  useEffect(() => {
    if (!sb || !user) {
      setLinked(false)
      setProfile(null)
      return
    }
    let alive = true
    const uid = user.id
    ;(async () => {
      setSync('syncing')
      try {
        let prof = await fetchProfile(uid)
        if (!prof) {
          // El perfil lo crea la base al confirmar el mail; por las dudas lo creamos acá
          const meta = user.user_metadata as { username?: string; name?: string; foot?: Player['foot'] }
          const p: Player = { id: uid, username: meta.username ?? `user${uid.slice(0, 6)}`, name: meta.name ?? '', foot: meta.foot ?? 'derecho' }
          await saveProfile(uid, p)
          prof = await fetchProfile(uid)
        }
        if (!alive || !prof) return
        setProfile(prof)
        // Si este celular tenía datos de OTRA cuenta, se arranca de cero para no mezclar
        let local = dataRef.current
        let owner: string | null = null
        try {
          owner = localStorage.getItem('alospalos:owner')
        } catch {
          /* nada */
        }
        if (owner && owner !== uid) {
          clearSnap()
          local = reducer(local, { t: 'reset' })
        }
        const localMe = local.players.find((p) => p.id === local.settings.meId)
        const remote = profileToPlayer(prof)
        // Si en la nube faltan datos del perfil que sí estaban en el celular, se completan
        const merged: Player = { ...localMe, ...Object.fromEntries(Object.entries(remote).filter(([, v]) => v !== undefined && v !== '')), id: uid } as Player
        const adopted = reducer(local, { t: 'adoptAccount', uid, p: merged, settings: prof.settings && Object.keys(prof.settings).length ? prof.settings : undefined })
        const cloud = await pullUser(uid)
        if (!alive) return
        dispatch({ t: 'replace', d: mergeCloud(uid, adopted, cloud) })
        try {
          localStorage.setItem('alospalos:owner', uid)
        } catch {
          /* nada */
        }
        setLinked(true)
        setSync('ok')
        setLastSync(Date.now())
      } catch (e) {
        if (!alive) return
        // Sin señal: si este celular ya era de la cuenta, se sigue usando y se sube después
        if (dataRef.current.settings.meId === uid) {
          setLinked(true)
          setSync('offline')
        } else {
          setSync('error')
          setSyncError((e as Error).message)
        }
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  async function doPush() {
    if (!sb || !user || !linked || pushing.current) return
    pushing.current = true
    setSync('syncing')
    try {
      await pushChanges(user.id, dataRef.current)
      setSync('ok')
      setLastSync(Date.now())
      setSyncError('')
    } catch (e) {
      setSync(navigator.onLine ? 'error' : 'offline')
      setSyncError((e as Error).message)
    } finally {
      pushing.current = false
    }
  }

  // Cada cambio se sube a los segundos
  useEffect(() => {
    if (!linked) return
    window.clearTimeout(pushTimer.current)
    pushTimer.current = window.setTimeout(doPush, 1500)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.sessions, data.kicks, linked])

  // Ajustes de la cuenta (tema, puntos, cancha) viajan con el perfil
  const settingsJson = JSON.stringify(pickSettings(data.settings))
  useEffect(() => {
    if (!linked || !user || !profile) return
    if (JSON.stringify(profile.settings ?? {}) === settingsJson) return
    const t = window.setTimeout(() => {
      sb!.from('profiles').update({ settings: JSON.parse(settingsJson) }).eq('id', user.id).then(({ error }) => {
        if (!error) setProfile((p) => (p ? { ...p, settings: JSON.parse(settingsJson) } : p))
      })
    }, 1500)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsJson, linked])

  // Al volver a la app o recuperar señal: subir pendientes y traer lo de otros dispositivos
  useEffect(() => {
    if (!linked || !user) return
    const refresh = async () => {
      if (document.visibilityState !== 'visible') return
      await doPush()
      try {
        const cloud = await pullUser(user.id)
        dispatch({ t: 'replace', d: mergeCloud(user.id, { ...dataRef.current }, cloud) })
      } catch {
        /* sin señal */
      }
    }
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('online', refresh)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('online', refresh)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linked, user?.id])

  const value = useMemo<AuthCtx>(
    () => ({
      enabled: cloudEnabled,
      ready,
      user,
      profile,
      recovering,
      notice,
      clearNotice: () => setNotice(''),
      sync,
      lastSync,
      syncError,
      linked,
      signOut: async () => {
        try {
          if (user) await pushChanges(user.id, dataRef.current)
        } catch {
          /* se pierde solo lo no subido */
        }
        await sb?.auth.signOut()
        clearSnap()
        try {
          localStorage.removeItem('alospalos:owner')
        } catch {
          /* nada */
        }
        dispatch({ t: 'reset' })
      },
      setVisibility: async (v) => {
        if (!sb || !user) return
        const { error } = await sb.from('profiles').update({ visibility: v }).eq('id', user.id)
        if (error) throw error
        setProfile((p) => (p ? { ...p, visibility: v } : p))
      },
      saveMe: async (p) => {
        if (!user) return
        await saveProfile(user.id, p)
        setProfile(await fetchProfile(user.id))
      },
      doneRecovering: () => setRecovering(false),
      syncNow: () => void doPush(),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, user, profile, recovering, notice, sync, lastSync, syncError, linked],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
