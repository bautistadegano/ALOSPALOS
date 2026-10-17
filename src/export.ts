import type { Data } from './types'
import { FOOT_LABEL, KICK_LABEL, POINTS, RESULT_LABEL, SESSION_LABEL } from './types'
import { BANDS, BAND_LABEL, SIDES, SIDE_LABEL, WIND_REL_LABEL, type EKick } from './geo'
import { countsPoints, fmtPct, pct, weekly, type Summary } from './stats'
import { PERIOD_LABEL, SCOPE_LABEL, type Filter } from './filter'

/** Entrega un archivo: menú de compartir del celular si existe, si no descarga. */
export async function deliver(blob: Blob, filename: string): Promise<'shared' | 'downloaded' | 'cancelled' | 'failed'> {
  // Dentro de la vista previa de Claude los archivos salen por su capacidad de descargas
  const cl = (window as unknown as { claude?: { use: (n: string) => Promise<{ save: (r: { filename: string; data: Blob }) => Promise<unknown> } | null> } }).claude
  if (cl?.use) {
    const dl = await cl.use('downloads').catch(() => null)
    if (dl) {
      try {
        await dl.save({ filename, data: blob })
        return 'downloaded'
      } catch (e) {
        return (e as { code?: string }).code === 'declined' ? 'cancelled' : 'failed'
      }
    }
  }
  const file = new File([blob], filename, { type: blob.type })
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean }
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename })
      return 'shared'
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled'
    }
  }
  try {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
    return 'downloaded'
  } catch {
    return 'failed'
  }
}

const stamp = () => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`
}

function filterText(f: Filter, d: Data) {
  const parts = [`Período: ${PERIOD_LABEL[f.period]}${f.period === 'custom' ? ` (${f.from ?? '…'} a ${f.to ?? '…'})` : ''}`]
  if (f.playerId !== 'all') parts.push(`Pateador: ${d.players.find((p) => p.id === f.playerId)?.name ?? ''}`)
  if (f.sessionTypes.length) parts.push(`Sesiones: ${f.sessionTypes.map((t) => SESSION_LABEL[t]).join(', ')}`)
  if (f.kickTypes.length) parts.push(`Patadas: ${f.kickTypes.map((t) => KICK_LABEL[t]).join(', ')}`)
  if (f.feet.length) parts.push(`Pie: ${f.feet.map((t) => FOOT_LABEL[t]).join(', ')}`)
  if (f.mirror) parts.push('Zurdos espejados')
  parts.push(`Mín. por zona: ${f.minAttempts}`)
  return parts.join(' · ')
}

// Colores fijos para el PDF (siempre fondo blanco)
const PRINT: Record<string, string> = {
  '--grass': '#4f8a5b',
  '--ingoal': '#3f7349',
  '--line': '#ffffff',
  '--line-soft': 'rgba(255,255,255,0.55)',
  '--post': '#ffffff',
  '--try': '#ffffff',
  '--good': '#2e7d32',
  '--bad': '#c62828',
  '--mark-stroke': '#ffffff',
  '--z-good': '#43a047',
  '--z-mid': '#c0ca33',
  '--z-low': '#fb8c00',
  '--z-bad': '#e53935',
  '--z-none': '#6c8f72',
}
const RGB = {
  good: [67, 160, 71],
  mid: [192, 202, 51],
  low: [251, 140, 0],
  bad: [229, 57, 53],
} as const
const zoneRGB = (p: number) => (p >= 0.75 ? RGB.good : p >= 0.5 ? RGB.mid : p >= 0.25 ? RGB.low : RGB.bad)

async function svgToPng(svg: SVGSVGElement, widthPx: number): Promise<{ data: string; ratio: number }> {
  let src = new XMLSerializer().serializeToString(svg)
  src = src.replace(/var\((--[a-z-]+)\)/g, (_, v: string) => PRINT[v] ?? '#888')
  src = src.replace(/class="zone-label"/g, 'font-family="Helvetica" font-size="2.4" font-weight="700" fill="#10261a"')
  src = src.replace(/<g class="pitch-legend">[\s\S]*?<\/g>/, '')
  const vb = svg.viewBox.baseVal
  const ratio = vb.height / vb.width
  const img = new Image()
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src)
  await new Promise<void>((res, rej) => {
    img.onload = () => res()
    img.onerror = () => rej(new Error('svg'))
    img.src = url
  })
  const c = document.createElement('canvas')
  c.width = widthPx
  c.height = Math.round(widthPx * ratio)
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.drawImage(img, 0, 0, c.width, c.height)
  return { data: c.toDataURL('image/png'), ratio }
}

export async function buildPdf(d: Data, f: Filter, ks: EKick[], sum: Summary, mapSvg: SVGSVGElement | null): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const M = 14
  const PW = 210
  let y = M
  const green: [number, number, number] = [82, 16, 32] // bordó Los Molinos
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...green)
  doc.text(`Informe de patadas · ${f.scope === 'piso' ? 'De piso (conversiones y penales)' : SCOPE_LABEL[f.scope]}`, M, (y += 6))
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(90)
  const ft = doc.splitTextToSize(filterText(f, d), PW - 2 * M)
  doc.text(ft, M, (y += 6))
  y += ft.length * 4 + 2

  // Resumen
  const rows: [string, string][] = [
    ['Intentos', String(sum.total.n)],
    ['Adentro', `${sum.total.made} (${fmtPct(sum.total)})`],
    ['Lado izquierdo (>10°)', `${fmtPct(sum.leftHalf)} · ${sum.leftHalf.made}/${sum.leftHalf.n}`],
    ['Lado derecho (>10°)', `${fmtPct(sum.rightHalf)} · ${sum.rightHalf.made}/${sum.rightHalf.n}`],
    ['Errores', `Izq. ${sum.misses.izquierda} · Der. ${sum.misses.derecha} · Corta ${sum.misses.corta} · Palo ${sum.misses.palo} · Otro ${sum.misses.otro}`],
    ['Mejor zona', sum.best ? `${SIDE_LABEL[sum.best.side]} ${BAND_LABEL[sum.best.band]} · ${fmtPct(sum.best.cell)}` : '–'],
    ['Peor zona', sum.worst ? `${SIDE_LABEL[sum.worst.side]} ${BAND_LABEL[sum.worst.band]} · ${fmtPct(sum.worst.cell)}` : '–'],
  ]
  if (sum.pointsKicks) {
    rows.push(['Puntos en partidos', String(sum.pointsMade)])
    if (d.settings.showWasted) rows.push(['Puntos perdidos', String(sum.pointsWasted)])
  }
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30)
  doc.text('Resumen', M, (y += 4))
  y += 2
  doc.setFontSize(9.5)
  for (const [k, v] of rows) {
    y += 5.2
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100)
    doc.text(k, M, y)
    doc.setTextColor(25)
    doc.setFont('helvetica', 'bold')
    doc.text(v, M + 52, y)
  }
  y += 6

  // Mapa
  if (mapSvg) {
    try {
      const img = await svgToPng(mapSvg, 1100)
      const w = 120
      const h = w * img.ratio
      doc.setFontSize(12)
      doc.setTextColor(30)
      doc.text('Mapa por zonas', M, (y += 4))
      doc.addImage(img.data, 'PNG', (PW - w) / 2, y + 3, w, h)
      y += h + 8
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(110)
      doc.text(`Verde 75% o más · Lima 50–75% · Naranja 25–50% · Rojo <25% · Rayado: menos de ${f.minAttempts} intentos. Frente ±10°, izq./der. 10–30°, abiertas >30°.`, M, y)
    } catch {
      /* sin imagen */
    }
  }

  // Tabla de zonas
  doc.addPage()
  y = M
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(30)
  doc.text('Acierto por zona', M, (y += 6))
  y += 4
  const colW = (PW - 2 * M - 22) / 5
  const rowH = 11
  doc.setFontSize(8)
  SIDES.forEach((s, i) => {
    doc.setTextColor(90)
    doc.text(SIDE_LABEL[s], M + 22 + i * colW + colW / 2, y + 4, { align: 'center' })
  })
  y += 6
  for (const b of BANDS) {
    doc.setTextColor(90)
    doc.setFont('helvetica', 'normal')
    doc.text(BAND_LABEL[b], M, y + rowH / 2 + 1.5)
    SIDES.forEach((s, i) => {
      const c = sum.zones.get(`${s}|${b}`)
      const x0 = M + 22 + i * colW
      if (c && c.n >= f.minAttempts) {
        const [r, g, bl] = zoneRGB(pct(c))
        doc.setFillColor(r, g, bl)
      } else doc.setFillColor(238, 241, 238)
      doc.rect(x0 + 0.6, y, colW - 1.2, rowH - 1.2, 'F')
      doc.setTextColor(20)
      doc.setFont('helvetica', 'bold')
      doc.text(c && c.n ? fmtPct(c) : '–', x0 + colW / 2, y + 4.6, { align: 'center' })
      doc.setFont('helvetica', 'normal')
      if (c && c.n) doc.text(`${c.made}/${c.n}`, x0 + colW / 2, y + 8.4, { align: 'center' })
    })
    y += rowH
  }

  // Desgloses
  const breakdown = (title: string, items: [string, { n: number; made: number }][]) => {
    const it = items.filter(([, c]) => c.n)
    if (!it.length) return
    y += 8
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(30)
    doc.text(title, M, y)
    doc.setFontSize(9)
    for (const [label, c] of it) {
      y += 6
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(80)
      doc.text(label, M, y)
      doc.setFillColor(232, 236, 232)
      doc.rect(M + 40, y - 3.2, 100, 4, 'F')
      const [r, g, b] = zoneRGB(pct(c))
      doc.setFillColor(r, g, b)
      doc.rect(M + 40, y - 3.2, 100 * pct(c), 4, 'F')
      doc.setTextColor(25)
      doc.text(`${fmtPct(c)}  (${c.made}/${c.n})`, M + 144, y)
    }
  }
  breakdown('Por distancia', BANDS.map((b) => [BAND_LABEL[b], sum.byBand.get(b)!]))
  if (f.scope !== 'drop') breakdown('Por tipo de patada', (['conversion', 'penal', 'drop'] as const).map((t) => [KICK_LABEL[t], sum.byType.get(t) ?? { n: 0, made: 0 }]))
  breakdown('Con viento', (['favor', 'contra', 'cruzado', 'sin'] as const).map((w) => [WIND_REL_LABEL[w], sum.byWind.get(w) ?? { n: 0, made: 0 }]))
  if (f.scope !== 'drop') breakdown('Tee', [['Con tee', sum.byTee.tee], ['Sin tee', sum.byTee.sin]])

  // Cuando erra, por lado
  {
    const lados: [string, EKick[]][] = [
      ['Izquierda', ks.filter((k) => k.signedAngle <= -10)],
      ['Medio', ks.filter((k) => k.signedAngle > -10 && k.signedAngle < 10)],
      ['Derecha', ks.filter((k) => k.signedAngle >= 10)],
    ]
    y += 12
    if (y > 240) {
      doc.addPage()
      y = M + 6
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(30)
    doc.text('Cuando erra, según el lado desde donde patea', M, y)
    const cols = ['', 'Acierto', 'Errores', 'A la izq.', 'A la der.', 'Corta', 'Palo/otro']
    const cw = [30, 22, 22, 24, 24, 22, 24]
    y += 6
    doc.setFontSize(8)
    doc.setTextColor(110)
    let x = M
    cols.forEach((c, i) => {
      doc.text(c, x + (i ? cw[i] : 0), y, { align: i ? 'right' : 'left' })
      x += cw[i]
    })
    doc.setFontSize(9)
    for (const [label, arr] of lados) {
      y += 6
      const miss = arr.filter((k) => !k.good)
      const sh = (r: string[]) => (miss.length ? `${Math.round((miss.filter((k) => r.includes(k.result)).length / miss.length) * 100)}%` : '–')
      const vals = [label, arr.length ? `${Math.round((arr.filter((k) => k.good).length / arr.length) * 100)}%` : '–', `${miss.length}/${arr.length}`, sh(['izquierda']), sh(['derecha']), sh(['corta']), sh(['palo', 'otro'])]
      x = M
      vals.forEach((v, i) => {
        doc.setTextColor(i ? 25 : 80)
        doc.text(v, x + (i ? cw[i] : 0), y, { align: i ? 'right' : 'left' })
        x += cw[i]
      })
    }
    doc.setFontSize(7)
    doc.setTextColor(130)
    y += 5
    doc.text('Lado: izquierda o derecha si el ángulo pasa los 10°. Los % de cada error son sobre los errores de ese lado.', M, y)
  }

  // Evolución semanal
  const wk = weekly(ks)
  if (wk.length > 1) {
    y += 12
    if (y > 230) {
      doc.addPage()
      y = M + 6
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(30)
    doc.text('Acierto por semana', M, y)
    const gx = M + 8
    const gy = y + 4
    const gw = PW - 2 * M - 10
    const gh = 40
    doc.setDrawColor(220)
    doc.setFontSize(7)
    doc.setTextColor(120)
    for (const g of [0, 0.5, 1]) {
      doc.line(gx, gy + gh * (1 - g), gx + gw, gy + gh * (1 - g))
      doc.text(String(g * 100), gx - 2, gy + gh * (1 - g) + 1, { align: 'right' })
    }
    doc.setDrawColor(...green)
    doc.setLineWidth(0.6)
    const X = (i: number) => gx + (i / (wk.length - 1)) * gw
    const Y = (p: number) => gy + gh * (1 - p)
    for (let i = 1; i < wk.length; i++) doc.line(X(i - 1), Y(pct(wk[i - 1].cell)), X(i), Y(pct(wk[i].cell)))
    doc.setFillColor(...green)
    wk.forEach((w, i) => {
      doc.circle(X(i), Y(pct(w.cell)), 0.9, 'F')
      if (wk.length <= 8 || i % Math.ceil(wk.length / 6) === 0) doc.text(new Date(w.t).toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric' }), X(i), gy + gh + 5, { align: 'center' })
    })
    doc.setLineWidth(0.2)
  }

  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(140)
    doc.text(`A los Palos · Club Los Molinos · generado ${new Date().toLocaleString('es-AR')}`, M, 290)
    doc.text(`${i} / ${pages}`, PW - M, 290, { align: 'right' })
  }
  return doc.output('blob')
}

export async function buildXlsx(d: Data, f: Filter, ks: EKick[], sum: Summary): Promise<Blob> {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  const resumen: (string | number)[][] = [
    [`Informe de patadas · ${SCOPE_LABEL[f.scope]}`],
    [filterText(f, d)],
    [],
    ['Indicador', 'Valor', 'Cómo se calcula'],
    ['Intentos', sum.total.n, 'Cantidad de patadas que pasan los filtros'],
    ['Adentro', sum.total.made, 'Patadas con resultado "Adentro"'],
    ['Acierto', sum.total.n ? sum.total.made / sum.total.n : 0, 'Adentro ÷ Intentos'],
    ['Acierto lado izquierdo', sum.leftHalf.n ? pct(sum.leftHalf) : '', 'Patadas con ángulo a la izquierda mayor a 10°'],
    ['Acierto lado derecho', sum.rightHalf.n ? pct(sum.rightHalf) : '', 'Patadas con ángulo a la derecha mayor a 10°'],
    ['Errores a la izquierda', sum.misses.izquierda, ''],
    ['Errores a la derecha', sum.misses.derecha, ''],
    ['Cortas', sum.misses.corta, ''],
    ['Palo', sum.misses.palo, ''],
    ['Otro', sum.misses.otro, ''],
  ]
  if (sum.pointsKicks) {
    resumen.push(['Puntos en partidos', sum.pointsMade, 'Conversión 2 · Penal 3 · Drop 3, solo patadas adentro en partido'])
    if (d.settings.showWasted) resumen.push(['Puntos perdidos', sum.pointsWasted, 'Mismos valores, patadas erradas en partido'])
  }
  const ws1 = XLSX.utils.aoa_to_sheet(resumen)
  for (const r of [7, 8, 9]) {
    const cell = ws1[XLSX.utils.encode_cell({ r: r - 1, c: 1 })]
    if (cell && typeof cell.v === 'number') cell.z = '0%'
  }
  ws1['!cols'] = [{ wch: 26 }, { wch: 12 }, { wch: 60 }]
  XLSX.utils.book_append_sheet(wb, ws1, 'Resumen')

  const zonas: (string | number)[][] = [['Distancia', ...SIDES.map((s) => SIDE_LABEL[s])]]
  for (const b of BANDS) {
    zonas.push([BAND_LABEL[b], ...SIDES.map((s) => {
      const c = sum.zones.get(`${s}|${b}`)
      return c && c.n ? `${c.made}/${c.n} (${fmtPct(c)})` : '–'
    })])
  }
  zonas.push([], ['Frente: ±10° · Izquierda/Derecha: 10° a 30° · Abiertas: más de 30°. Ángulo y distancia medidos desde el centro de los palos.'])
  const ws2 = XLSX.utils.aoa_to_sheet(zonas)
  ws2['!cols'] = [{ wch: 12 }, ...SIDES.map(() => ({ wch: 15 }))]
  XLSX.utils.book_append_sheet(wb, ws2, 'Zonas')

  const raw = ks
    .slice()
    .sort((a, b) => a.session.date.localeCompare(b.session.date) || a.kick.createdAt - b.kick.createdAt)
    .map((k) => ({
      Fecha: new Date(k.session.date).toLocaleString('es-AR'),
      Sesión: SESSION_LABEL[k.session.type],
      Lugar: k.session.place,
      Rival: k.session.opponent ?? '',
      Pateador: k.player?.name ?? '',
      Pie: k.player ? FOOT_LABEL[k.player.foot] : '',
      Patada: KICK_LABEL[k.kick.kickType],
      Resultado: RESULT_LABEL[k.kick.result],
      'Distancia (m)': Math.round(k.distance * 10) / 10,
      'Ángulo (°)': Math.round(k.signedAngle * 10) / 10,
      'Apertura palos (°)': Math.round(k.postGap * 10) / 10,
      Sector: SIDE_LABEL[k.side],
      Franja: BAND_LABEL[k.band],
      'X desde lateral izq. (m)': Math.round(k.kick.x * 10) / 10,
      'Y desde línea de try (m)': Math.round(k.kick.y * 10) / 10,
      Tiempo: k.kick.half ? `${k.kick.half}º` : '',
      Tee: k.kick.kickType === 'drop' ? '' : k.kick.tee === false ? 'No' : 'Sí',
      'Viento (m/s)': k.session.windSpeed ?? '',
      Viento: WIND_REL_LABEL[k.wind],
      Puntos: countsPoints(k.session, d.settings.pointsInFriendlies) && k.good ? POINTS[k.kick.kickType] : 0,
    }))
  const ws3 = XLSX.utils.json_to_sheet(raw)
  XLSX.utils.book_append_sheet(wb, ws3, 'Patadas')

  const como = [
    ['Cómo se calcula cada columna de "Patadas"'],
    [],
    ['Columna', 'Fórmula / criterio'],
    ['X, Y', 'Punto que tocaste en la cancha. X en metros desde el lateral izquierdo (mirando a los palos), Y en metros desde la línea de try.'],
    ['Distancia (m)', '√( (X − ancho/2)² + Y² ) → distancia al centro de los palos'],
    ['Ángulo (°)', 'atan( |X − ancho/2| ÷ Y ). 0° es de frente. Negativo = lado izquierdo, positivo = lado derecho'],
    ['Apertura palos (°)', 'Ángulo entre los dos palos visto desde el punto de pateo: atan2(palo der − X, Y) − atan2(palo izq − X, Y). Cuanto más chico, más difícil'],
    ['Sector', 'Frente si |ángulo| < 10°, Izquierda/Derecha entre 10° y 30°, Abierta si es mayor a 30°'],
    ['Franja', 'Distancia: 0–20, 20–30, 30–40, 40 m o más'],
    ['Viento', 'Dirección cargada en la sesión, invertida en el 2º tiempo. A favor/en contra si está a menos de 45° del eje de la cancha; cruzado si no. Menos de 1,5 m/s = sin viento'],
    ['Puntos', 'Solo patadas adentro en partido (y amistoso si está activado en Ajustes): conversión 2, penal 3, drop 3'],
    [],
    [`Medidas de cancha por defecto: ${d.settings.defaultPitch.length} × ${d.settings.defaultPitch.width} m, palos a ${d.settings.defaultPitch.postGap} m (cada sesión guarda las suyas).`],
  ]
  const ws4 = XLSX.utils.aoa_to_sheet(como)
  ws4['!cols'] = [{ wch: 20 }, { wch: 110 }]
  XLSX.utils.book_append_sheet(wb, ws4, 'Cómo se calcula')

  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

export const fileName = (f: Filter, ext: string) => `alospalos_${f.scope}_${stamp()}.${ext}`
