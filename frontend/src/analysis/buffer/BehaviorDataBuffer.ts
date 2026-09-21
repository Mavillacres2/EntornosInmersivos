import type {
  BehaviorEvent,
  BehaviorSample
} from "../types/BehaviorTypes";

export interface BehaviorBufferSender {
  sendSamples(samples: BehaviorSample[]): Promise<void>;
  sendEvents(events: BehaviorEvent[]): Promise<void>;
}

interface BehaviorDataBufferOptions {
  batchSize: number;
  flushIntervalMs: number;
  maxSamples: number;
  maxEvents: number;
  onOverflow?: (kind: "samples" | "events", dropped: number) => void;
}

export class BehaviorDataBuffer {
  private readonly samples: BehaviorSample[] = [];
  private readonly events: BehaviorEvent[] = [];
  private flushIntervalId: number | null = null;
  private retryTimeoutId: number | null = null;
  private retryAttempt = 0;
  private flushPromise: Promise<boolean> | null = null;
  private readonly sender: BehaviorBufferSender;
  private readonly options: BehaviorDataBufferOptions;

  constructor(sender: BehaviorBufferSender, options: BehaviorDataBufferOptions) {
    this.sender = sender;
    this.options = options;
  }

  start(): void {
    if (this.flushIntervalId !== null) {
      return;
    }

    this.flushIntervalId = window.setInterval(() => {
      void this.flush();
    }, this.options.flushIntervalMs);
  }

  pushSample(sample: BehaviorSample): void {
    this.samples.push(sample);
    this.enforceLimit("samples", this.samples, this.options.maxSamples);

    if (this.samples.length >= this.options.batchSize) {
      void this.flush();
    }
  }

  pushEvent(event: BehaviorEvent): void {
    this.events.push(event);
    this.enforceLimit("events", this.events, this.options.maxEvents);

    if (this.events.length >= this.options.batchSize) {
      void this.flush();
    }
  }

  async flush(): Promise<boolean> {
    if (this.flushPromise) {
      return this.flushPromise;
    }

    this.flushPromise = this.performFlush();

    try {
      return await this.flushPromise;
    } finally {
      this.flushPromise = null;
    }
  }

  async flushAll(maxPasses?: number): Promise<boolean> {
    const passLimit =
      maxPasses ??
      Math.max(
        1,
        Math.ceil(this.options.maxSamples / this.options.batchSize),
        Math.ceil(this.options.maxEvents / this.options.batchSize)
      );

    for (let pass = 0; pass < passLimit; pass += 1) {
      if (this.samples.length === 0 && this.events.length === 0) {
        return true;
      }

      if (!(await this.flush())) {
        return false;
      }
    }

    return this.samples.length === 0 && this.events.length === 0;
  }

  getSize(): { samples: number; events: number } {
    return {
      samples: this.samples.length,
      events: this.events.length
    };
  }

  stop(): void {
    if (this.flushIntervalId !== null) {
      window.clearInterval(this.flushIntervalId);
      this.flushIntervalId = null;
    }

    this.clearRetry();
  }

  clear(): void {
    this.samples.length = 0;
    this.events.length = 0;
  }

  private async flushSamples(): Promise<boolean> {
    if (this.samples.length === 0) {
      return true;
    }

    const batch = this.samples.slice(0, this.options.batchSize);

    await this.sender.sendSamples(batch);
    this.samples.splice(0, batch.length);
    return true;
  }

  private async performFlush(): Promise<boolean> {
    try {
      const samplesSent = await this.flushSamples();
      const eventsSent = await this.flushEvents();
      const success = samplesSent && eventsSent;

      if (success) {
        this.retryAttempt = 0;
        this.clearRetry();
      }

      return success;
    } catch {
      this.scheduleRetry();
      return false;
    }
  }

  private async flushEvents(): Promise<boolean> {
    if (this.events.length === 0) {
      return true;
    }

    const batch = this.events.slice(0, this.options.batchSize);

    await this.sender.sendEvents(batch);
    this.events.splice(0, batch.length);
    return true;
  }

  private enforceLimit<T>(
    kind: "samples" | "events",
    values: T[],
    limit: number
  ): void {
    if (values.length <= limit) {
      return;
    }

    const dropped = values.length - limit;

    values.splice(0, dropped);
    this.options.onOverflow?.(kind, dropped);
  }

  private scheduleRetry(): void {
    if (this.retryTimeoutId !== null) {
      return;
    }

    const delayMs = Math.min(30_000, 1000 * 2 ** this.retryAttempt);

    this.retryAttempt += 1;
    this.retryTimeoutId = window.setTimeout(() => {
      this.retryTimeoutId = null;
      void this.flush();
    }, delayMs);
  }

  private clearRetry(): void {
    if (this.retryTimeoutId !== null) {
      window.clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }
  }
}
