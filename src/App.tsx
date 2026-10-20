import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NavCtx, type Route, type Tab } from './ui'
import { FilterCtx, defaultFilter, type Filter } from './filter'
import Sessions from './screens/Sessions'
import SessionForm from './screens/SessionForm'
import SessionView from './screens/SessionView'
import Analysis from './screens/Analysis'
import Profile, { PlayerForm } from './screens/Profile'
import { useStore } from './store'
import { useAuth } from './auth'
import AuthScreen from './screens/Auth'
import { BrandFull } from './Brand'
import { InstallGate, Tutorial, tutorialPending } from './Guide'
import Settings from './screens/Settings'
import Report from './screens/Report'
import Misses from './screens/Misses'
import Import from './screens/Import'
import { FriendProfile } from './screens/Friends'
import { IBall, IMap, IUsers, IGear } from './icons'

const TABS: { tab: Tab; label: string; icon: JSX.Element }[] = [
  { tab: 'sesiones', label: 'Sesiones', icon: <IBall /> },
  { tab: 'analisis', label: 'Análisis', icon: <IMap /> },
  { tab: 'jugadores', label: 'Perfil', icon: <IUsers /> },
  { tab: 'ajustes', label: 'Ajustes', icon: <IGear /> },
]

function loadFilter(): Filter {
  try {
    const raw = sessionStorage.getItem('alospalos:filter')
    if (raw) return { ...defaultFilter, ...JSON.parse(raw), playerId: 'all', feet: [], mirror: false }
  } catch {
    /* nada */
  }
  return defaultFilter
}

export default function App() {
  const [stack, setStack] = useState<Route[]>([{ name: 'tabs', tab: 'sesiones' }])
  const [filter, setFilterState] = useState<Filter>(loadFilter)
  const setFilter = useCallback((f: Filter) => {
    setFilterState(f)
    try {
      sessionStorage.setItem('alospalos:filter', JSON.stringify(f))
    } catch {
      /* nada */
    }
  }, [])

  // Botón atrás del celular / navegador: cada pantalla nueva agrega una entrada al historial
  const skipPop = useRef(false)
  const pushed = useRef(0)
  useEffect(() => {
    const onPop = () => {
      if (skipPop.current) {
        skipPop.current = false
        return
      }
      pushed.current = Math.max(0, pushed.current - 1)
      setStack((s) => (s.length > 1 ? s.slice(0, -1) : s))
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const nav = useMemo(
    () => ({
      push: (r: Route) => {
        try {
          history.pushState(null, '')
          pushed.current++
        } catch {
          /* nada */
        }
        setStack((s) => [...s, r])
        window.scrollTo(0, 0)
      },
      back: () => {
        setStack((s) => (s.length > 1 ? s.slice(0, -1) : s))
        if (pushed.current > 0) {
          pushed.current--
          skipPop.current = true
          try {
            history.back()
          } catch {
            skipPop.current = false
          }
        }
      },
      replace: (r: Route) => setStack((s) => [...s.slice(0, -1), r]),
    }),
    [],
  )

  const { data } = useStore()
  const [showTut, setShowTut] = useState(tutorialPending)
  useEffect(() => {
    const open = () => setShowTut(true)
    window.addEventListener('alospalos:tutorial', open)
    return () => window.removeEventListener('alospalos:tutorial', open)
  }, [])
  const top = stack[stack.length - 1]
  const tabRoute = stack.find((r) => r.name === 'tabs') as { name: 'tabs'; tab: Tab }
  const setTab = (tab: Tab) => setStack((s) => s.map((r) => (r.name === 'tabs' ? { name: 'tabs', tab } : r)))

  let screen: JSX.Element
  switch (top.name) {
    case 'tabs':
      screen = top.tab === 'sesiones' ? <Sessions /> : top.tab === 'analisis' ? <Analysis /> : top.tab === 'jugadores' ? <Profile /> : <Settings />
      break
    case 'sessionForm':
      screen = <SessionForm key={top.id ?? 'new'} id={top.id} />
      break
    case 'session':
      screen = <SessionView key={top.id} id={top.id} />
      break
    case 'playerForm':
      screen = <PlayerForm key={top.id ?? 'new'} id={top.id} />
      break
    case 'report':
      screen = <Report />
      break
    case 'misses':
      screen = <Misses />
      break
    case 'import':
      screen = <Import />
      break
    case 'friend':
      screen = <FriendProfile key={top.id} id={top.id} />
      break
  }

  const auth = useAuth()
  if (auth.enabled && (!auth.ready || !auth.user || auth.recovering || !auth.linked)) {
    let body: JSX.Element
    if (!auth.ready) body = <Splash text="" />
    else if (!auth.user || auth.recovering) body = <AuthScreen />
    else
      body = (
        <Splash
          text={auth.sync === 'error' ? `No se pudo cargar tu cuenta: ${auth.syncError}` : 'Cargando tu cuenta…'}
          action={auth.sync === 'error' ? { label: 'Salir y volver a entrar', run: () => void auth.signOut() } : undefined}
        />
      )
    return (
      <NavCtx.Provider value={nav}>
        <div className="app">
          <InstallGate />
          {body}
        </div>
      </NavCtx.Provider>
    )
  }

  if (!data.settings.meId) {
    return (
      <NavCtx.Provider value={nav}>
        <div className="app">
          <InstallGate />
          <PlayerForm onboarding />
        </div>
      </NavCtx.Provider>
    )
  }

  return (
    <NavCtx.Provider value={nav}>
      <FilterCtx.Provider value={{ filter, setFilter }}>
        <div className={`app${top.name === 'tabs' ? ' with-tabs' : ''}`}>
          <InstallGate />
          {screen}
          {showTut && <Tutorial onClose={() => setShowTut(false)} />}
          {top.name === 'tabs' && (
            <nav className="tabbar" aria-label="Secciones">
              {TABS.map((t) => (
                <button key={t.tab} className={tabRoute.tab === t.tab ? 'on' : ''} aria-current={tabRoute.tab === t.tab ? 'page' : undefined} onClick={() => setTab(t.tab)}>
                  <span className="tab-icon">{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </nav>
          )}
        </div>
      </FilterCtx.Provider>
    </NavCtx.Provider>
  )
}

function Splash({ text, action }: { text: string; action?: { label: string; run: () => void } }) {
  return (
    <div className="screen onboarding">
      <main className="content form splash"><div className="content-inner">
        <BrandFull />
        {text && <p className="onb-text">{text}</p>}
        {action && (
          <button className="btn-secondary wide" onClick={action.run}>
            {action.label}
          </button>
        )}
      </div></main>
    </div>
  )
}
