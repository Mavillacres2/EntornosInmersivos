# Evolución del módulo de visión

## Corrección posterior: alcance de CAM1

La aclaración final añade un modo de overlay exclusivo para CAM1: muestra brazos
y referencias del tronco sin piernas. El centro de cabeza usa la media de cuatro
referencias del contorno facial (10, 152, 234, 454); si faltan, reutiliza el punto
medio de orejas de Pose cuando es válido. Solo se combinan sus posiciones 2D para
dibujar: las profundidades de Face y Pose no se mezclan en métricas 3D.
Se destacan los centros derivados. Sin caderas válidas se omite el centro del torso;
sin ambos hombros válidos se omite el cuello. Muñecas y codos se dibujan cuando
están disponibles, pero no son requisitos de calidad para el encuadre de CAM1.
CAM2 conserva la ruta de dibujo completa por defecto.

CAM1 ahora combina Face y Pose Lite para rostro, ojos, cabeza, cuello derivado,
hombros, brazos y tronco superior. Ambos modelos alternan en el planificador;
`VITE_UPPER_ANALYSIS_FPS` es la frecuencia objetivo por modelo (dos turnos por
ciclo), sujeta a la reducción por rendimiento existente. La configuración debe
permitir ver cabeza, hombros, codos y muñecas. La cámara debe alejarse si los brazos
quedan fuera del encuadre; no se inventan articulaciones ocultas.

Las métricas de `upperCamera.trunk` provienen de CAM1 con
`trunkSource: 'upper-camera'`. El backend sigue aceptando `body-camera` para las
muestras de la iteración anterior. Se conservan los landmarks de ambos modelos
entre turnos, con caducidad, y los eventos de pestañeo solo se emiten en una
actualización facial. Pose Lite se libera junto con los demás modelos al finalizar.

CAM2 mantiene su distribución Pose Full + Hands y sus métricas. Este ajuste
sustituye las referencias a CAM1 exclusivamente facial y al tronco desde CAM2
en el informe histórico que sigue.

## 1. Arquitectura encontrada

`main.ts` integra `AnalysisApplicationController` con las tres escenas mediante
`ActivityContextAdapter`. El flujo de análisis ya estaba separado:

`CameraManager → MediaPipeManager → BehaviorTrackingManager → DataSyncManager → BehaviorDataBuffer → AnalysisApiClient → API → AnalysisRepository → MongoDB`.

El selector manual usa `MediaDevices.deviceId` exacto e impide compartir el mismo
dispositivo entre roles. Las selecciones se conservan en los slots del administrador
durante su vida; no se encontró persistencia de selección entre recargas. No se creó
otro administrador ni se asignó el papel de una cámara mediante su índice.

Antes: Face + Pose Lite en CAM1, alternados, y Pose Full en CAM2. Face calculaba
orientación y solo exponía cinco puntos para dibujo; no solicitaba blendshapes.
Pose aportaba 33 puntos. Había calibración frontal, métricas de cabeza, tronco,
extremidades y movimiento, eventos, buffers, recuperación de cámaras y diagnóstico
de rendimiento. No había Hand Landmarker ni Web Workers.

## 2. Archivos modificados en esta iteración

Todos los siguientes paths son relativos a la raíz de este proyecto:

- `frontend/.env.example`
- `frontend/src/analysis/config/AnalysisConfig.ts`
- `frontend/src/analysis/types/AnalysisTypes.ts`
- `frontend/src/analysis/types/BehaviorTypes.ts`
- `frontend/src/analysis/mediapipe/FaceAnalysisService.ts`
- `frontend/src/analysis/mediapipe/PoseAnalysisService.ts`
- `frontend/src/analysis/mediapipe/MediaPipeManager.ts`
- `frontend/src/analysis/tracking/BehaviorTrackingManager.ts`
- `frontend/src/analysis/synchronization/DataSyncManager.ts`
- `frontend/src/analysis/ui/LandmarkOverlayRenderer.ts`
- `frontend/src/analysis/ui/EvaluationSetupView.ts`
- `frontend/src/analysis/ui/AnalysisDebugOverlay.ts`
- `frontend/src/analysis/tests/MediaPipeManager.test.ts`
- `frontend/src/analysis/tests/DataSyncManager.test.ts`
- `backend/src/validation/schemas.ts`
- `backend/src/tests/validation.test.ts`

El árbol ya tenía modificaciones locales en otros archivos, incluidos `main.ts`,
el administrador de cámaras, componentes del especialista, estilos y backend.
Se conservaron; no son cambios atribuibles a esta iteración.

## 3. Archivos creados

- `frontend/src/analysis/mediapipe/HandAnalysisService.ts`
- `frontend/src/analysis/features/BlinkFeatureExtractor.ts`
- `frontend/src/analysis/features/HandFeatureExtractor.ts`
- `frontend/src/analysis/features/VisionGeometry.ts`
- `frontend/src/analysis/tests/VisionMetrics.test.ts`
- `frontend/src/analysis/tests/VisionServices.test.ts`
- `VISION_EVOLUTION.md`

## 4. Reutilización

Se reutilizan la dependencia instalada `@mediapipe/tasks-vision`, los modelos Face
y Pose Full, resolución WASM, fallback GPU/CPU, cámaras, selección manual,
calibración, planificador RAF y throttling adaptado al FPS de Babylon, extractores
existentes, canvas, telemetría de actividades, buffer, endpoints y repositorio MongoDB.
No hay dependencia nueva. `upperPoseModelUrl` sigue aceptándose por compatibilidad
de configuración, aunque ya no se carga ese modelo.

## 5. Cambios imprescindibles

Se eliminó la inferencia Pose de CAM1 y se agregó Hands a CAM2. Pose y Hands se
alternan para conservar una sola inferencia por turno del planificador. Las métricas
de tronco se calculan ahora desde CAM2. Por compatibilidad, su DTO conserva la
ubicación `upperCamera.trunk`, acompañada de `trunkSource: 'body-camera'`.
La validación estricta del backend se amplió mediante campos opcionales, por lo
que sigue aceptando muestras anteriores. Los ángulos nuevos corrigen la asignación
de ejes anterior: no deben mezclarse sin distinguir versión con sesiones históricas.
La presencia de `vision` identifica muestras de esta evolución.

## 6–8. Landmarks y cámaras

CAM1 (seleccionar manualmente la cámara integrada): Face exclusivamente. Se
mantienen en memoria los puntos faciales completos que devuelve el modelo,
incluidos párpados e iris cuando están disponibles. El overlay normal dibuja
contorno, cejas, ojos, iris, nariz, labios y un eje discreto. El modo debug agrega IDs
y ángulos. Los puntos originales no se suavizan ni se sobrescriben.

CAM2 (seleccionar cámara externa): Pose Full y Hands alternados. Conserva hombros,
codos, muñecas, cadera, piernas y pies. Agrega 21 puntos por mano y conexiones
oficiales de MediaPipe. Se eliminan conexiones directas oreja-hombro y se dibujan
centros derivados de cabeza, cuello y torso. No se ejecuta Face en CAM2.

Sin cámara externa, el análisis facial puede continuar; las métricas corporales
quedan ausentes. No se sustituye automáticamente por otro modelo en CAM1.

## 9. Pestañeo

Se usan `eyeBlinkLeft` y `eyeBlinkRight` sin suavizarlos. Histéresis: cierre ≥ 0.55,
reapertura ≤ 0.30; mínimo dos muestras de cierre; duración de 60–600 ms. Debe
observarse apertura antes del cierre. Los cierres bilaterales solapados se fusionan.
Pérdida de rostro/ojos o hueco de muestreo > 180 ms cancela el episodio incompleto.
Se excluyen orientaciones extremas y contornos oculares fuera del encuadre.

Cada evento `BLINK` conserva ojo, inicio, fin y duración, además del contexto que
aporta el adaptador existente. Las métricas incluyen conteo total, conteos por ojo,
duración promedio y tasa por minuto de **tiempo observado**, no por duración total
de la sesión. Son estimaciones muestreadas; no parámetros clínicos ni diagnósticos.

## 10. Yaw / pitch / roll

Se reutiliza la matriz facial de MediaPipe. La descomposición column-major sigue
`R = Rz(roll) Ry(yaw) Rx(pitch)`: yaw corresponde al eje Y, pitch a X y roll a Z.
Se normalizan las escalas de las columnas. Se aplica EMA con factor 0.6 y banda
muerta de 0.35 grados, separada de los landmarks originales. La calibración
existente conserva el cero relativo de la sesión. Sin matriz válida se omiten los
ángulos, evitando presentar la posición de la nariz como orientación equivalente.
El overlay refleja coordenadas para coincidir con el preview; las métricas no.

## 11. Cuello y eje corporal

`calculateNeckCenter` reutiliza `midpoint`: promedio de hombros, con la menor
visibilidad de ambos. `headCenter` usa el promedio de las orejas; `torsoCenter`,
el punto medio entre centro de hombros y centro de caderas. Cada par exige
landmarks finitos con visibilidad suficiente. Si falta un par, ese centro es null.
No se alteran ni se completan los puntos originales de Pose.

## 12. Manos

Se usa Hand Landmarker del paquete ya instalado, con hasta dos manos. Se requiere
el conjunto completo de 21 puntos finitos dentro del encuadre. Se filtra lateralidad
con score ≥ 0.7 y se conserva la mejor detección si hay dos con la misma etiqueta.
Ese score es **confianza de clasificación izquierda/derecha**, no confianza de
cada articulación. Face/Hands no exponen aquí scores independientes por landmark:
`visibility: 1` es únicamente un indicador interno de punto retornado y validado,
no una probabilidad medida. No se inventa una confianza facial numérica.

## 13. Métricas disponibles

- Orientación y movimiento de cabeza; métricas corporales anteriores reutilizadas.
- Apertura ocular aproximada como `1 - eyeBlink`, estados y eventos de pestañeo.
- Posición 2D de muñeca, velocidad en coordenadas normalizadas por segundo,
  distancia recorrida normalizada y apertura geométrica de cada mano.
- Apertura manual: promedio de distancia base-punta dividido por longitud
  articulada de cada dedo. Es una proporción geométrica, no clasificación de gesto.
- Inclinación lateral proyectada del torso en grados, corregida por relación de
  aspecto del video. No es rotación axial 3D.
- Timestamps separados de Pose y Hands, fuentes de cámara y tiempos de inferencia.

Se interrumpen trayectorias al perder detección; no se suma un salto entre pérdida
y recuperación. Caches corporales caducan a 750 ms y el cambio de stream los limpia.
Los timestamps internos usan `performance.now()`; al persistir se convierten a
milisegundos desde el inicio de sesión. Se guardan copias de las métricas para que
las actualizaciones posteriores no modifiquen muestras anteriores.

## 14. Siguiente iteración

Quedan disponibles puntos y timestamps para frecuencia de movimientos de manos,
tiempo visible/no visible, distancia mano-cara en la misma cámara y variación de
postura más detallada. No se implementaron gaze, clasificación emocional, rotación
axial del torso ni resta de yaw entre cámaras: eso requiere geometría/calibración
adicional. Las métricas nuevas quedan en los lotes guardados; no se rediseñó el
panel de resultados ni su agregación de resúmenes.

## 15–16. Rendimiento y workers

Se mantienen los valores existentes configurables: CAM1 8 turnos/s y CAM2 4
turnos/s; en CAM2 cada modelo recibe aproximadamente la mitad. **Son límites de
configuración, no FPS medidos.** La carga de Babylon puede reducirlos más.
La frecuencia conservada puede perder pestañeos breves y movimientos rápidos de
dedos. No debe interpretarse un conteo bajo como ausencia de eventos.

No se añadieron Web Workers sin medición del dispositivo. `detectForVideo` sigue
siendo síncrono; throttling limita frecuencia, pero no elimina el bloqueo de cada
inferencia. El `PerformanceProbe` existente expone FPS de render, análisis y tiempos
promedio/máximos por Face/Pose/Hands. No hay cifras reales de inferencia obtenidas
con cámaras durante esta intervención.

Para medir: ejecutar las tres actividades por separado con ambas cámaras durante
al menos 60 s; leer el JSON `#performanceProbe` (cuando la sonda esté habilitada),
comparar render y duración de inferencias con el análisis detenido, y registrar
hardware/resolución. Solo después probar CAM1 a 15–20 muestras/s y elevar CAM2.
Si hay pausas perceptibles o inferencias incompatibles con el presupuesto de
render, evaluar workers conservando estos servicios y DTOs.

## 17–18. Verificación y escenarios

Se ejecutaron `npm.cmd test` y `npm.cmd run build` en frontend y backend: 40 pruebas
del frontend y 13 del backend aprobadas. Las pruebas
incluyen cálculos, servicios con resultados simulados, planificación, cámaras
simuladas, contexto de actividades, envío por lotes y rechazo de datos multimedia.
La compilación Vite conserva el aviso de bundle grande.

No se modificaron escenas, actividades ni su lógica interna en esta iteración.
Compilan y pasan las pruebas existentes; **no se confirmó ejecución interactiva
completa de los tres escenarios con dos cámaras reales**.

Matriz de verificación solicitada:

| Casos | Evidencia automática | Validación física |
| --- | --- | --- |
| 1–6: centro, izquierda, derecha, arriba, abajo, inclinación | Matrices sintéticas por eje, ±30° y 0° | Pendiente |
| 7–9: pestañeo izquierdo, derecho, ambos | Secuencias temporales, rechazo de ruido y huecos | Pendiente |
| 10–13: manos abiertas, cerradas y dedos | Contrato de 21 puntos y cálculo geométrico | Pendiente |
| 14: mano parcialmente fuera | Rechazo de punto fuera del frame | Pendiente |
| 15–16: cuerpo centrado/inclinado | Centros derivados y visibilidad | Pendiente |
| 17–18: pérdida de rostro/mano | Limpieza, caducidad y recuperación simuladas | Pendiente |
| 19: desconexión externa | Pruebas existentes del CameraManager | Pendiente |
| 20: actividad Babylon simultánea | Compilación e integración del planificador | Pendiente |

La aceptación visual y la precisión real requieren ejecutar esta matriz con una
persona y las cámaras, sin almacenar sus imágenes.

## 19. Privacidad

No se añadió almacenamiento de fotos, videos ni frames. Los modelos consumen los
videos en memoria. Los landmarks faciales/corporales/manuales permanecen locales;
el DTO nuevo solo admite métricas derivadas. Se conservan filtros de privacidad
en frontend y backend y la validación estricta rechaza landmarks/imágenes extra.

## 20. Limitaciones y referencias

La cámara debe seleccionarse por función: no se puede inferir con certeza cuál es
la integrada solo por orden de enumeración. La detección depende de iluminación,
oclusión, encuadre y descarga de modelos/WASM. Una mano parcialmente fuera se
descarta de forma conservadora. Lateralidad y signos visuales deben verificarse
con las cámaras reales. No hay fusión espacial entre cámaras sin calibración
extrínseca. Los umbrales son experimentales centralizados en `VISION_CONFIG`.

Se verificó la API instalada y se consultaron las referencias oficiales:

- [Face Landmarker web: blendshapes, matrices e inferencia síncrona](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js)
- [Hand Landmarker web](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js)
- [Formato de matriz de MediaPipe](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/framework/formats/matrix_data.proto)

Todos los resultados se consideran **indicadores conductuales derivados mediante
visión por computadora**. No se añade diagnóstico automático de TDAH.
