/** No trial timing or response handling here. Advancement always requires acknowledgement. */
export class TutorialFlowController {
  index = 0;
  acknowledged = false;
  completed = false;
  readonly length: number;
  constructor(length: number) { if (length < 1) throw new Error('Empty tutorial'); this.length = length; }
  restartClip(): void { this.acknowledged = false; }
  acknowledge(): void { if (!this.completed) this.acknowledged = true; }
  next(voiceActive: boolean): 'blocked' | 'next' | 'complete' {
    if (voiceActive || !this.acknowledged || this.completed) return 'blocked';
    if (this.index === this.length - 1) { this.completed = true; return 'complete'; }
    this.index++; this.acknowledged = false; return 'next';
  }
}
