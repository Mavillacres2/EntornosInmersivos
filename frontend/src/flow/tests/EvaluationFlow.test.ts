import { describe, it, expect } from 'vitest';
import { EvaluationFlow, ACTIVITIES } from '../EvaluationFlow';
describe('evaluation navigation and progress', () => {
    it('runs welcome once per session and prevents starts before menu or duplicate starts', () => {
        const flow = new EvaluationFlow('session');
        expect(flow.start('classroom')).toBeNull();
        expect(flow.welcome()).toBe(true);
        expect(flow.welcome()).toBe(false);
        flow.menu();
        expect(flow.start('classroom')).toBeTruthy();
        expect(flow.start('classroom')).toBeNull();
        expect(flow.start('space-station')).toBeNull();
    });
    it('preserves progress across scenes and requires the matching backend acknowledgement', () => {
        const flow = new EvaluationFlow('session');
        flow.menu();
        const attempt = flow.start('classroom')!;
        flow.phase('classroom', attempt, 'practice');
        expect(flow.state).toBe('ACTIVITY_PRACTICE');
        flow.phase('classroom', attempt, 'running-block');
        expect(flow.state).toBe('ACTIVITY_EVALUATION');
        expect(flow.produced('classroom', attempt)).toBe(true);
        expect(flow.produced('classroom', attempt)).toBe(false);
        flow.menu();
        expect(flow.progress.classroom.status).toBe('in-progress');
        expect(flow.start('classroom')).toBeNull();
        expect(flow.saved('classroom', 'old')).toBe(false);
        expect(flow.saved('classroom', attempt)).toBe(true);
        expect(flow.saved('classroom', attempt)).toBe(false);
        expect(flow.start('classroom')).toBeNull();
        expect(flow.start('space-station')).toBeTruthy();
        expect(flow.progress.classroom.status).toBe('completed');
    });
    it('never completes an interrupted or technical-error attempt; retry has a new identity', () => {
        const flow = new EvaluationFlow('session');
        flow.menu();
        const old = flow.start('classroom')!;
        expect(flow.interrupt()?.attemptId).toBe(old);
        expect(flow.progress.classroom.status).toBe('interrupted');
        expect(flow.saved('classroom', old)).toBe(false);
        flow.menu();
        const next = flow.start('classroom')!;
        expect(next).not.toBe(old);
        expect(flow.matches('classroom', old)).toBe(false);
        expect(flow.produced('classroom', old)).toBe(false);
        flow.interrupt(true);
        expect(flow.progress.classroom.status).toBe('technical-error');
        expect(flow.allCompleted()).toBe(false);
    });
    it('only closes after three distinct saved activities and never repeats farewell', () => {
        const flow = new EvaluationFlow('session');
        flow.menu();
        for (const id of ACTIVITIES) {
            const attempt = flow.start(id)!;
            flow.produced(id, attempt);
            flow.menu();
            expect(flow.beginFarewell(true)).toBe(false);
            flow.saved(id, attempt);
        }
        expect(flow.allCompleted()).toBe(true);
        expect(flow.beginFarewell(false)).toBe(false);
        expect(flow.beginFarewell(true)).toBe(true);
        expect(flow.beginFarewell(true)).toBe(false);
        const another = new EvaluationFlow('other-session');
        expect(another.allCompleted()).toBe(false);
        expect(another.progress.classroom.status).toBe('pending');
    });
});
