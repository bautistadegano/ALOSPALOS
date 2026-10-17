# A los Palos

App web instalable (PWA) para registrar patadas a los palos de rugby.

## Probar en la compu
```
npm install
npm run dev
```

## Publicar en Vercel (igual que MiPlata)
1. Subí esta carpeta a un repo nuevo de GitHub.
2. En Vercel: Add New → Project → elegí el repo. Framework: Vite. Build: `npm run build`. Output: `dist`.
3. Abrí el link en Safari del celular → Compartir → "Agregar a inicio".

## Estructura
- `src/store.tsx`: dónde se guardan los datos (hoy en el celular; etapa 2: Supabase).
- `src/geo.ts`: distancia, ángulo, apertura de palos, zonas y viento.
- `src/stats.ts`: porcentajes, zonas, puntos.
- `src/export.ts`: PDF y Excel.
- `src/screens/`: cada pantalla.
