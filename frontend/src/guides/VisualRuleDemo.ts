import type { WorldTheme } from '../ui/ScenarioPresentation';

/** Illustration only: no trial events, keyboard listeners, scoring or timers. */
export function visualRuleDemo(theme: WorldTheme): string {
  if (theme === 'museum') return `<div class="ruleExample museumExample"><small>EJEMPLO · NO CUENTA PUNTOS</small><div class="demoFaces" aria-label="Dos caras sonrientes iguales y una cara diferente"><span>☺</span><span>☺</span><span class="differentFace">☹<b>✓</b></span></div><strong>Mira las tres. Elige la diferente.</strong><p>En el juego, haz clic en la cara diferente.</p></div>`;
  const classroom = theme === 'classroom';
  return `<div class="ruleExample"><small>EJEMPLO · NO CUENTA PUNTOS</small><div class="rulePair"><div class="ruleRespond"><span class="demoStimulus ${classroom ? 'greenSignal' : ''}">${classroom ? '●' : 'X'}</span><strong>${classroom ? 'Verde' : 'Letra X'}: pulsa</strong><kbd>ESPACIO <span aria-hidden="true">☝</span></kbd></div><div class="ruleWait"><span class="demoStimulus ${classroom ? 'redSignal' : ''}">${classroom ? '●' : 'A'}</span><strong>${classroom ? 'Rojo' : 'Otra letra'}: espera</strong><span class="demoWait">✋ No pulses</span></div></div><p>Primero mira. Después decide.</p></div>`;
}
