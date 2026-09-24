import { z } from "zod";

const finiteNumber = z.number().finite();
const nullableFiniteNumber = finiteNumber.nullable();
const nullableShortString = z.string().trim().min(1).max(120).nullable();

export const qualitySchema = z.enum(["good", "fair", "low", "unavailable"]);

export const headFeaturesSchema = z
  .object({
    yaw: nullableFiniteNumber,
    pitch: nullableFiniteNumber,
    roll: nullableFiniteNumber,
    movementMagnitude: nullableFiniteNumber,
    movementVelocity: nullableFiniteNumber,
    movementVariability: nullableFiniteNumber,
    headTurnCount: z.number().int().nonnegative(),
    orientationDeviation: nullableFiniteNumber,
    offTaskEpisodeCount: z.number().int().nonnegative(),
    totalOffTaskTimeMs: finiteNumber.nonnegative(),
    meanOffTaskDurationMs: nullableFiniteNumber,
    maxOffTaskDurationMs: nullableFiniteNumber,
    returnToTaskLatencyMs: nullableFiniteNumber,
    onTaskOrientation: z.boolean().nullable(),
    available: z.boolean(),
    quality: qualitySchema
  })
  .strict();

export const trunkFeaturesSchema = z
  .object({
    leanX: nullableFiniteNumber,
    leanY: nullableFiniteNumber,
    movementMagnitude: nullableFiniteNumber,
    movementVelocity: nullableFiniteNumber,
    movementVariability: nullableFiniteNumber,
    postureChangeCount: z.number().int().nonnegative(),
    lateralMovement: nullableFiniteNumber,
    forwardBackwardMovement: nullableFiniteNumber,
    upperBodyStability: nullableFiniteNumber,
    available: z.boolean(),
    quality: qualitySchema
  })
  .strict();

export const fullBodyFeaturesSchema = z
  .object({
    upperBodyMovement: nullableFiniteNumber,
    leftArmMovement: nullableFiniteNumber,
    rightArmMovement: nullableFiniteNumber,
    pelvisMovement: nullableFiniteNumber,
    leftLegMovement: nullableFiniteNumber,
    rightLegMovement: nullableFiniteNumber,
    leftKneeMovement: nullableFiniteNumber,
    rightKneeMovement: nullableFiniteNumber,
    leftFootMovement: nullableFiniteNumber,
    rightFootMovement: nullableFiniteNumber,
    lowerBodyMovement: nullableFiniteNumber,
    globalMotorActivity: nullableFiniteNumber,
    movementVariability: nullableFiniteNumber,
    largeMovementEpisodeCount: z.number().int().nonnegative(),
    available: z.boolean(),
    quality: qualitySchema
  })
  .strict();

export const movementFeaturesSchema = z
  .object({
    magnitude: nullableFiniteNumber,
    velocity: nullableFiniteNumber,
    frequency: nullableFiniteNumber,
    variability: nullableFiniteNumber,
    episodeCount: z.number().int().nonnegative(),
    taskRelevantMovement: nullableFiniteNumber,
    taskIrrelevantMovement: nullableFiniteNumber,
    available: z.boolean()
  })
  .strict();

const eyeMetricsSchema = z.object({
  timestampMs: finiteNumber.nonnegative(), leftOpen: finiteNumber.min(0).max(1), rightOpen: finiteNumber.min(0).max(1),
  leftBlink: z.boolean(), rightBlink: z.boolean(), blinkCount: z.number().int().nonnegative(),
  leftBlinkCount: z.number().int().nonnegative(), rightBlinkCount: z.number().int().nonnegative(),
  blinksPerMinute: finiteNumber.nonnegative().nullable(), averageBlinkDuration: finiteNumber.nonnegative().nullable(),
  observedMs: finiteNumber.nonnegative()
}).strict();

export const visionMetricsSchema = z.object({
  face: z.object({ source: z.literal("face-camera"), timestampMs: finiteNumber.nonnegative(),
    eyes: eyeMetricsSchema.nullable() }).strict().nullable(),
  body: z.object({ source: z.literal("body-camera"), timestampMs: finiteNumber.nonnegative(),
    poseTimestampMs: finiteNumber.nonnegative().nullable(),
    handsTimestampMs: finiteNumber.nonnegative().nullable(),
    torsoLateralTiltDegrees: nullableFiniteNumber,
    hands: z.array(z.object({
      side: z.enum(["left", "right"]), handednessConfidence: finiteNumber.min(0).max(1),
      position: z.object({ x: finiteNumber.min(0).max(1), y: finiteNumber.min(0).max(1) }).strict(),
      speed: finiteNumber.nonnegative().nullable(), travelDistance: finiteNumber.nonnegative(),
      openness: finiteNumber.min(0).max(1).nullable()
    }).strict()).max(2)
  }).strict().nullable()
}).strict();

export const behaviorSampleSchema = z
  .object({
    vision: visionMetricsSchema.optional(),
    trunkSource: z.enum(["body-camera", "upper-camera"]).optional(),
    sampleId: z.uuid(),
    sessionId: z.uuid(),
    elapsedMs: finiteNumber.nonnegative(),
    capturedAt: z.iso.datetime(),
    scenarioId: nullableShortString,
    activityId: nullableShortString,
    activityState: nullableShortString,
    blockNumber: z.number().int().positive().nullable(),
    condition: nullableShortString,
    trialNumber: z.number().int().positive().nullable(),
    globalTrialNumber: z.number().int().positive().nullable(),
    stimulus: z
      .object({
        id: nullableShortString,
        type: nullableShortString
      })
      .strict(),
    distractor: z
      .object({
        active: z.boolean(),
        id: nullableShortString,
        type: nullableShortString,
        startedAtElapsedMs: nullableFiniteNumber,
        endedAtElapsedMs: nullableFiniteNumber
      })
      .strict(),
    upperCamera: z
      .object({
        head: headFeaturesSchema,
        trunk: trunkFeaturesSchema,
        available: z.boolean(),
        quality: qualitySchema
      })
      .strict(),
    fullBodyCamera: fullBodyFeaturesSchema,
    motorActivity: movementFeaturesSchema,
    analysisPerformance: z
      .object({
        upperAnalysisFps: finiteNumber.nonnegative(),
        fullBodyAnalysisFps: finiteNumber.nonnegative(),
        renderFps: nullableFiniteNumber
      })
      .strict()
  })
  .strict();

export const behaviorEventTypeSchema = z.enum([
  "BLINK",
  "OFF_TASK_ORIENTATION_START",
  "OFF_TASK_ORIENTATION_END",
  "HEAD_TURN",
  "POSTURE_CHANGE",
  "LARGE_BODY_MOVEMENT",
  "DISTRACTOR_STARTED",
  "DISTRACTOR_ENDED",
  "DISTRACTOR_ORIENTATION_RESPONSE",
  "RETURN_TO_TASK",
  "CAMERA_DISCONNECTED",
  "CAMERA_RECONNECTED",
  "ANALYSIS_ERROR",
  "BUFFER_OVERFLOW"
]);

export const behaviorEventSchema = z
  .object({
    eventId: z.uuid(),
    sessionId: z.uuid(),
    elapsedMs: finiteNumber.nonnegative(),
    occurredAt: z.iso.datetime(),
    type: behaviorEventTypeSchema,
    scenarioId: nullableShortString,
    activityId: nullableShortString,
    blockNumber: z.number().int().positive().nullable(),
    condition: nullableShortString,
    trialNumber: z.number().int().positive().nullable(),
    details: z
      .object({
        eye: z.enum(["left", "right", "both"]).optional(),
        startTime: finiteNumber.nonnegative().optional(),
        endTime: finiteNumber.nonnegative().optional(),
        distractorId: nullableShortString.optional(),
        distractorType: nullableShortString.optional(),
        durationMs: nullableFiniteNumber.optional(),
        latencyMs: nullableFiniteNumber.optional(),
        cameraRole: z.enum(["upper-body", "full-body"]).optional(),
        message: z.string().trim().max(300).optional()
      })
      .strict()
      .optional()
  })
  .strict();

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string().max(10_000),
    finiteNumber,
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema).max(10_000),
    z.record(z.string().max(120), jsonValueSchema)
  ])
);

export const createSessionSchema = z
  .object({
    sessionId: z.uuid(),
    participantCode: z
      .string()
      .trim()
      .min(2)
      .max(40)
      .regex(/^[A-Za-z0-9_-]+$/),
    startedAt: z.iso.datetime(),
    cameraConfiguration: z
      .object({
        upperBodyCameraConfigured: z.boolean(),
        fullBodyCameraConfigured: z.boolean()
      })
      .strict()
  })
  .strict();

export const activityResultSchema = z
  .object({
    resultId: z.uuid(),
    scenarioId: z.string().trim().min(1).max(120),
    activityId: z.string().trim().min(1).max(120),
    completedAt: z.iso.datetime(),
    result: z.record(z.string().max(120), jsonValueSchema)
  })
  .strict();

export const finishSessionSchema = z
  .object({
    finishedAt: z.iso.datetime(),
    scenariosCompleted: z.array(z.string().trim().min(1).max(120)).max(20)
  })
  .strict();

export function createBehaviorBatchSchema(maxBatchSize: number) {
  return z
    .object({
      samples: z.array(behaviorSampleSchema).min(1).max(maxBatchSize)
    })
    .strict();
}

export function createEventBatchSchema(maxBatchSize: number) {
  return z
    .object({
      events: z.array(behaviorEventSchema).min(1).max(maxBatchSize)
    })
    .strict();
}

const forbiddenMediaKeys = new Set([
  "frame",
  "frames",
  "framebuffer",
  "framedata",
  "video",
  "videodata",
  "image",
  "images",
  "imagedata",
  "jpeg",
  "png",
  "screenshot",
  "blob",
  "mediastream",
  "base64",
  "dataurl",
  "pixels",
  "pixeldata"
]);
const forbiddenMediaValue = /^data:(image|video)\//i;

export function containsForbiddenMediaData(value: unknown): boolean {
  if (typeof value === "string") {
    return forbiddenMediaValue.test(value);
  }

  if (Array.isArray(value)) {
    return value.some((item) => containsForbiddenMediaData(item));
  }

  if (!value || typeof value !== "object") {
    return false;
  }

  return Object.entries(value).some(
    ([key, child]) =>
      forbiddenMediaKeys.has(key.replace(/[-_\s]/g, "").toLowerCase()) ||
      containsForbiddenMediaData(child)
  );
}

export type BehaviorSampleDto = z.infer<typeof behaviorSampleSchema>;
export type BehaviorEventDto = z.infer<typeof behaviorEventSchema>;
export type CreateSessionDto = z.infer<typeof createSessionSchema>;
export type ActivityResultDto = z.infer<typeof activityResultSchema>;
export type FinishSessionDto = z.infer<typeof finishSessionSchema>;
