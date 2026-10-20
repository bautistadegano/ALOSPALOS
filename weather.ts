import type { Weather } from './types'

// Clima automático: ubicación del celular + Open-Meteo (gratis, sin clave).
// Si no hay permiso o internet, el formulario queda para completar a mano.

function codeToWeather(c: number): Weather {
  if (c === 0 || c === 1) return 'despejado'
  if (c === 2) return 'parcial'
  if (c === 3) return 'nublado'
  if (c === 45 || c === 48) return 'niebla'
  if (c >= 95) return 'tormenta'
  return 'lluvia'
}

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error('sin geolocalización'))
    navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000, maximumAge: 600000 })
  })
}

export async function fetchConditions(): Promise<{ place?: string; temp?: number; weather?: Weather; windSpeed?: number }> {
  const pos = await getPosition()
  const { latitude: lat, longitude: lon } = pos.coords
  const out: { place?: string; temp?: number; weather?: Weather; windSpeed?: number } = {}
  const [w, g] = await Promise.allSettled([
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m&wind_speed_unit=ms`).then((r) => r.json()),
    fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=es`).then((r) => r.json()),
  ])
  if (w.status === 'fulfilled' && w.value?.current) {
    out.temp = Math.round(w.value.current.temperature_2m * 10) / 10
    out.weather = codeToWeather(w.value.current.weather_code)
    out.windSpeed = Math.round(w.value.current.wind_speed_10m * 10) / 10
  }
  if (g.status === 'fulfilled' && g.value) out.place = g.value.locality || g.value.city || undefined
  return out
}
