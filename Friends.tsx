import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth'
import { useStore } from '../store'
import { useNav, TopBar, Segmented } from '../ui'
import { IChevron, IUsers, ICheck, IX, IPlus } from '../icons'
import { acceptFriend, fetchProfile, listFriendships, pullUser, removeFriend, requestFriend, searchUsers, type FriendRow, type ProfileRow, type Visibility } from '../cloud'
import { computeStats, StatCards } from './Profile'
import PitchView from '../components/Pitch'
import { enrich } from '../geo'
import { summarize, fmtPct } from '../stats'
import { BANDS, BAND_LABEL } from '../geo'
import { FOOT_LABEL, type Kick, type Session } from '../types'

const VIS_LABEL: Record<Visibility, string> = { todos: 'Todos', amigos: 'Mis amigos', nadie: 'Nadie' }
const VIS_HINT: Record<Visibility, string> = {
  todos: 'Cualquier usuario de la app puede ver tus estadísticas.',
  amigos: 'Solo tus amigos ven tus estadísticas. Los demás ven tu nombre y usuario.',
  nadie: 'Nadie ve tus estadísticas. Igual te pueden encontrar por tu usuario.',
}

export function VisibilityPicker() {
  const auth = useAuth()
  const [err, setErr] = useState('')
  const v = auth.profile?.visibility ?? 'amigos'
  return (
    <section className="group">
      <span className="group-label">Quién ve tus estadísticas</span>
      <Segmented<Visibility>
        label="Quién ve tus estadísticas"
        value={v}
        onChange={(nv) => auth.setVisibility(nv).catch(() => setErr('No se pudo guardar. Revisá la conexión.'))}
        options={(['todos', 'amigos', 'nadie'] as Visibility[]).map((x) => ({ value: x, label: VIS_LABEL[x] }))}
      />
      <p className="hint">{err || VIS_HINT[v]}</p>
    </section>
  )
}

function Avatar({ p }: { p: Pick<ProfileRow, 'name' | 'number' | 'username'> }) {
  return <span className="avatar">{p.number ?? (p.name || p.username).slice(0, 1).toUpperCase()}</span>
}

export function Social() {
  const auth = useAuth()
  const nav = useNav()
  const uid = auth.user!.id
  const [rows, setRows] = useState<FriendRow[]>([])
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({})
  const [q, setQ] = useState('')
  const [results, setResults] = useState<ProfileRow[]>([])
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)

  async function reload() {
    try {
      const r = await listFriendships(uid)
      setRows(r.rows)
      setProfiles(r.profiles)
      setErr('')
    } catch {
      setErr('No se pudieron cargar tus amigos. Revisá la conexión.')
    }
    setLoading(false)
  }
  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid])

  useEffect(() => {
    const t = window.setTimeout(() => {
      searchUsers(q, uid)
        .then(setResults)
        .catch(() => setResults([]))
    }, 300)
    return () => window.clearTimeout(t)
  }, [q, uid])

  const other = (r: FriendRow) => (r.requester === uid ? r.addressee : r.requester)
  const friends = rows.filter((r) => r.status === 'accepted')
  const incoming = rows.filter((r) => r.status === 'pending' && r.addressee === uid)
  const outgoing = rows.filter((r) => r.status === 'pending' && r.requester === uid)
  const relation = (id: string) => rows.find((r) => other(r) === id)

  const act = async (fn: () => Promise<void>) => {
    try {
      await fn()
      await reload()
    } catch {
      setErr('No se pudo. Revisá la conexión y probá de nuevo.')
    }
  }

  return (
    <section className="social">
      <h3 className="social-title">
        <IUsers size={22} /> Amigos
      </h3>
      <div className="search">
        <span className="at">@</span>
        <input id="fr-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ingresá un usuario o nombre" autoCapitalize="none" spellCheck={false} />
      </div>
      {q.trim().length >= 2 && (
        <ul className="list people">
          {results.length === 0 && <li className="hint">No encontramos a nadie con “{q.trim()}”.</li>}
          {results.map((p) => {
            const r = relation(p.id)
            return (
              <li key={p.id} className="person">
                <Avatar p={p} />
                <span className="list-text">
                  <strong>{p.name || p.username}</strong>
                  <span>@{p.username}</span>
                </span>
                {!r ? (
                  <button className="chip on" onClick={() => act(() => requestFriend(uid, p.id))}>
                    <IPlus size={16} /> Agregar
                  </button>
                ) : r.status === 'accepted' ? (
                  <button className="chip" onClick={() => nav.push({ name: 'friend', id: p.id })}>
                    Ver
                  </button>
                ) : r.requester === uid ? (
                  <span className="pill-muted">Pendiente</span>
                ) : (
                  <button className="chip on" onClick={() => act(() => acceptFriend(p.id, uid))}>
                    <ICheck size={16} /> Aceptar
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {incoming.length > 0 && (
        <>
          <span className="group-label">Te quieren agregar</span>
          <ul className="list people">
            {incoming.map((r) => {
              const p = profiles[r.requester]
              if (!p) return null
              return (
                <li key={r.requester} className="person">
                  <Avatar p={p} />
                  <span className="list-text">
                    <strong>{p.name || p.username}</strong>
                    <span>@{p.username}</span>
                  </span>
                  <button className="icon-btn" aria-label="Rechazar" onClick={() => act(() => removeFriend(uid, r.requester))}>
                    <IX />
                  </button>
                  <button className="chip on" onClick={() => act(() => acceptFriend(r.requester, uid))}>
                    <ICheck size={16} /> Aceptar
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <span className="group-label">Tus amigos{friends.length ? ` (${friends.length})` : ''}</span>
      {loading ? (
        <p className="hint">Cargando…</p>
      ) : friends.length === 0 ? (
        <p className="hint">Todavía no agregaste a nadie. Buscalos por su nombre de usuario.</p>
      ) : (
        <ul className="list people">
          {friends.map((r) => {
            const p = profiles[other(r)]
            if (!p) return null
            return (
              <li key={p.id}>
                <button className="list-row" onClick={() => nav.push({ name: 'friend', id: p.id })}>
                  <Avatar p={p} />
                  <span className="list-text">
                    <strong>{p.name || p.username}</strong>
                    <span>
                      @{p.username} · pie {FOOT_LABEL[p.foot].toLowerCase()}
                    </span>
                  </span>
                  <IChevron size={18} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {outgoing.length > 0 && (
        <p className="hint">
          Esperando respuesta: {outgoing.map((r) => `@${profiles[r.addressee]?.username ?? '…'}`).join(', ')}
        </p>
      )}
      {err && <p className="status error">{err}</p>}
    </section>
  )
}

/** Perfil de otro usuario: sus estadísticas (si las deja ver) y comparación conmigo */
export function FriendProfile({ id }: { id: string }) {
  const auth = useAuth()
  const nav = useNav()
  const { data } = useStore()
  const [p, setP] = useState<ProfileRow | null>(null)
  const [kd, setKd] = useState<{ sessions: Session[]; kicks: Kick[] } | null>(null)
  const [isFriend, setIsFriend] = useState(false)
  const [err, setErr] = useState('')
  const [confirm, setConfirm] = useState(false)
  const uid = auth.user!.id

  useEffect(() => {
    ;(async () => {
      try {
        const [prof, rel, cloud] = await Promise.all([fetchProfile(id), listFriendships(uid), pullUser(id)])
        setP(prof)
        setIsFriend(rel.rows.some((r) => r.status === 'accepted' && (r.requester === id || r.addressee === id)))
        setKd(cloud)
      } catch {
        setErr('No se pudo cargar el perfil. Revisá la conexión.')
      }
    })()
  }, [id, uid])

  const canSee = p && (p.visibility === 'todos' || (p.visibility === 'amigos' && isFriend))
  const st = useMemo(() => (kd ? computeStats(kd.kicks, kd.sessions, data.settings.pointsInFriendlies) : null), [kd, data.settings.pointsInFriendlies])
  const theirs = useMemo(() => {
    if (!kd || !p) return null
    const sm = new Map(kd.sessions.map((s) => [s.id, s]))
    const pl = { id: p.id, name: p.name, foot: p.foot }
    const ek = kd.kicks.filter((k) => k.kickType !== 'drop' && sm.has(k.sessionId)).map((k) => enrich(k, sm.get(k.sessionId)!, pl, false))
    return { ek, sum: summarize(ek, 5, data.settings.pointsInFriendlies) }
  }, [kd, p, data.settings.pointsInFriendlies])
  const mine = useMemo(() => {
    const sm = new Map(data.sessions.map((s) => [s.id, s]))
    const me = data.players.find((x) => x.id === data.settings.meId)
    const ek = data.kicks.filter((k) => k.playerId === data.settings.meId && k.kickType !== 'drop' && sm.has(k.sessionId)).map((k) => enrich(k, sm.get(k.sessionId)!, me, false))
    return summarize(ek, 5, data.settings.pointsInFriendlies)
  }, [data])
  const ref = data.settings.defaultPitch

  return (
    <div className="screen">
      <TopBar title={p ? p.name || `@${p.username}` : 'Perfil'} onBack={nav.back} />
      <main className="content"><div className="content-inner">
        {err && <p className="status error">{err}</p>}
        {!p && !err && <p className="hint">Cargando…</p>}
        {p && (
          <section className="profile-head">
            <span className="avatar big">{p.number ?? (p.name || p.username).slice(0, 1).toUpperCase()}</span>
            <div>
              <h2>{p.name || p.username}</h2>
              <p className="handle">@{p.username}</p>
              <p>
                Pie {FOOT_LABEL[p.foot].toLowerCase()}
                {p.position ? ` · ${p.position}` : ''}
              </p>
            </div>
          </section>
        )}
        {p && !canSee && (
          <div className="empty small">
            <p>{p.visibility === 'nadie' ? 'Este perfil no muestra sus estadísticas.' : 'Solo sus amigos ven sus estadísticas.'}</p>
          </div>
        )}
        {p && canSee && st && theirs && (
          <>
            <StatCards st={st} />
            <h3 className="section-title">Vos vs. {p.name || p.username}</h3>
            <p className="hint">Acierto en patadas de piso por distancia.</p>
            <div className="table-scroll">
              <table className="cmp-table">
                <thead>
                  <tr>
                    <th />
                    <th>Vos</th>
                    <th>{p.name || p.username}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th>Total</th>
                    <td>
                      {fmtPct(mine.total)} <small>{mine.total.n}</small>
                    </td>
                    <td>
                      {fmtPct(theirs.sum.total)} <small>{theirs.sum.total.n}</small>
                    </td>
                  </tr>
                  {BANDS.map((b) => (
                    <tr key={b}>
                      <th>{BAND_LABEL[b]}</th>
                      <td>
                        {fmtPct(mine.byBand.get(b)!)} <small>{mine.byBand.get(b)!.n}</small>
                      </td>
                      <td>
                        {fmtPct(theirs.sum.byBand.get(b)!)} <small>{theirs.sum.byBand.get(b)!.n}</small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3 className="section-title">Su mapa de zonas</h3>
            <div className="map-card">
              <PitchView pitch={ref} compact zones={theirs.sum.zones} minAttempts={5} showMarks={false} labelMode="pct" />
            </div>
          </>
        )}
        {p && isFriend && (
          <div className="danger-zone">
            {confirm ? (
              <div className="confirm inline">
                <span>¿Sacar a {p.name || p.username} de tus amigos?</span>
                <button className="btn-text" onClick={() => setConfirm(false)}>
                  No
                </button>
                <button
                  className="btn-danger"
                  onClick={async () => {
                    await removeFriend(uid, id).catch(() => {})
                    nav.back()
                  }}
                >
                  Sacar
                </button>
              </div>
            ) : (
              <button className="btn-text danger" onClick={() => setConfirm(true)}>
                Sacar de mis amigos
              </button>
            )}
          </div>
        )}
      </div></main>
    </div>
  )
}
