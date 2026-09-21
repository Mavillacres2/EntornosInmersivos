export type PhysicalCameraRole = "upper-body" | "full-body";
export type PhysicalCameraState =
  | "idle"
  | "selected"
  | "starting"
  | "streaming"
  | "unavailable"
  | "error";

export interface VideoDeviceOption {
  deviceId: string;
  groupId: string;
  label: string;
}

export interface PhysicalCameraSlotStatus {
  role: PhysicalCameraRole;
  selectedDeviceId: string | null;
  state: PhysicalCameraState;
  error: string | null;
  streamActive: boolean;
}

export interface PhysicalCameraManagerStatus {
  permissionGranted: boolean;
  devices: VideoDeviceOption[];
  upperBody: PhysicalCameraSlotStatus;
  fullBody: PhysicalCameraSlotStatus;
}

export type CameraStatusListener = (status: PhysicalCameraManagerStatus) => void;
export type CameraDisconnectListener = (role: PhysicalCameraRole) => void;
export type CameraReconnectListener = (role: PhysicalCameraRole) => void;
