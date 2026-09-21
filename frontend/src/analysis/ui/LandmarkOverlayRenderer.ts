import type { LandmarkPoint } from "../types/AnalysisTypes";

const POSE_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [7, 11],
  [8, 12],
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
}

export function drawLandmarks(
  context: CanvasRenderingContext2D,
  pose: LandmarkPoint[] | null,
  face: LandmarkPoint[] | null,
  viewport: LandmarkViewport,
  displayScale = 1
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
  pose?.forEach((point) => {
    if (!isVisibleLandmark(point)) {
      return;
    }

    const mapped = mapPoint(point);

    context.beginPath();
    context.arc(mapped.x, mapped.y, 3 * displayScale, 0, Math.PI * 2);
    context.fill();
  });

  context.fillStyle = "#ef6c8f";
  face?.forEach((point) => {
    const mapped = mapPoint(point);

    context.beginPath();
    context.arc(mapped.x, mapped.y, 4 * displayScale, 0, Math.PI * 2);
    context.fill();
  });
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
  return Boolean(point && point.visibility >= 0.2);
}
