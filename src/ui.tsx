import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { IBack } from './icons'

export type Route =
  | { name: 'tabs'; tab: Tab }
  | { name: 'sessionForm'; id?: string }
  | { name: 'session'; id: string }
  | { name: 'playerForm'; id?: string }
  | { name: 'report' }
  | { name: 'misses' }
  | { name: 'import' }
  | { name: 'friend'; id: string }
export type Tab = 'sesiones' | 'analisis' | 'jugadores' | 'ajustes'

export const NavCtx = createContext<{ push: (r: Route) => void; back: () => void; replace: (r: Route) => void } | null>(null)
export const useNav = () => useContext(NavCtx)!

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size,
  label,
}: {
  value: T
  options: { value: T; label: ReactNode; icon?: ReactNode }[]
  onChange: (v: T) => void
  size?: 'sm'
  label?: string
}) {
  return (
    <div className={`seg${size === 'sm' ? ' seg-sm' : ''}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.icon}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  )
}

export function Chips<T extends string>({ value, options, onChange, multi }: { value: T[]; options: { value: T; label: string }[]; onChange: (v: T[]) => void; multi?: boolean }) {
  return (
    <div className="chips">
      {options.map((o) => {
        const on = value.includes(o.value)
        return (
          <button
            key={o.value}
            type="button"
            className={`chip${on ? ' on' : ''}`}
            aria-pressed={on}
            onClick={() => {
              if (!multi) onChange(on ? [] : [o.value])
              else onChange(on ? value.filter((x) => x !== o.value) : [...value, o.value])
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function Field({ label, children, icon, suffix }: { label: string; children: ReactNode; icon?: ReactNode; suffix?: string }) {
  return (
    <label className="field">
      {icon && <span className="field-icon">{icon}</span>}
      <span className="field-body">
        <span className="field-label">{label}</span>
        <span className="field-input">
          {children}
          {suffix && <span className="suffix">{suffix}</span>}
        </span>
      </span>
    </label>
  )
}

export function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="switch-row">
      <span>
        <span className="switch-label">{label}</span>
        {hint && <span className="switch-hint">{hint}</span>}
      </span>
      <input type="checkbox" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

export function TopBar({ title, sub, onBack, right }: { title: ReactNode; sub?: ReactNode; onBack?: () => void; right?: ReactNode }) {
  return (
    <header className="topbar">
      {onBack ? (
        <button className="icon-btn" onClick={onBack} aria-label="Volver">
          <IBack />
        </button>
      ) : (
        <span className="topbar-spacer" />
      )}
      <div className="topbar-title">
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      <div className="topbar-right">{right}</div>
    </header>
  )
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="sheet-wrap" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <h2 className="sheet-title">{title}</h2>
        {children}
      </div>
    </div>
  )
}

export const num = (s: string) => {
  const v = parseFloat(s.replace(',', '.'))
  return Number.isFinite(v) ? v : undefined
}

export const fmtDate = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleString('es-AR', { hour12: false, ...opts })

/** Input numérico que deja escribir "14," o "4." sin borrarlo */
export function NumInput({ id, value, onChange, placeholder }: { id: string; value: number | undefined; onChange: (v: number | undefined) => void; placeholder?: string }) {
  const [txt, setTxt] = useState(value == null ? '' : String(value))
  useEffect(() => {
    if (num(txt) !== value) setTxt(value == null ? '' : String(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <input
      id={id}
      inputMode="decimal"
      value={txt}
      placeholder={placeholder}
      onChange={(e) => {
        setTxt(e.target.value)
        onChange(num(e.target.value))
      }}
    />
  )
}
