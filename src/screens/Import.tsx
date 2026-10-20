import { useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { useNav, TopBar, Segmented, fmtDate } from '../ui'
import { IUpload, ICheck } from '../icons'
import { BANDS, BAND_LABEL, SIDES, SIDE_LABEL } from '../geo'
import { KICK_LABEL, SESSION_LABEL, type KickType, type SessionType } from '../types'
import { buildCsv, buildPdf, parseCsv, parsePdf, type ImportPlan } from '../importer'

const toDateInput = (iso: string) => iso.slice(0, 10)

export default function Import() {
  const { data, dispatch } = useStore()
  const nav = useNav()
  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<'idle' | 'reading' | 'error' | 'done'>('idle')
  const [error, setError] = useState('')
  const [plan, setPlan] = useState<ImportPlan | null>(null)
  const [fileName, setFileName] = useState('')
  // opciones de confirmación
  const [tableIdx, setTableIdx] = useState(0)
  const [pdfType, setPdfType] = useState<SessionType>('entrenamiento')
  const [pdfKick, setPdfKick] = useState<KickType>('penal')
  const [doneMsg, setDoneMsg] = useState('')
  const meId = data.settings.meId!
  const pitch = data.settings.defaultPitch
  const existingKeys = useMemo(() => new Set(data.sessions.map((s) => s.importKey).filter(Boolean) as string[]), [data.sessions])

  async function onFile(f: File) {
    setFileName(f.name)
    setStatus('reading')
    setError('')
    setPlan(null)
    try {
      const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
      const p = isPdf ? await parsePdf(await f.arrayBuffer()) : parseCsv(await f.text())
      setPlan(p)
      setTableIdx(0)
      setStatus('idle')
    } catch (e) {
      setError((e as Error).message || 'No se pudo leer el archivo.')
      setStatus('error')
    }
  }

  function confirm() {
    if (!plan) return
    if (plan.source === 'csv') {
      const out = buildCsv(plan, meId, pitch, existingKeys)
      dispatch({ t: 'importData', ...out })
      setDoneMsg(`Listo: se sumaron ${out.kicks.length} patadas en ${out.sessions.length} sesiones.`)
    } else {
      const t = plan.tables[tableIdx]
      const out = buildPdf(t, plan.date, pdfType, pdfKick, meId, pitch, existingKeys)
      if (out.duplicate) {
        setDoneMsg('Este informe ya estaba cargado, no se sumó de nuevo.')
      } else {
        dispatch({ t: 'importData', sessions: out.sessions, kicks: out.kicks })
        setDoneMsg(`Listo: se sumaron ${out.kicks.length} patadas.`)
      }
    }
    setStatus('done')
    setPlan(null)
  }

  return (
    <div className="screen">
      <TopBar title="Traer patadas" onBack={nav.back} />
      <main className="content form"><div className="content-inner">
        {status === 'done' ? (
          <div className="import-done">
            <span className="done-icon">
              <ICheck size={30} />
            </span>
            <h2>{doneMsg}</h2>
            <p className="hint">Ya aparecen en Sesiones y en Análisis.</p>
            <button className="btn-primary wide" onClick={nav.back}>
              Volver
            </button>
          </div>
        ) : (
          <>
            <div className="import-intro">
              <h2>¿Tenías patadas cargadas en otra app?</h2>
              <p>Cargá el informe de Rugby Shot y se suman solas. Antes de guardar te mostramos todo lo que encontramos para que lo revises.</p>
              <ol className="import-steps">
                <li>Abrí Rugby Shot y entrá a <strong>Análisis</strong>.</li>
                <li>
                  Tocá el ícono de <strong>Informe</strong> (arriba a la derecha) y dejá el período en <strong>Siempre</strong> para traer todo.
                </li>
                <li>
                  Tocá <strong>CSV</strong> y elegí <strong>Guardar en Archivos</strong>. Si querés, guardá también el <strong>PDF</strong>.
                </li>
                <li>
                  Volvé acá, tocá <strong>Elegir archivo</strong> y buscalo en Archivos.
                </li>
              </ol>
              <div className="import-tips">
                <p>
                  <strong>Mejor el CSV:</strong> trae cada patada con su lugar exacto, fecha, clima y resultado, y queda igual que en la otra app.
                </p>
                <p>
                  <strong>El PDF también sirve</strong>, pero trae solo los aciertos por zona: las patadas se ubican dentro de cada zona y los errores entran sin dirección, porque el PDF no la dice. Usá uno de los dos, no los dos.
                </p>
              </div>
            </div>
            <button className="btn-primary wide" onClick={() => fileRef.current?.click()} disabled={status === 'reading'}>
              <IUpload size={20} /> {status === 'reading' ? 'Leyendo el archivo…' : plan ? 'Elegir otro archivo' : 'Elegir archivo (CSV o PDF)'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.csv,application/pdf,text/csv"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onFile(f)
                e.target.value = ''
              }}
            />
            {status === 'error' && (
              <p className="status error">
                {error} {fileName && `(${fileName})`}
              </p>
            )}

            {plan?.source === 'csv' && <CsvReview plan={plan} setPlan={setPlan} existingKeys={existingKeys} onConfirm={confirm} />}
            {plan?.source === 'pdf' && (
              <PdfReview
                plan={plan}
                setPlan={setPlan}
                tableIdx={tableIdx}
                setTableIdx={setTableIdx}
                type={pdfType}
                setType={setPdfType}
                kick={pdfKick}
                setKick={setPdfKick}
                onConfirm={confirm}
              />
            )}
          </>
        )}
      </div></main>
    </div>
  )
}

function CsvReview({
  plan,
  setPlan,
  existingKeys,
  onConfirm,
}: {
  plan: Extract<ImportPlan, { source: 'csv' }>
  setPlan: (p: ImportPlan) => void
  existingKeys: Set<string>
  onConfirm: () => void
}) {
  const update = (i: number, patch: Partial<(typeof plan.sessions)[number]>) =>
    setPlan({ ...plan, sessions: plan.sessions.map((s, j) => (j === i ? { ...s, ...patch } : s)) })
  const chosen = plan.sessions.filter((s) => s.include && !existingKeys.has(`rugbyshot:${s.key}`))
  const total = chosen.reduce((a, s) => a + s.kicks.length, 0)
  const made = chosen.reduce((a, s) => a + s.kicks.filter((k) => k.result === 'adentro').length, 0)
  return (
    <div className="review">
      <h3 className="review-title">Revisá lo que se va a cargar</h3>
      <div className="cards">
        <div className="card">
          <span className="card-label">Patadas</span>
          <strong className="card-big">{total}</strong>
          <span className="card-sub">{made} adentro</span>
        </div>
        <div className="card">
          <span className="card-label">Sesiones</span>
          <strong className="card-big">{chosen.length}</strong>
          <span className="card-sub">de {plan.sessions.length} en el archivo</span>
        </div>
      </div>
      {plan.skippedRows > 0 && <p className="hint">{plan.skippedRows} filas no eran patadas a los palos de rugby y se dejaron afuera.</p>}
      <ul className="review-list">
        {plan.sessions.map((s, i) => {
          const dup = existingKeys.has(`rugbyshot:${s.key}`)
          const m = s.kicks.filter((k) => k.result === 'adentro').length
          return (
            <li key={s.key} className={!s.include || dup ? 'off' : ''}>
              <label className="review-check">
                <input type="checkbox" checked={s.include && !dup} disabled={dup} onChange={(e) => update(i, { include: e.target.checked })} />
                <span>
                  <strong>{fmtDate(s.date, { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
                  {s.place ? ` · ${s.place}` : ''}
                  <small>
                    {s.kicks.length} patadas · {m} adentro{dup ? ' · ya cargada' : ''}
                  </small>
                </span>
              </label>
              <div className="review-edit">
                <input type="date" aria-label="Fecha" value={toDateInput(s.date)} onChange={(e) => e.target.value && update(i, { date: new Date(e.target.value + 'T' + s.date.slice(11)).toISOString() })} />
                <select aria-label="Tipo" value={s.type} onChange={(e) => update(i, { type: e.target.value as SessionType })}>
                  {(Object.keys(SESSION_LABEL) as SessionType[]).map((t) => (
                    <option key={t} value={t}>
                      {SESSION_LABEL[t]}
                    </option>
                  ))}
                </select>
              </div>
            </li>
          )
        })}
      </ul>
      <button className="btn-primary wide" disabled={!total} onClick={onConfirm}>
        <ICheck size={20} /> Confirmar y cargar {total} patadas
      </button>
    </div>
  )
}

function PdfReview({
  plan,
  setPlan,
  tableIdx,
  setTableIdx,
  type,
  setType,
  kick,
  setKick,
  onConfirm,
}: {
  plan: Extract<ImportPlan, { source: 'pdf' }>
  setPlan: (p: ImportPlan) => void
  tableIdx: number
  setTableIdx: (i: number) => void
  type: SessionType
  setType: (t: SessionType) => void
  kick: KickType
  setKick: (k: KickType) => void
  onConfirm: () => void
}) {
  const { data } = useStore()
  const csvLoaded = data.sessions.some((x) => x.importKey?.startsWith('rugbyshot:'))
  const t = plan.tables[tableIdx]
  const total = t.zones.flat().reduce((a, c) => a + c[1], 0)
  const made = t.zones.flat().reduce((a, c) => a + c[0], 0)
  const expected = t.attempts ?? plan.summaryAttempts
  const setCell = (bi: number, si: number, k: 0 | 1, v: number) => {
    const tables = plan.tables.map((tb, j) =>
      j !== tableIdx ? tb : { ...tb, zones: tb.zones.map((row, b) => row.map((c, s) => (b === bi && s === si ? ((k === 0 ? [v, c[1]] : [c[0], v]) as [number, number]) : c))) },
    )
    setPlan({ ...plan, tables })
  }
  const bad = t.zones.flat().some(([m, a]) => m > a)
  return (
    <div className="review">
      <h3 className="review-title">Revisá lo que se va a cargar</h3>
      {csvLoaded && <p className="status error">Ya cargaste el CSV de Rugby Shot. Si cargás también este PDF, las patadas se van a duplicar.</p>}
      {plan.tables.length > 1 && (
        <label className="field">
          <span className="field-body">
            <span className="field-label">Pateador del informe</span>
            <select id="imp-player" value={tableIdx} onChange={(e) => setTableIdx(Number(e.target.value))}>
              {plan.tables.map((tb, i) => (
                <option key={i} value={i}>
                  {tb.player}
                </option>
              ))}
            </select>
          </span>
        </label>
      )}
      <div className="cards">
        <div className="card">
          <span className="card-label">Patadas</span>
          <strong className="card-big">{total}</strong>
          <span className="card-sub">
            {made} adentro{total ? ` · ${Math.round((made / total) * 100)}%` : ''}
          </span>
        </div>
        <div className="card">
          <span className="card-label">Según el informe</span>
          <strong className="card-big">{expected ?? '–'}</strong>
          <span className="card-sub">{expected == null ? 'sin total' : expected === total ? 'coincide' : 'no coincide, revisá la tabla'}</span>
        </div>
      </div>
      <p className="hint">Tocá cualquier número para corregirlo. Arriba van los aciertos y abajo los intentos de cada zona.</p>
      <div className="table-scroll">
        <table className="ztable edit">
          <thead>
            <tr>
              <th />
              {SIDES.map((s) => (
                <th key={s}>{SIDE_LABEL[s]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {BANDS.map((b, bi) => (
              <tr key={b}>
                <th>{BAND_LABEL[b]}</th>
                {SIDES.map((s, si) => {
                  const [m, a] = t.zones[bi][si]
                  return (
                    <td key={s} className={`ecell${m > a ? ' bad' : ''}`}>
                      <input inputMode="numeric" aria-label={`Aciertos ${SIDE_LABEL[s]} ${BAND_LABEL[b]}`} value={m} onChange={(e) => setCell(bi, si, 0, Math.max(0, parseInt(e.target.value || '0', 10) || 0))} />
                      <span>/</span>
                      <input inputMode="numeric" aria-label={`Intentos ${SIDE_LABEL[s]} ${BAND_LABEL[b]}`} value={a} onChange={(e) => setCell(bi, si, 1, Math.max(0, parseInt(e.target.value || '0', 10) || 0))} />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {bad && <p className="status error">Hay zonas con más aciertos que intentos (marcadas en rojo).</p>}
      <label className="field">
        <span className="field-body">
          <span className="field-label">Fecha para estas patadas</span>
          <input id="imp-date" type="date" value={toDateInput(plan.date)} onChange={(e) => e.target.value && setPlan({ ...plan, date: new Date(e.target.value + 'T12:00:00').toISOString() })} />
        </span>
      </label>
      <div className="group">
        <span className="group-label">Tipo de sesión</span>
        <Segmented<SessionType> size="sm" label="Tipo de sesión" value={type} onChange={setType} options={(Object.keys(SESSION_LABEL) as SessionType[]).map((x) => ({ value: x, label: SESSION_LABEL[x] }))} />
      </div>
      <div className="group">
        <span className="group-label">Tipo de patada</span>
        <Segmented<KickType> size="sm" label="Tipo de patada" value={kick} onChange={setKick} options={(Object.keys(KICK_LABEL) as KickType[]).map((x) => ({ value: x, label: KICK_LABEL[x] }))} />
        <p className="hint">El PDF no separa conversiones de penales: elegí el tipo que más pateaste.</p>
      </div>
      <button className="btn-primary wide" disabled={!total || bad} onClick={onConfirm}>
        <ICheck size={20} /> Confirmar y cargar {total} patadas
      </button>
    </div>
  )
}

/** Tarjeta para entrar a la importación */
export function ImportCard() {
  const nav = useNav()
  return (
    <button className="import-card" onClick={() => nav.push({ name: 'import' })}>
      <IUpload size={26} />
      <span>
        <strong>¿Tenías patadas cargadas en otra app?</strong>
        <small>Cargá el CSV o el PDF de Rugby Shot acá y se suman solas.</small>
      </span>
    </button>
  )
}
