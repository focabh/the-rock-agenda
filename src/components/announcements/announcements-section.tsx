"use client";

import { useState, useTransition } from "react";
import { Megaphone, Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { NotifyBandButton } from "@/components/shared/notify-band-button";
import { toast } from "sonner";
import {
  createAnnouncementAction,
  deleteAnnouncementAction,
} from "@/app/(app)/announcement-actions";

export type AnnouncementView = {
  id: string;
  titulo: string;
  corpo: string | null;
  autorNome: string | null;
  quando: string;
  recente: boolean;
};

export function AnnouncementsSection({
  announcements,
  admin,
}: {
  announcements: AnnouncementView[];
  admin: boolean;
}) {
  // Membro sem nenhum anúncio: não ocupa espaço no painel.
  if (!admin && announcements.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wider text-primary inline-flex items-center gap-1.5">
          <Megaphone className="size-3.5" />
          Anúncios
        </h2>
        {admin && <NewAnnouncementButton />}
      </div>

      {announcements.length === 0 ? (
        <Card className="p-5 text-sm text-muted-foreground">
          Nenhum anúncio. Crie um pra avisar a banda — novidade no repertório,
          ensaio extra, o que for.
        </Card>
      ) : (
        <div className="space-y-2">
          {announcements.map((a) => (
            <AnnouncementCard key={a.id} a={a} admin={admin} />
          ))}
        </div>
      )}
    </section>
  );
}

function AnnouncementCard({
  a,
  admin,
}: {
  a: AnnouncementView;
  admin: boolean;
}) {
  return (
    <Card className="p-4 border-primary/30 bg-primary/5">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/15 ring-1 ring-primary/30">
          <Megaphone className="size-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold">{a.titulo}</p>
            {a.recente && (
              <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                novo
              </span>
            )}
          </div>
          {a.corpo && (
            <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
              {a.corpo}
            </p>
          )}
          <p className="mt-1.5 text-xs text-muted-foreground/70">
            {a.quando}
            {a.autorNome && ` · ${a.autorNome}`}
          </p>
          {admin && (
            <div className="mt-2 flex items-center gap-2">
              <NotifyBandButton
                title={a.titulo}
                body={a.corpo ?? ""}
                label="Avisar no WhatsApp"
                variant="outline"
              />
              <DeleteAnnouncement id={a.id} titulo={a.titulo} />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function NewAnnouncementButton() {
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [corpo, setCorpo] = useState("");
  const [pending, startTransition] = useTransition();

  function handleCreate() {
    if (!titulo.trim()) {
      toast.error("Escreva um título.");
      return;
    }
    startTransition(async () => {
      const r = await createAnnouncementAction(titulo, corpo);
      if (!r.ok) {
        toast.error(r.error ?? "Erro ao criar anúncio.");
        return;
      }
      toast.success("Anúncio publicado! Use o botão do WhatsApp se quiser avisar.");
      setTitulo("");
      setCorpo("");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Plus className="size-4" />
        Novo anúncio
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo anúncio</DialogTitle>
          <DialogDescription>
            Aparece em destaque no painel de toda a banda. Depois de criar, dá
            pra disparar no WhatsApp (opcional).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ann-titulo">Título</Label>
            <Input
              id="ann-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="5 músicas novas no repertório 🎸"
              maxLength={200}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ann-corpo">Detalhes (opcional)</Label>
            <Textarea
              id="ann-corpo"
              value={corpo}
              onChange={(e) => setCorpo(e.target.value)}
              rows={4}
              placeholder="Bora aprender pra ensaiar no sábado."
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {pending ? "Publicando..." : "Publicar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DeleteAnnouncement({ id, titulo }: { id: string; titulo: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const r = await deleteAnnouncementAction(id);
      if (!r.ok) {
        toast.error(r.error ?? "Erro ao apagar.");
        return;
      }
      toast.success("Anúncio removido.");
      setOpen(false);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
          />
        }
      >
        <Trash2 className="size-4" />
        Apagar
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Apagar “{titulo}”?</AlertDialogTitle>
          <AlertDialogDescription>
            O anúncio some do painel de todos. Não pode ser desfeito.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel render={<Button variant="outline" />}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            render={<Button variant="destructive" disabled={pending} />}
            onClick={handleDelete}
          >
            {pending ? "Apagando..." : "Apagar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
