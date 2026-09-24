import { describe, expect, it } from "vitest";
import { BlinkFeatureExtractor } from "../features/BlinkFeatureExtractor";
import { calculateBodyAxis, calculateFaceCenter, calculateNeckCenter, headOrientationFromMatrix } from "../features/VisionGeometry";
import { HandFeatureExtractor } from "../features/HandFeatureExtractor";
import type { HandDetection } from "../types/AnalysisTypes";

describe("pestañeo temporal", () => {
  it.each(["left", "right", "both"] as const)("registra %s solo tras cierre sostenido y reapertura", eye => {
    const blink = new BlinkFeatureExtractor();
    blink.extract(0, 0, 0);
    const left = eye === "right" ? 0 : 0.9, right = eye === "left" ? 0 : 0.9;
    expect(blink.extract(left, right, 50).events).toEqual([]);
    expect(blink.extract(left, right, 100).events).toEqual([]);
    const result = blink.extract(0, 0, 150);
    expect(result.events).toEqual([{ eye, timestamp: 150, startTime: 50, endTime: 150, durationMs: 100 }]);
    expect(result.eyes?.blinkCount).toBe(1);
    expect(result.eyes?.averageBlinkDuration).toBe(100);
    expect(blink.extract(0, 0, 200).events).toEqual([]);
  });

  it("rechaza un frame, cierre inicial, huecos, pérdida y cierre prolongado", () => {
    for (const mode of ["single", "initial", "gap", "loss", "long"] as const) {
      const b = new BlinkFeatureExtractor();
      if (mode !== "initial") b.extract(0, 0, 0);
      b.extract(0.9, 0.9, 50);
      if (mode !== "single") b.extract(0.9, 0.9, 100);
      if (mode === "loss") b.extract(null, null, 120);
      if (mode === "long") for (let t = 150; t <= 750; t += 50) b.extract(0.9, 0.9, t);
      expect(b.extract(0, 0, mode === "gap" ? 500 : mode === "long" ? 800 : 150).events).toEqual([]);
    }
  });

  it("fusiona reaperturas bilaterales en frames adyacentes y reinicia contadores", () => {
    const b = new BlinkFeatureExtractor();
    b.extract(0, 0, 0); b.extract(0.9, 0.9, 50); b.extract(0.9, 0.9, 100);
    expect(b.extract(0, 0.9, 150).events).toEqual([]);
    expect(b.extract(0, 0, 200).events[0]?.eye).toBe("both");
    b.reset(); expect(b.extract(0, 0, 250).eyes?.blinkCount).toBe(0);
  });
});

describe("geometría corporal y facial", () => {
  it("centra cabeza con varias referencias faciales y omite centros sin soporte", () => {
    const face = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }));
    face[10].y = 0.2; face[152].y = 0.8; face[234].x = 0.2; face[454].x = 0.8;
    face[1].x = 0.99;
    expect(calculateFaceCenter(face, 0.55)).toMatchObject({ x: 0.5, y: 0.5 });
    face[454].visibility = 0.1;
    expect(calculateFaceCenter(face, 0.55)).toBeNull();
    const pose = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0 }));
    pose[11].visibility = pose[12].visibility = 0.9;
    const axis = calculateBodyAxis(pose, 0.55);
    expect(axis.neckCenter).not.toBeNull();
    expect(axis.torsoCenter).toBeNull();
    expect(axis.headCenter).toBeNull();
  });
  it.each(["yaw", "pitch", "roll"] as const)("separa el eje %s para ambos sentidos", axis => {
    for (const degrees of [-30, 0, 30]) {
      const r = degrees * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
      const m = axis === "yaw" ? [c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]
        : axis === "pitch" ? [1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]
        : [c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1];
      const result = headOrientationFromMatrix(m)!;
      expect(result[axis]).toBeCloseTo(degrees);
      for (const other of ["yaw", "pitch", "roll"] as const) if (other !== axis) expect(result[other]).toBeCloseTo(0);
    }
  });
  it("rechaza matriz inválida y deriva centros sin mutar landmarks", () => {
    expect(headOrientationFromMatrix([NaN])).toBeNull();
    expect(headOrientationFromMatrix(Array(16).fill(0))).toBeNull();
    const p = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }));
    p[11].x = 0.3; p[12].x = 0.7; p[23].y = p[24].y = 0.9;
    const before = structuredClone(p);
    expect(calculateNeckCenter(p[11], p[12]).x).toBe(0.5);
    expect(calculateBodyAxis(p, 0.55).torsoCenter?.y).toBe(0.7);
    expect(p).toEqual(before);
    p[12].visibility = 0.1;
    expect(calculateBodyAxis(p, 0.55).neckCenter).toBeNull();
    p[7].visibility = 0.1;
    expect(calculateBodyAxis(p, 0.55).headCenter).toBeNull();
  });
});

describe("movimiento de manos", () => {
  it("usa tiempo real y no une trayectorias a través de pérdidas", () => {
    const extractor = new HandFeatureExtractor();
    const hand: HandDetection = { side: "left", handednessConfidence: 0.95,
      landmarks: Array.from({ length: 21 }, (_, i) => ({ x: 0.2 + i * 0.01, y: 0.3, z: 0, visibility: 1 })) };
    expect(extractor.extract([hand], 0)[0].speed).toBeNull();
    hand.landmarks[0].x += 0.1;
    expect(extractor.extract([hand], 100)[0].speed).toBeCloseTo(1);
    extractor.extract([], 200);
    hand.landmarks[0].x += 0.3;
    const recovered = extractor.extract([hand], 300)[0];
    expect(recovered.speed).toBeNull();
    expect(recovered.travelDistance).toBeCloseTo(0.1);
  });
});
