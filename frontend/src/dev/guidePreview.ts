import { Engine, Vector3 } from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';
import { ClassroomScene } from '../scenes/ClassroomScene';
import { SpaceStationScene } from '../scenes/SpaceStationScene';
import { VisualDiscriminationScene } from '../scenes/VisualDiscriminationScene';
import { guideNarrationLog } from '../guides/GuideNarrationLog';
import type { WorldTheme } from '../ui/ScenarioPresentation';
import { runVisualBenchmark } from './visualBenchmark';
import { RenderingReviewRecorder } from './RenderingReviewRecorder';
import type { ActivityTelemetrySink } from '../analysis/synchronization/ActivityContextAdapter';

if (!import.meta.env.DEV) throw new Error('Preview is development-only');
document.body.style.cssText = 'margin:0;overflow:hidden;background:#233a45';
const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
canvas.style.cssText = 'display:block;width:100vw;height:100dvh;touch-action:none';
const engine = new Engine(canvas, true, { stencil: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
let scene: Scene | null = null;
let controller: ClassroomScene | SpaceStationScene | VisualDiscriminationScene | null = null;
let generation = 0;
let recorder:RenderingReviewRecorder|null=null;
const toolbar = document.createElement('details');
toolbar.style.cssText = 'position:fixed;top:4px;left:50%;transform:translateX(-50%);z-index:40;max-width:90vw;max-height:60vh;overflow:auto;background:#fffdf5;color:#203c3a;border-radius:12px;padding:9px;font:12px Segoe UI,sans-serif;box-shadow:0 3px 15px #0002';
toolbar.innerHTML = '<summary style="cursor:pointer">Revisión local · sin cámaras ni sesión clínica</summary><label>Escenario <select aria-label="Escenario de revisión"><option value="classroom">Aula</option><option value="space">Estación espacial</option><option value="museum">Museo</option></select></label><button type="button" id="review-photo">Vista general para comparar</button><button type="button" id="review-benchmark">Medir materiales y guía (21 s)</button><button type="button" id="review-log">Exportar registro de voz</button><output id="reviewDiagnostics" style="display:block;white-space:pre-wrap"></output><pre id="benchmarkResults" style="white-space:pre-wrap"></pre>';
document.body.append(toolbar);
const renderMeasurements=document.createElement('pre');renderMeasurements.id='reviewMeasurements';renderMeasurements.style.whiteSpace='pre-wrap';toolbar.append(renderMeasurements);
function load(theme: WorldTheme): void {
  history.replaceState(null, '', `?world=${theme}`);
  generation++;recorder?.dispose();recorder=null; controller?.dispose(); controller = null; scene?.dispose(); scene = null;
  let activityState='exploration';
  const reviewSink:ActivityTelemetrySink={onStateChange:state=>{activityState=state;},onBlockStart:()=>{},onTrialStart:()=>{},onTrialEnd:()=>{},onDistractor:()=>{},onActivityResult:()=>{}};
  const returnToReview = () => { recorder?.dispose(); recorder = null; controller?.dispose(); controller = null; scene = null; toolbar.open = true; };
  controller = theme === 'classroom' ? new ClassroomScene(engine, canvas, returnToReview,reviewSink)
    : theme === 'space' ? new SpaceStationScene(engine, canvas, returnToReview,reviewSink)
      : new VisualDiscriminationScene(engine, canvas, returnToReview,reviewSink);
  scene = controller.create(); toolbar.open = false;
  recorder=new RenderingReviewRecorder(scene,theme,()=>activityState);
}
const select = toolbar.querySelector('select')!;
toolbar.querySelector('#review-photo')!.addEventListener('click', () => {
  const camera = scene?.activeCamera;
  if (!camera || !scene) return;
  const positions = { classroom: [7.1, 3.1, -8.2], space: [4.7, 2.9, -6.4], museum: [6.4, 3.1, -6.1] };
  const targets = { classroom: [-.5, 1.7, .8], space: [-.5, 1.8, 1.4], museum: [-1, 1.7, .2] };
  const theme = select.value as WorldTheme;
  scene.onBeforeRenderObservable.add(() => {
    camera.position.copyFrom(Vector3.FromArray(positions[theme]));
    (camera as import('@babylonjs/core').UniversalCamera).setTarget(Vector3.FromArray(targets[theme]));
  });
  toolbar.open = false;
});
select.addEventListener('change', () => load(select.value as WorldTheme));
toolbar.querySelector('#review-log')!.addEventListener('click', () => guideNarrationLog.download());
toolbar.querySelector('#review-benchmark')!.addEventListener('click', async () => {
  const button = toolbar.querySelector<HTMLButtonElement>('#review-benchmark')!;
  button.disabled = true;recorder?.dispose();recorder=null; controller?.dispose(); controller = null; scene?.dispose(); scene = null;
  const run = ++generation;
  const output = toolbar.querySelector('#benchmarkResults')!;
  try {
    await runVisualBenchmark(engine, select.value as WorldTheme, value => { scene = value; }, message => { output.textContent = message; }, () => run === generation);
  } catch (error) { output.textContent = String(error); }
  finally { button.disabled = false; }
});
engine.runRenderLoop(() => scene?.render());
window.addEventListener('resize', () => engine.resize());
setInterval(() => {
  const guideMeshes = scene?.meshes.filter(mesh => mesh.metadata?.role === 'pre-evaluation-guide').length ?? 0;
  const artMeshes = scene?.meshes.filter(mesh => mesh.metadata?.role === 'exploration-art-v2').length ?? 0;
  const events = guideNarrationLog.snapshot().slice(-3).map(event => `${event.type}: ${event.clipId}`);
  document.getElementById('reviewDiagnostics')!.textContent = JSON.stringify({ fps: Number(engine.getFps().toFixed(1)), renderSize: [engine.getRenderWidth(), engine.getRenderHeight()], meshes: scene?.meshes.length ?? 0, guideMeshes, artMeshes, pbr: scene?.materials.filter(material => material.name.startsWith('exploration-PBR')).length ?? 0, events }, null, 2);
  renderMeasurements.textContent=JSON.stringify({scope:'Renderer only; no MediaPipe or physical cameras',renderer:engine.getGlInfo(),phases:RenderingReviewRecorder.snapshot()},null,2);
}, 1000);
const world = new URLSearchParams(location.search).get('world');
select.value = world === 'space' || world === 'museum' ? world : 'classroom';
load(select.value as WorldTheme);
