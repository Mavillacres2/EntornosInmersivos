# Rediseño V2: auditoría, implementación y comparaciones

## Diagnóstico previo

Se revisaron los tres builders, las clases de escenas, los gestores de personajes, el tutorial, las grabaciones, los perfiles y las pruebas existentes antes de integrar el rediseño. Se preservó el estado de Git, incluidos cambios anteriores del usuario. No se consultó `.env`.

Babylon core/loaders instalado: 9.25.0; TypeScript: 6.0.3; Vite: 8.2.2. Se consultó la documentación oficial de PBR, animación, morph targets, instancias y carga glTF, junto con documentación de Microsoft para enumeración real y selección de voces.

| Componente | Estado encontrado | Limitación |
| --- | --- | --- |
| Aula | Builder propio: cajas suavizadas en mesas, sillas, estantes y marcos; cilindros/esferas en plantas, reloj y globo. Personajes GLB existentes. | Superficies continuas poco detalladas; muebles formados por piezas simples y grandes planos sin construcción visible. |
| Estación | Cajas suavizadas en estructura, consolas y soportes; esferas para planetas y estrellas. Texturas de planetas de 512×256 con manchas elípticas. Personajes GLB. | Techo de vigas rectas, paredes planas, planetas de bandas simples y escasa jerarquía de piezas. |
| Museo | Arquitectura, vitrinas y pedestales de cajas; varias esculturas y modelos científicos hechos de esferas, cilindros y tubos. Visitantes GLB. | Arquitectura de habitación genérica; exposiciones con poco detalle en siluetas y poca cohesión visual. |
| Materiales | StandardMaterial en builders; PBR reversible en una lista de superficies; cubemap LDR 32×32, micro-normales 64×64 y ACES en exploración. | El acabado mejora, pero no sustituye la falta de geometría diseñada. |
| Iluminación | Hemisféricas, direccional de sombras y luces de acento según mundo. ESM 1024, actualización cada dos fotogramas. FXAA compartido. | Añadir más pases a todos los modos perjudicaría el margen de MediaPipe. |
| Luma / Nova / Mica | Una misma estructura de esferas escaladas y cajas suavizadas; accesorios diferentes. Rig de TransformNode. | Silueta casi idéntica, manos esféricas, sin paneles de construcción ni piezas mecánicas detalladas. |
| Animación | Poses sinusoidales y mezcla exponencial de ángulos Euler; parpadeo periódico y mirada corta. | Repetición evidente, gestos poco relacionados con frases, cierre de boca sin suavizado durante habla. |
| Voz | Doce WAV fijos `es-MX-v1`, fuente única JSON y manifiesto SHA-256. Sabina es-MX, no SpeechSynthesis dinámico. | La etiqueta de procedencia no sustituye una revisión auditiva; hacía falta verificar instalación, región y regenerar texto/ritmo. |
| Boca | Envolvente RMS precalculada del WAV, consultada mediante audio.currentTime. | Escala de una elipse; no visemas. |
| Código compartido | Geometría redondeada, acabados, tutorial, audio y controles ya compartidos. Clases de escenas repiten conexión de HUD y ciclo de vida. | Se conserva la arquitectura y se añade una sola capa artística reversible; no se refactorizan servicios de evaluación. |
| Rendimiento | Cientos de mallas; GLB humanos muy pesados en aula/museo; varios recursos de visitantes repetidos. La primera medición automatizada tenía solo seis muestras por fase. | No hay base para prometer 30/60 FPS ni atribuir una causa única a la baja frecuencia de la automatización. |

Referencia del usuario: volumen modular, superficies con piezas encastradas, marcos industriales, turquesa/naranja y luz cálida. Se utiliza como dirección artística, no como textura ni modelo redistribuido.

Se investigó además [Quaternius Modular Sci-Fi Megakit](https://quaternius.com/packs/modularscifimegakit.html), cuyo autor identifica CC0 y formatos glTF. No se descargó ni se integró ese pack: el rediseño utiliza geometría original controlable y no se atribuyen a terceros los modelos creados aquí.

Fuentes técnicas: [PBR](https://doc.babylonjs.com/features/featuresDeepDive/materials/using/masterPBR), [animación y blending](https://doc.babylonjs.com/features/featuresDeepDive/animation/advanced_animations), [morph targets](https://doc.babylonjs.com/features/featuresDeepDive/mesh/morphTargets), [thin instances](https://doc.babylonjs.com/features/featuresDeepDive/mesh/copies/thinInstances), [enumeración de voces](https://learn.microsoft.com/en-us/dotnet/api/system.speech.synthesis.speechsynthesizer.getinstalledvoices) y [System.Speech / SSML](https://learn.microsoft.com/en-us/dotnet/api/system.speech.synthesis.speechsynthesizer).

## Evidencia de partida

Las seis capturas `docs/comparacion-v2/*-antes.jpg` se guardaron antes de sustituir los robots o integrar los nuevos objetos. Resolución de comparación: 1280×800. Las vistas generales utilizan posiciones fijas reproducibles de la herramienta de revisión. Son capturas del proyecto real.

## Implementación entregada

La capa compartida `ExplorationArtDirection` incorpora geometría original modelada con perfiles, extrusiones biseladas y barridos continuos. Las piezas estáticas se agrupan por material; no son una colección de nuevas cajas. Se conservan las posiciones funcionales del mobiliario y las referencias de los estímulos.

| Mundo | Mejoras V2 |
| --- | --- |
| Aula | Mesas con tableros perfilados y bastidores continuos; sillas con asiento/respaldo moldeado; cuatro acabados; mochilas perfiladas; marco continuo de pizarra, persianas, revestimiento inferior, paneles acústicos y aros de lámparas. |
| Estación | Tres portales estructurales curvos con juntas, ribetes naranja y luz moderada; paneles de servicio, conductos, escotilla y consola con carcasa perfilada; pedestal y órbitas holográficas estáticas; superficies planetarias continuas con terreno, nubes, casquetes o bandas gaseosas. |
| Museo | Arcos de galería, cornisas, revestimiento inferior, señalética, pedestales con perfiles y bandas de latón, herrajes e iluminación decorativa; escultura de cinta continua. |

Se mantienen PBR, IBL, micro-normales, ACES y sombras suaves de la versión anterior. Se añaden texturas originales pequeñas y sombras de contacto mediante una textura radial: es una aproximación precalculada, **no SSAO**. No se añaden pases de SSAO o bloom. El perfil ligero evita las nuevas texturas dinámicas y reduce segmentos; equilibrado y alto aumentan detalle. No hay un sistema de LOD por distancia ni compresión Draco/KTX2 nuevos.

### Personajes

Luma, Nova y Mica utilizan ahora GLB originales con carcasa perfilada, visor hundido, ribetes, uniones, ventilación, pantalla pectoral, manos con dedos, antebrazos, rodillas y botas. Luma conserva verde/marfil/dorado y accesorios escolares; Nova incorpora casco, antenas y mochila espacial; Mica lleva sombrero de exploración, correa y bolso.

Se entregan nueve GLB: tres personajes por tres perfiles. Tamaños aproximados: **238–486 KiB por archivo**. La variante equilibrada de Luma tiene 7.370 vértices y 13.936 triángulos; los valores de los nueve archivos están en `public/assets/models/guides-v2/manifest.json`. Se carga únicamente la variante elegida al abrir el tutorial.

Hay un **rig de nodos articulados**, tres clips nativos glTF (`Idle`, `Greeting`, `Pointing`) y mezcla de rotaciones mediante quaternion SLERP. Se combinan con respiración, mirada frontal acotada, parpadeo con intervalos variables y variaciones deterministas por personaje. Los gestos siguen el reloj de reproducción del audio; no se asignan a cada palabra. No se implementa skinning con pesos, IK, caminar ni captura de movimiento.

### Voz y boca

Se enumeraron las voces habilitadas de Windows: Sabina **es-MX** y Zira en-US. No había es-EC ni es-CO. El generador selecciona explícitamente la voz latinoamericana disponible, comprueba su cultura real y rechaza una configuración que no coincida; no recurre a es-ES.

Los doce audios activos son **es-MX-v3**, Microsoft Sabina Desktop, velocidad 0 y pausas de 160 ms. PCM 16 kHz / 16 bits / mono. Son grabaciones sintéticas fijas, locales y sin envío de datos a un servicio externo. Los tres personajes comparten la voz instalada; no son tres locutores distintos ni una voz ecuatoriana. La naturalidad sigue limitada por el motor de escritorio y requiere escucha y valoración con usuarios.

Se registraron eventos reales `VisemeReached` y `SpeakProgress` al generar cada WAV. La boca tiene tres morph targets (abierta, redondeada y ancha) controlados por los visemas y `audio.currentTime`, con RMS para silencios y como alternativa si faltan marcas. Es una aproximación basada en visemas del motor, **no una reconstrucción fonética completa**. Al silenciar, cancelar o terminar, los tres pesos vuelven a cero. Las marcas se aceptan solo si corresponden al mismo hash del audio.

Se detectó y descartó una versión intermedia cuyos tiempos del motor no coincidían con el reloj del WAV. v3 fija explícitamente el formato de salida; el validador comprueba orden y duración real de todas las marcas. [Documentación del evento y su reloj](https://learn.microsoft.com/en-us/dotnet/api/system.speech.synthesis.visemereachedeventargs.audioposition).

### UI/UX y conservación de las actividades

Se conservan controles amplios, contraste, instrucciones cortas, recordatorios visuales de reglas, repetición, volumen, silencio y alternativa escrita. El tutorial tiene entrada suave, feedback de botones y respeto por movimiento reducido. La interfaz indica la carga del modelo; puede continuarse leyendo sin esperar al audio.

La nueva capa y los guías se eliminan antes de las instrucciones originales, práctica y evaluación. Se restauran materiales, visibilidad, luces y configuración de imagen anteriores. Se prueban también cierre durante carga y liberación tardía de GLB. La cámara de comparación pertenece exclusivamente a la página de desarrollo.

En esta fase V2 no se editaron los algoritmos de las actividades, reglas, estímulos, tiempos, métricas, sincronización, MediaPipe, backend ni almacenamiento. Los cambios de aspecto de actividades que aparecen en el árbol de trabajo proceden de la fase anterior. `.env` no se leyó ni modificó.

## Archivos y recursos principales

| Área | Archivos |
| --- | --- |
| Geometría y mundos | `src/art/ArtGeometry.ts`, `src/environment/ExplorationArtDirection.ts`, `ExplorationVisuals.ts` y pruebas en `environment/tests/ArtGeometry.test.ts`. |
| Guías | `src/guides/GuideCharacter.ts`, `CharacterAnimationController.ts`, `VirtualGuideManager.ts`, `LipSyncController.ts`, `guide.css`, `narration.es.json` y `tests/GuideSafety.test.ts`. |
| Autoría GLB | `scripts/build-guide-models.mjs`, `scripts/lib/write-glb.mjs`, `scripts/validate-guide-models.mjs`; nueve GLB y manifiesto en `public/assets/models/guides-v2/`. |
| Audio | `scripts/generate-guide-audio.ps1`, `scripts/lib/NarrationRecorder.cs`, `build-guide-envelopes.mjs`, `validate-guide-assets.mjs`; doce WAV, doce envolventes, doce archivos de tiempos y manifiesto en `public/assets/guides/es-MX-v3/`. |
| Revisión | `guide-preview.html`, `src/dev/guidePreview.ts`, `RenderingReviewRecorder.ts`, `visualBenchmark.ts`, `scripts/serve-visual-comparison.mjs`, esta documentación y `docs/comparacion-v2/`. |
| Configuración | `package.json`, `package-lock.json`, `tsconfig.json`. Única dependencia añadida en V2: `@types/node` de desarrollo para comprobar las pruebas que cargan los GLB reales. Sin nuevas dependencias de ejecución. |

Durante la comprobación de dependencias, `npm audit` identificó el aviso GHSA-68fv-2mgg-jv7q en `source-map-js` 1.2.1, dependencia de desarrollo transitiva de PostCSS/Vite. Se actualizó únicamente ese paquete a **1.2.2**, dentro del rango ya permitido. El resultado de npm tras la actualización fue **0 vulnerabilidades**. No se aplicó una actualización general de dependencias.

Los GLB, clips y texturas nuevas son originales del proyecto. No se descargaron recursos de terceros. Las licencias y procedencia se detallan en `public/assets/models/guides-v2/ASSET_SOURCES.md` y `public/assets/guides/ASSET_SOURCES.md`. Los humanos GLB preexistentes se conservan; siguen pendientes su documentación de licencias y optimización. Los WAV no se etiquetan CC0; se documenta el origen de la voz de Windows y la necesidad de verificar sus términos para distribución institucional.

## Validación

- `npm test`: **69 pruebas, 15 archivos, todas aprobadas**. Incluyen regresión de análisis, geometría y normales, carga de GLB reales en NullEngine, clips/morph targets, retirada de recursos por mundo, cierre durante carga, silencios y marcas de visemas.
- `npm run build`: **correcto**, validación de doce audios y nueve modelos, TypeScript y Vite. El chunk principal queda en aproximadamente 6,42 MB (1,40 MB gzip); Vite advierte su tamaño. No se oculta la advertencia ni se hizo una refactorización general del bundle.
- `npx tsc --noEmit`, `npm run models:check` y `npm run guides:check`: correctos.
- Revisión en Chrome de las tres escenas y modelos, estados del tutorial, alternativa escrita y regreso al flujo original. Las capturas son del perfil equilibrado a 1280 × 800.

Las pruebas automatizadas verifican comportamiento y ciclo de vida; no demuestran aceptación infantil, validez clínica, fidelidad del acento ecuatoriano ni precisión temporal en equipos físicos con cámaras.

## Comparaciones

[Abrir galería completa de antes y después](comparacion-v2/index.html). Incluye Aula, Estación, Museo, Luma, Nova y Mica, con doce capturas originales. Para servirla localmente desde `frontend`: `node scripts/serve-visual-comparison.mjs` y abrir `http://127.0.0.1:5175`.

La vista de desarrollo se abre mediante `npm run dev` y `/guide-preview.html?world=classroom` (también `space` y `museum`). No abre cámaras físicas ni inicia una sesión clínica. El botón «Vista general para comparar» reproduce el encuadre de las capturas.

## Rendimiento: medición y límites

Se añadió un registrador **solo de desarrollo**, separado de la telemetría de participantes. Se midieron las escenas reales, incluidos sus actores originales, en exploración, guía, instrucciones, práctica y comienzo de evaluación. Equipo observado: Chrome / WebGL2, ANGLE Direct3D11, AMD Radeon Graphics; resolución 1280 × 800, perfil equilibrado. No se conectaron MediaPipe ni cámaras físicas.

Se guarda el número de muestras, intervalo de fotograma, percentil 95, tiempo de envío de render en CPU, draw calls y triángulos activos. El tiempo CPU **no** equivale al coste GPU, la memoria o el tiempo de respuesta del niño. Los contadores no modifican el reloj ni los resultados de las tareas.

| Mundo | Exploración: FPS observados / muestras | Práctica: FPS observados / muestras | Inicio de evaluación: FPS observados / muestras |
| --- | --- | --- | --- |
| Aula | 1,44 / 19 | 5,00 / 162 | 10,56 / 166 |
| Estación | 1,98 / 23 | 1,46 / 18 | 1,00 / 9 |
| Museo | 1,50 / 30 | 5,12 / 155 | 27,34 / 475 |

**Estos resultados no certifican 30 ni 60 FPS sostenidos.** La sesión alternó intervalos próximos a 33 ms con pausas cercanas a 1.000 ms; no se aisló su causa. Algunas fases tienen muy pocas muestras. Aunque `inconclusive:false` indique al menos 60 muestras en el JSON, eso no resuelve la irregularidad de esta sesión. El museo alcanzó alrededor de 27 FPS durante el fragmento de evaluación observado; tampoco basta para aprobar el mínimo deseable de 30 FPS. No se midieron sesiones completas ni hay un benchmark anterior equivalente para atribuir una ganancia de FPS al rediseño.

Registros originales: [aula](comparacion-v2/rendimiento-aula.json), [estación](comparacion-v2/rendimiento-estacion.json) y [museo](comparacion-v2/rendimiento-museo.json). Los archivos pueden incluir fases de otros mundos porque el registrador conserva muestras al cambiar de escena. No se sumaron muestras entre archivos. Las cifras de la tabla toman cada mundo del registro correspondiente más reciente.

Las tres comprobaciones visuales de retirada dieron `guideMeshes:0`, `artMeshes:0` y `pbr:0` antes de practicar; el aula volvió a comprobarse durante evaluación. Los JSON `retirada-*.json` conservan esa evidencia. También se comprobó el regreso desde la actividad del museo a la revisión. Durante la última revisión aparecieron mensajes de canal asíncrono cerrado sin traza identificable de la aplicación; queda pendiente reproducirlos en un navegador sin extensiones. No se afirma que toda la consola estuviera libre de errores.

Optimizaciones implementadas: geometría agrupada por material, reutilización de acabados, tres variantes de GLB pequeños, carga del guía bajo demanda, perfiles con menos segmentos/texturas, ausencia de nuevos pases de pantalla y liberación explícita al terminar exploración. El número de triángulos activos todavía supera el millón en algunas vistas del aula y museo debido también a los humanos existentes; no se sustituyeron ni se modificaron sus comportamientos científicos.

## Pendientes concretos

1. Medir sesiones completas en equipos objetivo, con MediaPipe y cámaras físicas, verificando precisión temporal, memoria y percentiles de frame time. El objetivo de 30/60 FPS sigue pendiente.
2. Optimizar y documentar licencias de los GLB humanos anteriores sobre copias autorizadas; preparar modelos y animaciones adecuados antes de añadir nuevas acciones de estudiantes.
3. Validar comprensión, legibilidad, movimiento y naturalidad de la voz con niños y responsables del estudio. No se realizó una prueba con participantes.
4. Si se necesita mayor naturalidad vocal o voces diferenciadas, incorporar grabaciones autorizadas o un motor LATAM con licencia explícita. La entrega actual usa una voz es-MX de escritorio, sin afirmación de acento ecuatoriano.
5. Completar progresivamente el resto de utilería y arquitectura. Se rediseñaron los elementos principales descritos; no se sustituyeron todos los objetos originales ni se alcanzó una equivalencia artística exacta con la imagen de referencia.
