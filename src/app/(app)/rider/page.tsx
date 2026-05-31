import { asc } from "drizzle-orm";
import { db } from "@/db";
import { equipamentos, appSettings } from "@/db/schema";
import { requireCurrentUser } from "@/lib/auth";
import { TIPO_LABEL } from "@/lib/equipamentos";
import { RiderActions } from "@/components/equipamentos/rider-actions";

type Eq = { nome: string; tipo: string; especificacoes: string | null };

export default async function RiderPage() {
  await requireCurrentUser();
  const [rows, settings] = await Promise.all([
    db.select().from(equipamentos).orderBy(asc(equipamentos.nome)),
    db.select({ bandName: appSettings.bandName }).from(appSettings).limit(1),
  ]);
  const banda = settings[0]?.bandName?.trim() || "The Rock";

  // Rider = infraestrutura coletiva + microfones/in-ears individuais.
  const relevantes = rows.filter(
    (e) => e.categoria === "infraestrutura_coletiva" || e.tipo === "microfone" || e.tipo === "in_ear"
  );
  const pick = (tipos: string[]): Eq[] =>
    relevantes.filter((e) => tipos.includes(e.tipo));

  const secoes: { titulo: string; itens: Eq[] }[] = [
    { titulo: "Sistema de Monitoração", itens: pick(["in_ear", "retorno_palco"]) },
    { titulo: "Sistema de PA e Caixas", itens: pick(["pa"]) },
    { titulo: "Microfonação e Linhas", itens: pick(["mesa_som", "microfone", "periferico"]) },
  ];
  const outros = pick(["outro"]);
  if (outros.length) secoes.push({ titulo: "Outros", itens: outros });

  const temAlgo = secoes.some((s) => s.itens.length > 0);

  // Texto plano pro WhatsApp.
  const texto =
    `RIDER TÉCNICO — ${banda}\n\n` +
    secoes
      .filter((s) => s.itens.length)
      .map(
        (s) =>
          `${s.titulo.toUpperCase()}\n` +
          s.itens.map((e) => `- ${e.nome}${e.especificacoes ? ` (${e.especificacoes})` : ""}`).join("\n")
      )
      .join("\n\n");

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100">
      <div className="mx-auto max-w-2xl px-6 py-8 print:py-4">
        <div className="mb-6 flex items-start justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-amber-400">
              Rider Técnico
            </p>
            <h1 className="text-2xl font-bold">{banda}</h1>
          </div>
          <RiderActions texto={texto} />
        </div>

        {!temAlgo ? (
          <p className="py-12 text-center text-zinc-400">
            Sem equipamentos cadastrados ainda. Cadastre em Equipamentos.
          </p>
        ) : (
          <div className="space-y-6">
            {secoes
              .filter((s) => s.itens.length > 0)
              .map((s) => (
                <section key={s.titulo}>
                  <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">
                    {s.titulo}
                  </h2>
                  <ul className="space-y-1">
                    {s.itens.map((e, i) => (
                      <li key={i} className="flex items-baseline justify-between gap-3 border-b border-zinc-800/60 py-1.5">
                        <span className="font-medium">{e.nome}</span>
                        <span className="text-sm text-zinc-400">
                          {TIPO_LABEL[e.tipo]}
                          {e.especificacoes ? ` · ${e.especificacoes}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
          </div>
        )}

        <p className="mt-8 text-[10px] uppercase tracking-widest text-zinc-600 print:hidden">
          powered by StageBoss
        </p>
      </div>
    </div>
  );
}
