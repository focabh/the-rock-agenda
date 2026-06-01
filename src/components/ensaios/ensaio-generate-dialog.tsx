"use client";

import { useState, useTransition } from "react";
import { Wand2, Loader2, Target, CalendarCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  gerarEnsaioSetlistAction,
  simularShowNoEnsaioAction,
} from "@/app/(app)/ensaios/[id]/actions-setlist";

export type SimularShowsProps = {
  shows: { id: string; label: string }[];
  defaultShowId: string;
};

/** "Gerar" do ensaio. Duas frentes:
 *  - Treino: monta o set priorizando músicas novas/marcadas + as que precisam
 *    de ensaio (heurística grátis, sem IA).
 *  - Simular show: traz o set de um show real (o mais próximo, por padrão). */
export function EnsaioGenerateDialog({
  rehearsalId,
  setlistId,
  hasItems,
  simular,
}: {
  rehearsalId: string;
  setlistId: string;
  hasItems: boolean;
  simular?: SimularShowsProps;
}) {
  const [open, setOpen] = useState(false);
  const [min, setMin] = useState(60);
  const [novas, setNovas] = useState(true);
  const [pesadas, setPesadas] = useState(false);
  const [levesComeco, setLevesComeco] = useState(true);
  const [showId, setShowId] = useState(simular?.defaultShowId ?? "");
  const [pending, start] = useTransition();

  function gerar() {
    start(async () => {
      const r = await gerarEnsaioSetlistAction(rehearsalId, setlistId, {
        targetMin: min,
        priNovas: novas,
        priPesadas: pesadas,
        levesNoComeco: levesComeco,
      });
      if (r.ok) {
        toast.success(`Setlist gerado com ${r.count} música(s). Ajuste arrastando.`);
        setOpen(false);
      } else {
        toast.error("Não foi possível gerar.");
      }
    });
  }

  function simularShow() {
    if (!showId) {
      toast.error("Escolha um show.");
      return;
    }
    start(async () => {
      const r = await simularShowNoEnsaioAction(rehearsalId, setlistId, showId);
      if (r.ok) {
        toast.success(`Set do show trazido: ${r.count} música(s). Bom ensaio!`);
        setOpen(false);
      } else {
        toast.error("Não foi possível simular o show.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Wand2 className="size-4" /> Gerar
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gerar setlist do ensaio</DialogTitle>
          <DialogDescription>
            {hasItems ? "Substitui as músicas atuais. " : ""}Grátis, sem IA. Depois é só ajustar arrastando.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="treino" className="gap-4">
          <TabsList variant="line" className="w-full justify-start">
            <TabsTrigger value="treino">
              <Target className="size-4" /> Treino
            </TabsTrigger>
            {simular && simular.shows.length > 0 && (
              <TabsTrigger value="simular">
                <CalendarCheck className="size-4" /> Simular show
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="treino" className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Ensaio é pra treinar: o gerador puxa pra frente as músicas marcadas
              como <strong>prioridade (Ensaiar)</strong> e as <strong>recém-adicionadas</strong>, e foca nas que ainda precisam de ensaio. Drops ficam agrupados.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="alvo">Duração-alvo (min)</Label>
              <Input id="alvo" type="number" min={5} max={300} step={5} value={min} onChange={(e) => setMin(Number(e.target.value) || 60)} className="w-28" />
            </div>
            <div className="space-y-2 text-sm">
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={novas} onChange={(e) => setNovas(e.target.checked)} className="size-4 accent-red-600" />
                Priorizar novas / marcadas pra ensaiar
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={pesadas} onChange={(e) => setPesadas(e.target.checked)} className="size-4 accent-red-600" />
                Priorizar pesadas
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={levesComeco} onChange={(e) => setLevesComeco(e.target.checked)} className="size-4 accent-red-600" />
                Começar mais leve
              </label>
            </div>
            <div className="flex justify-end">
              <Button onClick={gerar} disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
                {pending ? "Gerando…" : "Gerar treino"}
              </Button>
            </div>
          </TabsContent>

          {simular && simular.shows.length > 0 && (
            <TabsContent value="simular" className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Traz o setlist de um show real pro ensaio, pra banda passar o set
                inteiro. Já deixei selecionado o show mais próximo da data do ensaio.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="show">Show</Label>
                <select
                  id="show"
                  value={showId}
                  onChange={(e) => setShowId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  {simular.shows.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end">
                <Button onClick={simularShow} disabled={pending}>
                  {pending ? <Loader2 className="size-4 animate-spin" /> : <CalendarCheck className="size-4" />}
                  {pending ? "Trazendo…" : "Simular este show"}
                </Button>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
