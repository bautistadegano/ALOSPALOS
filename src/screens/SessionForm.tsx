import { useEffect, useState } from 'react'
import { useStore, uid } from '../store'
import { useNav, TopBar, Segmented, Field, Chips, NumInput } from '../ui'
import { ICal, IPin, IUsers, SessionIcon, WeatherIcon, ICheck, IPost } from '../icons'
import { WEATHER_LABEL, type Session, type SessionType, type Weather } from '../types'
import { fetchConditions } from '../weather'

const toLocalInput = (iso: string) => {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

// Dirección del viento: hacia dónde sopla, con los palos arriba
const DIRS: { deg: number | null; row: number; col: number; label: string }[] = [
  { deg: 315, row: 0, col: 0, label: 'A favor, cruzado a la izquierda' },
  { deg: 0, row: 0, col: 1, label: 'A favor' },
  { deg: 45, row: 0, col: 2, label: 'A favor, cruzado a la derecha' },
  { deg: 270, row: 1, col: 0, label: 'Cruzado, de derecha a izquierda' },
  { deg: null, row: 1, col: 1, label: 'Sin dirección' },
  { deg: 90, row: 1, col: 2, label: 'Cruzado, de izquierda a derecha' },
  { deg: 225, row: 2, col: 0, label: 'En contra, cruzado a la izquierda' },
  { deg: 180, row: 2, col: 1, label: 'En contra' },
  { deg: 135, row: 2, col: 2, label: 'En contra, cruzado a la derecha' },
]

export function windText(deg: number | null | undefined) {
  if (deg == null) return 'Sin dirección'
  return DIRS.find((d) => d.deg === deg)?.label ?? ''
}

export default function SessionForm({ id }: { id?: string }) {
  const { data, dispatch } = useStore()
  const nav = useNav()
  const existing = id ? data.sessions.find((s) => s.id === id) : undefined
  const [s, setS] = useState<Session>(
    () =>
      existing ?? {
        id: uid(),
        type: 'entrenamiento',
        date: new Date().toISOString(),
        place: '',
        pitch: { ...data.settings.defaultPitch },
        playerIds: data.settings.meId ? [data.settings.meId] : [],
        windDir: null,
        createdAt: Date.now(),
      },
  )
  const [pitchOpen, setPitchOpen] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'fail'>('idle')
  const set = (p: Partial<Session>) => setS((x) => ({ ...x, ...p }))

  useEffect(() => {
    if (existing) return
    let alive = true
    setStatus('loading')
    fetchConditions()
      .then((c) => {
        if (!alive) return
        setS((x) => ({
          ...x,
          place: x.place || c.place || '',
          temp: x.temp ?? c.temp,
          weather: x.weather ?? c.weather,
          windSpeed: x.windSpeed ?? c.windSpeed,
        }))
        setStatus(c.temp != null ? 'ok' : 'fail')
      })
      .catch(() => alive && setStatus('fail'))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const canSave = true

  function save() {
    const playerIds = data.settings.meId ? [data.settings.meId] : s.playerIds
    const out = { ...s, playerIds }
    dispatch({ t: 'upsertSession', s: out })
    if (existing) nav.back()
    else nav.replace({ name: 'session', id: out.id })
  }

  return (
    <div className="screen">
      <TopBar
        title={existing ? 'Editar sesión' : 'Nueva sesión'}
        onBack={nav.back}
        right={
          <button className="btn-text strong" disabled={!canSave} onClick={save}>
            {existing ? 'Guardar' : 'Empezar'}
          </button>
        }
      />
      <main className="content form">
        {status !== 'idle' && (
          <p className={`status status-${status}`}>
            {status === 'loading' && 'Buscando lugar y clima…'}
            {status === 'ok' && (
              <>
                <ICheck size={16} /> Clima cargado{s.windSpeed != null ? ` · viento ${s.windSpeed} m/s` : ''}
              </>
            )}
            {status === 'fail' && 'No se pudo cargar el clima automático. Completalo a mano si querés.'}
          </p>
        )}
        <div className="group">
          <span className="group-label">Tipo</span>
          <Segmented<SessionType>
            label="Tipo de sesión"
            value={s.type}
            onChange={(type) => set({ type })}
            options={(['entrenamiento', 'amistoso', 'partido'] as const).map((t) => ({
              value: t,
              label: t === 'entrenamiento' ? 'Entrenamiento' : t === 'amistoso' ? 'Amistoso' : 'Partido',
              icon: <SessionIcon type={t} size={18} />,
            }))}
          />
          {s.type !== 'entrenamiento' && (
            <p className="hint">
              {s.type === 'partido' || data.settings.pointsInFriendlies
                ? 'Suma puntos: conversión 2, penal 3, drop 3.'
                : 'Los amistosos no suman puntos (se cambia en Ajustes).'}
            </p>
          )}
        </div>

        <Field label="Fecha y hora" icon={<ICal />}>
          <input id="sf-date" type="datetime-local" value={toLocalInput(s.date)} onChange={(e) => e.target.value && set({ date: new Date(e.target.value).toISOString() })} />
        </Field>
        <Field label="Lugar" icon={<IPin />}>
          <input id="sf-place" value={s.place} onChange={(e) => set({ place: e.target.value })} placeholder="Ingresá el lugar" />
        </Field>
        {s.type !== 'entrenamiento' && (
          <Field label="Rival" icon={<IUsers />}>
            <input id="sf-opp" value={s.opponent ?? ''} onChange={(e) => set({ opponent: e.target.value })} placeholder="Ingresá el rival" />
          </Field>
        )}
        <div className="row2">
          <Field label="Temperatura" suffix="°C">
            <NumInput id="sf-temp" value={s.temp} onChange={(temp) => set({ temp })} />
          </Field>
          <Field label="Viento" suffix="m/s">
            <NumInput id="sf-wind" value={s.windSpeed} onChange={(windSpeed) => set({ windSpeed })} />
          </Field>
        </div>

        <div className="group">
          <span className="group-label">Clima</span>
          <div className="weather-pick">
            {(Object.keys(WEATHER_LABEL) as Weather[]).map((w) => (
              <button key={w} type="button" className={s.weather === w ? 'on' : ''} aria-pressed={s.weather === w} onClick={() => set({ weather: s.weather === w ? undefined : w })}>
                <WeatherIcon w={w} size={20} />
                <span>{WEATHER_LABEL[w]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="group">
          <span className="group-label">Dirección del viento</span>
          <div className="wind-wrap">
            <div className="wind-grid" role="radiogroup" aria-label="Dirección del viento">
              {DIRS.map((d) => (
                <button
                  key={String(d.deg)}
                  type="button"
                  role="radio"
                  aria-checked={s.windDir === d.deg}
                  aria-label={d.label}
                  className={s.windDir === d.deg ? 'on' : ''}
                  onClick={() => set({ windDir: d.deg })}
                >
                  {d.deg == null ? (
                    <IPost size={22} />
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" style={{ transform: `rotate(${d.deg}deg)` }} aria-hidden="true">
                      <path d="M12 20V5M6 10l6-6 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
            <p className="hint">
              Los palos están arriba. Elegí hacia dónde sopla el viento: <strong>{windText(s.windDir)}</strong>.
              {s.type !== 'entrenamiento' && ' En partido es para el 1er tiempo; en el 2º se da vuelta solo.'}
            </p>
          </div>
          <Field label="Nota del viento">
            <input id="sf-windnote" value={s.windNote ?? ''} onChange={(e) => set({ windNote: e.target.value })} placeholder="Ingresá una nota sobre el viento" />
          </Field>
        </div>

        <Field label="Nota">
          <input id="sf-note" value={s.note ?? ''} onChange={(e) => set({ note: e.target.value })} placeholder="Ingresá una nota" />
        </Field>

        <button className="collapse" type="button" aria-expanded={pitchOpen} onClick={() => setPitchOpen(!pitchOpen)}>
          <span>
            <span className="group-label">Medidas de la cancha</span>
            <span className="collapse-val">
              {s.pitch.length} × {s.pitch.width} m · palos a {s.pitch.postGap} m
            </span>
          </span>
          <span className={`chev${pitchOpen ? ' up' : ''}`}>⌄</span>
        </button>
        {pitchOpen && (
          <div className="row3">
            <Field label="Largo" suffix="m">
              <NumInput id="sf-len" value={s.pitch.length} onChange={(v) => v && set({ pitch: { ...s.pitch, length: v } })} />
            </Field>
            <Field label="Ancho" suffix="m">
              <NumInput id="sf-wid" value={s.pitch.width} onChange={(v) => v && set({ pitch: { ...s.pitch, width: v } })} />
            </Field>
            <Field label="Entre palos" suffix="m">
              <NumInput id="sf-gap" value={s.pitch.postGap} onChange={(v) => v && set({ pitch: { ...s.pitch, postGap: v } })} />
            </Field>
          </div>
        )}
        <button className="btn-primary wide" disabled={!canSave} onClick={save}>
          {existing ? 'Guardar cambios' : 'Empezar a cargar patadas'}
        </button>
      </main>
    </div>
  )
}
