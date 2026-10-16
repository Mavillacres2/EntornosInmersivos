import { NARRATION_VERSION } from './GuideSceneConfiguration';
import type { PlaybackSnapshot } from './SpeechPlaybackService';
interface Envelope { hz: number; values: number[]; wavSHA256?: string }
interface Timing { wavSHA256: string; visemes: { t: number; d: number; id: number }[]; words: { t: number; text: string }[] }
export interface MouthPose { open: number; round: number; wide: number; source: 'engine-visemes' | 'amplitude' | 'silent' }
/** Engine-issued visual speech marks, with an honest RMS fallback if marks are unavailable. */
export class LipSyncController {
  private readonly narrationVersion:string;
  constructor(narrationVersion = NARRATION_VERSION) {this.narrationVersion=narrationVersion;}
  private readonly envelopes = new Map<string, Envelope>();
  private readonly timings = new Map<string, Timing>();
  private readonly requests = new Map<string, Promise<void>>();
  private readonly abort = new AbortController();
  load(clipId: string): Promise<void> {
    const existing = this.requests.get(clipId);
    if (existing) return existing;
    const base = `${import.meta.env.BASE_URL}assets/guides/${this.narrationVersion}/${clipId}`;
    const envelopeRequest = fetch(`${base}.envelope.json`, { signal: this.abort.signal })
      .then(response => { if (!response.ok) throw new Error('Envelope unavailable'); return response.json(); })
      .then((data: Envelope) => {
        if (data.hz > 0 && Array.isArray(data.values)) this.envelopes.set(clipId, data);
      }).catch(() => { /* Missing data closes the mouth; never invent timing. */ });
    const timingRequest = fetch(`${base}.timing.json`, {signal:this.abort.signal}).then(response=>{if(!response.ok)throw new Error('No speech marks');return response.json();}).then((data:Timing)=>{
      if(Array.isArray(data.visemes)&&data.visemes.length&&data.visemes.every(mark=>Number.isFinite(mark.t)&&mark.t>=0&&Number.isInteger(mark.id)&&mark.id>=0&&mark.id<=21))this.timings.set(clipId,data);
    }).catch(()=>{});
    const request = Promise.all([envelopeRequest,timingRequest]).then(()=>{});
    this.requests.set(clipId, request);
    return request;
  }
  amplitude(snapshot: PlaybackSnapshot): number {
    if (snapshot.state !== 'playing' || snapshot.muted || snapshot.volume === 0 || !snapshot.clipId) return 0;
    const envelope = this.envelopes.get(snapshot.clipId);
    if (!envelope) return 0;
    const position = snapshot.currentTime * envelope.hz;
    const index = Math.floor(position);
    const a = envelope.values[index] ?? 0;
    const b = envelope.values[index + 1] ?? 0;
    return Math.min(1, Math.max(0, a + (b - a) * (position - index)));
  }
  pose(snapshot: PlaybackSnapshot): MouthPose {
    const amplitude=this.amplitude(snapshot);
    const silent: MouthPose={open:0,round:0,wide:0,source:'silent'};
    if(amplitude===0)return silent;
    const timing=snapshot.clipId?this.timings.get(snapshot.clipId):null;
    const envelope=snapshot.clipId?this.envelopes.get(snapshot.clipId):null;
    if(!timing||timing.wavSHA256!==envelope?.wavSHA256)return {open:amplitude,round:0,wide:0,source:'amplitude'};
    let left=0,right=timing.visemes.length-1;
    while(left<right){const middle=Math.ceil((left+right)/2);if(timing.visemes[middle]!.t<=snapshot.currentTime)left=middle;else right=middle-1;}
    const mark=timing.visemes[left]!;
    if(snapshot.currentTime<mark.t||mark.id===0||mark.id===21)return silent;
    const strength=.25+amplitude*.65;
    if([7,8,9,10].includes(mark.id))return {open:strength*.25,round:strength*.75,wide:0,source:'engine-visemes'};
    if([4,6,11,15,16].includes(mark.id))return {open:strength*.25,round:0,wide:strength*.75,source:'engine-visemes'};
    return {open:strength,round:0,wide:0,source:'engine-visemes'};
  }
  dispose(): void { this.abort.abort(); this.envelopes.clear(); this.timings.clear(); this.requests.clear(); }
}
