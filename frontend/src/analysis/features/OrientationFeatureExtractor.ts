import type {
  HeadCalibration,
  HeadOrientation
} from "../types/AnalysisTypes";

export interface OrientationFeatures {
  relativeYaw: number;
  relativePitch: number;
  relativeRoll: number;
  orientationDeviation: number;
  onTaskOrientation: boolean;
  offTaskEpisodeCount: number;
  totalOffTaskTimeMs: number;
  meanOffTaskDurationMs: number | null;
  maxOffTaskDurationMs: number | null;
  returnToTaskLatencyMs: number | null;
  offTaskStarted: boolean;
  offTaskEnded: boolean;
  completedEpisodeDurationMs: number | null;
}

export class OrientationFeatureExtractor {
  private calibration: HeadCalibration | null = null;
  private offTaskStartedAt: number | null = null;
  private offTaskEpisodeCount = 0;
  private readonly completedDurations: number[] = [];
  private totalOffTaskTimeMs = 0;
  private lastReturnLatencyMs: number | null = null;
  private readonly deviationThresholdDegrees: number;

  constructor(deviationThresholdDegrees: number) {
    this.deviationThresholdDegrees = deviationThresholdDegrees;
  }

  setCalibration(calibration: HeadCalibration): void {
    this.calibration = { ...calibration };
    this.resetEpisodes();
  }

  extract(
    orientation: HeadOrientation,
    timestampMs: number
  ): OrientationFeatures | null {
    if (!this.calibration) {
      return null;
    }

    const relativeYaw = orientation.yaw - this.calibration.baselineYaw;
    const relativePitch = orientation.pitch - this.calibration.baselinePitch;
    const relativeRoll = orientation.roll - this.calibration.baselineRoll;
    const orientationDeviation = Math.hypot(relativeYaw, relativePitch);
    const onTaskOrientation =
      orientationDeviation <= this.deviationThresholdDegrees;
    let offTaskStarted = false;
    let offTaskEnded = false;
    let completedEpisodeDurationMs: number | null = null;

    if (!onTaskOrientation && this.offTaskStartedAt === null) {
      this.offTaskStartedAt = timestampMs;
      this.offTaskEpisodeCount += 1;
      offTaskStarted = true;
    } else if (onTaskOrientation && this.offTaskStartedAt !== null) {
      completedEpisodeDurationMs = Math.max(0, timestampMs - this.offTaskStartedAt);
      this.completedDurations.push(completedEpisodeDurationMs);
      this.totalOffTaskTimeMs += completedEpisodeDurationMs;
      this.lastReturnLatencyMs = completedEpisodeDurationMs;
      this.offTaskStartedAt = null;
      offTaskEnded = true;
    }

    const activeDuration =
      this.offTaskStartedAt === null
        ? 0
        : Math.max(0, timestampMs - this.offTaskStartedAt);
    const durationsWithActive =
      activeDuration > 0
        ? [...this.completedDurations, activeDuration]
        : this.completedDurations;

    return {
      relativeYaw,
      relativePitch,
      relativeRoll,
      orientationDeviation,
      onTaskOrientation,
      offTaskEpisodeCount: this.offTaskEpisodeCount,
      totalOffTaskTimeMs: this.totalOffTaskTimeMs + activeDuration,
      meanOffTaskDurationMs:
        durationsWithActive.length > 0
          ? durationsWithActive.reduce((total, value) => total + value, 0) /
            durationsWithActive.length
          : null,
      maxOffTaskDurationMs:
        durationsWithActive.length > 0 ? Math.max(...durationsWithActive) : null,
      returnToTaskLatencyMs: this.lastReturnLatencyMs,
      offTaskStarted,
      offTaskEnded,
      completedEpisodeDurationMs
    };
  }

  markUnavailable(timestampMs: number): number | null {
    if (this.offTaskStartedAt === null) {
      return null;
    }

    const completedDurationMs = Math.max(
      0,
      timestampMs - this.offTaskStartedAt
    );

    this.completedDurations.push(completedDurationMs);
    this.totalOffTaskTimeMs += completedDurationMs;
    this.offTaskStartedAt = null;
    return completedDurationMs;
  }

  reset(): void {
    this.calibration = null;
    this.resetEpisodes();
  }

  private resetEpisodes(): void {
    this.offTaskStartedAt = null;
    this.offTaskEpisodeCount = 0;
    this.completedDurations.length = 0;
    this.totalOffTaskTimeMs = 0;
    this.lastReturnLatencyMs = null;
  }
}
