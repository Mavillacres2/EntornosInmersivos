import { Engine } from "@babylonjs/core";
import type { Scene } from "@babylonjs/core";

import { AnalysisApplicationController } from "./analysis/AnalysisApplicationController";
import type { ActivityTelemetrySink } from "./analysis/synchronization/ActivityContextAdapter";
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
const analysisController = new AnalysisApplicationController(engine);

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
  analysisController.dispose();
  engine.dispose();
});

analysisController.onActivityCompleted(() => {
  showReturnToSelectorButton();
});
analysisController.initialize(() => {
  showScenarioSelector();
});

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

  const finishButton = document.createElement("button");
  finishButton.type = "button";
  finishButton.className = "finishEvaluationButton";
  finishButton.textContent = "Finalizar evaluacion";
  finishButton.addEventListener("click", () => {
    void finishEvaluation();
  });

  selector.append(heading, description, grid, finishButton);
  document.body.appendChild(selector);
}

function startScenario(scenarioId: ScenarioId): void {
  document.getElementById("scenarioSelector")?.remove();
  document.getElementById("returnToScenarioSelector")?.remove();
  activeScenario?.dispose();

  const telemetry = analysisController.setActiveScenario(
    scenarioId,
    getActivityId(scenarioId)
  );

  activeScenario = createScenario(scenarioId, telemetry);
  activeScene = activeScenario.create();
  canvas.focus();
}

function returnToScenarioSelector(): void {
  document.getElementById("returnToScenarioSelector")?.remove();
  activeScenario?.dispose();
  activeScenario = null;
  activeScene = null;
  analysisController.clearActiveScenario();
  showScenarioSelector();
}

function createScenario(
  scenarioId: ScenarioId,
  telemetry: ActivityTelemetrySink
): ScenarioController {
  switch (scenarioId) {
    case "classroom":
      return new ClassroomScene(engine, canvas, telemetry);

    case "space-station":
      return new SpaceStationScene(engine, canvas, telemetry);

    case "interactive-museum":
      return new VisualDiscriminationScene(
        engine,
        canvas,
        returnToScenarioSelector,
        telemetry
      );
  }
}

function getActivityId(scenarioId: ScenarioId): string {
  switch (scenarioId) {
    case "classroom":
      return "go-no-go";
    case "space-station":
      return "cpt";
    case "interactive-museum":
      return "visual-discrimination";
  }
}

function showReturnToSelectorButton(): void {
  document.getElementById("returnToScenarioSelector")?.remove();
  const button = document.createElement("button");

  button.id = "returnToScenarioSelector";
  button.type = "button";
  button.textContent = "Volver a escenarios";
  button.addEventListener("click", returnToScenarioSelector);
  document.body.appendChild(button);
}

async function finishEvaluation(): Promise<void> {
  document.getElementById("evaluationFinished")?.remove();
  const selector = document.getElementById("scenarioSelector");
  const finishButton = selector?.querySelector<HTMLButtonElement>(
    ".finishEvaluationButton"
  );

  if (finishButton) {
    finishButton.disabled = true;
    finishButton.textContent = "Finalizando...";
  }

  const result = await analysisController.finishEvaluation();
  const completed = result.dataFlushed && result.sessionFinished;
  activeScenario?.dispose();
  activeScenario = null;
  activeScene = null;
  selector?.remove();

  const finished = document.createElement("main");
  finished.id = "evaluationFinished";
  finished.innerHTML = `
    <section>
      <h1>${completed ? "Evaluacion finalizada" : "Envio pendiente"}</h1>
      <p>${
        completed
          ? "Los indicadores pendientes fueron enviados y las camaras se detuvieron."
          : "Las camaras se detuvieron, pero el backend no recibio todos los datos. Reintenta cuando la conexion este disponible."
      }</p>
      <button type="button">${completed ? "Nueva evaluacion" : "Reintentar envio"}</button>
    </section>
  `;
  finished.querySelector("button")?.addEventListener("click", () => {
    if (completed) {
      window.location.reload();
      return;
    }

    void finishEvaluation();
  });
  document.body.appendChild(finished);
}
