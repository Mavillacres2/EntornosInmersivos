import type { Document } from "mongodb";

import type {
  BehaviorEventDto,
  BehaviorSampleDto
} from "../validation/schemas.js";

interface AggregateSummary {
  sampleCount: number;
  headMovementMean: number | null;
  headMovementVariability: number | null;
  trunkMovementMean: number | null;
  trunkMovementVariability: number | null;
  globalMotorActivityMean: number | null;
  globalMotorActivityVariability: number | null;
  offTaskOrientationPercentage: number | null;
  offTaskEpisodeCount: number;
  offTaskTotalTimeMs: number;
  meanOffTaskDurationMs: number | null;
  maxOffTaskDurationMs: number | null;
  meanReturnToTaskLatencyMs: number | null;
  distractorResponseCount: number;
  meanDistractorOrientationLatencyMs: number | null;
  leftLegMovementMean: number | null;
  rightLegMovementMean: number | null;
}

export function buildSessionSummary(
  sessionId: string,
  samples: BehaviorSampleDto[],
  events: BehaviorEventDto[]
): Document {
  const groups = new Map<string, BehaviorSampleDto[]>();

  samples.forEach((sample) => {
    const key = [
      sample.scenarioId ?? "none",
      sample.blockNumber ?? "none",
      sample.condition ?? "none"
    ].join("|");
    const group = groups.get(key) ?? [];

    group.push(sample);
    groups.set(key, group);
  });

  const byBlock = [...groups.values()].map((groupSamples) => {
    const first = groupSamples[0];
    const groupEvents = events.filter(
      (event) =>
        event.scenarioId === first?.scenarioId &&
        event.blockNumber === first.blockNumber &&
        event.condition === first.condition
    );

    return {
      scenarioId: first?.scenarioId ?? null,
      blockNumber: first?.blockNumber ?? null,
      condition: first?.condition ?? null,
      ...buildAggregate(groupSamples, groupEvents)
    };
  });

  return {
    sessionId,
    ...buildAggregate(samples, events),
    byBlock
  };
}

function buildAggregate(
  samples: BehaviorSampleDto[],
  events: BehaviorEventDto[]
): AggregateSummary {
  const headMovement = compact(
    samples.map((sample) => sample.upperCamera.head.movementMagnitude)
  );
  const trunkMovement = compact(
    samples.map((sample) => sample.upperCamera.trunk.movementMagnitude)
  );
  const globalMotorActivity = compact(
    samples.map((sample) => sample.fullBodyCamera.globalMotorActivity)
  );
  const leftLegMovement = compact(
    samples.map((sample) => sample.fullBodyCamera.leftLegMovement)
  );
  const rightLegMovement = compact(
    samples.map((sample) => sample.fullBodyCamera.rightLegMovement)
  );
  const orientationSamples = samples
    .map((sample) => sample.upperCamera.head.onTaskOrientation)
    .filter((value): value is boolean => value !== null);
  const summaryBoundaryMs = Math.max(
    0,
    ...samples.map((sample) => sample.elapsedMs),
    ...events.map((event) => event.elapsedMs)
  );
  const offTaskDurations = calculateOffTaskDurations(
    events,
    summaryBoundaryMs
  );
  const returnLatencies = compact(
    events
      .filter((event) => event.type === "RETURN_TO_TASK")
      .map((event) => event.details?.latencyMs ?? null)
  );
  const distractorLatencies = compact(
    events
      .filter((event) => event.type === "DISTRACTOR_ORIENTATION_RESPONSE")
      .map((event) => event.details?.latencyMs ?? null)
  );

  return {
    sampleCount: samples.length,
    headMovementMean: meanOrNull(headMovement),
    headMovementVariability: standardDeviationOrNull(headMovement),
    trunkMovementMean: meanOrNull(trunkMovement),
    trunkMovementVariability: standardDeviationOrNull(trunkMovement),
    globalMotorActivityMean: meanOrNull(globalMotorActivity),
    globalMotorActivityVariability: standardDeviationOrNull(globalMotorActivity),
    offTaskOrientationPercentage:
      orientationSamples.length > 0
        ? (orientationSamples.filter((onTask) => !onTask).length /
            orientationSamples.length) *
          100
        : null,
    offTaskEpisodeCount: events.filter(
      (event) => event.type === "OFF_TASK_ORIENTATION_START"
    ).length,
    offTaskTotalTimeMs: offTaskDurations.reduce(
      (total, duration) => total + duration,
      0
    ),
    meanOffTaskDurationMs: meanOrNull(offTaskDurations),
    maxOffTaskDurationMs:
      offTaskDurations.length > 0 ? Math.max(...offTaskDurations) : null,
    meanReturnToTaskLatencyMs: meanOrNull(returnLatencies),
    distractorResponseCount: distractorLatencies.length,
    meanDistractorOrientationLatencyMs: meanOrNull(distractorLatencies),
    leftLegMovementMean: meanOrNull(leftLegMovement),
    rightLegMovementMean: meanOrNull(rightLegMovement)
  };
}

function calculateOffTaskDurations(
  events: BehaviorEventDto[],
  boundaryElapsedMs: number
): number[] {
  const orientationEvents = events
    .filter(
      (event) =>
        event.type === "OFF_TASK_ORIENTATION_START" ||
        event.type === "OFF_TASK_ORIENTATION_END"
    )
    .sort((first, second) => first.elapsedMs - second.elapsedMs);
  const durations: number[] = [];
  let startedAt: number | null = null;

  orientationEvents.forEach((event) => {
    if (event.type === "OFF_TASK_ORIENTATION_START") {
      startedAt ??= event.elapsedMs;
      return;
    }

    const reportedDuration = event.details?.durationMs;

    if (typeof reportedDuration === "number" && Number.isFinite(reportedDuration)) {
      durations.push(Math.max(0, reportedDuration));
    } else if (startedAt !== null) {
      durations.push(Math.max(0, event.elapsedMs - startedAt));
    }
    startedAt = null;
  });

  if (startedAt !== null && boundaryElapsedMs >= startedAt) {
    durations.push(boundaryElapsedMs - startedAt);
  }

  return durations;
}

function compact(values: Array<number | null | undefined>): number[] {
  return values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value)
  );
}

function meanOrNull(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function standardDeviationOrNull(values: number[]): number | null {
  const average = meanOrNull(values);

  if (average === null) {
    return null;
  }

  const variance =
    values.reduce((total, value) => total + (value - average) ** 2, 0) /
    values.length;

  return Math.sqrt(variance);
}
