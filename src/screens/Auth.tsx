import { useEffect, useState } from 'react'
import { sb, usernameAvailable, emailForLogin } from '../cloud'
import { useAuth } from '../auth'
import { useMe } from '../store'
import { Field, Segmented } from '../ui'
import { BrandFull } from '../Brand'
import { IRight, ILeft } from '../icons'
import type { Foot } from '../types'

type Mode = 'login' | 'signup' | 'check' | 'reset' | 'reset-sent' | 'newpass'

const errMsg = (m: string) => {
  const s = m.toLowerCase()
  if (s.includes('invalid login')) return 'Mail o contraseña incorrectos.'
  if (s.includes('email not confirmed')) return 'Todavía no confirmaste el mail. Revisá tu correo (también en spam).'
  if (s.includes('already registered') || s.includes('already been registered')) return 'Ya hay una cuenta con ese mail. Probá entrar.'
  if (s.includes('password should be')) return 'La contraseña tiene que tener al menos 6 caracteres.'
  if (s.includes('rate limit') || s.includes('too many')) return 'Se mandaron muchos mails seguidos. Esperá unos minutos y probá de nuevo.'
  if (s.includes('not authorized')) return 'Todavía no se pueden mandar mails a esa dirección (falta configurar el envío de mails en Supabase).'
  if (s.includes('fetch')) return 'No hay conexión. Probá de nuevo cuando tengas señal.'
  return m
}

export default function AuthScreen() {
  const auth = useAuth()
  const localMe = useMe()
  const [mode, setMode] = useState<Mode>(auth.recovering ? 'newpass' : localMe && !auth.notice ? 'signup' : 'login')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [username, setUsername] = useState(localMe?.username ?? '')
  const [name, setName] = useState(localMe?.name ?? '')
  const [foot, setFoot] = useState<Foot>(localMe?.foot ?? 'derecho')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  // Supabase deja reenviar el mail recién después de unos segundos
  const [cooldown, setCooldown] = useState(0)
  useEffect(() => {
    if (cooldown <= 0) return
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => window.clearTimeout(t)
  }, [cooldown])
  const unameOk = /^[a-z0-9._]{3,20}$/.test(username)
  const redirect = typeof location !== 'undefined' ? location.origin + location.pathname : undefined

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(errMsg((e as Error).message || 'Algo salió mal.'))
    }
    setBusy(false)
  }

  // Se puede entrar con el mail o con el nombre de usuario
  const isEmail = (v: string) => /\S+@\S+\.\S+/.test(v.trim())
  const login = () =>
    run(async () => {
      let mail = email.trim()
      if (!isEmail(mail)) {
        const found = await emailForLogin(mail, pass)
        if (!found) throw new Error('Usuario o contraseña incorrectos.')
        mail = found
      }
      const { error } = await sb!.auth.signInWithPassword({ email: mail, password: pass })
      if (error) throw error
    })

  const signup = () =>
    run(async () => {
      if (!unameOk) throw new Error('El nombre de usuario tiene que tener entre 3 y 20 caracteres: letras, números, punto o guion bajo.')
      if (!name.trim()) throw new Error('Poné tu nombre o apodo.')
      if (!(await usernameAvailable(username))) throw new Error(`@${username} ya está usado. Probá con otro.`)
      const { data, error } = await sb!.auth.signUp({
        email: email.trim(),
        password: pass,
        options: { emailRedirectTo: redirect, data: { username, name: name.trim(), foot } },
      })
      if (error) throw error
      // Si la confirmación por mail está activada, no hay sesión hasta confirmar
      if (!data.session) {
        setCooldown(60)
        setMode('check')
      }
    })

  const resend = () =>
    run(async () => {
      setInfo('')
      if (!isEmail(email)) throw new Error('Para reenviar el mail de confirmación escribí tu mail (no el usuario) arriba y tocá de nuevo.')
      const { error } = await sb!.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: redirect } })
      if (error) {
        const m = error.message.match(/after (\d+) seconds/)
        if (m) {
          setCooldown(Number(m[1]))
          throw new Error(`Esperá ${m[1]} segundos para pedir otro mail.`)
        }
        throw error
      }
      setCooldown(60)
      setInfo(`Listo, te mandamos otro mail a ${email.trim()}. Puede tardar un par de minutos; revisá también spam y promociones.`)
    })

  const reset = () =>
    run(async () => {
      const { error } = await sb!.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirect })
      if (error) throw error
      setMode('reset-sent')
    })

  const newpass = () =>
    run(async () => {
      if (pass.length < 6) throw new Error('La contraseña tiene que tener al menos 6 caracteres.')
      const { error } = await sb!.auth.updateUser({ password: pass })
      if (error) throw error
      auth.doneRecovering()
    })

  const emailField = (
    <Field label="Mail">
      <input id="au-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Ingresá tu mail" />
    </Field>
  )
  const passField = (label = 'Contraseña', ac = 'current-password') => (
    <Field label={label}>
      <input
        id="au-pass"
        type="password"
        autoComplete={ac}
        value={pass}
        onChange={(e) => setPass(e.target.value)}
        placeholder={ac === 'new-password' ? 'Mínimo 6 caracteres' : 'Ingresá tu contraseña'}
      />
    </Field>
  )

  return (
    <div className="screen onboarding">
      <main className="content form">
        <BrandFull />
        {auth.notice && (
          <p className={`notice-line${/confirmado/.test(auth.notice) ? ' ok' : ''}`}>
            {auth.notice}
            <button className="icon-btn" aria-label="Cerrar aviso" onClick={auth.clearNotice}>
              ×
            </button>
          </p>
        )}
        {mode === 'login' && (
          <form
            className="auth-form"
            onSubmit={(e) => {
              e.preventDefault()
              login()
            }}
          >
            <h2 className="auth-title">Entrar</h2>
            <Field label="Mail o nombre de usuario">
              <input
                id="au-login"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ingresá tu mail o nombre de usuario"
              />
            </Field>
            {passField()}
            {error && <p className="status error">{error}</p>}
            {info && <p className="status">{info}</p>}
            {(error.includes('confirmaste') || /venció/.test(auth.notice)) && (
              <button type="button" className="btn-text" onClick={resend} disabled={busy || cooldown > 0}>
                {cooldown > 0 ? `Podés pedir otro mail en ${cooldown} s` : 'Mandarme el mail de confirmación de nuevo'}
              </button>
            )}
            <button className="btn-primary wide" disabled={busy || !email || !pass}>
              {busy ? 'Entrando…' : 'Entrar'}
            </button>
            <button type="button" className="btn-text" onClick={() => (setMode('reset'), setError(''))}>
              Me olvidé la contraseña
            </button>
            <p className="auth-switch">
              ¿No tenés cuenta?{' '}
              <button type="button" className="btn-text strong" onClick={() => (setMode('signup'), setError(''))}>
                Crear cuenta
              </button>
            </p>
          </form>
        )}

        {mode === 'signup' && (
          <form
            className="auth-form"
            onSubmit={(e) => {
              e.preventDefault()
              signup()
            }}
          >
            <h2 className="auth-title">Crear cuenta</h2>
            {localMe && <p className="hint">Las patadas que ya cargaste en este celular se pasan a tu cuenta.</p>}
            <Field label="Nombre de usuario">
              <span className="at">@</span>
              <input
                id="au-user"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 20))}
                placeholder="Ingresá tu nombre de usuario"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
              />
            </Field>
            <p className="hint">Con este te van a encontrar tus amigos. Letras, números, punto y guion bajo.</p>
            <Field label="Nombre o apodo">
              <input id="au-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ingresá tu nombre o apodo" autoComplete="nickname" />
            </Field>
            <div className="group">
              <span className="group-label">Pie hábil</span>
              <Segmented<Foot>
                label="Pie hábil"
                value={foot}
                onChange={setFoot}
                options={[
                  { value: 'derecho', label: 'Derecho', icon: <IRight size={16} /> },
                  { value: 'izquierdo', label: 'Izquierdo', icon: <ILeft size={16} /> },
                  { value: 'ambos', label: 'Ambos' },
                ]}
              />
            </div>
            {emailField}
            {passField('Contraseña', 'new-password')}
            {error && <p className="status error">{error}</p>}
            <button className="btn-primary wide" disabled={busy || !email || pass.length < 6 || !unameOk || !name.trim()}>
              {busy ? 'Creando…' : 'Crear cuenta'}
            </button>
            <p className="auth-switch">
              ¿Ya tenés cuenta?{' '}
              <button type="button" className="btn-text strong" onClick={() => (setMode('login'), setError(''))}>
                Entrar
              </button>
            </p>
          </form>
        )}

        {mode === 'check' && (
          <div className="auth-form">
            <h2 className="auth-title">Confirmá tu mail</h2>
            <p>
              Te mandamos un mail a <strong>{email}</strong>. Tocá el link que dice <strong>Confirmar</strong> y volvés a la app con la cuenta lista.
            </p>
            <p className="hint">Si no llega en un par de minutos, revisá spam o promociones.</p>
            {info && <p className="status ok">{info}</p>}
            {error && <p className="status error">{error}</p>}
            <button className="btn-secondary wide" onClick={resend} disabled={busy || cooldown > 0}>
              {busy ? 'Mandando…' : cooldown > 0 ? `Podés pedir otro mail en ${cooldown} s` : 'Mandar el mail de nuevo'}
            </button>
            <button className="btn-text" onClick={() => (setMode('login'), setError(''))}>
              Ya lo confirmé, entrar
            </button>
          </div>
        )}

        {mode === 'reset' && (
          <form
            className="auth-form"
            onSubmit={(e) => {
              e.preventDefault()
              reset()
            }}
          >
            <h2 className="auth-title">Recuperar contraseña</h2>
            <p className="hint">Te mandamos un mail con un link para elegir una contraseña nueva.</p>
            {emailField}
            {error && <p className="status error">{error}</p>}
            <button className="btn-primary wide" disabled={busy || !email}>
              Mandar mail
            </button>
            <button type="button" className="btn-text" onClick={() => (setMode('login'), setError(''))}>
              Volver
            </button>
          </form>
        )}

        {mode === 'reset-sent' && (
          <div className="auth-form">
            <h2 className="auth-title">Revisá tu mail</h2>
            <p>Abrí el link que te mandamos a {email} para elegir la contraseña nueva.</p>
            <button className="btn-text" onClick={() => setMode('login')}>
              Volver a entrar
            </button>
          </div>
        )}

        {mode === 'newpass' && (
          <form
            className="auth-form"
            onSubmit={(e) => {
              e.preventDefault()
              newpass()
            }}
          >
            <h2 className="auth-title">Contraseña nueva</h2>
            {passField('Contraseña nueva', 'new-password')}
            {error && <p className="status error">{error}</p>}
            <button className="btn-primary wide" disabled={busy || pass.length < 6}>
              Guardar
            </button>
          </form>
        )}
      </main>
    </div>
  )
}
