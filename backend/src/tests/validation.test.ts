import assert from "node:assert/strict";
import test from "node:test";

import {
  activityResultSchema,
  containsForbiddenMediaData,
  createSessionSchema,
  headFeaturesSchema
} from "../validation/schemas.js";
import { visionMetricsSchema, behaviorEventSchema } from "../validation/schemas.js";

test("vision accepts bounded derived metrics and rejects images, raw landmarks and invalid scores", () => {
  const vision = { face: null, body: {
    source: "body-camera", timestampMs: 500, poseTimestampMs: 400, handsTimestampMs: 500,
    torsoLateralTiltDegrees: 10,
    hands: [{ side: "left", handednessConfidence: 0.9, position: { x: 0.5, y: 0.4 },
      speed: 0.1, travelDistance: 0.2, openness: 0.8 }]
  } };
  assert.equal(visionMetricsSchema.safeParse(vision).success, true);
  assert.equal(visionMetricsSchema.safeParse({ ...vision, image: "raw" }).success, false);
  assert.equal(visionMetricsSchema.safeParse({ ...vision, body: { ...vision.body, landmarks: [] } }).success, false);
  vision.body.hands[0]!.handednessConfidence = 2;
  assert.equal(visionMetricsSchema.safeParse(vision).success, false);
});

test("blink event preserves session-relative timing and eye", () => {
  const event = { eventId: "00000000-0000-4000-8000-000000000001",
    sessionId: "00000000-0000-4000-8000-000000000002", elapsedMs: 200,
    occurredAt: new Date(0).toISOString(), type: "BLINK", scenarioId: null,
    activityId: null, blockNumber: null, condition: null, trialNumber: null,
    details: { eye: "both", startTime: 100, endTime: 200, durationMs: 100 } };
  assert.equal(behaviorEventSchema.safeParse(event).success, true);
});

test("privacy filter rejects multimedia but permits frame timing metrics", () => {
  assert.equal(containsForbiddenMediaData({ frameData: [1, 2, 3] }), true);
  assert.equal(containsForbiddenMediaData({ image: "raw" }), true);
  assert.equal(
    containsForbiddenMediaData({ value: "data:video/mp4;base64,AAAA" }),
    true
  );
  assert.equal(
    containsForbiddenMediaData({ technicalTelemetry: { meanFrameTimeMs: 16.7 } }),
    false
  );
});

test("activity result accepts finite telemetry and rejects media fields", () => {
  const base = {
    resultId: "00000000-0000-4000-8000-000000000001",
    scenarioId: "interactive-museum",
    activityId: "visual-discrimination",
    completedAt: new Date(0).toISOString()
  };

  assert.equal(
    activityResultSchema.safeParse({
      ...base,
      result: { technicalTelemetry: { meanFrameTimeMs: 16.7 } }
    }).success,
    true
  );
  assert.equal(containsForbiddenMediaData({ ...base, result: { frames: [] } }), true);
});

test("DTOs reject arbitrary fields and non-finite numbers", () => {
  const session = {
    sessionId: "00000000-0000-4000-8000-000000000001",
    participantCode: "P001",
    startedAt: new Date(0).toISOString(),
    cameraConfiguration: {
      upperBodyCameraConfigured: true,
      fullBodyCameraConfigured: false
    },
    unexpected: true
  };
  const head = {
    yaw: Number.NaN,
    pitch: 0,
    roll: 0,
    movementMagnitude: 0,
    movementVelocity: 0,
    movementVariability: 0,
    headTurnCount: 0,
    orientationDeviation: 0,
    offTaskEpisodeCount: 0,
    totalOffTaskTimeMs: 0,
    meanOffTaskDurationMs: null,
    maxOffTaskDurationMs: null,
    returnToTaskLatencyMs: null,
    onTaskOrientation: true,
    available: true,
    quality: "good"
  };

  assert.equal(createSessionSchema.safeParse(session).success, false);
  assert.equal(headFeaturesSchema.safeParse(head).success, false);
});
