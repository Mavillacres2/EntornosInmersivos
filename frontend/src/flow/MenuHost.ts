import { Color3, Color4, DirectionalLight, HemisphericLight, MeshBuilder, Quaternion, Scene, ShadowGenerator, StandardMaterial, UniversalCamera, Vector3 } from '@babylonjs/core';
import type { Engine } from '@babylonjs/core';
import { GuideCharacter } from '../guides/GuideCharacter';
import { CharacterAnimationController } from '../guides/CharacterAnimationController';
import { SpeechPlaybackService } from '../guides/SpeechPlaybackService';
import { LipSyncController } from '../guides/LipSyncController';
import type { GuideClip } from '../guides/GuideSceneConfiguration';
import narration from '../guides/host-narration.es.json';
import { getExplorationQuality } from '../ui/ExplorationQuality';
import './flow.css';
export type HostMessage = 'welcome' | 'farewell';
/** Uses the application's engine/render loop. Owns exactly one temporary scene and voice. */
export class MenuHost {
    readonly scene: Scene;
    private readonly character: GuideCharacter;
    private readonly speech = new SpeechPlaybackService(narration.version);
    private readonly lip = new LipSyncController(narration.version);
    private readonly root: HTMLElement;
    private readonly clip: GuideClip;
    private phase: 'entering' | 'talking' | 'leaving' = 'entering';
    private phaseStart = performance.now();
    private lastFrame = performance.now();
    private loaded = false;
    private disposed = false;
    private readonly deadline: ReturnType<typeof setTimeout>;
    private readonly previousFocus = document.activeElement as HTMLElement | null;
    private readonly onKey = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            this.leave();
        }
        if (event.key === 'Tab') {
            const controls = Array.from(this.root.querySelectorAll<HTMLElement>('button,input'));
            const first = controls[0], last = controls.at(-1);
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last?.focus();
            }
            else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
            }
        }
    };
    private readonly canvas: HTMLCanvasElement;
    private readonly done: () => void;
    constructor(engine: Engine, canvas: HTMLCanvasElement, message: HostMessage, done: () => void) {
        this.canvas = canvas;
        this.done = done;
        this.clip = narration.host[message === 'welcome' ? 0 : 1] as GuideClip;
        this.scene = new Scene(engine);
        this.scene.clearColor = new Color4(0, 0, 0, 0);
        const camera = new UniversalCamera('menu-host-camera', new Vector3(0, 0, 0), this.scene);
        camera.setTarget(new Vector3(0, 0, 1));
        camera.fov = .8;
        camera.minZ = .1;
        this.scene.activeCamera = camera;
        const fill = new HemisphericLight('host-stage-fill', new Vector3(0, 1, -1), this.scene);
        fill.intensity = .8;
        const key = new DirectionalLight('host-stage-key', new Vector3(.4, -1, .5), this.scene);
        key.position.set(-2, 4, -1);
        key.intensity = .8;
        const shadow = new ShadowGenerator(512, key);
        shadow.useBlurExponentialShadowMap = true;
        shadow.blurKernel = 16;
        const floor = MeshBuilder.CreateGround('host-stage', { width: 8, height: 12 }, this.scene);
        floor.position.y = -.93;
        floor.receiveShadows = true;
        const material = new StandardMaterial('host-stage-matte', this.scene);
        material.diffuseColor = Color3.FromHexString('#abcbbb');
        material.alpha = .14;
        material.specularColor = Color3.Black();
        floor.material = material;
        this.character = new GuideCharacter(this.scene, 'classroom', getExplorationQuality());
        const animation = new CharacterAnimationController(this.character, matchMedia('(prefers-reduced-motion: reduce)').matches);
        const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
        const duration = reduced ? .25 : 1.8;
        const x = () => innerWidth < 700 ? 0 : .95;
        this.root = document.createElement('section');
        this.root.className = 'menuHost';
        this.root.setAttribute('role', 'dialog');
        this.root.setAttribute('aria-modal', 'true');
        this.root.setAttribute('aria-label', this.clip.title);
        this.root.innerHTML = `<article class="hostMessage"><span class="hostEyebrow">LUMA · TU COMPAÑERA DE AVENTURAS</span><h1></h1><p class="hostTranscript"></p><p class="hostStatus" role="status">Preparando a Luma… Puedes continuar cuando quieras.</p><div class="hostControls"><button type="button" data-host="repeat">Escuchar otra vez</button><button type="button" data-host="mute" aria-pressed="false">Silenciar voz</button><label>Volumen<input type="range" aria-label="Volumen de Luma" min="0" max="1" step=".05" value=".85"></label></div><button class="hostContinue" type="button">${message === 'welcome' ? 'Elegir una aventura' : 'Continuar'}</button><button class="hostSkip" type="button">Omitir animación</button></article><p class="hostName" aria-hidden="true">Luma<span>Tu compañera de aventuras</span></p>`;
        this.root.querySelector('h1')!.textContent = this.clip.title;
        this.root.querySelector('.hostTranscript')!.textContent = this.clip.text;
        document.body.append(this.root);
        canvas.classList.add('hostCanvas');
        const repeat = this.root.querySelector<HTMLButtonElement>('[data-host=repeat]')!;
        repeat.disabled = true;
        this.root.querySelector('.hostContinue')!.addEventListener('click', () => this.leave());
        this.root.querySelector('.hostSkip')!.addEventListener('click', () => this.finish());
        this.root.querySelector('[data-host=repeat]')!.addEventListener('click', () => { if (this.phase === 'leaving')
            return; animation.setState(message === 'welcome' ? 'GREETING' : 'FAREWELL'); this.speech.play(this.clip); });
        this.root.querySelector('[data-host=mute]')!.addEventListener('click', event => { const muted = !this.speech.snapshot().muted; this.speech.setMuted(muted); const button = event.currentTarget as HTMLButtonElement; button.textContent = muted ? 'Activar voz' : 'Silenciar voz'; button.setAttribute('aria-pressed', String(muted)); });
        this.root.querySelector('input')!.addEventListener('input', event => this.speech.setVolume(Number((event.target as HTMLInputElement).value)));
        this.speech.onChange = state => {
            if (this.disposed || this.phase === 'leaving')
                return;
            this.status(state === 'playing' ? 'Escucha a Luma…' : state === 'error' ? 'Puedes leer el mensaje o continuar.' : state === 'complete' ? '¡Vamos!' : 'Preparando la voz…');
            if (state === 'complete')
                this.leave();
        };
        void this.lip.load(this.clip.id);
        void this.character.ready.then(() => {
            if (this.disposed)
                return;
            this.loaded = true;
            this.character.root.setEnabled(true);
            this.phaseStart = performance.now();
            this.character.meshes.forEach(mesh => shadow.addShadowCaster(mesh));
            animation.setState(message === 'welcome' ? 'GREETING' : 'FAREWELL');
        }).catch(() => { if (!this.disposed) {
            repeat.disabled = false;
            this.status('Luma no pudo aparecer. Puedes leer el mensaje o continuar.');
            this.phase = 'talking';
            this.speech.play(this.clip);
        } });
        this.scene.onBeforeRenderObservable.add(() => {
            if (this.disposed || !this.loaded)
                return;
            const now = performance.now(), dt = Math.min(.1, (now - this.lastFrame) / 1000);
            this.lastFrame = now;
            const elapsed = (now - this.phaseStart) / 1000, t = Math.min(1, elapsed / duration), ease = t * t * (3 - 2 * t);
            const departing = this.phase === 'leaving', moving = this.phase !== 'talking';
            const bodyMotion = reduced ? .1 : 1;
            const approach = reduced ? .35 : 4.2;
            const depth = departing ? 3.6 + ease * (reduced ? .35 : 4.5) : this.phase === 'entering' ? 3.6 + (1 - ease) * approach : 3.6;
            const lateral = departing ? x() + ease * (reduced ? .12 : 1.4) : this.phase === 'entering' ? x() + (reduced ? .12 : 1.5) * (1 - ease) : x();
            this.character.root.position.set(lateral, innerWidth < 700 ? -.46 : -.92, depth);
            this.character.root.rotationQuaternion = Quaternion.RotationYawPitchRoll((moving ? (departing ? ease * .5 : (1 - ease) * -.45) : Math.sin(elapsed * .5) * .04) * bodyMotion, 0, 0);
            const voice = this.speech.snapshot(), amplitude = this.lip.amplitude(voice);
            animation.update(dt, amplitude, voice.state === 'playing' && !voice.muted && voice.volume > 0, voice.currentTime, this.lip.pose(voice));
            // The existing GLB has articulated hip nodes. Gentle weight shifts, not simulated walking/root motion.
            this.character.hips.forEach((hip, index) => { hip.rotationQuaternion = Quaternion.RotationYawPitchRoll(0, 0, Math.sin(elapsed * 1.1 + index * Math.PI) * .035 * bodyMotion); });
            if (message === 'farewell' && this.phase === 'talking') {
                const thanks = Math.sin(Math.min(1, Math.max(0, voice.currentTime - 3) / 3) * Math.PI) * bodyMotion;
                this.character.torso.rotationQuaternion = Quaternion.RotationYawPitchRoll(.08 * thanks + Math.sin(elapsed * .6) * .035 * bodyMotion, Math.sin(elapsed * .4) * .04 * bodyMotion, Math.sin(elapsed * .8) * .025 * bodyMotion);
                if (thanks > .01) {
                    for (const [arm, sign] of [[this.character.leftArm, -1], [this.character.rightArm, 1]] as const) {
                        const target = Quaternion.RotationYawPitchRoll(0, 0, sign * (.18 + thanks * .5));
                        Quaternion.SlerpToRef(arm.rotationQuaternion!, target, 1 - Math.exp(-dt * 5), arm.rotationQuaternion!);
                    }
                }
            }
            if (this.phase === 'entering' && t === 1) {
                this.phase = 'talking';
                this.phaseStart = now;
                repeat.disabled = false;
                this.speech.play(this.clip);
            }
            if (departing && t === 1)
                queueMicrotask(() => this.finish());
        });
        // Model/audio failure and mute never leave the child trapped in a presentation.
        this.deadline = setTimeout(() => this.finish(), 60000);
        document.addEventListener('keydown', this.onKey);
        (this.root.querySelector('.hostContinue') as HTMLElement).focus();
    }
    private status(text: string): void { this.root.querySelector('.hostStatus')!.textContent = text; }
    private leave(): void { if (this.disposed || this.phase === 'leaving')
        return; this.speech.stop(); this.phase = 'leaving'; this.phaseStart = performance.now(); if (!this.loaded)
        this.finish(); }
    private finish(): void { if (this.disposed)
        return; this.dispose(); this.done(); }
    dispose(): void {
        if (this.disposed)
            return;
        this.disposed = true;
        clearTimeout(this.deadline);
        document.removeEventListener('keydown', this.onKey);
        this.speech.dispose();
        this.lip.dispose();
        this.character.dispose();
        this.scene.dispose();
        this.root.remove();
        this.canvas.classList.remove('hostCanvas');
        this.previousFocus?.focus();
    }
}
