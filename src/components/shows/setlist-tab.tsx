"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Plus,
  X,
  GripVertical,
  Printer,
  Music2,
  Download,
  FileText,
  Pencil,
  Trash2,
  ListPlus,
  Sparkles,
  Guitar,
  Drum,
  Piano,
  Star,
  Wand2,
  Send,
  TriangleAlert,
  Play,
  ExternalLink,
  CornerRightDown,
  Search,
} from "lucide-react";
import { SpotifyImportDialog } from "@/components/shared/spotify-import-dialog";
import { SpotifyExportButton } from "@/components/repertorio/spotify-export-button";
import { SetlistGenerateDialog } from "@/components/shows/setlist-generate-dialog";
import { SetlistShare } from "@/components/shows/setlist-share";
import { SetlistCritiqueDialog } from "@/components/shows/setlist-critique-dialog";
import { SetlistSuggestDialog } from "@/components/shows/setlist-suggest-dialog";
import { EnsaioGenerateDialog } from "@/components/ensaios/ensaio-generate-dialog";
import { LyricsDialog } from "@/components/repertorio/lyrics-dialog";
import { CuesDialog } from "@/components/repertorio/cues-dialog";
import { AddByNameDialog } from "@/components/repertorio/add-by-name-dialog";
import { MetronomeButton } from "@/components/shared/metronome-button";
import { SongStatusBadge } from "@/components/shared/status-badge";
import { parseCues } from "@/lib/lrc";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDuracao } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  addSongToSetlistAction,
  removeSetlistItemAction,
  createSetlistAction,
  updateSetlistAction,
  deleteSetlistAction,
  setSetlistOficialAction,
  cloneSetlistToShowAction,
} from "@/app/(app)/shows/[id]/actions-setlist";
import { cloneSetlistToEnsaioAction } from "@/app/(app)/ensaios/[id]/actions-setlist";
import { setSongTomAction, setSongPresetAction } from "@/app/(app)/repertorio/actions";
import { PresetBadge } from "@/components/shared/preset-badge";
import { SetlistReuseDialog } from "@/components/shows/setlist-reuse-dialog";
import {
  addSongToEnsaioSetlistAction,
  removeEnsaioSetlistItemAction,
  createEnsaioSetlistAction,
  renameEnsaioSetlistAction,
  deleteEnsaioSetlistAction,
  reorganizeEnsaioSetlistAction,
  importarSetlistDeShowAction,
} from "@/app/(app)/ensaios/[id]/actions-setlist";
import { runOrQueue } from "@/lib/offline/mutations";
import { KIND } from "@/lib/offline/actions-registry";
import type { Song, SetlistItem, Setlist } from "@/db/schema";
import { materialForPosicao, type PlayMaterial } from "@/lib/instrument-material";

type Item = SetlistItem & { song: Song };
type SetlistWithItems = Setlist & { items: Item[] };

const MATERIAL_ICON = { string: Guitar, drum: Drum, keys: Piano } as const;

function fmtMMSS(sec: number): string {
  if (!sec || sec <= 0) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function SetlistTab({
  showId,
  rehearsalId,
  setlists,
  allSongs,
  canEdit = true,
  defaultDuracaoMin = 60,
  userPosicao = null,
  ensaioInfo = null,
  groupLink = null,
  importarDoShow = null,
  simular = null,
  spotifyDefaultUrl = null,
  superuser = false,
}: {
  showId?: string;
  rehearsalId?: string;
  setlists: SetlistWithItems[];
  allSongs: Song[];
  canEdit?: boolean;
  superuser?: boolean;
  defaultDuracaoMin?: number;
  userPosicao?: string | null;
  ensaioInfo?: { dataLabel: string; foco: string | null } | null;
  groupLink?: string | null;
  importarDoShow?: { showId: string; label: string } | null;
  simular?: { shows: { id: string; label: string }[]; defaultShowId: string } | null;
  spotifyDefaultUrl?: string | null;
}) {
  const isEnsaio = !!rehearsalId;
  const play = materialForPosicao(userPosicao).play;
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(setlists[0]?.id ?? null);
  const [, startTransition] = useTransition();
  const [mgrPending, startMgr] = useTransition();

  const [newOpen, setNewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [dropOverride, setDropOverride] = useState<Record<string, boolean>>({});
  const [emendaOverride, setEmendaOverride] = useState<Record<string, boolean>>({});
  const [addNameOpen, setAddNameOpen] = useState(false);

  // ---- ações (mesmo componente p/ show e ensaio) ----
  const aAddSong = (slId: string, songId: string) =>
    isEnsaio ? addSongToEnsaioSetlistAction(rehearsalId!, slId, songId) : addSongToSetlistAction(showId!, slId, songId);
  const aRemove = (itemId: string) =>
    isEnsaio ? removeEnsaioSetlistItemAction(rehearsalId!, itemId) : removeSetlistItemAction(showId!, itemId);
  // Mutações que funcionam OFFLINE (enfileiram + replicam ao reconectar). O
  // estado otimista local (localItems, dropOverride, emendaOverride, valor do
  // Input de tom) já reflete a mudança na hora — o runOrQueue só garante que
  // offline não estoura e que sincroniza depois.
  const aReorder = (ids: string[]) =>
    isEnsaio
      ? runOrQueue(KIND.reorderEnsaioSetlistItems, [rehearsalId!, ids])
      : runOrQueue(KIND.reorderSetlistItems, [showId!, ids]);
  // Tom é UM valor por música (songs.tom) — editar aqui reflete no repertório e
  // em todos os setlists (e vice-versa). Colaborativo (qualquer músico).
  const aTom = (songId: string, tom: string | null) =>
    setSongTomAction(songId, tom);
  const aPreset = (songId: string, preset: number | null) =>
    setSongPresetAction(songId, preset);
  const aPrioridade = (itemId: string, prioridade: boolean) =>
    runOrQueue(KIND.updateEnsaioSetlistItem, [rehearsalId!, itemId, { prioridade }]);
  // DROP é propriedade da MÚSICA (songs.dropada): marcar/desmarcar aqui reflete
  // no repertório e em todos os setlists. Atualiza na hora (otimista) + persiste.
  const aDrop = (songId: string, dropada: boolean) => {
    setDropOverride((m) => ({ ...m, [songId]: dropada }));
    startTransition(() => {
      void runOrQueue(KIND.setSongDrop, [songId, dropada]);
    });
  };
  // "Emenda": esta música emenda na próxima (propriedade do item do setlist).
  const aEmenda = (itemId: string, emenda: boolean) => {
    setEmendaOverride((m) => ({ ...m, [itemId]: emenda }));
    startTransition(() => {
      void runOrQueue(
        isEnsaio ? KIND.updateEnsaioSetlistItem : KIND.updateSetlistItem,
        [isEnsaio ? rehearsalId! : showId!, itemId, { emenda }]
      );
    });
  };

  useEffect(() => {
    if (setlists.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (!selectedId || !setlists.some((s) => s.id === selectedId)) setSelectedId(setlists[0].id);
  }, [setlists, selectedId]);

  const selected = setlists.find((s) => s.id === selectedId) ?? null;
  const sortedItems = useMemo(
    () => (selected ? [...selected.items].sort((a, b) => a.ordem - b.ordem) : []),
    [selected]
  );
  const [localItems, setLocalItems] = useState<Item[]>(sortedItems);
  useEffect(() => setLocalItems(sortedItems), [sortedItems]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const usedIds = new Set(localItems.map((i) => i.songId));
  const available = allSongs
    .filter((s) => !usedIds.has(s.id))
    .filter((s) => {
      const t = q.trim().toLowerCase();
      if (!t) return true;
      return s.titulo.toLowerCase().includes(t) || s.artista.toLowerCase().includes(t);
    });

  // Tempo total = soma da duração das MÚSICAS (não existe duração por item; o
  // campo do item é snapshot que envelhece). ~3min30 estimado quando a música
  // não tem duração. Antes somava só o snapshot do item → contava errado.
  const totalSeg = localItems.reduce(
    (s, i) => s + (i.song.duracaoSeg ?? 210),
    0
  );
  const prioridades = localItems.filter((i) => i.prioridade);

  // Resolvedores (consideram as edições otimistas) + alerta de emenda.
  const tomOf = (it: Item) => (it.song.tom ?? "").trim();
  const dropOf = (it: Item) => dropOverride[it.song.id] ?? it.song.dropada;
  const emendaOf = (it: Item) => emendaOverride[it.id] ?? it.emenda;
  /** Se a música emenda na próxima e há mudança de tom/afinação no meio. */
  const warnFor = (idx: number): string | null => {
    const it = localItems[idx];
    const nx = localItems[idx + 1];
    if (!nx || !emendaOf(it)) return null;
    const probs: string[] = [];
    if (dropOf(it) !== dropOf(nx)) probs.push(dropOf(it) ? "sai do DROP pra afinação normal" : "entra em DROP");
    const a = tomOf(it);
    const b = tomOf(nx);
    if (a && b && a.toLowerCase() !== b.toLowerCase()) probs.push(`muda de tom (${a} → ${b})`);
    if (probs.length === 0) return null;
    return `Emenda: ${probs.join(" e ")} — vai precisar ajustar no meio.`;
  };

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = localItems.findIndex((i) => i.id === active.id);
    const newIdx = localItems.findIndex((i) => i.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(localItems, oldIdx, newIdx);
    setLocalItems(next);
    startTransition(() => {
      void aReorder(next.map((i) => i.id));
    });
  }

  function handleCreate(nome: string) {
    startMgr(async () => {
      const r = isEnsaio
        ? await createEnsaioSetlistAction(rehearsalId!, nome)
        : await createSetlistAction(showId!, nome);
      setSelectedId(r.id);
      setNewOpen(false);
      toast.success(`Setlist "${r.nome}" criado.`);
    });
  }
  function handleClone(sourceId: string, nome: string) {
    startMgr(async () => {
      const r = isEnsaio
        ? await cloneSetlistToEnsaioAction(rehearsalId!, sourceId, nome || undefined)
        : await cloneSetlistToShowAction(showId!, sourceId, nome || undefined);
      if ("error" in r && r.error) {
        toast.error(r.error);
        return;
      }
      if ("id" in r && r.id) {
        setSelectedId(r.id);
        setNewOpen(false);
        toast.success(`Setlist "${r.nome}" criado a partir de um salvo.`);
      }
    });
  }
  function handleEdit(nome: string) {
    if (!selected) return;
    startMgr(async () => {
      if (isEnsaio) await renameEnsaioSetlistAction(rehearsalId!, selected.id, nome);
      else await updateSetlistAction(showId!, selected.id, { nome, duracaoAlvoMin: null });
      setEditOpen(false);
      toast.success("Setlist renomeado.");
    });
  }
  function handleDelete() {
    if (!selected) return;
    startMgr(async () => {
      if (isEnsaio) await deleteEnsaioSetlistAction(rehearsalId!, selected.id);
      else await deleteSetlistAction(showId!, selected.id);
      setDelOpen(false);
      toast.success("Setlist excluído.");
    });
  }
  function handleImportarDoShow() {
    if (!importarDoShow) return;
    startMgr(async () => {
      const r = await importarSetlistDeShowAction(rehearsalId!, importarDoShow.showId);
      if (r.musicas > 0) toast.success(`Importado: ${r.setlists} setlist(s), ${r.musicas} música(s) do show.`);
      else toast.info("O show vinculado ainda não tem setlist com músicas.");
    });
  }
  function handleReorganizar() {
    if (!selected) return;
    startTransition(async () => {
      await reorganizeEnsaioSetlistAction(rehearsalId!, selected.id);
      toast.success("Ordenado por curva de energia.");
    });
  }
  async function enviarLembrete() {
    if (prioridades.length === 0) {
      toast.error("Marque as músicas prioritárias (estrela) primeiro.");
      return;
    }
    const linhas = prioridades.map((i) => `• ${i.song.titulo}`).join("\n");
    const msg =
      `Olá pessoal!\n\nLembrete do próximo ensaio${ensaioInfo?.dataLabel ? ` (${ensaioInfo.dataLabel})` : ""}.` +
      `${ensaioInfo?.foco ? `\nFoco: ${ensaioInfo.foco}.` : ""}` +
      `\n\nAs músicas abaixo precisam estar prontas:\n\n${linhas}\n\nPor favor revisem esse material antes do ensaio. Obrigado!`;
    try {
      await navigator.clipboard.writeText(msg);
    } catch {
      /* ignora */
    }
    if (groupLink) window.open(groupLink, "_blank", "noopener");
    toast.success(groupLink ? "Lembrete copiado! Abrindo o grupo — é só colar (Ctrl+V)." : "Lembrete copiado! Cole no grupo do WhatsApp.");
  }

  if (setlists.length === 0) {
    return (
      <>
        <EmptyState
          icon={ListPlus}
          title="Nenhum setlist ainda"
          description={
            canEdit
              ? isEnsaio
                ? "Monte o que a banda vai ensaiar (pode ter vários: foco vocais, músicas novas…)."
                : "Crie o primeiro setlist deste show (você pode ter vários: 1º set, bis…)."
              : "Nenhum setlist montado ainda."
          }
          action={
            canEdit && (
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => setNewOpen(true)}>
                  <Plus className="size-4" /> Novo setlist
                </Button>
                {importarDoShow && (
                  <Button variant="outline" onClick={handleImportarDoShow} disabled={mgrPending}>
                    <Download className="size-4" /> Importar do show
                  </Button>
                )}
              </div>
            )
          }
        />
        <SetlistReuseDialog open={newOpen} onOpenChange={setNewOpen} pending={mgrPending} onCreateEmpty={handleCreate} onClone={handleClone} />
      </>
    );
  }

  return (
    <div className="w-full space-y-4 overflow-x-hidden">
      {/* Seletor de setlists */}
      <div className="flex flex-wrap items-center gap-2">
        {setlists.map((sl) => (
          <button
            key={sl.id}
            onClick={() => setSelectedId(sl.id)}
            className={cn(
              "inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset transition-colors",
              sl.id === selectedId ? "bg-primary/20 text-primary ring-primary/40" : "ring-border text-muted-foreground hover:bg-accent/50"
            )}
          >
            <span className="truncate">{sl.nome}</span>
            <span className="opacity-60">({sl.items.length})</span>
          </button>
        ))}
        {canEdit && (
          <Button variant="ghost" size="sm" onClick={() => setNewOpen(true)} title="Novo setlist">
            <Plus className="size-4" /> Novo
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Coluna 1 — setlist selecionado */}
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="inline-flex min-w-0 items-center gap-2 font-semibold">
              <span className="truncate">{selected?.nome ?? "Setlist"}</span>
              <span className="shrink-0 text-sm font-normal text-muted-foreground">
                ({localItems.length}
                {totalSeg > 0 && ` · ~ ${formatDuracao(totalSeg)}`})
              </span>
              {canEdit && selected && (
                <>
                  <button onClick={() => setEditOpen(true)} className="shrink-0 text-muted-foreground hover:text-foreground" title="Renomear setlist">
                    <Pencil className="size-3.5" />
                  </button>
                  <button onClick={() => setDelOpen(true)} className="shrink-0 text-muted-foreground hover:text-destructive" title="Excluir setlist">
                    <Trash2 className="size-3.5" />
                  </button>
                </>
              )}
            </h3>
            <div className="flex flex-wrap gap-2">
              {/* Ensaio: gerar + importar do show + reorganizar (grátis) + lembrete */}
              {isEnsaio && canEdit && selected && (
                <EnsaioGenerateDialog rehearsalId={rehearsalId!} setlistId={selected.id} hasItems={localItems.length > 0} simular={simular ?? undefined} />
              )}
              {isEnsaio && canEdit && importarDoShow && (
                <Button variant="outline" size="sm" onClick={handleImportarDoShow} disabled={mgrPending} title={`Copiar o setlist do show: ${importarDoShow.label}`}>
                  <Download className="size-4" /> Importar do show
                </Button>
              )}
              {isEnsaio && canEdit && selected && localItems.length > 1 && (
                <Button variant="outline" size="sm" onClick={handleReorganizar} title="Ordenar por curva de energia">
                  <Wand2 className="size-4" /> Reorganizar
                </Button>
              )}
              {isEnsaio && canEdit && selected && (
                <Button variant="outline" size="sm" onClick={enviarLembrete} title="Mandar lembrete das músicas prioritárias no WhatsApp">
                  <Send className="size-4" /> Lembrete
                </Button>
              )}
              {isEnsaio && selected && localItems.length > 0 && (
                <SetlistCritiqueDialog rehearsalId={rehearsalId} setlistId={selected.id} canEdit={canEdit} />
              )}
              {isEnsaio && selected && localItems.length > 0 && (
                <SetlistSuggestDialog rehearsalId={rehearsalId} setlistId={selected.id} canEdit={canEdit} />
              )}
              {isEnsaio && canEdit && selected && (
                <SpotifyImportDialog
                  mode="setlist"
                  setlistId={selected.id}
                  defaultUrl={spotifyDefaultUrl}
                  trigger={
                    <Button variant="outline" size="sm">
                      <Download className="size-4" /> Spotify
                    </Button>
                  }
                />
              )}
              {isEnsaio && selected && (
                <>
                  <Button variant="outline" size="sm" render={<Link href={`/ensaios/${rehearsalId}/letras?sl=${selected.id}`} target="_blank" />} title="Letras na ordem — exportar PDF/Word">
                    <FileText className="size-4" /> Letras
                  </Button>
                  <Button variant="outline" size="sm" render={<Link href={`/ensaios/${rehearsalId}/imprimir-setlist?sl=${selected.id}`} target="_blank" />}>
                    <Printer className="size-4" /> Imprimir
                  </Button>
                </>
              )}
              {/* Oficial do show (o Modo Show/flyer usam este) */}
              {!isEnsaio && selected && (
                selected.oficial ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-300 ring-1 ring-inset ring-amber-500/30">
                    <Star className="size-3.5 fill-amber-300" /> Oficial
                  </span>
                ) : (
                  canEdit && (
                    <Button variant="outline" size="sm" onClick={() => startMgr(async () => { await setSetlistOficialAction(showId!, selected.id); toast.success("Marcado como setlist oficial."); })} disabled={mgrPending} title="Usar este setlist no Modo Show e no flyer">
                      <Star className="size-4" /> Tornar oficial
                    </Button>
                  )
                )
              )}
              {/* Show: geração/crítica/spotify/letras/imprimir */}
              {!isEnsaio && canEdit && selected && (
                <SetlistGenerateDialog showId={showId!} setlistId={selected.id} hasItems={localItems.length > 0} defaultMin={selected.duracaoAlvoMin ?? defaultDuracaoMin} />
              )}
              {!isEnsaio && selected && localItems.length > 0 && (
                <SetlistCritiqueDialog showId={showId!} setlistId={selected.id} canEdit={canEdit} />
              )}
              {!isEnsaio && selected && localItems.length > 0 && (
                <SetlistSuggestDialog showId={showId!} setlistId={selected.id} canEdit={canEdit} />
              )}
              {!isEnsaio && canEdit && selected && (
                <SpotifyImportDialog
                  mode="setlist"
                  showId={showId!}
                  setlistId={selected.id}
                  defaultUrl={spotifyDefaultUrl}
                  trigger={
                    <Button variant="outline" size="sm">
                      <Download className="size-4" /> Spotify
                    </Button>
                  }
                />
              )}
              {!isEnsaio && selected && (
                <>
                  <Button variant="outline" size="sm" render={<Link href={`/shows/${showId}/letras?sl=${selected.id}`} target="_blank" />} title="Letras na ordem — exportar PDF/Word">
                    <FileText className="size-4" /> Letras
                  </Button>
                  <Button variant="outline" size="sm" render={<Link href={`/shows/${showId}/imprimir-setlist?sl=${selected.id}`} target="_blank" />}>
                    <Printer className="size-4" /> Imprimir
                  </Button>
                </>
              )}
              {selected && localItems.length > 0 && (
                <SetlistShare
                  titulo={selected.nome || "Setlist"}
                  subtitulo={isEnsaio ? (ensaioInfo?.dataLabel ?? "Ensaio") : `${localItems.length} músicas · ${formatDuracao(totalSeg)}`}
                  linhas={localItems.map((it, idx) => ({
                    n: idx + 1,
                    titulo: it.song.titulo,
                    artista: it.song.artista,
                    tom: it.song.tom ?? "",
                    preset: it.song.vozPreset,
                    dropada: dropOf(it),
                    emenda: emendaOf(it),
                    dur: fmtMMSS(it.song.duracaoSeg ?? 0),
                  }))}
                />
              )}
              {superuser && selected && localItems.some((i) => i.song.spotifyTrackId) && (
                <SpotifyExportButton mode="setlist" setlistId={selected.id} label="Copiar Spotify" />
              )}
            </div>
          </div>

          {!isEnsaio && selected?.observacoesGerais && (
            <Card className="border-primary/30 bg-primary/5 p-3">
              <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-primary">
                <Sparkles className="size-3.5" /> Estratégia (IA)
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{selected.observacoesGerais}</p>
            </Card>
          )}

          {isEnsaio && prioridades.length > 0 && (
            <p className="text-xs text-amber-400">
              <Star className="mr-1 inline size-3.5 fill-amber-400" />
              {prioridades.length} música(s) prioritária(s) — use “Lembrete” pra avisar a banda.
            </p>
          )}

          {localItems.length === 0 ? (
            <EmptyState
              icon={Music2}
              title="Setlist vazio"
              description={canEdit ? "Adicione músicas do repertório ao lado, e arraste pra reordenar." : "Nenhuma música neste setlist ainda."}
            />
          ) : (
            <Card className="overflow-hidden p-0">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={localItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                  <ul className="divide-y divide-border">
                    {localItems.map((item, idx) => (
                      <SortableSetlistItem
                        key={item.id}
                        item={item}
                        index={idx}
                        canEdit={canEdit}
                        superuser={superuser}
                        play={play}
                        isEnsaio={isEnsaio}
                        onTom={(tom) => aTom(item.song.id, tom)}
                        onPreset={(n) => aPreset(item.song.id, n)}
                        onRemove={() => aRemove(item.id)}
                        onPrioridade={(v) => aPrioridade(item.id, v)}
                        dropada={dropOverride[item.song.id] ?? item.song.dropada}
                        onDrop={(v) => aDrop(item.song.id, v)}
                        emenda={emendaOf(item)}
                        onEmenda={(v) => aEmenda(item.id, v)}
                        hasNext={idx < localItems.length - 1}
                        warn={warnFor(idx)}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            </Card>
          )}
        </div>

        {/* Coluna 2 — adicionar do repertório */}
        {canEdit && selected && (
          <div className="min-w-0 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold">Adicionar do repertório</h3>
              <Button variant="outline" size="sm" onClick={() => setAddNameOpen(true)}>
                <Search className="size-4" /> Por nome
              </Button>
            </div>
            <Input placeholder="Buscar música ou artista..." value={q} onChange={(e) => setQ(e.target.value)} />
            <Card className="max-h-[70vh] overflow-y-auto p-0">
              {available.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  {q ? "Nada encontrado." : "Todas as músicas já estão neste setlist."}
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {available.map((s) => (
                    <li key={s.id} className="flex items-center gap-2 px-3 py-2 hover:bg-accent/30">
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 wrap-break-word text-sm font-medium leading-snug">{s.titulo}</p>
                        <p className="truncate text-xs text-muted-foreground">{s.artista}</p>
                      </div>
                      <Button variant="ghost" size="icon" title="Adicionar" className="shrink-0" onClick={() => startTransition(() => aAddSong(selected.id, s.id))}>
                        <Plus className="size-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}
      </div>

      {selected && (
        <AddByNameDialog
          open={addNameOpen}
          onOpenChange={setAddNameOpen}
          title="Adicionar por nome ao setlist"
          onAdded={(songId) => startTransition(() => aAddSong(selected.id, songId))}
        />
      )}
      <SetlistReuseDialog open={newOpen} onOpenChange={setNewOpen} pending={mgrPending} onCreateEmpty={handleCreate} onClone={handleClone} />
      <NameDialog open={editOpen} onOpenChange={setEditOpen} title="Renomear setlist" placeholder="Ex.: 1º set, Bis, Acústico…" initial={selected?.nome ?? ""} pending={mgrPending} onSubmit={handleEdit} />
      <AlertDialog open={delOpen} onOpenChange={setDelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir o setlist “{selected?.nome}”?</AlertDialogTitle>
            <AlertDialogDescription>As músicas continuam no repertório — só este setlist é removido.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel render={<Button variant="outline" />}>Cancelar</AlertDialogCancel>
            <AlertDialogAction render={<Button variant="destructive" disabled={mgrPending} />} onClick={handleDelete}>
              {mgrPending ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function NameDialog({
  open,
  onOpenChange,
  title,
  placeholder,
  initial = "",
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  placeholder?: string;
  initial?: string;
  pending: boolean;
  onSubmit: (nome: string) => void;
}) {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    if (open) setValue(initial);
  }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Dê um nome pra identificar.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && value.trim()) onSubmit(value.trim());
            }}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={() => value.trim() && onSubmit(value.trim())} disabled={pending || !value.trim()}>
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SortableSetlistItem({
  item,
  index,
  canEdit,
  superuser,
  play,
  isEnsaio,
  onTom,
  onPreset,
  onRemove,
  onPrioridade,
  dropada,
  onDrop,
  emenda,
  onEmenda,
  hasNext,
  warn,
}: {
  item: Item;
  index: number;
  canEdit: boolean;
  superuser: boolean;
  play: PlayMaterial | null;
  isEnsaio: boolean;
  onTom: (tom: string | null) => void;
  onPreset: (n: number | null) => void;
  onRemove: () => void;
  onPrioridade: (v: boolean) => void;
  dropada: boolean;
  onDrop: (v: boolean) => void;
  emenda: boolean;
  onEmenda: (v: boolean) => void;
  hasNext: boolean;
  warn: string | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: !canEdit });
  const [, startTransition] = useTransition();
  const [playing, setPlaying] = useState(false);
  const style = { transform: CSS.Transform.toString(transform), transition };
  const dur = item.song.duracaoSeg ?? 0;
  const trackId = item.song.spotifyTrackId;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-card",
        item.prioridade && "border-l-2 border-amber-400",
        isDragging && "z-10 shadow-lg ring-1 ring-primary/40"
      )}
    >
      {/* Linha em 2 NÍVEIS, tudo visível em qualquer largura: nome completo em
          cima; controles na linha de baixo (com wrap). Sem accordion. */}
      <div className="flex flex-col gap-1.5 px-3 py-2">
        {/* NÍVEL 1 — nº, prioridade, nome, letra */}
        <div className="flex items-center gap-1.5">
          {canEdit && (
            <button
              {...attributes}
              {...listeners}
              className="shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
              title="Arrastar para reordenar"
              aria-label="Arrastar"
            >
              <GripVertical className="size-4" />
            </button>
          )}
          <span className="w-5 shrink-0 text-right font-mono text-sm text-muted-foreground">{index + 1}</span>

          {isEnsaio && (
            <button
              onClick={() => canEdit && startTransition(() => onPrioridade(!item.prioridade))}
              disabled={!canEdit}
              className={cn("shrink-0 transition-colors", item.prioridade ? "text-amber-400" : "text-muted-foreground hover:text-amber-400")}
              title={item.prioridade ? "Prioritária — tocar pra desmarcar" : "Marcar como prioritária pro ensaio"}
            >
              <Star className={cn("size-4", item.prioridade && "fill-amber-400")} />
            </button>
          )}

          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 wrap-break-word text-sm font-medium leading-snug">{item.song.titulo}</p>
            <p className="truncate text-xs text-muted-foreground">{item.song.artista}</p>
          </div>

          {/* Letra (sempre acessível) */}
          <LyricsDialog
            songId={item.song.id}
            titulo={item.song.titulo}
            artista={item.song.artista}
            spotifyTrackId={item.song.spotifyTrackId}
            admin={false}
          />
        </div>

        {/* NÍVEL 2 — controles, sempre visíveis, quebram em várias linhas se preciso */}
        <div className="flex flex-wrap items-center gap-1.5 pl-7">
          <span className="shrink-0">
            <SongStatusBadge status={item.song.status} />
          </span>

          <PresetBadge preset={item.song.vozPreset} className="text-[11px]" />

          {item.song.vozCueInicial && (
            <span className="inline-flex shrink-0 items-center rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 ring-1 ring-inset ring-amber-500/30 dark:text-amber-300">
              🎤 {item.song.vozCueInicial}
            </span>
          )}

          {(canEdit || dropada) && (
            <button
              type="button"
              onClick={() => canEdit && startTransition(() => onDrop(!dropada))}
              disabled={!canEdit}
              title={dropada ? "Afinação dropada — toque pra desmarcar (vale em todo lugar)" : "Marcar afinação dropada (Drop D/C…)"}
              className={cn(
                "inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-inset transition-colors",
                dropada
                  ? "bg-amber-500/15 text-amber-300 ring-amber-500/30"
                  : "text-muted-foreground ring-border hover:text-amber-300"
              )}
            >
              DROP
            </button>
          )}

          {warn && (
            <span className="inline-flex shrink-0 items-center text-amber-400" title={warn} aria-label={warn}>
              <TriangleAlert className="size-4" />
            </span>
          )}

          {/* Emenda na próxima música — alternar */}
          {hasNext && (canEdit || emenda) && (
            <button
              type="button"
              onClick={() => canEdit && startTransition(() => onEmenda(!emenda))}
              disabled={!canEdit}
              title={emenda ? "Emenda na próxima — toque pra desmarcar" : "Emendar na próxima música (sem pausa)"}
              className={cn(
                "inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold transition-colors",
                emenda ? "bg-primary/15 text-primary" : "text-muted-foreground ring-1 ring-inset ring-border hover:text-primary"
              )}
            >
              <CornerRightDown className="size-3.5" /> emenda
            </button>
          )}

          {dur > 0 && (
            <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{fmtMMSS(dur)}</span>
          )}

          {play && (
            (() => {
              const Icon = MATERIAL_ICON[play.kind];
              return (
                <a
                  href={play.href(item.song.artista, item.song.titulo)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-orange-400 transition-colors hover:bg-orange-500/15"
                  title={play.label}
                >
                  <Icon className="size-3.5" />
                </a>
              );
            })()
          )}

          {/* Tocar no Spotify (player embed inline, igual ao repertório) */}
          {trackId && (
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className={cn(
                "inline-flex size-7 shrink-0 items-center justify-center rounded-full transition-colors",
                playing ? "bg-primary text-primary-foreground" : "text-primary hover:bg-primary/15"
              )}
              title={playing ? "Fechar player" : "Tocar no Spotify"}
            >
              {playing ? <X className="size-3.5" /> : <Play className="size-3.5 fill-current" />}
            </button>
          )}
          {trackId && (
            <a
              href={`https://open.spotify.com/track/${trackId}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-emerald-400 transition-colors hover:bg-emerald-500/15"
              title="Abrir no Spotify (toca inteira no app)"
            >
              <ExternalLink className="size-3.5" />
            </a>
          )}

          {/* Marcações (entrada do vocal / solo) — só o superusuário edita */}
          {superuser && (
            <CuesDialog songId={item.song.id} titulo={item.song.titulo} initial={parseCues(item.song.cues)} />
          )}
          <MetronomeButton bpm={item.song.bpm} titulo={item.song.titulo} songId={item.song.id} />

          <Input
            defaultValue={item.song.vozPreset ?? ""}
            placeholder="P"
            type="number"
            inputMode="numeric"
            step={1}
            min={0}
            max={9999}
            title="Preset do pedal de voz. Qualquer músico edita — reflete no repertório e em todos os setlists."
            className="h-8 w-14 shrink-0 rounded-md border-2 border-violet-400/40 bg-violet-500/10 px-1 text-center text-base font-black text-violet-300 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            onBlur={(e) => {
              const raw = e.target.value.trim();
              const n = raw === "" ? null : Math.max(0, Math.round(Number(raw)));
              startTransition(() => onPreset(n && n > 0 ? n : null));
            }}
          />
          <Input
            defaultValue={item.song.tom ?? ""}
            placeholder="tom"
            type="number"
            inputMode="numeric"
            step={1}
            min={-12}
            max={12}
            title="Tom (transposição: 0, -1, -2…). Qualquer músico edita — reflete no repertório e em todos os setlists."
            className="h-8 w-14 shrink-0 rounded-md border-2 border-amber-400/40 bg-amber-500/10 px-1 text-center text-base font-black text-amber-300 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            onBlur={(e) => startTransition(() => onTom(e.target.value.trim() || null))}
          />
          {canEdit && (
            <Button variant="ghost" size="icon" title="Remover" className="size-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => startTransition(() => onRemove())}>
              <X className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      {playing && trackId && (
        <div className="border-t border-border bg-muted/20 px-3 pb-3">
          <iframe
            src={`https://open.spotify.com/embed/track/${trackId}?utm_source=generator`}
            width="100%"
            height={152}
            loading="lazy"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            style={{ border: 0 }}
            className="mt-3 rounded-xl"
            title={`Spotify: ${item.song.titulo}`}
          />
        </div>
      )}
    </li>
  );
}
