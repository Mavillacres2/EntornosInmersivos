import { Engine } from "@babylonjs/core";
import type { Scene } from "@babylonjs/core";

import { AnalysisApplicationController } from "./analysis/AnalysisApplicationController";
import type { ActivityTelemetrySink } from "./analysis/synchronization/ActivityContextAdapter";
import { ClassroomScene } from "./scenes/ClassroomScene";
import { SpaceStationScene } from "./scenes/SpaceStationScene";
import { VisualDiscriminationScene } from "./scenes/VisualDiscriminationScene";
import { SpecialistApp } from "./specialist/SpecialistApp";
import { PerformanceProbe } from "./performance/PerformanceProbe";

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
  description: string;
  illustration: string;
}

const SCENARIO_OPTIONS: ScenarioOption[] = [
  {
    id: "classroom",
    title: "Aula escolar",
    subtitle: "Actividad Go/No-Go",
    buttonLabel: "Entrar al aula",
    description: "Responder ante una señal y detener la respuesta ante otra. Una actividad de atención y control inhibitorio.",
    illustration: '<rect x="62" y="25" width="176" height="90" rx="8"/><path d="M85 50h55m-55 17h90m-90 17h36M50 143h74v25H50zm126 0h74v25h-74zM62 168v18m50-18v18m76-18v18m50-18v18"/>'
  },
  {
    id: "space-station",
    title: "Estación espacial",
    subtitle: "Actividad CPT",
    buttonLabel: "Entrar a la estación",
    description: "Seguir una secuencia de estímulos y responder a las señales objetivo para explorar la atención sostenida.",
    illustration: '<circle cx="150" cy="93" r="56"/><ellipse cx="150" cy="93" rx="98" ry="24" transform="rotate(-25 150 93)"/><path d="M52 35v14m-7-7h14m189 93v14m-7-7h14M216 28v10m-5-5h10"/><circle cx="128" cy="73" r="9"/>'
  },
  {
    id: "interactive-museum",
    title: "Museo interactivo",
    subtitle: "Discriminación visual",
    buttonLabel: "Entrar al museo",
    description: "Observar, comparar y distinguir estímulos visuales en un recorrido interactivo por el museo.",
    illustration: '<path d="M48 65l102-40 102 40zm10 99h184v16H58zM76 76v77m49-77v77m49-77v77m49-77v77"/><path d="M66 76h20m29 0h20m29 0h20m29 0h20"/>'
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
const performanceProbe = new PerformanceProbe(engine, () =>
  analysisController.getPerformanceProbeSnapshot()
);
const specialistApp = new SpecialistApp({
  startCameraSetup: () => {
    analysisController.initialize(() => {
      showScenarioSelector();
    });
  }
});

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
  performanceProbe.dispose();
  engine.dispose();
});

analysisController.onActivityCompleted(() => {
  showReturnToSelectorButton();
});
specialistApp.show();

function showScenarioSelector(): void {
  document.getElementById("scenarioSelector")?.remove();

  const selector = document.createElement("main");

  selector.id = "scenarioSelector";
  selector.setAttribute("aria-labelledby", "scenarioTitle");
  const shell = document.createElement("section");
  shell.className = "scenarioShell";
  const eyebrow = document.createElement("p");
  eyebrow.className = "scenarioEyebrow";
  eyebrow.textContent = "NEUROEXPLORA · ACTIVIDADES INMERSIVAS";

  const heading = document.createElement("h1");
  heading.textContent = "Selecciona un escenario";
  heading.id = "scenarioTitle";

  const description = document.createElement("p");
  description.className = "scenarioIntro";
  description.textContent = "Tres entornos para explorar la atención. Elige la actividad que corresponde a esta sesión.";

  const grid = document.createElement("div");
  grid.className = "scenarioGrid";

  SCENARIO_OPTIONS.forEach((option, index) => {
    const card = document.createElement("article");
    card.className = "scenarioCard";
    const artwork = document.createElement("div");
    artwork.className = "scenarioArtwork";
    artwork.setAttribute("aria-hidden", "true");
    artwork.innerHTML = `<span>0${index + 1}</span><svg viewBox="0 0 300 205" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${option.illustration}</svg>`;

    const title = document.createElement("h2");
    title.textContent = option.title;

    const subtitle = document.createElement("p");
    subtitle.textContent = option.subtitle;
    subtitle.className = "scenarioActivity";
    const purpose = document.createElement("p");
    purpose.className = "scenarioPurpose";
    purpose.textContent = option.description;

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = option.buttonLabel;
    button.addEventListener("click", () => {
      startScenario(option.id);
    });

    card.append(artwork, subtitle, title, purpose, button);
    grid.appendChild(card);
  });

  const finishButton = document.createElement("button");
  finishButton.type = "button";
  finishButton.className = "finishEvaluationButton";
  finishButton.textContent = "Finalizar evaluación";
  finishButton.addEventListener("click", () => {
    void finishEvaluation();
  });

  const footer = document.createElement("footer");
  footer.className = "scenarioFooter";
  const help = document.createElement("p");
  help.textContent = "Al completar una actividad podrás volver aquí y elegir otro escenario.";
  footer.append(help, finishButton);
  shell.append(eyebrow, heading, description, grid, footer);
  selector.append(shell);
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
  performanceProbe.setScene(activeScene);
  canvas.focus();
}

function returnToScenarioSelector(): void {
  document.getElementById("returnToScenarioSelector")?.remove();
  activeScenario?.dispose();
  activeScenario = null;
  activeScene = null;
  performanceProbe.setScene(null);
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
  performanceProbe.setScene(null);
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
