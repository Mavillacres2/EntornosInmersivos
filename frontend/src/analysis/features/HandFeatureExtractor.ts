import { VISION_CONFIG } from "../config/AnalysisConfig";
import type { HandDetection, HandMetrics } from "../types/AnalysisTypes";

export class HandFeatureExtractor {
  private previous = new Map<string, { x: number; y: number; timestamp: number }>();
  private travel = new Map<string, number>();

  extract(hands: HandDetection[], timestamp: number): HandMetrics[] {
    for (const side of this.previous.keys()) {
      if (!hands.some(h => h.side === side)) this.previous.delete(side);
    }
    return hands.map(hand => {
      const p = hand.landmarks;
      const wrist = p[0];
      const previous = this.previous.get(hand.side);
      const dt = previous ? timestamp - previous.timestamp : 0;
      const step = previous && dt > 0 && dt <= VISION_CONFIG.detectionTimeoutMs
        ? Math.hypot(wrist.x - previous.x, wrist.y - previous.y) : null;
      const travelDistance = (this.travel.get(hand.side) ?? 0) + (step ?? 0);
      this.travel.set(hand.side, travelDistance);
      this.previous.set(hand.side, { x: wrist.x, y: wrist.y, timestamp });
      // Mean tip-to-base / articulated finger length. Dimensionless, not a gesture label.
      const ratios = [[1,2,3,4], [5,6,7,8], [9,10,11,12], [13,14,15,16], [17,18,19,20]].map(ids => {
        const distance = (a: number, b: number) => Math.hypot(p[a].x-p[b].x, p[a].y-p[b].y, p[a].z-p[b].z);
        const length = distance(ids[0],ids[1])+distance(ids[1],ids[2])+distance(ids[2],ids[3]);
        return length > 1e-6 ? Math.min(1, distance(ids[0],ids[3])/length) : null;
      });
      return { side: hand.side, handednessConfidence: hand.handednessConfidence,
        position: { x: wrist.x, y: wrist.y }, speed: step === null ? null : step * 1000 / dt,
        travelDistance, openness: ratios.every(r => r !== null)
          ? ratios.reduce((a,b) => a! + b!, 0)! / 5 : null };
    });
  }

  reset(): void { this.previous.clear(); this.travel.clear(); }
}
