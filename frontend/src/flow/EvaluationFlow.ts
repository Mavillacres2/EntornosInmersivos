import type { ScenarioId } from '../ui/ScenarioPresentation';
export const ACTIVITIES: readonly ScenarioId[] = ['classroom', 'space-station', 'interactive-museum'];
export type ActivityStatus = 'pending' | 'in-progress' | 'completed' | 'interrupted' | 'technical-error';
export type FlowState = 'CAMERA_SETUP' | 'MENU_WELCOME' | 'MENU_READY' | 'ACTIVITY_LOADING' | 'ACTIVITY_EXPLORATION' | 'ACTIVITY_PRACTICE' | 'ACTIVITY_EVALUATION' | 'ACTIVITY_FINISHED' | 'ACTIVITY_INTERRUPTED' | 'RETURNING_TO_MENU' | 'SESSION_COMPLETED' | 'FAREWELL_ANIMATION' | 'SESSION_FINISHED' | 'SPECIALIST_RESULTS';
export interface ActivityProgress {
    status: ActivityStatus;
    attemptId: string | null;
    saving: boolean;
}
/** One evaluation, one active attempt. Completion requires an acknowledged result. */
export class EvaluationFlow {
    state: FlowState = 'CAMERA_SETUP';
    readonly progress: Record<ScenarioId, ActivityProgress> = Object.fromEntries(ACTIVITIES.map(id => [id, { status: 'pending', attemptId: null, saving: false }])) as Record<ScenarioId, ActivityProgress>;
    active: ScenarioId | null = null;
    private welcomeShown = false;
    private farewellShown = false;
    readonly sessionId: string;
    constructor(sessionId: string) { this.sessionId = sessionId; }
    welcome(): boolean {
        if (this.welcomeShown)
            return false;
        this.welcomeShown = true;
        this.state = 'MENU_WELCOME';
        return true;
    }
    menu(): void { this.active = null; this.state = 'MENU_READY'; }
    start(id: ScenarioId): string | null {
        if (this.state !== 'MENU_READY' || this.active || this.progress[id].status === 'completed' || this.progress[id].saving)
            return null;
        const attemptId = crypto.randomUUID();
        this.progress[id] = { status: 'in-progress', attemptId, saving: false };
        this.active = id;
        this.state = 'ACTIVITY_LOADING';
        return attemptId;
    }
    phase(id: ScenarioId, attemptId: string, state: string): void {
        if (!this.matches(id, attemptId))
            return;
        this.state = state === 'practice' || state === 'practice-feedback' ? 'ACTIVITY_PRACTICE' : state === 'running-block' || state === 'resting' || state === 'countdown' ? 'ACTIVITY_EVALUATION' : 'ACTIVITY_EXPLORATION';
    }
    produced(id: ScenarioId, attemptId: string): boolean {
        if (!this.matches(id, attemptId) || this.progress[id].saving)
            return false;
        this.progress[id].saving = true;
        this.state = 'ACTIVITY_FINISHED';
        return true;
    }
    saved(id: ScenarioId, attemptId: string): boolean {
        const entry = this.progress[id];
        if (entry.attemptId !== attemptId || !entry.saving || entry.status === 'completed')
            return false;
        entry.saving = false;
        entry.status = 'completed';
        return true;
    }
    interrupt(technical = false): {
        id: ScenarioId;
        attemptId: string;
    } | null {
        const id = this.active;
        if (!id || this.progress[id].saving || this.progress[id].status === 'completed')
            return null;
        const entry = this.progress[id];
        entry.status = technical ? 'technical-error' : 'interrupted';
        this.state = 'ACTIVITY_INTERRUPTED';
        this.active = null;
        return { id, attemptId: entry.attemptId! };
    }
    allCompleted(): boolean { return ACTIVITIES.every(id => this.progress[id].status === 'completed'); }
    beginFarewell(recordsSaved: boolean): boolean {
        if (!recordsSaved || !this.allCompleted() || this.farewellShown)
            return false;
        this.farewellShown = true;
        this.state = 'FAREWELL_ANIMATION';
        return true;
    }
    matches(id: ScenarioId, attemptId: string): boolean { return this.active === id && this.progress[id].attemptId === attemptId && this.progress[id].status === 'in-progress'; }
}
