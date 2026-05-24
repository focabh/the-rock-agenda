/**
 * Parse "Música - Artista" por linha em uma lista de tracks.
 * Suporta separadores: - — – · • | tab
 */
export function parseTracksFromText(
  text: string
): Array<{ titulo: string; artista: string }> {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const result: Array<{ titulo: string; artista: string }> = [];
  for (const raw of lines) {
    // Remove número inicial (ex: "1. ", "01 -")
    const line = raw.replace(/^\s*\d+[.)\s-]+/, "").trim();
    // Separadores: " - ", " — ", " – ", " | ", " · ", " • ", tab
    const m = line.match(/^(.+?)\s*(?:\u2014|\u2013|\u00b7|\u2022|\||\t|-)\s*(.+)$/);
    if (m) {
      const titulo = m[1].trim();
      const artista = m[2].trim();
      if (titulo && artista) {
        result.push({ titulo, artista });
        continue;
      }
    }
    if (line) result.push({ titulo: line, artista: "Desconhecido" });
  }
  return result;
}
