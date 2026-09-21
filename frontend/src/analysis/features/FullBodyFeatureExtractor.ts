import { POSE_LANDMARK } from "../mediapipe/PoseAnalysisService";
import type { FeatureQuality, LandmarkPoint } from "../types/AnalysisTypes";
import type { FullBodyBehaviorFeatures } from "../types/BehaviorTypes";
import {
  distance3d,
  isUsableLandmark,
  mean,
  pushRolling,
  standardDeviation
} from "./FeatureMath";

const GROUPS = {
  upperBody: [
    POSE_LANDMARK.leftShoulder,
    POSE_LANDMARK.rightShoulder,
    POSE_LANDMARK.leftElbow,
    POSE_LANDMARK.rightElbow,
    POSE_LANDMARK.leftWrist,
    POSE_LANDMARK.rightWrist
  ],
  leftArm: [
    POSE_LANDMARK.leftShoulder,
    POSE_LANDMARK.leftElbow,
    POSE_LANDMARK.leftWrist
  ],
  rightArm: [
    POSE_LANDMARK.rightShoulder,
    POSE_LANDMARK.rightElbow,
    POSE_LANDMARK.rightWrist
  ],
  pelvis: [POSE_LANDMARK.leftHip, POSE_LANDMARK.rightHip],
  leftLeg: [
    POSE_LANDMARK.leftHip,
    POSE_LANDMARK.leftKnee,
    POSE_LANDMARK.leftAnkle
  ],
  rightLeg: [
    POSE_LANDMARK.rightHip,
    POSE_LANDMARK.rightKnee,
    POSE_LANDMARK.rightAnkle
  ],
  leftKnee: [POSE_LANDMARK.leftKnee],
  rightKnee: [POSE_LANDMARK.rightKnee],
  leftFoot: [
    POSE_LANDMARK.leftAnkle,
    POSE_LANDMARK.leftHeel,
    POSE_LANDMARK.leftFootIndex
  ],
  rightFoot: [
    POSE_LANDMARK.rightAnkle,
    POSE_LANDMARK.rightHeel,
    POSE_LANDMARK.rightFootIndex
  ]
} as const;

export interface FullBodyExtractionResult {
  features: FullBodyBehaviorFeatures;
  largeMovementDetected: boolean;
}

export class FullBodyFeatureExtractor {
  private previousLandmarks: LandmarkPoint[] | null = null;
  private readonly movementHistory: number[] = [];
  private largeMovementActive = false;
  private largeMovementEpisodeCount = 0;
  private readonly minimumVisibility: number;
  private readonly largeMovementThreshold: number;

  constructor(minimumVisibility: number, largeMovementThreshold: number) {
    this.minimumVisibility = minimumVisibility;
    this.largeMovementThreshold = largeMovementThreshold;
  }

  extract(
    landmarks: LandmarkPoint[] | null,
    sourceQuality: FeatureQuality
  ): FullBodyExtractionResult {
    if (!landmarks || !this.hasUsableScale(landmarks)) {
      this.markUnavailable();
      return {
        features: unavailableFullBodyFeatures(),
        largeMovementDetected: false
      };
    }

    const scale = this.getShoulderScale(landmarks);
    const previous = this.previousLandmarks;
    const upperBodyMovement = this.groupMovement(
      landmarks,
      previous,
      GROUPS.upperBody,
      scale
    );
    const leftArmMovement = this.groupMovement(
      landmarks,
      previous,
      GROUPS.leftArm,
      scale
    );
    const rightArmMovement = this.groupMovement(
      landmarks,
      previous,
      GROUPS.rightArm,
      scale
    );
    const pelvisMovement = this.groupMovement(
      landmarks,
      previous,
      GROUPS.pelvis,
      scale
    );
    const leftLegMovement = this.groupMovement(
      landmarks,
      previous,
      GROUPS.leftLeg,
      scale
    );
    const rightLegMovement = this.groupMovement(
      landmarks,
      previous,
      GROUPS.rightLeg,
      scale
    );
    const leftKneeMovement = this.groupMovement(
      landmarks,
      previous,
      GROUPS.leftKnee,
      scale
    );
    const rightKneeMovement = this.groupMovement(
      landmarks,
      previous,
      GROUPS.rightKnee,
      scale
    );
    const leftFootMovement = this.groupMovement(
      landmarks,
      previous,
      GROUPS.leftFoot,
      scale
    );
    const rightFootMovement = this.groupMovement(
      landmarks,
      previous,
      GROUPS.rightFoot,
      scale
    );
    const lowerBodyMovement = mean(
      compact([
        pelvisMovement,
        leftLegMovement,
        rightLegMovement,
        leftFootMovement,
        rightFootMovement
      ])
    );
    const globalMotorActivity = mean(
      compact([upperBodyMovement, lowerBodyMovement])
    );
    const largeMovementActive =
      globalMotorActivity !== null &&
      globalMotorActivity >= this.largeMovementThreshold;
    const largeMovementDetected =
      largeMovementActive && !this.largeMovementActive;

    if (largeMovementDetected) {
      this.largeMovementEpisodeCount += 1;
    }

    this.largeMovementActive = largeMovementActive;
    pushRolling(this.movementHistory, globalMotorActivity);
    this.previousLandmarks = landmarks.map((landmark) => ({ ...landmark }));

    return {
      features: {
        upperBodyMovement,
        leftArmMovement,
        rightArmMovement,
        pelvisMovement,
        leftLegMovement,
        rightLegMovement,
        leftKneeMovement,
        rightKneeMovement,
        leftFootMovement,
        rightFootMovement,
        lowerBodyMovement,
        globalMotorActivity,
        movementVariability: standardDeviation(this.movementHistory),
        largeMovementEpisodeCount: this.largeMovementEpisodeCount,
        available: true,
        quality: sourceQuality
      },
      largeMovementDetected
    };
  }

  markUnavailable(): void {
    this.previousLandmarks = null;
    this.largeMovementActive = false;
  }

  reset(): void {
    this.markUnavailable();
    this.movementHistory.length = 0;
    this.largeMovementEpisodeCount = 0;
  }

  private hasUsableScale(landmarks: LandmarkPoint[]): boolean {
    const leftShoulder = landmarks[POSE_LANDMARK.leftShoulder];
    const rightShoulder = landmarks[POSE_LANDMARK.rightShoulder];

    return (
      isUsableLandmark(leftShoulder, this.minimumVisibility) &&
      isUsableLandmark(rightShoulder, this.minimumVisibility) &&
      distance3d(leftShoulder, rightShoulder) >= 0.001
    );
  }

  private getShoulderScale(landmarks: LandmarkPoint[]): number {
    const leftShoulder = landmarks[POSE_LANDMARK.leftShoulder];
    const rightShoulder = landmarks[POSE_LANDMARK.rightShoulder];

    if (!leftShoulder || !rightShoulder) {
      return 1;
    }

    return Math.max(0.001, distance3d(leftShoulder, rightShoulder));
  }

  private groupMovement(
    current: LandmarkPoint[],
    previous: LandmarkPoint[] | null,
    indices: readonly number[],
    scale: number
  ): number | null {
    if (!previous) {
      return null;
    }

    const distances = indices.flatMap((index) => {
      const currentPoint = current[index];
      const previousPoint = previous[index];

      if (
        !isUsableLandmark(currentPoint, this.minimumVisibility) ||
        !isUsableLandmark(previousPoint, this.minimumVisibility)
      ) {
        return [];
      }

      return [distance3d(currentPoint, previousPoint) / scale];
    });

    return mean(distances);
  }
}

function compact(values: Array<number | null>): number[] {
  return values.filter((value): value is number => value !== null);
}

export function unavailableFullBodyFeatures(): FullBodyBehaviorFeatures {
  return {
    upperBodyMovement: null,
    leftArmMovement: null,
    rightArmMovement: null,
    pelvisMovement: null,
    leftLegMovement: null,
    rightLegMovement: null,
    leftKneeMovement: null,
    rightKneeMovement: null,
    leftFootMovement: null,
    rightFootMovement: null,
    lowerBodyMovement: null,
    globalMotorActivity: null,
    movementVariability: null,
    largeMovementEpisodeCount: 0,
    available: false,
    quality: "unavailable"
  };
}
