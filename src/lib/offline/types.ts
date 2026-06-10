import type {
  Member,
  Song,
  Venue,
  Show,
  Setlist,
  SetlistItem,
  Rehearsal,
  ShowMemberPresence,
  RehearsalMemberPresence,
  BandPosition,
  AppSettings,
} from "@/db/schema";

/** Snapshot de palco baixado de `/api/offline/snapshot`.
 *  Obs.: como vem por JSON, campos `Date` chegam como string em runtime — não
 *  os usamos nas features de palco, então mantemos os tipos do schema por
 *  conveniência (lyrics/bpm/tom/etc. são o que importa offline). */
export type Snapshot = {
  version: string; // impressão digital do conteúdo (estável; muda só quando algo muda)
  geradoEm: string;
  members: Member[];
  songs: Song[];
  venues: Venue[];
  shows: Show[];
  setlists: Setlist[];
  setlistItems: SetlistItem[];
  rehearsals: Rehearsal[];
  showMemberPresence: ShowMemberPresence[];
  rehearsalMemberPresence: RehearsalMemberPresence[];
  bandPositions: BandPosition[];
  appSettings: AppSettings[];
};

/** Uma mutação feita offline, guardada na fila pra replay ao reconectar.
 *  `kind` identifica qual server action chamar; `args` são os argumentos. */
export type QueuedMutation = {
  id: string; // uuid
  kind: string; // ex.: "setRehearsalPresence", "setSongTom"
  args: unknown[];
  createdAt: number; // epoch ms — ordena o replay (last-write-wins por alvo)
  label?: string; // descrição curta pra UI ("Presença · Foca")
};
