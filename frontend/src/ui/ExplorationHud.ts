import { WORLD_PRESENTATION, worldIcon } from "./ScenarioPresentation";
import type { WorldTheme } from "./ScenarioPresentation";
import "./world-ui.css";
import { getExplorationQuality } from './ExplorationQuality';
import type { GuideQuality } from '../guides/GuideSceneConfiguration';

interface ExplorationHudOptions {
  theme: WorldTheme;
  onExplore: () => void;
  onRelease: () => void;
  onStart: () => void;
  onSound: () => void;
  onMenu: () => void;
  onQuality?: (quality: GuideQuality) => void;
}

/** One predictable set of controls for all three worlds. Removed before evaluation. */
export class ExplorationHud {
  private readonly root: HTMLElement;
  private readonly startButton: HTMLButtonElement;
  private readonly lookButton: HTMLButtonElement;
  private readonly soundButton: HTMLButtonElement;
  private readonly menuButton: HTMLButtonElement;
  private readonly status: HTMLElement;
  private readonly help: HTMLDetailsElement;
  private locked = false;
  private busy = false;

  constructor(options: ExplorationHudOptions) {
    const world = WORLD_PRESENTATION[options.theme];
    this.root = document.createElement("section");
    this.root.id = "explorationHud";
    this.root.className = "worldHud";
    this.root.dataset.theme = options.theme;
    this.root.setAttribute("aria-label", `Exploración: ${world.name}`);
    this.root.innerHTML = `
      <header class="worldTopbar">
        <div class="worldMark"><span class="worldEmblem">${worldIcon(world.icon)}</span>
          <div><span class="worldEyebrow">NEUROEXPLORA</span><strong>${world.name}</strong></div>
        </div>
        <nav class="worldTools" aria-label="Opciones del escenario"></nav>
      </header>
      <div class="worldMission">
        <span class="worldMode">EXPLORA A TU RITMO</span>
        <h1>${world.invitation}</h1>
        <p class="worldDescription">${world.description}</p>
        <div class="worldMissionActions"></div>
        <details class="worldHelp">
          <summary>${worldIcon("help")} Cómo jugar <span class="worldHelpPlus" aria-hidden="true">+</span></summary>
          <ol>
            <li><span class="worldStep">1</span><div><strong>Camina por el mundo</strong><p>Usa <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> o las flechas <span aria-label="arriba, izquierda, abajo, derecha">↑ ← ↓ →</span>.</p></div></li>
            <li><span class="worldStep">2</span><div><strong>Mira a tu alrededor</strong><p>Elige «Explorar» y mueve el ratón. <kbd>Esc</kbd> o <kbd>Q</kbd> libera el ratón.</p></div></li>
            <li><span class="worldStep">3</span><div><strong>Empieza cuando quieras</strong><p>${world.activity} Primero practicarás.</p></div></li>
          </ol>
        </details>
        <p class="worldStatus" role="status" aria-live="polite"></p>
      </div>
      <div class="worldLookHint" aria-hidden="true">Mueve el ratón para mirar <span>·</span> <kbd>Esc</kbd> para volver a los botones</div>`;

    const tools = this.root.querySelector(".worldTools")!;
    this.soundButton = this.button("Sonido activado", "sound", "worldTool", options.onSound);
    this.soundButton.setAttribute("aria-pressed", "true");
    this.menuButton = this.button("Menú", "home", "worldTool", options.onMenu);
    this.menuButton.setAttribute("aria-label", "Volver al menú");
    tools.append(this.soundButton, this.menuButton);

    this.lookButton = this.button("Explorar", "mouse", "worldExplore", () => {
      if (this.locked) options.onRelease();
      else options.onExplore();
    });
    this.startButton = this.button("¡A jugar!", "arrow", "worldStart", options.onStart);
    this.root.querySelector(".worldMissionActions")!.append(this.lookButton, this.startButton);
    this.status = this.root.querySelector(".worldStatus")!;
    this.help = this.root.querySelector("details")!;
    if (options.onQuality) {
      const label = document.createElement('label');
      label.className = 'worldQuality';
      label.textContent = 'Calidad de exploración';
      const select = document.createElement('select');
      select.setAttribute('aria-label', 'Calidad gráfica durante la exploración');
      select.innerHTML = '<option value="low">Ligera</option><option value="balanced">Equilibrada</option><option value="high">Alta</option>';
      select.value = getExplorationQuality();
      select.addEventListener('change', () => options.onQuality?.(select.value as GuideQuality));
      label.append(select); this.help.append(label);
    }
    document.body.appendChild(this.root);
    this.setPointerLocked(false);
  }

  setPointerLocked(locked: boolean): void {
    this.locked = locked;
    this.root.classList.toggle("is-looking", locked);
    this.lookButton.innerHTML = `${worldIcon(locked ? "exit" : "mouse")}<span>${locked ? "Liberar ratón" : "Explorar"}</span>`;
    this.lookButton.setAttribute("aria-pressed", String(locked));
    if (locked) this.help.open = false;
    if (!this.busy) this.status.textContent = locked
      ? "Para usar los botones, pulsa Esc o Q."
      : "Primero practicarás. Sin prisa.";
  }

  setSoundEnabled(enabled: boolean): void {
    this.soundButton.innerHTML = `${worldIcon(enabled ? "sound" : "muted")}<span>${enabled ? "Sonido activado" : "Sin sonido"}</span>`;
    this.soundButton.setAttribute("aria-pressed", String(enabled));
  }

  showLookUnavailable(): void {
    if (!this.busy) this.status.textContent = "Para mirar, mantén pulsado el ratón sobre el mundo y arrastra.";
  }

  setBusy(): void {
    this.busy = true;
    this.root.setAttribute("aria-busy", "true");
    this.root.classList.add("is-busy");
    this.startButton.textContent = "Preparando el juego…";
    this.status.textContent = "Un momento. Vamos a practicar primero.";
    this.help.open = false;
    [this.startButton, this.lookButton, this.soundButton].forEach((button) => {
      button.disabled = true;
    });
  }

  dispose(): void {
    this.root.remove();
  }

  private button(label: string, icon: string, className: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.innerHTML = `${worldIcon(icon)}<span>${label}</span>`;
    button.addEventListener("click", onClick);
    return button;
  }
}
