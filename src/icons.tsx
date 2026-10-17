import type { SessionType, Weather } from './types'

type P = { size?: number; className?: string }
const S = ({ size = 22, className, children }: P & { children: React.ReactNode }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {children}
  </svg>
)

export const IBack = (p: P) => <S {...p}><path d="M15 5l-7 7 7 7" /></S>
export const IChevron = (p: P) => <S {...p}><path d="M9 5l7 7-7 7" /></S>
export const IPlus = (p: P) => <S {...p}><path d="M12 5v14M5 12h14" /></S>
export const IEdit = (p: P) => <S {...p}><path d="M4 20h4L19 9l-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></S>
export const ITrash = (p: P) => <S {...p}><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" /></S>
export const IMore = (p: P) => <S {...p}><circle cx="12" cy="5.5" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="18.5" r="1" fill="currentColor" /></S>
export const IShare = (p: P) => <S {...p}><path d="M12 15V4M8 8l4-4 4 4" /><path d="M6 12v7h12v-7" /></S>
export const IMap = (p: P) => <S {...p}><path d="M4 20V4h16v16z" /><path d="M4 9h16M12 4v5" /><path d="M8 20a4 4 0 018 0" /></S>
export const ITable = (p: P) => <S {...p}><rect x="4" y="4" width="16" height="16" rx="1.5" /><path d="M4 10h16M4 15h16M10 4v16M15 4v16" /></S>
export const ITrophy = (p: P) => <S {...p}><path d="M8 4h8v5a4 4 0 01-8 0V4z" /><path d="M8 6H5a3 3 0 003 4M16 6h3a3 3 0 01-3 4M12 13v4M8.5 20h7M10 17h4" /></S>
export const ITrend = (p: P) => <S {...p}><path d="M4 17l5-5 4 3 7-8" /><path d="M15 7h5v5" /></S>
export const IUsers = (p: P) => <S {...p}><circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0111 0" /><circle cx="17" cy="9" r="2.3" /><path d="M16 14a4.5 4.5 0 014.5 5" /></S>
export const IGear = (p: P) => <S {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" /></S>
export const IBall = (p: P) => <S {...p}><ellipse cx="12" cy="12" rx="9.5" ry="5.8" transform="rotate(-35 12 12)" /><path d="M8.5 15.5l7-7M10 12.2l1.8 1.8M11.6 10.6l1.8 1.8" /></S>
export const ICal = (p: P) => <S {...p}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></S>
export const IPin = (p: P) => <S {...p}><path d="M12 21s6-5.6 6-11a6 6 0 00-12 0c0 5.4 6 11 6 11z" /><circle cx="12" cy="10" r="2.2" /></S>
export const IFilter = (p: P) => <S {...p}><path d="M4 6h16M7 12h10M10 18h4" /></S>
export const ICheck = (p: P) => <S {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></S>
export const IX = (p: P) => <S {...p}><path d="M6 6l12 12M18 6L6 18" /></S>
export const IRight = (p: P) => <S {...p}><path d="M5 12h14M13 6l6 6-6 6" /></S>
export const ILeft = (p: P) => <S {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></S>
export const IDown = (p: P) => <S {...p}><path d="M12 5v14M6 13l6 6 6-6" /></S>
export const IPost = (p: P) => <S {...p}><path d="M7 3v18M17 3v18M7 13h10" /></S>
export const ITry = (p: P) => <S {...p}><path d="M4 7h16" strokeDasharray="0" /><path d="M12 7v13" strokeDasharray="2 2.5" /><circle cx="12" cy="7" r="2" fill="currentColor" /></S>
export const IWind = (p: P) => <S {...p}><path d="M3 9h11a3 3 0 10-3-3M3 15h15a3 3 0 11-3 3M3 12h7" /></S>
export const IDownload = (p: P) => <S {...p}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></S>
export const IUpload = (p: P) => <S {...p}><path d="M12 15V4M7 9l5-5 5 5M5 20h14" /></S>
export const IFile = (p: P) => <S {...p}><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 13h6M9 17h6" /></S>
export const ILink = (p: P) => <S {...p}><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" /></S>

export const ICone = (p: P) => <S {...p}><path d="M9.5 4h5l4 14h-13z" /><path d="M4 20h16M8 12h8" /></S>
export const IHand = (p: P) => <S {...p}><path d="M3 12l4-4 4 2 3-3 7 6-5 5-3-2-2 2-4-3z" /><path d="M11 10l3 3M9 14l2 2" /></S>
export const IWhistle = (p: P) => <S {...p}><circle cx="9" cy="14" r="5" /><path d="M13 11l8-4v4l-6 3M7 6l-1-2M11 5l.5-2" /></S>
export const SessionIcon = ({ type, ...p }: P & { type: SessionType }) =>
  type === 'partido' ? <IWhistle {...p} /> : type === 'amistoso' ? <IHand {...p} /> : <ICone {...p} />

export const WeatherIcon = ({ w, ...p }: P & { w?: Weather }) => {
  switch (w) {
    case 'despejado':
      return <S {...p}><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" /></S>
    case 'parcial':
      return <S {...p}><circle cx="9" cy="8" r="3" /><path d="M9 2.5v1M3.5 8h1M5 4l.7.7M13 4l-.7.7" /><path d="M8 19h9a3.5 3.5 0 000-7 5 5 0 00-9.5 1.5A2.8 2.8 0 008 19z" /></S>
    case 'nublado':
      return <S {...p}><path d="M7 18h10a4 4 0 000-8 6 6 0 00-11.4 2A3 3 0 007 18z" /></S>
    case 'lluvia':
      return <S {...p}><path d="M7 14h10a4 4 0 000-8 6 6 0 00-11.4 2A3 3 0 007 14z" /><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3" /></S>
    case 'tormenta':
      return <S {...p}><path d="M7 14h10a4 4 0 000-8 6 6 0 00-11.4 2A3 3 0 007 14z" /><path d="M12 14l-2 4h3l-2 4" /></S>
    case 'niebla':
      return <S {...p}><path d="M4 9h16M6 13h12M4 17h16" /></S>
    default:
      return null
  }
}
