import { CAMERA_STREAM_CONSTRAINTS } from "./CameraConfig";
import type {
  CameraDisconnectListener,
  CameraReconnectListener,
  CameraStatusListener,
  PhysicalCameraManagerStatus,
  PhysicalCameraRole,
  PhysicalCameraSlotStatus,
  VideoDeviceOption
} from "./CameraTypes";

interface CameraSlot {
  selectedDeviceId: string | null;
  state: PhysicalCameraSlotStatus["state"];
  error: string | null;
  stream: MediaStream | null;
  video: HTMLVideoElement;
}

export class CameraManager {
  private readonly mediaDevices: MediaDevices;
  private readonly createVideoElement: () => HTMLVideoElement;
  private readonly slots: Record<PhysicalCameraRole, CameraSlot>;
  private readonly statusListeners = new Set<CameraStatusListener>();
  private readonly disconnectListeners = new Set<CameraDisconnectListener>();
  private readonly reconnectListeners = new Set<CameraReconnectListener>();
  private readonly awaitingRecovery = new Set<PhysicalCameraRole>();
  private readonly recoveryTimeouts = new Map<PhysicalCameraRole, number>();
  private devices: VideoDeviceOption[] = [];
  private permissionGranted = false;
  private initialized = false;

  private readonly handleDeviceChangeBound = (): void => {
    void this.handleDeviceChange();
  };

  constructor(
    mediaDevices: MediaDevices = navigator.mediaDevices,
    createVideoElement: () => HTMLVideoElement = () =>
      document.createElement("video")
  ) {
    this.mediaDevices = mediaDevices;
    this.createVideoElement = createVideoElement;
    this.slots = {
      "upper-body": this.createSlot(),
      "full-body": this.createSlot()
    };
  }

  initialize(): void {
    if (this.initialized) {
      return;
    }

    this.mediaDevices.addEventListener("devicechange", this.handleDeviceChangeBound);
    this.initialized = true;
  }

  async requestPermission(): Promise<VideoDeviceOption[]> {
    this.initialize();
    const permissionStream = await this.mediaDevices.getUserMedia({
      audio: false,
      video: { ...CAMERA_STREAM_CONSTRAINTS }
    });

    try {
      this.permissionGranted = true;
      const devices = await this.enumerateVideoDevices();

      this.assignInitialSelections(devices);
      this.emitStatus();
      return devices;
    } finally {
      permissionStream.getTracks().forEach((track) => track.stop());
    }
  }

  async enumerateVideoDevices(): Promise<VideoDeviceOption[]> {
    const mediaDeviceInfos = await this.mediaDevices.enumerateDevices();

    this.devices = mediaDeviceInfos
      .filter((device) => device.kind === "videoinput" && device.deviceId)
      .map((device, index) => ({
        deviceId: device.deviceId,
        groupId: device.groupId,
        label: device.label || `Camara ${index + 1}`
      }));
    this.emitStatus();
    return [...this.devices];
  }

  setUpperBodyCamera(deviceId: string | null): void {
    this.setCamera("upper-body", deviceId);
  }

  setFullBodyCamera(deviceId: string | null): void {
    this.setCamera("full-body", deviceId);
  }

  async startUpperBodyCamera(): Promise<MediaStream> {
    return this.startCamera("upper-body");
  }

  async startFullBodyCamera(): Promise<MediaStream> {
    return this.startCamera("full-body");
  }

  async startAll(): Promise<void> {
    await this.startUpperBodyCamera();

    if (this.slots["full-body"].selectedDeviceId) {
      await this.startFullBodyCamera();
    }
  }

  stopUpperBodyCamera(): void {
    this.stopCamera("upper-body");
  }

  stopFullBodyCamera(): void {
    this.stopCamera("full-body");
  }

  stopAll(): void {
    this.recoveryTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    this.recoveryTimeouts.clear();
    this.awaitingRecovery.clear();
    this.stopUpperBodyCamera();
    this.stopFullBodyCamera();
  }

  getVideoElement(role: PhysicalCameraRole): HTMLVideoElement {
    return this.slots[role].video;
  }

  getStatus(): PhysicalCameraManagerStatus {
    return {
      permissionGranted: this.permissionGranted,
      devices: this.devices.map((device) => ({ ...device })),
      upperBody: this.buildSlotStatus("upper-body"),
      fullBody: this.buildSlotStatus("full-body")
    };
  }

  onStatusChange(listener: CameraStatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.getStatus());

    return () => this.statusListeners.delete(listener);
  }

  onDisconnect(listener: CameraDisconnectListener): () => void {
    this.disconnectListeners.add(listener);

    return () => this.disconnectListeners.delete(listener);
  }

  onReconnect(listener: CameraReconnectListener): () => void {
    this.reconnectListeners.add(listener);

    return () => this.reconnectListeners.delete(listener);
  }

  dispose(): void {
    this.stopAll();

    if (this.initialized) {
      this.mediaDevices.removeEventListener(
        "devicechange",
        this.handleDeviceChangeBound
      );
    }

    this.statusListeners.clear();
    this.disconnectListeners.clear();
    this.reconnectListeners.clear();
    this.awaitingRecovery.clear();
    this.recoveryTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    this.recoveryTimeouts.clear();
    this.initialized = false;
  }

  private createSlot(): CameraSlot {
    const video = this.createVideoElement();

    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("aria-hidden", "true");

    return {
      selectedDeviceId: null,
      state: "idle",
      error: null,
      stream: null,
      video
    };
  }

  private assignInitialSelections(devices: VideoDeviceOption[]): void {
    const upperSlot = this.slots["upper-body"];
    const fullSlot = this.slots["full-body"];
    const fullSelectionIsValid = Boolean(
      fullSlot.selectedDeviceId && this.hasDevice(fullSlot.selectedDeviceId)
    );

    if (!upperSlot.selectedDeviceId || !this.hasDevice(upperSlot.selectedDeviceId)) {
      upperSlot.selectedDeviceId =
        devices.find(
          (device) =>
            !fullSelectionIsValid || device.deviceId !== fullSlot.selectedDeviceId
        )?.deviceId ?? null;
      upperSlot.state = upperSlot.selectedDeviceId ? "selected" : "unavailable";
    }

    if (!fullSlot.selectedDeviceId || !this.hasDevice(fullSlot.selectedDeviceId)) {
      fullSlot.selectedDeviceId =
        devices.find((device) => device.deviceId !== upperSlot.selectedDeviceId)
          ?.deviceId ?? null;
      fullSlot.state = fullSlot.selectedDeviceId ? "selected" : "unavailable";
    }
  }

  private setCamera(role: PhysicalCameraRole, deviceId: string | null): void {
    const otherRole = role === "upper-body" ? "full-body" : "upper-body";

    if (deviceId && this.slots[otherRole].selectedDeviceId === deviceId) {
      throw new Error("La misma camara no puede utilizarse para ambas funciones.");
    }

    if (deviceId && !this.hasDevice(deviceId)) {
      throw new Error("La camara seleccionada ya no esta disponible.");
    }

    const recoveryTimeoutId = this.recoveryTimeouts.get(role);

    if (recoveryTimeoutId !== undefined) {
      window.clearTimeout(recoveryTimeoutId);
      this.recoveryTimeouts.delete(role);
    }
    this.awaitingRecovery.delete(role);

    const slot = this.slots[role];

    if (slot.selectedDeviceId !== deviceId) {
      this.stopCamera(role);
    }

    slot.selectedDeviceId = deviceId;
    slot.state = deviceId ? "selected" : "unavailable";
    slot.error = null;
    this.emitStatus();
  }

  private async startCamera(role: PhysicalCameraRole): Promise<MediaStream> {
    const slot = this.slots[role];
    const deviceId = slot.selectedDeviceId;

    if (!deviceId) {
      slot.state = "unavailable";
      slot.error = "No hay una camara seleccionada.";
      this.emitStatus();
      throw new Error(slot.error);
    }

    if (slot.stream?.active) {
      return slot.stream;
    }

    slot.state = "starting";
    slot.error = null;
    this.emitStatus();

    try {
      const stream = await this.mediaDevices.getUserMedia({
        audio: false,
        video: {
          ...CAMERA_STREAM_CONSTRAINTS,
          deviceId: { exact: deviceId }
        }
      });

      slot.stream = stream;
      slot.video.srcObject = stream;
      stream.getVideoTracks().forEach((track) => {
        track.addEventListener(
          "ended",
          () => this.handleTrackEnded(role),
          { once: true }
        );
      });
      await slot.video.play();
      slot.state = "streaming";
      this.emitStatus();
      return stream;
    } catch (error) {
      slot.stream?.getTracks().forEach((track) => track.stop());
      slot.stream = null;
      slot.video.pause();
      slot.video.srcObject = null;
      slot.state = "error";
      slot.error = error instanceof Error ? error.message : "No se pudo abrir la camara.";
      this.emitStatus();
      throw error;
    }
  }

  private stopCamera(role: PhysicalCameraRole): void {
    const slot = this.slots[role];

    slot.stream?.getTracks().forEach((track) => track.stop());
    slot.stream = null;
    slot.video.pause();
    slot.video.srcObject = null;
    slot.state = slot.selectedDeviceId ? "selected" : "idle";
    this.emitStatus();
  }

  private async handleDeviceChange(): Promise<void> {
    await this.enumerateVideoDevices();

    (["upper-body", "full-body"] as PhysicalCameraRole[]).forEach((role) => {
      const slot = this.slots[role];

      if (slot.selectedDeviceId && !this.hasDevice(slot.selectedDeviceId)) {
        this.stopCamera(role);
        slot.selectedDeviceId = null;
        slot.state = "unavailable";
        slot.error = "La camara fue desconectada.";
        this.awaitingRecovery.add(role);
        this.disconnectListeners.forEach((listener) => listener(role));
      }
    });
    this.assignInitialSelections(this.devices);
    this.awaitingRecovery.forEach((role) => this.scheduleRecovery(role));
    this.emitStatus();
  }

  private handleTrackEnded(role: PhysicalCameraRole): void {
    const slot = this.slots[role];

    slot.stream = null;
    slot.video.srcObject = null;
    slot.state = "unavailable";
    slot.error = "La transmision de la camara se detuvo.";
    this.awaitingRecovery.add(role);
    this.disconnectListeners.forEach((listener) => listener(role));
    this.scheduleRecovery(role);
    this.emitStatus();
  }

  private scheduleRecovery(role: PhysicalCameraRole): void {
    const slot = this.slots[role];

    if (
      this.recoveryTimeouts.has(role) ||
      !slot.selectedDeviceId ||
      !this.hasDevice(slot.selectedDeviceId)
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      this.recoveryTimeouts.delete(role);
      void this.startCamera(role)
        .then(() => {
          this.awaitingRecovery.delete(role);
          this.reconnectListeners.forEach((listener) => listener(role));
        })
        .catch(() => undefined);
    }, 750);

    this.recoveryTimeouts.set(role, timeoutId);
  }

  private hasDevice(deviceId: string): boolean {
    return this.devices.some((device) => device.deviceId === deviceId);
  }

  private buildSlotStatus(role: PhysicalCameraRole): PhysicalCameraSlotStatus {
    const slot = this.slots[role];

    return {
      role,
      selectedDeviceId: slot.selectedDeviceId,
      state: slot.state,
      error: slot.error,
      streamActive: slot.stream?.active ?? false
    };
  }

  private emitStatus(): void {
    const status = this.getStatus();

    this.statusListeners.forEach((listener) => listener(status));
  }
}
