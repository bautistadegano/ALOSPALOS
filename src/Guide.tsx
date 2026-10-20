import { useEffect, useState } from 'react'
import { cloudEnabled } from './cloud'
import { HMark } from './Brand'
import PitchView from './components/Pitch'
import { IPlus, IRepeat, IZoom, ITry, IEdit, IUpload, IUsers, IChevron, IX } from './icons'

/* ---------- ¿Está instalada? ---------- */
export function isStandalone() {
  try {
    return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
  } catch {
    return false
  }
}
const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
const isIOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document)
const isAndroid = /Android/i.test(ua)
const inAppBrowser = /Instagram|FBAN|FBAV|WhatsApp|Line\//i.test(ua)

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

/** Aviso para instalar la app en la pantalla de inicio (solo en la versión publicada, desde el navegador) */
export function InstallGate() {
  const [show, setShow] = useState(false)
  const [open, setOpen] = useState(false)
  const [bip, setBip] = useState<BIPEvent | null>(null)
  useEffect(() => {
    if (!cloudEnabled || isStandalone()) return
    setShow(true)
    let dismissed = false
    try {
      dismissed = sessionStorage.getItem('alospalos:install-later') === '1'
    } catch {
      /* nada */
    }
    setOpen(!dismissed)
    const h = (e: Event) => {
      e.preventDefault()
      setBip(e as BIPEvent)
    }
    window.addEventListener('beforeinstallprompt', h)
    return () => window.removeEventListener('beforeinstallprompt', h)
  }, [])
  if (!show) return null
  const later = () => {
    try {
      sessionStorage.setItem('alospalos:install-later', '1')
    } catch {
      /* nada */
    }
    setOpen(false)
  }
  return (
    <>
      {!open && (
        <button className="install-strip" onClick={() => setOpen(true)}>
          <span>Instalá la app en tu inicio para no perder tus datos</span>
          <strong>Ver cómo</strong>
        </button>
      )}
      {open && (
        <div className="install-overlay" role="dialog" aria-label="Instalar la app">
          <div className="install-card">
            <HMark size={64} />
            <h2>Instalá A los Palos</h2>
            <p className="install-lead">Así queda como una app más en tu celular, a pantalla completa y sin perder tus patadas.</p>
            {inAppBrowser && (
              <p className="install-warn">
                Estás dentro de otra app (WhatsApp, Instagram…). Primero abrí este link en {isIOS ? 'Safari' : 'Chrome'}: tocá los tres puntitos o el ícono de compartir y elegí <strong>Abrir en {isIOS ? 'Safari' : 'el navegador'}</strong>.
              </p>
            )}
            {isAndroid ? (
              bip ? (
                <button
                  className="btn-primary wide"
                  onClick={async () => {
                    await bip.prompt()
                    setBip(null)
                  }}
                >
                  Instalar
                </button>
              ) : (
                <ol className="install-steps">
                  <li>
                    Tocá el menú <span className="ios-key">⋮</span> arriba a la derecha de Chrome.
                  </li>
                  <li>
                    Elegí <span className="ios-key">Instalar app</span> o <span className="ios-key">Agregar a la pantalla principal</span>.
                  </li>
                  <li>Abrila desde el ícono nuevo en tu inicio.</li>
                </ol>
              )
            ) : (
              <ol className="install-steps">
                <li>
                  Abrí este link en <strong>Safari</strong>.
                </li>
                <li>
                  Tocá los <span className="ios-key">•••</span> tres puntitos de abajo.
                </li>
                <li>
                  Tocá <span className="ios-key">
                    <ShareGlyph /> Compartir
                  </span>
                  .
                </li>
                <li>
                  Tocá <span className="ios-key">Ver más</span>.
                </li>
                <li>
                  Elegí <span className="ios-key">
                    <AddGlyph /> Agregar a inicio
                  </span>{' '}
                  y después <strong>Agregar</strong>.
                </li>
                <li>Cerrá Safari y abrí A los Palos desde el ícono de tu inicio.</li>
              </ol>
            )}
            <button className="btn-text" onClick={later}>
              Seguir en el navegador por ahora
            </button>
          </div>
        </div>
      )}
    </>
  )
}

const ShareGlyph = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M12 15V3M8 7l4-4 4 4M6 11v9h12v-9" />
  </svg>
)
const AddGlyph = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="4" y="4" width="16" height="16" rx="4" />
    <path d="M12 8v8M8 12h8" />
  </svg>
)

/* ---------- Tutorial ---------- */
const KEY = 'alospalos:tutorial-v1'
export function tutorialPending() {
  try {
    return localStorage.getItem(KEY) !== '1'
  } catch {
    return false
  }
}
export function markTutorialDone() {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    /* nada */
  }
}

const pitch = { length: 100, width: 70, postGap: 5.6 }
const demoMarks = [
  { id: 'a', x: 30, y: 22, result: 'adentro' as const },
  { id: 'b', x: 48, y: 30, result: 'izquierda' as const },
  { id: 'c', x: 20, y: 35, result: 'adentro' as const },
  { id: 'd', x: 55, y: 18, result: 'corta' as const },
]
const demoZones = new Map([
  ['frente|20-30', { n: 8, made: 7 }],
  ['izquierda|20-30', { n: 6, made: 4 }],
  ['derecha|20-30', { n: 6, made: 3 }],
  ['frente|30-40', { n: 7, made: 4 }],
  ['izquierda|30-40', { n: 6, made: 2 }],
  ['derecha|30-40', { n: 5, made: 4 }],
  ['frente|0-20', { n: 5, made: 5 }],
])

const SLIDES = [
  {
    title: 'Creá una sesión',
    text: 'En Sesiones tocá el +. Elegí entrenamiento, amistoso o partido; el lugar y el clima se cargan solos.',
    visual: (
      <div className="tut-fab">
        <IPlus size={34} />
      </div>
    ),
  },
  {
    title: 'Marcá cada patada',
    text: 'Tocá en la cancha desde dónde pateaste y elegí el resultado: Adentro, Izquierda, Derecha o Corta. Arriba elegís Penal, Conversión o Drop.',
    visual: <PitchView pitch={pitch} compact marks={demoMarks} pending={{ x: 40, y: 26 }} />,
  },
  {
    title: 'Herramientas de la cancha',
    text: '',
    visual: (
      <ul className="tut-tools">
        <li>
          <IRepeat size={20} />
          <span><strong>Mismo lugar</strong> repite la posición de la patada anterior.</span>
        </li>
        <li>
          <IZoom size={20} />
          <span><strong>Lupa</strong> acerca la cancha para marcar el punto exacto.</span>
        </li>
        <li>
          <ITry size={20} />
          <span><strong>Try</strong>: tocás dónde se apoyó y después la distancia sobre la línea.</span>
        </li>
        <li>
          <IEdit size={20} />
          <span><strong>Editar</strong> para corregir o borrar una patada ya cargada.</span>
        </li>
      </ul>
    ),
  },
  {
    title: 'Leé tu análisis',
    text: 'El mapa pinta cada zona según cuánto metés: verde mucho, rojo poco. En “Cuando erra” ves hacia dónde se te van desde cada lado.',
    visual: <PitchView pitch={pitch} compact zones={demoZones} minAttempts={5} showMarks={false} labelMode="pct" />,
  },
  {
    title: 'Traé lo tuyo y sumá amigos',
    text: '',
    visual: (
      <ul className="tut-tools">
        <li>
          <IUpload size={20} />
          <span>¿Usabas Rugby Shot? En <strong>Ajustes</strong> subí el CSV y tus patadas se suman solas.</span>
        </li>
        <li>
          <IUsers size={20} />
          <span>En <strong>Perfil</strong> buscás amigos por su usuario y elegís quién ve tus estadísticas.</span>
        </li>
        <li>
          <IChevron size={20} />
          <span>¿Algo no anda o se te ocurre una idea? <strong>Ajustes → Reportar</strong>.</span>
        </li>
      </ul>
    ),
  },
]

export function Tutorial({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0)
  const s = SLIDES[i]
  const last = i === SLIDES.length - 1
  const close = () => {
    markTutorialDone()
    onClose()
  }
  return (
    <div className="tut-overlay" role="dialog" aria-label="Cómo se usa">
      <div className="tut-card">
        <button className="icon-btn tut-close" aria-label="Cerrar tutorial" onClick={close}>
          <IX />
        </button>
        <span className="tut-step">
          {i + 1} de {SLIDES.length}
        </span>
        <div className="tut-visual">{s.visual}</div>
        <h2>{s.title}</h2>
        {s.text && <p>{s.text}</p>}
        <div className="tut-dots" aria-hidden="true">
          {SLIDES.map((_, j) => (
            <span key={j} className={j === i ? 'on' : ''} />
          ))}
        </div>
        <div className="tut-actions">
          {i > 0 ? (
            <button className="btn-text" onClick={() => setI(i - 1)}>
              Atrás
            </button>
          ) : (
            <button className="btn-text" onClick={close}>
              Saltear
            </button>
          )}
          <button className="btn-primary" onClick={() => (last ? close() : setI(i + 1))}>
            {last ? '¡A patear!' : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>
  )
}
