import { beforeEach, describe, expect, it, vi } from "vitest";

import { BehaviorDataBuffer } from "../buffer/BehaviorDataBuffer";
import type { BehaviorSample } from "../types/BehaviorTypes";

describe("BehaviorDataBuffer", () => {
  beforeEach(() => {
    vi.stubGlobal("window", globalThis);
  });

  it("conserva datos en memoria cuando el backend falla y los envia al recuperarse", async () => {
    const sendSamples = vi
      .fn<(samples: BehaviorSample[]) => Promise<void>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(undefined);
    const buffer = new BehaviorDataBuffer(
      {
        sendSamples,
        sendEvents: vi.fn(async () => undefined)
      },
      {
        batchSize: 10,
        flushIntervalMs: 3000,
        maxSamples: 20,
        maxEvents: 20
      }
    );

    buffer.pushSample({ sampleId: "sample-1" } as BehaviorSample);

    expect(await buffer.flush()).toBe(false);
    expect(buffer.getSize().samples).toBe(1);
    expect(await buffer.flush()).toBe(true);
    expect(buffer.getSize().samples).toBe(0);
    buffer.stop();
  });

  it("limita el buffer sin crear persistencia multimedia", () => {
    const overflow = vi.fn();
    const buffer = new BehaviorDataBuffer(
      {
        sendSamples: vi.fn(async () => undefined),
        sendEvents: vi.fn(async () => undefined)
      },
      {
        batchSize: 10,
        flushIntervalMs: 3000,
        maxSamples: 2,
        maxEvents: 2,
        onOverflow: overflow
      }
    );

    buffer.pushSample({ sampleId: "sample-1" } as BehaviorSample);
    buffer.pushSample({ sampleId: "sample-2" } as BehaviorSample);
    buffer.pushSample({ sampleId: "sample-3" } as BehaviorSample);

    expect(buffer.getSize().samples).toBe(2);
    expect(overflow).toHaveBeenCalledWith("samples", 1);
    buffer.stop();
  });

  it("comparte el envio en curso con el vaciado final", async () => {
    const pending = deferred<void>();
    const sendSamples = vi.fn(() => pending.promise);
    const buffer = new BehaviorDataBuffer(
      {
        sendSamples,
        sendEvents: vi.fn(async () => undefined)
      },
      {
        batchSize: 10,
        flushIntervalMs: 3000,
        maxSamples: 20,
        maxEvents: 20
      }
    );

    buffer.pushSample({ sampleId: "sample-1" } as BehaviorSample);
    const intervalFlush = buffer.flush();
    const finalFlush = buffer.flushAll();

    expect(sendSamples).toHaveBeenCalledTimes(1);
    pending.resolve();
    await expect(Promise.all([intervalFlush, finalFlush])).resolves.toEqual([
      true,
      true
    ]);
    expect(buffer.getSize().samples).toBe(0);
    buffer.stop();
  });

  it("vacia hasta la capacidad configurada aunque requiera mas de 20 lotes", async () => {
    const sendSamples = vi.fn(async () => undefined);
    const buffer = new BehaviorDataBuffer(
      {
        sendSamples,
        sendEvents: vi.fn(async () => undefined)
      },
      {
        batchSize: 2,
        flushIntervalMs: 3000,
        maxSamples: 50,
        maxEvents: 10
      }
    );

    for (let index = 0; index < 50; index += 1) {
      buffer.pushSample({ sampleId: `sample-${index}` } as BehaviorSample);
    }

    await expect(buffer.flushAll()).resolves.toBe(true);
    expect(sendSamples).toHaveBeenCalledTimes(25);
    expect(buffer.getSize().samples).toBe(0);
    buffer.stop();
  });
});

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}
