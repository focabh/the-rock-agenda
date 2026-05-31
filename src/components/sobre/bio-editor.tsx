"use client";

import { useState, useTransition } from "react";
import { Sparkles, Loader2, Pencil, Share2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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
import { toast } from "sonner";
import { saveBioAction, generateBioAction } from "@/app/(app)/sobre/actions";

export function BioEditor({
  initialTexto,
  admin,
}: {
  initialTexto: string | null;
  admin: boolean;
}) {
  const [texto, setTexto] = useState(initialTexto ?? "");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialTexto ?? "");
  const [confirmIA, setConfirmIA] = useState(false);
  const [saving, startSave] = useTransition();
  const [generating, startGen] = useTransition();

  function salvar() {
    startSave(async () => {
      await saveBioAction(draft);
      setTexto(draft.trim());
      setEditing(false);
      toast.success("Bio salva.");
    });
  }
  function gerar() {
    startGen(async () => {
      const r = await generateBioAction();
      if (!r.ok || !r.texto) {
        toast[r.needsKey ? "info" : "error"](r.error ?? "Falha ao gerar.");
        return;
      }
      setTexto(r.texto);
      setDraft(r.texto);
      toast.success("Bio gerada pela IA — revise e ajuste se quiser.");
    });
  }
  function compartilhar() {
    const url = `${window.location.origin}/show`;
    navigator.clipboard?.writeText(url).then(
      () => toast.success("Link do perfil copiado! Mande pro contratante."),
      () => toast.info(url)
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-zinc-800 bg-[#18181b]">
        <CardContent className="py-6">
          {editing ? (
            <div className="space-y-3">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={10}
                placeholder="Escreva a bio da banda (estilo, palco, onde toca)…"
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setEditing(false); setDraft(texto); }}>
                  <X className="size-4" /> Cancelar
                </Button>
                <Button onClick={salvar} disabled={saving}>
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Salvar
                </Button>
              </div>
            </div>
          ) : texto ? (
            <div className="space-y-3 whitespace-pre-wrap leading-relaxed text-zinc-200">
              {texto.split(/\n{2,}/).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">
              Ainda não há uma bio. {admin ? "Escreva a sua ou gere com IA." : "Os admins ainda não escreveram."}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {admin && !editing && (
          <>
            <Button variant="outline" onClick={() => { setDraft(texto); setEditing(true); }}>
              <Pencil className="size-4" /> Editar (manual)
            </Button>
            <Button variant="outline" onClick={() => setConfirmIA(true)} disabled={generating}>
              {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              Gerar com IA
            </Button>
          </>
        )}
        {texto && (
          <Button className="bg-red-600 hover:bg-red-700" onClick={compartilhar}>
            <Share2 className="size-4" /> Compartilhar perfil
          </Button>
        )}
      </div>

      <AlertDialog open={confirmIA} onOpenChange={setConfirmIA}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar bio com IA?</AlertDialogTitle>
            <AlertDialogDescription>
              Usa os dados reais da banda (músicas prontas, energia, casas onde
              tocou) e a IA escreve uma bio de 3 parágrafos. Custa frações de
              centavo e fica salva (não gera custo nas próximas vezes). Confirmar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel render={<Button variant="outline" />}>Cancelar</AlertDialogCancel>
            <AlertDialogAction render={<Button />} onClick={() => { setConfirmIA(false); gerar(); }}>
              Gerar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
