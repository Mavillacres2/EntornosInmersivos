import { guideAudioUrl } from './GuideSceneConfiguration';
import type { GuideClip } from './GuideSceneConfiguration';
import { guideNarrationLog } from './GuideNarrationLog';

export type PlaybackState = 'idle' | 'loading' | 'playing' | 'complete' | 'error';
export interface PlaybackSnapshot { state: PlaybackState; clipId: string | null; currentTime: number; muted: boolean; volume: number }

/** One prerecorded voice at a time, even across scene instances. No dynamic TTS fallback. */
export class SpeechPlaybackService {
  private static owner: SpeechPlaybackService | null = null;
  private audio: HTMLAudioElement | null = null;
  private clip: GuideClip | null = null;
  private generation = 0;
  private state: PlaybackState = 'idle';
  private timer: ReturnType<typeof setTimeout> | undefined;
  private muted = false;
  private volume = 0.85;
  private disposed = false;
  onChange: (state: PlaybackState) => void = () => {};
  private readonly narrationVersion?:string;
  constructor(narrationVersion?: string) {this.narrationVersion=narrationVersion;}

  play(clip: GuideClip): void {
    if (this.disposed) return;
    this.stop();
    SpeechPlaybackService.owner?.stop();
    SpeechPlaybackService.owner = this;
    const generation = ++this.generation;
    const audio = new Audio(this.narrationVersion ? `${import.meta.env.BASE_URL}assets/guides/${this.narrationVersion}/${clip.id}.wav` : guideAudioUrl(clip));
    this.audio = audio; this.clip = clip;
    audio.preload = 'auto'; audio.volume = this.volume; audio.muted = this.muted;
    const current = () => !this.disposed && generation === this.generation && this.audio === audio;
    let started = false;
    audio.onplaying = () => {
      if (!current()) return;
      clearTimeout(this.timer);
      if (!started) { guideNarrationLog.record('start', clip.id); started = true; }
      this.setState('playing');
    };
    audio.onended = () => {
      if (!current()) return;
      clearTimeout(this.timer);
      guideNarrationLog.record('end', clip.id);
      this.setState('complete');
    };
    const fail = () => {
      if (!current()) return;
      clearTimeout(this.timer);
      ++this.generation;
      audio.onplaying = audio.onended = audio.onerror = audio.onwaiting = null;
      audio.pause();
      guideNarrationLog.record('error', clip.id);
      this.setState('error');
    };
    audio.onerror = fail;
    audio.onwaiting = () => { if (current()) { this.setState('loading'); clearTimeout(this.timer); this.timer = setTimeout(fail, 20_000); } };
    this.timer = setTimeout(fail, 20_000);
    this.setState('loading');
    void audio.play().catch(fail);
  }

  stop(): void {
    ++this.generation;
    clearTimeout(this.timer);
    const audio = this.audio;
    if (audio) {
      audio.onplaying = audio.onended = audio.onerror = audio.onwaiting = null;
      audio.pause(); audio.removeAttribute('src'); audio.load();
      if (this.state === 'playing' || this.state === 'loading') guideNarrationLog.record('cancel', this.clip?.id ?? null);
    }
    this.audio = null; this.clip = null;
    if (SpeechPlaybackService.owner === this) SpeechPlaybackService.owner = null;
    this.setState('idle');
  }
  setVolume(value: number): void {
    this.volume = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : this.volume;
    if (this.audio) this.audio.volume = this.volume;
    guideNarrationLog.record('volume', this.clip?.id ?? null, this.volume);
  }
  setMuted(value: boolean): void {
    this.muted = value;
    if (this.audio) this.audio.muted = value;
    guideNarrationLog.record('mute', this.clip?.id ?? null, value);
  }
  snapshot(): PlaybackSnapshot {
    return { state: this.state, clipId: this.clip?.id ?? null, currentTime: this.audio?.currentTime ?? 0, muted: this.muted, volume: this.volume };
  }
  dispose(): void { this.stop(); this.disposed = true; this.onChange = () => {}; }
  private setState(state: PlaybackState): void { this.state = state; this.onChange(state); }
}
