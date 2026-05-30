"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Printer,
  FileDown,
  Minus,
  Plus,
  Music2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type BookletSong = {
  n: number;
  titulo: string;
  artista: string;
  tom: string | null;
  lyrics: string | null;
};

const SIZES = ["text-base", "text-lg", "text-xl", "text-2xl", "text-3xl"];

export function LyricsBooklet({
  showId,
  setlistId,
  titulo,
  subtitulo,
  songs,
}: {
  showId: string;
  setlistId: string | null;
  titulo: string;
  subtitulo: string;
  songs: BookletSong[];
}) {
  const [sizeIdx, setSizeIdx] = useState(1); // text-lg

  return (
    <div className="min-h-screen bg-white text-black">
      {/* Toolbar — não imprime */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white/95 px-4 py-2.5 backdrop-blur print:hidden">
        <Button
          variant="ghost"
          size="sm"
          className="text-gray-700 hover:bg-gray-100"
          render={<Link href={`/shows/${showId}`} />}
        >
          <ArrowLeft className="size-4" />
          Voltar
        </Button>

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
          render={
            <a
              href={`/shows/${showId}/letras/docx${
                setlistId ? `?sl=${setlistId}` : ""
              }`}
            />
          }
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
            {songs.map((s) => (
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
              </section>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @media print {
          @page { margin: 1.5cm; }
        }
      `}</style>
    </div>
  );
}
