import scripts from './narration.es.json';
import type { WorldTheme } from '../ui/ScenarioPresentation';

export type GuideState = 'IDLE' | 'GREETING' | 'EXPLAINING' | 'DEMONSTRATING' | 'WAITING' | 'FAREWELL';
export type GuideQuality = 'low' | 'balanced' | 'high';
export interface GuideClip { id: string; title: string; text: string; state: GuideState }
export const NARRATION_VERSION = scripts.version;
export const GUIDE_CONFIG = {
  classroom: { name: 'Luma', role: 'Tu compañera del aula', color: '#2f927b', accent: '#ffc96b' },
  space: { name: 'Nova', role: 'Tu compañero de misión', color: '#5289ce', accent: '#73dce8' },
  museum: { name: 'Mica', role: 'Tu compañera exploradora', color: '#9463b5', accent: '#eac481' }
} as const;
export function guideClips(theme: WorldTheme): readonly GuideClip[] {
  return scripts[theme] as GuideClip[];
}
export function guideAudioUrl(clip: GuideClip): string {
  return `${import.meta.env.BASE_URL}assets/guides/${NARRATION_VERSION}/${clip.id}.wav`;
}
