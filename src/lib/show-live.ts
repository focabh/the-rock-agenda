// Tipo do estado ao vivo compartilhado do show (§10–17). Fica AQUI (e não no
// arquivo "use server") porque módulos server actions só podem exportar funções
// async — exportar tipo dali quebra o build (Turbopack).

export type ShowLiveState = {
  showId: string;
  currentSongId: string | null;
  controlMode: "host" | "host_members" | "all";
  version: number;
  updatedAt: number; // ms
  updatedByName: string | null;
  maestroName: string | null;
  maestroMemberId: string | null;
};
