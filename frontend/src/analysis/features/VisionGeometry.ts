import type { BodyAxis, HeadOrientation, LandmarkPoint } from "../types/AnalysisTypes";
import { isUsableLandmark, midpoint } from "./FeatureMath";

export function calculateNeckCenter(leftShoulder: LandmarkPoint, rightShoulder: LandmarkPoint): LandmarkPoint {
  return { ...midpoint(leftShoulder, rightShoulder),
    visibility: Math.min(leftShoulder.visibility, rightShoulder.visibility) };
}

/** Display-only center from symmetric facial outline references. Never combine
 * Face and Pose z coordinates: their depth origins differ. */
export function calculateFaceCenter(face: LandmarkPoint[] | null, threshold: number): LandmarkPoint | null {
  const references = [10, 152, 234, 454].map(index => face?.[index]);
  if (!references.every(point => isUsableLandmark(point, threshold) &&
    point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1)) return null;
  const points = references as LandmarkPoint[];
  return { x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
    z: points.reduce((sum, p) => sum + p.z, 0) / points.length,
    visibility: Math.min(...points.map(p => p.visibility)) };
}

export function calculateBodyAxis(points: LandmarkPoint[] | null, threshold: number, aspectRatio = 1): BodyAxis {
  const pair = (a: number, b: number) => {
    const first = points?.[a], second = points?.[b];
    return isUsableLandmark(first, threshold) && isUsableLandmark(second, threshold)
      ? calculateNeckCenter(first, second) : null;
  };
  const neckCenter = pair(11, 12);
  const hips = pair(23, 24);
  const headCenter = pair(7, 8); // Ear midpoint, never the nose alone.
  const torsoCenter = neckCenter && hips ? calculateNeckCenter(neckCenter, hips) : null;
  return { headCenter, neckCenter, torsoCenter,
    torsoLateralTiltDegrees: neckCenter && hips && Math.hypot(neckCenter.x - hips.x, neckCenter.y - hips.y) > 1e-6
      ? Math.atan2((neckCenter.x - hips.x) * aspectRatio, hips.y - neckCenter.y) * 180 / Math.PI : null };
}

/** MediaPipe column-major matrix; R = Rz(roll) Ry(yaw) Rx(pitch).
 * Degrees in the unmirrored camera coordinate system; not gaze direction.
 */
export function headOrientationFromMatrix(m: readonly number[]): HeadOrientation | null {
  if (m.length !== 16 || !m.every(Number.isFinite)) return null;
  const sx = Math.hypot(m[0], m[1], m[2]);
  const sy = Math.hypot(m[4], m[5], m[6]);
  const sz = Math.hypot(m[8], m[9], m[10]);
  if (Math.min(sx, sy, sz) < 1e-6) return null;
  return {
    yaw: Math.atan2(-m[2] / sx, Math.hypot(m[0], m[1]) / sx) * 180 / Math.PI,
    pitch: Math.atan2(m[6] / sy, m[10] / sz) * 180 / Math.PI,
    roll: Math.atan2(m[1], m[0]) * 180 / Math.PI
  };
}
