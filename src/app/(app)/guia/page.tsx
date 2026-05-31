import {
  CalendarRange,
  Music2,
  Wallet,
  Building2,
  Boxes,
  Megaphone,
  UserCheck,
} from "lucide-react";
import { requireCurrentUser, getBrand } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { PrintButton } from "@/components/shared/print-button";
import { InviteCopy } from "@/components/guia/invite-copy";

export default async function GuiaPage() {
  await requireCurrentUser();
  const brand = await getBrand();
  const banda = brand.bandName?.trim() || "The Rock";

  const secoes = [
    {
      icon: CalendarRange,
      titulo: "Agenda & Shows",
      texto:
        "Todo show fica aqui: data, casa, horários e cachê. Veja a agenda do mês e os detalhes de cada gig.",
    },
    {
      icon: UserCheck,
      titulo: "Sua parte (todo mundo faz)",
      texto:
        "Confirme presença nos shows, marque quando NÃO pode tocar (indisponibilidade) e marque as músicas que você já aprendeu.",
    },
    {
      icon: Music2,
      titulo: "Repertório & Setlist",
      texto:
        "Catálogo de músicas com letra e cifra/tab do seu instrumento. No show, gere o setlist num clique (curva de energia, na ordem certa).",
    },
    {
      icon: Wallet,
      titulo: "Cachês & Financeiro",
      texto:
        "Transparência total: quanto cada um recebe, o que já entrou no caixa e o que ainda falta repassar. Sem planilha perdida.",
    },
    {
      icon: Building2,
      titulo: "Casas",
      texto:
        "Os bares onde a gente toca ou quer tocar — contato, histórico e status. Filtra por cidade e bairro.",
    },
    {
      icon: Boxes,
      titulo: "Equipamentos & Rider",
      texto:
        "O inventário da banda (e de cada músico) e o Rider Técnico pronto pra mandar pro contratante.",
    },
    {
      icon: Megaphone,
      titulo: "Divulgação",
      texto:
        "Flyer do show e cartaz da agenda (baixa a imagem pronta pro Insta), material/press kit e a bio da banda.",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Como usar"
        description="Guia rápido do StageBoss."
        actions={<PrintButton />}
      />
      <div className="p-6 max-w-2xl space-y-5">
        {/* Intro high-level */}
        <Card className="border-red-600/40 bg-[#18181b]">
          <CardContent className="py-5 space-y-2">
            <p className="text-xs uppercase tracking-widest text-amber-400">
              StageBoss · {banda}
            </p>
            <h2 className="text-lg font-bold text-zinc-100">
              Agora é tudo por aqui.
            </h2>
            <p className="text-sm leading-relaxed text-zinc-300">
              Este é o QG da banda. Agenda, repertório, grana, casas,
              equipamentos e divulgação — tudo num lugar só, no celular. Acabou o
              show espalhado em grupo de zap, áudio e planilha. O que vale é o que
              está aqui.
            </p>
          </CardContent>
        </Card>

        {/* Seções */}
        <div className="space-y-3">
          {secoes.map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.titulo} className="border-zinc-800 bg-[#18181b]">
                <CardContent className="flex gap-3 py-4">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-red-600/15 text-red-400">
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-zinc-100">{s.titulo}</p>
                    <p className="text-sm text-zinc-400">{s.texto}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <InviteCopy banda={banda} />

        <Card className="border-zinc-800 bg-[#18181b]">
          <CardContent className="py-4 text-sm text-zinc-400">
            <p>
              <span className="font-medium text-zinc-200">Dica:</span> dá pra
              instalar como app no celular (menu do navegador → “Adicionar à tela
              inicial”). Aí abre igual aplicativo, rapidinho.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
