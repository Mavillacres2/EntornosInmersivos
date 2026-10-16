# Procedencia de Luma, Nova y Mica (V2)

Los nueve GLB de esta carpeta son geometría original creada para este proyecto. No contienen modelos, texturas, animaciones ni fragmentos descargados de bibliotecas de terceros. No requieren atribución a un proveedor externo. Su distribución sigue la licencia del proyecto; no se asigna una licencia CC0 a archivos del proyecto sin decisión de su titular.

Fuente editable: `frontend/scripts/build-guide-models.mjs`, `frontend/scripts/lib/write-glb.mjs` y `frontend/src/art/ArtGeometry.ts`. Regeneración: `npm run models:build`. Validación: `npm run models:check`.

Cada personaje tiene versiones low, balanced y high; materiales PBR, rig de nodos articulados, tres clips originales (Idle, Greeting y Pointing) y tres morph targets de boca. No contiene esqueleto con pesos, captura de movimiento ni animaciones de terceros. Las animaciones originales se combinan con interpolación quaternion y movimiento procedural en tiempo de ejecución.

La imagen de referencia proporcionada por el usuario se utiliza únicamente como orientación estética; no está incluida dentro de estos recursos. El pack Quaternius Modular Sci-Fi Megakit fue investigado, pero no incorporado.

`manifest.json` registra tamaños, vértices, triángulos, mallas y clips de los archivos generados.
