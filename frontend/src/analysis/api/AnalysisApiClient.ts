import type {
  ActivityResultEnvelope,
  BehaviorEvent,
  BehaviorSample
} from "../types/BehaviorTypes";

interface CreateSessionPayload {
  sessionId: string;
  participantCode: string;
  startedAt: string;
  cameraConfiguration: {
    upperBodyCameraConfigured: boolean;
    fullBodyCameraConfigured: boolean;
  };
}

export type ApiConnectionListener = (connected: boolean) => void;

export class AnalysisApiClient {
  private connected = false;
  private readonly connectionListeners = new Set<ApiConnectionListener>();
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(baseUrl: string, timeoutMs = 5000) {
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
  }

  createSession(payload: CreateSessionPayload): Promise<unknown> {
    return this.request("/sessions", {
      method: "POST",
      body: payload
    });
  }

  sendBehaviorBatch(sessionId: string, samples: BehaviorSample[]): Promise<unknown> {
    return this.request(`/sessions/${sessionId}/behavior/batch`, {
      method: "POST",
      body: { samples }
    });
  }

  sendEventBatch(sessionId: string, events: BehaviorEvent[]): Promise<unknown> {
    return this.request(`/sessions/${sessionId}/events/batch`, {
      method: "POST",
      body: { events }
    });
  }

  sendActivityResult(
    sessionId: string,
    result: ActivityResultEnvelope
  ): Promise<unknown> {
    return this.request(`/sessions/${sessionId}/activity-results`, {
      method: "POST",
      body: result
    });
  }

  finishSession(
    sessionId: string,
    scenariosCompleted: string[]
  ): Promise<unknown> {
    return this.request(`/sessions/${sessionId}/finish`, {
      method: "POST",
      body: {
        finishedAt: new Date().toISOString(),
        scenariosCompleted
      }
    });
  }

  async health(): Promise<boolean> {
    try {
      await this.request("/health", { method: "GET" });
      return true;
    } catch {
      return false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  onConnectionChange(listener: ApiConnectionListener): () => void {
    this.connectionListeners.add(listener);
    listener(this.connected);

    return () => this.connectionListeners.delete(listener);
  }

  private async request(
    path: string,
    options: { method: "GET" | "POST"; body?: unknown }
  ): Promise<unknown> {
    if (containsMediaPayload(options.body)) {
      throw new Error("Privacidad: no se permite enviar frames, imagenes o video.");
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: options.method,
        headers: options.body ? { "Content-Type": "application/json" } : undefined,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Analysis API respondio ${response.status}.`);
      }

      this.setConnected(true);
      return await response.json();
    } catch (error) {
      this.setConnected(false);
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  private setConnected(connected: boolean): void {
    if (this.connected === connected) {
      return;
    }

    this.connected = connected;
    this.connectionListeners.forEach((listener) => listener(connected));
  }
}

const forbiddenMediaKeys = new Set([
  "frame",
  "frames",
  "framebuffer",
  "framedata",
  "video",
  "videodata",
  "image",
  "images",
  "imagedata",
  "jpeg",
  "png",
  "screenshot",
  "blob",
  "mediastream",
  "base64",
  "dataurl",
  "pixels",
  "pixeldata"
]);

export function containsMediaPayload(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((child) => containsMediaPayload(child));
  }

  if (!value || typeof value !== "object") {
    return typeof value === "string" && /^data:(image|video)\//i.test(value);
  }

  return Object.entries(value).some(
    ([key, child]) =>
      forbiddenMediaKeys.has(key.replace(/[-_\s]/g, "").toLowerCase()) ||
      containsMediaPayload(child)
  );
}
