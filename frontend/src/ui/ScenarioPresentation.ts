export type WorldTheme = "classroom" | "space" | "museum";
export type ScenarioId = "classroom" | "space-station" | "interactive-museum";

export const WORLD_PRESENTATION = {
  classroom: {
    name: "Aula de descubrimientos",
    invitation: "¡Vamos a descubrir!",
    description: "Explora el aula. Después, jugaremos con las señales.",
    activity: "Mira las señales y usa la barra de espacio.",
    icon: "book",
    accent: "#287969"
  },
  space: {
    name: "Misión espacial",
    invitation: "Tu misión empieza aquí",
    description: "Descubre la estación. Después, jugaremos a buscar letras.",
    activity: "Observa las letras y usa la barra de espacio.",
    icon: "planet",
    accent: "#4168ad"
  },
  museum: {
    name: "Museo de las maravillas",
    invitation: "¡Mira, imagina, descubre!",
    description: "Explora el museo. Después, encuentra la cara diferente.",
    activity: "Apunta a la cara diferente y haz clic.",
    icon: "spark",
    accent: "#8056a4"
  }
} as const;

const ICON_PATHS: Record<string, string> = {
  book: '<path d="M12 6C9 4 5 4 3 5v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-2-1-6-1-9 1Zm0 0v14"/><path d="M6 9h3m-3 4h3m6-4h3m-3 4h3"/>',
  planet: '<circle cx="12" cy="12" r="7"/><ellipse cx="12" cy="12" rx="12" ry="3.5" transform="rotate(-30 12 12)"/><path d="m18 3 1-2m2 5 2-1"/>',
  spark: '<path d="m12 3 2.8 6.2L21 12l-6.2 2.8L12 21l-2.8-6.2L3 12l6.2-2.8L12 3Z"/><path d="M20 2v4m-2-2h4"/>',
  play: '<path d="m9 5 11 7-11 7V5Z"/>',
  mouse: '<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 2v7m-6 1h12"/>',
  sound: '<path d="M10 5 5 9H2v6h3l5 4V5Zm4 3a6 6 0 0 1 0 8m4-11a10 10 0 0 1 0 14"/>',
  muted: '<path d="M10 5 5 9H2v6h3l5 4V5Zm6 4 6 6m0-6-6 6"/>',
  home: '<path d="m3 10 9-7 9 7v10h-6v-7H9v7H3V10Z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2c-1 1-2 1-2 3m0 3h.01"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  exit: '<path d="M10 4H4v16h6m4-14 6 6-6 6m-6-6h12"/>'
};

export function worldIcon(name: string): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICON_PATHS[name] ?? ICON_PATHS.spark}</svg>`;
}
