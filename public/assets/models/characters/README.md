Coloca aqui los modelos GLB de personajes.

Ruta runtime correcta:

/assets/models/characters/

Uso recomendado para varios estudiantes:

- student.glb: modelo compartido para student01, student02, student03, student04 y student05.
- student01.glb, student02.glb, etc.: modelos opcionales si quieres reemplazar un estudiante especifico.
- teacher.glb: modelo opcional para la profesora.

La configuracion central esta en:

src/characters/CharacterConfig.ts

El sistema intenta cargar primero modelUrl y luego modelUrlCandidates. Por defecto, los estudiantes usan student.glb como modelo compartido y despues buscan su archivo individual como respaldo.

Importante para postura sentada:

- Si el GLB del estudiante no trae skeleton/skin ni una animacion de sentado, no se puede doblar desde Babylon.
- En ese caso CharacterManager usa automaticamente el fallback sentado para que el aula no muestre ninos corriendo o de pie entre los pupitres.
- Para usar el GLB real sentado, exporta el modelo con rig/skeleton y una animacion tipo Sitting, Seated, ChairIdle o Sit_Idle.

Para probar un personaje:

1. Copia el archivo GLB en esta carpeta.
2. Si quieres que todos los estudiantes usen el mismo modelo, nombra el archivo student.glb.
3. Ejecuta npm run dev.
4. Abre la consola del navegador.
5. Revisa los mensajes de CharacterManager.
6. Si aparece muy grande, baja scale en CharacterConfig.ts.
7. Si aparece muy pequeno, sube scale en CharacterConfig.ts.
8. Si flota, ajusta positionOffset.y.
9. Si queda girado, ajusta rotationOffsetY.
10. Si las animaciones tienen nombres raros, agrega aliases en animationAliases.

Ejemplo de aliases:

animationAliases: {
  sitting: ["Sit_Idle", "ChairIdle"],
  raiseHand: ["Hand_Up", "Answer"],
  walking: ["WalkForward"]
}

Las rutas runtime deben empezar con /assets, no con /public:

/assets/models/characters/student.glb
