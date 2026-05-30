// Características sugeridas pra casa — ajudam a entender o perfil e alimentam
// a geração de setlist (Fase 7). Agrupadas só pra UI; salvas como array plano
// de strings em venues.caracteristicas (JSON).

export const VENUE_TAG_GROUPS: { grupo: string; tags: string[] }[] = [
  {
    grupo: "Público",
    tags: ["Público jovem", "Público 30+", "Público misto", "Público comercial", "Público pesado"],
  },
  {
    grupo: "Estilo",
    tags: ["Rock alternativo 90/2000", "Rock clássico", "Pop rock", "Foco em covers"],
  },
  {
    grupo: "Ambiente",
    tags: ["Pub", "Bar com música ao vivo", "Ambiente intimista", "Ambiente de festa"],
  },
  {
    grupo: "Setlist que combina",
    tags: ["Setlist pesado", "Setlist popular", "Setlist alternativo", "Setlist leve"],
  },
  {
    grupo: "Aderência",
    tags: ["Bom perfil pra The Rock", "Possível desalinhamento", "Já demonstrou interesse"],
  },
];

export const ALL_VENUE_TAGS = VENUE_TAG_GROUPS.flatMap((g) => g.tags);

/** Lê com segurança o array de tags salvo em venues.caracteristicas (JSON). */
export function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
