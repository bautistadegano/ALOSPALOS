import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { useNav, TopBar, Segmented, Sheet, Chips, Switch } from '../ui'
import PitchView, { zoneColor } from '../components/Pitch'
import { applyFilter, activeFilterCount, defaultFilter, PERIOD_LABEL, SCOPE_LABEL, useFilter, type Filter, type Period, type Scope } from '../filter'
import { summarize, weekly, fmtPct, pct, type Cell, type Summary } from '../stats'
import { BANDS, BAND_LABEL, SIDES, SIDE_LABEL, WIND_REL_LABEL, type EKick, type WindRel } from '../geo'
import { IFile, IFilter, IMap, ITable, ITrophy, ITrend, IChevron } from '../icons'
import { FOOT_LABEL, KICK_LABEL, SESSION_LABEL, type Foot, type KickType, type SessionType } from '../types'

type View = 'mapa' | 'tabla' | 'ranking' | 'evolucion'

export default function Analysis() {
  const { data } = useStore()
  const nav = useNav()
  const { filter, setFilter } = useFilter()
  const [view, setView] = useState<View>('mapa')
  const [sheet, setSheet] = useState(false)
  const ks = useMemo(() => applyFilter(data, filter), [data, filter])
  const sum = useMemo(() => summarize(ks, filter.minAttempts, data.settings.pointsInFriendlies), [ks, filter.minAttempts, data.settings.pointsInFriendlies])
  const set = (p: Partial<Filter>) => setFilter({ ...filter, ...p })
  const ref = data.settings.defaultPitch
  const nActive = activeFilterCount(filter)

  return (
    <div className="screen">
      <TopBar
        title="Análisis"
        right={
          <button className="icon-btn" aria-label="Informe PDF / Excel" onClick={() => nav.push({ name: 'report' })}>
            <IFile />
          </button>
        }
      />
      <main className="content">
        <Segmented<Scope> label="Qué patadas" value={filter.scope} onChange={(scope) => set({ scope, kickTypes: [] })} options={(['piso', 'drop', 'todas'] as const).map((v) => ({ value: v, label: SCOPE_LABEL[v] }))} />
        <div className="filter-row">
          <button className={`chip${nActive ? ' on' : ''}`} onClick={() => setSheet(true)}>
            <IFilter size={16} /> Filtros{nActive ? ` (${nActive})` : ''}
          </button>
          <button className="chip" onClick={() => setSheet(true)}>
            {PERIOD_LABEL[filter.period]}
          </button>
        </div>

        <Cards sum={sum} showWasted={data.settings.showWasted} onMisses={() => nav.push({ name: 'misses' })} />

        <Segmented<View>
          label="Vista"
          value={view}
          onChange={setView}
          options={[
            { value: 'mapa', label: 'Mapa', icon: <IMap size={18} /> },
            { value: 'tabla', label: 'Tabla', icon: <ITable size={18} /> },
            { value: 'ranking', label: 'Zonas', icon: <ITrophy size={18} /> },
            { value: 'evolucion', label: 'Evolución', icon: <ITrend size={18} /> },
          ]}
        />

        {ks.length === 0 ? (
          <div className="empty small">
            <p>No hay patadas con estos filtros.</p>
          </div>
        ) : view === 'mapa' ? (
          <div className="map-card">
            <PitchView
              pitch={ref}
              compact
              zones={sum.zones}
              minAttempts={filter.minAttempts}
              showMarks={filter.showKicks}
              labelMode={filter.zoneLabel}
              marks={ks.map((k) => ({ id: k.kick.id, x: ref.width / 2 + k.dx, y: k.y, result: k.result }))}
            />
            <div className="legend">
              <span><i style={{ background: 'var(--z-bad)' }} />0–25%</span>
              <span><i style={{ background: 'var(--z-low)' }} />25–50%</span>
              <span><i style={{ background: 'var(--z-mid)' }} />50–75%</span>
              <span><i style={{ background: 'var(--z-good)' }} />75–100%</span>
              <span><i className="hatch" />Menos de {filter.minAttempts}</span>
            </div>
            <div className="map-opts">
              <span className="group-label">En cada zona</span>
              <Segmented<'frac' | 'pct'>
                size="sm"
                label="Qué mostrar en cada zona"
                value={filter.zoneLabel}
                onChange={(zoneLabel) => set({ zoneLabel })}
                options={[
                  { value: 'frac', label: 'Aciertos (8/9)' },
                  { value: 'pct', label: 'Porcentaje' },
                ]}
              />
            </div>
            <Switch label="Mostrar patadas" checked={filter.showKicks} onChange={(showKicks) => set({ showKicks })} />
            <p className="hint">Zonas: frente ±10°, izquierda/derecha 10–30°, abiertas más de 30°. Distancia medida al centro de los palos.</p>
          </div>
        ) : view === 'tabla' ? (
          <Tables sum={sum} min={filter.minAttempts} scope={filter.scope} />
        ) : view === 'ranking' ? (
          <Ranking sum={sum} min={filter.minAttempts} />
        ) : (
          <Trend ks={ks} />
        )}
      </main>

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Filtros">
        <FilterForm filter={filter} onChange={setFilter} />
        <div className="sheet-actions">
          <button className="btn-text" onClick={() => setFilter({ ...defaultFilter, scope: filter.scope, showKicks: filter.showKicks, zoneLabel: filter.zoneLabel })}>
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

export function Cards({ sum, showWasted, onMisses }: { sum: Summary; showWasted: boolean; onMisses?: () => void }) {
  const { leftHalf: L, rightHalf: R } = sum
  let hard = '–'
  let hardSub = 'Faltan patadas de los costados'
  if (L.n >= 3 && R.n >= 3) {
    const diff = pct(L) - pct(R)
    hard = Math.abs(diff) < 0.03 ? 'Parejo' : diff < 0 ? 'Izquierda' : 'Derecha'
    hardSub = `Izq. ${fmtPct(L)} (${L.n}) · Der. ${fmtPct(R)} (${R.n})`
  }
  return (
    <div className="cards">
      <div className="card">
        <span className="card-label">Intentos</span>
        <strong className="card-big">{sum.total.n}</strong>
        <span className="card-sub">{sum.total.made} adentro</span>
      </div>
      <div className="card accent">
        <span className="card-label">Acierto</span>
        <strong className="card-big">{fmtPct(sum.total)}</strong>
        <span className="meter">
          <span style={{ width: `${pct(sum.total) * 100}%` }} />
        </span>
      </div>
      <div className="card">
        <span className="card-label">Lado que más cuesta</span>
        <strong className="card-mid">{hard}</strong>
        <span className="card-sub">{hardSub}</span>
      </div>
      <button className="card card-btn" onClick={onMisses} disabled={!onMisses}>
        <span className="card-label">
          Cuando erra <IChevron size={14} />
        </span>
        <strong className="card-mid">{sum.missCount === 0 ? '–' : sum.bias.dir === 'parejo' ? 'Parejo' : `Se va a la ${sum.bias.dir}`}</strong>
        <span className="card-sub">
          {sum.missCount
            ? `Izq. ${sum.misses.izquierda} · Der. ${sum.misses.derecha} · Corta ${sum.misses.corta}${sum.misses.palo ? ` · Palo ${sum.misses.palo}` : ''}`
            : 'Sin errores'}
        </span>
        <span className="card-link">Ver por lado</span>
      </button>
      <div className="card">
        <span className="card-label">Mejor zona</span>
        <strong className="card-mid">{sum.best ? `${SIDE_LABEL[sum.best.side]} · ${BAND_LABEL[sum.best.band]}` : '–'}</strong>
        <span className="card-sub">{sum.best ? `${sum.best.cell.made}/${sum.best.cell.n} · ${fmtPct(sum.best.cell)}` : 'Faltan patadas por zona'}</span>
      </div>
      <div className="card">
        <span className="card-label">Peor zona</span>
        <strong className="card-mid">{sum.worst ? `${SIDE_LABEL[sum.worst.side]} · ${BAND_LABEL[sum.worst.band]}` : '–'}</strong>
        <span className="card-sub">{sum.worst ? `${sum.worst.cell.made}/${sum.worst.cell.n} · ${fmtPct(sum.worst.cell)}` : 'Faltan patadas por zona'}</span>
      </div>
      {sum.pointsKicks > 0 && (
        <div className="card wide points-card">
          <div>
            <span className="card-label">Puntos en partidos</span>
            <strong className="card-big">{sum.pointsMade}</strong>
          </div>
          {showWasted && (
            <div>
              <span className="card-label">Puntos perdidos</span>
              <strong className="card-big wasted">{sum.pointsWasted}</strong>
            </div>
          )}
          <span className="card-sub">{sum.pointsKicks} patadas en partido</span>
        </div>
      )}
    </div>
  )
}

function CellTd({ c, min }: { c?: Cell; min: number }) {
  if (!c || !c.n) return <td className="zcell empty">–</td>
  const ok = c.n >= min
  return (
    <td className={`zcell${ok ? '' : ' few'}`} style={ok ? { background: zoneColor(pct(c)) } : undefined}>
      <strong>{fmtPct(c)}</strong>
      <span>
        {c.made}/{c.n}
      </span>
    </td>
  )
}

function Breakdown<T extends string>({ title, rows }: { title: string; rows: { key: T; label: string; c: Cell }[] }) {
  const rs = rows.filter((r) => r.c.n > 0)
  if (!rs.length) return null
  return (
    <div className="breakdown">
      <h3>{title}</h3>
      {rs.map((r) => (
        <div className="bar-row" key={r.key}>
          <span className="bar-label">{r.label}</span>
          <span className="bar">
            <span style={{ width: `${pct(r.c) * 100}%`, background: zoneColor(pct(r.c)) }} />
          </span>
          <span className="bar-val">
            {fmtPct(r.c)} <small>{r.c.made}/{r.c.n}</small>
          </span>
        </div>
      ))}
    </div>
  )
}

export function Tables({ sum, min, scope }: { sum: Summary; min: number; scope: Scope }) {
  return (
    <div className="tables">
      <div className="table-scroll">
        <table className="ztable">
          <thead>
            <tr>
              <th />
              {SIDES.map((s) => (
                <th key={s}>{SIDE_LABEL[s]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {BANDS.map((b) => (
              <tr key={b}>
                <th>{BAND_LABEL[b]}</th>
                {SIDES.map((s) => (
                  <CellTd key={s} c={sum.zones.get(`${s}|${b}`)} min={min} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Breakdown title="Por distancia" rows={BANDS.map((b) => ({ key: b, label: BAND_LABEL[b], c: sum.byBand.get(b)! }))} />
      <Breakdown title="Por sector" rows={SIDES.map((s) => ({ key: s, label: SIDE_LABEL[s], c: sum.bySide.get(s)! }))} />
      {scope !== 'drop' && <Breakdown title="Por tipo" rows={(['conversion', 'penal', 'drop'] as KickType[]).map((t) => ({ key: t, label: KICK_LABEL[t], c: sum.byType.get(t) ?? { n: 0, made: 0 } }))} />}
      <Breakdown title="Con viento" rows={(['favor', 'contra', 'cruzado', 'sin'] as WindRel[]).map((w) => ({ key: w, label: WIND_REL_LABEL[w], c: sum.byWind.get(w) ?? { n: 0, made: 0 } }))} />
      {scope !== 'drop' && (
        <Breakdown
          title="Tee"
          rows={[
            { key: 'tee', label: 'Con tee', c: sum.byTee.tee },
            { key: 'sin', label: 'Sin tee', c: sum.byTee.sin },
          ]}
        />
      )}
    </div>
  )
}

function Ranking({ sum, min }: { sum: Summary; min: number }) {
  const few = [...sum.zones.entries()]
    .filter(([, c]) => c.n < min)
    .map(([key, c]) => ({ key, c }))
  return (
    <ol className="ranking">
      {sum.ranked.map((z, i) => (
        <li key={z.side + z.band}>
          <span className="rank-pct" style={{ background: zoneColor(pct(z.cell)) }}>
            {Math.round(pct(z.cell) * 100)}
          </span>
          <span className="rank-text">
            <strong>
              {SIDE_LABEL[z.side]} · {BAND_LABEL[z.band]}
            </strong>
            <span>{i === 0 ? 'Tu mejor zona' : i === sum.ranked.length - 1 && i > 0 ? 'La que más cuesta' : ' '}</span>
          </span>
          <span className="rank-n">
            {z.cell.made}/{z.cell.n}
          </span>
        </li>
      ))}
      {few.map(({ key, c }) => {
        const [side, band] = key.split('|') as [keyof typeof SIDE_LABEL, keyof typeof BAND_LABEL]
        return (
          <li key={key} className="few">
            <span className="rank-pct none">–</span>
            <span className="rank-text">
              <strong>
                {SIDE_LABEL[side]} · {BAND_LABEL[band]}
              </strong>
              <span>
                Faltan patadas ({c.n} de {min})
              </span>
            </span>
            <span className="rank-n">
              {c.made}/{c.n}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export function Trend({ ks }: { ks: EKick[] }) {
  const pts = weekly(ks)
  const W = 340
  const H = 180
  const pad = { l: 34, r: 14, t: 14, b: 28 }
  const iw = W - pad.l - pad.r
  const ih = H - pad.t - pad.b
  const x = (i: number) => pad.l + (pts.length === 1 ? iw / 2 : (i / (pts.length - 1)) * iw)
  const y = (p: number) => pad.t + (1 - p) * ih
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(pct(p.cell)).toFixed(1)}`).join('')
  const area = pts.length > 1 ? `${path}L${x(pts.length - 1)},${y(0)}L${x(0)},${y(0)}Z` : ''
  const fmt = (t: number) => new Date(t).toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric' })
  const last = pts[pts.length - 1]
  return (
    <div className="trend">
      <h3>Acierto por semana</h3>
      <svg viewBox={`0 0 ${W} ${H}`} className="trend-svg" role="img" aria-label="Acierto por semana">
        {[0, 0.25, 0.5, 0.75, 1].map((g) => (
          <g key={g}>
            <line x1={pad.l} x2={W - pad.r} y1={y(g)} y2={y(g)} stroke="var(--grid)" strokeWidth={1} />
            <text x={pad.l - 6} y={y(g) + 4} textAnchor="end" className="axis">
              {g * 100}
            </text>
          </g>
        ))}
        {area && <path d={area} fill="var(--accent)" fillOpacity={0.14} />}
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2.2} strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={p.t} cx={x(i)} cy={y(pct(p.cell))} r={i === pts.length - 1 ? 4.5 : 3} fill={i === pts.length - 1 ? 'var(--accent)' : 'var(--surface)'} stroke="var(--accent)" strokeWidth={2} />
        ))}
        {pts.map((p, i) =>
          pts.length <= 6 || i === 0 || i === pts.length - 1 || i % Math.ceil(pts.length / 5) === 0 ? (
            <text key={'l' + p.t} x={x(i)} y={H - 8} textAnchor="middle" className="axis">
              {fmt(p.t)}
            </text>
          ) : null,
        )}
      </svg>
      {last && (
        <p className="hint">
          Última semana: {fmtPct(last.cell)} ({last.cell.made}/{last.cell.n}). Cada punto es la semana que empieza ese lunes.
        </p>
      )}
    </div>
  )
}

export function FilterForm({ filter, onChange }: { filter: Filter; onChange: (f: Filter) => void }) {
  const set = (p: Partial<Filter>) => onChange({ ...filter, ...p })
  return (
    <div className="filter-form">
      <span className="group-label">Período</span>
      <Chips<Period> value={[filter.period]} onChange={(v) => set({ period: v[0] ?? 'all' })} options={(Object.keys(PERIOD_LABEL) as Period[]).map((p) => ({ value: p, label: PERIOD_LABEL[p] }))} />
      {filter.period === 'custom' && (
        <div className="row2">
          <label className="field">
            <span className="field-body">
              <span className="field-label">Desde</span>
              <input id="ff-from" type="date" value={filter.from ?? ''} onChange={(e) => set({ from: e.target.value })} />
            </span>
          </label>
          <label className="field">
            <span className="field-body">
              <span className="field-label">Hasta</span>
              <input id="ff-to" type="date" value={filter.to ?? ''} onChange={(e) => set({ to: e.target.value })} />
            </span>
          </label>
        </div>
      )}
      <span className="group-label">Tipo de sesión</span>
      <Chips<SessionType> multi value={filter.sessionTypes} onChange={(sessionTypes) => set({ sessionTypes })} options={(Object.keys(SESSION_LABEL) as SessionType[]).map((t) => ({ value: t, label: SESSION_LABEL[t] }))} />
      {filter.scope !== 'drop' && (
        <>
          <span className="group-label">Tipo de patada</span>
          <Chips<KickType>
            multi
            value={filter.kickTypes}
            onChange={(kickTypes) => set({ kickTypes })}
            options={(filter.scope === 'piso' ? (['conversion', 'penal'] as KickType[]) : (['conversion', 'penal', 'drop'] as KickType[])).map((t) => ({ value: t, label: KICK_LABEL[t] }))}
          />
        </>
      )}
      <span className="group-label">Mínimo de intentos por zona</span>
      <div className="stepper">
        <button onClick={() => set({ minAttempts: Math.max(1, filter.minAttempts - 1) })} aria-label="Menos">
          −
        </button>
        <strong>{filter.minAttempts}</strong>
        <button onClick={() => set({ minAttempts: Math.min(30, filter.minAttempts + 1) })} aria-label="Más">
          +
        </button>
      </div>
    </div>
  )
}
