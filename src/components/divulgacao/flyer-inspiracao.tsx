"use client";

import { useState, useTransition } from "react";
import { Search, ExternalLink, Sparkles, ImagePlus, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  buscarReferenciasFlyerAction,
  importarReferenciaAction,
  type RefImg,
} from "@/app/(app)/divulgacao/inspiracao-actions";

const SUGESTOES = ["rock gig poster", "concert poster vintage", "festival poster neon", "singer illustration"];

/** Reduz uma data URL (canvas) — evita guardar/renderizar imagem gigante. */
async function reduzir(dataUrl: string, max = 1600, q = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      if (!ctx) return reject(new Error("canvas"));
      ctx.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL("image/jpeg", q));
    };
    img.onerror = () => reject(new Error("img"));
    img.src = dataUrl;
  });
}

/** Galeria de inspiração: busca cartazes/flyers na web (Openverse, sem IA) e
 *  permite USAR a imagem escolhida como fundo do flyer. */
export function FlyerInspiracao({ onUsar }: { onUsar: (dataUrl: string) => void }) {
  const [q, setQ] = useState("rock gig poster");
  const [items, setItems] = useState<RefImg[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [usandoId, setUsandoId] = useState<string | null>(null);

  function buscar(termo?: string) {
    const termoFinal = termo ?? q;
    if (termo) setQ(termo);
    setErro(null);
    start(async () => {
      const r = await buscarReferenciasFlyerAction(termoFinal);
      if (r.error) {
        setErro(r.error);
        setItems([]);
      } else {
        setItems(r.items ?? []);
      }
    });
  }

  async function usar(it: RefImg) {
    setUsandoId(it.id);
    try {
      const r = await importarReferenciaAction(it.url);
      if (r.error || !r.dataUrl) {
        toast.error(r.error ?? "Não consegui usar essa imagem.");
        return;
      }
      const reduzida = await reduzir(r.dataUrl).catch(() => r.dataUrl!);
      onUsar(reduzida);
      toast.success("Imagem aplicada como fundo. Agora é só ajustar os textos. 🎨");
    } catch {
      toast.error("Falha ao usar a imagem.");
    } finally {
      setUsandoId(null);
    }
  }

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-xs text-zinc-400">
        <Sparkles className="size-3.5" /> Busque uma arte/cartaz, toque em <strong className="text-zinc-200">Usar no flyer</strong> e ela vira o fundo. Depois escolha os textos.
      </p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && buscar()}
            placeholder="ex.: rock gig poster, singer illustration"
            className="pl-8"
          />
        </div>
        <Button onClick={() => buscar()} disabled={pending}>
          {pending ? "Buscando…" : "Buscar"}
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SUGESTOES.map((s) => (
          <button
            key={s}
            onClick={() => buscar(s)}
            className="rounded-full px-2.5 py-0.5 text-[11px] text-zinc-300 ring-1 ring-inset ring-zinc-700 transition-colors hover:bg-zinc-800"
          >
            {s}
          </button>
        ))}
      </div>

      {erro && <p className="text-xs text-amber-300/80">{erro}</p>}

      {items.length > 0 && (
        <>
          <div className="grid max-h-96 grid-cols-3 gap-2 overflow-y-auto rounded-lg bg-zinc-900/40 p-2">
            {items.map((it) => (
              <div key={it.id} className="group relative aspect-3/4 overflow-hidden rounded-md ring-1 ring-zinc-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.thumb} alt={it.title || "referência"} loading="lazy" className="size-full object-cover" />
                {/* fonte (canto) */}
                <a
                  href={it.source}
                  target="_blank"
                  rel="noreferrer"
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  title={`${it.title}${it.creator ? ` · ${it.creator}` : ""} — abrir fonte`}
                >
                  <ExternalLink className="size-3" />
                </a>
                {/* usar como fundo */}
                <button
                  onClick={() => usar(it)}
                  disabled={usandoId === it.id}
                  className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/70 py-1 text-[11px] font-semibold text-white opacity-0 transition-opacity hover:bg-primary group-hover:opacity-100 disabled:opacity-100"
                >
                  {usandoId === it.id ? <Loader2 className="size-3 animate-spin" /> : <ImagePlus className="size-3" />}
                  {usandoId === it.id ? "Usando…" : "Usar no flyer"}
                </button>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-zinc-500">
            Imagens de terceiros (Creative Commons via Openverse). Confira a licença/crédito do autor na fonte antes de publicar.
          </p>
        </>
      )}
    </div>
  );
}
