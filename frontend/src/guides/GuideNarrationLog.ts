import { NARRATION_VERSION } from './GuideSceneConfiguration';
export interface GuideNarrationEvent {
  type: 'start' | 'end' | 'cancel' | 'error' | 'written-fallback' | 'volume' | 'mute';
  clipId: string | null;
  version: string;
  at: string;
  monotonicMs: number;
  value?: number | boolean;
}
const entries: GuideNarrationEvent[] = [];
/** Separate from trial metrics; contains no identity, camera frames or responses. */
export const guideNarrationLog = {
  record(type: GuideNarrationEvent['type'], clipId: string | null, value?: number | boolean): void {
    const event = { type, clipId, version: NARRATION_VERSION, at: new Date().toISOString(), monotonicMs: performance.now(), value };
    entries.push(event);
    if (entries.length > 2000) entries.shift();
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('guide-narration', { detail: event }));
  },
  snapshot(): readonly GuideNarrationEvent[] { return entries.map(entry => ({ ...entry })); },
  download(): void {
    const url = URL.createObjectURL(new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'guide-narration.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
};
