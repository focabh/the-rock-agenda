import { TrendingUp, TrendingDown, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { VenueInsights as Insights } from "@/lib/show-learning";

/** Sugestões aprendidas dos shows em casas de perfil parecido. Só aparece se
 *  já houver feedback suficiente. Grátis (sem IA). */
export function VenueInsights({ data }: { data: Insights }) {
  if (data.campeas.length === 0 && data.evitar.length === 0) return null;

  return (
    <Card className="border-amber-500/30">
      <CardContent className="py-4">
        <h3 className="mb-1 flex items-center gap-2 font-semibold">
          <Sparkles className="size-4 text-amber-400" /> Aprendizado de casas parecidas
        </h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Baseado no feedback de {data.baseShows} show(s) em {data.similares} casa(s) de perfil parecido.
        </p>

        {data.campeas.length > 0 && (
          <div className="mb-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-300">
              <TrendingUp className="size-3.5" /> Costumam bombar aqui
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {data.campeas.map((s) => (
                <li
                  key={s.songId}
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-200 ring-1 ring-inset ring-emerald-500/30"
                  title={`${s.artista} · público ${s.publico}× · banda ${s.banda}× · caiu ${s.caiu}×`}
                >
                  {s.titulo}
                </li>
              ))}
            </ul>
          </div>
        )}

        {data.evitar.length > 0 && (
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              <TrendingDown className="size-3.5" /> Costumam cair aqui
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {data.evitar.map((s) => (
                <li
                  key={s.songId}
                  className="inline-flex items-center gap-1 rounded-full bg-zinc-500/10 px-2.5 py-1 text-xs text-zinc-300 ring-1 ring-inset ring-zinc-400/30"
                  title={`${s.artista} · caiu ${s.caiu}×`}
                >
                  {s.titulo}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
