import { SceneInstrumentation } from '@babylonjs/core';
import type { Observer, Scene } from '@babylonjs/core';
interface RenderSample { intervalMs:number; submitMs:number; draws:number; triangles:number }
const samples=new Map<string,RenderSample[]>();
/** Development-only renderer measurements, completely separate from participant telemetry/results. */
export class RenderingReviewRecorder {
  private readonly scene:Scene;
  private readonly instrumentation:SceneInstrumentation;
  private readonly before:Observer<Scene>;
  private readonly after:Observer<Scene>;
  constructor(scene:Scene,theme:string,getState:()=>string){
    this.scene=scene;this.instrumentation=new SceneInstrumentation(scene);
    let started=0,phaseStarted=performance.now(),previousPhase='';
    this.before=scene.onBeforeRenderObservable.add(()=>{started=performance.now();})!;
    this.after=scene.onAfterRenderObservable.add(()=>{
      const phase=`${theme}/${document.querySelector('.guideOverlay')?'guide':getState()}`;
      if(phase!==previousPhase){previousPhase=phase;phaseStarted=performance.now();}
      if(document.hidden||performance.now()-phaseStarted<1000)return;
      const list=samples.get(phase)??[];
      if(list.length<600)list.push({intervalMs:scene.getEngine().getDeltaTime(),submitMs:performance.now()-started,draws:this.instrumentation.drawCallsCounter.current,triangles:scene.getActiveIndices()/3});
      samples.set(phase,list);
    })!;
  }
  static snapshot():unknown{
    const percentile=(list:number[],fraction:number)=>{const ordered=list.toSorted((a,b)=>a-b);return Number((ordered[Math.min(ordered.length-1,Math.floor(ordered.length*fraction))]??0).toFixed(2));};
    return Array.from(samples,([phase,list])=>({phase,samples:list.length,inconclusive:list.length<60,estimatedFps:list.length?Number((1000*list.length/list.reduce((sum,item)=>sum+item.intervalMs,0)).toFixed(2)):null,frameMedianMs:percentile(list.map(item=>item.intervalMs),.5),frameP95Ms:percentile(list.map(item=>item.intervalMs),.95),renderSubmitMedianMs:percentile(list.map(item=>item.submitMs),.5),drawCallsMedian:percentile(list.map(item=>item.draws),.5),activeTrianglesMedian:percentile(list.map(item=>item.triangles),.5)}));
  }
  dispose():void{this.scene.onBeforeRenderObservable.remove(this.before);this.scene.onAfterRenderObservable.remove(this.after);this.instrumentation.dispose();}
}
