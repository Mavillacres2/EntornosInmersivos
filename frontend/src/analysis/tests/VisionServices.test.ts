import { afterEach, describe, expect, it, vi } from "vitest";
import { ANALYSIS_CONFIG } from "../config/AnalysisConfig";
import { MediaPipeManager } from "../mediapipe/MediaPipeManager";
import { HandAnalysisService } from "../mediapipe/HandAnalysisService";
import { FaceAnalysisService } from "../mediapipe/FaceAnalysisService";
import type { PoseAnalysisService } from "../mediapipe/PoseAnalysisService";

const points = (count: number) => Array.from({ length: count }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }));
const video = () => ({ srcObject: {}, readyState: 2, videoWidth: 640, videoHeight: 480, currentTime: 0 }) as HTMLVideoElement;
afterEach(() => vi.unstubAllGlobals());

describe("servicios de visión", () => {
  it("alterna Pose/Hands, no infiere dos veces el mismo frame y caduca resultados", () => {
    const manager = new MediaPipeManager(ANALYSIS_CONFIG);
    const internal = manager as unknown as { fullBodyPoseService: PoseAnalysisService; handService: HandAnalysisService };
    const pose = vi.spyOn(internal.fullBodyPoseService, "analyze").mockImplementation((_video, time) => ({
      landmarks: points(33), quality: "good", requiredLandmarksVisible: true,
      diagnostics: { detectionAttempted: true, poseDetected: true, landmarkCount: 33,
        averageVisibility: 0.9, detectionTimestampMs: time, error: null }
    }));
    const hands = vi.spyOn(internal.handService, "analyze").mockReturnValue([
      { side: "left", handednessConfidence: 0.9, landmarks: points(21) }
    ]);
    const v = video();
    expect(manager.analyzeFullBody(v, 10).poseUpdated).toBe(true);
    expect(manager.analyzeFullBody(v, 20).handsUpdated).toBe(false);
    v.currentTime = 0.1;
    expect(manager.analyzeFullBody(v, 100).hands?.length).toBe(1);
    expect(pose).toHaveBeenCalledTimes(1);
    expect(hands).toHaveBeenCalledTimes(1);
    const stale = manager.analyzeFullBody(v, 1000);
    expect(stale.hands).toEqual([]);
    expect(stale.poseLandmarks).toBeNull();
    v.srcObject = {} as MediaStream; v.currentTime = 0.2;
    const switched = manager.analyzeFullBody(v, 1100);
    expect(switched.hands).toEqual([]);
    expect(switched.poseUpdated).toBe(true);
    manager.dispose();
  });

  it("descarta mano parcial o lateralidad incierta y recupera 21 puntos sin inventarlos", () => {
    const service = new HandAnalysisService();
    const result = { landmarks: [points(21)], handedness: [[{ categoryName: "Left", score: 0.95 }]] };
    Object.assign(service, { model: { detectForVideo: () => result, close: () => undefined } });
    expect(service.analyze(video(), 0)[0]?.landmarks).toHaveLength(21);
    result.landmarks[0][20].x = 1.2;
    expect(service.analyze(video(), 10)).toEqual([]);
    result.landmarks[0][20].x = 0.5;
    result.handedness[0][0].score = 0.4;
    expect(service.analyze(video(), 20)).toEqual([]);
    result.handedness[0][0].score = 0.95;
    expect(service.analyze(video(), 30)[0]?.side).toBe("left");
    service.close();
    expect(service.analyze(video(), 40)).toEqual([]);
  });

  it("limpia rostro y orientación al perder detección, sin repetir inferencia", () => {
    vi.stubGlobal("HTMLMediaElement", { HAVE_CURRENT_DATA: 2 });
    const service = new FaceAnalysisService();
    const result = { faceLandmarks: [points(478)], faceBlendshapes: [],
      facialTransformationMatrixes: [{ data: [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1] }] };
    const detect = vi.fn(() => result);
    Object.assign(service, { landmarker: { detectForVideo: detect, close: () => undefined } });
    const v = video();
    expect(service.analyze(v, 0).landmarks).toHaveLength(478);
    expect(service.analyze(v, 10).orientation).toBeNull();
    expect(detect).toHaveBeenCalledTimes(1);
    result.faceLandmarks = []; v.currentTime = 0.1;
    expect(service.analyze(v, 100).landmarks).toBeNull();
    service.close();
  });
});
