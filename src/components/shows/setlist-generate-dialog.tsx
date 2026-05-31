"use client";

import { useEffect, useState, useTransition } from "react";
import { Wand2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NumberStepper } from "@/components/shared/number-stepper";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  generateSetlistAction,
  getSetlistPrefsAction,
  saveSetlistPrefsAction,
} from "@/app/(app)/shows/[id]/actions-setlist";

type Opts = {
  priConhecidas: boolean;
  priPesadas: boolean;
  priAlternativas: boolean;
  levesNoComeco: boolean;
  evitarVocalDificil: boolean;
  evitarRepetir: boolean;
};

const CHECKS: { key: keyof Opts; label: string }[] = [
  { key: "priConhecidas", label: "Priorizar músicas mais conhecidas" },
  { key: "priPesadas", label: "Priorizar músicas mais pesadas" },
  { key: "priAlternativas", label: "Priorizar mais alternativas" },
  { key: "levesNoComeco", label: "Mais leves no começo" },
  { key: "evitarVocalDificil", label: "Evitar músicas difíceis pro vocal" },
  { key: "evitarRepetir", label: "Evitar repetir setlist anterior nesta casa" },
];

export function SetlistGenerateDialog({
  showId,
  setlistId,
  hasItems,
  defaultMin = 60,
}: {
  showId: string;
  setlistId: string;
  hasItems: boolean;
  defaultMin?: number;
}) {
  const [open, setOpen] = useState(false);
  const [min, setMin] = useState(defaultMin);
  const [ordem, setOrdem] = useState<"equilibrada" | "aleatoria">("equilibrada");
  const [perfil, setPerfil] = useState("equilibrado");
  const [opts, setOpts] = useState<Opts>({
    priConhecidas: false,
    priPesadas: false,
    priAlternativas: false,
    levesNoComeco: false,
    evitarVocalDificil: false,
    evitarRepetir: true,
  });
  const [usarIA, setUsarIA] = useState(false);
  const [pending, start] = useTransition();
  const [regras, setRegras] = useState("");
  const [regrasLoaded, setRegrasLoaded] = useState(false);

  const fmtMin = (seg: number) => {
    const m = Math.round(seg / 60);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r ? `${h}h${String(r).padStart(2, "0")}` : `${h}h`;
  };

  useEffect(() => {
    if (!open || regrasLoaded) return;
    getSetlistPrefsAction().then((r) => {
      setRegras(r.regras ?? "");
      setRegrasLoaded(true);
    });
  }, [open, regrasLoaded]);

  function gerar() {
    start(async () => {
      await saveSetlistPrefsAction(regras); // persiste as regras fixas
      const r = await generateSetlistAction(showId, setlistId, {
        targetMin: min,
        ordem,
        perfilDesejado: perfil,
        usarIA,
        ...opts,
        seed: Math.floor(Math.random() * 1_000_000_000),
      });
      if (!r.ok) {
        toast.error(r.error ?? "Falha ao gerar.");
        return;
      }
      const tot = fmtMin(r.totalSeg ?? 0);
      if (r.faltou) {
        toast.warning(
          `${r.count} música(s) · ${tot} — repertório não chega aos ${min} min pedidos. Cadastre mais músicas ou reduza a duração.`
        );
      } else {
        toast.success(
          `Setlist ${r.via === "ia" ? "✨ pela IA" : "gerado"}: ${r.count} música(s) · ${tot} (alvo ${min} min). Ajuste à vontade.`
        );
      }
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Wand2 className="size-4" />
        Gerar
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerar setlist</DialogTitle>
          <DialogDescription>
            Sugestão inicial com base na duração e no perfil da casa.
            {hasItems ? " Substitui o setlist atual." : ""} Você ajusta tudo
            depois.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="gen-min">Duração (min)</Label>
              <NumberStepper
                id="gen-min"
                value={min}
                onChange={setMin}
                min={5}
                max={300}
                step={5}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gen-ordem">Ordem</Label>
              <select
                id="gen-ordem"
                value={ordem}
                onChange={(e) =>
                  setOrdem(e.target.value as "equilibrada" | "aleatoria")
                }
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="equilibrada">Equilibrada</option>
                <option value="aleatoria">Mais aleatória</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gen-perfil">Perfil desejado</Label>
              <select
                id="gen-perfil"
                value={perfil}
                onChange={(e) => setPerfil(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="equilibrado">Equilibrado</option>
                <option value="mais pesado">Mais pesado</option>
                <option value="mais pop">Mais pop</option>
                <option value="mais alternativo">Mais alternativo</option>
                <option value="mais nostálgico">Mais nostálgico</option>
                <option value="mais dançante">Mais dançante</option>
                <option value="mais seguro">Mais seguro</option>
                <option value="mais ousado">Mais ousado</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            {CHECKS.map((c) => (
              <label key={c.key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={opts[c.key]}
                  onChange={(e) =>
                    setOpts((o) => ({ ...o, [c.key]: e.target.checked }))
                  }
                  className="size-4 accent-primary"
                />
                {c.label}
              </label>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gen-regras">
              Regras fixas da banda (a IA sempre obedece)
            </Label>
            <Textarea
              id="gen-regras"
              value={regras}
              onChange={(e) => setRegras(e.target.value)}
              rows={2}
              placeholder="Ex.: guardar a catarse pro final; não abrir com lenta; terminar com sequência explosiva."
            />
          </div>

          <p className="text-xs text-muted-foreground">
            O perfil/tags da casa e o histórico de setlists (o que a banda
            costuma abrir/fechar) já influenciam automaticamente.
          </p>

          <label className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
            <input
              type="checkbox"
              checked={usarIA}
              onChange={(e) => setUsarIA(e.target.checked)}
              className="mt-0.5 size-4 accent-amber-500"
            />
            <span>
              <span className="font-medium">Refinar com IA ✨ (gera custo)</span>
              <span className="block text-xs text-muted-foreground">
                Sem marcar, a geração é gratuita e instantânea (já respeita curva
                de energia, Final Boss, perfil e regras). Marque para a IA buscar
                uma curva mais elaborada — só então há cobrança.
              </span>
            </span>
          </label>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={gerar} disabled={pending}>
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Wand2 className="size-4" />
              )}
              {pending ? "Gerando…" : "Gerar setlist"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
