import assert from 'node:assert/strict';
import test from 'node:test';
import { AnalysisService } from '../services/AnalysisService.js';
import type { AnalysisRepository } from '../repositories/AnalysisRepository.js';
const sessionId = '00000000-0000-4000-8000-000000000001';
const pairs = [['classroom', 'go-no-go'], ['space-station', 'cpt'], ['interactive-museum', 'visual-discrimination']];
const results = pairs.map(([scenarioId, activityId], index) => ({ scenarioId, activityId, attemptId: `00000000-0000-4000-8000-00000000000${index + 2}`, result: { totalTrials: 1 } }));
const payload = { finishedAt: new Date().toISOString(), scenariosCompleted: ['classroom', 'space-station', 'interactive-museum'] };
test('client flags cannot complete a session without all three stored results', async () => {
    let finishes = 0;
    const repository = { sessionExists: async () => true, getSession: async () => ({ activityResults: results.slice(0, 2) }), finishSession: async () => { finishes++; } } as unknown as AnalysisRepository;
    await assert.rejects(() => new AnalysisService(repository).finishSession(sessionId, payload), /Faltan resultados/);
    assert.equal(finishes, 0);
});
test('three saved results close once for concurrent requests and preserve authoritative activity ids', async () => {
    let finishes = 0, summaries = 0;
    const repository = { sessionExists: async () => true, getSession: async () => ({ activityResults: results }), getSamplesForSummary: async () => [], getEventsForSummary: async () => [], saveSummary: async () => { summaries++; }, finishSession: async (_id: string, value: typeof payload) => { assert.deepEqual(value.scenariosCompleted, payload.scenariosCompleted); finishes++; } } as unknown as AnalysisRepository;
    const service = new AnalysisService(repository);
    await Promise.all([service.finishSession(sessionId, { ...payload, scenariosCompleted: [] }), service.finishSession(sessionId, payload)]);
    assert.equal(finishes, 1);
    assert.equal(summaries, 1);
});
test('a stored result from an interrupted attempt cannot close the evaluation', async () => {
    const repository = { sessionExists: async () => true, getSession: async () => ({ activityResults: results }), getSamplesForSummary: async () => [], getEventsForSummary: async () => [{ type: 'ACTIVITY_INTERRUPTED', attemptId: results[0]!.attemptId }] } as unknown as AnalysisRepository;
    await assert.rejects(() => new AnalysisService(repository).finishSession(sessionId, payload), /interrumpido/);
});
