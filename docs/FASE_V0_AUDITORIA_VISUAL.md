# Fase V0 — Auditoría visual y propuesta de rediseño

**Proyecto:** EntornosInmersivos. **Fecha:** 15 de octubre de 2026. **Público:** niños de 6 a 10 años, según el documento maestro de esta ejecución.

**Alcance ejecutado:** lectura del código y documentación, inspección binaria de los recursos GLB, comprobación de APIs instaladas, consulta de documentación técnica oficial, comprobación de tipos y pruebas existentes. Se entrega únicamente diagnóstico y propuesta. No se ha modificado código, instalado software, descargado recursos gráficos, abierto archivos `.env`, activado webcams ni alterado el backend.

**Base de comparación:** el árbol de trabajo actual contiene cambios previos sin confirmar en Git. No se trata de una copia limpia de `HEAD`. Esta auditoría no aplica, revierte ni aprueba experimentalmente esos cambios. Las referencias `archivo:línea` corresponden al estado inspeccionado y se expresan relativas a `frontend/`, salvo indicación contraria.

**Grado de certeza:** “confirmado” describe código, metadatos o cálculos ejecutados. “Riesgo” o “por comprobar” requiere reproducción gráfica o validación del responsable del protocolo. La inspección estática no demuestra que un participante haya recibido una condición incorrecta, ni sustituye una validación con niños.

## 1. Resumen del estado visual actual

La base existente permite evolucionar hacia un videojuego educativo estilizado sin reconstruir las escenas ni cambiar de motor. Ya hay redondeo de muebles, paletas diferenciadas, materiales compartidos, sombras suaves, FXAA, personajes GLB, paneles HTML/CSS reutilizables, ayuda desplegable y liberación explícita de escenas.

La prioridad no es añadir todos los efectos disponibles. Primero conviene establecer una referencia experimental y de rendimiento, controlar el ciclo de vida de cargas y animaciones y optimizar los recursos más pesados. Después, mejorar iluminación, acabados, composición y personajes de exploración de manera selectiva.

| Componente actual | Decisión propuesta | Motivo |
| --- | --- | --- |
| Babylon.js, Vite y TypeScript | Conservar | La pila instalada cubre las necesidades visuales propuestas. |
| `ClassroomScene`, `SpaceStationScene`, `VisualDiscriminationScene` y sus builders | Conservar y ajustar | Separan construcción del entorno, actividad y ciclo de vida. |
| `ModernGeometry` y su caché por escena | Conservar y parametrizar | Reutiliza geometría, pero el redondeo tiene un coste geométrico relevante. |
| `SurfaceMaterials` | Evolucionar con un adaptador selectivo | Actualmente devuelve `StandardMaterial`; sustituirlo globalmente por PBR rompería supuestos de sus consumidores. |
| `SceneVisuals` y sombras actuales | Conservar como referencia | FXAA y Blur ESM ya existen; falta seleccionar calidad con mediciones. |
| `ExplorationHud`, selector, ilustraciones y temas | Conservar | Ya constituyen el sistema de componentes solicitado. Falta robustecer carga, errores y accesibilidad comprobada. |
| Caché `AssetContainer` del aula | Conservar y revisar | Ya evita recargar un modelo por cada personaje dentro del gestor; no equivale a instanciación GPU automática. |
| Gestión de visitantes del museo | Reorganizar | Carga secuencial y contenedores independientes para modelos repetidos. |
| Geometría y texturas de personajes muy pesados | Preparar variantes, conservar originales | Las variantes necesitan control visual, de licencia y de uso por modo. |
| Actividades, métricas, sincronización, MediaPipe, cámaras de captura y backend | Proteger | No forman parte de la implementación visual autorizada. |

## 2. Inventario de archivos y recursos

### 2.1 Código, responsabilidades y recursos compartidos

| Área | Archivos principales | Responsabilidad y observaciones |
| --- | --- | --- |
| Arranque y navegación | `src/main.ts` | Un motor y bucle de render; selector; creación y disposición del escenario activo; integración con análisis y especialista. |
| Aula | `src/scenes/ClassroomScene.ts`, `src/environment/ClassroomBuilder.ts` | Cámara y transición, iluminación, muebles, pizarra, ventanas, anclajes, colisiones y listas de sombras. |
| Estación | `src/scenes/SpaceStationScene.ts`, `src/environment/SpaceStationBuilder.ts` | Consola CPT, cámara, ventana espacial, planetas, asteroides, luces y anclajes de distractores. |
| Museo | `src/scenes/VisualDiscriminationScene.ts`, `src/environment/MuseumBuilder.ts` | Galerías, vitrinas, esculturas, carteles, zona de actividad y comprobación de línea visual. |
| Geometría y acabados | `src/environment/ModernGeometry.ts`, `SurfaceMaterials.ts`, `ExplorationAccents.ts` | Geometría redondeada compartida, veta procedural de madera, alfombras y medallones exclusivos de exploración. |
| Render compartido | `src/scenes/SceneVisuals.ts` | `DefaultRenderingPipeline` con FXAA para ambas cámaras; liberación al disponer la escena. |
| Personajes del aula | `src/characters/CharacterConfig.ts`, `CharacterManager.ts`, `CharacterTypes.ts` | Modelos, orientación, escala, animaciones, fallback, caché y disposición. Configurados: una profesora y cinco estudiantes. |
| Personajes espaciales | `src/characters/SpaceCharacterConfig.ts`, `SpaceCharacterManager.ts` | Tres estudiantes; orientación hacia ventana o participante; carga y fallback. |
| Visitantes del museo | `src/characters/MuseumCharacterManager.ts` | Ocho visitantes, reutilizando algunos archivos; poses declaradas y movimiento procedural. |
| Ambientación y distractores | `src/ambient/AmbientBehaviorManager.ts`, `SpaceAmbientManager.ts`, `src/distractors/`, `src/activities/visual-discrimination/VisualDiscriminationDistractorManager.ts` | Distinguir los comportamientos ambientales de los distractores oficialmente programados. |
| Audio | `src/audio/AudioManager.ts`, `AudioConfig.ts` | Ambientación, señales y distractores comparten un gestor con una bandera general `enabled`. |
| Cámara 3D | `src/camera/CameraManager.ts` | Dos `UniversalCamera`, movimiento WASD/flechas, límites, captura de ratón y transición a evaluación. Es distinta del gestor de webcams. |
| Interfaz infantil | `src/ui/ExplorationHud.ts`, `ScenarioSelector.ts`, `ScenarioPresentation.ts`, `ScenarioArtwork.ts`, `ExplorationPreferences.ts`, `world-ui.css` | Controles HTML, SVG, temas, estados y preferencia de sonido. |
| Interfaz del especialista | `src/specialist/`, `src/style.css`, `src/analysis/ui/` | Configuración, cámara y seguimiento; conservar su separación funcional. |
| Rendimiento | `src/performance/PerformanceProbe.ts` | Contadores de render y análisis; salida JSON en el DOM cada segundo. |
| Frontera protegida | `src/activities/`, `src/metrics/`, `src/analysis/`, `backend/` | No modificar ensayos, estímulos, tiempos, condiciones, inferencia, sincronización ni persistencia. Se leyeron puntos de integración del frontend; no se accedió al backend. |

### 2.2 Modelos GLB: inventario cuantitativo ejecutado

Se inspeccionaron los encabezados y bloques JSON de los diez archivos GLB locales. No se encontraron archivos `.gltf` separados en `public/`. Los triángulos son la suma de primitivas geométricas declaradas en cada archivo; **no son polígonos visibles por fotograma ni draw calls medidos**. Pueden incluir partes posteriormente ocultadas por el cargador y no incorporan multiplicidad de nodos o personajes de la escena.

| Recurso bajo `public/assets/models/` | MiB del archivo | Triángulos declarados | Materiales | Imágenes | Skins | Clips de animación |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `characters/student.glb` | 2,35 | 77.468 | 1 | 1 | 0 | Ninguno |
| `characters/student01.glb` | 2,35 | 77.468 | 1 | 1 | 0 | Ninguno |
| `characters/student04.glb` | 3,86 | 21.534 | 1 | 3 | 1 | `Alltogether`, `idle d` |
| `characters/student08.glb` | 30,20 | 408.506 | 1 | 3 | 0 | Ninguno |
| `characters/student09.glb` | 27,54 | 398.775 | 1 | 3 | 0 | Ninguno |
| `characters/student10.glb` | 0,88 | 10.510 | 2 | 2 | 1 | Ninguno |
| `characters/teacher.glb` | 2,97 | 36.458 | 1 | 1 | 0 | Ninguno |
| `space/characters/space-student-01.glb` | 4,27 | 56.444 | 3 | 1 | 0 | Ninguno |
| `space/characters/space-student-02.glb` | 5,68 | 12.680 | 2 | 6 | 1 | Ninguno |
| `space/characters/space-student-03.glb` | 0,34 | 1.704 | 28 | 6 | 0 | Ninguno |

Total real, calculado con bytes sin redondear: **84.340.708 bytes = 80,43 MiB**. La suma de filas redondeadas puede diferir. Los archivos `student08` y `student09` representan **57,74 MiB, el 71,79 %** del total, y **807.281 triángulos** declarados entre ambos. Son candidatos prioritarios a optimización offline, no a eliminación.

`student.glb` y `student01.glb` tienen el mismo tamaño y el mismo prefijo SHA-256 calculado (`783b2efda5584ebd`). Conviene confirmar la identidad completa y normalizar el registro de recursos si procede, manteniendo las rutas funcionales y fallbacks actuales.

Los GLB declaran materiales glTF PBR metálico/roughness; `space-student-01` utiliza `KHR_materials_pbrSpecularGlossiness` y `space-student-03` declara `KHR_materials_unlit`. Por tanto, **no es correcto diagnosticar que el proyecto carece de PBR**. La mezcla de modelos iluminados y unlit puede contribuir a la falta de coherencia de acabados.

### 2.3 Texturas, audio y licencias

- `student08` y `student09` incorporan tres imágenes de 2048 × 2048 cada uno. Como cálculo de almacenamiento RGBA8 sin compresión, serían 48 MiB de nivel base por archivo, aproximadamente 64 MiB con mipmaps completos. No son mediciones de VRAM: el formato de carga, reutilización y compresión real pueden cambiar el resultado.
- `space-student-02` incorpora seis imágenes de 2048 × 2048. El mismo cálculo hipotético da 96 MiB base y unos 128 MiB con mipmaps, aunque el GLB en disco solo pesa 5,68 MiB. Es un ejemplo de por qué tamaño descargado y memoria de texturas no son equivalentes.
- `public/museum/posters/ciencia.png`: 1672 × 941, aproximadamente 1,71 MiB en disco. `observa-las-caras.png`: 1448 × 1086, aproximadamente 1,98 MiB. Preservar su legibilidad al optimizar; no confundir el cartel decorativo con los estímulos generados por la actividad.
- Audio local: `public/assets/audio/ambient/aula-ambiente.mp3` — aproximadamente 2,85 MiB; `public/assets/audio/space/ambient/station-hum.mp3` — aproximadamente 57,7 KiB.
- También hay logotipos, símbolos, SVG e imagen de portada locales. No se descargó material adicional.
- Los GLB inspeccionados no contienen `asset.copyright`; los README de personajes son instrucciones de integración, no un manifiesto de licencias. **No se concluye que los recursos sean ilegítimos**: falta documentación de origen, autor, licencia y permiso de adaptación. Verificarla antes de redistribuir derivados u obtener nuevos modelos.

## 3. Iluminación, materiales y renderizado

### Estado confirmado

| Escenario | Luces construidas | Sombras actuales | Procesamiento de imagen |
| --- | --- | --- | --- |
| Aula | 1 hemisférica y 1 direccional de ventana | Mapa 1024, Blur ESM, kernel 16, blurScale 2, actualización cada dos fotogramas; oscuridad 0,36 | Exposición 1,02; contraste 1,08 |
| Estación | 1 hemisférica, 1 direccional y 2 puntuales de acento | Misma resolución y filtrado; oscuridad 0,28 | Exposición 1,08; contraste 1,02 |
| Museo | 1 hemisférica, 1 direccional, 3 puntuales y 3 spots | Misma resolución y filtrado; oscuridad 0,26 | Exposición 1,05; contraste 1,04 |

Evidencias: `scenes/ClassroomScene.ts:144`, `:168`, `:195`; `environment/SpaceStationBuilder.ts:263`; `scenes/SpaceStationScene.ts:178`, `:205`; `environment/MuseumBuilder.ts:170`; `scenes/VisualDiscriminationScene.ts:164` y métodos contiguos.

`SceneVisuals.ts:5` ya crea un pipeline LDR, `fxaaEnabled = true`, `samples = 1`, `imageProcessingEnabled = false`. Esto desactiva el paso de procesamiento del pipeline, **no demuestra que se hayan desactivado los ajustes por material de exposición y contraste de la escena**. El motor solicita antialiasing en `main.ts:31`, con escalado de render 1. No se ha comprobado el MSAA efectivo de una GPU concreta.

No se encontraron asignaciones a `scene.environmentTexture`, ni activación propia de tone mapping, bloom, GlowLayer, SSAO, LOD o SceneOptimizer en los módulos visuales inspeccionados. Tampoco hay un recurso de entorno IBL en el inventario de `public/`.

### Ajustes recomendados

1. **Acabados selectivos:** mantener superficies sencillas con `StandardMaterial` y ensayar PBR para madera, plástico y metal de exploración. El adaptador deberá traducir explícitamente `diffuseColor/specularPower` a `albedoColor/roughness/metallic`; no cambiar la clase devuelta a todos los consumidores.
2. **Luz antes que filtros:** equilibrar hemisférica y direccional, reservar emisivos para luminarias y pantallas y evitar grandes superficies autoiluminadas. El techo del aula tiene `disableLighting = true` (`ClassroomBuilder.ts:166`), lo que limita su gradación visual.
3. **Luz del museo por exposición:** existen ocho luces, pero `StandardMaterial` limita por defecto a cuatro luces simultáneas, confirmado en la implementación instalada. No se puede asumir que las ocho contribuyen a cada objeto. Proponer selección por malla y rango antes de subir el límite global.
4. **Contacto de personajes:** las sombras de personajes del aula están desactivadas por `CHARACTER_SHADOWS_ENABLED = false` (`CharacterManager.ts:77`). Los visitantes del museo no reciben sombras (`MuseumCharacterManager.ts:349`) y sus mallas no se añaden al generador desde ese gestor. Los personajes espaciales tampoco se registran allí como casters. La presencia de `ShadowGenerator` no garantiza sombras bajo todos los personajes.
5. **IBL y efectos:** considerar un entorno local prefiltrado y de licencia verificada después de medir. No usar una llamada por defecto que descargue un entorno de un CDN sin aprobación. Bloom y glow no son requisitos para un aspecto moderno y permanecen en espera.

Todas las modificaciones globales de iluminación, materiales, sombras y color que alcancen evaluación requieren aprobación específica y referencia visual aprobada. PBR e IBL son capacidades nativas; su uso y los formatos de entorno se explican en [PBR](https://doc.babylonjs.com/features/featuresDeepDive/materials/using/masterPBR) y [entornos HDR](https://doc.babylonjs.com/features/featuresDeepDive/materials/using/HDREnvironment).

## 4. Distribución, composición, navegación y colisiones

**Aula.** Conservar pizarra, pupitres, ventanas y anclajes. Los personajes actuales están configurados de pie y los estudiantes tienen `seatAnchorId: null` (`CharacterConfig.ts:92` en adelante), aunque existe soporte de asientos. No basta con aplicar una animación idle para que parezcan ocupados en actividades escolares. La distribución debe comprobarse con dimensiones reales de los modelos normalizados y de cada pupitre.

Hay una incongruencia concreta de orientación: `student01` se coloca en `(6, 0, 4)`, pero el ángulo se calcula con `(4.25, 1.45)` (`CharacterConfig.ts:99` y `:102`). Proponer una orientación coherente para exploración, conservando la transformación de evaluación hasta que sea aprobada.

**Estación.** Ya existe una cámara exterior detrás de la ventana, varios planetas, atmósferas, bandas y un fondo procedural (`SpaceStationBuilder.ts`, métodos `createWindowSpaceChamber`, `createPlanets`, `createPlanetMaterial`). La mejora debe ser de composición y profundidad de esos recursos, no de añadir una segunda capa redundante. Consolas, alas y asientos deben dejar un recorrido claro.

**Museo.** Hay zonas de arte, ciencia y percepción, directorio, vitrinas, bancos y una `assessmentClearZone` definida (`MuseumBuilder.ts:78`). Conviene evaluar separaciones con cajas de los modelos transformadas. Las coordenadas por sí solas no permiten afirmar que haya una interpenetración concreta de dos personajes. La auditoría no presenta como confirmadas superposiciones no medidas.

**Colisiones, confirmado por código:** la cámara tiene `checkCollisions` y el escenario conserva mallas de colisión, pero el desplazamiento WASD se aplica con `position.addInPlace(movement)` (`camera/CameraManager.ts:365`). Esa ruta de movimiento no utiliza la resolución de colisiones de Babylon; los límites del cuarto no resuelven obstáculos interiores. Se propone documentar y reproducir el comportamiento antes de corregirlo. Cualquier cambio en el controlador de cámara exige autorización expresa; no se implementa como un ajuste visual rutinario.

**Línea visual del museo:** `warnIfBoxTouchesAssessmentClearZone` solo avisa, no impide colocar objetos, y no considera la rotación de la caja. La comprobación de visión utiliza intersecciones de AABB con un rayo (`VisualDiscriminationScene.ts:280`), susceptibles de falsos positivos o de bounds desactualizados. Revisar estas herramientas antes de reubicar exposiciones basándose únicamente en un warning. No eliminar paredes, pedestales ni recursos para silenciar advertencias.

## 5. Personajes, animaciones y separación experimental

### 5.1 Lo que ya funciona y debe conservarse

- Aula: normalización de altura, orientación, fallback, caché de contenedores y alias de animaciones. `AmbientBehaviorManager.stop()` se llama antes de evaluación (`ClassroomScene.ts:270`).
- Estación: carga de tres modelos y orientación hacia ventana o participante. El cargador detiene sus `AnimationGroups` (`SpaceCharacterManager.ts:123`).
- Museo: `setMode("evaluation")` detiene la animación activa y restaura posiciones de visitantes; el idle procedural consulta `evaluationMode` (`MuseumCharacterManager.ts:223`, `:505`).
- Las decoraciones nuevas de `ExplorationAccents` se agregan a `evaluationHiddenMeshes` en las tres escenas. Es un mecanismo útil para conservar.

### 5.2 Límites reales de los recursos

Solo `student04.glb` trae clips de animación en el inventario actual. Tener una skin en `student10` o `space-student-02` no significa que tengan una animación idle o de sentado. Los otros modelos estáticos no se pueden volver expresivos mediante un nombre de animación inexistente.

Propuesta: reutilizar los clips válidos donde corresponda, utilizar movimientos de raíz discretos únicamente en exploración y estudiar rigging/poses offline para modelos seleccionados. No simular una postura sentada deformando indiscriminadamente una malla estática. Una sustitución artística o retopología se haría sobre copias, con licencia y aprobación.

### 5.3 Hallazgos que requieren decisión del protocolo, no corrección automática

| Hallazgo confirmado | Evidencia | Decisión necesaria |
| --- | --- | --- |
| La escultura cinética del museo se actualiza en cada render sin condición de modo. | `MuseumBuilder.ts:709`: rotación de raíz y oscilación del núcleo; no consulta evaluación. | Determinar si ese movimiento forma parte del entorno experimental aprobado; si no, autorizar específicamente su suspensión. |
| La estación no queda estática en evaluación. | `SpaceAmbientManager.ts:406`: escalas 0,18 baseline, 0,16 auditiva, 0,42 visual y 0,48 combinada; actualizaciones de planetas, asteroides, estrellas y consola. | Acordar qué movimientos son ambientales autorizados y cuáles son distractores de cada condición. No sustituir estos valores por cero sin aprobación. |
| Los fallbacks del aula conservan idle procedural en evaluación. | `CharacterManager.ts:1171` y `:2195`: intensidad 0,22 baseline, 0,30 auditiva y 0,54 visual/combinada. | Revisar su correspondencia con el protocolo antes de añadir, quitar o ampliar movimientos. |
| La preferencia de sonido de exploración controla un gestor compartido con señales y distractores. | `ExplorationPreferences.ts`; `ClassroomScene.ts:89`, `SpaceStationScene.ts:91`, `VisualDiscriminationScene.ts:79`; `AudioManager.ts:102`, `:145`, `:179`. | Una preferencia “sin sonido” puede impedir reproducir señales o distractores. Definir si la evaluación debe restaurar una política de audio aprobada y cómo registrar su estado. No cambiarlo en V0. |
| Ya existen cambios de encuadre e instrucciones en el árbol de trabajo anterior a V0. | `camera/CameraManager.ts:98`; títulos e instrucciones en `GoNoGoActivity.ts:100`, `CPTActivity.ts:83`, `VisualDiscriminationController.ts:106` y `:561`. | Revisar por separado si esos cambios cuentan con la aprobación experimental correspondiente. Esta auditoría no los aplica ni revierte. |

Estos hallazgos no demuestran por sí solos que los datos recogidos sean inválidos. Identifican aspectos cuyo comportamiento visual y auditivo debe quedar especificado antes del siguiente rediseño.

## 6. Interfaz, navegación, carga y liberación

### Base que conviene conservar

`ExplorationHud` ya ofrece botones con icono y texto, ayuda en tres pasos, estado “preparando”, preferencia de sonido y regreso al menú. `world-ui.css:23` establece una altura mínima de 48 px para sus botones, foco visible y temas consistentes. La ayuda usa HTML `details`; el panel se oculta al capturar el ratón y vuelve al liberarlo. Las escenas retiran este HUD antes de mostrar la actividad.

Se calcularon cuatro contrastes de colores CSS sólidos, sin interpretar capturas: blanco sobre verde `#287969` = **5,21:1**; sobre azul `#4168ad` = **5,51:1**; sobre violeta `#8056a4` = **5,55:1**; texto `#506561` sobre `#fffdf5` = **6,11:1**. Son comprobaciones parciales de tokens: no certifican todos los estados, tamaños, overlays ni accesibilidad del canvas.

### Ajustes propuestos

- Reutilizar el HUD; no crear tres implementaciones independientes ni migrarlo a Babylon GUI sin necesidad.
- Revisar textos para 6–10 años: instrucciones directas, sin depender solo de símbolos, colores o abreviaturas. Probar tamaño de texto y comprensión con niños; los 12–15 px actuales de algunos textos pueden requerir aumento.
- Separar visualmente la acción adulta “Finalizar evaluación” del flujo infantil del selector. Mantener callbacks y rutas; cualquier cambio funcional debe aprobarse.
- Completar el componente de carga con estado recuperable, timeout razonable, reintento y salida previa a la evaluación. Actualmente `setBusy()` deshabilita también el menú y no dispone de `setError`/recuperación (`ExplorationHud.ts:113`).
- Revisar la captura de ratón, el mensaje alternativo de arrastrar y navegación por teclado en pruebas reales. La documentación de una alternativa no prueba su funcionamiento en todos los navegadores.
- Conservar respeto de movimiento reducido en CSS y en transición 3D; no asumir que ello controla automáticamente planetas, visitantes o esculturas.

### Ciclo de vida y carga

`main.ts` dispone la escena activa al cambiar de mundo. Los controladores liberan audio, cámaras 3D, personajes y escena. `SceneVisuals` dispone el pipeline al cerrar la escena. El aula elimina su observable idle y dispone contenedores almacenados.

Hay riesgos por comprobar: las cargas asíncronas de personajes no incluyen una bandera clara de cancelación/generación tras salir del escenario; el museo y la estación cargan visitantes secuencialmente; la estación lanza la inicialización con `void` y no espera a que termine antes de iniciar evaluación. Una carga tardía podría añadir mallas o trabajo de GPU en un momento no deseado. Proponer un estado de disponibilidad y descarte de resultados tardíos; cambios que alteren el momento de inicio experimental requieren aprobación.

El observable idle del museo y el de la escultura se liberan al disponer la escena completa; no conviene reutilizar sus gestores en una escena viva sin añadir propiedad explícita del observable y su eliminación.

## 7. Bibliotecas y tecnologías: compatibilidad verificada

Versiones leídas de los paquetes instalados, no inferidas del rango de `package.json`:

| Paquete | Versión instalada | Decisión |
| --- | --- | --- |
| `@babylonjs/core` | 9.25.0 | Conservar. |
| `@babylonjs/loaders` | 9.25.0 | Conservar; coincide con el núcleo. |
| `@mediapipe/tasks-vision` | 1.0.1 | Protegido; no actualizar ni reconfigurar como parte visual. |
| `typescript` | 6.0.3 | Conservar para esta fase. |
| `vite` | 8.2.2 | Conservar. |
| `vitest` | 4.1.11 | Conservar las pruebas existentes. |

No están instalados `@babylonjs/gui`, GSAP ni glTF Transform. Se verificó la presencia local de APIs de PBR, cubemaps y herramientas de entorno, pipeline, sombras, instancias, thin instances, LOD, `SceneOptimizer`, `AssetContainer` y `GlowLayer`. Las páginas web se usaron como referencia de comportamiento; los tipos y la implementación instalados son la referencia para compatibilidad 9.25.0.

| Tecnología nativa | Uso actual / compatibilidad | Recomendación |
| --- | --- | --- |
| PBRMaterial | Existe; también se importa para trabajar con modelos GLB. Los acabados procedurales son Standard. | Introducción selectiva, con adaptador; conservar materiales de estímulos. |
| EnvironmentTexture / IBL | APIs disponibles; no se encontró asignación de entorno. | Considerar un recurso local prefiltrado después de medir y verificar licencia; sin descarga por defecto. |
| ImageProcessingConfiguration / tone mapping | Exposición y contraste ya configurados; sin activación propia de tone mapping. | Conservar referencia de evaluación. Ensayar una variante de exploración aprobada, no un cambio global inadvertido. |
| DefaultRenderingPipeline | En uso, LDR y FXAA. | Conservar y parametrizar por capacidades y modo. |
| FXAA / MSAA | FXAA activo; `samples = 1`. | Medio: FXAA actual. Alto: estudiar MSAA 2× en WebGL 2 y según `maxMSAASamples`; no asumir soporte de la GPU. [Referencia](https://doc.babylonjs.com/features/featuresDeepDive/postProcesses/defaultRenderingPipeline). |
| Bloom / GlowLayer | No activados; APIs disponibles. | En espera de medición. Si se justifican, elegir un mecanismo moderado y selectivo, solo exploración; nunca contaminar estímulos o instrucciones. |
| ShadowGenerator | Blur ESM existente. | Ajustar lista de casters, volumen de luz y resolución antes de añadir otra técnica. PCSS exige más recursos; no es el valor por defecto propuesto. [Referencia](https://doc.babylonjs.com/features/featuresDeepDive/lights/shadows). |
| Animations / AnimationGroups / observables | En uso. | Conservar; auditar propiedad, pausa por modo y disposición. |
| InstancedMesh / thin instances | APIs presentes; el redondeo comparte Geometry, no hace batching por sí mismo. | Instancias para objetos repetidos compatibles; thin instances para grupos estáticos homogéneos. Separar por material, visibilidad, colisión y pertenencia a evaluación. No aplicar a todos los personajes con animación independiente. [Referencia](https://doc.babylonjs.com/features/featuresDeepDive/mesh/copies/thinInstances). |
| LOD | API disponible, sin niveles explícitos localizados. | Variantes de geometría para exploración, preservando silueta y escala; los modelos necesarios deben prepararse. [Referencia](https://doc.babylonjs.com/features/featuresDeepDive/mesh/LOD). |
| SceneOptimizer | Disponible, sin uso actual localizado. | Evitar degradación automática durante ensayos. Como máximo, calibración previa y opciones acotadas, con el perfil fijado antes de evaluación. [Referencia](https://doc.babylonjs.com/features/featuresDeepDive/scene/sceneOptimizer). |
| AssetContainer | En uso en los tres gestores. | Extender reutilización y control de propiedad; no compartir ciegamente contenedores entre escenas que se disponen. |

## 8. Babylon.js nativo frente a herramientas adicionales

| Necesidad | Solución preferida | ¿Justifica instalar algo? | Condiciones |
| --- | --- | --- | --- |
| Paneles, controles, ayuda, estados | HTML/CSS existente | No | Mantener accesibilidad, foco y diseño adaptable. |
| Microanimaciones y transiciones | CSS, `Animation` y observables ya disponibles | No; GSAP no aporta una ventaja demostrada aquí | Respetar movimiento reducido y modo. |
| Menús dibujados en pantalla | HUD actual | No; Babylon GUI/GUI Editor añadiría un segundo sistema | Considerarlo solo si aparece una interacción 3D específica que HTML no resuelva bien. |
| Acabados y luz | PBR, StandardMaterial e IBL nativos | No como dependencia de runtime | Un nuevo recurso gráfico local sigue necesitando aprobación y licencia. |
| Reducir draw calls | Instancias y gestión de materiales de Babylon | No | Medir antes y conservar grupos de visibilidad y anclajes. |
| Reducir polígonos, crear rig y poses de GLB | Herramienta de autoría offline, por ejemplo Blender | Puede justificarse | Solo si no existe ya una herramienta adecuada; verificar licencia de los modelos y preservar originales. No se instala en V0. |
| Automatizar deduplicación, simplificación y preparación de texturas | CLI offline de glTF Transform | Puede justificarse para el lote de recursos | Requiere aprobación de instalación y revisión de cada transformación. No añadir al runtime infantil. [Documentación oficial](https://gltf-transform.dev/cli). |
| Texturas comprimidas KTX2 | Cargador compatible de Babylon y preparación offline | Condicional | Verificar extensiones/capacidades, calidad y codificadores. Si el runtime requiere decodificadores WASM, alojarlos localmente y auditar licencias; sin descargas automáticas no aprobadas. |

**Selección propuesta:** ninguna nueva biblioteca de runtime para V1. Una herramienta offline de optimización podría aportar una ventaja real en V2/V4; no se autoriza implícitamente con este informe.

## 9. Rendimiento: datos obtenidos, límites y perfiles propuestos

### 9.1 Referencia disponible y referencia pendiente

No había un frontend escuchando en los puertos habituales 5173/5174 durante la comprobación. No se abrió una sesión nueva con webcams ni se creó un harness de escenas. En consecuencia, no existe en esta V0 una captura válida de rendimiento combinado 3D + cámaras + MediaPipe.

El flujo actual pasa por la interfaz del especialista y la preparación/calibración de cámaras antes de entregar el selector (`main.ts:43` y callback de `AnalysisApplicationController.initialize`). Obtener una referencia combinada requiere un entorno de ensayo autorizado y cámaras operativas; iniciar solo el motor o usar un renderizador sin GPU no proporcionaría esa referencia. La medición se deja como requisito previo a activar efectos costosos, sin fabricar participantes, sesiones o resultados de evaluación.

| Métrica solicitada | Resultado de esta V0 | Evidencia / límite |
| --- | --- | --- |
| FPS promedio y mínimo, por escenario y modo | **No medidos** | Requieren una ejecución gráfica representativa; no se sustituyen por tiempos de pruebas. |
| Tiempo por fotograma, percentiles y trabajo de GPU | **No medidos** | Tipado, Node y conteo GLB no ejecutan el render WebGL. |
| Memoria JS / memoria GPU de la aplicación | **No medidas** | El probe usa `performance.memory` cuando existe, que no equivale a VRAM. Las cifras RGBA8 anteriores son cálculos hipotéticos. |
| Draw calls activos | **No medidos** | Materiales/primitivas del GLB no son una captura de draw calls. |
| Polígonos de archivos | **Medidos por inspección binaria** | Tabla de recursos; sin asumir visibilidad ni multiplicidad de instancias. |
| Carga de recursos | **Medido tamaño en disco, no latencia de red** | 80,43 MiB de GLB locales; latencia fría/caliente, decodificación y compilación de shaders pendientes. |

`PerformanceProbe.ts` ya observa FPS, delta, dimensiones, escalado, mallas, materiales, texturas, índices activos, animaciones, draw calls y tiempos de CPU. También incorpora contadores del análisis. Sin embargo, sobrescribe una muestra cada segundo; no conserva una serie ni obtiene por sí solo FPS mínimo de cada fotograma. Usa `_drawCalls`, un campo interno: la versión instalada expone `SceneInstrumentation.drawCallsCounter`, preferible para una futura instrumentación autorizada.

El archivo principal de JavaScript del `dist` preexistente mide **6.378.684 bytes**. No es una medición de arranque ni el resultado de una compilación nueva en V0; es una señal para estudiar carga diferida e imports, conservando el registro requerido de loaders y shaders.

### 9.2 Riesgos evidentes

- Los dos personajes pesados y las texturas 2K tienen prioridad sobre efectos de pantalla completa.
- El museo carga ocho visitantes secuencialmente y vuelve a crear contenedores para `student08`, `student04` y `student01` repetidos. El navegador puede cachear bytes, pero eso no garantiza reutilización de geometría, materiales y texturas decodificadas entre contenedores.
- El aula ya cachea contenedores, pero usa `instantiateModelsToScene(..., true, { doNotInstantiate: true })`: se solicitan clones y materiales propios. Hay razones válidas para esqueletos y tintes independientes; no afirmar que ya existe batching GPU por ese método.
- Una caja redondeada de la configuración actual tiene, por cálculo de su generador, **384 vértices y 588 triángulos**, frente a 24 vértices y 12 triángulos de una caja simple. Compartir Geometry reduce buffers duplicados; no elimina automáticamente draw calls ni el coste de rasterizar cada copia.
- El museo tiene ocho luces construidas y varios cristales/objetos transparentes. El overdraw y los pases de sombras requieren medición.
- La inferencia se invoca desde ciclos `requestAnimationFrame` y métodos síncronos `detectForVideo`. Los servicios intentan GPU y permiten fallback CPU. Hay planificación escalonada; no debe calificarse como inexistente ni modificarse en este trabajo. La competencia de GPU o hilo principal con render es un riesgo, no un coste cuantificado.
- Los valores de respaldo del código son 8 FPS para análisis superior y 4 FPS para cuerpo completo. **No son necesariamente la configuración efectiva:** no se leyeron archivos `.env`.

### 9.3 Protocolo de medición propuesto, previo a efectos costosos

1. Registrar equipo, GPU, navegador, versión, API WebGL, extensiones, resolución CSS y render, escala y estado de cámaras/inferencia. No recoger imágenes ni datos identificativos para este benchmark.
2. Separar carga fría y caliente; registrar bytes transferidos, decodificación, primer frame utilizable y finalización de recursos necesarios. Calentar shaders y recursos antes de la ventana de comparación.
3. Por escenario: 60 s de exploración quieta y 60 s de recorrido reproducible, con al menos tres repeticiones. Son ventanas de benchmark de exploración, no cambios a la duración de las actividades.
4. Para evaluación, capturar el protocolo existente completo y sus condiciones aprobadas, sin acortar bloques ni simular que MediaPipe está activo. Repetir en el mismo entorno de ensayo autorizado; no crear sesiones de participantes o envíos de resultados reales solo para probar gráficos.
5. Comparar 3D aislado y 3D con análisis para atribuir costes; la aceptación debe basarse en el combinado. Registrar FPS agregado, mínimo con intervalo definido, percentiles de frame time, pausas largas, draw calls, triángulos activos, memoria JS cuando exista y tiempos de inferencia disponibles.
6. Mantener idéntica instrumentación antes/después. No usar promedios de un segundo como “mínimo instantáneo”. Si no hay acceso a memoria GPU, indicar “no observable”.

Hasta completar esa referencia, bloom, glow, PCSS, más luces, MSAA adicional y entornos más costosos quedan como **candidatos condicionados**, no como mejoras cuya activación se recomiende ya.

### 9.4 Tres perfiles, exclusivamente propuestos

Los números son puntos de partida de diseño, no mediciones ni promesas. La configuración pertenece al especialista. **No habrá cambio automático de perfil durante un ensayo.**

| Parámetro de exploración | Bajo | Medio | Alto |
| --- | --- | --- | --- |
| Materiales | Standard compartidos y acabados simples | PBR selectivo donde aporte volumen | PBR selectivo más completo; conservar materiales simples donde baste |
| Texturas de personajes derivadas | Habitualmente 512–1024, según visibilidad | Habitualmente 1024 | Hasta 2048 solo si se justifica; cartelería legible en todos |
| Geometría | LOD preparado, bevel reducido en objetos pequeños | Redondeo y LOD moderados | Mayor detalle solo en objetos cercanos |
| Sombras | Mapa 512 y lista limitada; decidir caché estática tras medir | Blur ESM 1024, referencia cercana al estado actual | Probar 1024–2048 o filtrado superior si hay margen; sin multiplicar técnicas |
| Antialiasing | Comparar FXAA ligero y fallback | FXAA actual, samples 1 | Comparar MSAA 2× soportado frente a FXAA; elegir una solución medida |
| IBL | Sin entorno adicional hasta justificarlo | Cubemap local pequeño si se aprueba | Mayor resolución local solo tras medir |
| Efectos | Sin bloom, glow ni partículas añadidas | Sin efectos adicionales por defecto | Un efecto emisivo selectivo opcional, solo si pasa referencia y revisión |
| Animación | Ambiental mínima y controlada | Idle lento y discreto | Mayor naturalidad, sin añadir estímulos competitivos |
| Escalado de render | Calibración previa; no elegir un valor todavía | Referencia actual 1 si el equipo la sostiene | Sin supersampling automático |

**Evaluación para los tres perfiles:** misma apariencia, geometría, sombras, cámara, resolución y efectos que se aprueben como referencia experimental; ninguna reducción de estímulos, distractores, audio o precisión temporal por elegir “bajo”. Si un equipo no sostiene esa referencia, se informa al especialista; no se degrada silenciosamente el experimento. Cualquier variante de evaluación por hardware necesitaría validación y aprobación independiente.

## 10. Dirección y mejoras por escenario

### Aula escolar

Dirección: luz diurna cálida, verde salvia, madera clara, plástico mate y acentos coral/azul en objetos concretos. Conservar mobiliario, pizarra y recursos existentes. Dar volumen mediante una iluminación equilibrada y acabados; no mediante saturación o emisivos globales.

Orden propuesto: optimizar copias de `student08/09`; normalizar orientación y escala visual de exploración; revisar pupitres y rutas con bounds reales; ensayar sombras de contacto limitadas; introducir PBR en unas pocas superficies. Para posturas, aprovechar rigs y clips existentes y preparar poses nuevas solo cuando los modelos lo permitan. La pizarra y Go/No-Go mantienen su referencia aprobada.

### Estación espacial

Dirección: paredes azul grisáceo luminosas, consola más oscura, metal satinado, cian como guía y ámbar en pequeños indicadores. Mantener la profundidad ya creada en la ventana y mejorar la composición de planetas, no aumentar su número indiscriminadamente.

Orden propuesto: acordar primero la matriz de movimientos por modo/condición; revisar la carga de texturas de `space-student-02` y el fragmentado de 28 materiales de `space-student-03`; ajustar luz de consolas e IBL selectivo; comprobar el recorrido entre mobiliario. Bloom/glow no debe afectar CPT y no es condición para cerrar V3.

### Museo interactivo

Dirección: paredes crema, madera y latón suaves, señalización consistente por galería y luz cálida dirigida. Crear jerarquía por agrupación y espacio vacío, conservando las exposiciones.

Orden propuesto: acordar el comportamiento de la instalación cinética; reutilizar recursos de visitantes y preparar LOD de modelos pesados; revisar circulación, vitrinas y separación de grupos; asignar luces a exposiciones; mejorar marcos y pedestales como una familia coherente. La zona de discriminación y las caras oficiales no se rediseñan. No eliminar objetos por una advertencia de AABB sin verificación geométrica y visual.

## 11. Matriz de recomendaciones y prioridades

Prioridad: **P0** = decisión o referencia previa a implementación; **P1** = siguiente trabajo con beneficio claro; **P2** = pulido condicionado por resultados. Todas las filas son propuestas, no autorización de implementación.

### Evidencia y solución

| ID | Escenario | Problema y evidencia | Mejora propuesta | Tecnología |
| --- | --- | --- | --- | --- |
| G1 | Los tres | Modo visual y audio no completamente desacoplados; sección 5.3. | Aprobar una matriz explícita de estado visual/sonoro de evaluación y un contrato de exploración. | Tipos y control de estado Babylon/TS; sin nueva biblioteca. |
| G2 | Los tres | Probe de una muestra por segundo, sin referencia combinada; `PerformanceProbe.ts:33`, `:76`. | Captura reproducible de series y evaluación conjunta con inferencia, sin cambiarla. | Instrumentation y métricas del navegador ya disponibles. |
| G3 | Los tres | Carga async sin cancelación explícita; `CharacterManager.ts:112`, `MuseumCharacterManager.ts:211`, `SpaceCharacterManager.ts:37`. | Propiedad de recursos, descarte de cargas tardías y disponibilidad controlada. | AssetContainer, observables y estado de ciclo de vida. |
| G4 | Los tres | Standard procedural y PBR importado heterogéneos; `SurfaceMaterials.ts:7`. | Adaptador de acabados y prueba PBR selectiva en exploración. | PBRMaterial y StandardMaterial existentes. |
| G5 | Los tres | Redondeo costoso y Geometry compartida sin batching; `ModernGeometry.ts:42`. | Presupuesto de bevel/tessellation; instancias por grupos compatibles. | Geometry, InstancedMesh, thin instances cuando correspondan. |
| G6 | UI | HUD reutilizable, pero busy sin recuperación; `ExplorationHud.ts:113`. | Estados recuperables de carga/error y validación de lectura/foco para 6–10 años. | HTML/CSS y eventos existentes. |
| A1 | Aula | Dos modelos suman 807.281 triángulos; tabla GLB. | Copias optimizadas/LOD preservando originales y aspecto. | Preparación offline; LOD nativo. |
| A2 | Aula | Personajes sin sombras; `CharacterManager.ts:77`. | Probar contacto limitado únicamente en exploración y perfilar casters. | ShadowGenerator existente; alternativa de contacto simple si se aprueba. |
| A3 | Aula | Orientación de `student01` usa otro punto; asientos sin anclar; `CharacterConfig.ts:99`. | Composición, poses y orientación de exploración con bounds reales. | TransformNode, anclajes y clips válidos. |
| S1 | Estación | Movimiento no nulo en evaluación; `SpaceAmbientManager.ts:406`. | Especificar los movimientos autorizados por condición antes de modificar ambientación. | Control de modo/condición ya existente. |
| S2 | Estación | Acabados tecnológicos Standard y emisivos; `SpaceStationBuilder.ts:184`, `:219`. | Metal satinado, acentos cian/ámbar y composición de profundidad. | PBR selectivo, luces e IBL local aprobado. |
| S3 | Estación | Seis imágenes 2K en un modelo; 28 materiales en otro; inventario. | Optimizar texturas, revisar materiales equivalentes y mantener variantes unlit si son deliberadas. | Trabajo offline y reutilización; sin reemplazar modelos arbitrariamente. |
| M1 | Museo | Escultura animada sin comprobar modo; `MuseumBuilder.ts:709`. | Decisión explícita y, si se aprueba, control de su actividad por modo. | Observable existente y registro de objetos dinámicos. |
| M2 | Museo | Contenedores repetidos y carga secuencial; `MuseumCharacterManager.ts:211`, `:261`. | Caché por escena y duplicación adecuada de poses/materiales. | AssetContainer e instanciación/clonado selectivo. |
| M3 | Museo | Ocho luces, circulación densa y pruebas AABB limitadas; `MuseumBuilder.ts:170`, `:1632`; `VisualDiscriminationScene.ts:280`. | Asignación de luces, medición de separación y mejora de herramientas diagnósticas. | Inclusión/exclusión por malla, bounds transformados y comprobación visual. |

### Impacto y riesgo de las mismas recomendaciones

| ID | Impacto visual esperado | Impacto posible en rendimiento | Riesgo para evaluación / aprobación | Prioridad |
| --- | --- | --- | --- | --- |
| G1 | Coherencia y ausencia de cambios accidentales | Bajo coste previsto, por medir | Alto si modifica audio o movimiento actuales; requiere aprobación específica | P0 |
| G2 | Permite elegir mejoras sostenibles | Instrumentación con coste que debe mantenerse igual en comparaciones | No cambiar reloj, inferencia ni protocolo; capturas en entorno autorizado | P0 |
| G3 | Menos apariciones tardías y pantallas bloqueadas | Potencial reducción de recursos retenidos | Medio/alto si afecta disponibilidad al comenzar ensayos | P1 |
| G4 | Mayor diferenciación y volumen de superficies | Más shaders/texturas si no se limita | Alto si alcanza estímulos o fondo experimental; limitar a exploración | P1 |
| G5 | Mantener suavidad donde se aprecia | Potencial reducción de polígonos/draw calls | Medio: conservar anclajes y grupos que se ocultan en evaluación | P1 |
| G6 | Más claridad y autonomía | Bajo coste esperado | Bajo en exploración; instrucciones oficiales y flujo adulto requieren revisión aparte | P1 |
| A1 | Misma silueta con detalle razonable | Potencial beneficio alto, sin porcentaje prometido | Medio/alto si se usan derivados en evaluación; variantes separadas | P1 |
| A2 | Personajes mejor apoyados sobre el suelo | Más trabajo de sombras; medir antes/después | Alto si cambia evaluación; solo exploración propuesta | P1 |
| A3 | Mejor lectura de actividad y escala | Bajo coste esperado | Medio/alto si cambia posiciones u orientación experimental | P1 |
| S1 | Mantener tecnología y movimiento coherentes | Variable según decisión del protocolo | Alto; no modificar factores sin autorización | P0 |
| S2 | Mayor profundidad y acabado tecnológico | Coste adicional moderado o alto según IBL/luces | Alto si cambia CPT o periferia experimental; explorar solamente | P2 |
| S3 | Mayor coherencia y menor carga | Potencial beneficio de memoria/draw calls | Medio/alto si cambia apariencia usada en evaluación | P1 |
| M1 | Control de composición periférica | Puede reducir trabajo si se aprueba pausa | Alto: cambia un movimiento actual; decisión del protocolo | P0 |
| M2 | Menos retrasos de aparición | Potencial reducción de decodificación/recursos duplicados | Medio; no compartir accidentalmente animación o tintes entre visitantes | P1 |
| M3 | Exhibiciones más legibles y recorridos claros | Puede reducir luces por malla; composición por medir | Alto si reubica elementos de evaluación o altera su comprobación | P1 |

## 12. Plan por fases y límites de aprobación

| Fase | Trabajo y archivos involucrados | Entrega y puerta de salida |
| --- | --- | --- |
| **V0 — actual** | Auditoría de archivos citados, GLB y documentación. | Este informe. Sin cambios de código ni instalaciones. |
| **V1 — sistema compartido** | Evolucionar `SurfaceMaterials.ts`, `SceneVisuals.ts`, política visual de escenas y gestión de recursos. Proponer módulos como `VisualModePolicy.ts`, `GraphicsProfiles.ts` y `LightingRig.ts`, todavía inexistentes. | Componentes de exploración, perfiles declarativos y pruebas de aislamiento. Antes de conectar cambios de evaluación: aprobar por separado G1, S1, M1 y cualquier otra alteración experimental. Obtener referencia antes de efectos caros. |
| **V2 — aula** | `ClassroomBuilder.ts`, recursos derivados aprobados, `CharacterConfig.ts`, `CharacterManager.ts`, `ClassroomScene.ts`. | Comparativa visual/rendimiento; misma identidad de recursos y original conservado. Transformaciones de evaluación protegidas. |
| **V3 — estación** | `SpaceStationBuilder.ts`, `SpaceCharacterConfig.ts`, `SpaceCharacterManager.ts`, `SpaceAmbientManager.ts` solo en alcance aprobado, `SpaceStationScene.ts`. | Profundidad y acabados de exploración, texturas/materiales optimizados y comportamiento experimental aprobado sin cambios adicionales. |
| **V4 — museo** | `MuseumBuilder.ts`, `MuseumCharacterManager.ts`, `VisualDiscriminationScene.ts`. | Composición y recursos mejorados, galerías reconocibles y zona de actividad intacta. No modificar generador de caras ni hitboxes. |
| **V5 — UI infantil** | `ExplorationHud.ts`, `ScenarioSelector.ts`, `ScenarioPresentation.ts`, `ScenarioArtwork.ts`, `ExplorationPreferences.ts`, `world-ui.css`; integración mínima en escenas. | Estados completos, navegación funcional y pruebas de comprensión con niños. Mantener rutas/callbacks y separación del especialista. |
| **V6 — rendimiento y regresión** | Instrumentación autorizada de `PerformanceProbe.ts`, pruebas visuales/ciclo de vida y comparación de registros. | Mediciones repetibles combinadas; evidencia de conservación experimental. No modificar MediaPipe, cámaras, sincronización o métricas para hacer pasar el benchmark. |

**Áreas fuera del alcance automático de V1–V5:** archivos de actividades cognitivas, configuración de ensayos/distractores, métricas, servicios de captura, inferencia, sincronización, backend y MongoDB. Tampoco se rediseña la cámara 3D ni se cambia la resolución de evaluación sin aprobación explícita.

**Regla de estado:** los materiales, luces, animaciones y decoraciones adicionales de exploración deben tener propietario y un mecanismo verificable para no filtrarse a evaluación. No introducir parpadeos de exposición, recompensas, partículas, movimientos extra, vibración de cámara, ni cambios de perfil al empezar o durante un ensayo. Una restauración de apariencia debe devolver una referencia aprobada, no inventar una nueva “evaluación limpia”.

## 13. Archivos por conservar, reorganizar y proteger

| Tratamiento | Archivos / recursos | Condición |
| --- | --- | --- |
| Conservar y reutilizar | `ModernGeometry`, `SurfaceMaterials`, `SceneVisuals`, `ExplorationHud`, selector/temas, builders, anclajes, listas de colisión y visibilidad | Evitar duplicar sistemas que ya existen. |
| Reorganizar gradualmente | Responsabilidades de material/luz/perfil, cachés de personajes, observables y estados de carga | Mantener comportamiento actual por defecto y propiedad de cada recurso por escena. |
| Optimizar mediante copias | GLB pesados, imágenes grandes y recursos repetidos | Originales y nombres funcionales conservados; derivación solo con aprobación y licencia. |
| Revisar, no corregir aún | `SpaceAmbientManager`, escultura cinética, audio compartido, FOV e instrucciones ya cambiadas | Decisión experimental específica. |
| Proteger contra cambios | `activities`, `metrics`, `analysis/cameras`, `analysis/mediapipe`, `analysis/synchronization`, configuraciones experimentales y backend | Una mejora visual no autoriza modificar estos componentes. |

Los nombres de módulos nuevos del plan son propuestas de organización, no archivos creados en esta V0. El único archivo nuevo de esta ejecución es este informe.

## 14. Criterios de aceptación y pruebas

### Verificación realizada en esta V0

- `npx.cmd tsc --noEmit`: completado sin errores; no genera un build.
- `npm.cmd test`: **13 archivos y 47 pruebas aprobadas**. Cubren análisis y geometría existente; no demuestran por sí solas igualdad experimental completa ni rendimiento gráfico.
- Inspección de diez GLB, imágenes incorporadas, tamaños, materiales, skins, clips y extensiones; cálculos de geometría y contrastes documentados.
- Verificación de versiones y APIs instaladas; consulta de documentación oficial.
- No se ejecutó una compilación nueva ni una medición gráfica combinada, ni se obtuvieron nuevas capturas de escenas en esta V0. Las revisiones visuales de turnos anteriores no se presentan como nuevas mediciones de esta ejecución.

### Pruebas requeridas para las fases siguientes

| Área | Criterio y método de aceptación |
| --- | --- |
| Referencia experimental | Aprobar primero una matriz de luces, materiales, movimientos, audio, cámara, resolución y ayudas de evaluación por escenario/condición. Registrar excepciones explícitas. |
| Conservación de funciones | Comparar navegación y callbacks, IDs de escenario/actividad, anclajes, temporizadores, generadores de ensayos, objetivos, ventanas de respuesta y condiciones antes/después. No eliminar fallbacks o recursos originales. |
| Regresión temporal | Comparar secuencias controladas equivalentes: mismas transiciones, estímulos, cantidad/orden de eventos y parámetros de timestamp. Comparar intervalos relativos y dispersión del scheduling, no exigir que dos ejecuciones tengan la misma hora absoluta. Las tolerancias deben acordarse antes, no fijarse tras ver los resultados. |
| Aislamiento exploración/evaluación | Capturar ambas cámaras/estados y comprobar que ningún material, luz, sonido, observable o decoración adicional se filtre a la evaluación. Verificar las condiciones oficiales por separado; no “limpiarlas” sin autorización. |
| Pantallas y estímulos | Igualdad de formas, colores, tamaños proyectados, posición, contraste, hitboxes e instrucciones aprobadas durante evaluación; ninguna influencia de bloom, tone mapping o perfiles. |
| Ciclo de vida | Repetir entrar/salir al menos diez veces, incluida salida durante carga. No deben crecer de forma acumulativa escenas, contenedores, observables, timers o nodos de UI; comprobar memoria tras estabilización/GC cuando sea observable. |
| Carga | Modelo ausente, carga lenta, fallo y reintento: mensaje comprensible, salida segura antes del ensayo, sin spinner permanente ni aparición tardía en evaluación. |
| Rendimiento | Medición fría/caliente y combinada de la sección 9. Como objetivo de diseño, aspirar a 60 FPS y 16,7 ms por frame en el equipo de referencia; no son resultados obtenidos ni una garantía. No aprobar un perfil solo por promedio si tiene pausas que coinciden con estímulos o inferencia. |
| Composición | Recorridos reproducibles y capturas desde posiciones acordadas; comprobar bounds de personajes y muebles, separación, escalas y lectura de señales. No afirmar “sin superposiciones” usando solo coordenadas de origen. |
| Accesibilidad | Teclado completo del HUD, foco visible, texto legible, contrastes de todos los estados, zoom/resoluciones acordadas y movimiento reducido. Mantener símbolos con texto; probar lo que depende de canvas y captura de ratón. |
| Validación infantil | Con autorización y acompañamiento adecuados, observar niños de 6–10 años al elegir mundo, abrir ayuda, explorar, recuperar botones y empezar la práctica. Evaluar comprensión, errores y ayuda adulta necesaria; no asumirla a partir de una revisión técnica. |
| Licencias y red | Manifiesto de origen/licencia para nuevos recursos o derivados. Sin nuevas conexiones, telemetría ni decodificadores remotos no aprobados. |

**Condición para iniciar V1:** aprobación expresa del usuario para su alcance concreto. Este informe no autoriza instalaciones ni resuelve los hallazgos de evaluación. Se recomienda aprobar primero un V1 limitado al sistema visual compartido de exploración y al plan de medición; las decisiones de protocolo quedan en una aprobación separada.
