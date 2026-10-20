import { useRef } from 'react'
import type { Pitch as PitchT, Result } from '../types'
import { BAND_RANGE, BANDS, SIDE_RANGE, SIDES, type Band, type Side } from '../geo'
import type { Cell } from '../stats'

export interface Mark {
  id: string
  x: number // metros (ya normalizado a esta cancha)
  y: number
  result: Result
  dim?: boolean
}

interface Props {
  pitch: PitchT
  marks?: Mark[]
  pending?: { x: number; y: number } | null
  tryX?: number | null
  tryMode?: boolean
  onTap?: (x: number, y: number) => void
  onMarkTap?: (id: string) => void
  zones?: Map<string, Cell>
  minAttempts?: number
  showMarks?: boolean
  compact?: boolean
  labelMode?: 'pct' | 'frac'
  /** Lupa: centro (en metros) para mostrar la cancha acercada */
  zoomAt?: { x: number; y: number } | null
}

const IG = 6 // in-goal visible (m)

export function zoneColor(p: number) {
  // 0% rojo → 50% ámbar → 100% verde (en tokens)
  if (p >= 0.75) return 'var(--z-good)'
  if (p >= 0.5) return 'var(--z-mid)'
  if (p >= 0.25) return 'var(--z-low)'
  return 'var(--z-bad)'
}

function sectorPath(cx: number, a1: number, a2: number, r1: number, r2: number) {
  const pts: string[] = []
  const N = 16
  const P = (a: number, r: number) => {
    const t = (a * Math.PI) / 180
    return `${(cx + r * Math.sin(t)).toFixed(2)},${(r * Math.cos(t)).toFixed(2)}`
  }
  for (let i = 0; i <= N; i++) pts.push(P(a1 + ((a2 - a1) * i) / N, r2))
  for (let i = N; i >= 0; i--) pts.push(P(a1 + ((a2 - a1) * i) / N, r1))
  return `M${pts.join('L')}Z`
}

export function viewDepth(pitch: PitchT) {
  return Math.min(pitch.length / 2 + 12, 62)
}

export default function PitchView({ pitch, marks = [], pending, tryX, tryMode, onTap, onMarkTap, zones, minAttempts = 5, showMarks = true, compact, labelMode = 'frac', zoomAt }: Props) {
  const ref = useRef<SVGSVGElement>(null)
  const W = pitch.width
  const D = viewDepth(pitch)
  const cx = W / 2
  const g = pitch.postGap
  const half = pitch.length / 2

  function handle(e: React.PointerEvent<SVGSVGElement>) {
    if (!onTap || !ref.current) return
    const target = e.target as Element
    // Solo en modo edición las patadas se pueden tocar; si no, se puede patear encima de otra
    if (onMarkTap && target.closest('[data-mark]')) return
    const pt = ref.current.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const m = ref.current.getScreenCTM()
    if (!m) return
    const p = pt.matrixTransform(m.inverse())
    const x = Math.max(0, Math.min(W, p.x))
    const y = Math.max(0, Math.min(D, p.y))
    onTap(x, tryMode ? p.y : y)
  }

  const dash = '1.2 1.2'
  // Vista completa o acercada (lupa x2.5 alrededor del punto tocado)
  const full = { x: -1, y: -IG - 1, w: W + 2, h: D + IG + 2 }
  let vb = `${full.x} ${full.y} ${full.w} ${full.h}`
  if (zoomAt) {
    const z = 2.5
    const w = full.w / z
    const h = full.h / z
    const x = Math.max(full.x, Math.min(full.x + full.w - w, zoomAt.x - w / 2))
    const y = Math.max(full.y, Math.min(full.y + full.h - h, zoomAt.y - h / 2))
    vb = `${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`
  }
  const line = { stroke: 'var(--line)', strokeWidth: 0.28, fill: 'none' }

  return (
    <svg
      ref={ref}
      className={`pitch${compact ? ' compact' : ''}`}
      viewBox={vb}
      preserveAspectRatio="xMidYMid meet"
      onPointerUp={handle}
      role="img"
      aria-label="Cancha. Tocá donde se patea."
    >
      <defs>
        <clipPath id="field">
          <rect x={0} y={0} width={W} height={D} />
        </clipPath>
        <pattern id="hatch" width="2.4" height="2.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="2.4" height="2.4" fill="var(--z-none)" />
          <line x1="0" y1="0" x2="0" y2="2.4" stroke="var(--line-soft)" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect x={0} y={-IG} width={W} height={D + IG} fill="var(--grass)" />
      <rect x={0} y={-IG} width={W} height={IG} fill="var(--ingoal)" />

      {zones && (
        <g clipPath="url(#field)">
          {SIDES.map((side: Side) =>
            BANDS.map((band: Band) => {
              const c = zones.get(`${side}|${band}`)
              const [a1, a2] = SIDE_RANGE[side]
              const [r1, r2] = BAND_RANGE[band]
              const enough = c && c.n >= minAttempts
              const fill = enough ? zoneColor(c!.made / c!.n) : 'url(#hatch)'
              return (
                <path key={side + band} d={sectorPath(cx, a1, a2, r1, Math.min(r2, 160))} fill={fill} fillOpacity={enough ? 0.78 : 1} stroke="var(--line-soft)" strokeWidth={0.22} />
              )
            }),
          )}
          {SIDES.map((side) =>
            BANDS.map((band) => {
              const c = zones.get(`${side}|${band}`)
              if (!c || !c.n) return null
              const [a1, a2] = SIDE_RANGE[side]
              const [r1, r2] = BAND_RANGE[band]
              const am = (((a1 + a2) / 2) * Math.PI) / 180
              const rm = band === '40+' ? 46 : (r1 + r2) / 2
              const lx = cx + rm * Math.sin(am)
              const ly = rm * Math.cos(am)
              if (lx < 2.5 || lx > W - 2.5 || ly < 1.5 || ly > D - 1.5) return null
              return (
                <text key={'t' + side + band} x={lx} y={ly + 0.9} className="zone-label" textAnchor="middle">
                  {labelMode === 'pct' ? `${Math.round((c.made / c.n) * 100)}%` : `${c.made}/${c.n}`}
                </text>
              )
            }),
          )}
        </g>
      )}

      {/* Líneas de la cancha */}
      <rect x={0} y={-IG} width={W} height={D + IG} {...line} />
      <line x1={0} y1={0} x2={W} y2={0} {...line} strokeWidth={0.4} />
      <line x1={0} y1={5} x2={W} y2={5} {...line} strokeDasharray={dash} />
      <line x1={0} y1={22} x2={W} y2={22} {...line} />
      {half - 10 < D && <line x1={0} y1={half - 10} x2={W} y2={half - 10} {...line} strokeDasharray={dash} />}
      {half < D && <line x1={0} y1={half} x2={W} y2={half} {...line} strokeWidth={0.4} />}
      {[5, 15, W - 15, W - 5].map((x) => (
        <line key={x} x1={x} y1={5} x2={x} y2={Math.min(D, half + 5)} {...line} strokeDasharray={dash} />
      ))}
      {!compact && (
        <g className="pitch-legend">
          <text x={W - 0.8} y={21.2} textAnchor="end">22</text>
          {half - 10 < D && <text x={W - 0.8} y={half - 10.8} textAnchor="end">10</text>}
          {half < D && <text x={W - 0.8} y={half - 0.8} textAnchor="end">mitad</text>}
        </g>
      )}
      {/* Palos */}
      <path d={`M${cx - g / 2} ${-4.6}V${-1.4}H${cx + g / 2}V${-4.6}`} stroke="var(--post)" strokeWidth={0.55} fill="none" strokeLinecap="round" />

      {/* Modo try: línea de conversión */}
      {tryX != null && (
        <>
          <line x1={tryX} y1={0} x2={tryX} y2={D} stroke="var(--try)" strokeWidth={0.32} strokeDasharray="1 0.8" />
          <circle cx={tryX} cy={0} r={0.9} fill="var(--try)" />
        </>
      )}

      {showMarks &&
        marks.map((m) => {
          const good = m.result === 'adentro'
          return (
            <g
              key={m.id}
              data-mark
              className={`mark${onMarkTap ? ' editable' : ''}`}
              opacity={m.dim ? 0.35 : 1}
              pointerEvents={onMarkTap ? 'auto' : 'none'}
              onPointerUp={(e) => {
                if (!onMarkTap) return
                e.stopPropagation()
                onMarkTap(m.id)
              }}
            >
              <circle cx={m.x} cy={m.y} r={2.2} fill="transparent" />
              {onMarkTap && <circle cx={m.x} cy={m.y} r={1.6} fill="none" stroke="var(--try)" strokeWidth={0.25} strokeDasharray="0.6 0.4" />}
              <circle cx={m.x} cy={m.y} r={0.95} fill={good ? 'var(--mark-good)' : 'var(--mark-bad)'} stroke="var(--mark-stroke)" strokeWidth={0.2} />
              {m.result === 'derecha' && <path d={`M${m.x + 1.4} ${m.y}h1.8m-0.7 -0.6l0.7 0.6l-0.7 0.6`} stroke="var(--mark-bad)" strokeWidth={0.3} fill="none" />}
              {m.result === 'izquierda' && <path d={`M${m.x - 1.4} ${m.y}h-1.8m0.7 -0.6l-0.7 0.6l0.7 0.6`} stroke="var(--mark-bad)" strokeWidth={0.3} fill="none" />}
              {m.result === 'corta' && <path d={`M${m.x} ${m.y + 1.4}v1.8m-0.6 -0.7l0.6 0.7l0.6 -0.7`} stroke="var(--mark-bad)" strokeWidth={0.3} fill="none" />}
              {m.result === 'palo' && <path d={`M${m.x - 0.9} ${m.y - 1.5}v-1.4M${m.x + 0.9} ${m.y - 1.5}v-1.4M${m.x - 0.9} ${m.y - 2.2}h1.8`} stroke="var(--mark-bad)" strokeWidth={0.28} fill="none" />}
            </g>
          )
        })}

      {pending && (
        <g pointerEvents="none">
          <line x1={pending.x} y1={pending.y} x2={cx} y2={-1.4} stroke="var(--mark-good)" strokeWidth={0.22} />
          <circle cx={pending.x} cy={pending.y} r={1.5} fill="var(--mark-good)" fillOpacity={0.35} stroke="var(--mark-good)" strokeWidth={0.3} />
          <circle cx={pending.x} cy={pending.y} r={0.8} fill="var(--mark-good)" />
        </g>
      )}
    </svg>
  )
}
