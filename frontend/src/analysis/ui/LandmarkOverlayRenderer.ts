import { FaceLandmarker, HandLandmarker } from "@mediapipe/tasks-vision";
import { ANALYSIS_CONFIG } from "../config/AnalysisConfig";
import { calculateBodyAxis, calculateFaceCenter } from "../features/VisionGeometry";
import type { HandDetection, HeadOrientation } from "../types/AnalysisTypes";
import type { LandmarkPoint } from "../types/AnalysisTypes";

const POSE_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [27, 29],
  [29, 31],
  [24, 26],
  [26, 28],
  [28, 30],
  [30, 32]
];

export interface LandmarkViewport {
  x: number;
  y: number;
  width: number;
  height: number;
  mirrorX?: boolean;
  upperBodyOnly?: boolean;
}

export function drawLandmarks(
  context: CanvasRenderingContext2D,
  pose: LandmarkPoint[] | null,
  face: LandmarkPoint[] | null,
  viewport: LandmarkViewport,
  displayScale = 1,
  hands: HandDetection[] = [],
  head: HeadOrientation | null = null,
  debug = false
): void {
  const mapPoint = (point: LandmarkPoint): { x: number; y: number } => ({
    x:
      viewport.x +
      (viewport.mirrorX ? 1 - point.x : point.x) * viewport.width,
    y: viewport.y + point.y * viewport.height
  });

  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = 2 * displayScale;
  context.strokeStyle = "#43d8ee";

  POSE_CONNECTIONS.forEach(([fromIndex, toIndex]) => {
    if (viewport.upperBodyOnly && (fromIndex > 24 || toIndex > 24)) return;
    const from = pose?.[fromIndex];
    const to = pose?.[toIndex];

    if (!isVisibleLandmark(from) || !isVisibleLandmark(to)) {
      return;
    }

    const start = mapPoint(from);
    const end = mapPoint(to);

    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
  });

  context.fillStyle = "#f6c453";
  pose?.forEach((point, index) => {
    if (viewport.upperBodyOnly && ![7, 8, 11, 12, 13, 14, 15, 16, 23, 24].includes(index)) return;
    if (!isVisibleLandmark(point)) {
      return;
    }

    const mapped = mapPoint(point);

    context.beginPath();
    context.arc(mapped.x, mapped.y, 3 * displayScale, 0, Math.PI * 2);
    context.fill();
  });

  const line = (from: LandmarkPoint | null | undefined, to: LandmarkPoint | null | undefined, color: string) => {
    if (!from || !to || !isVisibleLandmark(from) || !isVisibleLandmark(to)) return;
    const a = mapPoint(from), b = mapPoint(to);
    context.strokeStyle = color;
    context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.stroke();
  };
  const connections = (points: LandmarkPoint[] | null, edges: { start: number; end: number }[], color: string) => {
    edges.forEach(e => line(points?.[e.start], points?.[e.end], color));
  };
  context.lineWidth = displayScale;
  connections(face, FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, "#b5a1d4");
  connections(face, FaceLandmarker.FACE_LANDMARKS_LIPS, "#b5a1d4");
  connections(face, FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW, "#b5a1d4");
  connections(face, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW, "#b5a1d4");
  for (const edges of [FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
    FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS, FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS]) connections(face, edges, "#dfa1c5");
  line(face?.[168], face?.[1], "#b5a1d4");
  const faceCenter = viewport.upperBodyOnly
    ? calculateFaceCenter(face, ANALYSIS_CONFIG.mediaPipe.minimumVisibility) : null;
  const center = viewport.upperBodyOnly ? faceCenter : face?.[168];
  if (center && head) {
    const yaw = head.yaw * Math.PI / 180, pitch = head.pitch * Math.PI / 180;
    line(center, { ...center, x: center.x + Math.sin(yaw) * 0.13,
      y: center.y - Math.sin(pitch) * 0.13 + 0.06 }, "#9ecded");
    const roll = head.roll * Math.PI / 180;
    line({ ...center, x: center.x - Math.cos(roll) * 0.035, y: center.y - Math.sin(roll) * 0.035 },
      { ...center, x: center.x + Math.cos(roll) * 0.035, y: center.y + Math.sin(roll) * 0.035 }, "#9ecded");
  }
  for (const hand of hands) {
    connections(hand.landmarks, HandLandmarker.HAND_CONNECTIONS, "#e2bf75");
    context.fillStyle = "#e2bf75";
    hand.landmarks.forEach(p => {
      const m = mapPoint(p); context.beginPath(); context.arc(m.x, m.y, 2 * displayScale, 0, Math.PI * 2); context.fill();
    });
  }
  const axis = calculateBodyAxis(pose, ANALYSIS_CONFIG.mediaPipe.minimumVisibility);
  const headCenter = faceCenter ?? axis.headCenter;
  line(headCenter, axis.neckCenter, "#9ecded");
  line(axis.neckCenter, axis.torsoCenter, "#9ecded");
  if (viewport.upperBodyOnly) {
    context.fillStyle = "#9ecded";
    for (const point of [headCenter, axis.neckCenter, axis.torsoCenter]) {
      if (!point || !isVisibleLandmark(point)) continue;
      const mapped = mapPoint(point);
      context.beginPath(); context.arc(mapped.x, mapped.y, 3 * displayScale, 0, Math.PI * 2); context.fill();
    }
  }
  if (debug) {
    context.fillStyle = "#e3d5f2";
    context.font = `${8 * displayScale}px monospace`;
    face?.forEach((p, i) => { const m = mapPoint(p); context.fillText(String(i), m.x, m.y); });
    if (head) context.fillText(`yaw ${head.yaw.toFixed(1)} pitch ${head.pitch.toFixed(1)} roll ${head.roll.toFixed(1)}`, viewport.x + 5, viewport.y + viewport.height - 8);
  }
  context.restore();
}

export function hasVisibleLandmarks(
  pose: LandmarkPoint[] | null,
  face: LandmarkPoint[] | null
): boolean {
  return Boolean(
    pose?.some((point) => isVisibleLandmark(point)) || (face?.length ?? 0) > 0
  );
}

function isVisibleLandmark(
  point: LandmarkPoint | undefined
): point is LandmarkPoint {
  return Boolean(point && point.visibility >= ANALYSIS_CONFIG.mediaPipe.minimumVisibility &&
    [point.x, point.y, point.z].every(Number.isFinite));
}
