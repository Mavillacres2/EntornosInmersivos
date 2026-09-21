import type {
  FullBodyBehaviorFeatures,
  MovementBehaviorFeatures,
  TrunkBehaviorFeatures
} from "../types/BehaviorTypes";
import { mean, pushRolling, standardDeviation } from "./FeatureMath";

export interface MovementExtractionResult {
  features: MovementBehaviorFeatures;
  movementEpisodeStarted: boolean;
}

export class MovementFeatureExtractor {
  private readonly movementHistory: number[] = [];
  private firstTimestampMs: number | null = null;
  private previousTimestampMs: number | null = null;
  private previousMagnitude: number | null = null;
  private episodeActive = false;
  private episodeCount = 0;
  private readonly episodeThreshold: number;

  constructor(episodeThreshold: number) {
    this.episodeThreshold = episodeThreshold;
  }

  extract(
    trunk: TrunkBehaviorFeatures,
    fullBody: FullBodyBehaviorFeatures,
    timestampMs: number
  ): MovementExtractionResult {
    const availableMovements = [
      trunk.movementMagnitude,
      fullBody.globalMotorActivity
    ].filter((value): value is number => value !== null);
    const magnitude = mean(availableMovements);

    if (magnitude === null) {
      this.markUnavailable();
      return {
        features: unavailableMovementFeatures(),
        movementEpisodeStarted: false
      };
    }

    this.firstTimestampMs ??= timestampMs;
    const elapsedSeconds =
      this.previousTimestampMs === null
        ? null
        : Math.max(0.001, (timestampMs - this.previousTimestampMs) / 1000);
    const velocity =
      elapsedSeconds !== null && this.previousMagnitude !== null
        ? Math.abs(magnitude - this.previousMagnitude) / elapsedSeconds
        : null;
    const episodeActive = magnitude >= this.episodeThreshold;
    const movementEpisodeStarted = episodeActive && !this.episodeActive;

    if (movementEpisodeStarted) {
      this.episodeCount += 1;
    }

    this.episodeActive = episodeActive;
    pushRolling(this.movementHistory, magnitude);
    const elapsedMinutes = Math.max(
      1 / 60,
      (timestampMs - this.firstTimestampMs) / 60_000
    );

    this.previousMagnitude = magnitude;
    this.previousTimestampMs = timestampMs;

    return {
      features: {
        magnitude,
        velocity,
        frequency: this.episodeCount / elapsedMinutes,
        variability: standardDeviation(this.movementHistory),
        episodeCount: this.episodeCount,
        taskRelevantMovement: null,
        taskIrrelevantMovement: null,
        available: true
      },
      movementEpisodeStarted
    };
  }

  markUnavailable(): void {
    this.previousTimestampMs = null;
    this.previousMagnitude = null;
    this.episodeActive = false;
  }

  reset(): void {
    this.movementHistory.length = 0;
    this.firstTimestampMs = null;
    this.markUnavailable();
    this.episodeCount = 0;
  }
}

export function unavailableMovementFeatures(): MovementBehaviorFeatures {
  return {
    magnitude: null,
    velocity: null,
    frequency: null,
    variability: null,
    episodeCount: 0,
    taskRelevantMovement: null,
    taskIrrelevantMovement: null,
    available: false
  };
}
