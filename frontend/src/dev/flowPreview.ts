import { Engine } from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';
import { EvaluationJourney } from '../flow/EvaluationJourney';
import type { JourneyAnalysis } from '../flow/EvaluationJourney';
import type { ActivityResultEnvelope } from '../analysis/types/BehaviorTypes';
import type { ActivityTelemetrySink } from '../analysis/synchronization/ActivityContextAdapter';
import { ClassroomScene } from '../scenes/ClassroomScene';
import { SpaceStationScene } from '../scenes/SpaceStationScene';
import { VisualDiscriminationScene } from '../scenes/VisualDiscriminationScene';
import '../style.css';
if (!import.meta.env.DEV)
    throw new Error('Development only');
const canvas = document.querySelector<HTMLCanvasElement>('#renderCanvas')!;
const engine = new Engine(canvas, true, { alpha: true, stencil: false, preserveDrawingBuffer: false });
let scene: Scene | null = null, telemetry: ActivityTelemetrySink | null = null, online = true;
const callbacks = new Set<(result: ActivityResultEnvelope) => void>(), queue: ActivityResultEnvelope[] = [];
const records: {
    type: string;
    scenario?: string;
    attemptId?: string;
}[] = [];
const flush = () => { if (!online)
    return false; for (const result of queue.splice(0))
    callbacks.forEach(callback => callback(result)); return true; };
const port: JourneyAnalysis = {
    getSessionId: () => '00000000-0000-4000-8000-000000000001',
    setActiveScenario: (id, activity, attemptId) => {
        records.push({ type: 'started', scenario: id, attemptId });
        return { onStateChange: () => { }, onBlockStart: () => { }, onTrialStart: () => { }, onTrialEnd: () => { }, onDistractor: () => { }, onActivityResult: result => { queue.push({ resultId: crypto.randomUUID(), scenarioId: id, activityId: activity, attemptId, completedAt: new Date().toISOString(), result }); queueMicrotask(flush); } };
    },
    clearActiveScenario: () => { }, interruptActivity: reason => { records.push({ type: reason }); },
    onResultSaved: callback => { callbacks.add(callback); return () => callbacks.delete(callback); },
    flushPending: async () => flush(), finishEvaluation: async () => { records.push({ type: 'finish-session' }); return { dataFlushed: flush(), sessionFinished: online }; }
};
const journey = new EvaluationJourney(engine, canvas, port, (id, sink, onExit) => { telemetry = sink; return id === 'classroom' ? new ClassroomScene(engine, canvas, onExit, sink) : id === 'space-station' ? new SpaceStationScene(engine, canvas, onExit, sink) : new VisualDiscriminationScene(engine, canvas, onExit, sink); }, value => { scene = value; }, sessionId => { const output = document.createElement('section'); output.className = 'specialistLogin'; output.textContent = `Revisión sintética finalizada. El acceso real requiere autenticación del servidor. Sesión ficticia: ${sessionId}`; document.body.append(output); });
const review = document.createElement('details');
review.style.cssText = 'position:fixed;left:50%;top:0;transform:translateX(-50%);z-index:200;background:#fffdf5;border-radius:10px;padding:8px;font:12px system-ui;max-height:55vh;overflow:auto;max-width:75vw';
review.innerHTML = '<summary>Revisión local · SIN cámaras ni datos reales</summary><p>Las finalizaciones de estos botones son simuladas. No verifican la ejecución científica de los bloques.</p><button id="review-complete">Simular fin con guardado correcto</button><button id="review-offline">Simular desconexión</button><button id="review-online">Restablecer conexión y guardar</button><pre id="journey-diagnostics"></pre>';
review.querySelector('#review-complete')!.addEventListener('click', () => { telemetry?.onActivityResult({ reviewFixture: true }); review.open = false; });
review.querySelector('#review-offline')!.addEventListener('click', () => { online = false; });
review.querySelector('#review-online')!.addEventListener('click', () => { online = true; flush(); review.open = false; });
document.body.append(review);
setInterval(() => { review.querySelector('pre')!.textContent = JSON.stringify({ state: journey.flow.state, progress: journey.flow.progress, records, meshes: scene?.meshes.length ?? 0, scenes: engine.scenes.length, queued: queue.length }, null, 2); }, 250);
engine.runRenderLoop(() => scene?.render());
window.addEventListener('resize', () => engine.resize());
window.addEventListener('beforeunload', () => { journey.dispose(); engine.dispose(); });
journey.start();
