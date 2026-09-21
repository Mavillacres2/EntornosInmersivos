# Arquitectura de analisis conductual

## Arquitectura original

El frontend era una aplicacion Vite + TypeScript + Babylon.js sin backend ni API. `frontend/src/main.ts` gestiona el selector y crea tres controladores independientes:

- `ClassroomScene` con `GoNoGoActivity`, `MetricsManager` y `DistractorManager`.
- `SpaceStationScene` con `CPTActivity`, `CPTMetricsManager` y `CPTDistractorManager`.
- `VisualDiscriminationScene` con `VisualDiscriminationController`, `VisualDiscriminationMetricsManager` y su gestor de distractores.

Cada escena ya poseia camara 3D, audio, personajes, ambiente, bloques, ensayos, tiempos y resultados. Esa logica no se movio ni se sustituyo.

## Estructura del repositorio

- `frontend/`: aplicacion Babylon.js, MediaPipe, escenas, actividades y assets publicos.
- `backend/`: API REST, validacion, servicios, persistencia MongoDB y pruebas.
- `docs/`: documentacion transversal del sistema.

Frontend y backend conservan sus propios manifiestos npm, lockfiles, variables de entorno, dependencias y directorios `dist`.

## Arquitectura final

```text
CAM1 -> Face/Pose Landmarker --+
                               +-> feature extractors -> BehaviorTrackingManager
CAM2 -> Pose Landmarker -------+                              |
                                                              v
actividades -> ActivityContextAdapter ----------------> DataSyncManager
                                                              |
                                                   BehaviorDataBuffer
                                                              |
                                                         REST API
                                                              |
                                                Express + Zod + MongoDB
```

`AnalysisApplicationController` vive al nivel de la aplicacion. Camaras, modelos, sesion y tracking permanecen activos al cambiar de escenario; solamente cambia `ActivityContext`.

## Integracion minima con actividades

Las actividades reciben opcionalmente un `ActivityTelemetrySink`. Solo notifican cambios ya existentes:

- estado de actividad;
- inicio de bloque;
- inicio y fin de ensayo;
- distractor;
- resultado final ya calculado.

No se cambiaron probabilidades, duraciones, estimulos, respuestas, practica, descansos, audio, controles ni calculos originales.

Identificadores comunes:

| Escenario | Actividad |
| --- | --- |
| `classroom` | `go-no-go` |
| `space-station` | `cpt` |
| `interactive-museum` | `visual-discrimination` |

## Camaras

`CameraManager` solicita permiso, usa `enumerateDevices()`, abre streams independientes con `deviceId: { exact }`, impide duplicados, escucha `devicechange`, detiene tracks y realiza un intento controlado de recuperacion.

- CAM1: cabeza y tronco superior. Es obligatoria para calibrar.
- CAM2: cuerpo completo. Es opcional para que una desconexion no bloquee Babylon ni la actividad.

Los labels se muestran despues del permiso, pero la seleccion interna usa el `deviceId` obtenido en tiempo de ejecucion. El identificador no se persiste en MongoDB.

## MediaPipe y landmarks

Version: `@mediapipe/tasks-vision` 1.0.1.

CAM1 ejecuta:

- Face Landmarker para yaw, pitch y roll aproximados. No hace reconocimiento de identidad.
- Pose Landmarker Lite para nariz, hombros y el tronco visible.

CAM2 ejecuta Pose Landmarker Full y utiliza hombros, codos, munecas, caderas, rodillas, tobillos, talones e indices de los pies.

Cada extractor verifica visibilidad. Una parte ocluida produce `null`, `available: false` o `quality: low/unavailable`; nunca se transforma automaticamente en cero.

## Indicadores

CAM1:

- orientacion relativa, yaw, pitch, roll;
- magnitud, velocidad y variabilidad de cabeza;
- giros de cabeza y episodios de orientacion fuera de tarea;
- inclinacion, magnitud, velocidad, variabilidad y estabilidad de tronco.

CAM2:

- movimiento de tren superior, brazos y pelvis;
- piernas, rodillas y pies por lado;
- tren inferior, actividad motora global y episodios de movimiento amplio.

Las distancias de cuerpo completo se dividen por la distancia visible entre hombros. Esto reduce el efecto de resolucion, distancia a camara y tamano corporal.

`motorActivity` agrega solamente movimiento normalizado de tronco y cuerpo completo. El movimiento angular de cabeza conserva sus unidades y se informa por separado, evitando promediar grados con distancias normalizadas.

Estos son indicadores conductuales y no diagnosticos. `taskRelevantMovement` y `taskIrrelevantMovement` permanecen en `null` hasta que exista una definicion experimental justificable.

## Calibracion

La interfaz pide mirar al centro durante 3000 ms por defecto. Se toman muestras de orientacion a la frecuencia de CAM1 y se usa la mediana de yaw, pitch y roll como baseline. Se requieren al menos cinco detecciones validas.

Los umbrales de desviacion, giro, postura y movimiento amplio estan marcados como experimentales y se configuran con variables Vite; no son umbrales clinicos.

## Frecuencias y rendimiento

Valores iniciales configurables:

- camara solicitada: 30 FPS ideal;
- CAM1: 12 analisis/s;
- CAM2: 10 analisis/s;
- persistencia: 5 samples/s;
- lote: 50 elementos o cada 3000 ms.

El scheduler alterna CAM1 y CAM2. Si Babylon cae por debajo de 38 FPS, reduce temporalmente a la mitad las frecuencias de analisis, sin cambiar timers ni logica cognitiva.

## Tiempo y sincronizacion

La sesion conserva `startedAt` ISO y `startedAtPerformance`. Los eventos de alta frecuencia usan `performance.now()` y se convierten a `elapsedMs` desde el inicio comun.

Cada sample combina:

- `scenarioId`, `activityId`, estado;
- bloque, condicion, ensayo y ensayo global;
- estimulo disponible;
- distractor activo, tipo e intervalo;
- indicadores CAM1/CAM2;
- FPS de analisis/render.

Los distractores existentes emiten inicio y fin sin modificar su presentacion. Se generan eventos `DISTRACTOR_STARTED`, `DISTRACTOR_ENDED` y, cuando corresponde, `DISTRACTOR_ORIENTATION_RESPONSE`.

El inicio y el fin conservan el escenario, bloque y ensayo originales aunque el contexto activo cambie. Cada distractor puede generar como maximo una respuesta de orientacion, evitando duplicar el conteo si hay varias desviaciones durante el mismo intervalo.

## Buffer y fallos

El buffer es exclusivamente de memoria, tiene limites configurables y envia lotes. Ante un fallo usa backoff hasta 30 segundos y no bloquea la actividad. Los vaciados concurrentes comparten el mismo envio en curso para que el cierre no produzca un falso fallo. Si el envio final falla, se detienen las camaras pero se conservan temporalmente los datos mientras la pagina siga abierta y aparece `Reintentar envio`.

No se usa `localStorage`, IndexedDB ni archivos para guardar material de camara.

## API y MongoDB

Endpoints:

| Metodo | Ruta | Funcion |
| --- | --- | --- |
| GET | `/api/health` | Salud de API/MongoDB |
| POST | `/api/sessions` | Crear o sincronizar sesion |
| POST | `/api/sessions/:id/behavior/batch` | Indicadores derivados |
| POST | `/api/sessions/:id/events/batch` | Eventos conductuales/tecnicos |
| POST | `/api/sessions/:id/activity-results` | Resultado original de actividad |
| POST | `/api/sessions/:id/finish` | Finalizar y generar resumen |
| GET | `/api/sessions/:id` | Sesion, resultados y resumen |

Colecciones e indices principales:

- `participants`: `participantCode` unico.
- `evaluation_sessions`: `sessionId` unico; `participantCode + startedAt`.
- `behavior_samples`: `sessionId + sampleId` unico; `sessionId + elapsedMs`; `sessionId + scenarioId`; `sessionId + condition`.
- `behavior_events`: `sessionId + eventId` unico; `sessionId + elapsedMs`.
- `activity_results`: `sessionId + scenarioId + activityId` unico.
- `session_summaries`: `sessionId` unico.

## Ejemplo de behavior sample

```json
{
  "sampleId": "uuid",
  "sessionId": "uuid",
  "elapsedMs": 32400,
  "scenarioId": "classroom",
  "activityId": "go-no-go",
  "blockNumber": 2,
  "condition": "visual",
  "trialNumber": 18,
  "distractor": {
    "active": true,
    "id": "visual-2-18",
    "type": "visual",
    "startedAtElapsedMs": 32000,
    "endedAtElapsedMs": 34000
  },
  "upperCamera": {
    "head": {
      "yaw": 8.2,
      "pitch": -1.1,
      "roll": 0.5,
      "movementMagnitude": 0.9,
      "orientationDeviation": 8.3,
      "available": true,
      "quality": "good"
    }
  },
  "fullBodyCamera": {
    "globalMotorActivity": 0.07,
    "leftFootMovement": null,
    "available": true,
    "quality": "fair"
  }
}
```

El DTO real incluye todos los campos tipados. Los valores no observables son `null`, no cero.

## Ejemplo de behavior event

```json
{
  "eventId": "uuid",
  "sessionId": "uuid",
  "elapsedMs": 32400,
  "type": "DISTRACTOR_ORIENTATION_RESPONSE",
  "scenarioId": "classroom",
  "activityId": "go-no-go",
  "blockNumber": 2,
  "trialNumber": 18,
  "details": {
    "distractorId": "visual-2-18",
    "distractorType": "visual",
    "latencyMs": 400
  }
}
```

## Ejemplo de session summary

```json
{
  "sessionId": "uuid",
  "sampleCount": 2200,
  "headMovementMean": 0.82,
  "headMovementVariability": 0.24,
  "trunkMovementMean": 0.05,
  "globalMotorActivityMean": 0.08,
  "offTaskOrientationPercentage": 7.4,
  "offTaskEpisodeCount": 9,
  "offTaskTotalTimeMs": 7470,
  "meanOffTaskDurationMs": 830,
  "meanReturnToTaskLatencyMs": 830,
  "distractorResponseCount": 5,
  "meanDistractorOrientationLatencyMs": 410,
  "byBlock": []
}
```

## Privacidad por diseno

- Los frames permanecen dentro de los `HTMLVideoElement`/`MediaStream` y llamadas `detectForVideo`.
- No se usa canvas para capturar la imagen. El modo debug dibuja solamente coordenadas derivadas.
- No existen endpoints de upload.
- Frontend y backend rechazan claves multimedia y data URLs.
- MongoDB almacena indicadores, eventos, resultados y resumenes.
- Al terminar se detienen tracks, timers y modelos.

## Debug

`VITE_ANALYSIS_DEBUG=true` habilita un panel solo para desarrollo con esqueletos derivados, puntos faciales minimos, FPS, buffer, conexion, escenario, bloque, ensayo y distractor. No muestra la imagen real y nunca envia esos puntos al backend.

## Pruebas

Automatizadas:

- una y dos camaras detectadas;
- prohibicion del mismo dispositivo;
- apertura con `deviceId.exact` y cierre de tracks;
- desconexion sin duplicar seleccion;
- buffer offline, recuperacion y vaciado final hasta su capacidad configurada;
- oclusion/null, normalizacion y reinicio de referencias temporales al recuperar deteccion;
- contexto de escenario/bloque/trial/distractor;
- privacidad frontend/backend;
- health conectado/degradado;
- resumen de sesion.

Requieren validacion manual con el equipo final:

- deteccion y calidad real de cada modelo;
- USB desconectada fisicamente durante actividad y recuperacion del navegador;
- rendimiento simultaneo de Babylon + tres modelos;
- recorrido temporal completo de las tres actividades;
- colocacion fisica a 30-45 grados y oclusiones producidas por el escritorio.

## Limitaciones actuales

- Los modelos se descargan de URLs externas por defecto; pueden servirse localmente mediante variables Vite.
- La precision de orientacion debe validarse con el protocolo y poblacion del estudio.
- No se implementa autenticacion porque aun no existe ese requisito.
- No se interpreta ningun indicador como TDAH, inatencion o hiperactividad.
