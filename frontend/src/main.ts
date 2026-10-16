import { Engine } from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';
import { AnalysisApplicationController } from './analysis/AnalysisApplicationController';
import { ClassroomScene } from './scenes/ClassroomScene';
import { SpaceStationScene } from './scenes/SpaceStationScene';
import { VisualDiscriminationScene } from './scenes/VisualDiscriminationScene';
import { SpecialistApp } from './specialist/SpecialistApp';
import { SpecialistAccess } from './specialist/SpecialistAccess';
import { PerformanceProbe } from './performance/PerformanceProbe';
import { EvaluationJourney } from './flow/EvaluationJourney';
import './style.css';
const canvas = document.createElement('canvas');
canvas.id = 'renderCanvas';
canvas.tabIndex = 0;
document.body.append(canvas);
const engine = new Engine(canvas, true, { alpha: true, preserveDrawingBuffer: false, stencil: false, powerPreference: 'high-performance' });
engine.setHardwareScalingLevel(1);
const analysis = new AnalysisApplicationController(engine);
const probe = new PerformanceProbe(engine, () => analysis.getPerformanceProbeSnapshot());
let scene: Scene | null = null;
let journey: EvaluationJourney | null = null;
let openingJourney = false;
const setScene = (value: Scene | null) => { scene = value; probe.setScene(value); };
const specialist = new SpecialistApp({ startCameraSetup: () => {
        if (journey) {
            window.location.reload();
            return;
        }
        analysis.initialize(() => { void enterJourney(); });
    } });
async function enterJourney():Promise<void> {
    if(journey||openingJourney)return;
    openingJourney=true;
    document.getElementById('journeyConnectionError')?.remove();
    try{
        // Revoke specialist access before handing the screen to the child.
        await SpecialistAccess.lock();
        journey=new EvaluationJourney(engine,canvas,analysis,(id,telemetry,onExit)=>id==='classroom'?new ClassroomScene(engine,canvas,onExit,telemetry):id==='space-station'?new SpaceStationScene(engine,canvas,onExit,telemetry):new VisualDiscriminationScene(engine,canvas,onExit,telemetry),setScene,sessionId=>specialist.showResults(sessionId));
        journey.start();
    }catch{
        journey?.dispose();journey=null;
        const message=document.createElement('section');message.id='journeyConnectionError';message.className='specialistLogin';
        message.innerHTML='<h2>No pudimos abrir el menú</h2><p>Compruebe la conexión al servidor para bloquear el acceso del especialista antes de continuar. Puede reintentar sin repetir la configuración de cámaras.</p><button type="button">Reintentar abrir el menú</button>';
        message.querySelector('button')!.addEventListener('click',()=>{void enterJourney();});document.body.append(message);
    }finally{openingJourney=false;}
}
engine.runRenderLoop(() => scene?.render());
window.addEventListener('resize', () => engine.resize());
window.addEventListener('beforeunload', () => { journey?.dispose(); analysis.dispose(); probe.dispose(); engine.dispose(); });
specialist.show();
