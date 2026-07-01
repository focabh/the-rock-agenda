"use client";

import { useRef, useState } from "react";
import { Share2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export type ShareLinha = { n: number; titulo: string; artista: string; tom: string; dropada?: boolean; dur: string };

/** Gera uma imagem bonita do setlist pra mandar no grupo (WhatsApp/Stories).
 *  Usa modern-screenshot (mesma lib do flyer). Sem custo. */
export function SetlistShare({ titulo, subtitulo, linhas }: { titulo: string; subtitulo: string; linhas: ShareLinha[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  async function compartilhar() {
    if (!ref.current || linhas.length === 0) {
      toast.error("Adicione músicas ao setlist primeiro.");
      return;
    }
    setBusy(true);
    try {
      const { domToBlob } = await import("modern-screenshot");
      const blob = await domToBlob(ref.current, {
        scale: 1080 / ref.current.offsetWidth,
        backgroundColor: "#09090b",
        type: "image/png",
      });
      const file = new File([blob], "setlist.png", { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
      if (nav.canShare?.({ files: [file] }) && typeof nav.share === "function") {
        await nav.share({ files: [file], title: titulo }).catch((e) => {
          if (e instanceof DOMException && e.name === "AbortError") return;
          throw e;
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "setlist.png";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      }
    } catch (e) {
      toast.error("Não consegui gerar a imagem: " + (e instanceof Error ? e.message : "erro"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={compartilhar} disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />}
        Compartilhar imagem
      </Button>

      {/* Pôster renderizado fora da tela, só pra capturar. */}
      <div className="pointer-events-none fixed -left-[9999px] top-0" aria-hidden>
        <div ref={ref} style={{ width: 420 }} className="bg-zinc-950 p-7 text-zinc-50">
          <div className="mb-4 border-b border-zinc-700 pb-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-amber-400">Setlist</p>
            <h2 className="mt-0.5 text-2xl font-black leading-tight">{titulo}</h2>
            {subtitulo && <p className="text-sm text-zinc-400">{subtitulo}</p>}
          </div>
          <ol className="space-y-2">
            {linhas.map((l) => (
              <li key={l.n} className="flex items-baseline gap-3">
                <span className="w-6 shrink-0 text-right font-mono text-sm text-zinc-500">{l.n}</span>
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{l.titulo}</span>
                  {l.artista && <span className="text-zinc-500"> · {l.artista}</span>}
                </span>
                {l.dropada && (
                  <span className="shrink-0 rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-black uppercase leading-none tracking-wide text-zinc-950">
                    Drop
                  </span>
                )}
                {l.tom && <span className="shrink-0 font-mono text-xs text-amber-300">{l.tom}</span>}
                {l.dur && <span className="shrink-0 font-mono text-xs text-zinc-500">{l.dur}</span>}
              </li>
            ))}
          </ol>
          <p className="mt-5 border-t border-zinc-800 pt-3 text-center text-[10px] uppercase tracking-widest text-zinc-600">
            via StageBoss
          </p>
        </div>
      </div>
    </>
  );
}
