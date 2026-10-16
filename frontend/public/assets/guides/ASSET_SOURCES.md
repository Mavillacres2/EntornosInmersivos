# Narración local de los guías

Versión activa: **es-MX-v3**. Doce WAV generados con **Windows System.Speech / Microsoft Sabina Desktop, cultura es-MX**, velocidad 0, pausas de 160 ms entre frases, PCM 16 kHz / 16 bits / mono. El manifiesto conserva la enumeración de voces realmente instaladas y hashes del texto y el audio. No había voz es-EC ni es-CO; no se eligió es-ES. Los tres personajes comparten esta voz disponible, con textos propios.

Textos: `src/guides/narration.es.json`. Generación: `scripts/generate-guide-audio.ps1` y `scripts/lib/NarrationRecorder.cs`; envolventes RMS: `scripts/build-guide-envelopes.mjs`. Los archivos timing incluyen marcas VisemeReached y SpeakProgress del motor local. No contienen grabaciones ni datos de participantes, y no usan un servicio en la nube.

Son salidas sintéticas de la voz instalada de Windows. No se redistribuyen el motor ni sus archivos de voz. No se atribuye una licencia CC0 ni una licencia abierta de Microsoft a estas salidas: para distribución institucional debe verificarse el alcance de los términos del Windows que proporcionó la voz. Una locución propia con autorización explícita puede sustituir los WAV, manteniendo el esquema de versión y regenerando hashes y tiempos.

`es-MX-v1` se conserva como versión histórica de la implementación anterior. La versión intermedia de desarrollo v2 se descartó al detectar una inconsistencia entre la frecuencia de salida y las marcas del motor. v3 fija explícitamente el formato PCM y valida todos los tiempos contra la duración real del WAV.

La bienvenida y despedida del menú se guardan separadamente como `host-es-MX-v1`, fuente editable `src/guides/host-narration.es.json`. Son dos audios nuevos con los guiones solicitados, el mismo motor Sabina es-MX, formato PCM y marcas reales. Conservan su propio manifiesto y hashes; no alteran las grabaciones de instrucciones de las actividades. Su procedencia y condiciones de distribución son las mismas descritas arriba.
