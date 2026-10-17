export type SessionType = 'entrenamiento' | 'amistoso' | 'partido'
export type KickType = 'conversion' | 'penal' | 'drop'
export type Result = 'adentro' | 'derecha' | 'izquierda' | 'corta' | 'palo' | 'otro'
export type Foot = 'derecho' | 'izquierdo' | 'ambos'
export type Weather = 'despejado' | 'parcial' | 'nublado' | 'lluvia' | 'tormenta' | 'niebla'

export interface Pitch {
  length: number // largo total de juego (m)
  width: number // ancho (m)
  postGap: number // distancia entre palos (m)
}

export interface Player {
  id: string
  name: string
  foot: Foot
  height?: number
  weight?: number
  dob?: string
  number?: number
  position?: string
  demo?: boolean
}

export interface Session {
  id: string
  type: SessionType
  date: string // ISO
  place: string
  temp?: number
  weather?: Weather
  windSpeed?: number // m/s
  /** Dirección hacia donde sopla, relativa a los palos que se atacan en el 1er tiempo.
   *  0 = a favor (sopla hacia los palos), 90 = de izquierda a derecha, 180 = en contra, 270 = de derecha a izquierda. */
  windDir?: number | null
  windNote?: string
  opponent?: string
  note?: string
  pitch: Pitch
  playerIds: string[]
  demo?: boolean
  createdAt: number
}

export interface Kick {
  id: string
  sessionId: string
  playerId: string
  kickType: KickType
  x: number // metros desde el lateral izquierdo (mirando a los palos)
  y: number // metros desde la línea de try
  tryX?: number // si se cargó con modo try
  result: Result
  half?: 1 | 2
  tee?: boolean
  createdAt: number
}

export interface Settings {
  theme: 'system' | 'light' | 'dark'
  showWasted: boolean
  pointsInFriendlies: boolean
  defaultPitch: Pitch
  lastPlayerId?: string
  v?: number
}

export interface Data {
  version: 1
  players: Player[]
  sessions: Session[]
  kicks: Kick[]
  settings: Settings
}

export const SESSION_LABEL: Record<SessionType, string> = {
  entrenamiento: 'Entrenamiento',
  amistoso: 'Amistoso',
  partido: 'Partido',
}
export const KICK_LABEL: Record<KickType, string> = { conversion: 'Conversión', penal: 'Penal', drop: 'Drop' }
export const RESULT_LABEL: Record<Result, string> = {
  adentro: 'Adentro',
  derecha: 'Derecha',
  izquierda: 'Izquierda',
  corta: 'Corta',
  palo: 'Palo',
  otro: 'Otro',
}
export const WEATHER_LABEL: Record<Weather, string> = {
  despejado: 'Despejado',
  parcial: 'Parcial',
  nublado: 'Nublado',
  lluvia: 'Lluvia',
  tormenta: 'Tormenta',
  niebla: 'Niebla',
}
export const FOOT_LABEL: Record<Foot, string> = { derecho: 'Derecho', izquierdo: 'Izquierdo', ambos: 'Ambos' }
export const POINTS: Record<KickType, number> = { conversion: 2, penal: 3, drop: 3 }
