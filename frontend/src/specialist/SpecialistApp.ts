import {
  createProgressSteps,
  createSpecialistLayout,
  specialistIcon
} from "./SpecialistComponents";
import type { SpecialistAction, SpecialistSection } from "./SpecialistComponents";
import { SpecialistResultsView } from "./SpecialistResultsView";
import { SpecialistAccess } from './SpecialistAccess';

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
  private resultSessionId: string | undefined;
  private readonly handlers: SpecialistAppHandlers;

  constructor(handlers: SpecialistAppHandlers) {
    this.handlers = handlers;
  }

  show(): void {
    this.render();
  }

  showResults(sessionId:string):void{this.startingCameraSetup=false;this.resultSessionId=sessionId;this.activeSection='results';this.render();}

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
      case "evaluations": return SpecialistAccess.gate(()=>new SpecialistResultsView({ mode: "evaluations" }).create());
      case "results": return SpecialistAccess.gate(()=>new SpecialistResultsView({ mode: "results",openSessionId:this.resultSessionId }).create());
    }
  }

  private createDashboard(): HTMLElement {
    const section = document.createElement('section');
    section.className = 'specialistContent specialistDashboard';
    section.innerHTML = `
      <article class="specialistHero v1Hero" aria-labelledby="evaluationHeroTitle">
        <div class="heroContent"><p class="specialistEyebrow">Observar · Comprender · Acompañar</p>
          <h2 id="evaluationHeroTitle">Una mirada más completa a cada actividad</h2>
          <p>Un espacio de trabajo para preparar experiencias inmersivas y revisar el desempeño junto con indicadores de movimiento y orientación.</p>
          <div class="v1Tags"><span>3 entornos</span><span>Práctica guiada</span><span>Indicadores por sesión</span></div>
        </div><div class="cognitiveVisual"><img src="/cognitive-assessment-hero.png" alt="Ilustración de conexiones y actividad cognitiva" /></div>
      </article>
      <section class="processSection" aria-labelledby="evaluationProcessTitle"><div class="sectionHeading"><div><p class="specialistEyebrow">Su espacio de trabajo</p><h2 id="evaluationProcessTitle">Un recorrido, paso a paso</h2></div><p>Para preparar una sesión, abra «Nueva evaluación» en el menú.</p></div>
        <ol class="processSteps">${PROCESS_STEPS.map((step,index)=>`<li class="processStep"><div class="processStepIcon"><span class="processNumber">${index+1}</span>${specialistIcon(step.icon)}</div><div><h3>${step.title}</h3><p>${step.description}</p></div></li>`).join('')}</ol>
      </section>
      <div class="v1InfoGrid"><article><span class="v1InfoIcon">${specialistIcon('activity')}</span><h3>El desempeño en contexto</h3><p>Consulte respuestas, tiempos y eventos junto con indicadores conductuales. Revise siempre la calidad de la captura.</p></article><article><span class="v1InfoIcon">${specialistIcon('camera')}</span><h3>La imagen se procesa aquí</h3><p>El video se analiza en el equipo. Se envían indicadores y resultados, no grabaciones de la cámara.</p></article><article><span class="v1InfoIcon">${specialistIcon('clipboard')}</span><h3>Una herramienta de apoyo</h3><p>Los resultados complementan la revisión del especialista. No generan un diagnóstico automático.</p></article></div>`;
    return section;
  }

  private createNewEvaluation(): HTMLElement {
    const section = document.createElement('section');
    section.className = 'specialistContent';
    section.append(createProgressSteps(0));
    section.insertAdjacentHTML('beforeend', `<div class="v1SessionGrid"><article class="v1SessionCard"><p class="specialistEyebrow">Antes de comenzar</p><h2>Prepare una experiencia tranquila</h2><p>Usted configura la sesión. Después, el niño elige la aventura y escucha a su guía.</p><ul class="v1Checklist"><li><strong>Un código, sin nombres</strong><span>Tenga a mano el identificador del participante, por ejemplo P001. Se solicitará al configurar las cámaras.</span></li><li><strong>Una cámara es suficiente para comenzar</strong><span>La integrada registra rostro y tren superior. Una segunda cámara es opcional para cuerpo y manos.</span></li><li><strong>Un espacio cómodo</strong><span>Buena luz, rostro visible, sonido audible y teclado o ratón al alcance.</span></li></ul></article><aside class="v1SessionAside"><span class="v1InfoIcon">${specialistIcon('clipboard')}</span><h3>Participación informada</h3><p>Explique la experiencia y confirme las autorizaciones correspondientes con el representante antes de iniciar.</p><p>El permiso de cámara no sustituye el consentimiento informado. Consulte Privacidad y Condiciones al pie de la página.</p><strong>Durante la actividad</strong><p>El niño puede pedir ayuda o detenerse. La práctica le permite comprender la regla antes de empezar.</p></aside></div><div class="specialistActions"><button class="secondaryAction" type="button">Volver al inicio</button><button class="primaryAction" type="button">Preparar las cámaras →</button></div>`);
    section.querySelector('.secondaryAction')?.addEventListener('click',()=>{this.activeSection='home';this.render();});
    section.querySelector('.primaryAction')?.addEventListener('click',()=>{
      if(this.startingCameraSetup)return;
      this.startingCameraSetup=true;this.remove();this.handlers.startCameraSetup();
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
