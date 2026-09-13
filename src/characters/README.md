Infraestructura de personajes

Archivos principales:

- CharacterConfig.ts: cambia aqui modelos, asiento, escala, offsets, colores, aliases de materiales y aliases de animacion.
- CharacterTypes.ts: tipos TypeScript compartidos.
- CharacterManager.ts: carga GLB, cachea modelos base, instancia personajes independientes, aplica colores seguros, reproduce animaciones, mueve personajes y limpia recursos.
- ClassroomBuilder.ts: crea los seat anchors invisibles studentSeat01Anchor, studentSeat02Anchor, etc. desde las posiciones reales de las sillas.

Uso rapido:

characterManager.playAnimation("student01", "idle");
characterManager.playAction("student02", "smallGesture");
characterManager.walkTo("student10", new Vector3(3, 0, -1), 3000);
characterManager.debugCharacter("student01");

Como se ubican los estudiantes:

- seatAnchorId asigna la silla: "studentSeat01Anchor", "studentSeat02Anchor", etc.
- positionOffset mueve al estudiante respecto a esa silla.
- rotationOffsetY gira al estudiante respecto a la orientacion de esa silla.
- position y rotationY quedan como respaldo si no existe el seat anchor.
- scale cambia el tamano del personaje.

Como cambiar apariencia:

appearance: {
  shirtColor: "#6D91B8",
  pantsColor: "#44546A",
  hairColor: "#3B2A20",
  shoesColor: "#34363A"
}

CharacterManager solo cambia color si puede identificar con seguridad mallas o materiales de ropa, pelo o zapatos. No colorea todo el modelo ni zonas como piel, cara, ojos o manos. Cada personaje clona sus materiales para que student01 no modifique a student02.

Postura de pie:

- La configuracion actual usa defaultAnimation: "idle" y seatId: null para mantener a los estudiantes parados junto a su pupitre.
- La teacher esta configurada como personaje estatico: se carga en el aula, pero CharacterManager bloquea animaciones, caminata y gestos sobre ella.
- Para agregar movimiento solo a estudiantes, usa allowedAmbientActions en CharacterConfig.ts.

Como reutilizar el mismo GLB:

- Coloca public/assets/models/characters/student.glb.
- Mantiene modelUrl: STUDENT_SHARED_MODEL_URL en varios estudiantes.
- CharacterManager carga ese GLB una vez en cache y crea instancias independientes con transform, materiales, skeletons y animaciones propios.

Como usar un GLB distinto:

- Cambia modelUrl o modelUrlCandidates en el personaje.
- Ejemplo: modelUrl: "/assets/models/characters/student05.glb".

Debug:

- CHARACTER_DEBUG = true imprime en consola meshes, materials, skeletons, animations, mapeos de apariencia, animacion actual y si uso fallback.
- debugCharacter("student01") devuelve la misma informacion desde codigo.

Si un GLB no existe, esta corrupto o no trae animaciones, CharacterManager usa fallback y mantiene la escena funcionando.
