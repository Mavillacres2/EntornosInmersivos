import { HandLandmarker } from "@mediapipe/tasks-vision";
import { VISION_CONFIG } from "../config/AnalysisConfig";
import type { HandDetection } from "../types/AnalysisTypes";

type VisionFileset = Parameters<typeof HandLandmarker.createFromOptions>[0];

export class HandAnalysisService {
  private model: HandLandmarker | null = null;
  private lastTimestamp = -Infinity;
  error: string | null = null;

  async initialize(fileset: VisionFileset, modelUrl: string): Promise<void> {
    this.close();
    const create = (delegate: "GPU" | "CPU") => HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: modelUrl, delegate }, runningMode: "VIDEO", numHands: 2,
      minHandDetectionConfidence: VISION_CONFIG.handConfidence,
      minHandPresenceConfidence: VISION_CONFIG.handConfidence,
      minTrackingConfidence: VISION_CONFIG.handConfidence
    });
    try {
      try { this.model = await create("GPU"); }
      catch { this.model = await create("CPU"); }
      this.error = null;
    } catch (error) {
      this.error = "No se pudo cargar la detección de manos.";
      console.warn(this.error, error);
    }
  }

  analyze(video: HTMLVideoElement, timestamp: number): HandDetection[] {
    if (!this.model || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return [];
    this.lastTimestamp = Math.max(timestamp, this.lastTimestamp + 0.001);
    try {
      const result = this.model.detectForVideo(video, this.lastTimestamp);
      this.error = null;
      const hands: HandDetection[] = [];
      result.landmarks.forEach((points, index) => {
        const category = result.handedness[index]?.[0];
        if (!category || !Number.isFinite(category.score) || category.score < VISION_CONFIG.handednessConfidence || points.length !== 21 ||
          points.some(p => ![p.x, p.y, p.z].every(Number.isFinite) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1)) return;
        const side = category.categoryName === "Left" ? "left" : category.categoryName === "Right" ? "right" : null;
        if (!side) return;
        const hand: HandDetection = { side, handednessConfidence: category.score,
          landmarks: points.map(p => ({ x: p.x, y: p.y, z: p.z, visibility: 1 })) };
        const existing = hands.findIndex(h => h.side === side);
        if (existing < 0) hands.push(hand);
        else if (hands[existing].handednessConfidence < category.score) hands[existing] = hand;
      });
      return hands;
    } catch (error) {
      this.error = "No se pudieron analizar las manos.";
      console.warn(this.error, error);
      return [];
    }
  }

  close(): void {
    this.model?.close();
    this.model = null;
    this.lastTimestamp = -Infinity;
  }
}
