import { useMemo, useState } from 'react'
import { useStore, useMe, uid } from '../store'
import { useAuth } from '../auth'
import { Social, VisibilityPicker } from './Friends'
import { useNav, TopBar, Segmented, Field, NumInput } from '../ui'
import { IRight, ILeft, IEdit, IUsers, ITrophy } from '../icons'
import { FOOT_LABEL, POINTS, type Foot, type Kick, type Player, type Session } from '../types'
import { kickGeometry } from '../geo'
import { countsPoints } from '../stats'
import { BrandFull } from '../Brand'

/** Estadísticas generales de un pateador (se usa para mí y para los amigos) */
export function computeStats(kicks: Kick[], sessionList: Session[], pointsInFriendlies: boolean) {
  const sessions = new Map(sessionList.map((s) => [s.id, s]))
  const ks = kicks
    .filter((k) => sessions.has(k.sessionId))
    .sort((a, b) => (sessions.get(a.sessionId)?.date ?? '').localeCompare(sessions.get(b.sessionId)?.date ?? '') || a.createdAt - b.createdAt)
  let streak = 0
  let best = 0
  let longest = 0
  let points = 0
  const piso = { n: 0, made: 0 }
  const drop = { n: 0, made: 0 }
  for (const k of ks) {
    const s = sessions.get(k.sessionId)!
    const g = k.result === 'adentro'
    const bucket = k.kickType === 'drop' ? drop : piso
    bucket.n++
    if (g) bucket.made++
    if (g) {
      streak++
      best = Math.max(best, streak)
      longest = Math.max(longest, kickGeometry(k.x, k.y, s.pitch).distance)
      if (countsPoints(s, pointsInFriendlies)) points += POINTS[k.kickType]
    } else streak = 0
  }
  return { n: ks.length, made: piso.made + drop.made, sessions: new Set(ks.map((k) => k.sessionId)).size, best, current: streak, longest, points, piso, drop }
}
export type Stats = ReturnType<typeof computeStats>

function useMyStats() {
  const { data } = useStore()
  const me = useMe()
  return useMemo(
    () => computeStats(data.kicks.filter((k) => k.playerId === me?.id), data.sessions, data.settings.pointsInFriendlies),
    [data, me?.id],
  )
}

export function StatCards({ st }: { st: Stats }) {
  const p = (c: { n: number; made: number }) => (c.n ? `${Math.round((c.made / c.n) * 100)}%` : '–')
  return (
    <div className="cards">
      <div className="card">
        <span className="card-label">Patadas cargadas</span>
        <strong className="card-big">{st.n}</strong>
        <span className="card-sub">en {st.sessions} sesiones</span>
      </div>
      <div className="card accent">
        <span className="card-label">Acierto total</span>
        <strong className="card-big">{p({ n: st.n, made: st.made })}</strong>
        <span className="card-sub">
          De piso {p(st.piso)} · Drops {p(st.drop)}
        </span>
      </div>
      <div className="card">
        <span className="card-label">Mejor racha</span>
        <strong className="card-big">{st.best}</strong>
        <span className="card-sub">seguidas adentro · ahora {st.current}</span>
      </div>
      <div className="card">
        <span className="card-label">Acierto a mayor distancia</span>
        <strong className="card-big">{st.longest ? `${st.longest.toFixed(1)}` : '–'}</strong>
        <span className="card-sub">metros</span>
      </div>
      <div className="card wide">
        <span className="card-label">Puntos en partidos</span>
        <strong className="card-big">{st.points}</strong>
      </div>
    </div>
  )
}

export default function Profile() {
  const me = useMe()
  const auth = useAuth()
  const nav = useNav()
  const st = useMyStats()
  if (!me) return null
  return (
    <div className="screen">
      <TopBar
        title="Perfil"
        right={
          <button className="icon-btn" aria-label="Editar perfil" onClick={() => nav.push({ name: 'playerForm', id: me.id })}>
            <IEdit />
          </button>
        }
      />
      <main className="content">
        <section className="profile-head">
          <span className="avatar big">{me.number ?? me.name.slice(0, 1).toUpperCase()}</span>
          <div>
            <h2>{me.name}</h2>
            {me.username ? (
              <p className="handle">@{me.username}</p>
            ) : (
              <button className="btn-text" onClick={() => nav.push({ name: 'playerForm', id: me.id })}>
                Elegí tu nombre de usuario
              </button>
            )}
            <p>
              Pie {FOOT_LABEL[me.foot].toLowerCase()}
              {me.position ? ` · ${me.position}` : ''}
              {me.height ? ` · ${me.height} cm` : ''}
            </p>
          </div>
        </section>

        <StatCards st={st} />

        {auth.linked ? (
          <>
            <VisibilityPicker />
            <Social />
          </>
        ) : (
          <section className="social-teaser">
            <div className="social-icons">
              <IUsers size={26} />
              <ITrophy size={26} />
            </div>
            <h3>Amigos y desafíos</h3>
            <p>Funciona en la app publicada con tu cuenta: sumás amigos del club, comparás estadísticas y armás desafíos.</p>
          </section>
        )}
      </main>
    </div>
  )
}

/** Editar el perfil (y primera vez: crear el perfil) */
export function PlayerForm({ id, onboarding }: { id?: string; onboarding?: boolean }) {
  const { data, dispatch } = useStore()
  const nav = useNav()
  const existing = id ? data.players.find((p) => p.id === id) : undefined
  const [p, setP] = useState<Player>(existing ?? { id: uid(), name: '', foot: 'derecho' })
  const set = (x: Partial<Player>) => setP((o) => ({ ...o, ...x }))
  const uname = p.username ?? ''
  const unameOk = /^[a-z0-9._]{3,20}$/.test(uname)
  const canSave = unameOk && p.name.trim().length > 0
  const auth = useAuth()
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const save = async () => {
    if (!canSave) return
    const out = { ...p, name: p.name.trim(), username: uname }
    if (onboarding) return dispatch({ t: 'setMe', p: out })
    if (auth.linked) {
      setBusy(true)
      setErr('')
      try {
        await auth.saveMe(out)
      } catch (e) {
        const m = (e as { code?: string; message?: string }).code === '23505' ? `@${uname} ya está usado. Probá con otro.` : 'No se pudo guardar. Revisá la conexión.'
        setErr(m)
        setBusy(false)
        return
      }
      setBusy(false)
    }
    dispatch({ t: 'upsertPlayer', p: out })
    nav.back()
  }
  const form = (
    <>
      <Field label="Nombre de usuario">
        <span className="at">@</span>
        <input
          id="pf-user"
          value={uname}
          onChange={(e) => set({ username: e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 20) })}
          placeholder="bauti10"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
        />
      </Field>
      <p className="hint">{uname && !unameOk ? 'Mínimo 3 caracteres.' : 'Es con el que te van a buscar tus amigos. Letras, números, punto y guion bajo.'}</p>
      <Field label="Nombre o apodo">
        <input id="pf-name" value={p.name} onChange={(e) => set({ name: e.target.value })} placeholder="Cómo querés que aparezca" autoComplete="nickname" />
      </Field>
      <div className="group">
        <span className="group-label">Pie hábil</span>
        <Segmented<Foot>
          label="Pie hábil"
          value={p.foot}
          onChange={(foot) => set({ foot })}
          options={[
            { value: 'derecho', label: 'Derecho', icon: <IRight size={16} /> },
            { value: 'izquierdo', label: 'Izquierdo', icon: <ILeft size={16} /> },
            { value: 'ambos', label: 'Ambos' },
          ]}
        />
      </div>
      <div className="row2">
        <Field label="Número">
          <NumInput id="pf-num" value={p.number} onChange={(number) => set({ number })} />
        </Field>
        <Field label="Puesto">
          <input id="pf-pos" value={p.position ?? ''} onChange={(e) => set({ position: e.target.value })} placeholder="Ej: Apertura" />
        </Field>
      </div>
      {!onboarding && (
        <>
          <div className="row2">
            <Field label="Altura" suffix="cm">
              <NumInput id="pf-h" value={p.height} onChange={(height) => set({ height })} />
            </Field>
            <Field label="Peso" suffix="kg">
              <NumInput id="pf-w" value={p.weight} onChange={(weight) => set({ weight })} />
            </Field>
          </div>
          <Field label="Fecha de nacimiento">
            <input id="pf-dob" type="date" value={p.dob ?? ''} onChange={(e) => set({ dob: e.target.value || undefined })} />
          </Field>
        </>
      )}
      {err && <p className="status error">{err}</p>}
      <button className="btn-primary wide" disabled={!canSave || busy} onClick={save}>
        {onboarding ? 'Empezar' : 'Guardar'}
      </button>
    </>
  )
  if (onboarding)
    return (
      <div className="screen onboarding">
        <main className="content form">
          <BrandFull />
          <p className="onb-text">Registrá cada patada a los palos, en práctica o en partido, y mirá desde dónde acertás más.</p>
          {form}
        </main>
      </div>
    )
  return (
    <div className="screen">
      <TopBar
        title="Editar perfil"
        onBack={nav.back}
        right={
          <button className="btn-text strong" disabled={!canSave} onClick={save}>
            Guardar
          </button>
        }
      />
      <main className="content form">{form}</main>
    </div>
  )
}
