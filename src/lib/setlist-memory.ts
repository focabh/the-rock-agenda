// Memória implícita: aprende dos setlists já salvos quais músicas a banda
// costuma usar pra ABRIR (posição 0) e FECHAR (última posição). Função pura.

type ItemRow = { setlistId: string; songId: string; ordem: number };

export type SetlistMemory = {
  aberturas: string[]; // songIds mais usados como abertura (mais frequente 1º)
  fechamentos: string[]; // songIds mais usados como fechamento
};

export function computeSetlistMemory(
  items: ItemRow[],
  topN = 5
): SetlistMemory {
  // Agrupa por setlist pra achar a 1ª e a última música de cada um.
  const bySet = new Map<string, ItemRow[]>();
  for (const it of items) {
    if (!bySet.has(it.setlistId)) bySet.set(it.setlistId, []);
    bySet.get(it.setlistId)!.push(it);
  }

  const openCount = new Map<string, number>();
  const closeCount = new Map<string, number>();
  for (const list of bySet.values()) {
    if (list.length === 0) continue;
    const sorted = [...list].sort((a, b) => a.ordem - b.ordem);
    const first = sorted[0].songId;
    const last = sorted[sorted.length - 1].songId;
    openCount.set(first, (openCount.get(first) ?? 0) + 1);
    closeCount.set(last, (closeCount.get(last) ?? 0) + 1);
  }

  const top = (m: Map<string, number>) =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([id]) => id);

  return { aberturas: top(openCount), fechamentos: top(closeCount) };
}
