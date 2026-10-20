import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore, uid } from '../store'
import { useNav, TopBar, Segmented, Sheet, Chips, fmtDate } from '../ui'
import PitchView from '../components/Pitch'
import { kickGeometry } from '../geo'
import { IEdit, ICheck, IRight, ILeft, IDown, IX, ITry, IPost, ITrash, IRepeat, IZoom } from '../icons'
import { KICK_LABEL, POINTS, RESULT_LABEL, SESSION_LABEL, type Kick, type KickType, type Result } from '../types'
import { sessionPoints } from '../stats'
import { windText } from './SessionForm'

export default function SessionView({ id }: { id: string }) {
  const { data, dispatch } = useStore()
  const nav = useNav()
  const s = data.sessions.find((x) => x.id === id)
  const kicks = useMemo(() => data.kicks.filter((k) => k.sessionId === id).sort((a, b) => a.createdAt - b.createdAt), [data.kicks, id])
  // Cada cuenta es un pateador: en sesiones de ejemplo se usa el jugador de ejemplo
  const playerId = s?.demo ? s.playerIds[0] ?? '' : data.settings.meId ?? s?.playerIds[0] ?? ''
  const [kickType, setKickType] = useState<KickType>('penal')
  const [editMode, setEditMode] = useState(false)
  const [lupa, setLupa] = useState(false)
  const [zoomAt, setZoomAt] = useState<{ x: number; y: number } | null>(null)
  const [tryMode, setTryMode] = useState(false)
  const [tryX, setTryX] = useState<number | null>(null)
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null)
  const [tee, setTee] = useState(true)
  const [half, setHalf] = useState<1 | 2>(() => (kicks.some((k) => k.half === 2) ? 2 : 1))
  const [toast, setToast] = useState<{ kick: Kick; n: number } | null>(null)
  const [detail, setDetail] = useState<string | null>(null)
  const toastTimer = useRef<number>()

  // Mantener la pantalla prendida mientras se cargan patadas
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null
    const nav2 = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
    nav2.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {})
    return () => {
      lock?.release().catch(() => {})
    }
  }, [])

  if (!s) {
    return (
      <div className="screen">
        <TopBar title="Sesión" onBack={nav.back} />
        <main className="content empty"><div className="content-inner">
          <p>Esta sesión ya no existe.</p>
        </div></main>
      </div>
    )
  }

  const isMatch = s.type !== 'entrenamiento'
  const geom = pending ? kickGeometry(pending.x, pending.y, s.pitch) : null
  const pts = sessionPoints(s, kicks, data.settings.pointsInFriendlies)
  const made = kicks.filter((k) => k.result === 'adentro').length
  const useTry = kickType === 'conversion' && tryMode

  function onTap(x: number, y: number) {
    if (!playerId || editMode) return
    // Lupa: el primer toque acerca la zona, el segundo marca el punto exacto
    if (lupa && !useTry && !zoomAt) {
      setZoomAt({ x, y })
      return
    }
    if (useTry) {
      if (tryX == null) {
        setTryX(x)
        setPending(null)
        return
      }
      setPending({ x: tryX, y: Math.max(1, Math.min(y, s!.pitch.length / 2 + 10)) })
      return
    }
    setPending({ x, y: Math.max(0.5, y) })
  }

  function record(result: Result) {
    if (!pending || !playerId) return
    const k: Kick = {
      id: uid(),
      sessionId: s!.id,
      playerId,
      kickType,
      x: pending.x,
      y: pending.y,
      tryX: useTry ? tryX ?? undefined : undefined,
      result,
      half: isMatch ? half : undefined,
      tee: kickType === 'drop' ? undefined : tee,
      createdAt: Date.now(),
    }
    dispatch({ t: 'addKick', k })
    setPending(null)
    setTryX(null)
    setZoomAt(null)
    setToast({ kick: k, n: kicks.length + 1 })
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 4500)
    navigator.vibrate?.(15)
  }

  function cancel() {
    setPending(null)
    setTryX(null)
    setZoomAt(null)
  }

  // Repetir el lugar de la última patada (muy común en los entrenamientos)
  const lastKick = [...kicks].reverse().find((k) => k.playerId === playerId)
  function sameSpot() {
    if (!lastKick) return
    setEditMode(false)
    setZoomAt(null)
    if (lastKick.tryX != null && lastKick.kickType === 'conversion') {
      setKickType('conversion')
      setTryMode(true)
      setTryX(lastKick.tryX)
    }
    setPending({ x: lastKick.x, y: lastKick.y })
  }

  const hint = !playerId
    ? 'Completá tu perfil para cargar patadas'
    : editMode
      ? 'Modo edición: tocá una patada para corregirla o borrarla'
      : lupa && !useTry && !zoomAt
        ? 'Lupa: tocá la zona para acercarla'
        : useTry
      ? tryX == null
        ? 'Tocá dónde se apoyó el try'
        : pending
          ? 'Elegí el resultado o tocá otro punto de la línea'
          : 'Tocá sobre la línea desde dónde se patea'
      : pending
        ? 'Elegí el resultado o tocá otro punto'
        : zoomAt
          ? 'Tocá el punto exacto'
          : 'Tocá desde dónde se patea'

  const detailKick = detail ? kicks.find((k) => k.id === detail) : undefined

  return (
    <div className="screen kick-screen">
      <TopBar
        title={`${SESSION_LABEL[s.type]}${s.opponent ? ` vs ${s.opponent}` : ''}`}
        sub={`${fmtDate(s.date, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}${s.place ? ` · ${s.place}` : ''}`}
        onBack={nav.back}
        right={
          <button className="icon-btn" aria-label="Editar sesión" onClick={() => nav.push({ name: 'sessionForm', id: s.id })}>
            <IEdit />
          </button>
        }
      />
      <div className="kick-body">
      <div className="kick-controls">
        <div className="player-row">
          <span className="row-label">{kicks.length ? 'Adentro en esta sesión' : 'Todavía no hay patadas'}</span>
          <span className="score">
            <strong>
              {made}/{kicks.length}
            </strong>
            {kicks.length > 0 && ` · ${Math.round((made / kicks.length) * 100)}%`}
          </span>
        </div>
        <div className="type-row">
          <Segmented<KickType>
            size="sm"
            label="Tipo de patada"
            value={kickType}
            onChange={(v) => {
              setKickType(v)
              if (v !== 'conversion') {
                setTryX(null)
                setTryMode(false)
              }
            }}
            options={(['penal', 'conversion', 'drop'] as const).map((t) => ({ value: t, label: KICK_LABEL[t] }))}
          />
          <button
            className={`tog${useTry ? ' on' : ''}`}
            aria-pressed={useTry}
            onClick={() => {
              // El modo try es para conversiones: la elige sola
              if (!useTry) {
                setKickType('conversion')
                setTryMode(true)
                setLupa(false)
              } else setTryMode(false)
              setEditMode(false)
              cancel()
            }}
            title="Modo try: marcás el try y después la distancia sobre su línea"
          >
            <ITry size={18} /> Try
          </button>
        </div>
        <div className="pitch-tools">
          <button className="tog" disabled={!lastKick || editMode} onClick={sameSpot} title="Poner la patada en el mismo lugar que la anterior">
            <IRepeat size={16} /> Mismo lugar
          </button>
          <button
            className={`tog${lupa ? ' on' : ''}`}
            aria-pressed={lupa}
            disabled={useTry || editMode}
            onClick={() => {
              setLupa(!lupa)
              setZoomAt(null)
            }}
            title="Lupa: acercar la cancha para marcar el punto exacto"
          >
            <IZoom size={16} /> Lupa
          </button>
          <button
            className={`tog${editMode ? ' on' : ''}`}
            aria-pressed={editMode}
            disabled={!kicks.length}
            onClick={() => {
              setEditMode(!editMode)
              cancel()
            }}
            title="Modo edición: tocar una patada ya cargada para corregirla"
          >
            <IEdit size={16} /> {editMode ? 'Listo' : 'Editar'}
          </button>
          {kickType !== 'drop' && (
            <button className={`tog${tee ? ' on' : ''}`} aria-pressed={tee} onClick={() => setTee(!tee)} title="Con tee o sin tee">
              {tee ? <ICheck size={16} /> : null} Tee
            </button>
          )}
        </div>
        {isMatch && (
        <div className="match-row">
          {isMatch && (
            <Segmented<'1' | '2'> size="sm" label="Tiempo" value={String(half) as '1' | '2'} onChange={(v) => setHalf(Number(v) as 1 | 2)} options={[{ value: '1', label: '1T' }, { value: '2', label: '2T' }]} />
          )}
          {isMatch &&
            (pts ? (
              <span className="points">
                <strong>{pts.made}</strong> pts
                {data.settings.showWasted && (
                  <span className="wasted">
                    {' '}
                    · <strong>{pts.wasted}</strong> perdidos
                  </span>
                )}
              </span>
            ) : (
              <span className="points muted">No suma puntos</span>
            ))}
        </div>
        )}
      </div>

      <div className="pitch-wrap">
        <PitchView
          pitch={s.pitch}
          marks={kicks.map((k) => ({ id: k.id, x: k.x, y: k.y, result: k.result, dim: false }))}
          pending={pending}
          tryX={useTry ? tryX : null}
          tryMode={useTry}
          onTap={onTap}
          onMarkTap={editMode ? (mid) => setDetail(mid) : undefined}
          zoomAt={zoomAt}
        />
        <span className="kick-badge">{KICK_LABEL[kickType]}</span>
        {s.windDir != null && (s.windSpeed ?? 0) > 0 && (
          <span className="wind-badge" title={windText(s.windDir)}>
            <svg width="16" height="16" viewBox="0 0 24 24" style={{ transform: `rotate(${(s.windDir + (isMatch && half === 2 ? 180 : 0)) % 360}deg)` }} aria-hidden="true">
              <path d="M12 20V5M6 10l6-6 6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {s.windSpeed} m/s
          </span>
        )}
        {!toast && <span className="pitch-hint">{hint}</span>}
        {toast && (
          <div className="toast" role="status">
            <span>
              Patada #{toast.n} · {RESULT_LABEL[toast.kick.result]}
              {pts && toast.kick.result === 'adentro' ? ` · +${POINTS[toast.kick.kickType]}` : ''}
            </span>
            <button
              className="btn-text strong"
              onClick={() => {
                dispatch({ t: 'deleteKick', id: toast.kick.id })
                setToast(null)
              }}
            >
              Deshacer
            </button>
          </div>
        )}

      </div>

      <div className="kick-panel">
        <div className="readout">
          <div>
            <span>Distancia</span>
            <strong>{geom ? `${geom.distance.toFixed(1)} m` : '—'}</strong>
          </div>
          <div>
            <span>Ángulo</span>
            <strong>{geom ? `${geom.angle.toFixed(1)}°` : '—'}</strong>
          </div>
          <div>
            <span>Apertura</span>
            <strong>{geom ? `${geom.postGap.toFixed(1)}°` : '—'}</strong>
          </div>
          <button className="icon-btn" disabled={!pending && tryX == null && !zoomAt} onClick={cancel} aria-label="Cancelar">
            <IX />
          </button>
        </div>
        <div className="results">
          <button className="res good" disabled={!pending} onClick={() => record('adentro')}>
            <ICheck /> Adentro
          </button>
          <button className="res bad" disabled={!pending} onClick={() => record('izquierda')}>
            <ILeft /> Izquierda
          </button>
          <button className="res bad" disabled={!pending} onClick={() => record('derecha')}>
            <IRight /> Derecha
          </button>
          <button className="res bad" disabled={!pending} onClick={() => record('corta')}>
            <IDown /> Corta
          </button>
        </div>
        <div className="results-2">
          <button disabled={!pending} onClick={() => record('palo')}>
            <IPost size={18} /> Pegó en el palo
          </button>
          <button disabled={!pending} onClick={() => record('otro')}>
            Otro error
          </button>
        </div>
      </div>
      </div>

      <Sheet open={!!detailKick} onClose={() => setDetail(null)} title={detailKick ? `Patada #${kicks.indexOf(detailKick) + 1}` : ''}>
        {detailKick && (
          <KickDetail
            kick={detailKick}
            pitch={s.pitch}
            playerName=""
            onChange={(k) => dispatch({ t: 'updateKick', k })}
            onDelete={() => {
              dispatch({ t: 'deleteKick', id: detailKick.id })
              setDetail(null)
            }}
          />
        )}
      </Sheet>

    </div>
  )
}

function KickDetail({ kick, pitch, playerName, onChange, onDelete }: { kick: Kick; pitch: { width: number; length: number; postGap: number }; playerName: string; onChange: (k: Kick) => void; onDelete: () => void }) {
  const g = kickGeometry(kick.x, kick.y, pitch)
  const [confirm, setConfirm] = useState(false)
  return (
    <div className="kick-detail">
      <p className="kd-meta">
        {playerName ? `${playerName} · ` : ''}{KICK_LABEL[kick.kickType]} · {g.distance.toFixed(1)} m · {g.angle.toFixed(1)}°{kick.half ? ` · ${kick.half === 1 ? '1er' : '2º'} tiempo` : ''}
        {kick.kickType !== 'drop' ? (kick.tee === false ? ' · sin tee' : ' · con tee') : ''}
      </p>
      <span className="group-label">Resultado</span>
      <Chips<Result>
        value={[kick.result]}
        onChange={(v) => v[0] && onChange({ ...kick, result: v[0] })}
        options={(Object.keys(RESULT_LABEL) as Result[]).map((r) => ({ value: r, label: RESULT_LABEL[r] }))}
      />
      <span className="group-label">Tipo</span>
      <Chips<KickType>
        value={[kick.kickType]}
        onChange={(v) => v[0] && onChange({ ...kick, kickType: v[0] })}
        options={(['penal', 'conversion', 'drop'] as KickType[]).map((r) => ({ value: r, label: KICK_LABEL[r] }))}
      />
      {confirm ? (
        <div className="confirm inline">
          <span>¿Borrar esta patada?</span>
          <button className="btn-text" onClick={() => setConfirm(false)}>
            No
          </button>
          <button className="btn-danger" onClick={onDelete}>
            Borrar
          </button>
        </div>
      ) : (
        <button className="btn-text danger" onClick={() => setConfirm(true)}>
          <ITrash size={18} /> Borrar patada
        </button>
      )}
    </div>
  )
}
