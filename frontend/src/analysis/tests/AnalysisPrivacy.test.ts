import { describe, expect, it } from "vitest";

import { containsMediaPayload } from "../api/AnalysisApiClient";

describe("proteccion de payloads multimedia", () => {
  it("rechaza frames, imagenes y data URLs", () => {
    expect(containsMediaPayload({ frameData: [1, 2, 3] })).toBe(true);
    expect(containsMediaPayload({ image: "raw" })).toBe(true);
    expect(containsMediaPayload({ value: "data:image/png;base64,AAAA" })).toBe(true);
  });

  it("permite indicadores que contienen la palabra frame", () => {
    expect(
      containsMediaPayload({
        technicalTelemetry: { meanFrameTimeMs: 16.7, renderFps: 60 }
      })
    ).toBe(false);
  });
});
