"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function InviteCopy({ banda }: { banda: string }) {
  const [copiado, setCopiado] = useState<string | null>(null);

  const umaLinha = `🤘 Agora é tudo no StageBoss: shows, setlist, cachê e divulgação num lugar só. Entre e confirme sua presença nos próximos shows!`;

  const curto = `🤘 StageBoss — o QG da ${banda} agora é o app.
Show, setlist, cachê, casas e divulgação: tudo por lá (chega de zap/planilha). Entre, confirme presença nos shows e marque suas indisponibilidades.
📲 Instale no celular: menu do navegador → "Adicionar à tela inicial". Dúvidas? Abra "Como usar" no menu.`;

  const completo = `🤘 Galera, agora é tudo no StageBoss!

Nosso QG digital. A partir de agora a gente faz tudo por lá — chega de show espalhado em áudio, print e planilha. O que vale é o que está no app.

🗓️ Agenda & Shows — todos os shows, data, casa, horário e cachê.
✅ Sua parte — confirme presença, marque quando não puder tocar e as músicas que já aprendeu.
🎵 Repertório — letra e cifra/tab do seu instrumento; o setlist sai pronto num clique.
💰 Cachês — quanto cada um recebe, o que já entrou e o que falta.
🏠 Casas — bares onde tocamos/queremos tocar.
🧰 Equipamentos & Rider — inventário e o rider pro contratante.
📣 Divulgação — flyer do show e cartaz da agenda prontos pro Insta.

Bora: entre com seu login, abra "Como usar" no menu e instale no celular (menu do navegador → "Adicionar à tela inicial"). Depois confirme sua presença nos próximos shows. 🎸`;

  const opcoes: { id: string; label: string; texto: string }[] = [
    { id: "curto", label: "Versão curta", texto: curto },
    { id: "linha", label: "Uma linha", texto: umaLinha },
    { id: "completo", label: "Completa", texto: completo },
  ];

  function copiar(id: string, texto: string) {
    navigator.clipboard?.writeText(texto).then(
      () => {
        setCopiado(id);
        toast.success("Copiado! Cola no grupo.");
        setTimeout(() => setCopiado((c) => (c === id ? null : c)), 2500);
      },
      () => toast.error("Não consegui copiar.")
    );
  }

  return (
    <Card className="border-zinc-800 bg-[#18181b] print:hidden">
      <CardContent className="py-4 space-y-3">
        <p className="text-sm font-medium text-zinc-100">Convite pro grupo</p>
        <p className="text-xs text-zinc-400">
          Copie e cole no WhatsApp da banda pra todo mundo começar.
        </p>
        <div className="flex flex-wrap gap-2">
          {opcoes.map((o) => (
            <Button
              key={o.id}
              variant="outline"
              size="sm"
              onClick={() => copiar(o.id, o.texto)}
            >
              {copiado === o.id ? (
                <Check className="size-4 text-emerald-400" />
              ) : (
                <Copy className="size-4" />
              )}
              {o.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
