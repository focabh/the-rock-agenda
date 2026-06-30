"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Mic, X, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { setVocalCuesAction } from "@/app/(app)/repertorio/actions";
import { parseVocalCues, cuesByLineIndex } from "@/lib/vocal-cues";

/**
 * Stage Master — editor de Vocal Cues por música: um cue INICIAL + cues/observações
 * livres por LINHA da letra. Qualquer músico edita. Auto-salva a cada mudança.
 */
export function VocalCuesEditor({
  songId,
  lyrics,
  initialCue,
  vocalCuesRaw,
}: {
  songId: string;
  lyrics: string | null;
  initialCue: string | null;
  vocalCuesRaw: string | null;
}) {
  const lines = useMemo(() => (lyrics ?? "").split("\n"), [lyrics]);
  const [inicial, setInicial] = useState(initialCue ?? "");
  const [byLine, setByLine] = useState<Record<number, string[]>>(() => {
    const m = cuesByLineIndex(parseVocalCues(vocalCuesRaw));
    return Object.fromEntries(m);
  });
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [saving, start] = useTransition();

  function persist(nextInicial: string, nextByLine: Record<number, string[]>) {
    const perLine = Object.entries(nextByLine)
      .map(([line, cues]) => ({
        line: Number(line),
        snapshot: lines[Number(line)] ?? "",
        cues,
      }))
      .filter((p) => p.cues.length > 0);
    start(async () => {
      const r = await setVocalCuesAction(songId, nextInicial.trim() || null, perLine);
      if (!r.ok) toast.error("Erro ao salvar os Vocal Cues.");
    });
  }

  function addCue(line: number) {
    const text = (drafts[line] ?? "").trim();
    if (!text) return;
    const next = { ...byLine, [line]: [...(byLine[line] ?? []), text] };
    setByLine(next);
    setDrafts((d) => ({ ...d, [line]: "" }));
    persist(inicial, next);
  }
  function removeCue(line: number, idx: number) {
    const cur = byLine[line] ?? [];
    const cues = cur.filter((_, i) => i !== idx);
    const next = { ...byLine };
    if (cues.length) next[line] = cues;
    else delete next[line];
    setByLine(next);
    persist(inicial, next);
  }

  return (
    <section className="space-y-2">
      <h2 className="inline-flex items-center gap-1.5 text-sm font-medium uppercase tracking-wider text-muted-foreground">
        <Mic className="size-3.5" />
        Stage Master · Vocal Cues
        {saving && <Loader2 className="size-3.5 animate-spin" />}
      </h2>
      <Card className="space-y-4 p-4">
        {/* Cue inicial */}
        <div className="space-y-1">
          <label htmlFor="cue-ini" className="text-xs font-medium text-muted-foreground">
            Vocal Cue inicial (aparece no card antes da letra)
          </label>
          <Input
            id="cue-ini"
            value={inicial}
            onChange={(e) => setInicial(e.target.value)}
            onBlur={() => persist(inicial, byLine)}
            placeholder="Ex.: ARENA · P03 · Harmony ON"
            className="font-semibold"
          />
        </div>

        {/* Cues por linha */}
        {lines.filter((l) => l.trim()).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sem letra ainda — adicione a letra da música pra marcar cues por linha.
          </p>
        ) : (
          <div className="max-h-[60vh] space-y-1 overflow-y-auto rounded-md border border-border p-2">
            {lines.map((text, idx) =>
              text.trim() ? (
                <div key={idx} className="rounded px-1 py-1 hover:bg-accent/30">
                  <div className="flex items-start gap-2">
                    <span className="flex-1 text-sm leading-snug">{text}</span>
                    {(byLine[idx] ?? []).length > 0 && (
                      <span className="flex flex-wrap justify-end gap-1">
                        {byLine[idx].map((c, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300 ring-1 ring-inset ring-amber-500/30"
                          >
                            🎤 {c}
                            <button
                              type="button"
                              onClick={() => removeCue(idx, i)}
                              className="text-amber-300/70 hover:text-amber-200"
                              title="Remover"
                            >
                              <X className="size-3" />
                            </button>
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 pl-0">
                    <Input
                      value={drafts[idx] ?? ""}
                      onChange={(e) => setDrafts((d) => ({ ...d, [idx]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addCue(idx);
                        }
                      }}
                      placeholder="+ cue ou observação (ex.: Harmony ON, Respirar)"
                      className="h-7 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => addCue(idx)}
                      className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                      title="Adicionar"
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div key={idx} className="h-2" aria-hidden />
              )
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Texto livre — o app só mostra o que você escrever (compatível com
          qualquer equipamento). Aparece no teleprompter no momento da linha.
        </p>
      </Card>
    </section>
  );
}
