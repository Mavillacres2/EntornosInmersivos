import { beforeEach, describe, expect, it, vi } from "vitest";

import { CameraManager } from "../cameras/CameraManager";

class FakeTrack extends EventTarget {
  stopped = false;

  stop(): void {
    this.stopped = true;
  }
}

class FakeStream {
  active = true;
  readonly track = new FakeTrack();

  getTracks(): MediaStreamTrack[] {
    return [this.track as unknown as MediaStreamTrack];
  }

  getVideoTracks(): MediaStreamTrack[] {
    return this.getTracks();
  }
}

class FakeMediaDevices extends EventTarget {
  devices: MediaDeviceInfo[];
  readonly constraints: MediaStreamConstraints[] = [];
  readonly streams: FakeStream[] = [];

  constructor(deviceIds: string[]) {
    super();
    this.devices = deviceIds.map((deviceId, index) =>
      ({
        deviceId,
        groupId: `group-${index}`,
        kind: "videoinput",
        label: index === 0 ? "Integrated Camera" : "USB Camera",
        toJSON: () => ({})
      }) as MediaDeviceInfo
    );
  }

  async enumerateDevices(): Promise<MediaDeviceInfo[]> {
    return this.devices;
  }

  async getUserMedia(
    constraints: MediaStreamConstraints
  ): Promise<MediaStream> {
    this.constraints.push(constraints);
    const stream = new FakeStream();

    this.streams.push(stream);
    return stream as unknown as MediaStream;
  }
}

function createVideo(): HTMLVideoElement {
  return {
    autoplay: false,
    muted: false,
    playsInline: false,
    srcObject: null,
    play: vi.fn(async () => undefined),
    pause: vi.fn(),
    setAttribute: vi.fn()
  } as unknown as HTMLVideoElement;
}

function createFailingVideo(): HTMLVideoElement {
  return {
    autoplay: false,
    muted: false,
    playsInline: false,
    srcObject: null,
    play: vi.fn(async () => {
      throw new Error("play blocked");
    }),
    pause: vi.fn(),
    setAttribute: vi.fn()
  } as unknown as HTMLVideoElement;
}

async function settleDeviceChange(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("CameraManager", () => {
  beforeEach(() => {
    vi.stubGlobal("window", globalThis);
  });

  it("permite continuar con CAM1 cuando solo existe una camara", async () => {
    const mediaDevices = new FakeMediaDevices(["integrated"]);
    const manager = new CameraManager(
      mediaDevices as unknown as MediaDevices,
      createVideo
    );

    await manager.requestPermission();

    expect(manager.getStatus().upperBody.selectedDeviceId).toBe("integrated");
    expect(manager.getStatus().fullBody.selectedDeviceId).toBeNull();
    expect(mediaDevices.streams[0]?.track.stopped).toBe(true);
    manager.dispose();
  });

  it("selecciona dos dispositivos distintos y usa deviceId exact", async () => {
    const mediaDevices = new FakeMediaDevices(["integrated", "usb"]);
    const manager = new CameraManager(
      mediaDevices as unknown as MediaDevices,
      createVideo
    );

    await manager.requestPermission();
    await manager.startAll();

    const status = manager.getStatus();
    const cameraCalls = mediaDevices.constraints.slice(1);

    expect(status.upperBody.selectedDeviceId).toBe("integrated");
    expect(status.fullBody.selectedDeviceId).toBe("usb");
    expect(cameraCalls).toHaveLength(2);
    expect((cameraCalls[0]?.video as MediaTrackConstraints).deviceId).toEqual({
      exact: "integrated"
    });
    expect((cameraCalls[1]?.video as MediaTrackConstraints).deviceId).toEqual({
      exact: "usb"
    });
    manager.dispose();
  });

  it("impide seleccionar la misma camara para CAM1 y CAM2", async () => {
    const mediaDevices = new FakeMediaDevices(["integrated", "usb"]);
    const manager = new CameraManager(
      mediaDevices as unknown as MediaDevices,
      createVideo
    );

    await manager.requestPermission();

    expect(() => manager.setFullBodyCamera("integrated")).toThrow(
      "La misma camara no puede utilizarse para ambas funciones."
    );
    manager.dispose();
  });

  it("detiene todos los tracks al finalizar", async () => {
    const mediaDevices = new FakeMediaDevices(["integrated", "usb"]);
    const manager = new CameraManager(
      mediaDevices as unknown as MediaDevices,
      createVideo
    );

    await manager.requestPermission();
    await manager.startAll();
    manager.stopAll();

    expect(mediaDevices.streams.slice(1).every((stream) => stream.track.stopped)).toBe(
      true
    );
    expect(manager.getStatus().upperBody.streamActive).toBe(false);
    expect(manager.getStatus().fullBody.streamActive).toBe(false);
    manager.dispose();
  });

  it("libera el stream si el elemento de video no puede reproducirlo", async () => {
    const mediaDevices = new FakeMediaDevices(["integrated"]);
    const manager = new CameraManager(
      mediaDevices as unknown as MediaDevices,
      createFailingVideo
    );

    await manager.requestPermission();
    await expect(manager.startUpperBodyCamera()).rejects.toThrow("play blocked");

    expect(mediaDevices.streams[1]?.track.stopped).toBe(true);
    expect(manager.getStatus().upperBody.streamActive).toBe(false);
    expect(manager.getStatus().upperBody.state).toBe("error");
    manager.dispose();
  });

  it("marca CAM2 como no disponible si se desconecta", async () => {
    const mediaDevices = new FakeMediaDevices(["integrated", "usb"]);
    const manager = new CameraManager(
      mediaDevices as unknown as MediaDevices,
      createVideo
    );
    const disconnected = vi.fn();

    manager.onDisconnect(disconnected);
    await manager.requestPermission();
    await manager.startAll();
    mediaDevices.devices = mediaDevices.devices.filter(
      (device) => device.deviceId !== "usb"
    );
    mediaDevices.dispatchEvent(new Event("devicechange"));
    await settleDeviceChange();

    expect(disconnected).toHaveBeenCalledWith("full-body");
    expect(manager.getStatus().fullBody.selectedDeviceId).toBeNull();
    expect(manager.getStatus().upperBody.selectedDeviceId).toBe("integrated");
    manager.dispose();
  });

  it("no duplica CAM2 cuando CAM1 se desconecta", async () => {
    const mediaDevices = new FakeMediaDevices(["integrated", "usb"]);
    const manager = new CameraManager(
      mediaDevices as unknown as MediaDevices,
      createVideo
    );

    await manager.requestPermission();
    await manager.startAll();
    mediaDevices.devices = mediaDevices.devices.filter(
      (device) => device.deviceId !== "integrated"
    );
    mediaDevices.dispatchEvent(new Event("devicechange"));
    await settleDeviceChange();

    expect(manager.getStatus().upperBody.selectedDeviceId).toBeNull();
    expect(manager.getStatus().fullBody.selectedDeviceId).toBe("usb");
    manager.dispose();
  });
});
