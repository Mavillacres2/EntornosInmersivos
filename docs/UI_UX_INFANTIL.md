# UI/UX de los escenarios para niños de 6 a 9 años

Revisión y aplicación: 15 de octubre de 2026.

## Hallazgos y cambios aplicados

| Hallazgo | Cambio | Propósito |
| --- | --- | --- |
| El panel mezclaba instrucciones, audio, navegación y comienzo del juego. | Barra superior para sonido y menú; tarjeta inferior para explorar, jugar y consultar ayuda. | Facilitar que el niño identifique su siguiente acción. |
| Instrucciones largas y vocabulario técnico. | Frases breves, tres pasos numerados, teclas dibujadas y nombres de actividades sencillos. | Reducir la lectura necesaria para empezar. |
| Mundos poco diferenciados en el menú. | Ilustraciones SVG propias, símbolo y color consistente para cada mundo. | Reconocer el escenario antes y después de entrar. |
| El panel permanecía delante del mundo al mirar alrededor. | Se oculta al capturar el ratón y aparece una indicación de Esc; vuelve al liberarlo. | Dejar espacio para explorar y explicar cómo recuperar los botones. |
| Las cuadrículas oscuras dominaban visualmente los suelos. | Juntas más finas y colores de menor contraste; alfombras y medallones estáticos. | Dar más protagonismo a muebles, objetos y personajes. |
| El encuadre vertical recortaba el mundo y algunas instrucciones en ventanas estrechas. | Campo de visión horizontal estable al explorar y un mínimo de cobertura horizontal en evaluación; ajuste del título del museo al ancho de su textura. | Mantener visibles las referencias del entorno y el panel de la actividad. |
| El sonido se reactivaba al cambiar de escenario. | Preferencia de sonido de exploración guardada localmente. | Respetar la elección del niño entre mundos. |
| Las flechas podían mover la cámara al usar la ayuda con teclado. | Los controles de exploración no interceptan teclas cuando el foco está dentro de la interfaz. | Conservar la navegación normal con teclado. |
| La transición de cámara siempre se animaba. | Se respeta `prefers-reduced-motion` en la transición y en la interfaz. | Permitir una presentación con menos movimiento. |

Los controles principales tienen una altura mínima de 48 px, con texto e iconos juntos, foco visible y estados de preparación. Las decoraciones nuevas de exploración y su interfaz se retiran al comenzar la evaluación. Se conservan los parámetros de ensayos, objetivos, tiempos, registros y condiciones de distractores.

## Fuentes y aplicación

- [UNICEF — RITEC Design Toolbox](https://www.unicef.org/childrightsandbusiness/workstreams/responsible-technology/online-gaming/ritec-design-toolbox): marco para considerar autonomía, competencia y bienestar en el diseño del juego. Aplicación: elección explícita entre explorar o empezar, tono tranquilo y control de sonido. El marco incluye investigación centrada especialmente en edades de 8 a 12 años; orienta el diseño, pero no valida por sí solo su idoneidad para 6 a 9 años.
- [W3C — Use Icons that Help the User](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o1p07-icons-used/): iconos familiares cerca del texto que explican. Aplicación: libro, planeta, ayuda, casa y sonido acompañados de etiquetas; se evita depender solo del color.
- [Microsoft — Xbox Accessibility Guideline 101](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/101): legibilidad de textos e interfaz de juego. Aplicación: textos cortos, contraste claro, títulos que caben y ayuda separada en pasos. Estas mejoras no constituyen una certificación de accesibilidad.

## Verificación y siguiente validación

La revisión técnica comprueba compilación, pruebas existentes y navegación real en el navegador: abrir mundos, desplegar ayuda, cambiar sonido, volver al menú e iniciar la práctica. Los componentes de menú y controles utilizados en la revisión son los mismos que importa la aplicación.

Falta validar la comprensión con niños de 6 a 9 años: observar si pueden elegir un mundo, encontrar la ayuda, explorar, liberar el ratón y empezar la práctica con poca intervención adulta. Esa prueba permitirá ajustar vocabulario, tamaño de controles y cantidad de información. No se afirma que esta versión haya sido validada con niños.
