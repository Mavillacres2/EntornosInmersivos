import type { LandmarkPoint } from "../types/AnalysisTypes";

export function isUsableLandmark(
  landmark: LandmarkPoint | undefined,
  minimumVisibility: number
): landmark is LandmarkPoint {
  return Boolean(
    landmark &&
      Number.isFinite(landmark.x) &&
      Number.isFinite(landmark.y) &&
      Number.isFinite(landmark.z) &&
      landmark.visibility >= minimumVisibility
  );
}

export function distance3d(first: LandmarkPoint, second: LandmarkPoint): number {
  return Math.hypot(
    first.x - second.x,
    first.y - second.y,
    first.z - second.z
  );
}

export function midpoint(
  first: LandmarkPoint,
  second: LandmarkPoint
): LandmarkPoint {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
    z: (first.z + second.z) / 2,
    visibility: Math.min(first.visibility, second.visibility)
  };
}

export function mean(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function standardDeviation(values: number[]): number | null {
  const average = mean(values);

  if (average === null) {
    return null;
  }

  const variance =
    values.reduce((total, value) => total + (value - average) ** 2, 0) /
    values.length;

  return Math.sqrt(variance);
}

export function pushRolling(
  target: number[],
  value: number | null,
  maxLength = 60
): void {
  if (value === null || !Number.isFinite(value)) {
    return;
  }

  target.push(value);

  if (target.length > maxLength) {
    target.splice(0, target.length - maxLength);
  }
}

export function finiteOrNull(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}
