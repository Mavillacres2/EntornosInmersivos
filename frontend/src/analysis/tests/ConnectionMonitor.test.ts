import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalysisApiClient } from '../api/AnalysisApiClient';

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('window', { setTimeout, clearTimeout, addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('connection monitoring without a session', () => {
  it('keeps one polling loop when restarted during a pending check', async () => {
    let resolve!: (value: unknown) => void;
    const request = vi.fn().mockImplementationOnce(() => new Promise(done => { resolve = done; }))
      .mockResolvedValue({ok:true,json:async()=>({status:'ok'})});
    vi.stubGlobal('fetch', request);
    const api = new AnalysisApiClient('/api');
    api.startMonitoring();
    api.stopMonitoring();
    api.startMonitoring();
    resolve({ok:true,json:async()=>({status:'ok'})});
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(10000);
    expect(request).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(1);
    api.stopMonitoring();
  });

  it('checks immediately, detects a failure and recovers automatically', async () => {
    const request = vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({status:'ok'})})
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ok:true,json:async()=>({status:'ok'})});
    vi.stubGlobal('fetch', request);
    const api = new AnalysisApiClient('/api');
    const states: boolean[] = [];
    api.onConnectionChange(state => states.push(state));
    expect(states).toEqual([]); // Unknown is not incorrectly displayed as disconnected.
    api.startMonitoring();
    await vi.advanceTimersByTimeAsync(0);
    expect(states).toEqual([true]);
    await vi.advanceTimersByTimeAsync(5000);
    expect(states).toEqual([true,false]);
    await vi.advanceTimersByTimeAsync(5000);
    expect(states).toEqual([true,false,true]);
    api.stopMonitoring();
    const count = request.mock.calls.length;
    await vi.advanceTimersByTimeAsync(20000);
    expect(request).toHaveBeenCalledTimes(count);
  });

  it('shares in-flight health checks and reports an initial unavailable server', async () => {
    let reject!: (reason: Error) => void;
    const request = vi.fn(() => new Promise((_resolve, failure) => { reject=failure; }));
    vi.stubGlobal('fetch', request);
    const api = new AnalysisApiClient('/api');
    const states: boolean[] = [];
    api.onConnectionChange(state => states.push(state));
    const first = api.health(); const second = api.health();
    expect(first).toBe(second);
    expect(request).toHaveBeenCalledTimes(1);
    reject(new Error('offline'));
    await expect(first).resolves.toBe(false);
    expect(states).toEqual([false]);
  });
});
