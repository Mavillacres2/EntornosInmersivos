import { ANALYSIS_CONFIG } from "../analysis/config/AnalysisConfig";

export interface SessionListItem {
  sessionId: string;
  participantCode: string;
  startedAt: string;
  finishedAt: string | null;
  status: "active" | "finished";
  scenariosCompleted: string[];
  sampleCount: number | null;
}

export interface SessionListResponse {
  items: SessionListItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface SessionDetail extends SessionListItem {
  cameraConfiguration?: Record<string, boolean>;
  activityResults: Array<{
    scenarioId: string;
    activityId: string;
    completedAt: string;
    result: Record<string, unknown>;
  }>;
  summary: Record<string, unknown> | null;
}

export interface TimelineSample {
  elapsedMs: number;
  scenarioId: string | null;
  blockNumber: number | null;
  upperCamera?: {
    head?: { movementMagnitude?: number | null; orientationDeviation?: number | null };
    trunk?: { movementMagnitude?: number | null };
  };
  fullBodyCamera?: { globalMotorActivity?: number | null };
}

export interface TimelineEvent {
  elapsedMs: number;
  type: string;
  scenarioId: string | null;
  blockNumber: number | null;
  details?: Record<string, unknown>;
}

export interface TimelineResponse {
  samples: TimelineSample[];
  events: TimelineEvent[];
}

export class SpecialistDataApi {
  async listSessions(filters: Record<string, string | number | undefined>): Promise<SessionListResponse> {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== "") query.set(key, String(value));
    });
    return this.request<SessionListResponse>(`/sessions?${query}`);
  }

  async getSession(sessionId: string): Promise<SessionDetail> {
    const response = await this.request<{ session: SessionDetail }>(`/sessions/${sessionId}`);
    return response.session;
  }

  async getTimeline(sessionId: string): Promise<TimelineResponse> {
    return this.request<TimelineResponse>(`/sessions/${sessionId}/timeline?maxPoints=600`);
  }

  private async request<T>(path: string): Promise<T> {
    const response = await fetch(`${ANALYSIS_CONFIG.apiBaseUrl}${path}`);
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) throw new Error(payload.error ?? "No se pudo consultar el servidor");
    return payload as T;
  }
}
