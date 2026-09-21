import assert from "node:assert/strict";
import test from "node:test";

import { buildSessionSummary } from "../services/SummaryService.js";
import {
  behaviorEventSchema,
  behaviorSampleSchema
} from "../validation/schemas.js";

const sessionId = "00000000-0000-4000-8000-000000000001";

test("session summary aggregates movement, orientation and distractor response", () => {
  const samples = [createSample("01", 100, 1, true), createSample("02", 200, 3, false)];
  const events = [
    createEvent("01", 120, "OFF_TASK_ORIENTATION_START"),
    createEvent("02", 620, "OFF_TASK_ORIENTATION_END", { durationMs: 500 }),
    createEvent("03", 620, "RETURN_TO_TASK", { latencyMs: 500 }),
    createEvent("04", 350, "DISTRACTOR_ORIENTATION_RESPONSE", {
      latencyMs: 150
    })
  ];
  const summary = buildSessionSummary(sessionId, samples, events);

  assert.equal(summary.sampleCount, 2);
  assert.equal(summary.headMovementMean, 2);
  assert.equal(summary.trunkMovementMean, 2);
  assert.equal(summary.globalMotorActivityMean, 2);
  assert.equal(summary.offTaskOrientationPercentage, 50);
  assert.equal(summary.offTaskEpisodeCount, 1);
  assert.equal(summary.offTaskTotalTimeMs, 500);
  assert.equal(summary.meanOffTaskDurationMs, 500);
  assert.equal(summary.distractorResponseCount, 1);
  assert.equal(summary.meanDistractorOrientationLatencyMs, 150);
  assert.equal((summary.byBlock as unknown[]).length, 1);
});

function createSample(
  suffix: string,
  elapsedMs: number,
  movement: number,
  onTaskOrientation: boolean
) {
  return behaviorSampleSchema.parse({
    sampleId: `00000000-0000-4000-8000-0000000000${suffix}`,
    sessionId,
    elapsedMs,
    capturedAt: new Date(elapsedMs).toISOString(),
    scenarioId: "classroom",
    activityId: "go-no-go",
    activityState: "running-block",
    blockNumber: 1,
    condition: "none",
    trialNumber: 1,
    globalTrialNumber: 1,
    stimulus: { id: "go", type: "go" },
    distractor: {
      active: false,
      id: null,
      type: null,
      startedAtElapsedMs: null,
      endedAtElapsedMs: null
    },
    upperCamera: {
      head: {
        yaw: 0,
        pitch: 0,
        roll: 0,
        movementMagnitude: movement,
        movementVelocity: movement,
        movementVariability: 0,
        headTurnCount: 0,
        orientationDeviation: onTaskOrientation ? 2 : 22,
        offTaskEpisodeCount: onTaskOrientation ? 0 : 1,
        totalOffTaskTimeMs: onTaskOrientation ? 0 : 100,
        meanOffTaskDurationMs: onTaskOrientation ? null : 100,
        maxOffTaskDurationMs: onTaskOrientation ? null : 100,
        returnToTaskLatencyMs: null,
        onTaskOrientation,
        available: true,
        quality: "good"
      },
      trunk: {
        leanX: 0,
        leanY: 0,
        movementMagnitude: movement,
        movementVelocity: movement,
        movementVariability: 0,
        postureChangeCount: 0,
        lateralMovement: 0,
        forwardBackwardMovement: 0,
        upperBodyStability: 1,
        available: true,
        quality: "good"
      },
      available: true,
      quality: "good"
    },
    fullBodyCamera: {
      upperBodyMovement: movement,
      leftArmMovement: movement,
      rightArmMovement: movement,
      pelvisMovement: movement,
      leftLegMovement: movement,
      rightLegMovement: movement,
      leftKneeMovement: movement,
      rightKneeMovement: movement,
      leftFootMovement: movement,
      rightFootMovement: movement,
      lowerBodyMovement: movement,
      globalMotorActivity: movement,
      movementVariability: 0,
      largeMovementEpisodeCount: 0,
      available: true,
      quality: "good"
    },
    motorActivity: {
      magnitude: movement,
      velocity: movement,
      frequency: 0,
      variability: 0,
      episodeCount: 0,
      taskRelevantMovement: null,
      taskIrrelevantMovement: null,
      available: true
    },
    analysisPerformance: {
      upperAnalysisFps: 12,
      fullBodyAnalysisFps: 10,
      renderFps: 60
    }
  });
}

function createEvent(
  suffix: string,
  elapsedMs: number,
  type:
    | "OFF_TASK_ORIENTATION_START"
    | "OFF_TASK_ORIENTATION_END"
    | "RETURN_TO_TASK"
    | "DISTRACTOR_ORIENTATION_RESPONSE",
  details?: { durationMs?: number; latencyMs?: number }
) {
  return behaviorEventSchema.parse({
    eventId: `10000000-0000-4000-8000-0000000000${suffix}`,
    sessionId,
    elapsedMs,
    occurredAt: new Date(elapsedMs).toISOString(),
    type,
    scenarioId: "classroom",
    activityId: "go-no-go",
    blockNumber: 1,
    condition: "none",
    trialNumber: 1,
    details
  });
}
