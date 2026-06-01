import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { ArrowLeft, MapPin, Clock, Music2, Mic, Guitar } from "lucide-react";
import { db } from "@/db";
import { shows } from "@/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { OfflineDownloadButton } from "@/components/shared/offline-download-button";
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

  const allShows = await db.query.shows.findMany({
    with: {
      casa: { columns: { nome: true } },
      setlists: { with: { items: { with: { song: true } } } },
    },
    orderBy: [asc(shows.data)],
  });

  if (allShows.length === 0) {
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
  const proximos = allShows.filter((s) => s.data.getTime() >= now - 12 * 3600 * 1000);
  const show =
    (id && allShows.find((s) => s.id === id)) ||
    proximos[0] ||
    allShows[allShows.length - 1];

  const brand = await getBrand();

  // Junta todos os setlists do show, em ordem.
  const items = show.setlists
    .flatMap((sl, slIdx) => sl.items.map((it) => ({ ...it, slIdx })))
    .sort((a, b) => a.slIdx - b.slIdx || a.ordem - b.ordem);

  const cues = computeStageCues(
    items.map((it) => ({ energia: it.song.energia, momento: it.song.momento })),
    { casaNome: show.casa.nome, bandName: brand.bandName }
  );
  const cueSlotLabel = (slot: number) =>
    slot === 0 ? "Antes de começar" : slot >= items.length ? "No fim" : `Depois da ${slot}ª`;

  // Outros shows pra alternar.
  const outros = allShows
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
                      <span className="min-w-0 flex-1 truncate font-medium">{it.song.titulo}</span>
                      <span className="truncate text-muted-foreground">{it.song.artista}</span>
                      {it.song.dropada && (
                        <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 ring-1 ring-amber-500/30">DROP</span>
                      )}
                      {it.tom && (
                        <span className="shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-xs">{it.tom}</span>
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
                        {it.tom && <span className="ml-auto rounded border border-border px-1.5 py-0.5 font-mono text-xs">{it.tom}</span>}
                      </div>
                      {it.song.lyrics?.trim() ? (
                        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{it.song.lyrics}</pre>
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
