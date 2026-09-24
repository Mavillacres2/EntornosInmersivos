export type SpecialistSection = "home" | "new-evaluation" | "preparation" | "evaluations" | "results";

export type SpecialistIconName =
  | "activity"
  | "arrow-right"
  | "arrow-left"
  | "camera"
  | "chart"
  | "clipboard"
  | "clock"
  | "home"
  | "plus"
  | "download"
  | "search";

export interface SpecialistAction {
  label: string;
  section: SpecialistSection | "future";
  icon: SpecialistIconName;
  disabled?: boolean;
  badge?: string;
}

export interface SpecialistLayoutOptions {
  activeSection: SpecialistSection;
  title: string;
  subtitle: string;
  actions: SpecialistAction[];
}

const ICON_PATHS: Record<SpecialistIconName, string> = {
  activity: '<path d="M3 12h4l2.4-7 4.2 14 2.6-7H21"/>',
  "arrow-right": '<path d="M5 12h14M13 6l6 6-6 6"/>',
  "arrow-left": '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  camera: '<path d="M14.5 5 13 3h-2L9.5 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-4.5Z"/><circle cx="12" cy="12" r="4"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5V3h6v1.5M9 11l2 2 4-4M9 17h6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  home: '<path d="m3 11 9-8 9 8M5 10v10h14V10M9 20v-6h6v6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>'
};

export function specialistIcon(name: SpecialistIconName, className = ""): string {
  return `<svg class="specialistIcon ${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[name]}</svg>`;
}

export function createSpecialistLayout(options: SpecialistLayoutOptions, content: HTMLElement): HTMLElement {
  const root = document.createElement("main");

  root.id = "specialistApp";
  root.innerHTML = `
    <aside class="specialistSidebar" aria-label="Navegación principal">
      <div class="specialistBrand" aria-label="NeuroExplora: entornos inmersivos para apoyar la evaluación cognitiva">
        <div class="specialistBrandFullLockup">
          <img
            class="specialistBrandFull"
            src="/neuroexplora-logo-v2.png"
            alt="NeuroExplora"
          />
          <p class="specialistBrandTagline">Entornos inmersivos para apoyar la evaluación cognitiva</p>
        </div>
        <div class="specialistBrandCompact">
          <span class="specialistBrandMark" aria-hidden="true">
            <img src="/neuroexplora-symbol-v2.png" alt="" />
          </span>
          <div>
            <strong>NeuroExplora</strong>
            <span>Entornos inmersivos para apoyar la evaluación cognitiva</span>
          </div>
        </div>
      </div>
      <nav class="specialistNav"></nav>
    </aside>
    <section class="specialistWorkspace">
      <header class="specialistTopbar">
        <p class="specialistEyebrow">Módulo del especialista</p>
        <h1>${options.title}</h1>
        <p>${options.subtitle}</p>
      </header>
    </section>`;

  const nav = root.querySelector(".specialistNav");
  options.actions.forEach((action) => {
    const button = document.createElement("button");
    const label = document.createElement("span");
    button.type = "button";
    button.disabled = action.disabled ?? false;
    button.dataset.section = action.section;
    button.innerHTML = specialistIcon(action.icon, "navIcon");
    label.className = "navLabel";
    label.textContent = action.label;
    button.appendChild(label);
    if (action.badge) {
      const badge = document.createElement("span");
      badge.className = "navBadge";
      badge.textContent = action.badge;
      button.appendChild(badge);
    }
    if (action.section === options.activeSection) button.setAttribute("aria-current", "page");
    nav?.appendChild(button);
  });

  root.querySelector(".specialistWorkspace")?.appendChild(content);
  return root;
}

export function createProgressSteps(activeIndex: number): HTMLElement {
  const steps = ["Preparación", "Cámaras", "Actividades", "Resultados"];
  const list = document.createElement("ol");
  list.className = "evaluationProgress";
  steps.forEach((label, index) => {
    const item = document.createElement("li");
    item.dataset.state = index < activeIndex ? "complete" : index === activeIndex ? "active" : "pending";
    item.innerHTML = `<span aria-hidden="true">${index + 1}</span><strong>${label}</strong>`;
    if (index === activeIndex) item.setAttribute("aria-current", "step");
    list.appendChild(item);
  });
  return list;
}

export function createNoticeCard(title: string, message: string): HTMLElement {
  const card = document.createElement("article");
  card.className = "specialistNoticeCard";
  card.innerHTML = `
    <div class="noticeIcon" aria-hidden="true">${specialistIcon("clock")}</div>
    <div><h3>${title}</h3><p>${message}</p></div>`;
  return card;
}
