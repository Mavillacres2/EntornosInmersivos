import { afterEach, describe, expect, it, vi } from 'vitest';
import { Color3, DirectionalLight, MeshBuilder, NullEngine, PBRMaterial, Scene, SceneLoader, StandardMaterial, Vector3 } from '@babylonjs/core';
import { readFileSync } from 'node:fs';
import { GuideCharacter } from '../GuideCharacter';
import type { GuideAssetLoader } from '../GuideCharacter';
import type { GuideQuality } from '../GuideSceneConfiguration';
import type { WorldTheme } from '../../ui/ScenarioPresentation';
import { CharacterAnimationController } from '../CharacterAnimationController';
import { SpeechPlaybackService } from '../SpeechPlaybackService';
import { TutorialFlowController } from '../TutorialFlowController';
import { guideClips } from '../GuideSceneConfiguration';
import { ExplorationVisuals } from '../../environment/ExplorationVisuals';
import { ExplorationArtDirection } from '../../environment/ExplorationArtDirection';
import { DEFAULT_CPT_SESSION_CONFIG } from '../../activities/CPTTypes';
import { guideNarrationLog } from '../GuideNarrationLog';
import { LipSyncController } from '../LipSyncController';

const engines: NullEngine[] = [];
const services: SpeechPlaybackService[] = [];
function scene(): Scene { const engine = new NullEngine(); engines.push(engine); return new Scene(engine); }
const loadAsset: GuideAssetLoader = (world, theme, quality) => SceneLoader.LoadAssetContainerAsync('',new Uint8Array(readFileSync(`public/assets/models/guides-v2/${theme}-${quality}.glb`)),world,undefined,'.glb');
async function guide(world: Scene, theme: WorldTheme, quality: GuideQuality): Promise<GuideCharacter> {
  const character = new GuideCharacter(world,theme,quality,loadAsset); await character.ready; return character;
}
afterEach(() => { services.splice(0).forEach(service => service.dispose()); engines.splice(0).forEach(engine => engine.dispose()); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });
class FakeAudio {
  static instances: FakeAudio[] = [];
  onplaying: (() => void) | null = null;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onwaiting: (() => void) | null = null;
  volume = 1; muted = false; currentTime = 0; preload = '';
  pause = vi.fn(); load = vi.fn(); removeAttribute = vi.fn();
  play = vi.fn(() => Promise.resolve());
  readonly src: string;
  constructor(src: string) { this.src = src; FakeAudio.instances.push(this); }
}
function speech(): SpeechPlaybackService { vi.stubGlobal('Audio', FakeAudio); const service = new SpeechPlaybackService(); services.push(service); return service; }

describe('guide narration boundary', () => {
  it('blocks advancement until acknowledged and while voice is active; completes exactly once', () => {
    const flow = new TutorialFlowController(2);
    expect(flow.next(false)).toBe('blocked');
    flow.acknowledge(); expect(flow.next(true)).toBe('blocked');
    expect(flow.next(false)).toBe('next'); expect(flow.acknowledged).toBe(false);
    flow.acknowledge(); expect(flow.next(false)).toBe('complete'); expect(flow.next(false)).toBe('blocked');
  });
  it('never allows two guide voices and ignores late events from a cancelled clip', () => {
    const first = speech(), second = speech(), clip = guideClips('classroom')[0]!;
    first.play(clip); const original = FakeAudio.instances.at(-1)!;
    original.onplaying?.(); const staleEnd = original.onended!;
    second.play(guideClips('space')[0]!);
    expect(original.pause).toHaveBeenCalled(); expect(first.snapshot().state).toBe('idle');
    staleEnd(); expect(first.snapshot().state).toBe('idle');
    expect(second.snapshot().state).toBe('loading');
  });
  it('playback failure does not silently acknowledge instructions or switch TTS providers', () => {
    const service = speech(); service.play(guideClips('museum')[1]!);
    FakeAudio.instances.at(-1)!.onerror?.(); expect(service.snapshot().state).toBe('error');
    service.dispose(); expect(service.snapshot().state).toBe('idle');
  });
  it('offers the error path after a stalled load and ignores a late playback event', () => {
    vi.useFakeTimers(); const service = speech(); service.play(guideClips('classroom')[0]!);
    const audio = FakeAudio.instances.at(-1)!, stalePlaying = audio.onplaying!;
    vi.advanceTimersByTime(20_001); expect(service.snapshot().state).toBe('error');
    stalePlaying(); expect(service.snapshot().state).toBe('error'); expect(audio.pause).toHaveBeenCalled();
  });
  it('records the start, finish and fixed version without trial responses', () => {
    const service = speech(), clip = guideClips('space')[0]!;
    const before = guideNarrationLog.snapshot().length;
    service.play(clip); const audio = FakeAudio.instances.at(-1)!;
    audio.onplaying?.(); audio.onended?.();
    expect(guideNarrationLog.snapshot().slice(before).map(event => event.type)).toEqual(['start', 'end']);
    expect(service.snapshot().state).toBe('complete');
  });
  it('narrated CPT target matches the real task configuration', () => {
    expect(DEFAULT_CPT_SESSION_CONFIG.targetLetter).toBe('X');
    expect(guideClips('space')[1]!.title).toContain(DEFAULT_CPT_SESSION_CONFIG.targetLetter);
  });
});

describe('guide graphics isolation', () => {
  it('reduces geometry in lighter quality profiles', async () => {
    const world = scene();
    const low = await guide(world, 'space', 'low');
    const lowVertices = low.meshes.reduce((sum, mesh) => sum + mesh.getTotalVertices(), 0); low.dispose();
    const high = await guide(world, 'space', 'high');
    expect(high.meshes.reduce((sum, mesh) => sum + mesh.getTotalVertices(), 0)).toBeGreaterThan(lowVertices); high.dispose();
  });
  it.each(['classroom', 'space', 'museum'] as const)('removes %s guide meshes, lights, joints and materials completely', async theme => {
    const world = scene();
    const original = new DirectionalLight('world', new Vector3(0, -1, 1), world);
    const baseline = [world.meshes.length, world.transformNodes.length, world.materials.length, world.lights.length];
    const character = await guide(world, theme, 'balanced');
    expect(character.meshes.length).toBeLessThan(55);
    expect(character.meshes.every(mesh => !mesh.isPickable && !mesh.checkCollisions)).toBe(true);
    character.dispose(); character.dispose();
    expect([world.meshes.length, world.transformNodes.length, world.materials.length, world.lights.length]).toEqual(baseline);
    expect(original.excludedMeshes).toHaveLength(0);
  });
  it('blends authored GLB gestures and closes the mouth morph immediately when the audio ends', async () => {
    const character = await guide(scene(), 'classroom', 'low');
    const animation = new CharacterAnimationController(character);
    animation.setState('GREETING'); animation.update(1 / 60, .8);
    expect(character.rightArm.rotationQuaternion).not.toBeNull();
    expect(Math.abs(character.rightArm.rotationQuaternion!.z)).toBeLessThan(.5);
    expect(character.animationGroups).toHaveLength(3);
    expect(character.mouthShapes).toHaveLength(3);
    expect(character.mouthOpen!.influence).toBeGreaterThan(0);
    animation.setState('WAITING'); animation.update(1 / 60, 0);
    expect(character.mouthOpen!.influence).toBe(0); character.dispose();
  });
  it('restores the exact original world surfaces, lighting and processing before evaluation', () => {
    const world = scene(); const original = new StandardMaterial('lightWoodMaterial', world); original.diffuseColor = new Color3(.8, .6, .4);
    const desk = MeshBuilder.CreateBox('desk', {}, world); desk.material = original;
    const light = new DirectionalLight('window', new Vector3(0, -1, 0), world); light.intensity = .7;
    const tone = world.imageProcessingConfiguration.toneMappingEnabled;
    const layer = new ExplorationVisuals(world, 'classroom', 'low', { art: false });
    expect(desk.material).not.toBe(original);
    layer.dispose(); layer.dispose();
    expect(desk.material).toBe(original); expect(world.environmentTexture).toBeNull();
    expect(light.intensity).toBe(.7); expect(world.imageProcessingConfiguration.toneMappingEnabled).toBe(tone);
    expect(world.materials).toEqual([original]);
  });
  it.each(['classroom','space','museum'] as const)('restores %s visibility and disposes the entire art layer before trials', theme=>{
    const world=scene(), original=MeshBuilder.CreateBox(theme==='museum'?'abstractSpherePedestal':'studentChair1Seat',{},world);
    const material=new StandardMaterial('original',world);original.material=material;
    // The production renderer has already initialized its shared BRDF texture before this layer.
    const warmup=new PBRMaterial('renderer-prewarm',world);warmup.dispose();
    const before=[world.meshes.length,world.materials.length,world.transformNodes.length,world.textures.length];
    const position=original.position.clone();
    const art=new ExplorationArtDirection(world,theme,'low');
    expect(world.meshes.some(mesh=>mesh.metadata?.role==='exploration-art-v2')).toBe(true);
    expect(original.position.equals(position)).toBe(true);
    art.dispose();art.dispose();
    expect(original.isVisible).toBe(true);expect(original.material).toBe(material);
    expect([world.meshes.length,world.materials.length,world.transformNodes.length,world.textures.length]).toEqual(before);
  });
  it('disposes a GLB whose async loading completes after the guide has already closed',async()=>{
    const world=scene();let release:(()=>void)|undefined;
    const delayed:GuideAssetLoader=async(...args)=>{const asset=await loadAsset(...args);await new Promise<void>(resolve=>{release=resolve;});return asset;};
    const character=new GuideCharacter(world,'space','low',delayed);
    // Wait for the actual asset loader, without allowing the guide to attach its nodes.
    await vi.waitFor(()=>expect(release).toBeDefined());character.dispose();release!();await character.ready;
    expect(world.meshes.some(mesh=>mesh.metadata?.role==='pre-evaluation-guide')).toBe(false);
    expect(world.transformNodes.some(node=>node.name==='virtualGuide-root')).toBe(false);
  });
  it('uses real engine viseme marks only when they belong to the exact audio file', async()=>{
    vi.stubGlobal('fetch',vi.fn(async(url:string)=>({ok:true,json:async()=>url.endsWith('timing.json')?{wavSHA256:'exact',visemes:[{t:0,d:.2,id:21},{t:.25,d:.2,id:7},{t:.5,d:.2,id:6}],words:[]}:{wavSHA256:'exact',hz:2,values:[1,1,1]}})));
    const lip=new LipSyncController();await lip.load('marked');
    const snapshot={state:'playing' as const,clipId:'marked',currentTime:.3,volume:1,muted:false};
    expect(lip.pose(snapshot).source).toBe('engine-visemes');expect(lip.pose(snapshot).round).toBeGreaterThan(0);
    expect(lip.pose({...snapshot,currentTime:.6}).wide).toBeGreaterThan(0);
    expect(lip.pose({...snapshot,currentTime:.1}).open).toBe(0);
    expect(lip.pose({...snapshot,muted:true}).source).toBe('silent');lip.dispose();
  });
  it('uses exact audio time and closes lips when muted, silent, cancelled or missing data', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ hz: 2, values: [0, 1, 0] }) })));
    const lip = new LipSyncController(); await lip.load('sample');
    const snapshot = { state: 'playing' as const, clipId: 'sample', currentTime: .25, volume: 1, muted: false };
    expect(lip.amplitude(snapshot)).toBe(.5);
    expect(lip.amplitude({ ...snapshot, muted: true })).toBe(0);
    expect(lip.amplitude({ ...snapshot, state: 'complete' })).toBe(0);
    expect(lip.amplitude({ ...snapshot, clipId: 'missing' })).toBe(0);
    expect(lip.amplitude({ ...snapshot, currentTime: 20 })).toBe(0); lip.dispose();
  });
});
