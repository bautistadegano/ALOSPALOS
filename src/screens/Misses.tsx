import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { useNav, TopBar, Segmented, Sheet } from '../ui'
import { FilterForm } from './Analysis'
import { IFilter } from '../icons'
import PitchView, { zoneColor } from '../components/Pitch'
import { applyFilter, activeFilterCount, defaultFilter, PERIOD_LABEL, SCOPE_LABEL, useFilter, type Filter, type Scope } from '../filter'
import { BANDS, BAND_LABEL, type EKick } from '../geo'
import { fmtPct, pct, type Cell } from '../stats'
import type { Result } from '../types'

type Lado = 'izq' | 'medio' | 'der'
const LADO_DESDE: Record<Lado, string> = { izq: 'Desde la izquierda', medio: 'Desde el medio', der: 'Desde la derecha' }
const ladoOf = (k: EKick): Lado => (k.signedAngle <= -10 ? 'izq' : k.signedAngle >= 10 ? 'der' : 'medio')

const MISS: { r: Result; label: string }[] = [
  { r: 'izquierda', label: 'Se fue a la izquierda' },
  { r: 'derecha', label: 'Se fue a la derecha' },
  { r: 'corta', label: 'Corta' },
  { r: 'palo', label: 'Palo' },
  { r: 'otro', label: 'Otro' },
]

function analyze(ks: EKick[]) {
  const total: Cell = { n: ks.length, made: ks.filter((k) => k.good).length }
  const misses = ks.filter((k) => !k.good)
  const by: Record<Result, number> = { adentro: 0, izquierda: 0, derecha: 0, corta: 0, palo: 0, otro: 0 }
  for (const k of misses) by[k.result]++
  const top = MISS.map((m) => ({ ...m, n: by[m.r] })).sort((a, b) => b.n - a.n)[0]
  const bands = BANDS.map((b) => {
    const kk = ks.filter((k) => k.band === b)
    return { b, c: { n: kk.length, made: kk.filter((k) => k.good).length } as Cell }
  })
  return { total, misses: misses.length, by, top, bands }
}

function tendency(a: ReturnType<typeof analyze>) {
  if (!a.total.n) return 'Sin patadas desde acá.'
  if (!a.misses) return 'Sin errores desde acá.'
  if (!a.top || a.top.n === 0) return ''
  const share = a.top.n / a.misses
  if (a.misses < 3) return `Pocos errores todavía (${a.misses}) para sacar una tendencia.`
  if (share < 0.45) return 'Los errores están repartidos, no hay una tendencia clara.'
  const what = a.top.r === 'corta' ? 'se queda corta' : a.top.r === 'palo' ? 'pega en el palo' : a.top.r === 'otro' ? 'es otro tipo de error' : `se va a la ${a.top.r}`
  return `Cuando errás, la mayoría ${what}: ${a.top.n} de ${a.misses} (${Math.round(share * 100)}%).`
}

export default function Misses() {
  const { data } = useStore()
  const nav = useNav()
  const global = useFilter().filter
  // Filtro propio de esta pantalla (arranca igual que el de Análisis)
  const [filter, setFilter] = useState<Filter>(global)
  const [sheet, setSheet] = useState(false)
  const ks = useMemo(() => applyFilter(data, filter), [data, filter])
  const groups = useMemo(() => {
    const g: Record<Lado, EKick[]> = { izq: [], medio: [], der: [] }
    for (const k of ks) g[ladoOf(k)].push(k)
    return g
  }, [ks])
  const [lado, setLado] = useState<Lado>('der')
  const an = { izq: analyze(groups.izq), medio: analyze(groups.medio), der: analyze(groups.der) }
  const cur = an[lado]
  const ref = data.settings.defaultPitch

  return (
    <div className="screen">
      <TopBar title="Cuando errás" onBack={nav.back} />
      <main className="content">
        <Segmented<Scope> label="Qué patadas" value={filter.scope} onChange={(scope) => setFilter({ ...filter, scope, kickTypes: [] })} options={(['piso', 'drop', 'todas'] as const).map((v) => ({ value: v, label: SCOPE_LABEL[v] }))} />
        <div className="filter-row">
          <button className={`chip${activeFilterCount(filter) ? ' on' : ''}`} onClick={() => setSheet(true)}>
            <IFilter size={16} /> Filtros{activeFilterCount(filter) ? ` (${activeFilterCount(filter)})` : ''}
          </button>
          <button className="chip" onClick={() => setSheet(true)}>
            {PERIOD_LABEL[filter.period]}
          </button>
        </div>
        <p className="hint">
          El lado se toma desde donde se patea: izquierda o derecha si el ángulo pasa los 10°, medio si está entre −10° y 10°. Así ves si el error cambia según el costado.
        </p>

        <div className="cards three">
          {(['izq', 'medio', 'der'] as Lado[]).map((l) => (
            <button key={l} className={`card card-btn${lado === l ? ' on' : ''}`} onClick={() => setLado(l)}>
              <span className="card-label">{LADO_DESDE[l]}</span>
              <strong className="card-big">{fmtPct(an[l].total)}</strong>
              <span className="card-sub">
                {an[l].misses} error{an[l].misses === 1 ? '' : 'es'} de {an[l].total.n}
              </span>
            </button>
          ))}
        </div>

        <p className="hint">Tocá un lado para ver el detalle.</p>

        <div className="miss-detail">
          <p className="tendency">
            <span className="tendency-side">{LADO_DESDE[lado]}</span>
            {tendency(cur)}
          </p>
          <div className="map-card">
            <PitchView
              pitch={ref}
              compact
              marks={ks.map((k) => ({ id: k.kick.id, x: ref.width / 2 + k.dx, y: k.y, result: k.result, dim: ladoOf(k) !== lado || k.good }))}
            />
            <p className="hint">Resaltados: los errores {LADO_DESDE[lado].toLowerCase()}. La flechita indica hacia dónde se fue.</p>
          </div>

          <div className="breakdown">
            <h3>Hacia dónde se fueron los errores</h3>
            {cur.misses === 0 ? (
              <p className="hint">Sin errores {LADO_DESDE[lado].toLowerCase()}.</p>
            ) : (
              MISS.map((m) => {
                const n = cur.by[m.r]
                const share = n / cur.misses
                return (
                  <div className="bar-row" key={m.r}>
                    <span className="bar-label">{m.label}</span>
                    <span className="bar">
                      <span style={{ width: `${share * 100}%`, background: 'var(--bad)' }} />
                    </span>
                    <span className="bar-val">
                      {Math.round(share * 100)}% <small>{n}</small>
                    </span>
                  </div>
                )
              })
            )}
          </div>

          <div className="breakdown">
            <h3>Acierto por distancia {LADO_DESDE[lado].toLowerCase()}</h3>
            {cur.bands.map(({ b, c }) =>
              c.n ? (
                <div className="bar-row" key={b}>
                  <span className="bar-label">{BAND_LABEL[b]}</span>
                  <span className="bar">
                    <span style={{ width: `${pct(c) * 100}%`, background: zoneColor(pct(c)) }} />
                  </span>
                  <span className="bar-val">
                    {fmtPct(c)} <small>{c.made}/{c.n}</small>
                  </span>
                </div>
              ) : null,
            )}
          </div>

          <div className="table-scroll">
            <table className="cmp-table">
              <thead>
                <tr>
                  <th />
                  <th>Desde la izq.</th>
                  <th>Desde el medio</th>
                  <th>Desde la der.</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th>Acierto</th>
                  {(['izq', 'medio', 'der'] as Lado[]).map((l) => (
                    <td key={l}>{fmtPct(an[l].total)}</td>
                  ))}
                </tr>
                {MISS.map((m) => (
                  <tr key={m.r}>
                    <th>{m.label}</th>
                    {(['izq', 'medio', 'der'] as Lado[]).map((l) => (
                      <td key={l}>{an[l].misses ? `${Math.round((an[l].by[m.r] / an[l].misses) * 100)}%` : '–'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="hint">Los porcentajes de cada error son sobre el total de errores de ese lado.</p>
          </div>
        </div>
      </main>
      <Sheet open={sheet} onClose={() => setSheet(false)} title="Filtros">
        <FilterForm filter={filter} onChange={setFilter} />
        <div className="sheet-actions">
          <button className="btn-text" onClick={() => setFilter({ ...defaultFilter, scope: filter.scope })}>
            Restablecer
          </button>
          <button className="btn-primary" onClick={() => setSheet(false)}>
            Ver resultados
          </button>
        </div>
      </Sheet>
    </div>
  )
}
