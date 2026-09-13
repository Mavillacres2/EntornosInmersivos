# Sonido ambiental del aula

Coloca aqui el archivo de sonido ambiental con este nombre:

```text
aula-ambiente.mp3
```

Ruta final esperada por el proyecto:

```text
public/assets/audio/ambient/aula-ambiente.mp3
```

En tiempo de ejecucion se carga asi:

```text
/assets/audio/ambient/aula-ambiente.mp3
```

Recomendaciones:

- Usa un audio corto o mediano que pueda repetirse en bucle sin cortes bruscos.
- Formatos recomendados: `.mp3`, `.ogg` o `.wav`.
- Si tu archivo tiene otro nombre o formato, cambia la ruta `roomTone` en `src/audio/AudioConfig.ts`.
- Si el archivo no existe todavia, el proyecto seguira funcionando con el sonido ambiental procedural.
