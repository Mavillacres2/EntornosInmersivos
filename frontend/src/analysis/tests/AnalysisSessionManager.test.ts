import { describe, expect, it, vi } from "vitest";

import type { AnalysisApiClient } from "../api/AnalysisApiClient";
import { AnalysisSessionManager } from "../tracking/AnalysisSessionManager";

describe("AnalysisSessionManager", () => {
  it("deduplica solicitudes concurrentes sin perder la configuracion mas reciente", async () => {
    let releaseFirstRequest!: () => void;
    const createSession = vi
      .fn<(payload: unknown) => Promise<unknown>>()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseFirstRequest = () => resolve({});
          })
      )
      .mockResolvedValue({});
    const manager = new AnalysisSessionManager({
      createSession
    } as unknown as AnalysisApiClient);

    const creating = manager.createSession("P001");

    await Promise.resolve();
    const updating = manager.updateCameraConfiguration(true, true);

    releaseFirstRequest();
    await Promise.all([creating, updating]);

    expect(createSession).toHaveBeenCalledTimes(2);
    expect(createSession.mock.calls[1]?.[0]).toMatchObject({
      cameraConfiguration: {
        upperBodyCameraConfigured: true,
        fullBodyCameraConfigured: true
      }
    });
    manager.dispose();
  });
});
