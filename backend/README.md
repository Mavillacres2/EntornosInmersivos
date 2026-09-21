# Analysis API

Backend modular monolitico en Express, TypeScript, Zod y MongoDB. No recibe ni procesa material de camara.

## Configuracion

Desde `backend/`, usa `.env.example` como referencia y crea un archivo `.env` local:

```env
PORT=3001
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB_NAME=entornos_inmersivos
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174
MAX_BATCH_SIZE=250
MONGODB_CONNECT_TIMEOUT_MS=3000
NODE_ENV=development
```

`CORS_ORIGIN` acepta una lista separada por comas. `MAX_BATCH_SIZE` tiene un limite interno de 500 y el cuerpo JSON tiene un limite de 1 MB.

## Comandos

```powershell
cd backend
npm install
npm run dev
npm test
npm run build
npm start
```

El servidor puede iniciar con MongoDB apagado. `/api/health` respondera `503` y las solicitudes de persistencia fallaran de forma controlada. Cuando MongoDB regrese, la siguiente operacion vuelve a conectar y crea los indices pendientes.

## Endpoints

- `GET /api/health`
- `POST /api/sessions`
- `POST /api/sessions/:sessionId/behavior/batch`
- `POST /api/sessions/:sessionId/events/batch`
- `POST /api/sessions/:sessionId/activity-results`
- `POST /api/sessions/:sessionId/finish`
- `GET /api/sessions/:sessionId`

Todos los DTO son estrictos. Se rechazan numeros no finitos, campos arbitrarios, lotes sobredimensionados y cualquier payload con frames, imagenes, video, blobs, pixeles o data URLs multimedia.

## Colecciones

- `participants`
- `evaluation_sessions`
- `behavior_samples`
- `behavior_events`
- `activity_results`
- `session_summaries`

Los samples se guardan como documentos separados e idempotentes mediante `sessionId + sampleId`; no se crea un arreglo gigante por sesion.
