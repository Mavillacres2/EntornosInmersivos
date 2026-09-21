import type { FaceFeatures, FaceSet } from "./VisualDiscriminationTypes";

export class StimulusValidator {
  validate(faceSet: FaceSet): boolean {
    const [first, second, third] = faceSet.faces;
    const pairs = [
      this.areFacesEqual(first, second),
      this.areFacesEqual(first, third),
      this.areFacesEqual(second, third)
    ];
    const equalPairCount = pairs.filter(Boolean).length;

    if (equalPairCount !== 1) {
      return false;
    }

    if (pairs[0]) {
      return faceSet.correctIndex === 2;
    }

    if (pairs[1]) {
      return faceSet.correctIndex === 1;
    }

    return faceSet.correctIndex === 0;
  }

  areFacesEqual(first: FaceFeatures, second: FaceFeatures): boolean {
    return JSON.stringify(first) === JSON.stringify(second);
  }
}
