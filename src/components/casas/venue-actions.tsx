"use client";

import { useState, useTransition } from "react";
import {
  MessageCircle,
  Heart,
  CheckCircle2,
  Ban,
  Loader2,
  Send,
  History as HistoryIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { onlyDigits } from "@/lib/validators";
import {
  VENUE_MESSAGES,
  type VenueMessageTemplate,
  type VenueMsgTipo,
} from "@/lib/venue-messages";
import {
  logVenueContactAction,
  setVenueRelAction,
  setVenueHistoryAction,
} from "@/app/(app)/casas/contact-actions";

type Rel = { querTocar: boolean; jaTocou: boolean; naoContatar: boolean };

export function VenueActions({
  venueId,
  telefone,
  grupoLink = null,
  rel,
  materialLinks,
  materialDate,
  apresentacaoDate,
  admin,
}: {
  venueId: string;
  telefone: string | null;
  /** Link de convite do grupo de WhatsApp da casa (opcional). */
  grupoLink?: string | null;
  rel: Rel;
  /** Caminhos/URLs do material da banda (anexados na divulgação). */
  materialLinks: string[];
  materialDate: string; // yyyy-mm-dd ou ""
  apresentacaoDate: string;
  admin: boolean;
}) {
  const [pending, start] = useTransition();
  const [active, setActive] = useState<VenueMessageTemplate | null>(null);

  function toggleRel(key: keyof Rel) {
    start(async () => {
      await setVenueRelAction(venueId, { [key]: !rel[key] });
    });
  }

  return (
    <div className="space-y-4">
      {/* Relacionamento */}
      {admin && (
        <div className="flex flex-wrap gap-2">
          <RelToggle
            on={rel.querTocar}
            onClick={() => toggleRel("querTocar")}
            icon={<Heart className="size-4" />}
            label="Gostaria de tocar"
            tone="primary"
          />
          <RelToggle
            on={rel.jaTocou}
            onClick={() => toggleRel("jaTocou")}
            icon={<CheckCircle2 className="size-4" />}
            label="Já tocou aqui"
            tone="emerald"
          />
          <RelToggle
            on={rel.naoContatar}
            onClick={() => toggleRel("naoContatar")}
            icon={<Ban className="size-4" />}
            label="Não contatar"
            tone="red"
          />
        </div>
      )}

      {/* Mensagens prontas */}
      <Card className="p-4 space-y-3">
        <p className="text-sm font-medium">Mensagens (WhatsApp)</p>
        <div className="flex flex-wrap gap-2">
          {VENUE_MESSAGES.map((m) => (
            <Button
              key={m.key}
              variant="outline"
              size="sm"
              onClick={() => setActive(m)}
            >
              <MessageCircle className="size-4" />
              {m.label}
            </Button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setActive({
                key: "livre",
                label: "Mensagem livre",
                tipo: "contato",
                texto: "",
              })
            }
          >
            <Send className="size-4" />
            Mensagem livre
          </Button>
        </div>
        {!telefone && (
          <p className="text-xs text-muted-foreground">
            Sem telefone cadastrado — o WhatsApp abrirá pra você escolher o
            contato. O registro do contato é feito mesmo assim.
          </p>
        )}
      </Card>

      {/* Ajuste manual de histórico antigo */}
      {admin && (
        <ManualHistory
          venueId={venueId}
          materialDate={materialDate}
          apresentacaoDate={apresentacaoDate}
        />
      )}

      {active && (
        <MessageDialog
          venueId={venueId}
          telefone={telefone}
          grupoLink={grupoLink}
          template={active}
          materialLinks={materialLinks}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  );
}

function RelToggle({
  on,
  onClick,
  icon,
  label,
  tone,
}: {
  on: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  tone: "primary" | "emerald" | "red";
}) {
  const toneOn =
    tone === "primary"
      ? "bg-primary/20 text-primary ring-primary/40"
      : tone === "emerald"
        ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
        : "bg-red-500/15 text-red-300 ring-red-500/30";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset transition-colors",
        on ? toneOn : "ring-border text-muted-foreground hover:bg-accent/50"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function MessageDialog({
  venueId,
  telefone,
  grupoLink,
  template,
  materialLinks,
  onClose,
}: {
  venueId: string;
  telefone: string | null;
  grupoLink?: string | null;
  template: VenueMessageTemplate;
  materialLinks: string[];
  onClose: () => void;
}) {
  const initial =
    template.texto +
    (template.incluiMaterial && materialLinks.length
      ? "\n\n" +
        materialLinks
          .map((l) =>
            l.startsWith("/")
              ? `${typeof window !== "undefined" ? window.location.origin : ""}${l}`
              : l
          )
          .join("\n")
      : "");
  const [text, setText] = useState(initial);
  const [pending, start] = useTransition();

  function registrar() {
    start(async () => {
      await logVenueContactAction(venueId, template.tipo, text);
      onClose();
    });
  }

  function send() {
    const digits = onlyDigits(telefone ?? "");
    const base = digits ? `https://wa.me/55${digits}` : "https://wa.me/";
    window.open(
      `${base}?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer"
    );
    toast.success("Contato registrado.");
    registrar();
  }

  function sendGroup() {
    if (!grupoLink) return;
    navigator.clipboard?.writeText(text).catch(() => {});
    window.open(grupoLink, "_blank", "noopener,noreferrer");
    toast.success("Texto copiado — cole no grupo e envie. Contato registrado.");
    registrar();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{template.label}</DialogTitle>
          <DialogDescription>
            Edite à vontade. Ao enviar, abre o WhatsApp e o app registra o
            contato automaticamente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={9}
            autoFocus
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            {grupoLink && (
              <Button variant="outline" onClick={sendGroup} disabled={pending}>
                <MessageCircle className="size-4" />
                Abrir grupo da casa
              </Button>
            )}
            <Button onClick={send} disabled={pending}>
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <MessageCircle className="size-4" />
              )}
              {telefone ? "Enviar (contato direto)" : "Enviar pelo WhatsApp"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ManualHistory({
  venueId,
  materialDate,
  apresentacaoDate,
}: {
  venueId: string;
  materialDate: string;
  apresentacaoDate: string;
}) {
  const [mat, setMat] = useState(materialDate);
  const [apr, setApr] = useState(apresentacaoDate);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      await setVenueHistoryAction(venueId, {
        materialEnviadoEm: mat || null,
        ultimaApresentacaoManual: apr || null,
      });
      toast.success("Histórico atualizado.");
    });
  }

  return (
    <Card className="p-4 space-y-3">
      <p className="text-sm font-medium inline-flex items-center gap-1.5">
        <HistoryIcon className="size-4" />
        Ajuste manual (histórico antigo)
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="mat">Material enviado em</Label>
          <Input
            id="mat"
            type="date"
            value={mat}
            onChange={(e) => setMat(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="apr">Última apresentação</Label>
          <Input
            id="apr"
            type="date"
            value={apr}
            onChange={(e) => setApr(e.target.value)}
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={save} disabled={pending}>
          {pending ? "Salvando…" : "Salvar histórico"}
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Normalmente isso é automático (ao enviar material/registrar shows). Use
        só pra lançar histórico anterior ao app.
      </p>
    </Card>
  );
}
