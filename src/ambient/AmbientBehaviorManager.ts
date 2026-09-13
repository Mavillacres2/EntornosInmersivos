import { Vector3 } from "@babylonjs/core";

import {
  CHARACTER_AMBIENT_BEHAVIOR_ENABLED,
  CHARACTER_CONFIG
} from "../characters/CharacterConfig";
import type { CharacterManager } from "../characters/CharacterManager";
import type {
  AmbientAction,
  CharacterConfig,
  CharacterWalkRoute
} from "../characters/CharacterTypes";

type AmbientEventKind =
  | "conversation"
  | "walk"
  | "lookAround"
  | "smallGesture";

interface ConversationPair {
  first: CharacterConfig;
  second: CharacterConfig;
}

export class AmbientBehaviorManager {
  private readonly characterManager: CharacterManager;
  private readonly configs: CharacterConfig[];
  private readonly timeoutIds: number[] = [];
  private readonly nextWalkTarget = new Map<string, "pointA" | "pointB">();
  private running = false;
  private actionActive = false;
  private eventIndex = 0;

  constructor(
    characterManager: CharacterManager,
    configs: CharacterConfig[] = CHARACTER_CONFIG
  ) {
    this.characterManager = characterManager;
    this.configs = configs;
  }

  start(): void {
    if (!CHARACTER_AMBIENT_BEHAVIOR_ENABLED || this.running) {
      return;
    }

    this.running = true;
    this.actionActive = false;
    this.characterManager.setMode("exploration");
    this.characterManager.restoreAllBaseStates();
    this.scheduleNextEvent(this.randomBetween(6_000, 9_000));
  }

  stop(): void {
    this.running = false;
    this.actionActive = false;
    this.clearTimers();
    this.characterManager.stopAllActions();
    this.characterManager.restoreAllBaseStates();
  }

  dispose(): void {
    this.stop();
  }

  private scheduleNextEvent(delayMs: number): void {
    if (!this.running) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      this.removeTimer(timeoutId);

      if (!this.running) {
        return;
      }

      if (!this.actionActive) {
        this.runNextEvent();
      }

      this.scheduleNextEvent(this.randomBetween(6_000, 15_000));
    }, delayMs);

    this.timeoutIds.push(timeoutId);
  }

  private runNextEvent(): void {
    const eventCycle = this.getAvailableEventCycle();

    if (eventCycle.length === 0) {
      return;
    }

    const event = eventCycle[this.eventIndex % eventCycle.length];
    this.eventIndex += 1;

    switch (event) {
      case "conversation":
        this.playConversationExchange();
        return;

      case "walk":
        this.playWalkingRoute();
        return;

      case "lookAround":
        this.playLookAround();
        return;

      case "smallGesture":
        this.playSmallGesture();
        return;
    }
  }

  private getAvailableEventCycle(): AmbientEventKind[] {
    const events: AmbientEventKind[] = [];

    if (this.getConversationPair()) {
      events.push("conversation");
    }

    if (this.getWalkerConfig()) {
      events.push("walk");
    }

    if (this.hasCandidateForAction("lookAround")) {
      events.push("lookAround");
    }

    if (this.hasCandidateForAction("smallGesture")) {
      events.push("smallGesture");
    }

    return events;
  }

  private playConversationExchange(): void {
    const pair = this.getConversationPair();

    if (!pair) {
      return;
    }

    const firstSpeaker =
      this.eventIndex % 2 === 0 ? pair.first : pair.second;
    const secondSpeaker =
      firstSpeaker.id === pair.first.id ? pair.second : pair.first;

    this.actionActive = true;
    this.characterManager.restoreCharacterBaseState(firstSpeaker.id);
    this.characterManager.restoreCharacterBaseState(secondSpeaker.id);
    this.characterManager.playAction(firstSpeaker.id, "talk");

    this.scheduleTimer(2_450, () => {
      if (!this.running) {
        return;
      }

      this.characterManager.restoreCharacterBaseState(firstSpeaker.id);
      this.characterManager.playAction(secondSpeaker.id, "talk");
    });

    this.scheduleTimer(5_100, () => {
      this.characterManager.restoreCharacterBaseState(firstSpeaker.id);
      this.characterManager.restoreCharacterBaseState(secondSpeaker.id);
      this.actionActive = false;
    });
  }

  private playWalkingRoute(): void {
    const walker = this.getWalkerConfig();

    if (!walker?.walkRoute) {
      return;
    }

    const route = walker.walkRoute;
    const currentPosition =
      this.characterManager.getCharacterPosition(walker.id) ??
      route.pointA.clone();
    const nextKey = this.getNextWalkPointKey(walker.id, currentPosition, route);
    const target = route[nextKey].clone();
    const durationMs = route.durationMs ?? 3_800;

    this.actionActive = true;

    void this.characterManager
      .moveCharacter(walker.id, currentPosition, target, durationMs)
      .then(() => {
        if (!this.running) {
          return;
        }

        this.nextWalkTarget.set(
          walker.id,
          nextKey === "pointA" ? "pointB" : "pointA"
        );
        this.characterManager.restoreCharacterBaseState(walker.id);
        this.scheduleTimer(
          this.randomBetween(route.minWaitMs ?? 8_000, route.maxWaitMs ?? 14_000),
          () => {
            this.actionActive = false;
          }
        );
      });
  }

  private playLookAround(): void {
    const candidate = this.getCandidateForAction("lookAround");

    if (!candidate) {
      return;
    }

    this.actionActive = true;
    this.characterManager.playAction(candidate.id, "lookAround");
    this.scheduleTimer(1_900, () => {
      this.characterManager.restoreCharacterBaseState(candidate.id);
      this.actionActive = false;
    });
  }

  private playSmallGesture(): void {
    const candidate = this.getCandidateForAction("smallGesture");

    if (!candidate) {
      return;
    }

    this.actionActive = true;
    this.characterManager.playAction(candidate.id, "smallGesture");
    this.scheduleTimer(1_600, () => {
      this.characterManager.restoreCharacterBaseState(candidate.id);
      this.actionActive = false;
    });
  }

  private getConversationPair(): ConversationPair | null {
    const first = this.configs.find(
      (config) =>
        config.ambientRole === "conversationStudent" &&
        this.isAllowed(config, "talk") &&
        Boolean(config.conversationPartnerId) &&
        Boolean(this.characterManager.getCharacter(config.id))
    );

    if (!first?.conversationPartnerId) {
      return null;
    }

    const second = this.configs.find(
      (config) =>
        config.id === first.conversationPartnerId &&
        this.isAllowed(config, "talk") &&
        Boolean(this.characterManager.getCharacter(config.id))
    );

    if (!second) {
      return null;
    }

    return {
      first,
      second
    };
  }

  private getWalkerConfig(): CharacterConfig | null {
    return (
      this.configs.find(
        (config) =>
          config.ambientRole === "walkingStudent" &&
          this.isAllowed(config, "walk") &&
          Boolean(config.walkRoute) &&
          Boolean(this.characterManager.getCharacter(config.id))
      ) ?? null
    );
  }

  private hasCandidateForAction(action: AmbientAction): boolean {
    return Boolean(this.getCandidateForAction(action));
  }

  private getCandidateForAction(action: AmbientAction): CharacterConfig | null {
    const candidates = this.configs.filter(
      (config) =>
        this.isAllowed(config, action) &&
        config.ambientRole !== "teacher" &&
        config.ambientRole !== "walkingStudent" &&
        Boolean(this.characterManager.getCharacter(config.id))
    );

    if (candidates.length === 0) {
      return null;
    }

    const index = this.eventIndex % candidates.length;
    return candidates[index];
  }

  private getNextWalkPointKey(
    characterId: string,
    currentPosition: Vector3,
    route: CharacterWalkRoute
  ): "pointA" | "pointB" {
    const storedTarget = this.nextWalkTarget.get(characterId);

    if (storedTarget) {
      return storedTarget;
    }

    return Vector3.Distance(currentPosition, route.pointA) <
      Vector3.Distance(currentPosition, route.pointB)
      ? "pointB"
      : "pointA";
  }

  private isAllowed(config: CharacterConfig, action: AmbientAction): boolean {
    return config.allowedAmbientActions?.includes(action) ?? false;
  }

  private scheduleTimer(delayMs: number, callback: () => void): void {
    const timeoutId = window.setTimeout(() => {
      this.removeTimer(timeoutId);
      callback();
    }, delayMs);

    this.timeoutIds.push(timeoutId);
  }

  private clearTimers(): void {
    this.timeoutIds.forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });
    this.timeoutIds.length = 0;
  }

  private removeTimer(timeoutId: number): void {
    const index = this.timeoutIds.indexOf(timeoutId);

    if (index !== -1) {
      this.timeoutIds.splice(index, 1);
    }
  }

  private randomBetween(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }
}
