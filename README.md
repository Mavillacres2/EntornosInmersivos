# EntornosInmersivos

Aplicacion Babylon.js con tres escenarios cognitivos existentes y una capa transversal de analisis conductual con dos camaras. MediaPipe se ejecuta en el navegador; el backend recibe solamente indicadores derivados, eventos y resultados.

## Estructura

```text
EntornosInmersivos/
  frontend/   Babylon.js + TypeScript + Vite + MediaPipe
  backend/    Express + TypeScript + MongoDB
  docs/       Documentacion de arquitectura
```

Cada aplicacion tiene su propio `package.json`, `package-lock.json`, dependencias, configuracion y build. Los archivos del frontend no dependen de rutas ubicadas en la raiz del repositorio.

## Requisitos

- Node.js 20 o superior.
- MongoDB local o una URI de MongoDB accesible.
- Navegador con `getUserMedia`; usar `localhost` o HTTPS.
- Una webcam para cabeza/tronco y, de forma preferente, una segunda webcam USB para cuerpo completo.

## Instalacion

```powershell
cd frontend
npm install

cd ../backend
npm install
```

Crea los archivos locales de configuracion a partir de `frontend/.env.example` y `backend/.env.example`. No guardes credenciales reales en Git.

## Ejecucion

Terminal del backend:

```powershell
cd backend
npm run dev
```

Terminal del frontend:

```powershell
cd frontend
npm run dev
```

El frontend usa `http://localhost:5173` y el API `http://localhost:3001/api` por defecto. El backend tambien permite `5174`, que Vite utiliza cuando `5173` esta ocupado. Para cualquier otro puerto, agrega el origen completo a `CORS_ORIGIN`.

## Flujo

1. Ingresa un codigo pseudonimizado, por ejemplo `P001`.
2. Concede permiso y selecciona CAM1 y CAM2 por dispositivo, no por nombre fijo.
3. Comprueba los encuadres y calibra mirando al centro.
4. Entra al selector existente y completa los escenarios que correspondan.
5. Finaliza la evaluacion desde el selector. Si el API esta caido, la pantalla permite reintentar el envio mientras la pagina siga abierta.

Con una sola webcam, CAM1 funciona y CAM2 queda marcada como no disponible; la aplicacion no lanza una excepcion no controlada.

## Privacidad

No se graban ni transmiten fotografias, video, frames, blobs o `MediaStream`. Los elementos de video existen solo en memoria para MediaPipe. Al finalizar, todos los `MediaStreamTrack` se detienen. El API tambien rechaza claves y valores multimedia.

## Verificacion

```powershell
cd frontend
npm test
npm run build

cd ../backend
npm test
npm run build
```

La arquitectura, modelos, variables, DTO, colecciones, indices y matriz de pruebas estan descritos en `docs/analysis-architecture.md`.
