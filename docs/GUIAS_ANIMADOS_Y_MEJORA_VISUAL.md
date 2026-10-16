# Guías animados y mejora visual de los tres escenarios

Entrega: 15 de octubre de 2026. Público previsto: 6–9 años, según la respuesta del usuario. Esta implementación continúa la auditoría V0 con la nueva autorización para modificar el proyecto.

## Cambios implementados

Los tres escenarios incorporan materiales PBR durante la exploración, microtexturas originales, iluminación de entorno local, tone mapping ACES y un tutorial con un personaje 3D articulado y narración española fija. Los personajes existentes se conservan.

| Mundo | Guía original | Acabados durante la exploración | Recordatorio de la tarea |
| --- | --- | --- | --- |
| Aula | Luma: cerámica cálida, uniforme verde, pañuelo y distintivo | Madera satinada, mobiliario, suelo y paredes con rugosidades diferenciadas; refuerzo moderado de la luz direccional | Círculo verde → espacio; rojo → esperar |
| Estación | Nova: uniforme azul, aro de casco, mochila y antena | Metal pintado, superficies cepilladas, consolas y asientos; reflejo ambiental frío y contenido | X → espacio; otras letras → esperar |
| Museo | Mica: sombrero y bolso de exploradora | Piedra, madera, vitrinas, acabados dorados y suelo con reflejos moderados | Observar tres caras, comparar y seleccionar la diferente |

La demostración del museo es un recordatorio visual de pasos: **no se fabricaron nuevas caras ni ensayos fuera del protocolo**. La práctica real conserva sus estímulos y su feedback original. Los guías presentan y dan paso a esa práctica; no responden por el niño durante sus ensayos.

## Separación de la evaluación

`¡A jugar!` abre el tutorial de cuatro pasos. El audio comienza por esa acción del usuario. Cada paso permite repetir, cambiar el volumen, silenciar y utilizar explícitamente el texto. Continuar permanece deshabilitado hasta que termina la grabación o se elige el respaldo escrito. Elegir texto queda registrado.

El último botón lleva a las **instrucciones originales**, no inicia directamente una prueba oficial. Antes de la transición se cancelan los audios del guía, se eliminan sus mallas, articulaciones, luces y observador de animación, y se restauran los materiales, entorno e iluminación anteriores. Entonces se ejecuta el flujo existente de instrucciones → práctica → evaluación.

No se cambiaron fórmulas, duraciones, probabilidades, distractores, backend, servicios de cámara ni MediaPipe en esta entrega. El ambiente se pausa durante el tutorial y vuelve a iniciarse mediante el mismo método que se utilizaba al pulsar el botón original. El volumen del guía es independiente del audio experimental.

Los ajustes gráficos manuales solo afectan a exploración. No se utiliza `SceneOptimizer` para cambiar automáticamente las condiciones mientras se evalúa. La salida al menú sigue disponible durante la preparación; las continuaciones asíncronas comprueban que la escena siga vigente antes de abrir las actividades.

La auditoría V0 documenta comportamientos ambientales preexistentes durante la evaluación. Esta entrega no los redefine: hacerlo requiere una decisión metodológica específica. Tampoco se añaden nuevas sombras de estudiantes o poses dentro de los ensayos.

## Investigación técnica y decisiones

Versiones instaladas verificadas: Babylon core/loaders **9.25.0**, MediaPipe tasks-vision **1.0.1**, TypeScript **6.0.3**, Vite **8.2.2** y Vitest **4.1.11**. No se instalaron dependencias adicionales.

| Tecnología | Decisión y motivo |
| --- | --- |
| PBRMaterial | Aplicado a una lista explícita de superficies estáticas, conservando referencias a sus materiales originales. No se convierte indiscriminadamente el material de paneles o estímulos. |
| EnvironmentTexture / IBL | Cubemap LDR original de 32×32 por cara, con mipmaps e irradiancia suave. Generado localmente; sin CDN ni fotografía HDR descargada. Es una aproximación estilizada, no iluminación fotométrica ni un entorno HDR prefiltrado profesional. |
| Reflexiones | Se usa el cubemap. No hay capturas de ReflectionProbe por fotograma ni reflejo planar adicional. |
| Texturas | Se conserva la veta existente de madera y se añaden micro-normales de madera, metal cepillado y acabado mate, 64×64 y compartidas por tipo. Sin imágenes externas. |
| Tone mapping / color | ACES durante exploración; se restaura el procesamiento previo antes de la actividad. No se añade una LUT externa de color grading. |
| DefaultRenderingPipeline | Se conserva el FXAA existente, una muestra y framebuffer LDR. No se duplica la cadena de postprocesamiento. |
| MSAA | No se incrementa el multisampling del pipeline. FXAA conserva un coste acotado; MSAA en render targets depende de WebGL2 y del hardware. |
| ShadowGenerator | Se mantienen las sombras suaves ESM existentes, resolución 1024 y actualización cada dos fotogramas. |
| Cascaded Shadows | No aplicado: pensado para rangos amplios; no justifica más mapas en estas habitaciones cerradas. |
| SSAO / IBL shadows | No aplicado sin una medición representativa junto a MediaPipe. Añade trabajo de profundidad, muestreo y composición. |
| GlowLayer / bloom | No activados por defecto. Los emisivos existentes se conservan; no se necesita una pasada adicional para todos los paneles. |
| SceneOptimizer | No se activa adaptación automática durante evaluación. Los perfiles son manuales y exclusivos de exploración. |
| LOD / instancias | El guía usa tessellación por perfil y materiales compartidos. No se sustituyen ni simplifican automáticamente los GLB del protocolo. El caché geométrico existente de mobiliario se reutiliza. |
| GSAP / librerías de animación | No añadidas: la interpolación temporal y los estados requeridos se implementan con Babylon y unas pocas transformaciones por fotograma. |
| Blender / glTF Transform | Útiles para una siguiente fase de autoría, rigging o reducción de modelos pesados, una vez documentados sus permisos de adaptación. No se instalan ni se ejecutan sobre los originales. |

Fuentes primarias: [materiales PBR](https://doc.babylonjs.com/features/featuresDeepDive/materials/using/masterPBR), [pipeline de renderizado](https://doc.babylonjs.com/features/featuresDeepDive/postProcesses/defaultRenderingPipeline), [sombras](https://doc.babylonjs.com/features/featuresDeepDive/lights/shadows), [LOD](https://doc.babylonjs.com/features/featuresDeepDive/mesh/LOD) y [optimización de escenas](https://doc.babylonjs.com/features/featuresDeepDive/scene/optimize_your_scene).

## Modelos y animación

La inspección previa encontró modelos estáticos y pocos clips reutilizables: `student04` dispone de esqueleto y los clips `Alltogether` / `idle d`; los otros modelos no ofrecen un repertorio de saludo, explicación y articulación facial listo para este tutorial. Los modelos pesados `student08` y `student09` ya identificados en V0 se conservan. Los GLB inspeccionados no aportan un manifiesto completo de autoría/licencias; no se derivan nuevos modelos de ellos.

Se construyeron tres variantes originales de un robot educativo con un **rig de TransformNode**: torso, cabeza, hombros y codos, con manos, pies, ojos, pupilas y boca. No son personajes humanos importados ni una malla deformada por Skeleton. Cada variante tiene accesorios temáticos y materiales PBR compartidos.

`CharacterAnimationController` interpola las poses con un factor exponencial dependiente del tiempo. Ofrece IDLE, GREETING, EXPLAINING, DEMONSTRATING, WAITING y FAREWELL. El saludo se limita a unos segundos; no agita la mano durante toda la grabación. Hay respiración discreta, pequeños movimientos de cabeza, mirada, gestos de brazos y parpadeos. El movimiento secundario y la gesticulación se reducen si el sistema solicita reducir animaciones.

Se implementa blending de **poses procedurales**, no una mezcla de clips AnimationGroup. No se afirma que exista retargeting, root motion, IK, caminar o visemas en estos robots. Se presentan como retratos 3D orientados a la cámara, sin desplazarse por el aula ni atravesar muebles. Para incorporar un humano que camine hacen falta un modelo autorizado, rig adecuado y clips preparados.

Babylon ofrece Skeleton/AnimationGroup, mezcla de animaciones y morph targets. Desde la versión 9 existe retargeting, pero requiere una pose y esqueletos compatibles. La disponibilidad de la API no crea automáticamente animaciones ni blend shapes ausentes en un GLB. Root motion e IK no aportan una ventaja concreta para este retrato articulado.

Fuentes: [animación avanzada y blending](https://doc.babylonjs.com/features/featuresDeepDive/animation/advanced_animations), [esqueletos](https://doc.babylonjs.com/features/featuresDeepDive/mesh/bonesSkeletons), [morph targets](https://doc.babylonjs.com/features/featuresDeepDive/mesh/morphTargets) y [retargeting de Babylon 9](https://github.com/BabylonJS/Documentation/blob/master/content/features/featuresDeepDive/animation/animationRetargeting.md).

## Voz y sincronización de boca

| Opción investigada | Naturalidad y estabilidad | Latencia / conexión | Privacidad / coste | Uso elegido |
| --- | --- | --- | --- | --- |
| Web Speech API | Calidad y voces varían por navegador, dispositivo e idioma instalado | Puede ser local o remota; `localService` permite distinguir el proveedor | Sin coste directo de API; no debe suponerse que toda voz sea local | No se utiliza como sustitución silenciosa de la narración fija |
| Archivos previamente narrados | Misma grabación, ritmo y pronunciación en todos los equipos; calidad depende de su producción | Descarga local al servidor del proyecto; reproducción sin proveedor TTS externo | No necesita datos de participantes ni peticiones a un servicio de voz | **Implementado** con WAV y manifiesto versionado |
| TTS de mayor naturalidad, p. ej. Azure Speech | Permite voces más expresivas y control de síntesis; requiere revisión auditiva infantil | La síntesis estándar usa un servicio y puede añadir latencia; se puede generar un archivo previamente | Requiere cuenta y condiciones de servicio; coste según modalidad y uso | No contratado ni llamado; una producción posterior necesita autorización |

Fuentes: [voz local o remota en Web Speech](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisVoice/localService), [cancelación Web Speech](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/cancel), [Azure Text to Speech](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech) y [exportar audio con System.Speech](https://learn.microsoft.com/en-us/dotnet/api/system.speech.synthesis.speechsynthesizer.setoutputtowavefile).

Los doce WAV entregados se generaron localmente con **Microsoft Sabina Desktop, es-MX, velocidad −1**, usando la voz instalada de Windows. La generación fue autorizada mediante la aprobación del comando. Son grabaciones sintéticas fijas, no una locución humana profesional. No se generaron frases dinámicas ni se enviaron datos a internet. Los archivos de voz, envolventes y manifiesto suman aproximadamente **6,47 MB**.

La fuente textual única es `src/guides/narration.es.json`. `public/assets/guides/es-MX-v1/manifest.json` guarda voz, versión, transcripción, tamaño y SHA-256 de los audios y del texto fuente. La compilación verifica esa correspondencia; si cambia un texto hay que generar una nueva versión, no dejar grabaciones antiguas con subtítulos distintos.

`SpeechPlaybackService` mantiene exclusividad entre instancias. Controla reproducción, carga, error, finalización, volumen y silencio; cancela al salir o cambiar de escena e ignora callbacks tardíos. Un audio que no carga ofrece la vía escrita tras 20 segundos. No salta automáticamente a otro paso ni inicia una actividad después de un error.

`LipSyncController` utiliza una envolvente RMS de unas 30 muestras por segundo, calculada a partir del WAV exacto. La consulta usa `audio.currentTime`, no un cronómetro independiente. El tamaño de la boca sigue esa amplitud; se cierra al terminar, cancelar, cargar, silenciar o faltar la envolvente. **No es sincronización fonética ni reconocimiento de visemas.** No se captura micrófono ni se analiza audio de participantes.

## Registro de narración

`GuideNarrationLog` registra inicio, fin, cancelación, error, selección de texto, volumen y silencio. Cada evento incluye clip, versión, hora ISO y tiempo monotónico `performance.now()`. La colección es independiente de las métricas cognitivas y no contiene identidad, respuestas ni imágenes. Emite además `guide-narration` como CustomEvent para una integración futura autorizada.

El registro está en memoria, con un máximo de 2000 eventos. La herramienta de revisión permite descargarlo como JSON. No se ha añadido persistencia en el backend ni se ha mezclado con el CSV de resultados clínicos. Conservarlo junto a un expediente o modificar formalmente el protocolo de instrucciones requiere definir esa integración con el investigador.

## Perfiles y liberación de recursos

| Perfil de exploración | Entorno / microtexturas | Tessellación de esferas del guía |
| --- | --- | --- |
| Ligera | Sin cubemap adicional ni micro-normales | 8 |
| Equilibrada, predeterminada | Cubemap local y texturas compartidas 64×64 | 12 |
| Alta | Mismos efectos de coste moderado | 20 |

Se elige en «Cómo jugar → Calidad de exploración». El ajuste queda en almacenamiento local cuando el navegador lo permite. No añade SSAO, bloom o efectos de cámara al perfil alto. La geometría del guía se construye al abrirlo y se libera al cerrarlo. No se mantiene un segundo canvas ni un segundo Engine para su retrato. El audio usa un elemento de reproducción y la envolvente local, sin crear otro AudioContext.

## Validación realizada y límites

- **60 pruebas automatizadas aprobadas en 14 archivos**, incluyendo la regresión existente y 13 pruebas del nuevo sistema. Se comprueban exclusividad de voces, callbacks tardíos, carga fallida, espera antes de avanzar, estados finales, cierre de boca, reducción de geometría y liberación de mallas/materiales/luces/articulaciones.
- `npm run build` pasa con verificación de los doce audios, TypeScript y Vite. Persiste la advertencia de bundle grande del proyecto: el chunk principal ronda 6,4 MB minificado; no se ocultó el aviso.
- Navegador: se revisa la carga de las tres escenas, sus guías y los controles. La revisión usa las clases reales de escenas; no pide acceso a cámaras ni abre una sesión clínica.
- Se revisó el diseño a 767×826 y 390×844. En el tamaño estrecho se usa temporalmente una proyección vertical para el retrato; se restaura al cerrar el tutorial. Se comprobó que la interfaz no tenga desbordamiento horizontal.
- Se comprobó la desaparición de recursos nuevos antes de continuar: `guideMeshes: 0` y materiales `exploration-PBR: 0`. Las instrucciones originales permanecen como siguiente etapa.
- En el museo se comprobó además la pantalla original de instrucciones y el comienzo de su práctica con las tres caras, sin recursos del guía ni errores de consola de la aplicación.
- Las comprobaciones con las dos cámaras físicas y MediaPipe simultáneos **quedan pendientes**. No se afirma equivalencia clínica ni validación con niños por pasar las pruebas de software.
- Persisten advertencias del validador geométrico del museo sobre `museumCeiling`, `abstractSpherePedestal`, `geometricSculpturePedestal` y una posible obstrucción `museumFrontWall`. En la revisión fueron visibles tanto las instrucciones como las tres caras de práctica. Esas alertas por límites geométricos no bastan para confirmar una oclusión real; requieren revisar la zona de evaluación con sus vistas de trabajo. No se desplazaron objetos del protocolo para ocultar los avisos.

### Medición de rendimiento

La vista de revisión incluye una comparación reproducible: misma sala y cámara fija, materiales originales → PBR/IBL/ACES → PBR más guía. Cada fase calienta 2 s y mide 5 s, registrando FPS, mediana y p95 de intervalo de fotograma, mallas, vértices, materiales, resolución y renderer. Excluye los actores GLB, MediaPipe, cámaras físicas y audio; no representa la carga combinada del producto.

La primera ejecución en el navegador automatizado, a **767×826 y escala 1**, produjo solo **6 muestras por fase**, con intervalos de aproximadamente 1000 ms en los tres modos. Es una medición **inconcluyente**: no permite atribuir una pérdida de FPS al nuevo sistema ni justificar una ganancia de rendimiento. Se añadió una marca explícita de muestras insuficientes cuando hay menos de 60. El perfil equilibrado del guía se redujo después de esa observación; esas cifras no son un benchmark de su geometría final.

Repetir con Chrome visible y activo en el equipo de evaluación; después medir la aplicación completa mediante el PerformanceProbe existente, las dos cámaras y MediaPipe. No confundir heap de JavaScript con VRAM. No se publican cifras de GPU, VRAM o inferencia que no se hayan obtenido.

## Recursos y licencias

- Dependencias nuevas: **ninguna**. Se reutiliza Babylon.js, cuya distribución instalada incluye su licencia Apache-2.0, y las herramientas ya presentes.
- Modelos nuevos: tres variantes procedurales originales descritas en `GuideCharacter.ts`, con geometría y accesorios creados en el código del proyecto. No se descargaron personajes ni animaciones de terceros.
- Entorno y microtexturas: generados por código local; sin fotografías, HDRI, LUT o packs externos.
- Audio: salidas generadas con la voz Sabina instalada de Windows. Se documenta la procedencia; no se redistribuyen el motor ni los archivos de voz de Microsoft. Estos audios no se etiquetan como CC0 ni se les atribuye una licencia abierta de Microsoft. Para distribución institucional, conservar las condiciones de uso del Windows que proporcionó la voz; para una licencia de locución explícita puede encargarse una grabación propia autorizada manteniendo transcripción y versión.
- GLB existentes: conservados, sin declarar resuelta la documentación de autoría que faltaba en V0.

## Archivos de esta entrega

Nuevos, relativos a `frontend/`:

- `src/guides/GuideSceneConfiguration.ts`, `narration.es.json`: configuración y fuente española.
- `src/guides/GuideCharacter.ts`, `CharacterAnimationController.ts`: modelo articulado y poses interpoladas.
- `src/guides/SpeechPlaybackService.ts`, `LipSyncController.ts`, `GuideNarrationLog.ts`: voz exclusiva, amplitud y registro.
- `src/guides/TutorialFlowController.ts`, `VirtualGuideManager.ts`, `guide.css`: flujo y controles accesibles.
- `src/guides/tests/GuideSafety.test.ts`: regresión de límites y recursos.
- `src/environment/ExplorationVisuals.ts`: materiales, detalle y entorno reversibles.
- `src/ui/ExplorationQuality.ts`: preferencias exclusivas de exploración.
- `public/assets/guides/es-MX-v1/`: doce WAV, doce envolventes y manifiesto.
- `scripts/generate-guide-audio.ps1`, `build-guide-envelopes.mjs`, `validate-guide-assets.mjs`: producción y validación.
- `guide-preview.html`, `src/dev/guidePreview.ts`, `src/dev/visualBenchmark.ts`: revisión local sin sesión clínica.

Modificados: las tres clases de `src/scenes/`, `src/ui/ExplorationHud.ts`, `src/ui/world-ui.css`, `package.json` y `tsconfig.json`. Los cambios de geometría/UI anteriores y el cambio preexistente de `package-lock.json` permanecen; no son una instalación nueva de esta entrega. No se leyó ni modificó `.env`.

Evidencia visual: [Mica en el museo](capturas/guia-museo.jpg).

## Ejecutar y comprobar

Desde `EntornosInmersivos/frontend`:

```powershell
npm.cmd run dev -- --host 127.0.0.1
```

En la aplicación habitual, seleccionar un mundo y pulsar «¡A jugar!». Para revisar sin cámaras, autenticación ni datos de participantes:

```text
http://127.0.0.1:5173/guide-preview.html?world=classroom
http://127.0.0.1:5173/guide-preview.html?world=space
http://127.0.0.1:5173/guide-preview.html?world=museum
```

Es una entrada de desarrollo: no se importa desde `main.ts` ni se incluye como página del build de producción. Desplegar `dist/` generado con Vite. Si alguien intenta servir directamente el fuente fuera del modo desarrollo, el módulo de revisión lo rechaza.

En cada mundo, escuchar la bienvenida, comprobar el bloqueo de continuar, repetir, ajustar volumen, silenciar, probar la alternativa escrita y volver a explorar o al menú. Completar los cuatro pasos y comprobar que aparecen las instrucciones originales sin el robot. Después realizar la práctica original con espacio en aula/estación y con el control original del museo.

Desplegar el panel superior «Revisión local» para exportar el registro de voz, cambiar de escenario o ejecutar la comparación gráfica. Mantener la pestaña visible durante las tres fases. El panel incluye contadores para verificar que el guía y los materiales temporales ya no están antes de los ensayos.

Verificaciones:

```powershell
npm.cmd test
npm.cmd run guides:check
npm.cmd run build
```

Para una futura versión de narración: cambiar `version` y los textos fuente, usar Windows con la voz indicada instalada y ejecutar:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/generate-guide-audio.ps1
npm.cmd run guides:envelopes
npm.cmd run guides:check
```

Revisar auditivamente el resultado con el equipo investigador antes de incorporarlo a una recogida de datos. Una versión de audio nueva debe quedar identificada en los registros de la sesión.

## Próximos pasos delimitados

1. Medición representativa en el equipo de evaluación y con ambas cámaras.
2. Revisión de comprensión, volumen y ritmo con adultos responsables y niños del rango previsto antes de usarlo en investigación.
3. Documentar licencias de los GLB actuales y preparar variantes ligeras/rigs sobre copias autorizadas.
4. Si se requiere un guía humano con caminar y visemas, integrar un modelo con licencia explícita y un rig facial preparado; conservar la arquitectura de voz y flujo ya implementada.
5. Para la fase oficial, aprobar la versión de la locución y su incorporación al protocolo; esta entrega no reemplaza automáticamente las instrucciones originales ni su procedimiento de práctica.
