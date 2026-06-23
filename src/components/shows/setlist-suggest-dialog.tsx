"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Lightbulb,
  Loader2,
  Plus,
  Minus,
  ArrowLeftRight,
  Check,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
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
import { formatDuracao } from "@/lib/formatters";
import {
  suggestSetlistAction,
  addSongToSetlistAction,
  removeSetlistItemAction,
  type SetlistSuggestion,
} from "@/app/(app)/shows/[id]/actions-setlist";
import {
  addSongToEnsaioSetlistAction,
  removeEnsaioSetlistItemAction,
} from "@/app/(app)/ensaios/[id]/actions-setlist";

export function SetlistSuggestDialog({
  showId,
  rehearsalId,
  setlistId,
  canEdit = false,
}: {
  showId?: string;
  rehearsalId?: string;
  setlistId: string;
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, start] = useTransition();
  const [applyingIdx, setApplyingIdx] = useState<number | null>(null);
  const [sugestoes, setSugestoes] = useState<SetlistSuggestion[]>([]);
  const [totalSeg, setTotalSeg] = useState(0);
  const [targetMin, setTargetMin] = useState("");
  const [via, setVia] = useState<"ia" | "heuristica" | null>(null);
  const [done, setDone] = useState<Set<number>>(new Set());

  function run(target?: number, useAI = false) {
    start(async () => {
      const r = await suggestSetlistAction(setlistId, target, useAI);
      if (!r.ok) {
        toast.error(
          r.needsKey
            ? "IA não configurada (ANTHROPIC_API_KEY)."
            : (r.error ?? "Não consegui sugerir.")
        );
        return;
      }
      setSugestoes(r.suggestions);
      setTotalSeg(r.totalSeg);
      setTargetMin(String(r.targetMin));
      setVia(r.via ?? null);
      setDone(new Set());
    });
  }

  useEffect(() => {
    if (!open) {
      setSugestoes([]);
      setDone(new Set());
      return;
    }
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, setlistId]);

  async function aplicar(s: SetlistSuggestion, idx: number) {
    setApplyingIdx(idx);
    try {
      if (s.removeItemId) {
        await (rehearsalId
          ? removeEnsaioSetlistItemAction(rehearsalId, s.removeItemId)
          : removeSetlistItemAction(showId!, s.removeItemId));
      }
      if (s.addSongId) {
        await (rehearsalId
          ? addSongToEnsaioSetlistAction(rehearsalId, setlistId, s.addSongId)
          : addSongToSetlistAction(showId!, setlistId, s.addSongId));
      }
      setDone((d) => new Set(d).add(idx));
      toast.success("Aplicado.");
      router.refresh();
    } catch {
      toast.error("Não consegui aplicar.");
    } finally {
      setApplyingIdx(null);
    }
  }

  const target = Number(targetMin) || 0;
  const totalMin = Math.round(totalSeg / 60);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Lightbulb className="size-4" />
        Sugerir ajustes
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Sugestões de ajuste</DialogTitle>
          <DialogDescription>
            Baseado no tempo-alvo, sugere o que remover/adicionar/trocar — sem
            mexer no setlist. Você aplica o que quiser.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-2 border-b border-border pb-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor="tgt">
              Tempo-alvo (min)
            </label>
            <Input
              id="tgt"
              type="number"
              min={1}
              max={600}
              value={targetMin}
              onChange={(e) => setTargetMin(e.target.value)}
              className="w-24"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => run(target)}
            disabled={loading || target <= 0}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Básica
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => run(target, true)}
            disabled={loading || target <= 0}
            title="Usa IA (Haiku) pra considerar o gosto do público e o perfil da casa"
          >
            <Sparkles className="size-4" />
            Com IA
          </Button>
          <span className="ml-auto self-center text-xs text-muted-foreground">
            Atual: ~{formatDuracao(totalSeg)}
            {target > 0 && (
              <>
                {" · "}
                {totalMin > target ? "+" : ""}
                {totalMin - target} min vs alvo
              </>
            )}
            {via === "ia" && <span className="ml-1 text-sky-400">· via IA</span>}
          </span>
        </div>

        {loading && sugestoes.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" /> Analisando…
          </div>
        ) : sugestoes.length === 0 ? (
          <p className="py-8 text-center text-sm text-emerald-300">
            Nada a ajustar — o setlist está bem pro tempo-alvo. 🤘
          </p>
        ) : (
          <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
            {sugestoes.map((s, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 rounded-lg border border-border p-2.5 text-sm"
              >
                <SuggIcon kind={s.kind} />
                <span className="min-w-0 flex-1">{s.reason}</span>
                {canEdit &&
                  (done.has(idx) ? (
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs text-emerald-400">
                      <Check className="size-4" /> feito
                    </span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={() => aplicar(s, idx)}
                      disabled={applyingIdx !== null}
                    >
                      {applyingIdx === idx ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        "Aplicar"
                      )}
                    </Button>
                  ))}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SuggIcon({ kind }: { kind: SetlistSuggestion["kind"] }) {
  const cls = "mt-0.5 size-4 shrink-0";
  if (kind === "add") return <Plus className={`${cls} text-emerald-400`} />;
  if (kind === "remove") return <Minus className={`${cls} text-red-400`} />;
  return <ArrowLeftRight className={`${cls} text-sky-400`} />;
}
