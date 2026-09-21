# Frontend

Aplicacion Vite + TypeScript + Babylon.js con los tres escenarios cognitivos y la capa local de analisis MediaPipe.

## Configuracion

Desde `frontend/`, usa `.env.example` como referencia para crear un archivo `.env` local. La API predeterminada es `http://localhost:3001/api`.

## Comandos

```powershell
cd frontend
npm install
npm run dev
npm test
npm run build
npm run preview
```

Vite publica el contenido de `public/` en `/assets/...`; por ello los modelos GLB, audios y demas recursos mantienen sus rutas actuales.

MediaPipe procesa los streams localmente. El frontend no graba ni envia imagenes, frames, video o `MediaStream` al backend.
