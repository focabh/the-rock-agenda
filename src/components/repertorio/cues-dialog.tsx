"use client";

import { useState, useTransition } from "react";
import { Flag, Wand2, Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { setSongCuesAction, getSuggestedCuesAction } from "@/app/(app)/repertorio/actions";

type Cue = { t: number; label: string };

const toMMSS = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
function parseMMSS(v: string): number {
  const m = v.trim().match(/^(\d+):(\d{1,2})$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

/** Edita as marcações (intro/solo/"entra vocal") de uma música. */
export function CuesDialog({ songId, titulo, initial }: { songId: string; titulo: string; initial: Cue[] }) {
  const [open, setOpen] = useState(false);
  const [cues, setCues] = useState<Cue[]>(initial);
  const [pending, start] = useTransition();
  const [sugPending, startSug] = useTransition();

  function setCue(i: number, patch: Partial<Cue>) {
    setCues((cs) => cs.map((c, k) => (k === i ? { ...c, ...patch } : c)));
  }
  function add() {
    setCues((cs) => [...cs, { t: 0, label: "Solo" }]);
  }
  function remove(i: number) {
    setCues((cs) => cs.filter((_, k) => k !== i));
  }
  function sugerir() {
    startSug(async () => {
      const r = await getSuggestedCuesAction(songId);
      if (!r.ok) {
        toast.error(r.error ?? "Não consegui sugerir.");
        return;
      }
      // Mescla com as existentes (não duplica tempos parecidos).
      setCues((cur) => {
        const merged = [...cur];
        for (const s of r.cues) {
          if (!merged.some((c) => Math.abs(c.t - s.t) < 3)) merged.push(s);
        }
        return merged.sort((a, b) => a.t - b.t);
      });
      toast.success(`${r.cues.length} marcação(ões) sugerida(s). Ajuste e salve.`);
    });
  }
  function salvar() {
    start(async () => {
      const ok = cues.every((c) => c.label.trim());
      if (!ok) {
        toast.error("Toda marcação precisa de um nome.");
        return;
      }
      const r = await setSongCuesAction(songId, cues);
      if (r.ok) {
        toast.success("Marcações salvas.");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="shrink-0 inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-amber-300"
            title="Marcações (intro/solo) pro teleprompter"
          />
        }
      >
        <Flag className="size-4" />
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Marcações · {titulo}</DialogTitle>
          <DialogDescription>
            Intro, solos e &quot;entra vocal&quot; — aparecem no teleprompter (modo Sync) com contagem
            até o vocal voltar. Tempo em <strong>min:seg</strong>.
          </DialogDescription>
        </DialogHeader>

        <Button variant="outline" size="sm" onClick={sugerir} disabled={sugPending} className="self-start">
          {sugPending ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
          Sugerir automático
        </Button>

        <div className="max-h-72 space-y-2 overflow-y-auto">
          {cues.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhuma marcação. Use &quot;Sugerir automático&quot; ou adicione manualmente.
            </p>
          ) : (
            cues.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  defaultValue={toMMSS(c.t)}
                  onBlur={(e) => setCue(i, { t: parseMMSS(e.target.value) })}
                  className="w-20 text-center font-mono"
                  placeholder="0:00"
                />
                <Input
                  value={c.label}
                  onChange={(e) => setCue(i, { label: e.target.value })}
                  placeholder="Ex.: Solo de guitarra (3x)"
                  maxLength={60}
                />
                <button onClick={() => remove(i)} className="shrink-0 text-muted-foreground hover:text-destructive" title="Remover">
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={add}>
            <Plus className="size-4" /> Adicionar
          </Button>
          <Button onClick={salvar} disabled={pending}>
            {pending ? "Salvando…" : "Salvar marcações"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
