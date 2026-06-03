"use client";

import { useState, useTransition } from "react";
import { Search, ExternalLink, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { buscarReferenciasFlyerAction, type RefImg } from "@/app/(app)/divulgacao/inspiracao-actions";

const SUGESTOES = ["rock gig poster", "concert poster vintage", "festival poster neon", "cartaz show banda"];

/** Galeria de inspiração: busca cartazes/flyers na web (Openverse, sem IA).
 *  Serve pra dar ideias de estilo — depois é só recriar a vibe aqui no estúdio
 *  com as suas fotos e os modelos prontos. */
export function FlyerInspiracao() {
  const [q, setQ] = useState("rock gig poster");
  const [items, setItems] = useState<RefImg[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();

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

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-xs text-zinc-400">
        <Sparkles className="size-3.5" /> Busque cartazes pra se inspirar, depois recrie a vibe com seus modelos e fotos.
      </p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && buscar()}
            placeholder="ex.: rock gig poster"
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
          <div className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto rounded-lg bg-zinc-900/40 p-2">
            {items.map((it) => (
              <a
                key={it.id}
                href={it.source}
                target="_blank"
                rel="noreferrer"
                className="group relative aspect-3/4 overflow-hidden rounded-md ring-1 ring-zinc-800"
                title={`${it.title}${it.creator ? ` · ${it.creator}` : ""} — abrir fonte`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.thumb} alt={it.title || "referência"} loading="lazy" className="size-full object-cover transition-transform group-hover:scale-105" />
                <span className="absolute right-1 top-1 rounded-full bg-black/60 p-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <ExternalLink className="size-3 text-white" />
                </span>
              </a>
            ))}
          </div>
          <p className="text-[10px] text-zinc-500">
            Imagens de terceiros (Creative Commons via Openverse), só pra inspiração — não são incorporadas ao seu flyer.
          </p>
        </>
      )}
    </div>
  );
}
