import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ArrowLeft, MapPin, Clock, Music2, Mic, Guitar } from "lucide-react";
import { db } from "@/db";
import { shows } from "@/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { OfflineDownloadButton } from "@/components/shared/offline-download-button";
import { Teleprompter } from "@/components/shared/teleprompter";
import { LyricsText } from "@/components/shared/lyrics-text";
import { PresetBadge } from "@/components/shared/preset-badge";
import { tomBadgeClass } from "@/lib/tom";
import { EmptyState } from "@/components/shared/empty-state";
import { computeStageCues, CUE_EMOJI, CUE_LABEL } from "@/lib/stage-cues";
import { formatDataExtensa, formatDataBR } from "@/lib/formatters";
import { requireCurrentUser, getBrand } from "@/lib/auth";

export const metadata = { title: "Modo Show — The Rock" };

export default async function ModoShowPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  await requireCurrentUser();
  const { id } = await searchParams;

  // Lista enxuta (só pro seletor e pra achar o show) — não carrega músicas.
  const showList = await db.query.shows.findMany({
    columns: { id: true, data: true },
    with: { casa: { columns: { nome: true } } },
    orderBy: [asc(shows.data)],
  });

  if (showList.length === 0) {
    return (
      <div>
        <PageHeader title="Modo Show" description="Tudo do show numa tela só — funciona offline." />
        <div className="p-6">
          <EmptyState icon={Music2} title="Nenhum show cadastrado" description="Cadastre um show pra usar o Modo Show." />
        </div>
      </div>
    );
  }

  // Escolha do show: ?id explícito; senão o próximo (data >= hoje); senão o último.
  const now = Date.now();
  const proximos = showList.filter((s) => s.data.getTime() >= now - 12 * 3600 * 1000);
  const chosen = (id && showList.find((s) => s.id === id)) || proximos[0] || showList[showList.length - 1];

  // Só agora carrega o show ESCOLHIDO por inteiro (setlists + músicas + letras).
  const show = await db.query.shows.findFirst({
    where: eq(shows.id, chosen.id),
    with: {
      casa: { columns: { nome: true } },
      setlists: { with: { items: { with: { song: true } } } },
    },
  });
  if (!show) notFound();

  const brand = await getBrand();

  // Usa o setlist OFICIAL do show (1 por show). Sem oficial marcado, cai no
  // de mais músicas. Nunca junta vários (era o que duplicava as músicas).
  const oficial =
    show.setlists.find((s) => s.oficial) ??
    [...show.setlists].sort((a, b) => b.items.length - a.items.length)[0] ??
    null;
  const items = [...(oficial?.items ?? [])].sort((a, b) => a.ordem - b.ordem);

  const cues = computeStageCues(
    items.map((it) => ({ energia: it.song.energia, momento: it.song.momento })),
    { casaNome: show.casa.nome, bandName: brand.bandName, dataMs: show.data.getTime() }
  );
  const cueSlotLabel = (slot: number) =>
    slot === 0 ? "Antes de começar" : slot >= items.length ? "No fim" : `Depois da ${slot}ª`;

  // Faixas pro teleprompter.
  const teleSongs = items.map((it, i) => ({
    n: i + 1,
    titulo: it.song.titulo,
    artista: it.song.artista,
    tom: it.song.tom ?? null,
    lyrics: it.song.lyrics ?? null,
    durationSeg: it.song.duracaoSeg,
    syncedLyrics: it.song.syncedLyrics,
    cues: it.song.cues,
    bpm: it.song.bpm,
    vozPedal: it.song.vozPedal,
    vozPreset: it.song.vozPreset,
    vozCueInicial: it.song.vozCueInicial,
    vocalCues: it.song.vocalCues,
  }));

  // Outros shows pra alternar (da lista enxuta).
  const outros = showList
    .filter((s) => s.id !== show.id)
    .map((s) => ({ id: s.id, label: `${s.casa.nome} · ${formatDataBR(s.data)}` }));

  return (
    <div className="pb-16">
      <PageHeader
        title="Modo Show"
        description="Setlist, tons, roteiro e letras numa tela só — salve e use offline."
        actions={
          <div className="flex items-center gap-2">
            <Button render={<Link href="/" />} variant="outline" size="sm">
              <ArrowLeft className="size-4" /> Voltar
            </Button>
            {teleSongs.length > 0 && <Teleprompter songs={teleSongs} defaultTom={brand?.tomPadrao ?? null} />}
            <OfflineDownloadButton extraUrls={["/"]} />
          </div>
        }
      />

      <div className="space-y-6 p-6">
        {/* Cabeçalho do show */}
        <Card>
          <CardContent className="space-y-3 py-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-bold">{show.casa.nome}</h2>
              <span className="text-sm text-muted-foreground capitalize">
                {formatDataExtensa(show.data)}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
              {(show.inicio || show.termino) && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-4" />
                  {show.inicio}
                  {show.termino ? ` às ${show.termino}` : ""}
                </span>
              )}
              {(show.endereco || show.cidade) && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-4" />
                  {[show.endereco, show.cidade].filter(Boolean).join(", ")}
                </span>
              )}
              {show.equipamentoVocal && (
                <span className="inline-flex items-center gap-1.5">
                  <Mic className="size-4" />
                  {show.equipamentoVocal}
                </span>
              )}
            </div>
            {outros.length > 0 && (
              <form className="pt-1">
                <label className="text-xs text-muted-foreground">Trocar de show: </label>
                <select
                  name="id"
                  defaultValue={show.id}
                  className="ml-1 h-8 rounded-md border border-input bg-transparent px-2 text-sm"
                  // Sem JS: o submit (onChange via botão) recarrega. Com JS o
                  // navegador envia o form. Mantemos um botão de fallback.
                >
                  <option value={show.id}>{show.casa.nome} · {formatDataBR(show.data)} (atual)</option>
                  {outros.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
                <Button type="submit" variant="outline" size="sm" className="ml-2">Abrir</Button>
              </form>
            )}
          </CardContent>
        </Card>

        {items.length === 0 ? (
          <EmptyState icon={Music2} title="Show sem setlist" description="Monte o setlist do show pra ele aparecer aqui." />
        ) : (
          <>
            {/* Setlist resumida */}
            <Card>
              <CardContent className="py-5">
                <h3 className="mb-3 flex items-center gap-2 font-semibold">
                  <Music2 className="size-4 text-primary" /> Setlist ({items.length})
                </h3>
                <ol className="space-y-1.5">
                  {items.map((it, i) => (
                    <li key={it.id} className="flex items-center gap-2 text-sm">
                      <span className="w-6 shrink-0 text-right font-mono text-muted-foreground">{i + 1}.</span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 wrap-break-word font-medium leading-snug">{it.song.titulo}</span>
                        <span className="block truncate text-xs text-muted-foreground">{it.song.artista}</span>
                      </span>
                      {it.song.dropada && (
                        <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 ring-1 ring-amber-500/30">DROP</span>
                      )}
                      <PresetBadge preset={it.song.vozPreset} className="text-[10px]" />
                      {it.song.vozCueInicial && (
                        <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 ring-1 ring-amber-500/30">🎤 {it.song.vozCueInicial}</span>
                      )}
                      {(it.song.tom) && (
                        <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-xs font-bold ring-1 ring-inset ${tomBadgeClass(it.song.tom, brand?.tomPadrao, "app")}`}>{it.song.tom}</span>
                      )}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            {/* Roteiro de palco */}
            {cues.length > 0 && (
              <Card>
                <CardContent className="py-5">
                  <h3 className="mb-3 flex items-center gap-2 font-semibold">
                    <Mic className="size-4 text-primary" /> Roteiro de palco
                  </h3>
                  <ul className="space-y-2">
                    {cues.map((c, i) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <span className="shrink-0">{CUE_EMOJI[c.tipo]}</span>
                        <div>
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {cueSlotLabel(c.slot)} · {CUE_LABEL[c.tipo]}
                          </span>
                          <p>{c.fala}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Letras inline (auto-contido pro offline) */}
            <Card>
              <CardContent className="py-5">
                <h3 className="mb-4 flex items-center gap-2 font-semibold">
                  <Guitar className="size-4 text-primary" /> Letras
                </h3>
                <div className="space-y-8">
                  {items.map((it, i) => (
                    <section key={it.id}>
                      <div className="mb-1 flex items-baseline gap-2 border-b border-border pb-1">
                        <span className="font-mono text-muted-foreground">{i + 1}.</span>
                        <h4 className="font-bold">{it.song.titulo}</h4>
                        <span className="text-sm text-muted-foreground">{it.song.artista}</span>
                        <span className="ml-auto flex items-center gap-2">
                          <PresetBadge preset={it.song.vozPreset} className="text-[10px]" />
                          {it.song.vozCueInicial && (
                            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 ring-1 ring-amber-500/30">🎤 {it.song.vozCueInicial}</span>
                          )}
                          {(it.song.tom) && <span className={`rounded px-1.5 py-0.5 font-mono text-xs font-bold ring-1 ring-inset ${tomBadgeClass(it.song.tom, brand?.tomPadrao, "app")}`}>{it.song.tom}</span>}
                        </span>
                      </div>
                      {it.song.lyrics?.trim() ? (
                        <LyricsText text={it.song.lyrics} tone="light" className="text-sm leading-relaxed" />
                      ) : (
                        <p className="text-sm italic text-muted-foreground">Letra não disponível.</p>
                      )}
                    </section>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
