import { Engine } from "@babylonjs/core";
import type { Scene } from "@babylonjs/core";

import { ClassroomScene } from "./scenes/ClassroomScene";
import { SpaceStationScene } from "./scenes/SpaceStationScene";
import { VisualDiscriminationScene } from "./scenes/VisualDiscriminationScene";

import "./style.css";

const PERFORMANCE_RENDER_SCALE = 1.15;

type ScenarioId = "classroom" | "space-station" | "interactive-museum";

interface ScenarioController {
  create: () => Scene;
  dispose: () => void;
}

interface ScenarioOption {
  id: ScenarioId;
  title: string;
  subtitle: string;
  buttonLabel: string;
}

const SCENARIO_OPTIONS: ScenarioOption[] = [
  {
    id: "classroom",
    title: "Aula escolar",
    subtitle: "Actividad Go/No-Go",
    buttonLabel: "Entrar al aula"
  },
  {
    id: "space-station",
    title: "Estacion espacial",
    subtitle: "Actividad CPT",
    buttonLabel: "Entrar al CPT"
  },
  {
    id: "interactive-museum",
    title: "Museo interactivo",
    subtitle: "Discriminacion visual",
    buttonLabel: "Entrar al museo"
  }
];

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

let activeScenario: ScenarioController | null = null;
let activeScene: Scene | null = null;

engine.runRenderLoop(() => {
  activeScene?.render();
});

window.addEventListener("resize", () => {
  engine.resize();
});

window.addEventListener("beforeunload", () => {
  activeScenario?.dispose();
  engine.dispose();
});

showScenarioSelector();

function showScenarioSelector(): void {
  document.getElementById("scenarioSelector")?.remove();

  const selector = document.createElement("main");

  selector.id = "scenarioSelector";

  const heading = document.createElement("h1");
  heading.textContent = "Selecciona un escenario";

  const description = document.createElement("p");
  description.textContent = "Elige la actividad inmersiva que quieres iniciar.";

  const grid = document.createElement("div");
  grid.className = "scenarioGrid";

  SCENARIO_OPTIONS.forEach((option) => {
    const card = document.createElement("article");
    card.className = "scenarioCard";

    const title = document.createElement("h2");
    title.textContent = option.title;

    const subtitle = document.createElement("p");
    subtitle.textContent = option.subtitle;

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = option.buttonLabel;
    button.addEventListener("click", () => {
      startScenario(option.id);
    });

    card.append(title, subtitle, button);
    grid.appendChild(card);
  });

  selector.append(heading, description, grid);
  document.body.appendChild(selector);
}

function startScenario(scenarioId: ScenarioId): void {
  document.getElementById("scenarioSelector")?.remove();
  activeScenario?.dispose();

  activeScenario = createScenario(scenarioId);
  activeScene = activeScenario.create();
  canvas.focus();
}

function returnToScenarioSelector(): void {
  activeScenario?.dispose();
  activeScenario = null;
  activeScene = null;
  showScenarioSelector();
}

function createScenario(scenarioId: ScenarioId): ScenarioController {
  switch (scenarioId) {
    case "classroom":
      return new ClassroomScene(engine, canvas);

    case "space-station":
      return new SpaceStationScene(engine, canvas);

    case "interactive-museum":
      return new VisualDiscriminationScene(engine, canvas, returnToScenarioSelector);
  }
}
