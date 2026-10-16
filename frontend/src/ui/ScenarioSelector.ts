import { scenarioArtwork } from "./ScenarioArtwork";
import { WORLD_PRESENTATION, worldIcon } from "./ScenarioPresentation";
import type { ScenarioId, WorldTheme } from "./ScenarioPresentation";
import "./world-ui.css";
import type { ActivityProgress } from '../flow/EvaluationFlow';

const WORLDS: { id: ScenarioId; theme: WorldTheme; activity: string; button: string }[] = [
  { id: "classroom", theme: "classroom", activity: "Responde y espera", button: "Entrar al aula" },
  { id: "space-station", theme: "space", activity: "Busca la letra", button: "Viajar a la estación" },
  { id: "interactive-museum", theme: "museum", activity: "Encuentra la diferencia", button: "Descubrir el museo" }
];

export function createScenarioSelector(onSelect: (id: ScenarioId) => void, onFinish: () => void, options?: {progress:Record<ScenarioId,ActivityProgress>; message?:string; onHelp?:()=>void; busy?:boolean}): HTMLElement {
  const selector = document.createElement("main");
  selector.id = "scenarioSelector";
  selector.setAttribute("aria-labelledby", "scenarioTitle");
  selector.innerHTML = `<section class="scenarioShell">
    <p class="scenarioEyebrow">NEUROEXPLORA · UN MUNDO POR DESCUBRIR</p>
    <h1 id="scenarioTitle">Elige tu próxima aventura</h1>
    <p class="scenarioIntro">Tres mundos para mirar, explorar y jugar. ¿Por dónde empezamos?</p>
    <div class="scenarioGrid"></div>
    <footer class="scenarioFooter"><p>En cada mundo practicarás antes de empezar.<br>Puedes volver aquí para elegir otra aventura.</p></footer>
  </section>`;
  const grid = selector.querySelector(".scenarioGrid")!;
  if(options){
    const count=WORLDS.filter(world=>options.progress[world.id].status==='completed').length;
    const progress=document.createElement('div');progress.className='sessionProgress';progress.innerHTML=`<meter min="0" max="3" value="${count}" aria-label="Aventuras completadas"></meter><strong>${count} de 3 aventuras completadas</strong>`;
    grid.before(progress);
    const message=document.createElement('p');message.className='flowMessage';message.setAttribute('role','status');message.textContent=options.message??'Elige una aventura. Primero vas a practicar.';progress.after(message);
  }
  WORLDS.forEach((option, index) => {
    const world = WORLD_PRESENTATION[option.theme];
    const card = document.createElement("article");
    card.className = "scenarioCard";
    card.dataset.theme = option.theme;
    card.innerHTML = `<div class="scenarioArtwork" aria-hidden="true"><span>MUNDO 0${index + 1}</span>${scenarioArtwork(option.theme)}</div>
      <p class="scenarioActivity">${worldIcon(world.icon)} ${option.activity}</p>
      <h2>${world.name}</h2><p class="scenarioPurpose">${world.description}</p>`;
    const button = document.createElement("button");
    const entry=options?.progress[option.id];
    if(entry){
      const labels={'pending':'Por descubrir','in-progress':entry.saving?'Guardando tu aventura…':'En curso','completed':'✓ Completada','interrupted':'Puedes empezar de nuevo','technical-error':'Podemos intentarlo de nuevo'};
      const badge=document.createElement('p');badge.className='activityProgress';badge.dataset.status=entry.status;badge.textContent=labels[entry.status];card.append(badge);
      button.disabled=entry.status==='completed'||entry.saving||!!options?.busy;
    }
    button.type = "button";
    button.innerHTML = `<span>${option.button}</span>${worldIcon("arrow")}`;
    button.addEventListener("click", () => onSelect(option.id));
    card.appendChild(button);
    grid.appendChild(card);
  });
  const finish = document.createElement("button");
  finish.type = "button";
  finish.className = "finishEvaluationButton";
  finish.textContent = "Guardar y finalizar";
  finish.disabled = !!options && (!WORLDS.every(world=>options.progress[world.id].status==='completed')||!!options.busy);
  finish.hidden = !!options && !WORLDS.every(world=>options.progress[world.id].status==='completed');
  finish.addEventListener("click", onFinish);
  selector.querySelector(".scenarioFooter")!.appendChild(finish);
  if(options?.onHelp){const help=document.createElement('button');help.type='button';help.className='finishEvaluationButton';help.textContent='Escuchar a Luma';help.disabled=!!options.busy;help.addEventListener('click',options.onHelp);selector.querySelector('.scenarioFooter')!.append(help);}
  return selector;
}
