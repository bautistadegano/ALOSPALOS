import { useRef, useState } from 'react'
import { useStore } from '../store'
import { TopBar, Segmented, Switch, Field, NumInput, Sheet } from '../ui'
import { sb } from '../cloud'
import { ILink, IDownload, IUpload, ITrash, IKey, ILogout } from '../icons'
import { deliver } from '../export'
import { BrandFull } from '../Brand'
import { useAuth } from '../auth'
import { ImportCard } from './Import'
import type { Data, Settings as S } from '../types'

export default function Settings() {
  const { data, dispatch } = useStore()
  const st = data.settings
  const set = (s: Partial<S>) => dispatch({ t: 'settings', s })
  const [msg, setMsg] = useState('')
  const auth = useAuth()
  const [confirmOut, setConfirmOut] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)
  const [confirmDemo, setConfirmDemo] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const hasDemo = data.sessions.some((s) => s.demo) || data.players.some((p) => p.demo)
  const url = typeof location !== 'undefined' ? location.origin + location.pathname : ''

  async function shareApp() {
    const text = 'Registrá tus patadas a los palos y mirá desde dónde acertás más:'
    try {
      if (navigator.share) {
        await navigator.share({ title: 'A los Palos', text, url })
        return
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`)
      setMsg('Link copiado.')
    } catch {
      setMsg(`Copiá este link: ${url}`)
    }
  }

  async function backup() {
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' })
    const d = new Date()
    const r = await deliver(blob, `alospalos_backup_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`)
    if (r === 'failed') setMsg('No se pudo guardar la copia en esta vista.')
  }

  function restore(file: File) {
    const r = new FileReader()
    r.onload = () => {
      try {
        const d = JSON.parse(String(r.result)) as Data
        if (!Array.isArray(d.kicks) || !Array.isArray(d.sessions) || !Array.isArray(d.players)) throw new Error('formato')
        dispatch({ t: 'replace', d })
        setMsg(`Copia cargada: ${d.sessions.length} sesiones, ${d.kicks.length} patadas.`)
      } catch {
        setMsg('Ese archivo no es una copia de A los Palos.')
      }
    }
    r.readAsText(file)
  }

  return (
    <div className="screen">
      <TopBar title="Ajustes" />
      <main className="content form"><div className="content-inner">
        <div className="group">
          <span className="group-label">Apariencia</span>
          <Segmented<S['theme']>
            label="Tema"
            value={st.theme}
            onChange={(theme) => set({ theme })}
            options={[
              { value: 'system', label: 'Sistema' },
              { value: 'light', label: 'Claro' },
              { value: 'dark', label: 'Oscuro' },
            ]}
          />
        </div>

        <div className="group">
          <span className="group-label">Puntos</span>
          <Switch label="Mostrar puntos perdidos" hint="Suma lo que se dejó de meter en partido por patadas erradas." checked={st.showWasted} onChange={(showWasted) => set({ showWasted })} />
          <Switch label="Contar puntos en amistosos" hint="Si está apagado, solo suman los partidos." checked={st.pointsInFriendlies} onChange={(pointsInFriendlies) => set({ pointsInFriendlies })} />
        </div>

        <div className="group">
          <span className="group-label">Cancha por defecto</span>
          <div className="row3">
            <Field label="Largo" suffix="m">
              <NumInput id="st-len" value={st.defaultPitch.length} onChange={(v) => v && set({ defaultPitch: { ...st.defaultPitch, length: v } })} />
            </Field>
            <Field label="Ancho" suffix="m">
              <NumInput id="st-wid" value={st.defaultPitch.width} onChange={(v) => v && set({ defaultPitch: { ...st.defaultPitch, width: v } })} />
            </Field>
            <Field label="Entre palos" suffix="m">
              <NumInput id="st-gap" value={st.defaultPitch.postGap} onChange={(v) => v && set({ defaultPitch: { ...st.defaultPitch, postGap: v } })} />
            </Field>
          </div>
        </div>

        <div className="group">
          <span className="group-label">Compartir</span>
          <button className="list-btn" onClick={shareApp}>
            <ILink /> Pasarle la app a alguien
          </button>
        </div>

        <ImportCard />

        {auth.linked && auth.user && (
          <div className="group">
            <span className="group-label">Cuenta</span>
            <p className="account-line">
              <strong>{auth.user.email}</strong>
              <span className={`sync sync-${auth.sync}`}>
                {auth.sync === 'syncing'
                  ? 'Guardando en tu cuenta…'
                  : auth.sync === 'ok'
                    ? `Todo guardado en tu cuenta${auth.lastSync ? ` · ${new Date(auth.lastSync).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}` : ''}`
                    : auth.sync === 'offline'
                      ? 'Sin conexión: se guarda en el celular y se sube cuando vuelva la señal'
                      : auth.sync === 'error'
                        ? `No se pudo guardar en la cuenta (${auth.syncError}). Se reintenta solo.`
                        : ''}
              </span>
            </p>
            <div className="account-actions">
              <button className="btn-secondary wide" onClick={() => setPwOpen(true)}>
                <IKey size={18} /> Cambiar contraseña
              </button>
              {confirmOut ? (
                <div className="confirm inline">
                  <span>¿Cerrar sesión en este celular? Tus patadas quedan guardadas en la cuenta.</span>
                  <button className="btn-text" onClick={() => setConfirmOut(false)}>
                    No
                  </button>
                  <button className="btn-danger" onClick={() => auth.signOut()}>
                    Cerrar sesión
                  </button>
                </div>
              ) : (
                <button className="btn-logout wide" onClick={() => setConfirmOut(true)}>
                  <ILogout size={18} /> Cerrar sesión
                </button>
              )}
            </div>
          </div>
        )}

        <div className="group">
          <span className="group-label">Tus datos</span>
          <p className="hint">
            {auth.linked ? 'Tus patadas se guardan en tu cuenta y en el celular. La copia es opcional, por si querés tenerla aparte.' : 'En esta versión todo se guarda en este celular. Hacé una copia de vez en cuando.'}
          </p>
          <button className="list-btn" onClick={backup}>
            <IDownload /> Guardar copia de seguridad
          </button>
          <button className="list-btn" onClick={() => fileRef.current?.click()}>
            <IUpload /> Cargar una copia
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
          {hasDemo &&
            (confirmDemo ? (
              <div className="confirm inline">
                <span>¿Borrar los datos de ejemplo?</span>
                <button className="btn-text" onClick={() => setConfirmDemo(false)}>
                  No
                </button>
                <button className="btn-danger" onClick={() => (dispatch({ t: 'clearDemo' }), setConfirmDemo(false))}>
                  Borrar
                </button>
              </div>
            ) : (
              <button className="list-btn danger" onClick={() => setConfirmDemo(true)}>
                <ITrash /> Borrar datos de ejemplo
              </button>
            ))}
          {msg && <p className="status">{msg}</p>}
        </div>

        <BrandFull />
        <p className="about">
          A los Palos · versión 0.7.1
          <br />
          {data.sessions.length} {data.sessions.length === 1 ? 'sesión' : 'sesiones'} · {data.kicks.length} patadas · {data.players.length} {data.players.length === 1 ? 'pateador' : 'pateadores'}
        </p>
      </div></main>
      <Sheet open={pwOpen} onClose={() => setPwOpen(false)} title="Cambiar contraseña">
        <ChangePassword onDone={() => setPwOpen(false)} />
      </Sheet>
    </div>
  )
}

function ChangePassword({ onDone }: { onDone: () => void }) {
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [ok, setOk] = useState(false)
  const mismatch = p2.length > 0 && p1 !== p2
  async function save() {
    setBusy(true)
    setMsg('')
    const { error } = await sb!.auth.updateUser({ password: p1 })
    setBusy(false)
    if (error) {
      setMsg(/different from the old/i.test(error.message) ? 'La contraseña nueva tiene que ser distinta de la anterior.' : /fetch/i.test(error.message) ? 'No hay conexión. Probá de nuevo con señal.' : error.message)
      return
    }
    setOk(true)
    setTimeout(onDone, 1500)
  }
  if (ok) return <p className="status ok">Listo, cambiaste la contraseña.</p>
  return (
    <form
      className="auth-form"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      <Field label="Contraseña nueva">
        <input id="cp-1" type="password" autoComplete="new-password" value={p1} onChange={(e) => setP1(e.target.value)} placeholder="Mínimo 6 caracteres" />
      </Field>
      <Field label="Repetí la contraseña">
        <input id="cp-2" type="password" autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} placeholder="Ingresá la contraseña de nuevo" />
      </Field>
      {mismatch && <p className="status error">Las contraseñas no coinciden.</p>}
      {msg && <p className="status error">{msg}</p>}
      <button className="btn-primary wide" disabled={busy || p1.length < 6 || p1 !== p2}>
        {busy ? 'Guardando…' : 'Guardar contraseña'}
      </button>
    </form>
  )
}
