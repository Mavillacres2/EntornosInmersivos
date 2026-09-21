import { ANALYSIS_CONFIG } from "../config/AnalysisConfig";

export const CAMERA_STREAM_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: ANALYSIS_CONFIG.camera.idealWidth },
  height: { ideal: ANALYSIS_CONFIG.camera.idealHeight },
  frameRate: { ideal: ANALYSIS_CONFIG.camera.idealFrameRate }
};
