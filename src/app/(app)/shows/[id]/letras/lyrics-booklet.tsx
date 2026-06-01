"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Printer,
  FileDown,
  Minus,
  Plus,
  Music2,
  Mic,
  Sparkles,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import { CUE_EMOJI, CUE_LABEL, type StageCue } from "@/lib/stage-cues";
import { refineStageCuesAction } from "@/app/(app)/shows/[id]/actions-setlist";

type BookletSong = {
  n: number;
  titulo: string;
  artista: string;
  tom: string | null;
  lyrics: string | null;
};

const SIZES = ["text-base", "text-lg", "text-xl", "text-2xl", "text-3xl"];

export function LyricsBooklet({
  backHref,
  docxHref,
  titulo,
  subtitulo,
  songs,
  cues = [],
  setlistId,
  canRefine = false,
}: {
  backHref: string;
  docxHref: string;
  titulo: string;
  subtitulo: string;
  songs: BookletSong[];
  /** Roteiro de palco (momentos de fala) — heurística grátis, calculado no server. */
  cues?: StageCue[];
  /** Necessário pro "Refinar com IA". */
  setlistId?: string;
  /** Admin pode refinar com IA (custo). */
  canRefine?: boolean;
}) {
  const [sizeIdx, setSizeIdx] = useState(1); // text-lg
  const [showCues, setShowCues] = useState(true);
  const [cueList, setCueList] = useState<StageCue[]>(cues);
  const [confirmAI, setConfirmAI] = useState(false);
  const [refining, startRefine] = useTransition();

  // slot -> cues (0 = antes da 1ª; songs.length = depois da última)
  const cuesBySlot = useMemo(() => {
    const m = new Map<number, StageCue[]>();
    for (const c of cueList) {
      const arr = m.get(c.slot) ?? [];
      arr.push(c);
      m.set(c.slot, arr);
    }
    return m;
  }, [cueList]);

  function doRefine() {
    if (!setlistId) return;
    startRefine(async () => {
      const r = await refineStageCuesAction(setlistId);
      if (r.ok) {
        setCueList(r.cues);
        toast.success("Roteiro refinado com IA.");
      } else if (r.needsKey) {
        toast.error("IA não configurada — o roteiro grátis continua valendo.");
      } else {
        toast.error(r.error || "Falha ao refinar.");
      }
      setConfirmAI(false);
    });
  }

  const CueBlock = ({ list }: { list: StageCue[] }) => (
    <div className="my-4 space-y-1.5 rounded-md border-l-4 border-amber-500 bg-amber-50 px-3 py-2 print:bg-amber-50">
      {list.map((c, i) => (
        <p key={i} className="text-sm leading-snug text-amber-900">
          <span className="mr-1">{CUE_EMOJI[c.tipo]}</span>
          <span className="font-bold uppercase tracking-wide text-amber-700">
            {CUE_LABEL[c.tipo]}:
          </span>{" "}
          {c.fala}
        </p>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-white text-black">
      {/* Toolbar — não imprime */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white/95 px-4 py-2.5 backdrop-blur print:hidden">
        <Button
          variant="ghost"
          size="sm"
          className="text-gray-700 hover:bg-gray-100"
          render={<Link href={backHref} />}
        >
          <ArrowLeft className="size-4" />
          Voltar
        </Button>

        {cueList.length > 0 && (
          <Button
            variant={showCues ? "default" : "outline"}
            size="sm"
            className={showCues ? "" : "border-gray-300 text-gray-700 hover:bg-gray-100"}
            onClick={() => setShowCues((v) => !v)}
            title="Mostrar/ocultar o roteiro de palco (momentos de fala)"
          >
            <Mic className="size-4" />
            Roteiro
          </Button>
        )}
        {canRefine && setlistId && showCues && cueList.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="border-amber-400 text-amber-700 hover:bg-amber-50"
            onClick={() => setConfirmAI(true)}
            disabled={refining}
            title="Refinar os momentos de fala com IA (custo baixo)"
          >
            {refining ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Refinar com IA
          </Button>
        )}

        <div className="ml-auto flex items-center gap-1">
          <span className="mr-1 hidden text-xs text-gray-500 sm:inline">
            Texto
          </span>
          <Button
            variant="outline"
            size="icon"
            className="border-gray-300 text-gray-700 hover:bg-gray-100"
            onClick={() => setSizeIdx((i) => Math.max(0, i - 1))}
            disabled={sizeIdx === 0}
            title="Diminuir"
          >
            <Minus className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="border-gray-300 text-gray-700 hover:bg-gray-100"
            onClick={() => setSizeIdx((i) => Math.min(SIZES.length - 1, i + 1))}
            disabled={sizeIdx === SIZES.length - 1}
            title="Aumentar"
          >
            <Plus className="size-4" />
          </Button>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="border-gray-300 text-gray-700 hover:bg-gray-100"
          render={<a href={docxHref} />}
        >
          <FileDown className="size-4" />
          Word
        </Button>
        <Button
          size="sm"
          onClick={() => window.print()}
          title="Salvar como PDF: escolha 'Salvar como PDF' na impressão"
        >
          <Printer className="size-4" />
          Salvar PDF
        </Button>
      </div>

      <div className="mx-auto max-w-2xl px-6 py-6 print:px-0">
        <header className="mb-6 border-b-2 border-black pb-3">
          <h1 className="text-2xl font-black uppercase tracking-tight">
            The Rock — Letras
          </h1>
          <p className="text-sm text-gray-700">
            {titulo} — {subtitulo} · {songs.length}{" "}
            {songs.length === 1 ? "música" : "músicas"}
          </p>
        </header>

        {songs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-gray-500">
            <Music2 className="size-8" />
            <p>Setlist vazia.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {showCues && cuesBySlot.get(0) && <CueBlock list={cuesBySlot.get(0)!} />}
            {songs.map((s, idx) => (
              <section
                key={s.n}
                className="break-inside-avoid print:break-before-page print:first:break-before-auto"
              >
                <div className="mb-2 flex items-baseline gap-2 border-b border-gray-300 pb-1">
                  <span className="font-mono text-gray-400">{s.n}.</span>
                  <h2 className="text-lg font-bold">{s.titulo}</h2>
                  <span className="text-sm text-gray-600">{s.artista}</span>
                  {s.tom && (
                    <span className="ml-auto rounded border border-gray-400 px-1.5 py-0.5 font-mono text-sm">
                      {s.tom}
                    </span>
                  )}
                </div>
                {s.lyrics ? (
                  <pre
                    className={`whitespace-pre-wrap font-sans leading-relaxed ${SIZES[sizeIdx]}`}
                  >
                    {s.lyrics}
                  </pre>
                ) : (
                  <p className="text-sm italic text-gray-500">
                    Letra não disponível — use “Sincronizar letras” no
                    repertório.
                  </p>
                )}
                {showCues && cuesBySlot.get(idx + 1) && (
                  <CueBlock list={cuesBySlot.get(idx + 1)!} />
                )}
              </section>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={confirmAI} onOpenChange={setConfirmAI}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Refinar com IA?</AlertDialogTitle>
            <AlertDialogDescription>
              Usa IA (Claude Haiku) pra afinar a redação e a posição dos momentos
              de fala lendo o setlist. Tem um custo baixo por uso. O roteiro
              grátis já está pronto — isto é opcional.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel render={<Button variant="outline" />}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              render={<Button disabled={refining} />}
              onClick={doRefine}
            >
              {refining ? "Refinando…" : "Refinar (usa IA)"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <style>{`
        @media print {
          @page { margin: 1.5cm; }
        }
      `}</style>
    </div>
  );
}
