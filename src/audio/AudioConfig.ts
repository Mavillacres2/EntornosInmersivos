const AUDIO_ASSET_ROOT = "/assets/audio";
const AMBIENT_AUDIO_ROOT = `${AUDIO_ASSET_ROOT}/ambient`;
const SPACE_AUDIO_ROOT = `${AUDIO_ASSET_ROOT}/space`;

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
  space: {
    ambient: {
      stationHum: string | null;
    };
    distractors: {
      beep: string | null;
      door: string | null;
      footsteps: string | null;
      radio: string | null;
      mechanical: string | null;
      alarm: string | null;
      robotMotor: string | null;
    };
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
  },
  space: {
    ambient: {
      stationHum: `${SPACE_AUDIO_ROOT}/ambient/station-hum.mp3`
    },
    distractors: {
      beep: `${SPACE_AUDIO_ROOT}/distractors/beep.mp3`,
      door: `${SPACE_AUDIO_ROOT}/distractors/door.mp3`,
      footsteps: `${SPACE_AUDIO_ROOT}/distractors/footsteps.mp3`,
      radio: `${SPACE_AUDIO_ROOT}/distractors/radio.mp3`,
      mechanical: `${SPACE_AUDIO_ROOT}/distractors/mechanical.mp3`,
      alarm: `${SPACE_AUDIO_ROOT}/distractors/alarm.mp3`,
      robotMotor: `${SPACE_AUDIO_ROOT}/distractors/robot-motor.mp3`
    }
  }
} satisfies AudioAssetCatalog;

export type AmbientAudioId = keyof typeof AUDIO_ASSETS.ambient;
export type AudioDistractorId = keyof typeof AUDIO_ASSETS.distractors;
export type StimulusAudioId = keyof typeof AUDIO_ASSETS.stimulus;
export type SpaceAudioDistractorId = keyof typeof AUDIO_ASSETS.space.distractors;
