import { SpecialistDataApi } from "./SpecialistDataApi";
import type { SessionDetail, SessionListItem, TimelineEvent, TimelineResponse } from "./SpecialistDataApi";
import { createNoticeCard, specialistIcon } from "./SpecialistComponents";

interface ResultsViewOptions {
  mode: "evaluations" | "results";
  openSessionId?: string;
}

export class SpecialistResultsView {
  private readonly api = new SpecialistDataApi();
  private page = 1;
  private readonly pageSize = 10;
  private readonly options: ResultsViewOptions;

  constructor(options: ResultsViewOptions) {
    this.options = options;
  }

  create(): HTMLElement {
    const section = document.createElement("section");
    section.className = "specialistContent sessionBrowser";
    section.innerHTML = `
      <form class="sessionFilters">
        <label>Código del participante<input name="participantCode" maxlength="40" placeholder="Ej. P001"></label>
        <label>Estado<select name="status"><option value="">Todos</option><option value="finished">Finalizada</option><option value="active">En curso</option></select></label>
        <label>Desde<input name="dateFrom" type="date"></label>
        <label>Hasta<input name="dateTo" type="date"></label>
        <button class="primaryAction" type="submit">${specialistIcon("search")}<span>Buscar</span></button>
      </form>
      <div class="sessionViewStatus" role="status">Consultando evaluaciones...</div>
      <div class="sessionViewContent"></div>`;
    const form = section.querySelector<HTMLFormElement>("form")!;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.page = 1;
      void this.loadList(section);
    });
    void (this.options.openSessionId
      ? this.loadDetail(section, this.options.openSessionId)
      : this.loadList(section));
    return section;
  }

  private async loadList(root: HTMLElement): Promise<void> {
    const status = root.querySelector<HTMLElement>(".sessionViewStatus")!;
    const content = root.querySelector<HTMLElement>(".sessionViewContent")!;
    const form = root.querySelector<HTMLFormElement>("form")!;
    const data = new FormData(form);
    status.hidden = false;
    status.textContent = "Consultando evaluaciones...";
    content.replaceChildren();
    try {
      const dateFrom = String(data.get("dateFrom") ?? "");
      const dateTo = String(data.get("dateTo") ?? "");
      const result = await this.api.listSessions({
        participantCode: String(data.get("participantCode") ?? "").trim(),
        status: String(data.get("status") ?? ""),
        dateFrom: dateFrom ? new Date(`${dateFrom}T00:00:00`).toISOString() : undefined,
        dateTo: dateTo ? new Date(`${dateTo}T23:59:59.999`).toISOString() : undefined,
        page: this.page,
        pageSize: this.pageSize
      });
      status.hidden = true;
      if (!result.items.length) {
        content.appendChild(createNoticeCard("Sin evaluaciones", "No se encontraron sesiones con los filtros seleccionados."));
        return;
      }
      content.append(this.renderTable(result.items), this.renderPagination(result.pagination, root));
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "No se pudo realizar la consulta";
      status.dataset.tone = "danger";
    }
  }

  private renderTable(items: SessionListItem[]): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "sessionTableWrap";
    wrapper.innerHTML = `<table class="sessionTable"><thead><tr><th>Participante</th><th>Inicio</th><th>Estado</th><th>Escenarios</th><th>Muestras</th><th><span class="srOnly">Acciones</span></th></tr></thead><tbody></tbody></table>`;
    const body = wrapper.querySelector("tbody")!;
    items.forEach((session) => {
      const row = document.createElement("tr");
      row.innerHTML = `<td><strong>${escapeHtml(session.participantCode)}</strong></td><td>${formatDate(session.startedAt)}</td><td><span class="statusPill" data-status="${session.status}">${session.status === "finished" ? "Finalizada" : "En curso"}</span></td><td>${session.scenariosCompleted?.length ?? 0} / 3</td><td>${formatNumber(session.sampleCount)}</td><td><button class="tableAction" type="button">Ver ${this.options.mode === "results" ? "resultados" : "detalle"}</button></td>`;
      row.querySelector("button")?.addEventListener("click", () => void this.loadDetail(wrapper.closest(".sessionBrowser")!, session.sessionId));
      body.appendChild(row);
    });
    return wrapper;
  }

  private renderPagination(pagination: { page: number; total: number; totalPages: number }, root: HTMLElement): HTMLElement {
    const nav = document.createElement("nav");
    nav.className = "sessionPagination";
    nav.setAttribute("aria-label", "Paginación de evaluaciones");
    nav.innerHTML = `<button type="button" ${pagination.page <= 1 ? "disabled" : ""}>Anterior</button><span>Página ${pagination.page} de ${Math.max(1, pagination.totalPages)} · ${pagination.total} evaluaciones</span><button type="button" ${pagination.page >= pagination.totalPages ? "disabled" : ""}>Siguiente</button>`;
    const buttons = nav.querySelectorAll("button");
    buttons[0]?.addEventListener("click", () => { this.page -= 1; void this.loadList(root); });
    buttons[1]?.addEventListener("click", () => { this.page += 1; void this.loadList(root); });
    return nav;
  }

  private async loadDetail(root: HTMLElement, sessionId: string): Promise<void> {
    const status = root.querySelector<HTMLElement>(".sessionViewStatus")!;
    const content = root.querySelector<HTMLElement>(".sessionViewContent")!;
    status.hidden = false;
    status.textContent = "Preparando resultados...";
    content.replaceChildren();
    try {
      const [session, timeline] = await Promise.all([
        this.api.getSession(sessionId),
        this.api.getTimeline(sessionId)
      ]);
      status.hidden = true;
      content.appendChild(this.renderDetail(session, timeline, root));
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "No se pudo cargar la evaluación";
      status.dataset.tone = "danger";
    }
  }

  private renderDetail(session: SessionDetail, timeline: TimelineResponse, root: HTMLElement): HTMLElement {
    const detail = document.createElement("article");
    const summary = session.summary ?? {};
    detail.className = "resultsDashboard";
    detail.innerHTML = `
      <header class="resultsHeader"><div><button class="backToSessions" type="button">${specialistIcon("arrow-left")} Volver al listado</button><p class="specialistEyebrow">Participante ${escapeHtml(session.participantCode)}</p><h2>Resultados de la evaluación</h2><p>${formatDate(session.startedAt)} · ${session.status === "finished" ? "Sesión finalizada" : "Sesión en curso"}</p></div><div class="exportActions"><button type="button" data-export="csv">${specialistIcon("download")} CSV</button><button type="button" data-export="json">${specialistIcon("download")} JSON</button></div></header>
      <section class="metricGrid" aria-label="Resumen general">
        ${metric("Muestras", summary.sampleCount, "registros")}
        ${metric("Orientación fuera de tarea", summary.offTaskOrientationPercentage, "%")}
        ${metric("Episodios fuera de tarea", summary.offTaskEpisodeCount, "episodios")}
        ${metric("Actividad motora global", summary.globalMotorActivityMean, "promedio")}
        ${metric("Respuesta a distractores", summary.distractorResponseCount, "respuestas")}
        ${metric("Latencia ante distractores", summary.meanDistractorOrientationLatencyMs, "ms")}
      </section>
      <section class="resultsBand"><div class="sectionHeader"><div><p class="specialistEyebrow">Rendimiento</p><h3>Resultados cognitivos</h3></div></div><div class="activityResults"></div></section>
      <section class="resultsBand"><div class="sectionHeader"><div><p class="specialistEyebrow">Comportamiento</p><h3>Línea temporal</h3></div><div class="chartLegend"><span data-series="head">Cabeza</span><span data-series="trunk">Tronco</span><span data-series="motor">Actividad motora</span><span data-series="event">Distractor</span></div></div><div class="timelineChart"></div></section>
      <section class="resultsBand"><div class="sectionHeader"><div><p class="specialistEyebrow">Comparación</p><h3>Análisis por bloque</h3></div></div><div class="blockTable"></div></section>`;
    detail.querySelector(".backToSessions")?.addEventListener("click", () => void this.loadList(root));
    this.renderActivityResults(detail.querySelector(".activityResults")!, session.activityResults ?? []);
    detail.querySelector(".timelineChart")?.appendChild(renderTimeline(timeline));
    this.renderBlocks(detail.querySelector(".blockTable")!, summary.byBlock);
    detail.querySelector('[data-export="json"]')?.addEventListener("click", () => downloadJson(session, timeline));
    detail.querySelector('[data-export="csv"]')?.addEventListener("click", () => downloadCsv(session, timeline));
    return detail;
  }

  private renderActivityResults(container: Element, results: SessionDetail["activityResults"]): void {
    if (!results.length) { container.appendChild(createNoticeCard("Sin resultados cognitivos", "La sesión aún no tiene actividades completadas.")); return; }
    results.forEach((item) => {
      const card = document.createElement("article");
      card.className = "activityResultCard";
      const entries = flattenNumericValues(item.result).slice(0, 8);
      card.innerHTML = `<div><span>${escapeHtml(scenarioLabel(item.scenarioId))}</span><h4>${escapeHtml(activityLabel(item.activityId))}</h4></div><dl>${entries.map(([key, value]) => `<div><dt>${escapeHtml(humanize(key))}</dt><dd>${formatNumber(value)}</dd></div>`).join("")}</dl>`;
      container.appendChild(card);
    });
  }

  private renderBlocks(container: Element, value: unknown): void {
    const blocks = Array.isArray(value) ? value as Array<Record<string, unknown>> : [];
    if (!blocks.length) { container.appendChild(createNoticeCard("Sin bloques disponibles", "El resumen por bloque aparecerá al finalizar la sesión.")); return; }
    container.innerHTML = `<div class="sessionTableWrap"><table class="sessionTable"><thead><tr><th>Escenario</th><th>Bloque</th><th>Condición</th><th>Muestras</th><th>Fuera de tarea</th><th>Actividad motora</th><th>Distractores</th></tr></thead><tbody>${blocks.map((block) => `<tr><td>${escapeHtml(scenarioLabel(String(block.scenarioId ?? "")))}</td><td>${formatNumber(block.blockNumber)}</td><td>${escapeHtml(String(block.condition ?? "—"))}</td><td>${formatNumber(block.sampleCount)}</td><td>${formatNumber(block.offTaskOrientationPercentage)}%</td><td>${formatNumber(block.globalMotorActivityMean)}</td><td>${formatNumber(block.distractorResponseCount)}</td></tr>`).join("")}</tbody></table></div>`;
  }
}

function renderTimeline(timeline: TimelineResponse): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "timelineCanvas";
  if (!timeline.samples.length) { wrapper.appendChild(createNoticeCard("Sin serie temporal", "No existen muestras conductuales para esta sesión.")); return wrapper; }
  const width = 1000, height = 300, left = 54, right = 18, top = 20, bottom = 42;
  const maxTime = Math.max(...timeline.samples.map((sample) => sample.elapsedMs), 1);
  const values = timeline.samples.flatMap((sample) => [sample.upperCamera?.head?.movementMagnitude, sample.upperCamera?.trunk?.movementMagnitude, sample.fullBodyCamera?.globalMotorActivity]).filter(isNumber);
  const maxValue = Math.max(...values, 0.01);
  const x = (time: number) => left + (time / maxTime) * (width - left - right);
  const y = (value: number) => height - bottom - (value / maxValue) * (height - top - bottom);
  const path = (getter: (sample: TimelineResponse["samples"][number]) => number | null | undefined) => timeline.samples.map((sample, index) => {
    const value = getter(sample); return isNumber(value) ? `${index === 0 ? "M" : "L"}${x(sample.elapsedMs).toFixed(1)},${y(value).toFixed(1)}` : "";
  }).join(" ");
  const distractors = timeline.events.filter((event) => event.type === "DISTRACTOR_STARTED");
  wrapper.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Evolución temporal de indicadores conductuales"><g class="chartGrid"><line x1="${left}" y1="${top}" x2="${left}" y2="${height-bottom}"/><line x1="${left}" y1="${height-bottom}" x2="${width-right}" y2="${height-bottom}"/></g>${distractors.map((event) => `<line class="eventMarker" x1="${x(event.elapsedMs)}" y1="${top}" x2="${x(event.elapsedMs)}" y2="${height-bottom}"><title>${eventLabel(event)}</title></line>`).join("")}<path class="seriesHead" d="${path((sample) => sample.upperCamera?.head?.movementMagnitude)}"/><path class="seriesTrunk" d="${path((sample) => sample.upperCamera?.trunk?.movementMagnitude)}"/><path class="seriesMotor" d="${path((sample) => sample.fullBodyCamera?.globalMotorActivity)}"/><text x="${left}" y="${height-12}">0:00</text><text x="${width-right}" y="${height-12}" text-anchor="end">${formatDuration(maxTime)}</text><text x="8" y="${top+5}">${maxValue.toFixed(2)}</text><text x="8" y="${height-bottom}">0</text></svg><div class="eventList"><strong>Distractores (${distractors.length})</strong>${distractors.slice(0, 12).map((event) => `<span>${formatDuration(event.elapsedMs)} · ${escapeHtml(String(event.details?.distractorType ?? event.scenarioId ?? "Distractor"))}</span>`).join("")}</div>`;
  return wrapper;
}

function metric(label: string, value: unknown, suffix: string): string { return `<article class="metricCard"><span>${label}</span><strong>${formatNumber(value)}</strong><small>${suffix}</small></article>`; }
function formatNumber(value: unknown): string { return typeof value === "number" && Number.isFinite(value) ? new Intl.NumberFormat("es-EC", { maximumFractionDigits: 2 }).format(value) : "—"; }
function formatDate(value: string): string { return new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function formatDuration(ms: number): string { const seconds = Math.round(ms / 1000); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }
function isNumber(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
function escapeHtml(value: string): string { const node = document.createElement("span"); node.textContent = value; return node.innerHTML; }
function humanize(value: string): string { return value.replace(/([A-Z])/g, " $1").replace(/[_-]/g, " ").replace(/^./, (letter) => letter.toUpperCase()); }
function scenarioLabel(value: string): string { return ({ classroom: "Aula escolar", "space-station": "Estación espacial", "interactive-museum": "Museo interactivo" } as Record<string, string>)[value] ?? value; }
function activityLabel(value: string): string { return ({ "go-no-go": "Go / No-Go", cpt: "CPT", "visual-discrimination": "Discriminación visual" } as Record<string, string>)[value] ?? value; }
function eventLabel(event: TimelineEvent): string { return `${formatDuration(event.elapsedMs)} · ${event.type}`; }
function flattenNumericValues(value: Record<string, unknown>, prefix = ""): Array<[string, number]> { return Object.entries(value).flatMap(([key, child]) => isNumber(child) ? [[prefix ? `${prefix}.${key}` : key, child] as [string, number]] : child && typeof child === "object" && !Array.isArray(child) ? flattenNumericValues(child as Record<string, unknown>, prefix ? `${prefix}.${key}` : key) : []); }
function downloadJson(session: SessionDetail, timeline: TimelineResponse): void { download(`evaluacion-${session.participantCode}-${session.sessionId}.json`, JSON.stringify({ session, timeline }, null, 2), "application/json"); }
function downloadCsv(session: SessionDetail, timeline: TimelineResponse): void { const rows = [["participantCode","sessionId","elapsedMs","scenarioId","blockNumber","headMovement","orientationDeviation","trunkMovement","globalMotorActivity"], ...timeline.samples.map((sample) => [session.participantCode, session.sessionId, sample.elapsedMs, sample.scenarioId ?? "", sample.blockNumber ?? "", sample.upperCamera?.head?.movementMagnitude ?? "", sample.upperCamera?.head?.orientationDeviation ?? "", sample.upperCamera?.trunk?.movementMagnitude ?? "", sample.fullBodyCamera?.globalMotorActivity ?? ""])]; download(`evaluacion-${session.participantCode}-${session.sessionId}.csv`, rows.map((row) => row.map(csvCell).join(",")).join("\n"), "text/csv;charset=utf-8"); }
function csvCell(value: unknown): string { return `"${String(value).replace(/"/g, '""')}"`; }
function download(filename: string, content: string, type: string): void { const url = URL.createObjectURL(new Blob([content], { type })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url); }
