import type {
  FaceFeatures,
  FaceIndex,
  FaceSet,
  VisualDiscriminationDifficulty
} from "./VisualDiscriminationTypes";
import { StimulusValidator } from "./StimulusValidator";

class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick<T>(values: readonly T[]): T {
    return values[this.nextInt(0, values.length - 1)];
  }
}

export class FaceStimulusGenerator {
  private readonly validator = new StimulusValidator();

  generateFaceSet(
    seed: number,
    correctIndex: FaceIndex,
    difficulty: VisualDiscriminationDifficulty
  ): FaceSet {
    const random = new SeededRandom(seed);
    const baseFace = this.createBaseFace(random);
    const changedFeatures: string[] = [];
    const differentFace = this.createDifferentFace(
      baseFace,
      random,
      difficulty,
      changedFeatures
    );
    const faces: [FaceFeatures, FaceFeatures, FaceFeatures] = [
      this.cloneFace(baseFace),
      this.cloneFace(baseFace),
      this.cloneFace(baseFace)
    ];

    faces[correctIndex] = differentFace;

    const faceSet: FaceSet = {
      id: `vd-${seed}-${difficulty}-${correctIndex}`,
      seed,
      faces,
      correctIndex,
      difficulty,
      changedFeatures
    };

    if (!this.validator.validate(faceSet)) {
      throw new Error(`Estimulo invalido generado: ${faceSet.id}`);
    }

    return faceSet;
  }

  private createBaseFace(random: SeededRandom): FaceFeatures {
    return {
      eyes: {
        shape: random.pick(["round", "wide", "sleepy"] as const),
        spacing: random.pick([0.78, 0.86, 0.94]),
        size: random.pick([0.118, 0.132, 0.146])
      },
      eyebrows: {
        tilt: random.pick([-0.2, 0, 0.2]),
        height: random.pick([0.68, 0.72, 0.76]),
        thickness: random.pick([0.028, 0.034])
      },
      mouth: {
        curve: random.pick(["smile", "neutral", "frown"] as const),
        width: random.pick([0.42, 0.5, 0.58]),
        openness: random.pick([0.02, 0.04, 0.06])
      },
      hair: {
        style: random.pick(["short", "cap", "side"] as const),
        height: random.pick([0.18, 0.23, 0.28])
      }
    };
  }

  private createDifferentFace(
    baseFace: FaceFeatures,
    random: SeededRandom,
    difficulty: VisualDiscriminationDifficulty,
    changedFeatures: string[]
  ): FaceFeatures {
    const face = this.cloneFace(baseFace);

    if (difficulty === "easy") {
      face.eyebrows.tilt = this.nextDifferent(random, face.eyebrows.tilt, [-0.34, 0, 0.34]);
      face.mouth.curve = this.nextDifferent(random, face.mouth.curve, [
        "smile",
        "neutral",
        "frown"
      ] as const);
      changedFeatures.push("eyebrows", "mouth");
      return face;
    }

    if (difficulty === "medium") {
      face.eyebrows.tilt = this.nextDifferent(random, face.eyebrows.tilt, [-0.32, 0, 0.32]);
      changedFeatures.push("eyebrows");
      return face;
    }

    const feature = random.pick(["eyebrows", "mouth"] as const);

    if (feature === "eyebrows") {
      face.eyebrows.height = Number((face.eyebrows.height + 0.055).toFixed(3));
      face.eyebrows.tilt = Number((face.eyebrows.tilt + 0.12).toFixed(3));
      changedFeatures.push("eyebrows");
      return face;
    }

    face.mouth.width = Number(Math.max(0.34, face.mouth.width - 0.08).toFixed(3));
    face.mouth.openness = Number((face.mouth.openness + 0.025).toFixed(3));
    changedFeatures.push("mouth");
    return face;
  }

  private cloneFace(face: FaceFeatures): FaceFeatures {
    return {
      eyes: { ...face.eyes },
      eyebrows: { ...face.eyebrows },
      mouth: { ...face.mouth },
      hair: { ...face.hair }
    };
  }

  private nextDifferent<T>(random: SeededRandom, current: T, values: readonly T[]): T {
    const available = values.filter((value) => value !== current);

    return random.pick(available);
  }
}

export { SeededRandom };
