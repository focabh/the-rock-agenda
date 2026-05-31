import {
  Smartphone,
  CalendarCheck,
  ListMusic,
  Guitar,
  Wallet,
  Megaphone,
  Bell,
  CalendarPlus,
  Building2,
  Radar,
  Users,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

type Secao = { icon: LucideIcon; titulo: string; passos: string[] };

const MUSICO: Secao[] = [
  {
    icon: Smartphone,
    titulo: "Instale no celular",
    passos: [
      "Abra o link da banda no navegador do celular.",
      "Menu do navegador → “Adicionar à tela inicial”. Vira um app de verdade.",
      "Permita as notificações — é por elas que você fica sabendo de show, ensaio e recados.",
    ],
  },
  {
    icon: CalendarCheck,
    titulo: "Confirme sua presença",
    passos: [
      "Em cada Show e Ensaio, toque em Confirmo ou Não posso.",
      "Marque com antecedência os dias que você NÃO pode tocar (indisponibilidade).",
      "Quanto antes confirmar, mais fácil pro resto da banda se organizar.",
    ],
  },
  {
    icon: CalendarCheck,
    titulo: "Veja a agenda",
    passos: [
      "Agenda mostra o mês inteiro; Shows e Ensaios mostram os próximos com data, horário e local.",
      "Abra um show pra ver o endereço (com mapa), o que levar e quem confirmou.",
    ],
  },
  {
    icon: ListMusic,
    titulo: "Setlist do show / ensaio",
    passos: [
      "Dentro do show (aba Setlist) ou do ensaio você vê as músicas na ordem que serão tocadas.",
      "Use pra estudar antes — já sabe o que vem e em qual tom.",
    ],
  },
  {
    icon: Guitar,
    titulo: "Cifra e letra do SEU instrumento",
    passos: [
      "No setlist e no repertório, toque o ícone ao lado da música: abre a cifra/tab certa pro seu instrumento (guitarra, baixo, teclado ou bateria).",
      "A letra fica disponível pra todo mundo — ótimo pra acompanhar e cantar junto.",
      "Dica: seu instrumento vem da sua posição no cadastro; se estiver errado, peça pro admin ajustar.",
    ],
  },
  {
    icon: Megaphone,
    titulo: "Flyer do show",
    passos: [
      "No show, toque em “Flyer do show” pra montar um cartaz pro Instagram.",
      "Escolha um modelo de texto, ajuste e baixe a imagem (Stories ou Feed). Custo zero.",
    ],
  },
  {
    icon: Wallet,
    titulo: "Seu cachê (transparência)",
    passos: [
      "Em Financeiro você vê quanto vai receber de cada show e o que já foi repassado.",
      "Tudo à vista — sem planilha perdida no grupo.",
    ],
  },
];

const ADMIN: Secao[] = [
  {
    icon: CalendarPlus,
    titulo: "Crie shows e ensaios",
    passos: [
      "Em Shows/Ensaios → Novo: data, casa, horários, cachê, valor do ingresso e link de venda.",
      "A banda confirma presença e você acompanha quem vai.",
      "Use “Avisar a banda” pra disparar notificação + recado no grupo do WhatsApp.",
    ],
  },
  {
    icon: ListMusic,
    titulo: "Monte o setlist",
    passos: [
      "Crie quantos setlists quiser (1º set, bis…). Adicione músicas do repertório e arraste pra reordenar.",
      "“Gerar setlist” monta a ordem por curva de energia automaticamente; “Reorganizar” reordena de graça.",
      "A duração vem do próprio show — não precisa setar. No ensaio o setlist é igual, sem tempo.",
    ],
  },
  {
    icon: Guitar,
    titulo: "Repertório",
    passos: [
      "Cadastre músicas com tom, energia e metadados. Sincronize letras e marque afinações dropadas.",
      "Cada músico vê cifra/tab do instrumento dele e a letra.",
    ],
  },
  {
    icon: Building2,
    titulo: "Casas",
    passos: [
      "Cadastre os bares: contato, @ do Instagram, grupo de WhatsApp e logo (pro flyer).",
      "No card, marque rapidão: “Já tocou”, “Voltaria” ou “Não”.",
      "“Capturar logos” busca a imagem das casas no Google automaticamente.",
    ],
  },
  {
    icon: Radar,
    titulo: "Descobrir casas novas",
    passos: [
      "Casas → Descobrir: ele acha bares perto (raio ajustável) que combinam com o perfil da banda.",
      "Edite o termo (rock, ao vivo, pub) pra vir o estilo certo — nada de pagode.",
      "Adicione com 1 toque; já entra como “quer tocar”, com foto e @ quando o Google tem.",
    ],
  },
  {
    icon: Megaphone,
    titulo: "Divulgação",
    passos: [
      "Flyer do show: foto + textos, modelos de estilo, efeitos, e a logo/@ da casa entram sozinhos.",
      "Cartaz da agenda: pôster com os próximos shows pro Instagram.",
      "Tudo baixa como imagem, custo zero. (Flyer também está liberado pros músicos.)",
    ],
  },
  {
    icon: Wallet,
    titulo: "Financeiro",
    passos: [
      "Cachês, repasses por músico, gastos do show e a comissão do manager — tudo somado.",
      "Visão de caixa: o que entrou, o que falta repassar, por músico e no total. Visível a todos (transparência).",
    ],
  },
  {
    icon: Users,
    titulo: "Convites e acesso",
    passos: [
      "Convites: gere um link e mande pro músico entrar. Defina quem é admin e as posições.",
      "Em Conta você ajusta a logo e o nome da banda (aparecem no app e no ícone do celular).",
    ],
  },
  {
    icon: Bell,
    titulo: "Avisos",
    passos: [
      "“Avisar a banda” manda notificação no celular de todo mundo + texto pronto pro grupo do WhatsApp.",
      "Use pra show, ensaio e recebimento.",
    ],
  },
];

export function GuiaDoc({
  perfil,
  banda,
}: {
  perfil: "admin" | "musico";
  banda: string;
}) {
  const isAdmin = perfil === "admin";
  const secoes = isAdmin ? ADMIN : MUSICO;
  const titulo = isAdmin ? "Guia do Admin / Manager" : "Guia do Músico";
  const sub = isAdmin
    ? "Tudo que dá pra fazer pra comandar a banda pelo app."
    : "O essencial pra você usar no dia a dia da banda.";

  return (
    <div className="mx-auto max-w-3xl bg-white px-8 py-8 text-zinc-900 print:px-0">
      <style>{`
        @media print {
          @page { margin: 1.4cm; }
          html, body { background: #fff !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Cabeçalho */}
      <header className="mb-6 rounded-2xl bg-zinc-950 px-7 py-6 text-white print:rounded-none" style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-400">
          StageBoss · {banda}
        </p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">{titulo}</h1>
        <p className="mt-1 text-sm text-zinc-300">{sub}</p>
      </header>

      <p className="mb-6 rounded-xl border border-zinc-200 bg-zinc-50 px-5 py-4 text-sm leading-relaxed text-zinc-700" style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
        Este é o QG da banda: agenda, repertório, setlist, grana, casas e
        divulgação — tudo num lugar só, no celular. Acabou o show espalhado em
        áudio e planilha. {isAdmin ? "Você comanda tudo por aqui." : "O que vale é o que está aqui."}
      </p>

      <ol className="space-y-4">
        {secoes.map((s, i) => {
          const Icon = s.icon;
          return (
            <li key={s.titulo} className="break-inside-avoid rounded-xl border border-zinc-200 p-5">
              <div className="flex items-center gap-3">
                <div
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white"
                  style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
                >
                  <Icon className="size-5" />
                </div>
                <h2 className="text-lg font-bold text-zinc-900">
                  <span className="text-zinc-400">{String(i + 1).padStart(2, "0")}.</span> {s.titulo}
                </h2>
              </div>
              <ul className="mt-3 space-y-1.5 pl-1">
                {s.passos.map((p, j) => (
                  <li key={j} className="flex gap-2 text-sm leading-relaxed text-zinc-700">
                    <span className="mt-1 size-1.5 shrink-0 rounded-full bg-red-500" style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }} />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>

      <div className="mt-6 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-zinc-800" style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
        <Sparkles className="mt-0.5 size-4 shrink-0 text-amber-600" />
        <p>
          <span className="font-semibold">Dica:</span> instale como app (menu do
          navegador → “Adicionar à tela inicial”) e ative as notificações. Fica
          rápido como aplicativo e você não perde nenhum aviso.
        </p>
      </div>

      <p className="mt-6 text-center text-xs text-zinc-400">
        {banda} · StageBoss — {isAdmin ? "guia do admin/manager" : "guia do músico"}
      </p>
    </div>
  );
}
