import { Vector3 } from "@babylonjs/core";
import type { Observer, Scene } from "@babylonjs/core";

import type { BlockCondition, StimulusType } from "../activities/GoNoGoTypes";
import {
  AUDIO_ASSETS,
  AUDIO_CONFIG
} from "./AudioConfig";
import type {
  AmbientAudioId,
  AudioDistractorId,
  StimulusAudioId
} from "./AudioConfig";

type ResponseInputType = "keyboard" | "pointer";
type AudioCategory = "ambient" | "distractor" | "stimulus";

interface ManagedSource {
  stop: () => void;
  disconnect: () => void;
}

export interface AmbientSoundLayer {
  id: string;
  assetPath: string | null;
  position?: Vector3;
  volume?: number;
}

type PlayableAmbientSoundLayer = AmbientSoundLayer & { assetPath: string };

interface SpatialOutput {
  input: GainNode;
  cleanup: () => void;
}

export interface SpatialSoundOptions {
  id: AudioDistractorId | string;
  position?: Vector3;
  volume?: number;
  playbackRate?: number;
  durationMs?: number;
  assetPath?: string | null;
}

export class AudioManager {
  private scene: Scene | null = null;
  private audioContext: AudioContext | null = null;
  private ambientGain: GainNode | null = null;
  private distractorGain: GainNode | null = null;
  private stimulusGain: GainNode | null = null;
  private listenerObserver: Observer<Scene> | null = null;
  private readonly buffers = new Map<string, AudioBuffer | null>();
  private readonly loadingBuffers = new Map<string, Promise<AudioBuffer | null>>();
  private readonly ambientSources: ManagedSource[] = [];

  private enabled = true;
  private ambientLayerOverride: AmbientSoundLayer[] | null = null;
  private ambientRequested = false;
  private ambientPlaying = false;
  private ambientVolume: number = AUDIO_CONFIG.ambientVolume;
  private stimulusCueCounter = 0;

  async initialize(scene: Scene): Promise<void> {
    this.scene = scene;

    if (this.listenerObserver) {
      return;
    }

    this.listenerObserver = scene.onBeforeRenderObservable.add(() => {
      this.updateListenerFromActiveCamera();
    });
  }

  unlock(): void {
    void this.resumeAudioContext().then(() => {
      if (this.ambientRequested && !this.ambientPlaying) {
        this.startAmbientLayers();
      }
    });
  }

  startAmbientAudio(layers?: AmbientSoundLayer[]): void {
    if (!this.enabled) {
      return;
    }

    if (layers) {
      this.ambientLayerOverride = layers.map((layer) => ({ ...layer }));
    }

    this.ambientRequested = true;
    this.unlock();
  }

  stopAmbientAudio(): void {
    this.ambientRequested = false;
    this.stopAmbientSources();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;

    if (!enabled) {
      this.stopAmbientAudio();
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  isAmbientPlaying(): boolean {
    return this.ambientPlaying;
  }

  setAmbientVolume(value: number): void {
    this.ambientVolume = this.clamp(value, 0, 1);

    if (!this.ambientGain || !this.audioContext) {
      return;
    }

    this.ambientGain.gain.setTargetAtTime(
      this.ambientVolume,
      this.audioContext.currentTime,
      0.08
    );
  }

  setProtocolCondition(condition: BlockCondition): void {
    const targetVolume =
      condition === "baseline"
        ? AUDIO_CONFIG.baselineAmbientVolume
        : AUDIO_CONFIG.ambientVolume;

    this.setAmbientVolume(targetVolume);
  }

  playDistractor(options: SpatialSoundOptions): void {
    this.playSpatialSound(options);
  }

  playSpatialSound(options: SpatialSoundOptions): void {
    if (!this.enabled) {
      return;
    }

    void this.resumeAudioContext().then((audioContext) => {
      if (!audioContext) {
        return;
      }

      const assetPath =
        options.assetPath !== undefined
          ? options.assetPath
          : this.getDistractorAsset(options.id);

      if (!assetPath) {
        this.playProceduralDistractor(audioContext, options);
        return;
      }

      void this.loadBuffer(`distractor:${options.id}`, assetPath).then((buffer) => {
        if (!buffer) {
          this.playProceduralDistractor(audioContext, options);
          return;
        }

        this.playBufferOneShot(audioContext, buffer, {
          ...options,
          category: "distractor"
        });
      });
    });
  }

  playStimulusCue(stimulusType: StimulusType): void {
    if (!this.enabled) {
      return;
    }

    void this.resumeAudioContext().then((audioContext) => {
      if (!audioContext) {
        return;
      }

      const stimulusId: StimulusAudioId = stimulusType === "go" ? "go" : "noGo";
      const assetPath = AUDIO_ASSETS.stimulus[stimulusId];

      if (assetPath) {
        void this.loadBuffer(`stimulus:${stimulusId}`, assetPath).then((buffer) => {
          if (buffer) {
            this.playBufferOneShot(audioContext, buffer, {
              id: stimulusId,
              volume: AUDIO_CONFIG.stimulusCueVolume,
              category: "stimulus"
            });
            return;
          }

          this.playProceduralStimulusCue(audioContext, stimulusType);
        });
        return;
      }

      this.playProceduralStimulusCue(audioContext, stimulusType);
    });
  }

  playResponseCue(inputType: ResponseInputType): void {
    if (!this.enabled) {
      return;
    }

    void this.resumeAudioContext().then((audioContext) => {
      if (!audioContext) {
        return;
      }

      const stimulusId: StimulusAudioId =
        inputType === "keyboard" ? "responseKeyboard" : "responsePointer";
      const assetPath = AUDIO_ASSETS.stimulus[stimulusId];

      if (assetPath) {
        void this.loadBuffer(`stimulus:${stimulusId}`, assetPath).then((buffer) => {
          if (buffer) {
            this.playBufferOneShot(audioContext, buffer, {
              id: stimulusId,
              volume: AUDIO_CONFIG.responseCueVolume,
              category: "stimulus"
            });
            return;
          }

          this.playProceduralResponseCue(audioContext, inputType);
        });
        return;
      }

      this.playProceduralResponseCue(audioContext, inputType);
    });
  }

  dispose(): void {
    this.stopAmbientSources();

    if (this.scene && this.listenerObserver) {
      this.scene.onBeforeRenderObservable.remove(this.listenerObserver);
    }

    this.listenerObserver = null;
    this.scene = null;
    this.ambientGain?.disconnect();
    this.distractorGain?.disconnect();
    this.stimulusGain?.disconnect();
    this.ambientGain = null;
    this.distractorGain = null;
    this.stimulusGain = null;
    this.buffers.clear();
    this.loadingBuffers.clear();

    if (this.audioContext && this.audioContext.state !== "closed") {
      void this.audioContext.close().catch((error: unknown) => {
        console.warn("No se pudo cerrar AudioManager.", error);
      });
    }

    this.audioContext = null;
  }

  private async resumeAudioContext(): Promise<AudioContext | null> {
    const audioContext = this.ensureAudioContext();

    if (!audioContext) {
      return null;
    }

    if (audioContext.state === "suspended") {
      try {
        await audioContext.resume();
      } catch (error: unknown) {
        console.warn("El navegador bloqueo el inicio de audio.", error);
        return null;
      }
    }

    this.updateListenerFromActiveCamera();
    return audioContext;
  }

  private ensureAudioContext(): AudioContext | null {
    if (this.audioContext && this.audioContext.state !== "closed") {
      this.ensureAudioGraph(this.audioContext);
      return this.audioContext;
    }

    try {
      this.audioContext = new AudioContext();
      this.ensureAudioGraph(this.audioContext);
      return this.audioContext;
    } catch (error: unknown) {
      console.warn("El navegador no permitio crear AudioContext.", error);
      return null;
    }
  }

  private ensureAudioGraph(audioContext: AudioContext): void {
    if (this.ambientGain && this.distractorGain && this.stimulusGain) {
      return;
    }

    this.ambientGain = audioContext.createGain();
    this.distractorGain = audioContext.createGain();
    this.stimulusGain = audioContext.createGain();

    this.ambientGain.gain.value = this.ambientVolume;
    this.distractorGain.gain.value = AUDIO_CONFIG.distractorVolume;
    this.stimulusGain.gain.value = 1;

    this.ambientGain.connect(audioContext.destination);
    this.distractorGain.connect(audioContext.destination);
    this.stimulusGain.connect(audioContext.destination);
  }

  private startAmbientLayers(): void {
    const audioContext = this.audioContext;

    if (
      !audioContext ||
      !this.enabled ||
      this.ambientPlaying ||
      !this.ambientRequested
    ) {
      return;
    }

    const configuredAmbient = this.getConfiguredAmbientLayers();

    if (configuredAmbient.length === 0) {
      this.startProceduralAmbientLayers(audioContext);
      return;
    }

    void this.startConfiguredAmbientLayers(audioContext, configuredAmbient);
  }

  private async startConfiguredAmbientLayers(
    audioContext: AudioContext,
    entries: PlayableAmbientSoundLayer[]
  ): Promise<void> {
    const sources: ManagedSource[] = [];

    for (const layer of entries) {
      const buffer = await this.loadBuffer(`ambient:${layer.id}`, layer.assetPath);

      if (!buffer || !this.enabled || !this.ambientRequested) {
        continue;
      }

      sources.push(this.playAmbientBufferLoop(audioContext, layer, buffer));
    }

    if (sources.length === 0) {
      this.startProceduralAmbientLayers(audioContext);
      return;
    }

    this.ambientSources.push(...sources);
    this.ambientPlaying = true;
  }

  private startProceduralAmbientLayers(audioContext: AudioContext): void {
    const ambientGain = this.ambientGain;

    if (!ambientGain) {
      return;
    }

    const roomToneSource = audioContext.createBufferSource();
    roomToneSource.buffer = this.createNoiseBuffer(audioContext, 2);
    roomToneSource.loop = true;

    const roomToneFilter = audioContext.createBiquadFilter();
    roomToneFilter.type = "lowpass";
    roomToneFilter.frequency.value = 420;

    const roomToneGain = audioContext.createGain();
    roomToneGain.gain.value = 0.42;

    roomToneSource.connect(roomToneFilter);
    roomToneFilter.connect(roomToneGain);
    roomToneGain.connect(ambientGain);
    roomToneSource.start();

    const humSource = audioContext.createOscillator();
    humSource.type = "sine";
    humSource.frequency.value = 58;

    const humGain = audioContext.createGain();
    humGain.gain.value = 0.028;
    humSource.connect(humGain);
    humGain.connect(ambientGain);
    humSource.start();

    const outdoorSource = audioContext.createBufferSource();
    outdoorSource.buffer = this.createNoiseBuffer(audioContext, 3);
    outdoorSource.loop = true;

    const outdoorFilter = audioContext.createBiquadFilter();
    outdoorFilter.type = "bandpass";
    outdoorFilter.frequency.value = 960;
    outdoorFilter.Q.value = 0.7;

    const outdoorOutput = this.createSpatialOutput(
      audioContext,
      new Vector3(-8.5, 2.3, -1.1),
      0.18,
      "ambient"
    );

    outdoorSource.connect(outdoorFilter);
    outdoorFilter.connect(outdoorOutput.input);
    outdoorSource.start();

    this.ambientSources.push(
      this.createManagedSource(roomToneSource, roomToneFilter, roomToneGain),
      this.createManagedSource(humSource, humGain),
      this.createManagedSource(outdoorSource, outdoorFilter, {
        cleanup: outdoorOutput.cleanup
      })
    );
    this.ambientPlaying = true;
  }

  private playAmbientBufferLoop(
    audioContext: AudioContext,
    layer: AmbientSoundLayer,
    buffer: AudioBuffer
  ): ManagedSource {
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const isOutdoorLayer = layer.id === "distantOutdoor";
    const output = layer.position
      ? this.createSpatialOutput(
          audioContext,
          layer.position,
          layer.volume ?? 0.45,
          "ambient"
        )
      : isOutdoorLayer
      ? this.createSpatialOutput(
          audioContext,
          new Vector3(-8.5, 2.3, -1.1),
          layer.volume ?? 0.45,
          "ambient"
        )
      : this.createOutput(audioContext, layer.volume ?? 0.65, "ambient");

    source.connect(output.input);
    source.start();

    return this.createManagedSource(source, {
      cleanup: output.cleanup
    });
  }

  private stopAmbientSources(): void {
    this.ambientSources.forEach((source) => {
      source.stop();
      source.disconnect();
    });
    this.ambientSources.length = 0;
    this.ambientPlaying = false;
  }

  private playBufferOneShot(
    audioContext: AudioContext,
    buffer: AudioBuffer,
    options: SpatialSoundOptions & { category: AudioCategory }
  ): void {
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = options.playbackRate ?? 1;

    const output = options.position
      ? this.createSpatialOutput(
          audioContext,
          options.position,
          options.volume ?? 1,
          options.category
        )
      : this.createOutput(audioContext, options.volume ?? 1, options.category);

    source.connect(output.input);
    source.onended = () => {
      source.disconnect();
      output.cleanup();
    };
    source.start();

    if (options.durationMs) {
      source.stop(audioContext.currentTime + options.durationMs / 1000);
    }
  }

  private playProceduralStimulusCue(
    audioContext: AudioContext,
    stimulusType: StimulusType
  ): void {
    const startTime = audioContext.currentTime;
    const variant = this.getStimulusCueVariant();

    if (stimulusType === "go") {
      this.playTone(
        audioContext,
        620 + variant * 70,
        startTime,
        0.09,
        AUDIO_CONFIG.stimulusCueVolume,
        "sine",
        "stimulus"
      );
      this.playTone(
        audioContext,
        760 + variant * 55,
        startTime + 0.09,
        0.08,
        AUDIO_CONFIG.stimulusCueVolume * 0.86,
        "triangle",
        "stimulus"
      );
    } else {
      this.playTone(
        audioContext,
        310 - variant * 28,
        startTime,
        0.11,
        AUDIO_CONFIG.stimulusCueVolume * 0.82,
        "triangle",
        "stimulus"
      );
      this.playTone(
        audioContext,
        240 - variant * 18,
        startTime + 0.1,
        0.12,
        AUDIO_CONFIG.stimulusCueVolume * 0.68,
        "sine",
        "stimulus"
      );
    }

    this.stimulusCueCounter += 1;
  }

  private playProceduralResponseCue(
    audioContext: AudioContext,
    inputType: ResponseInputType
  ): void {
    const frequency = inputType === "keyboard" ? 880 : 720;

    this.playTone(
      audioContext,
      frequency,
      audioContext.currentTime,
      0.055,
      AUDIO_CONFIG.responseCueVolume,
      "square",
      "stimulus"
    );
  }

  private playProceduralDistractor(
    audioContext: AudioContext,
    options: SpatialSoundOptions
  ): void {
    const position = options.position;
    const volume = options.volume ?? 1;

    switch (options.id) {
      case "footsteps":
        this.playFootsteps(audioContext, position, volume);
        return;

      case "door":
        this.playDoorCue(audioContext, position, volume);
        return;

      case "chairMovement":
        this.playChairMovementCue(audioContext, position, volume);
        return;

      case "pencilDrop":
        this.playPencilDropCue(audioContext, position, volume);
        return;

      case "distantConversation":
        this.playDistantConversationCue(audioContext, position, volume);
        return;

      case "beep":
        this.playSpaceBeepCue(audioContext, position, volume);
        return;

      case "radio":
        this.playSpaceRadioCue(audioContext, position, volume);
        return;

      case "mechanical":
        this.playSpaceMechanicalCue(audioContext, position, volume);
        return;

      case "alarm":
        this.playSpaceAlarmCue(audioContext, position, volume);
        return;

      case "robotMotor":
        this.playSpaceRobotMotorCue(audioContext, position, volume);
        return;

      default:
        this.playToneAt(
          audioContext,
          430,
          audioContext.currentTime,
          0.16,
          0.18 * volume,
          "triangle",
          position
        );
    }
  }

  private playFootsteps(
    audioContext: AudioContext,
    position: Vector3 | undefined,
    volume: number
  ): void {
    const now = audioContext.currentTime;

    this.playToneAt(audioContext, 170, now, 0.08, 0.26 * volume, "triangle", position);
    this.playToneAt(audioContext, 135, now + 0.28, 0.08, 0.22 * volume, "triangle", position);
    this.playToneAt(audioContext, 160, now + 0.56, 0.07, 0.18 * volume, "triangle", position);
  }

  private playDoorCue(
    audioContext: AudioContext,
    position: Vector3 | undefined,
    volume: number
  ): void {
    const now = audioContext.currentTime;

    this.playNoiseBurst(audioContext, position, now, 0.38, 0.22 * volume, "bandpass", 460);
    this.playToneAt(audioContext, 260, now + 0.04, 0.34, 0.16 * volume, "sawtooth", position);
  }

  private playChairMovementCue(
    audioContext: AudioContext,
    position: Vector3 | undefined,
    volume: number
  ): void {
    this.playNoiseBurst(
      audioContext,
      position,
      audioContext.currentTime,
      0.28,
      0.2 * volume,
      "highpass",
      860
    );
  }

  private playPencilDropCue(
    audioContext: AudioContext,
    position: Vector3 | undefined,
    volume: number
  ): void {
    const now = audioContext.currentTime;

    this.playToneAt(audioContext, 1180, now, 0.035, 0.22 * volume, "square", position);
    this.playToneAt(audioContext, 520, now + 0.05, 0.05, 0.14 * volume, "triangle", position);
  }

  private playDistantConversationCue(
    audioContext: AudioContext,
    position: Vector3 | undefined,
    volume: number
  ): void {
    const now = audioContext.currentTime;
    const frequencies = [320, 410, 365, 455];

    frequencies.forEach((frequency, index) => {
      this.playToneAt(
        audioContext,
        frequency,
        now + index * 0.16,
        0.18,
        0.055 * volume,
        index % 2 === 0 ? "sine" : "triangle",
        position
      );
    });
  }

  private playSpaceBeepCue(
    audioContext: AudioContext,
    position: Vector3 | undefined,
    volume: number
  ): void {
    const now = audioContext.currentTime;

    this.playToneAt(audioContext, 880, now, 0.08, 0.16 * volume, "sine", position);
    this.playToneAt(audioContext, 1180, now + 0.09, 0.07, 0.1 * volume, "triangle", position);
  }

  private playSpaceRadioCue(
    audioContext: AudioContext,
    position: Vector3 | undefined,
    volume: number
  ): void {
    const now = audioContext.currentTime;

    this.playNoiseBurst(audioContext, position, now, 0.42, 0.1 * volume, "bandpass", 1400);
    this.playToneAt(audioContext, 420, now + 0.04, 0.14, 0.035 * volume, "triangle", position);
    this.playToneAt(audioContext, 510, now + 0.22, 0.12, 0.03 * volume, "sine", position);
  }

  private playSpaceMechanicalCue(
    audioContext: AudioContext,
    position: Vector3 | undefined,
    volume: number
  ): void {
    const now = audioContext.currentTime;

    this.playNoiseBurst(audioContext, position, now, 0.26, 0.13 * volume, "lowpass", 620);
    this.playToneAt(audioContext, 210, now + 0.02, 0.22, 0.08 * volume, "sawtooth", position);
  }

  private playSpaceAlarmCue(
    audioContext: AudioContext,
    position: Vector3 | undefined,
    volume: number
  ): void {
    const now = audioContext.currentTime;

    this.playToneAt(audioContext, 720, now, 0.1, 0.09 * volume, "sine", position);
    this.playToneAt(audioContext, 520, now + 0.12, 0.1, 0.075 * volume, "sine", position);
  }

  private playSpaceRobotMotorCue(
    audioContext: AudioContext,
    position: Vector3 | undefined,
    volume: number
  ): void {
    const now = audioContext.currentTime;

    this.playToneAt(audioContext, 150, now, 0.34, 0.08 * volume, "triangle", position);
    this.playNoiseBurst(audioContext, position, now, 0.34, 0.05 * volume, "lowpass", 360);
  }

  private playTone(
    audioContext: AudioContext,
    frequency: number,
    startTime: number,
    durationSeconds: number,
    peakGain: number,
    oscillatorType: OscillatorType,
    category: AudioCategory
  ): void {
    this.playToneAt(
      audioContext,
      frequency,
      startTime,
      durationSeconds,
      peakGain,
      oscillatorType,
      undefined,
      category
    );
  }

  private playToneAt(
    audioContext: AudioContext,
    frequency: number,
    startTime: number,
    durationSeconds: number,
    peakGain: number,
    oscillatorType: OscillatorType,
    position?: Vector3,
    category: AudioCategory = "distractor"
  ): void {
    const oscillator = audioContext.createOscillator();
    const output = position
      ? this.createSpatialOutput(audioContext, position, 1, category)
      : this.createOutput(audioContext, 1, category);
    const envelope = audioContext.createGain();
    const endTime = startTime + durationSeconds;

    oscillator.type = oscillatorType;
    oscillator.frequency.setValueAtTime(frequency, startTime);

    envelope.gain.setValueAtTime(0.0001, startTime);
    envelope.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, peakGain),
      startTime + 0.015
    );
    envelope.gain.exponentialRampToValueAtTime(0.0001, endTime);

    oscillator.connect(envelope);
    envelope.connect(output.input);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
      output.cleanup();
    };

    oscillator.start(startTime);
    oscillator.stop(endTime + 0.03);
  }

  private playNoiseBurst(
    audioContext: AudioContext,
    position: Vector3 | undefined,
    startTime: number,
    durationSeconds: number,
    peakGain: number,
    filterType: BiquadFilterType,
    frequency: number
  ): void {
    const source = audioContext.createBufferSource();
    const filter = audioContext.createBiquadFilter();
    const envelope = audioContext.createGain();
    const output = position
      ? this.createSpatialOutput(audioContext, position, 1, "distractor")
      : this.createOutput(audioContext, 1, "distractor");
    const endTime = startTime + durationSeconds;

    source.buffer = this.createNoiseBuffer(audioContext, durationSeconds + 0.08);
    filter.type = filterType;
    filter.frequency.value = frequency;
    filter.Q.value = 1.2;

    envelope.gain.setValueAtTime(0.0001, startTime);
    envelope.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, peakGain),
      startTime + 0.02
    );
    envelope.gain.exponentialRampToValueAtTime(0.0001, endTime);

    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(output.input);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      envelope.disconnect();
      output.cleanup();
    };

    source.start(startTime);
    source.stop(endTime + 0.03);
  }

  private createSpatialOutput(
    audioContext: AudioContext,
    position: Vector3,
    volume: number,
    category: AudioCategory
  ): SpatialOutput {
    const gain = audioContext.createGain();
    const panner = audioContext.createPanner();
    const destination = this.getCategoryGain(category);

    gain.gain.value = volume;
    panner.panningModel = "HRTF";
    panner.distanceModel = "linear";
    panner.refDistance = AUDIO_CONFIG.spatialRefDistance;
    panner.maxDistance = AUDIO_CONFIG.spatialMaxDistance;
    panner.rolloffFactor = AUDIO_CONFIG.spatialRolloffFactor;
    this.setPannerPosition(panner, position);

    gain.connect(panner);
    panner.connect(destination);

    return {
      input: gain,
      cleanup: () => {
        gain.disconnect();
        panner.disconnect();
      }
    };
  }

  private createOutput(
    audioContext: AudioContext,
    volume: number,
    category: AudioCategory
  ): SpatialOutput {
    const gain = audioContext.createGain();
    const destination = this.getCategoryGain(category);

    gain.gain.value = volume;
    gain.connect(destination);

    return {
      input: gain,
      cleanup: () => {
        gain.disconnect();
      }
    };
  }

  private getCategoryGain(category: AudioCategory): GainNode {
    switch (category) {
      case "ambient":
        return this.ambientGain ?? this.createFallbackGain();

      case "stimulus":
        return this.stimulusGain ?? this.createFallbackGain();

      case "distractor":
        return this.distractorGain ?? this.createFallbackGain();
    }
  }

  private createFallbackGain(): GainNode {
    const audioContext = this.ensureAudioContext();

    if (!audioContext) {
      throw new Error("AudioContext no disponible.");
    }

    const gain = audioContext.createGain();
    gain.connect(audioContext.destination);
    return gain;
  }

  private createManagedSource(
    source: AudioBufferSourceNode | OscillatorNode,
    ...nodes: Array<AudioNode | { cleanup: () => void }>
  ): ManagedSource {
    return {
      stop: () => {
        try {
          source.stop();
        } catch {
          // The source may already be stopped by the browser.
        }
      },
      disconnect: () => {
        source.disconnect();
        nodes.forEach((node) => {
          if ("cleanup" in node) {
            node.cleanup();
            return;
          }

          node.disconnect();
        });
      }
    };
  }

  private async loadBuffer(key: string, assetPath: string): Promise<AudioBuffer | null> {
    const cachedBuffer = this.buffers.get(key);

    if (cachedBuffer) {
      return cachedBuffer;
    }

    if (this.buffers.has(key)) {
      return null;
    }

    const existingRequest = this.loadingBuffers.get(key);

    if (existingRequest) {
      return existingRequest;
    }

    const request = this.fetchAndDecodeBuffer(assetPath);
    this.loadingBuffers.set(key, request);

    const buffer = await request;
    this.loadingBuffers.delete(key);
    this.buffers.set(key, buffer);

    return buffer;
  }

  private async fetchAndDecodeBuffer(assetPath: string): Promise<AudioBuffer | null> {
    const audioContext = this.ensureAudioContext();

    if (!audioContext) {
      return null;
    }

    try {
      const response = await fetch(assetPath);

      if (!response.ok) {
        console.warn(
          `Audio no encontrado (${response.status}): ${assetPath}. Se usara fallback procedural si esta disponible.`
        );
        return null;
      }

      const data = await response.arrayBuffer();
      return await audioContext.decodeAudioData(data);
    } catch (error: unknown) {
      console.warn(`No se pudo cargar audio: ${assetPath}`, error);
      return null;
    }
  }

  private getConfiguredAmbientLayers(): PlayableAmbientSoundLayer[] {
    const layers =
      this.ambientLayerOverride ??
      (Object.entries(AUDIO_ASSETS.ambient) as Array<[AmbientAudioId, string | null]>)
        .map(([id, assetPath]) => ({
          id,
          assetPath
        }));

    return layers.filter(
      (layer): layer is PlayableAmbientSoundLayer =>
        typeof layer.assetPath === "string"
    );
  }

  private getDistractorAsset(id: string): string | null {
    if (id in AUDIO_ASSETS.distractors) {
      return AUDIO_ASSETS.distractors[id as AudioDistractorId];
    }

    return null;
  }

  private createNoiseBuffer(
    audioContext: AudioContext,
    durationSeconds: number
  ): AudioBuffer {
    const sampleRate = audioContext.sampleRate;
    const length = Math.max(1, Math.floor(sampleRate * durationSeconds));
    const buffer = audioContext.createBuffer(1, length, sampleRate);
    const channelData = buffer.getChannelData(0);

    for (let index = 0; index < length; index += 1) {
      channelData[index] = (Math.random() * 2 - 1) * 0.62;
    }

    return buffer;
  }

  private updateListenerFromActiveCamera(): void {
    const audioContext = this.audioContext;
    const activeCamera = this.scene?.activeCamera;

    if (!audioContext || !activeCamera || audioContext.state === "closed") {
      return;
    }

    const position = activeCamera.globalPosition ?? activeCamera.position;
    const forward = activeCamera.getForwardRay(1).direction.normalize();
    const up = activeCamera.upVector.normalize();
    const listener = audioContext.listener;
    const now = audioContext.currentTime;

    listener.positionX.setValueAtTime(position.x, now);
    listener.positionY.setValueAtTime(position.y, now);
    listener.positionZ.setValueAtTime(position.z, now);
    listener.forwardX.setValueAtTime(forward.x, now);
    listener.forwardY.setValueAtTime(forward.y, now);
    listener.forwardZ.setValueAtTime(forward.z, now);
    listener.upX.setValueAtTime(up.x, now);
    listener.upY.setValueAtTime(up.y, now);
    listener.upZ.setValueAtTime(up.z, now);
  }

  private setPannerPosition(panner: PannerNode, position: Vector3): void {
    const audioContext = this.audioContext;
    const now = audioContext?.currentTime ?? 0;

    panner.positionX.setValueAtTime(position.x, now);
    panner.positionY.setValueAtTime(position.y, now);
    panner.positionZ.setValueAtTime(position.z, now);
  }

  private getStimulusCueVariant(): number {
    return Math.floor(this.stimulusCueCounter / 10) % 3;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }
}
