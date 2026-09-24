import {
  createNoticeCard,
  createProgressSteps,
  createSpecialistLayout,
  specialistIcon
} from "./SpecialistComponents";
import type { SpecialistAction, SpecialistSection } from "./SpecialistComponents";
import { SpecialistResultsView } from "./SpecialistResultsView";

export interface SpecialistAppHandlers {
  startCameraSetup(): void;
}

const NAV_ACTIONS: SpecialistAction[] = [
  { label: "Inicio", section: "home", icon: "home" },
  { label: "Nueva evaluación", section: "new-evaluation", icon: "plus" },
  { label: "Evaluaciones", section: "evaluations", icon: "clipboard" },
  { label: "Resultados", section: "results", icon: "chart" }
];

const PROCESS_STEPS = [
  { icon: "clipboard" as const, title: "Preparación", description: "Organice el entorno y la sesión." },
  { icon: "camera" as const, title: "Cámaras", description: "Verifique los dispositivos de captura." },
  { icon: "activity" as const, title: "Actividades", description: "Realice las tareas inmersivas." },
  { icon: "chart" as const, title: "Resultados", description: "Complete y revise la evaluación." }
];

export class SpecialistApp {
  private root: HTMLElement | null = null;
  private activeSection: SpecialistSection = "home";
  private startingCameraSetup = false;
  private readonly handlers: SpecialistAppHandlers;

  constructor(handlers: SpecialistAppHandlers) {
    this.handlers = handlers;
  }

  show(): void {
    this.render();
  }

  remove(): void {
    this.root?.remove();
    this.root = null;
  }

  private render(): void {
    this.remove();
    const layout = createSpecialistLayout(
      {
        activeSection: this.activeSection,
        title: this.getTitle(),
        subtitle: this.getSubtitle(),
        actions: NAV_ACTIONS
      },
      this.createView()
    );
    this.root = layout;
    this.registerNavigation();
    document.body.appendChild(layout);
  }

  private registerNavigation(): void {
    this.root?.querySelectorAll<HTMLButtonElement>("[data-section]").forEach((button) => {
      button.addEventListener("click", () => {
        const section = button.dataset.section;
        if (section === "home" || section === "new-evaluation" || section === "preparation" || section === "evaluations" || section === "results") {
          this.activeSection = section;
          this.render();
        }
      });
    });
  }

  private createView(): HTMLElement {
    switch (this.activeSection) {
      case "home": return this.createDashboard();
      case "new-evaluation": return this.createNewEvaluation();
      case "preparation": return this.createPreparation();
      case "evaluations": return new SpecialistResultsView({ mode: "evaluations" }).create();
      case "results": return new SpecialistResultsView({ mode: "results" }).create();
    }
  }

  private createDashboard(): HTMLElement {
    const section = document.createElement("section");
    const steps = PROCESS_STEPS.map((step, index) => `
      <li class="processStep">
        <div class="processStepIcon"><span class="processNumber">${index + 1}</span>${specialistIcon(step.icon)}</div>
        <div><h3>${step.title}</h3><p>${step.description}</p></div>
      </li>`).join("");

    section.className = "specialistContent specialistDashboard";
    section.innerHTML = `
      <article class="specialistHero" aria-labelledby="evaluationHeroTitle">
        <div class="heroContent">
          <span class="heroIcon" aria-hidden="true">${specialistIcon("plus")}</span>
          <p class="specialistEyebrow">Nueva evaluación</p>
          <h2 id="evaluationHeroTitle">Iniciar una nueva sesión</h2>
          <p>Prepare una evaluación cognitiva y configure los dispositivos necesarios antes de comenzar las actividades.</p>
          <button class="primaryAction" type="button"><span>Iniciar evaluación</span>${specialistIcon("arrow-right")}</button>
        </div>
        <div class="cognitiveVisual">
          <img
            src="/cognitive-assessment-hero.png"
            alt="Representación tecnológica de actividad cognitiva y señales neuronales"
          />
          <span class="visualCaption" aria-hidden="true">
            ${specialistIcon("activity")}
            Evaluación cognitiva inmersiva
          </span>
        </div>
      </article>
      <section class="processSection" aria-labelledby="evaluationProcessTitle">
        <div class="sectionHeading">
          <div><p class="specialistEyebrow">Recorrido de la sesión</p><h2 id="evaluationProcessTitle">Proceso de evaluación</h2></div>
          <p>El sistema le guiará durante cada etapa de la sesión.</p>
        </div>
        <ol class="processSteps">${steps}</ol>
      </section>
      <section class="specialistSection" aria-labelledby="recentEvaluationsTitle">
        <div class="sectionHeader"><div><p class="specialistEyebrow">Seguimiento</p><h2 id="recentEvaluationsTitle">Evaluaciones recientes</h2></div></div>
      </section>`;

    section.querySelector(".primaryAction")?.addEventListener("click", () => {
      this.activeSection = "new-evaluation";
      this.render();
    });
    section.querySelector(".specialistSection")?.appendChild(
      createNoticeCard("No hay evaluaciones recientes", "Las evaluaciones completadas aparecerán aquí.")
    );
    return section;
  }

  private createNewEvaluation(): HTMLElement {
    const section = document.createElement("section");
    section.className = "specialistContent";
    section.innerHTML = `
      <div class="evaluationIntro"><div><p class="specialistEyebrow">Nueva sesión</p><h2>Nueva evaluación</h2><p>Complete la información necesaria antes de preparar el entorno de evaluación.</p></div></div>
      <div class="evaluationFormPlaceholder"><h3>Información de la evaluación</h3><p>El código pseudonimizado del participante se solicitará durante la configuración de cámaras.</p></div>
      <div class="specialistActions"><button class="secondaryAction" type="button">Volver</button><button class="primaryAction" type="button">Continuar a preparación</button></div>`;

    section.querySelector(".secondaryAction")?.addEventListener("click", () => {
      this.activeSection = "home";
      this.render();
    });
    section.querySelector(".primaryAction")?.addEventListener("click", () => {
      this.activeSection = "preparation";
      this.render();
    });
    return section;
  }

  private createPreparation(): HTMLElement {
    const section = document.createElement("section");
    section.className = "specialistContent";
    section.appendChild(createProgressSteps(0));
    section.insertAdjacentHTML("beforeend", `
      <article class="preparationCard">
        <div class="preparationIcon" aria-hidden="true">${specialistIcon("camera")}</div>
        <div class="preparationBody">
          <p class="specialistEyebrow">Preparación de la evaluación</p><h2>Preparar dispositivos</h2>
          <p>Antes de iniciar las actividades, verifique que las cámaras y dispositivos necesarios estén correctamente configurados.</p>
          <ul class="preparationChecklist"><li>Verifique que las cámaras estén conectadas.</li><li>Mantenga una iluminación adecuada.</li><li>Compruebe que el área de evaluación esté preparada.</li><li>Confirme que el niño se encuentre correctamente ubicado.</li></ul>
        </div>
      </article>
      <div class="specialistActions"><button class="secondaryAction" type="button">Volver</button><button class="primaryAction" type="button">Configurar cámaras</button></div>`);

    const backButton = section.querySelector<HTMLButtonElement>(".secondaryAction");
    const cameraButton = section.querySelector<HTMLButtonElement>(".primaryAction");
    backButton?.addEventListener("click", () => {
      this.activeSection = "new-evaluation";
      this.render();
    });
    cameraButton?.addEventListener("click", () => {
      if (this.startingCameraSetup) return;
      this.startingCameraSetup = true;
      cameraButton.disabled = true;
      cameraButton.textContent = "Abriendo configuración...";
      this.remove();
      this.handlers.startCameraSetup();
    });
    return section;
  }

  private getTitle(): string {
    switch (this.activeSection) {
      case "home": return "Panel del especialista";
      case "new-evaluation": return "Nueva evaluación";
      case "preparation": return "Preparación de la evaluación";
      case "evaluations": return "Evaluaciones";
      case "results": return "Resultados";
    }
  }

  private getSubtitle(): string {
    switch (this.activeSection) {
      case "home": return "Bienvenido al entorno de evaluación. Gestione y prepare una nueva sesión.";
      case "new-evaluation": return "Complete la información necesaria antes de preparar el entorno de evaluación.";
      case "preparation": return "Verifique el entorno antes de pasar al módulo de cámaras.";
      case "evaluations": return "Consulte el historial y el estado de las sesiones registradas.";
      case "results": return "Explore indicadores conductuales y rendimiento cognitivo por sesión.";
    }
  }
}
