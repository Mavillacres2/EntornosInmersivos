import { POSE_LANDMARK } from "../mediapipe/PoseAnalysisService";
import type { FeatureQuality, LandmarkPoint } from "../types/AnalysisTypes";
import type { TrunkBehaviorFeatures } from "../types/BehaviorTypes";
import {
  distance3d,
  isUsableLandmark,
  midpoint,
  pushRolling,
  standardDeviation
} from "./FeatureMath";

export interface TrunkExtractionResult {
  features: TrunkBehaviorFeatures;
  postureChangeDetected: boolean;
}

export class TrunkFeatureExtractor {
  private previousCenter: LandmarkPoint | null = null;
  private previousTimestampMs: number | null = null;
  private readonly movementHistory: number[] = [];
  private postureChangeActive = false;
  private postureChangeCount = 0;
  private readonly minimumVisibility: number;
  private readonly postureChangeThreshold: number;

  constructor(minimumVisibility: number, postureChangeThreshold: number) {
    this.minimumVisibility = minimumVisibility;
    this.postureChangeThreshold = postureChangeThreshold;
  }

  extract(
    landmarks: LandmarkPoint[] | null,
    timestampMs: number,
    sourceQuality: FeatureQuality
  ): TrunkExtractionResult {
    const leftShoulder = landmarks?.[POSE_LANDMARK.leftShoulder];
    const rightShoulder = landmarks?.[POSE_LANDMARK.rightShoulder];

    if (
      !isUsableLandmark(leftShoulder, this.minimumVisibility) ||
      !isUsableLandmark(rightShoulder, this.minimumVisibility)
    ) {
      this.markUnavailable();
      return {
        features: unavailableTrunkFeatures(),
        postureChangeDetected: false
      };
    }

    const shoulderScale = distance3d(leftShoulder, rightShoulder);

    if (shoulderScale < 0.001) {
      this.markUnavailable();
      return {
        features: unavailableTrunkFeatures(),
        postureChangeDetected: false
      };
    }

    const shoulderCenter = midpoint(leftShoulder, rightShoulder);
    const leftHip = landmarks?.[POSE_LANDMARK.leftHip];
    const rightHip = landmarks?.[POSE_LANDMARK.rightHip];
    const hipsAvailable =
      isUsableLandmark(leftHip, this.minimumVisibility) &&
      isUsableLandmark(rightHip, this.minimumVisibility);
    const hipCenter = hipsAvailable ? midpoint(leftHip, rightHip) : null;
    const movementMagnitude = this.previousCenter
      ? distance3d(shoulderCenter, this.previousCenter) / shoulderScale
      : null;
    const elapsedSeconds =
      this.previousTimestampMs === null
        ? null
        : Math.max(0.001, (timestampMs - this.previousTimestampMs) / 1000);
    const movementVelocity =
      movementMagnitude !== null && elapsedSeconds !== null
        ? movementMagnitude / elapsedSeconds
        : null;
    const postureChangeActive =
      movementMagnitude !== null &&
      movementMagnitude >= this.postureChangeThreshold;
    const postureChangeDetected =
      postureChangeActive && !this.postureChangeActive;

    if (postureChangeDetected) {
      this.postureChangeCount += 1;
    }

    this.postureChangeActive = postureChangeActive;
    pushRolling(this.movementHistory, movementMagnitude);
    const movementVariability = standardDeviation(this.movementHistory);
    const lateralMovement = this.previousCenter
      ? Math.abs(shoulderCenter.x - this.previousCenter.x) / shoulderScale
      : null;
    const forwardBackwardMovement = this.previousCenter
      ? Math.abs(shoulderCenter.z - this.previousCenter.z) / shoulderScale
      : null;

    this.previousCenter = { ...shoulderCenter };
    this.previousTimestampMs = timestampMs;

    return {
      features: {
        leanX: hipCenter
          ? (shoulderCenter.x - hipCenter.x) / shoulderScale
          : null,
        leanY: hipCenter
          ? (shoulderCenter.z - hipCenter.z) / shoulderScale
          : null,
        movementMagnitude,
        movementVelocity,
        movementVariability,
        postureChangeCount: this.postureChangeCount,
        lateralMovement,
        forwardBackwardMovement,
        upperBodyStability:
          movementVariability === null ? null : 1 / (1 + movementVariability),
        available: true,
        quality: hipsAvailable ? sourceQuality : "low"
      },
      postureChangeDetected
    };
  }

  markUnavailable(): void {
    this.previousCenter = null;
    this.previousTimestampMs = null;
    this.postureChangeActive = false;
  }

  reset(): void {
    this.markUnavailable();
    this.movementHistory.length = 0;
    this.postureChangeCount = 0;
  }
}

export function unavailableTrunkFeatures(): TrunkBehaviorFeatures {
  return {
    leanX: null,
    leanY: null,
    movementMagnitude: null,
    movementVelocity: null,
    movementVariability: null,
    postureChangeCount: 0,
    lateralMovement: null,
    forwardBackwardMovement: null,
    upperBodyStability: null,
    available: false,
    quality: "unavailable"
  };
}
