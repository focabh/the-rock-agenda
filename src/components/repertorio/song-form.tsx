"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { Loader2, Music } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { FieldError } from "@/components/shared/field-error";
import { SONG_STATUS_OPTIONS } from "@/components/shared/status-badge";
import { previewSpotifyTrackAction } from "@/app/(app)/repertorio/actions";
import type { ActionState } from "@/lib/form";
import type { Song } from "@/db/schema";

const SELECT_CLS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function toMMSS(sec: number | null): string {
  if (!sec || sec <= 0) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function SongForm({
  song,
  action,
  submitLabel = "Salvar",
}: {
  song?: Song;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  // Campos que o "Puxar do Spotify" preenche → controlados.
  const [titulo, setTitulo] = useState(song?.titulo ?? "");
  const [artista, setArtista] = useState(song?.artista ?? "");
  const [duracao, setDuracao] = useState(toMMSS(song?.duracaoSeg ?? null));
  const [spotifyId, setSpotifyId] = useState("");

  const [spOpen, setSpOpen] = useState(false);
  const [spUrl, setSpUrl] = useState("");
  const [spPending, startSp] = useTransition();

  function puxarDoSpotify() {
    if (!spUrl.trim()) return;
    startSp(async () => {
      const r = await previewSpotifyTrackAction(spUrl);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setTitulo(r.titulo);
      setArtista(r.artista);
      if (r.duracaoSeg) setDuracao(toMMSS(r.duracaoSeg));
      setSpotifyId(r.spotifyId);
      toast.success(`Puxado: ${r.titulo} — ${r.artista}`);
      setSpOpen(false);
      setSpUrl("");
    });
  }

  return (
    <Card>
      <CardContent className="py-6">
        <form action={formAction} className="grid gap-5 sm:grid-cols-2">
          <input type="hidden" name="spotifyTrackId" value={spotifyId} />

          <div className="sm:col-span-2">
            {!spOpen ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSpOpen(true)}
              >
                <Music className="size-4" /> Puxar do Spotify
              </Button>
            ) : (
              <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
                <Label htmlFor="sp-url">Link da música no Spotify</Label>
                <div className="flex flex-wrap gap-2">
                  <Input
                    id="sp-url"
                    value={spUrl}
                    onChange={(e) => setSpUrl(e.target.value)}
                    placeholder="https://open.spotify.com/track/..."
                    className="min-w-0 flex-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        puxarDoSpotify();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    onClick={puxarDoSpotify}
                    disabled={spPending || !spUrl.trim()}
                  >
                    {spPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    Puxar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setSpOpen(false);
                      setSpUrl("");
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Preenche título, artista e duração. Ao salvar, também
                  re-busca letra e BPM da nova versão. Útil pra corrigir um dado
                  errado ou trocar a versão.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="titulo">Música *</Label>
            <Input
              id="titulo"
              name="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
            />
            <FieldError state={state} name="titulo" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="artista">Artista original *</Label>
            <Input
              id="artista"
              name="artista"
              value={artista}
              onChange={(e) => setArtista(e.target.value)}
              required
            />
            <FieldError state={state} name="artista" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status *</Label>
            <select
              id="status"
              name="status"
              defaultValue={song?.status ?? "aprendendo"}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              required
            >
              {SONG_STATUS_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <FieldError state={state} name="status" />
          </div>

          {/* --- Metadados pro setlist --- */}
          <div className="sm:col-span-2 pt-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Detalhes pro setlist
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="duracao">Duração (mm:ss)</Label>
            <Input
              id="duracao"
              name="duracao"
              value={duracao}
              onChange={(e) => setDuracao(e.target.value)}
              placeholder="3:45"
              inputMode="numeric"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tom">Tom (transposição)</Label>
            <Input
              id="tom"
              name="tom"
              type="number"
              inputMode="numeric"
              step={1}
              min={-12}
              max={12}
              defaultValue={song?.tom ?? ""}
              placeholder="Ex.: 0, -1, -2, -3"
            />
            <p className="text-xs text-muted-foreground">
              Quanto a banda baixa/sobe em relação ao original (0 = original, -2 =
              dois semitons abaixo). Use as setinhas — não precisa digitar o sinal.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vozPreset">Preset do pedal de voz</Label>
            <Input
              id="vozPreset"
              name="vozPreset"
              type="number"
              inputMode="numeric"
              step={1}
              min={0}
              max={9999}
              defaultValue={song?.vozPreset ?? ""}
              placeholder="Ex.: 3"
            />
            <p className="text-xs text-muted-foreground">
              Número do preset no seu equipamento de voz. Aparece em destaque no
              teleprompter, letras, repertório e setlist. Vazio = sem preset.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="energia">Energia</Label>
            <select
              id="energia"
              name="energia"
              defaultValue={song?.energia ?? ""}
              className={SELECT_CLS}
            >
              <option value="">—</option>
              <option value="1">Leve</option>
              <option value="2">Média</option>
              <option value="3">Pesada</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="posicaoShow">Posição no show</Label>
            <select
              id="posicaoShow"
              name="posicaoShow"
              defaultValue={song?.posicaoShow ?? "qualquer"}
              className={SELECT_CLS}
            >
              <option value="qualquer">Qualquer</option>
              <option value="abertura">Abertura</option>
              <option value="bloco_inicial">Bloco inicial</option>
              <option value="bloco_final">Bloco final</option>
              <option value="encerramento">Encerramento (hino/catarse)</option>
            </select>
            <p className="text-[11px] text-muted-foreground">
              Usado quando o app gera o setlist de <strong>show</strong>. Ensaio é livre.
            </p>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="estilo">Estilo / categoria</Label>
            <Input
              id="estilo"
              name="estilo"
              defaultValue={song?.estilo ?? ""}
              placeholder="Ex.: grunge, pop rock, clássico"
            />
          </div>

          <div className="sm:col-span-2 flex flex-wrap gap-x-6 gap-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="conhecida"
                defaultChecked={song?.conhecida ?? false}
                className="size-4 accent-primary"
              />
              Mais conhecida pelo público
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="exigeVocal"
                defaultChecked={song?.exigeVocal ?? false}
                className="size-4 accent-primary"
              />
              Exige mais do vocal
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="dropada"
                defaultChecked={song?.dropada ?? false}
                className="size-4 accent-primary"
              />
              Afinação dropada (Drop D/C…)
            </label>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              name="observacoes"
              rows={2}
              defaultValue={song?.observacoes ?? ""}
              placeholder="Afinação, tom alternativo, dicas de execução..."
            />
            <FieldError state={state} name="observacoes" />
          </div>

          <div className="sm:col-span-2 flex items-center justify-end gap-2 pt-2">
            {state?.error && !state.fieldErrors && (
              <p className="mr-auto text-sm text-destructive">{state.error}</p>
            )}
            <Button render={<Link href="/repertorio" />} variant="outline">
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : submitLabel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
