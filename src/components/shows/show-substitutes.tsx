"use client";

import { useState, useTransition } from "react";
import { UserPlus, Send, Trash2, UserX, Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  createSubstituteAction,
  deleteSubstituteAction,
} from "@/app/(app)/shows/[id]/actions-substitute";
import { createInviteAction } from "@/app/(app)/cadastros/actions";
import type { ShowSubstitute } from "@/db/schema";

function inviteUrl(token: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/cadastro?invite=${token}`;
}
function inviteMessage(nome: string | null, token: string, banda: string) {
  const saud = nome?.trim() ? `Fala, ${nome.trim()}! 🤘` : "Fala! 🤘";
  return `${saud}\n\nVocê tá sendo convidado pra entrar no app da *${banda}* — onde a gente organiza tudo: shows, ensaios, setlist, cachês e avisos.\n\nÉ rapidinho: toque no link, faça seu cadastro e ative as notificações. O link é pessoal e expira em alguns dias.\n\n👉 ${inviteUrl(token)}`;
}

type Decliner = { id: string; nome: string; funcao: string | null };

export function ShowSubstitutes({
  showId,
  admin,
  subs,
  decliners,
  showInfo,
  brandName,
}: {
  showId: string;
  admin: boolean;
  subs: ShowSubstitute[];
  decliners: Decliner[];
  showInfo: { casa: string; quando: string };
  brandName: string;
}) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [contato, setContato] = useState("");
  const [funcao, setFuncao] = useState("");
  const [forMemberId, setForMemberId] = useState<string | undefined>(undefined);
  const [forNome, setForNome] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Nada pra mostrar: sem subs e (não-admin OU ninguém recusou)
  if (subs.length === 0 && (!admin || decliners.length === 0)) return null;

  function abrir(d?: Decliner) {
    setForMemberId(d?.id);
    setForNome(d?.nome ?? null);
    setFuncao(d?.funcao ?? "");
    setNome("");
    setContato("");
    setOpen(true);
  }

  function salvar() {
    if (!nome.trim()) {
      toast.error("Informe o nome do sub.");
      return;
    }
    start(async () => {
      const r = await createSubstituteAction(showId, {
        nome,
        contato: contato || undefined,
        funcao: funcao || undefined,
        forMemberId,
      });
      if (r?.error) toast.error(r.error);
      else {
        toast.success("Sub adicionado. Ele entra na divisão do cachê.");
        setOpen(false);
      }
    });
  }

  function remover(id: string) {
    start(async () => {
      await deleteSubstituteAction(showId, id);
    });
  }

  // Convite de CADASTRO: gera um token amarrado ao telefone do sub e
  // compartilha o link /cadastro?invite=… no WhatsApp (cria conta no app).
  function enviarCadastro(sub: ShowSubstitute) {
    if ((sub.contato ?? "").replace(/\D/g, "").length < 10) {
      toast.error("Adicione o WhatsApp do sub (DDD + número) pra mandar o convite de cadastro.");
      return;
    }
    start(async () => {
      const r = await createInviteAction(sub.nome, sub.contato ?? "");
      if (r && "error" in r && r.error) {
        toast.error(r.error);
        return;
      }
      if (r && "ok" in r && r.ok && r.token) {
        const num = (r.telefone ?? sub.contato ?? "").replace(/\D/g, "");
        const text = encodeURIComponent(inviteMessage(sub.nome, r.token, brandName));
        const url = num
          ? `https://wa.me/55${num}?text=${text}`
          : `https://wa.me/?text=${text}`;
        try {
          await navigator.clipboard.writeText(inviteUrl(r.token));
        } catch {
          /* ignora */
        }
        toast.success("Convite de cadastro criado — abrindo WhatsApp (link copiado também).");
        window.open(url, "_blank", "noopener,noreferrer");
      }
    });
  }

  function waLink(sub: ShowSubstitute) {
    const digits = (sub.contato ?? "").replace(/\D/g, "");
    const msg =
      `Olá ${sub.nome}! Sou da ${brandName}. ` +
      `Precisamos de um sub${sub.funcao ? ` de ${sub.funcao}` : ""} pro show no ${showInfo.casa} ${showInfo.quando}. ` +
      `Topa fechar com a gente? 🤘`;
    const base = digits ? `https://wa.me/${digits}` : `https://wa.me/`;
    return `${base}?text=${encodeURIComponent(msg)}`;
  }

  return (
    <Card>
      <CardContent className="py-5 space-y-4">
        <div className="flex items-center gap-2">
          <UserX className="size-4 text-primary" />
          <h3 className="font-semibold">Substitutos (sub)</h3>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">
          Convide um músico de fora pra cobrir quem não pode tocar. O sub entra na
          divisão do cachê deste show.
        </p>

        {/* Quem recusou → sugestão de convidar sub */}
        {admin && decliners.length > 0 && (
          <div className="space-y-2">
            {decliners.map((d) => {
              const jaTem = subs.some((s) => s.forMemberId === d.id);
              return (
                <div key={d.id} className="flex items-center justify-between rounded-md border border-border bg-muted/20 p-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{d.nome} não vai</p>
                    <p className="text-xs text-muted-foreground">{d.funcao || "músico"}</p>
                  </div>
                  {jaTem ? (
                    <span className="text-xs text-emerald-300">sub convidado ✓</span>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => abrir(d)}>
                      <UserPlus className="size-4" /> Convidar sub
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Subs já adicionados */}
        {subs.length > 0 && (
          <ul className="divide-y divide-border">
            {subs.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {s.nome}
                    {s.funcao ? <span className="text-muted-foreground"> · {s.funcao}</span> : null}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {s.contato || "sem contato"}
                  </p>
                </div>
                <a href={waLink(s)} target="_blank" rel="noreferrer" className="shrink-0">
                  <Button size="sm" variant="outline">
                    <Send className="size-4" /> Chamar
                  </Button>
                </a>
                {admin && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => enviarCadastro(s)}
                    disabled={pending}
                    title="Gerar convite pra ele criar conta no app"
                  >
                    <Mail className="size-4" /> Cadastro
                  </Button>
                )}
                {admin && (
                  <button
                    onClick={() => remover(s.id)}
                    disabled={pending}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    title="Remover sub"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {admin && (
          <Button size="sm" variant="ghost" onClick={() => abrir()} className="text-muted-foreground">
            <UserPlus className="size-4" /> Adicionar sub avulso
          </Button>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Convidar sub</DialogTitle>
              <DialogDescription>
                {forNome ? `No lugar de ${forNome}.` : "Reforço/convidado pra este show."} Ele entra na divisão do cachê.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="sub-nome" className="text-xs">Nome</Label>
                <Input id="sub-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do sub" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sub-funcao" className="text-xs">Função</Label>
                  <Input id="sub-funcao" value={funcao} onChange={(e) => setFuncao(e.target.value)} placeholder="Guitarra, Baixo…" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sub-contato" className="text-xs">WhatsApp</Label>
                  <Input id="sub-contato" value={contato} onChange={(e) => setContato(e.target.value)} placeholder="(31) 9…" inputMode="tel" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={salvar} disabled={pending}>{pending ? "Salvando…" : "Adicionar sub"}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
