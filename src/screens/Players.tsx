import { useState } from 'react'
import { useStore, uid } from '../store'
import { useNav, TopBar, Segmented, Field, NumInput } from '../ui'
import { IPlus, IRight, ILeft, ITrash } from '../icons'
import { FOOT_LABEL, type Foot, type Player } from '../types'

export default function Players() {
  const { data } = useStore()
  const nav = useNav()
  return (
    <div className="screen">
      <TopBar title="Jugadores" />
      <main className="content">
        {data.players.length === 0 && (
          <div className="empty">
            <h2>Sin pateadores</h2>
            <p>Agregá a cada pateador con su pie hábil. Sirve para filtrar y para espejar a los zurdos en el análisis.</p>
          </div>
        )}
        <ul className="list">
          {data.players.map((p) => {
            const ks = data.kicks.filter((k) => k.playerId === p.id)
            const made = ks.filter((k) => k.result === 'adentro').length
            return (
              <li key={p.id}>
                <button className="list-row" onClick={() => nav.push({ name: 'playerForm', id: p.id })}>
                  <span className="avatar">{p.number ?? p.name.slice(0, 1).toUpperCase()}</span>
                  <span className="list-text">
                    <strong>{p.name}</strong>
                    <span>
                      Pie {FOOT_LABEL[p.foot].toLowerCase()}
                      {p.position ? ` · ${p.position}` : ''} · {ks.length} patadas{ks.length ? ` · ${Math.round((made / ks.length) * 100)}%` : ''}
                    </span>
                  </span>
                  <IRight size={18} className="muted" />
                </button>
              </li>
            )
          })}
        </ul>
      </main>
      <button className="fab" aria-label="Nuevo jugador" onClick={() => nav.push({ name: 'playerForm' })}>
        <IPlus size={26} />
      </button>
    </div>
  )
}

export function PlayerForm({ id }: { id?: string }) {
  const { data, dispatch } = useStore()
  const nav = useNav()
  const existing = id ? data.players.find((p) => p.id === id) : undefined
  const [p, setP] = useState<Player>(existing ?? { id: uid(), name: '', foot: 'derecho' })
  const [confirm, setConfirm] = useState(false)
  const set = (x: Partial<Player>) => setP((o) => ({ ...o, ...x }))
  const nKicks = data.kicks.filter((k) => k.playerId === p.id).length
  const save = () => {
    dispatch({ t: 'upsertPlayer', p: { ...p, name: p.name.trim() } })
    nav.back()
  }
  return (
    <div className="screen">
      <TopBar
        title={existing ? 'Editar jugador' : 'Nuevo jugador'}
        onBack={nav.back}
        right={
          <button className="btn-text strong" disabled={!p.name.trim()} onClick={save}>
            Guardar
          </button>
        }
      />
      <main className="content form">
        <Field label="Nombre">
          <input id="pf-name" value={p.name} onChange={(e) => set({ name: e.target.value })} placeholder="Nombre o apodo" />
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
        <button className="btn-primary wide" disabled={!p.name.trim()} onClick={save}>
          Guardar
        </button>
        {existing &&
          (confirm ? (
            <div className="confirm inline">
              <span>¿Eliminar a {p.name} y sus {nKicks} patadas?</span>
              <button className="btn-text" onClick={() => setConfirm(false)}>
                Cancelar
              </button>
              <button
                className="btn-danger"
                onClick={() => {
                  dispatch({ t: 'deletePlayer', id: p.id })
                  nav.back()
                }}
              >
                Eliminar
              </button>
            </div>
          ) : (
            <button className="btn-text danger" onClick={() => setConfirm(true)}>
              <ITrash size={18} /> Eliminar jugador
            </button>
          ))}
      </main>
    </div>
  )
}
