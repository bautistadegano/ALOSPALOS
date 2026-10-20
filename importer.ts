// Importar patadas desde la app original (Rugby Shot).
// - CSV: trae cada patada con posición y resultado → importación exacta.
// - PDF: trae la tabla de zonas (aciertos/intentos) → se reconstruyen las patadas por zona.
// Todo se lee en el celular, sin IA ni internet.
import type { Kick, KickType, Pitch, Result, Session, SessionType, Weather } from './types'
import { BAND_RANGE, BANDS, SIDE_RANGE, SIDES } from './geo'

export interface CsvKick {
  kickType: KickType
  xRel: number // metros desde el centro de los palos
  y: number
  result: Result
  note?: string
}
export interface CsvSession {
  key: string
  date: string
  type: SessionType
  place: string
  temp?: number
  windSpeed?: number
  weather?: Weather
  windNote?: string
  opponent?: string
  kicks: CsvKick[]
  include: boolean
}
export interface PdfTable {
  player: string
  zones: [number, number][][] // [banda][sector] = [aciertos, intentos]
  attempts?: number
}
export type ImportPlan =
  | { source: 'csv'; sessions: CsvSession[]; skippedRows: number }
  | { source: 'pdf'; tables: PdfTable[]; date: string; summaryAttempts?: number }

/* ---------- CSV ---------- */
function parseCsvText(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cur = ''
  let q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        cur += '"'
        i++
      } else if (c === '"') q = false
      else cur += c
    } else if (c === '"') q = true
    else if (c === ',' || c === ';') {
      row.push(cur)
      cur = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cur)
      cur = ''
      if (row.some((x) => x.trim())) rows.push(row)
      row = []
    } else cur += c
  }
  row.push(cur)
  if (row.some((x) => x.trim())) rows.push(row)
  return rows
}

const n = (v?: string) => {
  if (v == null || v.trim() === '') return undefined
  const x = parseFloat(v.replace(',', '.'))
  return Number.isFinite(x) ? x : undefined
}

// Rugby Shot guarda el clima con el código WMO (0 despejado, 3 nublado, 61 lluvia...)
function mapWeather(v?: string): Weather | undefined {
  const c = v == null || v === '' ? NaN : Number(v)
  if (!Number.isFinite(c)) return undefined
  if (c <= 1) return 'despejado'
  if (c === 2) return 'parcial'
  if (c === 3) return 'nublado'
  if (c === 45 || c === 48) return 'niebla'
  if (c >= 95) return 'tormenta'
  return 'lluvia'
}

function mapKind(v: string): SessionType {
  const s = v.toLowerCase()
  if (s.includes('practice match') || s.includes('amist')) return 'amistoso'
  if (s.includes('match') || s.includes('partido')) return 'partido'
  return 'entrenamiento'
}
function mapKick(v: string): KickType | null {
  const s = v.toLowerCase()
  if (s.includes('conv')) return 'conversion'
  if (s.includes('drop')) return 'drop'
  if (s.includes('pen')) return 'penal'
  if (s.includes('field') || s.includes('set')) return 'penal'
  return null
}
function mapResult(v: string): Result {
  const s = v.toLowerCase()
  if (s.startsWith('good') || s.includes('adentro') || s === 'goal') return 'adentro'
  if (s.includes('left') || s.includes('izq')) return 'izquierda'
  if (s.includes('right') || s.includes('der')) return 'derecha'
  if (s.includes('short') || s.includes('corta')) return 'corta'
  if (s.includes('post') || s.includes('palo')) return 'palo'
  return 'otro'
}

export function parseCsv(text: string): ImportPlan {
  const rows = parseCsvText(text.replace(/^﻿/, ''))
  if (rows.length < 2) throw new Error('El archivo está vacío.')
  const head = rows[0].map((h) => h.trim().toLowerCase())
  const col = (...names: string[]) => {
    for (const nm of names) {
      const i = head.indexOf(nm)
      if (i >= 0) return i
    }
    for (const nm of names) {
      const i = head.findIndex((h) => h.startsWith(nm))
      if (i >= 0) return i
    }
    return -1
  }
  const C = {
    sid: col('session_id', 'session'),
    date: col('started_at', 'date', 'fecha'),
    kind: col('kind', 'type'),
    place: col('place', 'location', 'lugar'),
    temp: col('temp_c', 'temperature', 'temp'),
    weather: col('weather', 'clima'),
    wind: col('wind_ms', 'wind'),
    windNote: col('wind_note'),
    opp: col('opponent', 'rival'),
    kick: col('kick_kind', 'kick_type'),
    x: col('x_m', 'x'),
    y: col('y_m', 'y'),
    result: col('result', 'resultado'),
    note: head.lastIndexOf('note'),
  }
  if (C.x < 0 || C.y < 0 || C.result < 0) throw new Error('No encontré las columnas de posición (x_m, y_m) y resultado. ¿Es el CSV de Rugby Shot?')
  const map = new Map<string, CsvSession>()
  let skipped = 0
  for (const r of rows.slice(1)) {
    const kt = mapKick(r[C.kick] ?? 'penal')
    const x = n(r[C.x])
    const y = n(r[C.y])
    if (!kt || x == null || y == null) {
      skipped++
      continue
    }
    const key = (C.sid >= 0 && r[C.sid]) || r[C.date] || 'sin-sesion'
    if (!map.has(key)) {
      const d = new Date(r[C.date] ?? '')
      map.set(key, {
        key,
        date: Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString(),
        type: mapKind(r[C.kind] ?? ''),
        place: (C.place >= 0 && r[C.place]) || '',
        temp: C.temp >= 0 ? n(r[C.temp]) : undefined,
        windSpeed: C.wind >= 0 ? n(r[C.wind]) : undefined,
        weather: C.weather >= 0 ? mapWeather(r[C.weather]) : undefined,
        windNote: (C.windNote >= 0 && r[C.windNote]) || undefined,
        opponent: (C.opp >= 0 && r[C.opp]) || undefined,
        kicks: [],
        include: true,
      })
    }
    map.get(key)!.kicks.push({ kickType: kt, xRel: x, y, result: mapResult(r[C.result] ?? ''), note: C.note > C.result ? r[C.note] : undefined })
  }
  const sessions = [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
  if (!sessions.length) throw new Error('No encontré patadas en el archivo.')
  return { source: 'csv', sessions, skippedRows: skipped }
}

/* ---------- PDF ---------- */
type Line = { y: number; page: number; text: string; items: { x: number; s: string }[] }

async function pdfLines(buf: ArrayBuffer): Promise<Line[]> {
  const pdfjs = await import('pdfjs-dist')
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.js?raw')).default
  pdfjs.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([worker], { type: 'text/javascript' }))
  const doc = await pdfjs.getDocument({ data: buf }).promise
  const out: Line[] = []
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const tc = await page.getTextContent()
    const lines: Line[] = []
    for (const it of tc.items as { str: string; transform: number[] }[]) {
      if (!it.str || !it.str.trim()) continue
      const x = it.transform[4]
      const y = it.transform[5]
      let ln = lines.find((l) => Math.abs(l.y - y) < 3)
      if (!ln) {
        ln = { y, page: p, text: '', items: [] }
        lines.push(ln)
      }
      ln.items.push({ x, s: it.str })
    }
    lines.sort((a, b) => b.y - a.y)
    for (const l of lines) {
      l.items.sort((a, b) => a.x - b.x)
      l.text = l.items.map((i) => i.s).join(' ').replace(/\s+/g, ' ').trim()
    }
    out.push(...lines)
  }
  return out
}

const ROW_RE = /^(?:[-–—]\s?20\s?m|0\s?[-–—]\s?20\s?m|20\s?[-–—]\s?30\s?m|30\s?[-–—]\s?40\s?m|40\s?m\s?\+)/i
function rowIndex(label: string) {
  const l = label.replace(/\s/g, '').replace(/[–—]/g, '-').toLowerCase()
  if (l.startsWith('-20') || l.startsWith('0-20')) return 0
  if (l.startsWith('20-30')) return 1
  if (l.startsWith('30-40')) return 2
  if (l.startsWith('40m+')) return 3
  return -1
}

export async function parsePdf(buf: ArrayBuffer): Promise<ImportPlan> {
  const lines = await pdfLines(buf)
  const all = lines.map((l) => l.text).join('\n')
  if (!/zones|attempts|goal kick/i.test(all)) throw new Error('Este PDF no parece un informe de Rugby Shot.')
  const tables: PdfTable[] = []
  let player = ''
  let playerAttempts: number | undefined
  let cur: PdfTable | null = null
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].text
    const att = t.match(/Attempts:\s*(\d+)/i)
    if (att && /foot/i.test(t)) {
      player = (lines[i - 1]?.text ?? '').trim()
      playerAttempts = Number(att[1])
      cur = null
      continue
    }
    const m = t.match(ROW_RE)
    if (m) {
      const idx = rowIndex(m[0])
      if (idx < 0) continue
      const rest = t.slice(m[0].length)
      const cells: [number, number][] = []
      const re = /(\d+)\s*\/\s*(\d+)|(?:^|\s)[–—-](?=\s|$)/g
      let mm: RegExpExecArray | null
      while ((mm = re.exec(rest))) cells.push(mm[1] != null ? [Number(mm[1]), Number(mm[2])] : [0, 0])
      if (cells.length < 5) continue
      if (!cur || idx === 0 || cur.zones[idx].some((c) => c[1] > 0)) {
        cur = { player: player || `Tabla ${tables.length + 1}`, zones: BANDS.map(() => SIDES.map(() => [0, 0] as [number, number])), attempts: playerAttempts }
        tables.push(cur)
      }
      cur.zones[idx] = cells.slice(0, 5)
    }
  }
  if (!tables.length) throw new Error('No encontré la tabla de zonas en el PDF. Mandame el archivo y lo ajusto.')
  const dm = all.match(/(\d{4})-(\d{2})-(\d{2})/)
  const date = dm ? new Date(`${dm[1]}-${dm[2]}-${dm[3]}T12:00:00`).toISOString() : new Date().toISOString()
  const sa = all.match(/Attempts\s+(\d+)/i)
  return { source: 'pdf', tables, date, summaryAttempts: sa ? Number(sa[1]) : undefined }
}

/* ---------- Armar sesiones y patadas ---------- */
let seed = 11
const rnd = () => {
  seed = (seed * 16807) % 2147483647
  return seed / 2147483647
}

/** Punto dentro de una zona (sector × franja), adentro de la cancha */
function pointInZone(bi: number, si: number, pitch: Pitch) {
  const [a1, a2] = SIDE_RANGE[SIDES[si]]
  const [r1, r2] = BAND_RANGE[BANDS[bi]]
  const cx = pitch.width / 2
  for (let t = 0; t < 40; t++) {
    const a = ((Math.max(a1, -80) + rnd() * (Math.min(a2, 80) - Math.max(a1, -80))) * Math.PI) / 180
    const r = Math.max(r1, 6) + rnd() * (Math.min(r2, 52) - Math.max(r1, 6))
    const x = cx + r * Math.sin(a)
    const y = r * Math.cos(a)
    if (x > 1 && x < pitch.width - 1 && y > 2) return { x, y }
  }
  return { x: cx, y: (r1 + Math.min(r2, 50)) / 2 }
}

export function buildCsv(plan: Extract<ImportPlan, { source: 'csv' }>, meId: string, pitch: Pitch, existingKeys: Set<string>) {
  // En Rugby Shot x_m es desde el centro de los palos: negativo = izquierda (verificado con datos reales)
  const flip = false
  const sessions: Session[] = []
  const kicks: Kick[] = []
  for (const cs of plan.sessions) {
    if (!cs.include) continue
    const importKey = `rugbyshot:${cs.key}`
    if (existingKeys.has(importKey)) continue
    const id = 'imp-' + Math.random().toString(36).slice(2, 10)
    const t0 = new Date(cs.date).getTime()
    sessions.push({
      id,
      type: cs.type,
      date: cs.date,
      place: cs.place,
      temp: cs.temp,
      windSpeed: cs.windSpeed,
      weather: cs.weather,
      windDir: null,
      windNote: cs.windNote,
      opponent: cs.opponent,
      note: 'Importado de Rugby Shot',
      pitch: { ...pitch },
      playerIds: [meId],
      importKey,
      createdAt: Date.now(),
    })
    cs.kicks.forEach((k, i) => {
      const xr = flip ? -k.xRel : k.xRel
      let result = k.result
      if (flip && result === 'izquierda') result = 'derecha'
      else if (flip && result === 'derecha') result = 'izquierda'
      kicks.push({
        id: `${id}-${i}`,
        sessionId: id,
        playerId: meId,
        kickType: k.kickType,
        x: Math.max(0, Math.min(pitch.width, pitch.width / 2 + xr)),
        y: Math.max(0.5, k.y),
        result,
        tee: k.kickType === 'drop' ? undefined : true,
        createdAt: t0 + i * 1000,
      })
    })
  }
  return { sessions, kicks }
}

export function buildPdf(table: PdfTable, date: string, type: SessionType, kickType: KickType, meId: string, pitch: Pitch, existingKeys: Set<string>) {
  const importKey = `rugbyshot-pdf:${date.slice(0, 10)}:${table.zones.flat().map((c) => c.join('/')).join(',')}`
  if (existingKeys.has(importKey)) return { sessions: [], kicks: [], duplicate: true }
  const id = 'imp-' + Math.random().toString(36).slice(2, 10)
  const session: Session = {
    id,
    type,
    date,
    place: '',
    windDir: null,
    note: 'Importado del informe PDF de Rugby Shot (posiciones aproximadas por zona)',
    pitch: { ...pitch },
    playerIds: [meId],
    importKey,
    createdAt: Date.now(),
  }
  const kicks: Kick[] = []
  const t0 = new Date(date).getTime()
  seed = 11
  table.zones.forEach((row, bi) =>
    row.forEach(([made, att], si) => {
      for (let i = 0; i < att; i++) {
        const p = pointInZone(bi, si, pitch)
        kicks.push({
          id: `${id}-${bi}${si}-${i}`,
          sessionId: id,
          playerId: meId,
          kickType,
          x: p.x,
          y: p.y,
          result: i < made ? 'adentro' : 'otro',
          tee: kickType === 'drop' ? undefined : true,
          approx: true,
          createdAt: t0 + kicks.length * 1000,
        })
      }
    }),
  )
  return { sessions: [session], kicks, duplicate: false }
}
