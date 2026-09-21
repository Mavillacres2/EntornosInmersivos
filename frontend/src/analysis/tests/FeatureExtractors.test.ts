import { describe, expect, it } from "vitest";

import { FullBodyFeatureExtractor } from "../features/FullBodyFeatureExtractor";
import { OrientationFeatureExtractor } from "../features/OrientationFeatureExtractor";
import type { LandmarkPoint } from "../types/AnalysisTypes";

describe("feature extractors", () => {
  it("normaliza movimiento corporal por distancia entre hombros", () => {
    const nearExtractor = new FullBodyFeatureExtractor(0.55, 0.5);
    const farExtractor = new FullBodyFeatureExtractor(0.55, 0.5);

    nearExtractor.extract(createPose(0.3, 0), "good");
    farExtractor.extract(createPose(0.15, 0), "good");
    const near = nearExtractor.extract(createPose(0.3, 0.03), "good");
    const far = farExtractor.extract(createPose(0.15, 0.015), "good");

    expect(near.features.globalMotorActivity).not.toBeNull();
    expect(far.features.globalMotorActivity).not.toBeNull();
    expect(near.features.globalMotorActivity).toBeCloseTo(
      far.features.globalMotorActivity ?? 0,
      6
    );
  });

  it("marca datos ocluidos como no disponibles en lugar de convertirlos a cero", () => {
    const extractor = new FullBodyFeatureExtractor(0.55, 0.5);
    const pose = createPose(0.2, 0);

    pose[11] = { ...pose[11]!, visibility: 0.1 };
    const result = extractor.extract(pose, "low");

    expect(result.features.available).toBe(false);
    expect(result.features.globalMotorActivity).toBeNull();
  });

  it("calcula episodios relativos a una calibracion frontal", () => {
    const extractor = new OrientationFeatureExtractor(18);

    extractor.setCalibration({
      baselineYaw: 2,
      baselinePitch: -1,
      baselineRoll: 0,
      sampleCount: 20,
      calibratedAt: new Date(0).toISOString()
    });
    const start = extractor.extract({ yaw: 24, pitch: -1, roll: 0 }, 1000);
    const end = extractor.extract({ yaw: 3, pitch: -1, roll: 0 }, 1700);

    expect(start?.offTaskStarted).toBe(true);
    expect(end?.offTaskEnded).toBe(true);
    expect(end?.completedEpisodeDurationMs).toBe(700);
  });

  it("no cuenta como fuera de tarea el tiempo sin deteccion", () => {
    const extractor = new OrientationFeatureExtractor(18);

    extractor.setCalibration({
      baselineYaw: 0,
      baselinePitch: 0,
      baselineRoll: 0,
      sampleCount: 20,
      calibratedAt: new Date(0).toISOString()
    });
    extractor.extract({ yaw: 25, pitch: 0, roll: 0 }, 1000);

    expect(extractor.markUnavailable(1200)).toBe(200);
    const recovered = extractor.extract({ yaw: 0, pitch: 0, roll: 0 }, 5000);

    expect(recovered?.totalOffTaskTimeMs).toBe(200);
    expect(recovered?.offTaskEnded).toBe(false);
    expect(recovered?.returnToTaskLatencyMs).toBeNull();
  });

  it("reinicia la referencia corporal despues de una oclusion", () => {
    const extractor = new FullBodyFeatureExtractor(0.55, 0.5);

    extractor.extract(createPose(0.3, 0), "good");
    extractor.extract(null, "unavailable");
    const recovered = extractor.extract(createPose(0.3, 0.2), "good");

    expect(recovered.features.available).toBe(true);
    expect(recovered.features.globalMotorActivity).toBeNull();
    expect(recovered.largeMovementDetected).toBe(false);
  });
});

function createPose(scale: number, xShift: number): LandmarkPoint[] {
  return Array.from({ length: 33 }, (_, index) => ({
    x: 0.5 + ((index % 3) - 1) * scale * 0.25 + xShift,
    y: 0.25 + Math.floor(index / 3) * scale * 0.05,
    z: 0,
    visibility: 1
  })).map((point, index) => {
    if (index === 11) {
      return { ...point, x: 0.5 - scale / 2 + xShift };
    }
    if (index === 12) {
      return { ...point, x: 0.5 + scale / 2 + xShift };
    }
    return point;
  });
}
