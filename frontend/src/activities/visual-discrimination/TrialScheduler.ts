import type {
  BlockType,
  FaceIndex,
  ScheduledBlock,
  ScheduledTrial,
  VisualDiscriminationConfig,
  VisualDiscriminationDifficulty
} from "./VisualDiscriminationTypes";
import { SeededRandom } from "./FaceStimulusGenerator";

const FACE_INDICES: FaceIndex[] = [0, 1, 2];
const LATIN_SQUARE_ORDERS: BlockType[][] = [
  ["none", "visual", "auditory", "combined"],
  ["visual", "combined", "none", "auditory"],
  ["auditory", "none", "combined", "visual"],
  ["combined", "auditory", "visual", "none"]
];

export class TrialScheduler {
  createPracticeTrials(config: VisualDiscriminationConfig): ScheduledTrial[] {
    const random = new SeededRandom(config.seed + 17);
    const positions = this.shuffleBalancedPositions(config.practiceTrials, random);
    const difficulties = this.buildDifficultyList(config.practiceTrials, random);

    return positions.map((correctIndex, index) => ({
      trialId: index + 1,
      blockId: "practice",
      blockIndex: -1,
      blockType: "none",
      correctIndex,
      difficulty: difficulties[index],
      generatorSeed: config.seed + 10_000 + index * 37,
      shouldTriggerDistractor: false,
      plannedDistractorOnsetMs: null
    }));
  }

  createOfficialBlocks(config: VisualDiscriminationConfig): ScheduledBlock[] {
    const random = new SeededRandom(config.seed);
    const blockOrder = this.resolveBlockOrder(config, random);
    const difficulties = this.buildDifficultyPool(config, random);
    let trialId = 1;
    let difficultyCursor = 0;

    return blockOrder.map((blockType, blockIndex) => {
      const positions = this.shuffleBalancedPositions(config.trialsPerBlock, random);
      const trials: ScheduledTrial[] = positions.map((correctIndex, trialIndex) => {
        const shouldTriggerDistractor =
          blockType !== "none" && random.next() < config.distractorProbability;
        const plannedDistractorOnsetMs = shouldTriggerDistractor
          ? random.nextInt(config.distractorOnsetMinMs, config.distractorOnsetMaxMs)
          : null;
        const difficulty = difficulties[difficultyCursor % difficulties.length];

        difficultyCursor += 1;

        return {
          trialId: trialId++,
          blockId: `block-${blockIndex + 1}-${blockType}`,
          blockIndex,
          blockType,
          correctIndex,
          difficulty,
          generatorSeed: config.seed + 100_000 + blockIndex * 1000 + trialIndex * 53,
          shouldTriggerDistractor,
          plannedDistractorOnsetMs
        };
      });

      return {
        blockId: `block-${blockIndex + 1}-${blockType}`,
        blockIndex,
        blockType,
        trials
      };
    });
  }

  private resolveBlockOrder(
    config: VisualDiscriminationConfig,
    random: SeededRandom
  ): BlockType[] {
    if (config.blockOrderStrategy === "fixed") {
      return [...config.blockTypes];
    }

    if (config.blockOrderStrategy === "randomized") {
      return this.shuffle([...config.blockTypes], random);
    }

    const participantIndex = this.participantIndex(config.participantCode);
    const order = LATIN_SQUARE_ORDERS[participantIndex % LATIN_SQUARE_ORDERS.length];

    return order.filter((blockType) => config.blockTypes.includes(blockType));
  }

  private shuffleBalancedPositions(count: number, random: SeededRandom): FaceIndex[] {
    const repetitions = Math.ceil(count / FACE_INDICES.length);
    const positions = Array.from({ length: repetitions }, () => FACE_INDICES)
      .flat()
      .slice(0, count);
    let shuffled = this.shuffle(positions, random);
    let attempts = 0;

    while (this.hasLongRun(shuffled, 3) && attempts < 20) {
      shuffled = this.shuffle(positions, random);
      attempts += 1;
    }

    return shuffled;
  }

  private buildDifficultyPool(
    config: VisualDiscriminationConfig,
    random: SeededRandom
  ): VisualDiscriminationDifficulty[] {
    const pool: VisualDiscriminationDifficulty[] = [
      ...Array.from({ length: config.difficultyDistribution.easy }, () => "easy" as const),
      ...Array.from({ length: config.difficultyDistribution.medium }, () => "medium" as const),
      ...Array.from({ length: config.difficultyDistribution.hard }, () => "hard" as const)
    ];

    return this.shuffle(pool, random);
  }

  private buildDifficultyList(
    count: number,
    random: SeededRandom
  ): VisualDiscriminationDifficulty[] {
    const values: VisualDiscriminationDifficulty[] = ["easy", "easy", "medium", "hard"];

    return Array.from({ length: count }, (_, index) => values[index % values.length])
      .sort(() => random.next() - 0.5);
  }

  private shuffle<T>(values: T[], random: SeededRandom): T[] {
    const copy = [...values];

    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = random.nextInt(0, index);
      [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }

    return copy;
  }

  private hasLongRun(values: FaceIndex[], maxRun: number): boolean {
    let runLength = 1;

    for (let index = 1; index < values.length; index += 1) {
      runLength = values[index] === values[index - 1] ? runLength + 1 : 1;

      if (runLength > maxRun) {
        return true;
      }
    }

    return false;
  }

  private participantIndex(participantCode: string | undefined): number {
    if (!participantCode) {
      return 0;
    }

    return [...participantCode].reduce(
      (total, character) => total + character.charCodeAt(0),
      0
    );
  }
}
