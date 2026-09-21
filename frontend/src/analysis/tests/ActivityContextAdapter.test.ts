import { describe, expect, it, vi } from "vitest";

import { ActivityContextAdapter } from "../synchronization/ActivityContextAdapter";

describe("ActivityContextAdapter", () => {
  it("sincroniza escenario, bloque, ensayo y distractor con tiempo de sesion", () => {
    const adapter = new ActivityContextAdapter();
    const listener = vi.fn();

    adapter.startSession("session-1", 1000);
    adapter.setScenario("classroom", "go-no-go");
    adapter.onEvent(listener);
    const telemetry = adapter.createTelemetrySink("classroom", "go-no-go");

    telemetry.onStateChange("running-block");
    telemetry.onBlockStart({ blockNumber: 2, condition: "visual" });
    telemetry.onTrialStart({
      trialNumber: 4,
      globalTrialNumber: 19,
      stimulusId: "go",
      stimulusType: "go"
    });
    telemetry.onDistractor({
      distractorId: "visual-2-4",
      distractorType: "visual",
      startedAt: 1200,
      endedAt: 1500
    });

    const active = adapter.getContext(1300);
    const ended = adapter.getContext(1600);

    expect(active).toMatchObject({
      scenarioId: "classroom",
      activityId: "go-no-go",
      blockNumber: 2,
      trialNumber: 4,
      globalTrialNumber: 19,
      distractorActive: true,
      distractorId: "visual-2-4",
      elapsedSessionTimeMs: 300
    });
    expect(ended.distractorActive).toBe(false);
    expect(listener).toHaveBeenCalledOnce();

    telemetry.onTrialEnd();
    expect(adapter.getContext(1700)).toMatchObject({
      trialNumber: null,
      globalTrialNumber: null,
      stimulusId: null,
      stimulusType: null
    });
  });
});
