import type { GuideQuality } from '../guides/GuideSceneConfiguration';
const key = 'neuroexplora.explorationQuality';
export function getExplorationQuality(): GuideQuality {
  try { const value = localStorage.getItem(key); if (value === 'low' || value === 'high') return value; } catch { /* Storage optional. */ }
  return 'balanced';
}
export function saveExplorationQuality(quality: GuideQuality): void {
  try { localStorage.setItem(key, quality); } catch { /* Storage optional. */ }
}
