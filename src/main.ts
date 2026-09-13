import { Engine } from "@babylonjs/core";

import { ClassroomScene } from "./scenes/ClassroomScene";

import "./style.css";

const PERFORMANCE_RENDER_SCALE = 1.15;

const canvas = document.createElement("canvas");
canvas.id = "renderCanvas";
canvas.tabIndex = 0;

document.body.appendChild(canvas);

const engine = new Engine(canvas, false, {
  preserveDrawingBuffer: false,
  stencil: false,
  powerPreference: "high-performance"
});

engine.setHardwareScalingLevel(PERFORMANCE_RENDER_SCALE);

const classroomScene = new ClassroomScene(engine, canvas);
const scene = classroomScene.create();

engine.runRenderLoop(() => {
  scene.render();
});

window.addEventListener("resize", () => {
  engine.resize();
});

window.addEventListener("beforeunload", () => {
  classroomScene.dispose();
  engine.dispose();
});
