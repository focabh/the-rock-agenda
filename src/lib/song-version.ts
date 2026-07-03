/**
 * Heurística pra detectar se uma música é uma VERSÃO especial (ao vivo, acústico,
 * remix, etc.) — útil porque a letra costuma mudar (principalmente ao vivo). Só
 * olha o título; não faz rede.
 */
const VERSION_RX =
  /\b(ao vivo|live|ac[uú]stic[oa]|acoustic|unplugged|remix|vers[aã]o|version|remaster(ed)?|demo|edit|radio edit|session|sess[aã]o|mtv|reprise)\b|\(.*(live|ao vivo|acoustic|ac[uú]stico|remix|version|vers[aã]o).*\)/i;

export function isLiveOrVersion(titulo: string): boolean {
  return VERSION_RX.test(titulo ?? "");
}

/** Rótulo curtinho do tipo de versão (pra dica na UI). */
export function versionHint(titulo: string): string | null {
  const t = (titulo ?? "").toLowerCase();
  if (/\b(ao vivo|live|mtv)\b/.test(t)) return "ao vivo";
  if (/\b(ac[uú]stic|acoustic|unplugged)\b/.test(t)) return "acústico";
  if (/\bremix\b/.test(t)) return "remix";
  if (/\b(remaster)/.test(t)) return "remaster";
  if (isLiveOrVersion(titulo)) return "versão";
  return null;
}
