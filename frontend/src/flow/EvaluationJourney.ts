import type { Engine, Scene } from '@babylonjs/core';
import type { ActivityTelemetrySink } from '../analysis/synchronization/ActivityContextAdapter';
import type { ActivityResultEnvelope } from '../analysis/types/BehaviorTypes';
import { createScenarioSelector } from '../ui/ScenarioSelector';
import type { ScenarioId } from '../ui/ScenarioPresentation';
import { EvaluationFlow } from './EvaluationFlow';
import { MenuHost } from './MenuHost';
import './flow.css';
export interface JourneyAnalysis {
    getSessionId(): string | null;
    setActiveScenario(id: string, activity: string, attemptId?: string): ActivityTelemetrySink;
    clearActiveScenario(): void;
    interruptActivity(reason: string): void;
    onResultSaved(listener: (result: ActivityResultEnvelope) => void): () => void;
    flushPending(): Promise<boolean>;
    finishEvaluation(): Promise<{
        dataFlushed: boolean;
        sessionFinished: boolean;
    }>;
}
export interface JourneyScenario {
    create(): Scene;
    dispose(): void;
}
const activityIds: Record<ScenarioId, string> = { 'classroom': 'go-no-go', 'space-station': 'cpt', 'interactive-museum': 'visual-discrimination' };
export class EvaluationJourney {
    readonly flow: EvaluationFlow;
    private scenario: JourneyScenario | null = null;
    private host: MenuHost | null = null;
    private menu: HTMLElement | null = null;
    private navigation: HTMLButtonElement | null = null;
    private confirmation: HTMLElement | null = null;
    private closing: Promise<void> | null = null;
    private disposed = false;
    private message = 'Elige una aventura. Primero vas a practicar.';
    private readonly unsubscribe: () => void;
    private readonly engine: Engine;
    private readonly canvas: HTMLCanvasElement;
    private readonly analysis: JourneyAnalysis;
    private readonly createScenario: (id: ScenarioId, telemetry: ActivityTelemetrySink, onExit: () => void) => JourneyScenario;
    private readonly setScene: (scene: Scene | null) => void;
    private readonly openResults: (sessionId: string) => void;
    constructor(engine: Engine, canvas: HTMLCanvasElement, analysis: JourneyAnalysis, createScenario: (id: ScenarioId, telemetry: ActivityTelemetrySink, onExit: () => void) => JourneyScenario, setScene: (scene: Scene | null) => void, openResults: (sessionId: string) => void) {
        this.engine = engine;
        this.canvas = canvas;
        this.analysis = analysis;
        this.createScenario = createScenario;
        this.setScene = setScene;
        this.openResults = openResults;
        const sessionId = analysis.getSessionId();
        if (!sessionId)
            throw new Error('No hay una sesión de evaluación preparada.');
        this.flow = new EvaluationFlow(sessionId);
        this.unsubscribe = analysis.onResultSaved(result => {
            if (this.disposed || !result.attemptId || !(result.scenarioId in activityIds))
                return;
            if (this.flow.saved(result.scenarioId as ScenarioId, result.attemptId)) {
                if (!this.scenario && !this.host) {
                    this.showMenu();
                    void this.maybeFinish();
                }
            }
        });
    }
    start(): void { this.flow.menu(); this.showMenu(); if (this.flow.welcome())
        this.showHost('welcome'); }
    private showMenu(): void {
        this.menu?.remove();
        this.menu = createScenarioSelector(id => this.startActivity(id), () => void this.maybeFinish(), { progress: this.flow.progress, message: this.message, onHelp: () => this.showHost('welcome'), busy: !!this.closing });
        document.body.append(this.menu);
    }
    startActivity(id: ScenarioId): void {
        if (this.disposed)
            return;
        const attemptId = this.flow.start(id);
        if (!attemptId)
            return;
        this.menu?.remove();
        this.menu = null;
        this.host?.dispose();
        this.host = null;
        document.body.dataset.activityActive = 'true';
        const base = this.analysis.setActiveScenario(id, activityIds[id], attemptId);
        let produced = false;
        const current = () => !this.disposed && this.flow.matches(id, attemptId) && !produced;
        const telemetry: ActivityTelemetrySink = {
            onStateChange: state => { if (current()) {
                base.onStateChange(state);
                this.flow.phase(id, attemptId, state);
            } },
            onBlockStart: block => { if (current())
                base.onBlockStart(block); },
            onTrialStart: trial => { if (current())
                base.onTrialStart(trial); },
            onTrialEnd: () => { if (current())
                base.onTrialEnd(); },
            onDistractor: event => { if (current())
                base.onDistractor(event); },
            onActivityResult: result => {
                if (!current() || !this.flow.produced(id, attemptId))
                    return;
                produced = true;
                base.onActivityResult(result);
                // Let the task finish its own synchronous finalization before disposing its scene.
                queueMicrotask(() => {
                    if (this.disposed || this.flow.active !== id || this.flow.progress[id].attemptId !== attemptId)
                        return;
                    this.cleanupScenario();
                    this.analysis.clearActiveScenario();
                    this.flow.menu();
                    this.message = '¡Terminaste esta aventura! Puedes elegir otra.';
                    this.showMenu();
                    void this.maybeFinish();
                    void this.analysis.flushPending().then(saved => { if (!saved && !this.disposed && !this.scenario && !this.host) {
                        this.message = 'Tu aventura terminó. Estamos guardándola; puedes elegir otra mientras tanto.';
                        this.showMenu();
                    } });
                });
            }
        };
        this.navigation = document.createElement('button');
        this.navigation.type = 'button';
        this.navigation.className = 'activityExit';
        this.navigation.textContent = '← Volver al menú';
        this.navigation.setAttribute('aria-label', 'Volver al menú de actividades');
        this.navigation.addEventListener('click', () => this.requestExit());
        document.body.append(this.navigation);
        try {
            this.scenario = this.createScenario(id, telemetry, () => this.requestExit());
            this.setScene(this.scenario.create());
            this.flow.phase(id, attemptId, 'exploring');
            this.canvas.focus();
        }
        catch (error) {
            console.error('No se pudo abrir la aventura', error);
            this.analysis.interruptActivity('technical-error');
            this.flow.interrupt(true);
            this.cleanupScenario();
            this.flow.menu();
            this.message = 'No pudimos abrir esta aventura. Puedes intentarlo otra vez.';
            this.showMenu();
        }
    }
    requestExit(): void {
        if (this.confirmation || !this.scenario)
            return;
        const previous = this.flow.state;
        const stopped = this.flow.interrupt();
        if (!stopped)
            return;
        // Stop first: opening a modal must never let hidden trials continue accepting responses.
        this.analysis.interruptActivity('exit-requested');
        this.cleanupScenario();
        this.confirmation = document.createElement('div');
        this.confirmation.className = 'flowShade';
        this.confirmation.innerHTML = `<section class="flowDialog" role="dialog" aria-modal="true" aria-labelledby="exitTitle"><h2 id="exitTitle">¿Quieres volver al menú?</h2><p>Esta actividad todavía no ha terminado.</p><p>${previous === 'ACTIVITY_EVALUATION' || previous === 'ACTIVITY_PRACTICE' ? 'La partida se detuvo. Para seguir jugando, comenzaremos esta aventura de nuevo.' : 'Puedes volver al menú o empezar esta aventura de nuevo.'}</p><button type="button" data-exit="restart">Empezar de nuevo</button><button type="button" data-exit="menu">Volver al menú</button></section>`;
        const close = () => { this.confirmation?.remove(); this.confirmation = null; this.flow.menu(); };
        this.confirmation.querySelector('[data-exit=restart]')!.addEventListener('click', () => { close(); this.startActivity(stopped.id); });
        this.confirmation.querySelector('[data-exit=menu]')!.addEventListener('click', () => { close(); this.message = 'Puedes elegir otra aventura o volver a intentarlo.'; this.showMenu(); void this.analysis.flushPending(); });
        this.confirmation.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                event.preventDefault();
                close();
                this.message = 'La aventura quedó interrumpida. Puedes empezarla de nuevo.';
                this.showMenu();
            }
            if (event.key === 'Tab') {
                event.preventDefault();
                const buttons = this.confirmation!.querySelectorAll<HTMLButtonElement>('button');
                (document.activeElement === buttons[0] ? buttons[1] : buttons[0])!.focus();
            }
        });
        document.body.append(this.confirmation);
        (this.confirmation.querySelector('[data-exit=restart]') as HTMLElement).focus();
    }
    private cleanupScenario(): void { this.setScene(null); this.scenario?.dispose(); this.scenario = null; this.navigation?.remove(); this.navigation = null; delete document.body.dataset.activityActive; }
    private showHost(message: 'welcome' | 'farewell'): void {
        if (this.host || this.scenario || this.disposed)
            return;
        if (message === 'welcome')
            this.flow.state = 'MENU_WELCOME';
        this.menu?.setAttribute('inert', '');
        this.host = new MenuHost(this.engine, this.canvas, message, () => {
            this.host = null;
            this.setScene(null);
            this.menu?.removeAttribute('inert');
            if (message === 'farewell') {
                this.flow.state = 'SESSION_FINISHED';
                this.showFinished();
            }
            else {
                this.flow.menu();
                (this.menu?.querySelector('button:not(:disabled)') as HTMLElement | null)?.focus();
            }
        });
        this.setScene(this.host.scene);
    }
    private async maybeFinish(): Promise<void> {
        if (this.closing || this.host || this.scenario || !this.flow.allCompleted() || this.flow.state === 'SESSION_FINISHED' || this.flow.state === 'SPECIALIST_RESULTS' || this.disposed)
            return;
        this.closing = this.closeSession();
        this.showMenu();
        try {
            await this.closing;
        }
        finally {
            this.closing = null;
            if (!this.host && !this.disposed && this.flow.state === 'MENU_READY')
                this.showMenu();
        }
    }
    private async closeSession(): Promise<void> {
        this.message = '¡Completaste las tres aventuras! Un momento y nos despedimos.';
        try {
            const result = await this.analysis.finishEvaluation();
            if (this.disposed)
                return;
            if (this.flow.beginFarewell(result.dataFlushed && result.sessionFinished)) {
                this.showMenu();
                this.showHost('farewell');
            }
            else {
                this.message = 'Ya terminamos los juegos. Pide a quien te acompaña que seleccione «Guardar y finalizar».';
            }
        }
        catch {
            this.message = 'Ya terminamos los juegos. Pide a quien te acompaña que nos ayude a guardar y finalizar.';
        }
    }
    private showFinished(): void {
        this.menu?.remove();
        this.menu = document.createElement('main');
        this.menu.className = 'sessionFinish';
        this.menu.id = 'journeyFinished';
        this.menu.innerHTML = '<section><span aria-hidden="true" style="font-size:64px">✦</span><h1>¡Gracias por participar!</h1><p>Ya terminamos nuestros juegos.<br>Ahora puedes descansar.</p><details><summary>Espacio para el especialista</summary><p>Los registros están asociados a esta evaluación. Se requiere iniciar sesión para consultar los indicadores.</p><button type="button">Ver indicadores de evaluación</button></details></section>';
        this.menu.querySelector('button')!.addEventListener('click', () => { this.flow.state = 'SPECIALIST_RESULTS'; this.menu?.remove(); this.openResults(this.flow.sessionId); });
        document.body.append(this.menu);
    }
    dispose(): void { this.disposed = true; this.unsubscribe(); this.host?.dispose(); this.host = null; this.cleanupScenario(); this.menu?.remove(); this.confirmation?.remove(); }
}
