"use client";

import { useState, useTransition } from "react";
import {
  Copy,
  Link2,
  MessageCircle,
  ShieldCheck,
  Shield,
  KeyRound,
  Ticket,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/shared/empty-state";
import { toast } from "sonner";
import { maskPhone, onlyDigits } from "@/lib/validators";
import {
  createInviteAction,
  revokeInviteAction,
  resetUserPasswordAction,
  setUserRoleAction,
} from "@/app/(app)/cadastros/actions";

type InviteStatus = "valido" | "usado" | "revogado" | "expirado";

type Invite = {
  id: string;
  token: string;
  telefone: string;
  nome: string | null;
  posicao: string | null;
  status: InviteStatus;
  expiresEm: number; // epoch ms
};

type Approved = {
  id: string;
  apelido: string | null;
  nome: string | null;
  sobrenome: string | null;
  username: string;
  role: "admin" | "membro";
  posicao: string | null;
};

function fullName(u: {
  apelido: string | null;
  nome: string | null;
  sobrenome: string | null;
  username: string;
}) {
  return (
    u.apelido?.trim() ||
    [u.nome, u.sobrenome].filter(Boolean).join(" ") ||
    u.username
  );
}

function inviteUrl(token: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/cadastro?invite=${token}`;
}

function inviteMessage(nome: string | null, token: string) {
  const saud = nome?.trim() ? `Oi, ${nome.trim()}!` : "Oi!";
  return `${saud} 🎸 Você foi convidado pra fazer parte do app da The Rock (agenda, shows, cachês).\n\nSeu link de cadastro é pessoal e expira em alguns dias:\n${inviteUrl(token)}`;
}

const STATUS_LABEL: Record<InviteStatus, { text: string; cls: string }> = {
  valido: { text: "Ativo", cls: "text-emerald-400" },
  usado: { text: "Usado", cls: "text-muted-foreground" },
  revogado: { text: "Revogado", cls: "text-muted-foreground" },
  expirado: { text: "Expirado", cls: "text-amber-400" },
};

const selectCls =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function CadastrosManager({
  invites,
  approved,
  availablePositions,
  currentUserId,
}: {
  invites: Invite[];
  approved: Approved[];
  availablePositions: string[];
  currentUserId: string;
}) {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [posicao, setPosicao] = useState("");
  const [isPending, startTransition] = useTransition();

  const ativos = invites.filter((i) => i.status === "valido");
  const historico = invites.filter((i) => i.status !== "valido");

  function copyLink(token: string) {
    navigator.clipboard
      .writeText(inviteUrl(token))
      .then(() => toast.success("Link copiado!"))
      .catch(() => toast.error("Não consegui copiar — copie manualmente."));
  }

  function openWhatsApp(inv: Invite) {
    const num = onlyDigits(inv.telefone);
    const text = encodeURIComponent(inviteMessage(inv.nome, inv.token));
    const url = num
      ? `https://wa.me/55${num}?text=${text}`
      : `https://wa.me/?text=${text}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function gerar() {
    const tel = telefone.trim();
    if (onlyDigits(tel).length < 10) {
      toast.error("Informe um telefone válido (DDD + número).");
      return;
    }
    startTransition(async () => {
      const r = await createInviteAction(nome, tel, posicao);
      if (r?.error) {
        toast.error(r.error);
        return;
      }
      setNome("");
      setTelefone("");
      setPosicao("");
      toast.success("Convite gerado! Envie o link pelo WhatsApp.");
    });
  }

  function revogar(inv: Invite) {
    if (!confirm(`Revogar o convite de ${inv.nome || inv.telefone}?`)) return;
    startTransition(async () => {
      await revokeInviteAction(inv.id);
      toast.success("Convite revogado.");
    });
  }

  return (
    <div className="space-y-8">
      {/* Gerar convite */}
      <Card>
        <CardContent className="py-5 space-y-4">
          <div>
            <h3 className="font-semibold">Convidar alguém</h3>
            <p className="text-sm text-muted-foreground">
              O cadastro é só por convite. Gere um link amarrado ao telefone da
              pessoa e mande pelo WhatsApp. O telefone fica travado no cadastro.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="inv-nome">Nome (opcional)</Label>
              <Input
                id="inv-nome"
                placeholder="João"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-tel">Telefone (WhatsApp) *</Label>
              <Input
                id="inv-tel"
                type="tel"
                inputMode="tel"
                placeholder="(31) 99999-9999"
                value={telefone}
                onChange={(e) => setTelefone(maskPhone(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-posicao">Posição (opcional)</Label>
              <select
                id="inv-posicao"
                className={selectCls}
                value={posicao}
                onChange={(e) => setPosicao(e.target.value)}
              >
                <option value="">Deixar o convidado escolher</option>
                {availablePositions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Se escolher, a posição vem travada no cadastro.
              </p>
            </div>
          </div>
          <Button onClick={gerar} disabled={isPending}>
            <Ticket className="size-4" />
            Gerar convite
          </Button>
        </CardContent>
      </Card>

      {/* Convites ativos */}
      <div>
        <h3 className="font-semibold mb-3">
          Convites ativos{" "}
          {ativos.length > 0 && (
            <span className="text-sm text-emerald-400">({ativos.length})</span>
          )}
        </h3>
        {ativos.length === 0 ? (
          <EmptyState
            icon={Ticket}
            title="Nenhum convite ativo"
            description="Gere um convite acima para liberar o cadastro de alguém."
          />
        ) : (
          <ul className="divide-y divide-border border border-border rounded-md">
            {ativos.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {inv.nome || "Sem nome"}{" "}
                    {inv.posicao && (
                      <span className="text-xs text-primary">· {inv.posicao}</span>
                    )}{" "}
                    <span className="text-xs text-muted-foreground font-mono">
                      {inv.telefone}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Expira em {new Date(inv.expiresEm).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <Button size="sm" variant="default" onClick={() => openWhatsApp(inv)}>
                  <MessageCircle className="size-4" />
                  WhatsApp
                </Button>
                <Button size="sm" variant="outline" onClick={() => copyLink(inv.token)}>
                  <Copy className="size-4" />
                  Copiar link
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => revogar(inv)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Histórico de convites */}
      {historico.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3 text-muted-foreground">
            Histórico de convites
          </h3>
          <ul className="divide-y divide-border border border-border rounded-md">
            {historico.map((inv) => {
              const st = STATUS_LABEL[inv.status];
              return (
                <li key={inv.id} className="flex items-center gap-3 px-4 py-3">
                  <Link2 className="size-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">
                      {inv.nome || "Sem nome"}{" "}
                      <span className="text-xs text-muted-foreground font-mono">
                        {inv.telefone}
                      </span>
                    </p>
                  </div>
                  <span className={"text-xs uppercase tracking-wider " + st.cls}>
                    {st.text}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Usuários com acesso */}
      <div>
        <h3 className="font-semibold mb-3">Usuários com acesso</h3>
        {approved.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="Nenhum usuário ainda"
            description="Quem se cadastrar por convite aparece aqui. Você pode torná-los admin."
          />
        ) : (
          <ul className="divide-y divide-border border border-border rounded-md">
            {approved.map((u) => {
              const isSelf = u.id === currentUserId;
              const isAdmin = u.role === "admin";
              return (
                <li key={u.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {fullName(u)}{" "}
                      {u.posicao && (
                        <span className="text-xs text-muted-foreground">
                          · {u.posicao}
                        </span>
                      )}
                      {isSelf && (
                        <span className="text-xs text-primary ml-1">(você)</span>
                      )}
                    </p>
                    <p className="text-xs uppercase tracking-wider">
                      <span
                        className={
                          isAdmin ? "text-primary" : "text-muted-foreground"
                        }
                      >
                        {isAdmin ? "Admin" : "Músico"}
                      </span>
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    title="Redefinir senha"
                    onClick={() => {
                      const nova = window.prompt(
                        `Nova senha para ${fullName(u)} (mínimo 6 caracteres):`
                      );
                      if (!nova) return;
                      startTransition(async () => {
                        const r = await resetUserPasswordAction(u.id, nova);
                        if (r?.error) toast.error(r.error);
                        else toast.success(`Senha de ${fullName(u)} redefinida.`);
                      });
                    }}
                  >
                    <KeyRound className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isSelf}
                    onClick={() => {
                      const next = isAdmin ? "membro" : "admin";
                      if (
                        !confirm(
                          next === "admin"
                            ? `Tornar ${fullName(u)} administrador? Terá acesso total.`
                            : `Remover o admin de ${fullName(u)}?`
                        )
                      )
                        return;
                      startTransition(async () => {
                        const r = await setUserRoleAction(u.id, next);
                        if (r?.error) toast.error(r.error);
                        else
                          toast.success(
                            next === "admin"
                              ? `${fullName(u)} agora é admin.`
                              : `${fullName(u)} agora é músico.`
                          );
                      });
                    }}
                  >
                    {isAdmin ? (
                      <>
                        <Shield className="size-4" />
                        Tornar músico
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="size-4" />
                        Tornar admin
                      </>
                    )}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
