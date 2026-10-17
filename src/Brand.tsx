import hImg from './assets/h.png'
import t1 from './assets/text1.png'
import t2 from './assets/text2.png'
import escudo from './assets/escudo.png'

/** Texto del logo como máscara: toma el color del tema (bordó en claro, blanco en oscuro) */
function Mask({ src, ratio, h, className }: { src: string; ratio: number; h: number; className?: string }) {
  return (
    <span
      className={`wm ${className ?? ''}`}
      style={{ height: h, width: h * ratio, WebkitMaskImage: `url(${src})`, maskImage: `url(${src})` }}
      aria-hidden="true"
    />
  )
}

export function Escudo({ size = 40 }: { size?: number }) {
  return <img src={escudo} alt="Escudo Club Los Molinos" className="escudo" style={{ height: size, width: 'auto' }} />
}

export function HMark({ size = 40 }: { size?: number }) {
  return <img src={hImg} alt="" className="hmark" style={{ height: size, width: 'auto' }} />
}

/** Cabecera de marca para la pantalla principal */
export function BrandHeader() {
  return (
    <header className="brand-header">
      <div className="brand-left">
        <HMark size={54} />
        <div className="brand-words">
          <h1 className="sr-only">A los Palos · Club Los Molinos</h1>
          <Mask src={t1} ratio={6.857} h={22} />
          <Mask src={t2} ratio={12.36} h={11} className="wm-sub" />
        </div>
      </div>
      <Escudo size={44} />
    </header>
  )
}

/** Logo completo (Ajustes / acerca de) */
export function BrandFull() {
  return (
    <div className="brand-full">
      <HMark size={120} />
      <Mask src={t1} ratio={6.857} h={34} />
      <Mask src={t2} ratio={12.36} h={16} className="wm-sub" />
      <Escudo size={56} />
    </div>
  )
}
