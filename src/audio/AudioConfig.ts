const AUDIO_ASSET_ROOT = "/assets/audio";
const AMBIENT_AUDIO_ROOT = `${AUDIO_ASSET_ROOT}/ambient`;

export const AUDIO_CONFIG = {
  ambientVolume: 0.14,
  baselineAmbientVolume: 0.06,
  distractorVolume: 0.16,
  stimulusCueVolume: 0.045,
  responseCueVolume: 0.04,
  spatialMaxDistance: 12,
  spatialRefDistance: 1.2,
  spatialRolloffFactor: 1.1
} as const;

export interface AudioAssetCatalog {
  ambient: {
    roomTone: string | null;
    ventilation: string | null;
    distantOutdoor: string | null;
  };
  distractors: {
    footsteps: string | null;
    door: string | null;
    chairMovement: string | null;
    pencilDrop: string | null;
    distantConversation: string | null;
  };
  stimulus: {
    go: string | null;
    noGo: string | null;
    responseKeyboard: string | null;
    responsePointer: string | null;
  };
}

export const AUDIO_ASSETS: AudioAssetCatalog = {
  ambient: {
    roomTone: `${AMBIENT_AUDIO_ROOT}/aula-ambiente.mp3`,
    ventilation: null,
    distantOutdoor: null
  },
  distractors: {
    footsteps: null,
    door: null,
    chairMovement: null,
    pencilDrop: null,
    distantConversation: null
  },
  stimulus: {
    go: null,
    noGo: null,
    responseKeyboard: null,
    responsePointer: null
  }
} satisfies AudioAssetCatalog;

export type AmbientAudioId = keyof typeof AUDIO_ASSETS.ambient;
export type AudioDistractorId = keyof typeof AUDIO_ASSETS.distractors;
export type StimulusAudioId = keyof typeof AUDIO_ASSETS.stimulus;
