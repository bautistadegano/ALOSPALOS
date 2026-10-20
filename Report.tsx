import { useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { useNav, TopBar, Segmented } from '../ui'
import PitchView from '../components/Pitch'
import { applyFilter, PERIOD_LABEL, SCOPE_LABEL, useFilter, type Scope } from '../filter'
import { summarize } from '../stats'
import { buildPdf, buildXlsx, deliver, fileName } from '../export'
import { IFile, ITable } from '../icons'

export default function Report() {
  const { data } = useStore()
  const nav = useNav()
  const { filter } = useFilter()
  const [scope, setScope] = useState<Scope>(filter.scope)
  const [busy, setBusy] = useState<'' | 'pdf' | 'xlsx'>('')
  const [msg, setMsg] = useState('')
  const f = { ...filter, scope }
  const ks = useMemo(() => applyFilter(data, f), [data, filter, scope]) // eslint-disable-line react-hooks/exhaustive-deps
  const sum = useMemo(() => summarize(ks, f.minAttempts, data.settings.pointsInFriendlies), [ks]) // eslint-disable-line react-hooks/exhaustive-deps
  const mapRef = useRef<HTMLDivElement>(null)
  const ref = data.settings.defaultPitch

  async function run(kind: 'pdf' | 'xlsx') {
    setBusy(kind)
    setMsg('')
    try {
      const blob = kind === 'pdf' ? await buildPdf(data, f, ks, sum, mapRef.current?.querySelector('svg') ?? null) : await buildXlsx(data, f, ks, sum)
      const r = await deliver(blob, fileName(f, kind))
      setMsg(
        r === 'shared'
          ? 'Listo.'
          : r === 'downloaded'
            ? 'Archivo descargado. Si no aparece, revisá Descargas o abrí la app instalada en el celular.'
            : r === 'cancelled'
              ? ''
              : 'No se pudo guardar el archivo en esta vista. Probá desde la app instalada en el celular.',
      )
    } catch {
      setMsg('No se pudo generar el archivo. Probá de nuevo.')
    }
    setBusy('')
  }

  return (
    <div className="screen">
      <TopBar title="Informe" onBack={nav.back} />
      <main className="content form"><div className="content-inner">
        <div className="group">
          <span className="group-label">Qué patadas</span>
          <Segmented<Scope> label="Qué patadas" value={scope} onChange={setScope} options={(['piso', 'drop', 'todas'] as const).map((v) => ({ value: v, label: SCOPE_LABEL[v] }))} />
          <p className="hint">Patadas de piso son conversiones y penales. Los drops van aparte porque se patean en movimiento.</p>
        </div>
        <dl className="summary-list">
          <div>
            <dt>Período</dt>
            <dd>{PERIOD_LABEL[filter.period]}</dd>
          </div>
          <div>
            <dt>Pateador</dt>
            <dd>{data.players.find((p) => p.id === data.settings.meId)?.name}</dd>
          </div>
          <div>
            <dt>Patadas en el informe</dt>
            <dd>{ks.length}</dd>
          </div>

        </dl>
        <p className="hint">Usa los mismos filtros que Análisis. El PDF trae el resumen, el mapa, la tabla por zonas y la evolución. El Excel trae además cada patada con su distancia, ángulo y una hoja que explica cada cálculo.</p>
        <button className="btn-primary wide" disabled={!ks.length || !!busy} onClick={() => run('pdf')}>
          <IFile size={20} /> {busy === 'pdf' ? 'Generando…' : 'Informe PDF'}
        </button>
        <button className="btn-secondary wide" disabled={!ks.length || !!busy} onClick={() => run('xlsx')}>
          <ITable size={20} /> {busy === 'xlsx' ? 'Generando…' : 'Excel con todas las patadas'}
        </button>
        {msg && <p className="status">{msg}</p>}
        <div ref={mapRef} className="offscreen" aria-hidden="true">
          <PitchView pitch={ref} compact zones={sum.zones} minAttempts={f.minAttempts} labelMode={f.zoneLabel} marks={ks.map((k) => ({ id: k.kick.id, x: ref.width / 2 + k.dx, y: k.y, result: k.result }))} />
        </div>
      </div></main>
    </div>
  )
}
