import { expect, it, vi } from "vitest";
import { drawLandmarks } from "../ui/LandmarkOverlayRenderer";

it("limita CAM1 al tren superior y conserva piernas y manos en CAM2", () => {
  const context = { save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), arc: vi.fn(), fill: vi.fn() };
  const pose = Array.from({ length: 33 }, (_, i) => ({ x: i / 33, y: i / 33, z: 0, visibility: 0.9 }));
  const viewport = { x: 0, y: 0, width: 330, height: 330 };
  drawLandmarks(context as unknown as CanvasRenderingContext2D, pose, null, { ...viewport, upperBodyOnly: true });
  const upperPoints = context.arc.mock.calls.map(call => call[0]);
  expect(upperPoints).toContain(150); // wrist
  expect(upperPoints).not.toContain(270); // ankle
  context.arc.mockClear();
  const handPoints = Array.from({ length: 21 }, () => ({ x: 0.1, y: 0.1, z: 0, visibility: 1 }));
  drawLandmarks(context as unknown as CanvasRenderingContext2D, pose, null, viewport,
    1, [{ side: "left", handednessConfidence: 0.9, landmarks: handPoints }]);
  expect(context.arc.mock.calls.map(call => call[0])).toContain(270);
  expect(context.arc).toHaveBeenCalledTimes(33 + 21);
});
