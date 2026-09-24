import { VISION_CONFIG } from "../config/AnalysisConfig";
import type { BlinkEvent, EyeMetrics } from "../types/AnalysisTypes";

/** Closure must contain two distinct samples, followed by reopening.
 * Bilateral overlapping closures are one event. Gaps cancel partial events.
 */
export class BlinkFeatureExtractor {
  private lastTime: number | null = null;
  private observedMs = 0;
  private count = 0;
  private leftCount = 0;
  private rightCount = 0;
  private durationTotal = 0;
  private states = { left: this.emptyEye(), right: this.emptyEye() };
  private pending: { start: number; end: number; left: boolean; right: boolean } | null = null;

  extract(left: number | null, right: number | null, timestamp: number):
    { eyes: EyeMetrics | null; events: BlinkEvent[] } {
    if (left === null || right === null || !Number.isFinite(left) || !Number.isFinite(right) ||
        left < 0 || left > 1 || right < 0 || right > 1) {
      this.markUnavailable();
      return { eyes: null, events: [] };
    }
    const gap = this.lastTime === null ? null : timestamp - this.lastTime;
    if (gap !== null && (gap <= 0 || gap > VISION_CONFIG.blinkMaxSampleGapMs)) {
      this.markUnavailable();
    } else if (gap !== null) {
      this.observedMs += gap;
    }
    this.lastTime = timestamp;
    for (const side of ["left", "right"] as const) {
      const score = side === "left" ? left : right;
      const state = this.states[side];
      if (score <= VISION_CONFIG.blinkOpenThreshold) {
        if (state.start !== null) {
          const duration = timestamp - state.start;
          if (state.samples >= 2 && duration >= VISION_CONFIG.blinkMinDurationMs &&
              duration <= VISION_CONFIG.blinkMaxDurationMs) {
            this.pending ??= { start: state.start, end: timestamp, left: false, right: false };
            this.pending.start = Math.min(this.pending.start, state.start);
            this.pending.end = timestamp;
            this.pending[side] = true;
          }
        }
        this.states[side] = { start: null, samples: 0, armed: true };
      } else if (score >= VISION_CONFIG.blinkCloseThreshold && state.armed) {
        state.start ??= timestamp;
        state.samples += 1;
        if (timestamp - state.start > VISION_CONFIG.blinkMaxDurationMs) {
          this.states[side] = this.emptyEye();
        }
      }
    }
    const events: BlinkEvent[] = [];
    if (this.pending && this.states.left.start === null && this.states.right.start === null) {
      const p = this.pending;
      const event: BlinkEvent = { timestamp: p.end, startTime: p.start, endTime: p.end,
        durationMs: p.end - p.start, eye: p.left && p.right ? "both" : p.left ? "left" : "right" };
      events.push(event);
      this.count++;
      if (p.left) this.leftCount++;
      if (p.right) this.rightCount++;
      this.durationTotal += event.durationMs;
      this.pending = null;
    }
    return { events, eyes: {
      timestampMs: timestamp, leftOpen: 1 - left, rightOpen: 1 - right,
      leftBlink: this.states.left.start !== null, rightBlink: this.states.right.start !== null,
      blinkCount: this.count, leftBlinkCount: this.leftCount, rightBlinkCount: this.rightCount,
      observedMs: this.observedMs,
      blinksPerMinute: this.observedMs > 0 ? this.count * 60000 / this.observedMs : null,
      averageBlinkDuration: this.count ? this.durationTotal / this.count : null
    } };
  }

  markUnavailable(): void {
    this.lastTime = null;
    this.states = { left: this.emptyEye(), right: this.emptyEye() };
    this.pending = null;
  }

  reset(): void {
    this.markUnavailable();
    this.count = this.leftCount = this.rightCount = this.observedMs = this.durationTotal = 0;
  }

  private emptyEye() { return { start: null as number | null, samples: 0, armed: false }; }
}
