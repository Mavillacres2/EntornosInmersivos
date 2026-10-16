import { Quaternion } from '@babylonjs/core';
import type { TransformNode } from '@babylonjs/core';
import type { GuideCharacter } from './GuideCharacter';
import type { GuideState } from './GuideSceneConfiguration';
import type { MouthPose } from './LipSyncController';

export class CharacterAnimationController {
  private state: GuideState = 'IDLE';
  private time = 0;
  private stateTime = 0;
  private mouthAmplitude = 0;
  private mouthRound = 0;
  private mouthWide = 0;
  private nextBlink = 3.4;
  private blinkTime = -1;
  private blinkIndex = 0;
  private readonly character: GuideCharacter;
  private readonly reducedMotion: boolean;
  private readonly target = Quaternion.Identity();
  constructor(character: GuideCharacter, reducedMotion = false) { this.character = character; this.reducedMotion = reducedMotion; }
  setState(state: GuideState): void { this.state = state; this.stateTime = 0; }
  update(deltaSeconds: number, amplitude: number, speaking = amplitude > 0, audioTime?: number, mouthPose?: MouthPose): void {
    const dt = Math.min(.1, Math.max(0, deltaSeconds));
    this.time += dt; this.stateTime += dt;
    const c = this.character, t = this.time, motion = this.reducedMotion ? .12 : 1;
    const voiceTime = speaking && audioTime !== undefined ? audioTime : this.stateTime;
    const blend = 1 - Math.exp(-dt * 9);
    const mix = (node: TransformNode, x: number, y: number, z: number) => {
      Quaternion.FromEulerAnglesToRef(x * motion, y * motion, z * motion, this.target);
      node.rotationQuaternion ??= Quaternion.Identity();
      Quaternion.SlerpToRef(node.rotationQuaternion, this.target, blend, node.rotationQuaternion);
    };
    const variant = c.theme === 'space' ? 1.15 : c.theme === 'museum' ? .8 : .9;
    const explaining = this.state === 'EXPLAINING', pointing = this.state === 'DEMONSTRATING';
    const phraseGesture = speaking ? Math.sin(Math.min(1, (voiceTime % 4.6) / 1.1) * Math.PI) * .12 : 0;
    mix(c.torso, 0, Math.sin(t * .31) * .009, Math.sin(t * .85) * .012);
    c.torso.position.y = Math.sin(t * 1.65) * .006 * motion;
    mix(c.head, Math.sin(voiceTime * 2) * amplitude * .035, pointing ? -.12 : Math.sin(t * .43) * .035, Math.sin(t * .6) * .024);
    mix(c.leftArm, explaining ? -.16 : -.04, 0, pointing ? -1.12 : -.14 - phraseGesture * variant);
    mix(c.rightArm, explaining ? -.16 : -.04, 0, .14 + phraseGesture * variant);
    mix(c.leftForearm, pointing ? -.32 : -.13, 0, explaining ? -.13 : -.03);
    mix(c.rightForearm, -.14 - phraseGesture, 0, .03);
    // Sample real quaternion tracks authored in the GLB and blend into the current pose.
    const clip = (this.state === 'GREETING' || this.state === 'FAREWELL') && voiceTime < 2.4 ? 'Greeting' : pointing ? 'Pointing' : this.state === 'IDLE' || this.state === 'WAITING' ? 'Idle' : null;
    const group = c.animationGroups.find(group => group.name === clip || group.name.endsWith(`.${clip}`));
    if (group) for (const track of group.targetedAnimations) {
      const seconds = clip === 'Idle' ? t % 4 : clip === 'Pointing' ? Math.min(1.8, voiceTime) : voiceTime;
      const pose = track.animation.evaluate(seconds * track.animation.framePerSecond) as Quaternion;
      const node = track.target as TransformNode;
      if (pose && node.rotationQuaternion) {
        Quaternion.SlerpToRef(Quaternion.Identity(), pose, motion, this.target);
        Quaternion.SlerpToRef(node.rotationQuaternion, this.target, blend, node.rotationQuaternion);
      }
    }
    if (t >= this.nextBlink && this.blinkTime < 0) this.blinkTime = 0;
    let eyeOpen = 1;
    if (this.blinkTime >= 0) {
      this.blinkTime += dt; eyeOpen = 1 - Math.sin(Math.min(1, this.blinkTime / .2) * Math.PI) * .94;
      if (this.blinkTime >= .2) { this.blinkTime = -1; this.nextBlink = t + [4.9, 3.9, 5.4, 3.4][this.blinkIndex++ % 4]!; }
    }
    c.eyes.forEach(eye => { eye.scaling.y = eyeOpen; });
    c.pupils.forEach(pupil => { pupil.position.x = Math.sin(t * .37) * .006 * motion; });
    const targets=mouthPose??{open:amplitude,round:0,wide:0};
    if (!speaking) { this.mouthAmplitude = 0; this.mouthRound=0;this.mouthWide=0; }
    else {
      const smoothing=1-Math.exp(-dt*22);
      this.mouthAmplitude+=(targets.open-this.mouthAmplitude)*smoothing;
      this.mouthRound+=(targets.round-this.mouthRound)*smoothing;
      this.mouthWide+=(targets.wide-this.mouthWide)*smoothing;
    }
    if (c.mouthOpen) c.mouthOpen.influence = Math.min(1, Math.max(0, this.mouthAmplitude));
    if(c.mouthShapes[1])c.mouthShapes[1].influence=this.mouthRound;
    if(c.mouthShapes[2])c.mouthShapes[2].influence=this.mouthWide;
  }
}
