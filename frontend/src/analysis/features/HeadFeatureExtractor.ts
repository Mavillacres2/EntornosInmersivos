import type { HeadOrientation } from "../types/AnalysisTypes";
import type { HeadBehaviorFeatures } from "../types/BehaviorTypes";
import { pushRolling, standardDeviation } from "./FeatureMath";
import type { OrientationFeatures } from "./OrientationFeatureExtractor";

export interface HeadExtractionResult {
  features: HeadBehaviorFeatures;
  headTurnDetected: boolean;
}

export class HeadFeatureExtractor {
  private previousOrientation: HeadOrientation | null = null;
  private previousTimestampMs: number | null = null;
  private readonly movementHistory: number[] = [];
  private turnActive = false;
  private headTurnCount = 0;
  private readonly headTurnThresholdDegrees: number;

  constructor(headTurnThresholdDegrees: number) {
    this.headTurnThresholdDegrees = headTurnThresholdDegrees;
  }

  extract(
    orientation: HeadOrientation | null,
    orientationFeatures: OrientationFeatures | null,
    timestampMs: number,
    quality: HeadBehaviorFeatures["quality"]
  ): HeadExtractionResult {
    if (!orientation || !orientationFeatures) {
      this.markUnavailable();
      return {
        features: unavailableHeadFeatures(),
        headTurnDetected: false
      };
    }

    const movementMagnitude = this.previousOrientation
      ? Math.hypot(
          orientation.yaw - this.previousOrientation.yaw,
          orientation.pitch - this.previousOrientation.pitch,
          orientation.roll - this.previousOrientation.roll
        )
      : null;
    const elapsedSeconds =
      this.previousTimestampMs === null
        ? null
        : Math.max(0.001, (timestampMs - this.previousTimestampMs) / 1000);
    const movementVelocity =
      movementMagnitude !== null && elapsedSeconds !== null
        ? movementMagnitude / elapsedSeconds
        : null;
    const currentlyTurned =
      Math.abs(orientationFeatures.relativeYaw) >= this.headTurnThresholdDegrees;
    const headTurnDetected = currentlyTurned && !this.turnActive;

    if (headTurnDetected) {
      this.headTurnCount += 1;
    }

    this.turnActive = currentlyTurned;
    pushRolling(this.movementHistory, movementMagnitude);
    this.previousOrientation = { ...orientation };
    this.previousTimestampMs = timestampMs;

    return {
      features: {
        yaw: orientationFeatures.relativeYaw,
        pitch: orientationFeatures.relativePitch,
        roll: orientationFeatures.relativeRoll,
        movementMagnitude,
        movementVelocity,
        movementVariability: standardDeviation(this.movementHistory),
        headTurnCount: this.headTurnCount,
        orientationDeviation: orientationFeatures.orientationDeviation,
        offTaskEpisodeCount: orientationFeatures.offTaskEpisodeCount,
        totalOffTaskTimeMs: orientationFeatures.totalOffTaskTimeMs,
        meanOffTaskDurationMs: orientationFeatures.meanOffTaskDurationMs,
        maxOffTaskDurationMs: orientationFeatures.maxOffTaskDurationMs,
        returnToTaskLatencyMs: orientationFeatures.returnToTaskLatencyMs,
        onTaskOrientation: orientationFeatures.onTaskOrientation,
        available: true,
        quality
      },
      headTurnDetected
    };
  }

  markUnavailable(): void {
    this.previousOrientation = null;
    this.previousTimestampMs = null;
    this.turnActive = false;
  }

  reset(): void {
    this.markUnavailable();
    this.movementHistory.length = 0;
    this.headTurnCount = 0;
  }
}

export function unavailableHeadFeatures(): HeadBehaviorFeatures {
  return {
    yaw: null,
    pitch: null,
    roll: null,
    movementMagnitude: null,
    movementVelocity: null,
    movementVariability: null,
    headTurnCount: 0,
    orientationDeviation: null,
    offTaskEpisodeCount: 0,
    totalOffTaskTimeMs: 0,
    meanOffTaskDurationMs: null,
    maxOffTaskDurationMs: null,
    returnToTaskLatencyMs: null,
    onTaskOrientation: null,
    available: false,
    quality: "unavailable"
  };
}
