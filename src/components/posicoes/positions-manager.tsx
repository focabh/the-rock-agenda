"use client";

import { useState, useTransition } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { BandPosition } from "@/db/schema";
import {
  createPositionAction,
  renamePositionAction,
  togglePositionAction,
  deletePositionAction,
  movePositionAction,
} from "@/app/(app)/posicoes/actions";

export function PositionsManager({
  positions,
}: {
  positions: BandPosition[];
}) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [delTarget, setDelTarget] = useState<BandPosition | null>(null);
  const [pending, start] = useTransition();

  function add() {
    if (!newName.trim()) return;
    start(async () => {
      const r = await createPositionAction(newName);
      if (!r.ok) {
        toast.error(r.error ?? "Erro.");
        return;
      }
      setNewName("");
      toast.success("Posição adicionada.");
    });
  }

  function saveRename(id: string) {
    start(async () => {
      const r = await renamePositionAction(id, editName);
      if (!r.ok) {
        toast.error(r.error ?? "Erro.");
        return;
      }
      setEditingId(null);
    });
  }

  function confirmDelete() {
    if (!delTarget) return;
    const t = delTarget;
    start(async () => {
      const r = await deletePositionAction(t.id);
      if (!r.ok) {
        toast.error(r.error ?? "Erro.");
        return;
      }
      setDelTarget(null);
      toast.success("Posição removida.");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nova posição (ex.: Teclado, Gaita, Sax…)"
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <Button onClick={add} disabled={pending || !newName.trim()}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          Adicionar
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        <ul className="divide-y divide-border">
          {positions.map((p, idx) => {
            const editing = editingId === p.id;
            return (
              <li
                key={p.id}
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5",
                  !p.ativo && "opacity-50"
                )}
              >
                <div className="flex flex-col">
                  <button
                    onClick={() =>
                      start(async () => {
                        await movePositionAction(p.id, "up");
                      })
                    }
                    disabled={idx === 0 || pending}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    title="Subir"
                  >
                    <ChevronUp className="size-3.5" />
                  </button>
                  <button
                    onClick={() =>
                      start(async () => {
                        await movePositionAction(p.id, "down");
                      })
                    }
                    disabled={idx === positions.length - 1 || pending}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    title="Descer"
                  >
                    <ChevronDown className="size-3.5" />
                  </button>
                </div>

                {editing ? (
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    autoFocus
                    className="h-8 flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveRename(p.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                ) : (
                  <span className="flex-1 font-medium">
                    {p.nome}
                    {!p.ativo && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (inativa)
                      </span>
                    )}
                  </span>
                )}

                {editing ? (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => saveRename(p.id)}
                      disabled={pending}
                      title="Salvar"
                    >
                      <Check className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingId(null)}
                      title="Cancelar"
                    >
                      <X className="size-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        start(async () => {
                          await togglePositionAction(p.id, !p.ativo);
                        })
                      }
                      disabled={pending}
                      title={p.ativo ? "Desativar" : "Ativar"}
                    >
                      {p.ativo ? (
                        <Eye className="size-4" />
                      ) : (
                        <EyeOff className="size-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingId(p.id);
                        setEditName(p.nome);
                      }}
                      title="Renomear"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setDelTarget(p)}
                      title="Excluir"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </>
                )}
              </li>
            );
          })}
          {positions.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              Nenhuma posição. Adicione a primeira acima.
            </li>
          )}
        </ul>
      </Card>

      <p className="text-xs text-muted-foreground">
        Desativar esconde a posição de novos cadastros sem mexer em quem já a
        usa. Excluir remove de vez (não afeta músicos já cadastrados).
      </p>

      <AlertDialog
        open={!!delTarget}
        onOpenChange={(o) => !o && setDelTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir “{delTarget?.nome}”?</AlertDialogTitle>
            <AlertDialogDescription>
              A posição some das opções de cadastro. Músicos que já a têm não são
              afetados. Se quiser só escondê-la, use “Desativar”.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel render={<Button variant="outline" />}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              render={<Button variant="destructive" disabled={pending} />}
              onClick={confirmDelete}
            >
              {pending ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
