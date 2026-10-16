import { Camera } from '@babylonjs/core';
import type { Observer, Scene } from '@babylonjs/core';
import { GUIDE_CONFIG, guideClips } from './GuideSceneConfiguration';
import type { GuideQuality } from './GuideSceneConfiguration';
import { GuideCharacter } from './GuideCharacter';
import { CharacterAnimationController } from './CharacterAnimationController';
import { SpeechPlaybackService } from './SpeechPlaybackService';
import type { PlaybackState } from './SpeechPlaybackService';
import { LipSyncController } from './LipSyncController';
import { TutorialFlowController } from './TutorialFlowController';
import { guideNarrationLog } from './GuideNarrationLog';
import { worldIcon } from '../ui/ScenarioPresentation';
import type { WorldTheme } from '../ui/ScenarioPresentation';
import './guide.css';

export interface VirtualGuideOptions {
  theme: WorldTheme;
  beforeOpen: () => void;
  onClose: () => void;
  onMenu: () => void;
  onComplete: () => void;
  quality?: GuideQuality;
}
export class VirtualGuideManager {
  private readonly speech = new SpeechPlaybackService();
  private readonly lip = new LipSyncController();
  private character: GuideCharacter | null = null;
  private animation: CharacterAnimationController | null = null;
  private observer: Observer<Scene> | null = null;
  private root: HTMLElement | null = null;
  private previousFocus: HTMLElement | null = null;
  private flow: TutorialFlowController | null = null;
  private readonly clips;
  private disposed = false;
  private modelReady = false;
  private pendingNarration = false;
  private portraitProjection: { camera: Camera; fov: number; mode: number } | null = null;
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private readonly keyboardGuard = (event: KeyboardEvent): void => {
    if (!this.root) return;
    if (event.code === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); this.close(); return; }
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyQ'].includes(event.code)) { event.stopImmediatePropagation(); }
    if (event.key === 'Tab') {
      const focusable = Array.from(this.root.querySelectorAll<HTMLElement>('button:not(:disabled), input, select'));
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  };

  constructor(privateScene: Scene, privateOptions: VirtualGuideOptions) {
    this.scene = privateScene; this.options = privateOptions;
    this.clips = guideClips(privateOptions.theme);
    this.speech.onChange = state => this.onPlayback(state);
  }
  private readonly scene: Scene;
  private readonly options: VirtualGuideOptions;
  get isOpen(): boolean { return this.root !== null; }
  setQuality(quality: GuideQuality): void { if (!this.root) this.options.quality = quality; }

  open(): void {
    if (this.disposed || this.root) return;
    this.options.beforeOpen();
    const camera = this.scene.activeCamera;
    if (camera) this.portraitProjection = { camera, fov: camera.fov, mode: camera.fovMode };
    this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const hud = document.getElementById('explorationHud');
    if (hud) { hud.inert = true; hud.style.visibility = 'hidden'; }
    const config = GUIDE_CONFIG[this.options.theme];
    this.character = new GuideCharacter(this.scene, this.options.theme, this.options.quality ?? 'balanced');
    this.animation = new CharacterAnimationController(this.character, this.reducedMotion);
    this.character.root.setEnabled(true);
    this.flow = new TutorialFlowController(this.clips.length);
    const root = document.createElement('section'); this.root = root;
    root.className = 'guideOverlay is-loading-model'; root.dataset.theme = this.options.theme;
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'guide-title');
    root.innerHTML = `
      <div class="guideTop"><span class="guideBrand">${worldIcon('help')} CONOCE A TU GUÍA</span><button type="button" data-action="menu">${worldIcon('home')} Menú</button></div>
      <div class="guidePortraitLabel"><span class="guideName">${config.name}</span><span>${config.role}</span><span class="guideTalking" aria-hidden="true"><i></i><i></i><i></i><i></i></span></div>
      <article class="guideCard">
        <div class="guideProgress" aria-label="Progreso de la explicación"></div>
        <h1 id="guide-title" tabindex="-1"></h1><p class="guideTranscript"></p>
        <div class="guideDemo" aria-label="Recordatorio visual de la regla"></div>
        <p class="guidePlaybackStatus" role="status" aria-live="polite"></p>
        <div class="guideAudioControls"><button type="button" data-action="repeat">${worldIcon('sound')} Escuchar otra vez</button><button type="button" data-action="mute" aria-pressed="false">Silenciar voz</button><label>Volumen<input type="range" min="0" max="1" step="0.05" value="0.85" aria-label="Volumen del guía"></label></div>
        <button type="button" class="guideNext" data-action="next">Continuar ${worldIcon('arrow')}</button>
        <div class="guideSecondary"><button type="button" data-action="written">Continuar leyendo, sin voz</button><button type="button" data-action="close">Volver a explorar</button></div>
      </article>`;
    root.addEventListener('click', event => {
      const action = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-action]')?.dataset.action;
      if (action === 'repeat') this.playCurrent();
      else if (action === 'next') this.advance();
      else if (action === 'close') this.close();
      else if (action === 'menu') { this.close(); this.options.onMenu(); }
      else if (action === 'written') {
        this.pendingNarration = false;
        this.speech.stop(); this.flow?.acknowledge();
        guideNarrationLog.record('written-fallback', this.clips[this.flow!.index]!.id);
        this.animation?.setState('WAITING'); this.updateControls('Instrucciones escritas. Continúa cuando las hayas leído.');
      } else if (action === 'mute') {
        const muted = !this.speech.snapshot().muted; this.speech.setMuted(muted);
        const button = root.querySelector<HTMLButtonElement>('[data-action="mute"]')!;
        button.setAttribute('aria-pressed', String(muted)); button.textContent = muted ? 'Activar voz' : 'Silenciar voz';
        this.onPlayback(this.speech.snapshot().state);
      }
    });
    root.querySelector('input')!.addEventListener('input', event => { this.speech.setVolume(Number((event.target as HTMLInputElement).value)); this.onPlayback(this.speech.snapshot().state); });
    document.body.append(root);
    document.addEventListener('keydown', this.keyboardGuard, true);
    this.observer = this.scene.onBeforeRenderObservable.add(() => this.updateCharacter());
    const character = this.character;
    void character.ready.then(() => {
      if (!this.root || this.character !== character) return;
      this.modelReady = true;
      this.root.classList.remove('is-loading-model');
      if (this.pendingNarration) this.playCurrent();
    }).catch(() => {
      if (this.root && this.character === character) {
        this.root.classList.remove('is-loading-model');
        this.updateControls('No se pudo cargar el personaje. Puedes continuar con las instrucciones escritas.');
      }
    });
    this.renderClip();
  }
  close(): void {
    if (!this.root) return;
    this.root.remove(); this.root = null;
    this.modelReady = false; this.pendingNarration = false;
    this.speech.stop();
    if (this.observer) this.scene.onBeforeRenderObservable.remove(this.observer);
    this.observer = null;
    this.character?.dispose(); this.character = null; this.animation = null;
    if (this.portraitProjection) {
      const { camera, fov, mode } = this.portraitProjection;
      camera.fov = fov; camera.fovMode = mode; this.portraitProjection = null;
    }
    document.removeEventListener('keydown', this.keyboardGuard, true);
    const hud = document.getElementById('explorationHud');
    if (hud) { hud.inert = false; hud.style.visibility = ''; }
    this.previousFocus?.focus(); this.previousFocus = null;
    this.options.onClose();
  }
  dispose(): void { if (this.disposed) return; this.close(); this.disposed = true; this.speech.dispose(); this.lip.dispose(); }
  private playCurrent(): void {
    if (!this.flow || !this.root) return;
    this.pendingNarration = true;
    if (!this.modelReady) { this.updateControls('Preparando a tu guía… Puedes usar las instrucciones escritas.'); return; }
    this.pendingNarration = false;
    const clip = this.clips[this.flow.index]!;
    this.flow.restartClip(); this.animation?.setState(clip.state);
    void this.lip.load(clip.id); this.speech.play(clip);
  }
  private renderClip(): void {
    const root = this.root!, index = this.flow!.index, clip = this.clips[index]!;
    root.querySelector('h1')!.textContent = clip.title;
    root.querySelector('.guideTranscript')!.textContent = clip.text;
    root.querySelector('.guideProgress')!.innerHTML = this.clips.map((_, i) => `<span class="${i <= index ? 'is-current' : ''}" aria-hidden="true"></span>`).join('') + `<small>${index + 1} de ${this.clips.length}</small>`;
    const demo = root.querySelector<HTMLElement>('.guideDemo')!;
    demo.hidden = index === 0 || index === this.clips.length - 1;
    // Static rule reminders, never extra trials or invented face stimuli.
    demo.innerHTML = this.options.theme === 'classroom'
      ? '<span><i class="guideGreen"></i> Verde <b>ESPACIO</b></span><span><i class="guideRed"></i> Rojo <b>ESPERA</b></span>'
      : this.options.theme === 'space'
        ? '<span><i class="guideTarget">X</i><b>ESPACIO</b></span><span>Otras letras <b>ESPERA</b></span>'
        : '<span><b>1 · OBSERVA</b> Mira las tres caras</span><span><b>2 · COMPARA</b> Dos son iguales</span><span><b>3 · ELIGE</b> Haz clic en la diferente</span>';
    root.querySelector('h1')!.focus();
    this.playCurrent();
  }
  private onPlayback(state: PlaybackState): void {
    if (!this.root) return;
    if (state === 'complete') { this.flow?.acknowledge(); this.animation?.setState('WAITING'); }
    this.root.classList.toggle('is-speaking', state === 'playing' && !this.speech.snapshot().muted);
    const silent = this.speech.snapshot().muted || this.speech.snapshot().volume === 0;
    const status = state === 'loading' ? 'Preparando la voz…' : state === 'playing' ? silent ? 'Voz silenciada. Las instrucciones siguen en pantalla.' : 'Escucha a tu guía…' : state === 'complete' ? '¿Lo escuchamos otra vez o continuamos?' : state === 'error' ? 'No se pudo reproducir la voz. Reintenta o usa las instrucciones escritas.' : '';
    this.updateControls(status);
  }
  private updateControls(status: string): void {
    if (!this.root || !this.flow) return;
    this.root.querySelector('.guidePlaybackStatus')!.textContent = status;
    const next = this.root.querySelector<HTMLButtonElement>('[data-action="next"]')!;
    next.disabled = !this.flow.acknowledged;
    next.innerHTML = `${this.flow.index === this.clips.length - 1 ? 'Ir a las instrucciones' : 'Continuar'} ${worldIcon('arrow')}`;
  }
  private advance(): void {
    if (!this.flow) return;
    const state = this.speech.snapshot().state;
    const result = this.flow.next(state === 'playing' || state === 'loading');
    if (result === 'complete') { this.close(); this.options.onComplete(); }
    else if (result === 'next') this.renderClip();
  }
  private updateCharacter(): void {
    const camera = this.scene.activeCamera, character = this.character;
    if (!camera || !character) return;
    character.root.parent = camera;
    const compact = window.innerWidth <= 760;
    // Avoid the extreme vertical perspective of a horizontal-FOV world on a narrow screen.
    // This belongs only to the tutorial portrait and is restored before leaving it.
    if (this.portraitProjection?.camera === camera) {
      camera.fovMode = compact ? Camera.FOVMODE_VERTICAL_FIXED : this.portraitProjection.mode;
      camera.fov = compact ? 1 : this.portraitProjection.fov;
    }
    const projection = camera.getProjectionMatrix().m, z = 2.5;
    const height = compact ? .31 : .66;
    const scale = 2 * z * height / (projection[5]! * 1.9);
    character.root.scaling.setAll(scale);
    character.root.position.set(compact ? 0 : z * .49 / projection[0]!, z * (compact ? .12 : -.66) / projection[5]!, z);
    const snapshot = this.speech.snapshot();
    if (this.modelReady) this.animation?.update(this.scene.getEngine().getDeltaTime() / 1000, this.lip.amplitude(snapshot), snapshot.state === 'playing' && !snapshot.muted && snapshot.volume > 0, snapshot.currentTime, this.lip.pose(snapshot));
    this.root?.classList.toggle('is-speaking', snapshot.state === 'playing' && !snapshot.muted && snapshot.volume > 0);
  }
}
