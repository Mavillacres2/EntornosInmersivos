const SOUND_KEY = "neuroexplora.explorationSound";

export function getExplorationSoundEnabled(): boolean {
  try {
    return window.localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

export function saveExplorationSoundEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(SOUND_KEY, enabled ? "on" : "off");
  } catch {
    // The control still works for this world if storage is unavailable.
  }
}
