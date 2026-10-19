import { useState } from 'react'
import { useStore } from '../store'
import { useNav, fmtDate } from '../ui'
import { BrandHeader } from '../Brand'
import { ImportCard } from './Import'
import { IPlus, IMore, SessionIcon, WeatherIcon, IEdit, ITrash } from '../icons'
import { SESSION_LABEL } from '../types'
import { sessionPoints } from '../stats'

export default function Sessions() {
  const { data, dispatch } = useStore()
  const nav = useNav()
  const [menu, setMenu] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const sessions = [...data.sessions].sort((a, b) => b.date.localeCompare(a.date))
  const groups = new Map<string, typeof sessions>()
  for (const s of sessions) {
    const d = new Date(s.date)
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(s)
  }
  const today = new Date()
  const hasDemo = data.sessions.some((s) => s.demo)

  return (
    <div className="screen">
      <BrandHeader />
      <main className="content">
        {hasDemo && (
          <div className="notice">
            <p>
              <strong>Estos son datos de ejemplo</strong> para que veas cómo queda el análisis. Cuando cargues tus patadas, borralos.
            </p>
            <button className="btn-text" onClick={() => dispatch({ t: 'clearDemo' })}>
              Borrar ejemplo
            </button>
          </div>
        )}
        {!data.sessions.some((s) => !s.demo) && <ImportCard />}
        <h2 className="section-title">Sesiones</h2>
        {sessions.length === 0 && (
          <div className="empty">
            <h2>Todavía no hay sesiones</h2>
            <p>Tocá el + para arrancar un entrenamiento o un partido. Después vas marcando cada patada en la cancha.</p>
          </div>
        )}
        {[...groups.entries()].map(([key, list]) => {
          const d = new Date(list[0].date)
          const isToday = d.toDateString() === today.toDateString()
          return (
            <section key={key} className="day">
              <h3 className="day-label">
                {isToday ? 'Hoy · ' : ''}
                {fmtDate(list[0].date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              </h3>
              {list.map((s) => {
                const ks = data.kicks.filter((k) => k.sessionId === s.id)
                const made = ks.filter((k) => k.result === 'adentro').length
                const pts = sessionPoints(s, ks, data.settings.pointsInFriendlies)
                return (
                  <div key={s.id} className="session-row">
                    <button className="session-main" onClick={() => nav.push({ name: 'session', id: s.id })}>
                      <span className="session-icon">
                        <SessionIcon type={s.type} />
                      </span>
                      <span className="session-text">
                        <span className="session-title">
                          {SESSION_LABEL[s.type]}
                          {s.opponent ? ` vs ${s.opponent}` : ''} · {fmtDate(s.date, { hour: '2-digit', minute: '2-digit' })}
                          {s.place ? ` · ${s.place}` : ''}
                        </span>
                        <span className="session-sub">
                          {s.temp != null && <span>{Math.round(s.temp)}°C</span>}
                          {s.weather && <WeatherIcon w={s.weather} size={15} />}
                          <span>
                            {ks.length} patada{ks.length === 1 ? '' : 's'}
                            {ks.length ? ` · ${Math.round((made / ks.length) * 100)}%` : ''}
                          </span>
                          {pts && (
                            <span className="pts">
                              {pts.made} pts
                              {data.settings.showWasted && pts.wasted > 0 && <span className="wasted"> · −{pts.wasted}</span>}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                    <button className="icon-btn" aria-label="Opciones" onClick={() => setMenu(menu === s.id ? null : s.id)}>
                      <IMore />
                    </button>
                    {menu === s.id && (
                      <div className="menu" onMouseLeave={() => setMenu(null)}>
                        <button onClick={() => (setMenu(null), nav.push({ name: 'sessionForm', id: s.id }))}>
                          <IEdit size={18} /> Editar datos
                        </button>
                        <button className="danger" onClick={() => (setMenu(null), setConfirmDel(s.id))}>
                          <ITrash size={18} /> Eliminar
                        </button>
                      </div>
                    )}
                    {confirmDel === s.id && (
                      <div className="confirm">
                        <span>¿Eliminar la sesión y sus {ks.length} patadas?</span>
                        <button className="btn-text" onClick={() => setConfirmDel(null)}>
                          Cancelar
                        </button>
                        <button className="btn-danger" onClick={() => (dispatch({ t: 'deleteSession', id: s.id }), setConfirmDel(null))}>
                          Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </section>
          )
        })}
      </main>
      <button className="fab" aria-label="Nueva sesión" onClick={() => nav.push({ name: 'sessionForm' })}>
        <IPlus size={26} />
      </button>
    </div>
  )
}
